import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import type { Mood, Pet } from '../types'
import { FRAME_H, FRAME_W, SPRITES } from './sprites'

const PANE = 'tikinson'
const TITLE = 'Тикинсон'

// Change the tag when Pet's fields change: an older stored value is then
// read as the initial one instead of meeting new code.
const pet = atom(
  { plugin: 'tikinson-pet', key: 'pet' } as const,
  { mood: 'idle', detail: '', tools: 0, running: 0 } as Pet,
  { shape: 'pet-1' },
)

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

// A module variable: a reload drops it, and the next mood change sets it again.
let settle: Timer | undefined

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
      await update($, pet, (): Pet => ({ mood: 'think', detail: '', tools: 0, running: 0 }))
      $.ui.status('Тикинсон думает…')
    }

    return next(e)
  })

  // A tool runs: Tikinson works (or waits, when the tool asks the person).
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const asks = ASKS.has(e.tool)
    await update($, pet, (p): Pet => ({
      mood: asks ? 'wait' : 'run',
      detail: e.tool,
      tools: p.tools + 1,
      running: p.running + 1,
    }))
    $.ui.status(asks ? 'Тикинсон ждёт твоего ответа' : `Тикинсон работает: ${e.tool}`)

    const ran = await next(e)

    // The last running tool is done: the model reads its result, so back to thinking.
    await update($, pet, (p): Pet => {
      const running = Math.max(0, p.running - 1)
      const isLive = p.mood === 'run' || p.mood === 'wait'

      return running === 0 && isLive
        ? { ...p, mood: 'think', detail: '', running }
        : { ...p, running }
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
    await update($, pet, (p): Pet => ({ ...p, mood: isOk ? 'done' : 'fail', detail, running: 0 }))
    $.ui.status(isOk ? 'Тикинсон: готово!' : `Тикинсон: ${detail}`)

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
    const { Box, Text } = ui
    // The terminal has no Svg: there Tikinson is words alone.
    const Svg = 'Svg' in ui ? ui.Svg : undefined
    const now = await read($, pet)
    const look = LOOK[now.mood]
    const line = now.detail ? `${look.label}: ${now.detail}` : look.label

    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        {Svg && (
        <Svg
          source={svgFor(now.mood)}
          alt={`Тикинсон — ${look.label}`}
          width={144}
          height={156}
        />
        )}
        <Text bold>{line}</Text>
        {now.tools > 0 && <Text dimColor>Инструментов за ход: {now.tools}</Text>}
      </Box>
    )
  })
}
