import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Call, Ctx, LimitWindow, Mood, Open, Pc, Pet, Prefs, Sub, Warned } from '../types'
import {
  WINDOW_LABEL,
  atRu,
  barSvg,
  callsRu,
  clock,
  dateRu,
  fit,
  nextMonthly,
  pcFromLine,
  subFromConfig,
  toWindows,
  toolName,
  toolWhat,
  untilRu,
  warnLevel,
} from './info'
import { metaLine } from './timer'
import { FRAME_H, FRAME_W, SPRITES } from './sprites'

const PANE = 'tikinson'
const TITLE = 'Tikinson'

// Change a tag when that value's fields change: an older stored value is then
// read as the initial one instead of meeting new code.
const pet = atom(
  { plugin: 'tikinson-pet', key: 'pet' } as const,
  { mood: 'idle', detail: '', tools: 0, running: 0 } as Pet,
  { shape: 'pet-2' },
)
const limits = atom({ plugin: 'tikinson-pet', key: 'limits' } as const, [] as LimitWindow[], { shape: 'limits-1' })
const ctx = atom({ plugin: 'tikinson-pet', key: 'ctx' } as const, null as Ctx | null, { shape: 'ctx-1' })
const sub = atom({ plugin: 'tikinson-pet', key: 'sub' } as const, null as Sub | null, { shape: 'sub-1' })
const pc = atom({ plugin: 'tikinson-pet', key: 'pc' } as const, null as Pc | null, { shape: 'pc-1' })
const DEFAULT_PREFS: Prefs = { isMuted: false, isPcOn: true, isCompact: false }
const prefs = atom({ plugin: 'tikinson-pet', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-3' })
const CLOSED: Open = { pc: false, sub: false, tools: false }
const open = atom({ plugin: 'tikinson-pet', key: 'open' } as const, CLOSED, { shape: 'open-1' })
const calls = atom({ plugin: 'tikinson-pet', key: 'calls' } as const, [] as Call[], { shape: 'calls-1' })
const warned = atom({ plugin: 'tikinson-pet', key: 'warned' } as const, {} as Warned, { shape: 'warned-1' })
const pcNote = atom({ plugin: 'tikinson-pet', key: 'pcNote' } as const, '')
const tick = atom({ plugin: 'tikinson-pet', key: 'tick' } as const, 0)

// Which row of the atlas each mood plays, and how fast (ms per frame).
const LOOK: Record<Mood, { sprite: string; ms: number; label: string }> = {
  idle: { sprite: 'idle', ms: 220, label: 'Отдыхает' },
  wave: { sprite: 'wave', ms: 200, label: 'Привет!' },
  think: { sprite: 'think', ms: 200, label: 'Думает…' },
  run: { sprite: 'run', ms: 90, label: 'Работает' },
  wait: { sprite: 'wait', ms: 220, label: 'Ждёт твоего ответа' },
  done: { sprite: 'done', ms: 180, label: 'Готово!' },
  fail: { sprite: 'fail', ms: 160, label: 'Что-то пошло не так' },
}

// Tools that wait on the person rather than work.
const ASKS = new Set(['AskUserQuestion', 'ExitPlanMode'])

// How long the finish (or failure) plays before Tikinson rests.
const SETTLE_MS = 6000

// A turn at least this long ends with the "done" chime; shorter ones stay quiet.
const CHIME_AFTER_MS = 10000

// The context fill from which the pane offers to compact.
const COMPACT_FROM_PCT = 85

// The redesign's palette: warm limits, a calm context, a red past 85 %.
const WARM = '#b8845a'
const CALM = '#819387'
const ALERT = '#c0584a'
const ACCENT = '#b57944'

// Speaker glyphs in text presentation (U+FE0E), the muted one struck through.
// Full-size glyphs: the speaker (struck through when muted) and the fold
// arrow pointing where the info goes: up to fold it, down to show it.
const SPEAKER_ON = '\u{1F50A}'
const SPEAKER_OFF = '\u{1F507}'
const ARROW_FOLD = '\uFE3F'
const ARROW_OPEN = '\uFE40'

// The name on the toolbar and the pane's tab, in Latin letters.
const BRAND = 'Tikinson'

// A one-pixel rule in a translucent grey that reads on a light and dark pane.
const RULE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 1" width="260" height="1" preserveAspectRatio="none">' +
  '<rect width="260" height="1" fill="#8c8781" fill-opacity="0.25"/></svg>'

// How many of the turn's tool calls the list shows (the latest).
const TOOLS_SHOWN = 8

// How often pcwatch.ps1 samples the computer, in seconds.
const PC_EVERY_S = '5'

// Module variables: a reload drops them (and kills the pcwatch child and the
// timers with the old module), and session.start sets them again.
let settle: Timer | undefined
let minute: Timer | undefined
let isPcWatched = false
let pcChild: ReturnType<EngineInterface['process']['spawn']> | undefined

function svgFor(mood: Mood): string {
  const look = LOOK[mood]
  const strip = SPRITES[look.sprite]!
  const n = strip.frames
  const xs = Array.from({ length: n }, (_, i) => String(-i * FRAME_W)).join(';')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_W} ${FRAME_H}" width="${FRAME_W}" height="${FRAME_H}">` +
    `<image x="0" y="0" width="${FRAME_W * n}" height="${FRAME_H}" href="data:image/webp;base64,${strip.data}">` +
    `<animate attributeName="x" values="${xs}" dur="${n * look.ms}ms" calcMode="discrete" repeatCount="indefinite"/>` +
    `</image></svg>`
  )
}

/** Changes the person's choices and keeps them for the next sessions. */
async function setPrefs($: EngineInterface, change: (p: Prefs) => Prefs): Promise<Prefs> {
  const next = await update($, prefs, change)
  await $.store.set('prefs', next)

  return next
}

/** Plays one of the mod's chimes, unless the person muted them. */
async function chime($: EngineInterface, name: 'done' | 'wait'): Promise<void> {
  try {
    if ((await read($, prefs)).isMuted) return
    // A drive-letter root is Windows, where the engine's own player plays
    // nothing: the system one does.
    if (/^[A-Za-z]:[\\/]/.test($.plugin.root)) {
      const file = `${$.plugin.root}/sounds/${name}.wav`.replaceAll("'", "''")
      const ran = await $.process.run(
        ['powershell', '-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer '${file}').PlaySync()`],
        { timeoutMs: 15000 },
      )
      if (ran.exitCode !== 0) {
        $.ui.toast(`Тикинсон: звук не сыграл — ${(ran.stderr.trim().split(/\r?\n/)[0] ?? '').slice(0, 160)}`)
      }
    } else {
      await $.audio.play({ asset: `sounds/${name}.wav` })
    }
  } catch (err) {
    $.ui.toast(`Тикинсон: звук не сыграл — ${String(err).slice(0, 160)}`)
  }
}

/** The plan fields of the local login record; nothing else leaves the file. */
async function loadSub($: EngineInterface): Promise<void> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    if (!home) return
    const found = subFromConfig(await $.fs.read(`${home}/.claude.json`))
    await update($, sub, () => found)
  } catch {
    // No login record, or one without a plan: the pane says nothing of it.
  }
}

/**
 * One PowerShell child for the session's life (pcwatch.ps1), printing a
 * sample every few seconds; typeperf is not used, as it refuses to run
 * without a console window.
 */
async function watchPc($: EngineInterface): Promise<void> {
  if (isPcWatched) return
  isPcWatched = true
  let samples = 0
  let errText = ''
  try {
    const child = $.process.spawn({
      argv: [
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        `${$.plugin.root}/hooks/pcwatch.ps1`,
        '-Every',
        PC_EVERY_S,
      ],
    })
    pcChild = child
    let rest = ''
    for await (const piece of child) {
      if (pcChild !== child) break
      if (piece.stream !== 'stdout') {
        errText = (errText + piece.text).slice(-300)
        continue
      }
      const lines = (rest + piece.text).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const line of lines) {
        const sample = pcFromLine(line)
        if (!sample) continue
        if (samples++ === 0) await update($, pcNote, () => '')
        // Write only a change, so a steady machine redraws nothing.
        await update($, pc, old =>
          old && old.cpu === sample.cpu && old.ramUsedGb === sample.ramUsedGb && old.disk === sample.disk
            ? old
            : sample,
        )
      }
    }
    if (samples === 0 && pcChild === child) {
      const why = errText.trim().split(/\r?\n/)[0] ?? ''
      await update($, pcNote, () => `монитор завершился без данных${why ? `: ${why}` : ''}`)
    }
  } catch (err) {
    await update($, pcNote, () => `не удалось запустить монитор: ${String(err).slice(0, 200)}`)
  } finally {
    isPcWatched = false
  }
}

/** Ends the watcher's child (and its memory) until the person turns it on. */
async function stopPc($: EngineInterface): Promise<void> {
  const child = pcChild
  pcChild = undefined
  try {
    await child?.return(undefined as never)
  } catch {
    // Already gone.
  }
  await update($, pc, () => null)
  await update($, pcNote, () => '')
}

/** Toasts once per window as it crosses 80 % and 95 %, until it resets. */
async function warnLimits($: EngineInterface, windows: LimitWindow[], at: number): Promise<void> {
  const seen = await read($, warned)
  const next: Warned = { ...seen }
  for (const w of windows) {
    const old = seen[w.kind]
    const had = old && old.resetsAt === w.resetsAt ? old.level : 0
    const level = warnLevel(w.pct)
    if (level > had) {
      const when = w.resetsAt ? `, сброс ${untilRu(new Date(w.resetsAt).getTime() - at)}` : ''
      $.ui.toast(`Тикинсон: лимит «${WINDOW_LABEL[w.kind] ?? w.kind}» — ${Math.round(w.pct)}%${when}`, {
        timeoutMs: 10000,
      })
    }
    next[w.kind] = { level: Math.max(level, had), ...(w.resetsAt ? { resetsAt: w.resetsAt } : {}) }
  }
  await update($, warned, () => next)
}

const toCtx = (c: { percent?: number; tokens?: number; window: number }): Ctx => ({
  window: c.window,
  ...(c.percent !== undefined ? { pct: c.percent } : {}),
  ...(c.tokens !== undefined ? { tokens: c.tokens } : {}),
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tikinson',
      description: 'Открыть панель с Тикинсоном',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    await update($, pet, (): Pet => ({ mood: 'wave', detail: '', tools: 0, running: 0 }))
    settle?.cancel()
    settle = $.clock.after(4000, () => {
      void update($, pet, p => (p.mood === 'wave' ? { ...p, mood: 'idle' as Mood } : p))
    })

    const started = await next(e)

    // Only the known fields of what an earlier version kept.
    const kept = ((await $.store.get('prefs')) ?? {}) as Partial<Prefs>
    const choice = await update($, prefs, () => ({
      isMuted: typeof kept.isMuted === 'boolean' ? kept.isMuted : DEFAULT_PREFS.isMuted,
      isPcOn: typeof kept.isPcOn === 'boolean' ? kept.isPcOn : DEFAULT_PREFS.isPcOn,
      isCompact: typeof kept.isCompact === 'boolean' ? kept.isCompact : DEFAULT_PREFS.isCompact,
    }))
    // Sections start closed in every session.
    await update($, open, () => CLOSED)

    // Limits and context: what the engine has now; session.measure pushes the rest.
    try {
      const usage = await $.session.usage()
      await update($, limits, () => toWindows(usage.rateLimits))
      await update($, ctx, () => toCtx(usage.context))
    } catch {
      // No reading yet.
    }
    void loadSub($)
    if (choice.isPcOn) void watchPc($)
    minute?.cancel()
    minute = $.clock.every(60000, () => {
      void update($, tick, n => n + 1)
    })

    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const windows = toWindows(e.rateLimits)
      await update($, limits, () => windows)
      await warnLimits($, windows, await $.clock.now())
    }
    if (e.changed.includes('context')) await update($, ctx, () => toCtx(e.context))

    return next(e)
  })

  on('command.run', { command: 'tikinson' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Тикинсон на месте.' }
  })

  // Claude starts a turn: Tikinson thinks.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      settle?.cancel()
      const at = await $.clock.now()
      await update($, pet, (p): Pet => ({
        mood: 'think',
        detail: '',
        tools: 0,
        running: 0,
        turnAt: at,
        ...(p.lastMs !== undefined ? { lastMs: p.lastMs } : {}),
      }))
      await update($, calls, () => [])
      $.ui.status('Тикинсон думает…')
    }

    return next(e)
  })

  // A tool runs: Tikinson works (or waits, when the tool asks the person).
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const asks = ASKS.has(e.tool)
    const at = await $.clock.now()
    await update($, pet, (p): Pet => ({
      ...p,
      mood: asks ? 'wait' : 'run',
      detail: e.tool,
      tools: p.tools + 1,
      running: p.running + 1,
      toolAt: at,
    }))
    $.ui.status(asks ? 'Тикинсон ждёт твоего ответа' : `Тикинсон работает: ${e.tool}`)
    if (asks) void chime($, 'wait')

    const id = e.tool_use_id ?? `${e.tool}-${at}`
    const call: Call = { id, tool: e.tool, what: toolWhat(e as Readonly<Record<string, unknown>>), at }
    await update($, calls, list => [...list, call].slice(-50))

    const ran = await next(e)

    const took = (await $.clock.now()) - at
    const isError = 'deny' in ran && ran.deny !== undefined ? true : ran.isError === true
    await update($, calls, list =>
      list.map(one => (one.id === id ? { ...one, ms: took, ...(isError ? { isError } : {}) } : one)),
    )

    // The last running tool is done: the model reads its result, so back to thinking.
    await update($, pet, (p): Pet => {
      const running = Math.max(0, p.running - 1)
      const isLive = p.mood === 'run' || p.mood === 'wait'
      if (running > 0 || !isLive) return { ...p, running }
      const { toolAt: _done, ...rest } = p

      return { ...rest, mood: 'think', detail: '', running }
    })

    return ran
  }).catch(($, e, next) => next(e)) // a pet's hiccup never blocks a tool

  // The turn ends: Tikinson celebrates (or is upset), then rests.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result

    const isOk = e.reason === 'answer'
    const detail =
      e.reason === 'aborted' ? 'прервано' : e.reason === 'error' ? 'ошибка API' : e.reason === 'refusal' ? 'отказ' : ''
    const at = await $.clock.now()
    const ended = await update($, pet, (p): Pet => {
      const { turnAt, toolAt: _tool, ...rest } = p

      return {
        ...rest,
        mood: isOk ? 'done' : 'fail',
        detail,
        running: 0,
        ...(turnAt !== undefined ? { lastMs: at - turnAt } : {}),
      }
    })
    $.ui.status(isOk ? 'Тикинсон: готово!' : `Тикинсон: ${detail}`)
    if (isOk && (ended.lastMs ?? 0) >= CHIME_AFTER_MS) void chime($, 'done')

    settle?.cancel()
    settle = $.clock.after(SETTLE_MS, () => {
      void update($, pet, (p): Pet =>
        p.mood === 'done' || p.mood === 'fail' ? { ...p, mood: 'idle', detail: '' } : p,
      )
      $.ui.status(undefined)
    })

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Progress, Button } = ui
    // The terminal has no Svg: there Tikinson is words alone, and bars are
    // the surface's own Progress.
    // The table names every element; one the surface lacks draws nothing, so
    // the surface decides, not the table.
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    // Mobile and the editor have no Client: there the meta line stands still.
    const Client = (e.surface === 'desktop' || e.surface === 'terminal') && 'Client' in ui ? ui.Client : undefined
    const now = await read($, pet)
    const choice = await read($, prefs)
    const folds = await read($, open)
    const list = await read($, calls)
    const windows = await read($, limits)
    const fill = await read($, ctx)
    const plan = await read($, sub)
    const box = await read($, pc)
    const note = await read($, pcNote)
    await read($, tick)
    const at = new Date(await $.clock.now())
    // The status lines are shortened to the pane's width, so neither wraps
    // and moves what is below; everything else wraps rather than cut.
    const cols = Math.max(20, (e.props.bodyColumns ?? 40) - 2)

    const look = LOOK[now.mood]
    const line = now.detail ? `${look.label}: ${now.detail}` : look.label
    const meta = {
      cols,
      tools: now.tools,
      ...(now.turnAt !== undefined ? { turnAt: now.turnAt } : {}),
      ...(now.lastMs !== undefined ? { lastMs: now.lastMs } : {}),
    }

    const toggleSound = () => setPrefs($, p => ({ ...p, isMuted: !p.isMuted }))
    const toggleInfo = () => setPrefs($, p => ({ ...p, isCompact: !p.isCompact }))
    const toggle = (which: keyof Open) => () => update($, open, o => ({ ...o, [which]: !o[which] }))
    const togglePc = async () => {
      const p = await setPrefs($, q => ({ ...q, isPcOn: !q.isPcOn }))
      if (p.isPcOn) void watchPc($)
      else await stopPc($)
    }
    const compact = async () => {
      try {
        $.ui.toast('Тикинсон: сжимаю контекст…')
        await $.session.compact()
      } catch (err) {
        $.ui.toast(`Тикинсон: сжать не вышло — ${String(err).slice(0, 120)}`)
      }
    }

    /** One meter: name and figure on a line, the bar, a hint under it. */
    // The name and its aside are sibling Texts, never one nested in another:
    // a desktop underlines a Text that holds a Text.
    const meter = (name: string, aside: string, pct: number, color: string, hint: string, a11y: string) => (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Box flexDirection="row" alignItems="flex-end">
            <Text>{name}</Text>
            {aside ? (
              <Text dimColor size="footnote">
                {` · ${aside}`}
              </Text>
            ) : null}
          </Box>
          <Text weight="semibold" tabular>
            {Math.round(pct)}%
          </Text>
        </Box>
        {Svg ? (
          <Svg source={barSvg(pct, color)} alt={`${a11y}: ${Math.round(pct)}%`} height={4} />
        ) : (
          <Progress label={a11y} value={Math.max(pct, 2)} max={100} valueText={`${Math.round(pct)}%`} color={color} />
        )}
        {hint ? (
          <Text dimColor size="footnote">
            {hint}
          </Text>
        ) : null}
      </Box>
    )

    /** A row of a folded section's body: name left, figure right. */
    const pair = (name: string, value: string) => (
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text dimColor>{name}</Text>
        <Text weight="medium" tabular>
          {value}
        </Text>
      </Box>
    )

    /**
     * A folding section's header, as the mock-up's summary: the title on the
     * left; on the right the brief and the chevron, one flat button. A desktop
     * draws a Button's label alone (its children never), so the label is what
     * shows, and it is the button's name as well.
     */
    const fold = (which: keyof Open, title: string, brief: string) => (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Text>{title}</Text>
        <Button
          key={`fold-${which}`}
          plain
          dimColor
          label={`${brief ? `${brief} ` : ''}${folds[which] ? '⌄' : '›'}`}
          onPress={toggle(which)}
        />
      </Box>
    )

    /** A thin rule between parts, as the mock-up's borders; none in a terminal. */
    const rule = (key: string) =>
      Svg ? <Svg key={key} source={RULE_SVG} alt="—" height={1} /> : null

    // Limits: the session and week windows, then the context window.
    const limitMeters = windows.map(w => {
      const reset = w.resetsAt ? new Date(w.resetsAt) : undefined
      const hint = reset
        ? w.kind === 'five_hour'
          ? `Сброс ${untilRu(reset.getTime() - at.getTime())}`
          : `Сброс ${atRu(reset)}`
        : ''
      const isFive = w.kind === 'five_hour'
      const name = isFive ? 'Сессия' : w.kind === 'seven_day' ? 'Неделя' : (WINDOW_LABEL[w.kind] ?? w.kind)
      const a11y = isFive ? 'Использовано лимита сессии' : w.kind === 'seven_day' ? 'Использовано недельного лимита' : `Использовано: ${name}`

      return meter(name, isFive ? '5 ч' : '', w.pct, w.pct >= 85 ? ALERT : WARM, hint, a11y)
    })
    const k = (n: number) => `${Math.round(n / 1000)}k`

    const pcBrief = !choice.isPcOn
      ? 'выключен'
      : box
        ? `CPU ${box.cpu}% · RAM ${Math.round((100 * box.ramUsedGb) / box.ramTotalGb)}%`
        : note
          ? 'нет данных'
          : 'замер…'

    return (
      <Box flexDirection="column" gap={2}>
        {Svg && (
          // No height here: a Box's height counts text rows, not pixels; the
          // picture's own 192 × 208 px (the atlas frame, unscaled) keeps the
          // rows below in place.
          <Box flexDirection="column" alignItems="center">
            <Svg source={svgFor(now.mood)} alt={`Тикинсон — ${look.label}`} width={FRAME_W} height={FRAME_H} />
          </Box>
        )}

        <Box flexDirection="column" alignItems="center">
          <Text weight="semibold">
            <Text color={ACCENT}>● </Text>
            {fit(line, cols - 2)}
          </Text>
          {Client ? (
            <Client key="meta" module="./timer.ts" props={meta} />
          ) : (
            <Text dimColor size="footnote" tabular>
              {fit(metaLine(meta, at.getTime()), cols)}
            </Text>
          )}
        </Box>

        <Box flexDirection="column" gap={1}>
          {rule('rule-top')}
          {/* The name left; on the right the speaker, then the fold arrow at
              the edge. A desktop draws a Button's label alone, so each glyph
              is its label: the speaker on its button background, the arrow
              plain, with none. */}
          <Box flexDirection="row" alignItems="center" gap={1} paddingX={1}>
            <Box flexGrow={1}>
              <Text dimColor size="footnote">
                {BRAND}
              </Text>
            </Box>
            <Button key="sound" label={choice.isMuted ? SPEAKER_OFF : SPEAKER_ON} onPress={toggleSound} />
            <Button key="collapse" plain label={choice.isCompact ? ARROW_OPEN : ARROW_FOLD} onPress={toggleInfo} />
          </Box>
          {rule('rule-bottom')}
        </Box>

        {!choice.isCompact && (
          <Box flexDirection="column" gap={1}>
            <Text dimColor size="caption">
              ИСПОЛЬЗОВАНО ЛИМИТОВ
            </Text>
            {windows.length === 0 && (
              <Text dimColor size="footnote">
                Появятся после первого ответа Claude
              </Text>
            )}
            {limitMeters}
            {fill?.pct !== undefined &&
              meter(
                'Контекст',
                fill.tokens ? `${k(fill.tokens)} / ${k(fill.window)}` : '',
                fill.pct,
                fill.pct >= COMPACT_FROM_PCT ? ALERT : CALM,
                fill.tokens ? `${k(fill.tokens)} из ${k(fill.window)} токенов` : '',
                'Использовано контекста',
              )}
            {fill?.pct !== undefined && fill.pct >= COMPACT_FROM_PCT && (
              <Box flexDirection="column">
                <Text dimColor size="footnote">
                  Контекст почти заполнен: Claude скоро начнёт забывать начало разговора.
                </Text>
                <Button key="compact" label="Сжать контекст" onPress={compact} />
              </Box>
            )}
          </Box>
        )}

        {!choice.isCompact && (
          <Box flexDirection="column" gap={1}>
            {rule('rule-pc')}
            {fold('pc', 'Компьютер', pcBrief)}
            {folds.pc && (
              <Box flexDirection="column" paddingLeft={2}>
                {choice.isPcOn && box && pair('Процессор', `${box.cpu}%`)}
                {choice.isPcOn &&
                  box &&
                  pair('Память', `${box.ramUsedGb.toFixed(1).replace('.', ',')} из ${box.ramTotalGb.toFixed(1).replace('.', ',')} ГБ`)}
                {choice.isPcOn && box && pair('Диск', `${box.disk}%`)}
                {choice.isPcOn && !box && note && (
                  <Text dimColor size="footnote">
                    Нет данных: {note}
                  </Text>
                )}
                {!choice.isPcOn && (
                  <Text dimColor size="footnote">
                    Замеры выключены: фоновый процесс не запущен.
                  </Text>
                )}
                <Button
                  key="pc-toggle"
                  dimColor
                  label={choice.isPcOn ? 'Выключить замеры (освободит ~70 МБ)' : 'Включить замеры'}
                  onPress={togglePc}
                />
              </Box>
            )}
          </Box>
        )}

        {!choice.isCompact && plan && (
          <Box flexDirection="column" gap={1}>
            {rule('rule-sub')}
            {fold('sub', 'Подписка', `Claude ${plan.plan}`)}
            {folds.sub && (
              <Box flexDirection="column" paddingLeft={2}>
                {plan.since && pair('Подписка с', dateRu(new Date(plan.since)))}
                {plan.since && pair('Следующее списание', `≈ ${dateRu(nextMonthly(new Date(plan.since), at))}`)}
                {plan.since && (
                  <Text dimColor size="footnote">
                    Дата рассчитана по началу подписки.
                  </Text>
                )}
                {plan.hasExtra !== undefined &&
                  pair('Оплата сверх лимита', plan.hasExtra ? 'Включена' : 'Выключена')}
              </Box>
            )}
          </Box>
        )}

        {!choice.isCompact && (
          <Box flexDirection="column" gap={1}>
            {rule('rule-tools')}
            {fold('tools', 'Инструменты', list.length ? callsRu(list.length) : 'пусто')}
            {folds.tools && (
              <Box flexDirection="column" paddingLeft={2}>
                {list.length === 0 && (
                  <Text dimColor size="footnote">
                    В этом ходе ещё ни одного вызова
                  </Text>
                )}
                {list.length > TOOLS_SHOWN && (
                  <Text dimColor size="footnote">
                    …и ещё {list.length - TOOLS_SHOWN} раньше
                  </Text>
                )}
                {list.slice(-TOOLS_SHOWN).map(c => {
                  const mark = c.ms === undefined ? '…' : c.isError ? '✗' : '✓'
                  const took = c.ms === undefined ? 'идёт' : clock(c.ms)
                  return (
                    <Box flexDirection="row" justifyContent="space-between" gap={1}>
                      <Text dimColor={c.ms !== undefined && !c.isError} size="footnote">
                        {`${mark} ${toolName(c.tool)}${c.what ? ` · ${fit(c.what, 40)}` : ''}`}
                      </Text>
                      <Text dimColor size="footnote" tabular>
                        {took}
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
