import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'tikinson-pet',
  component: 'Pane',
  requestId: 'tikinson',
  props: {
    title: 'Тикинсон',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

async function caption($: any): Promise<string | undefined> {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const row = await ui.find({ type: 'Text', text: /Думает|Работает|Готово|Ждёт|Отдыхает|Привет|пошло/ })
  await ui.unmount()

  // The state line opens with the accent dot.
  return row?.text.replace(/^● /, '')
}

test('Tikinson follows the turn: thinks, works, thinks, finishes', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: 'ok' }))

  let during: string | undefined
  on('tool.call', async () => {
    during = await caption($)

    return { result: {} }
  })

  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await caption($)).toBe('Думает…')

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(during).toBe('Работает: Bash')
  expect(await caption($)).toBe('Думает…')

  await $.turn.complete({ turnId: 't1', reason: 'answer', isAborted: false, answer: 'ok' } as any)
  expect(await caption($)).toBe('Готово!')
})

test('a question to the person makes Tikinson wait', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.status', () => ({ value: undefined }))
  let during: string | undefined
  on('tool.call', async () => {
    during = await caption($)

    return { result: {} }
  })

  await $.turn.start({ text: 'hi', turnId: 't2' })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
  expect(during).toBe('Ждёт твоего ответа: AskUserQuestion')
})

test('an interrupted turn upsets Tikinson', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))

  await $.turn.start({ text: 'hi', turnId: 't3' })
  await $.turn.complete({ turnId: 't3', reason: 'aborted', isAborted: true, answer: '' } as any)
  expect(await caption($)).toBe('Что-то пошло не так: прервано')
})

import { callsRu, nextMonthly, pcFromLine, subFromConfig, untilRu } from './info'
import { metaLine } from './timer'

test('a watcher line becomes a sample; anything else does not', async () => {
  expect(pcFromLine('Add-Type warning')).toBe(undefined)
  expect(pcFromLine('pc 12.6 6723 8036 3.2')).toEqual({ cpu: 13, ramUsedGb: 6.6, ramTotalGb: 7.8, disk: 3 })
  expect(pcFromLine('pc 140 6723 8036 -1')).toEqual({ cpu: 100, ramUsedGb: 6.6, ramTotalGb: 7.8, disk: 0 })
})

test('the next payment is the next monthly anniversary', async () => {
  const since = new Date(2026, 4, 9, 10, 0)
  expect(nextMonthly(since, new Date(2026, 10, 19, 12, 0)).getDate()).toBe(9)
  expect(nextMonthly(since, new Date(2026, 10, 19, 12, 0)).getMonth()).toBe(11)
  // Day 31 in a short month lands on its last day.
  expect(nextMonthly(new Date(2026, 0, 31), new Date(2026, 1, 2)).getDate()).toBe(28)
})

test('only the plan fields leave the login record', async () => {
  const text = JSON.stringify({
    oauthAccount: { organizationType: 'claude_pro', subscriptionCreatedAt: '2026-05-09T07:38:27Z', hasExtraUsageEnabled: true, emailAddress: 'x@y.z' },
  })
  expect(subFromConfig(text)).toEqual({ plan: 'Pro', since: '2026-05-09T07:38:27Z', hasExtra: true })
  expect(untilRu(2 * 3600000 + 14 * 60000)).toBe('через 2 ч 14 мин')
})

test('a measurement fills the limit meters, session first', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('ui.status', () => ({ value: undefined }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: {} as any,
    rateLimits: [
      { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-11-22T07:00:00Z' },
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-19T12:48:00Z' },
    ],
    changed: ['rateLimits'],
  } as any)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(texts).toContain('ИСПОЛЬЗОВАНО ЛИМИТОВ')
  expect(texts).toContain('24%')
  expect(texts).toContain('41%')
  expect(texts).toContain('Сброс через 48 мин')
  expect(texts.some((t: string) => /^Сброс 22 нояб\. в \d\d:00$/.test(t))).toBe(true)
  expect(texts.findIndex((t: string) => t.startsWith('Сессия'))).toBeLessThan(texts.indexOf('Неделя'))
  // Each bar is an SVG whose name says what it measures.
  const bars = (await ui.findAll({ type: 'Svg' })).map((b: any) => b.props.alt)
  expect(bars).toContain('Использовано лимита сессии: 24%')
  expect(bars).toContain('Использовано недельного лимита: 41%')
  await ui.unmount()
})

test('crossing 80 % warns once; the context meter shows the fill', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  const toasts: string[] = []
  on('ui.toast', (_, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_, e) => ({ changed: e.changed }))

  const measure = (pct: number) =>
    $.session.measure({
      context: { window: 200000, tokens: 120000, percent: 60 },
      rateLimits: [{ kind: 'five_hour', percentUsed: pct, resetsAt: '2026-11-19T14:00:00Z' }],
      changed: ['rateLimits', 'context'],
    } as any)
  await measure(82)
  await measure(83)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('Сессия (5 ч)» — 82%')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(texts).toContain('60%')
  expect(texts).toContain('120k из 200k токенов')
  const bars = (await ui.findAll({ type: 'Svg' })).map((b: any) => b.props.alt)
  expect(bars).toContain('Использовано контекста: 60%')
  await ui.unmount()
})

test('the arrow folds the info away and back; the toolbar stays', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 10 }],
    changed: ['rateLimits'],
  } as any)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const arrow = async () => (await ui.find({ type: 'Button', key: 'collapse' })) as any
  expect((await arrow()).props.label).toBe('︿')
  expect(await ui.find({ type: 'Text', text: /ИСПОЛЬЗОВАНО ЛИМИТОВ/ })).toBeDefined()

  await ui.press({ key: 'collapse' })
  expect(await ui.find({ type: 'Text', text: /ИСПОЛЬЗОВАНО ЛИМИТОВ/ })).toBe(undefined)
  expect((await arrow()).props.label).toBe('﹀')
  expect(await ui.find({ type: 'Button', key: 'sound' })).toBeDefined()

  await ui.press({ key: 'collapse' })
  expect(await ui.find({ type: 'Text', text: /ИСПОЛЬЗОВАНО ЛИМИТОВ/ })).toBeDefined()
  await ui.unmount()
})

test('the speaker strikes through when muted', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('store.set', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const speaker = async () => (await ui.find({ type: 'Button', key: 'sound' })) as any

  expect((await speaker()).props.label).toContain('\u{1F50A}')
  await ui.press({ key: 'sound' })
  expect((await speaker()).props.label).toContain('\u{1F507}')
  await ui.unmount()
})

test('sections start closed and open on a press; the tools list names each call', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('clock.after', () => ({ deny: 'no timers in tests' }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', (_, e: any) => (e.tool === 'Read' ? { result: {}, isError: true } : { result: {} }))

  await $.turn.start({ text: 'hi', turnId: 't9' })
  await $.tool.call({ tool: 'Bash', command: 'npm test --silent' } as any)
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/src/app.tsx' } as any)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const header = (await ui.find({ type: 'Button', key: 'fold-tools' })) as any
  expect(header.props.label).toBe('2 вызова ›')
  expect(await ui.find({ type: 'Text', text: /npm test/ })).toBe(undefined)
  expect(((await ui.find({ type: 'Button', key: 'fold-pc' })) as any).props.label).toMatch(/ ›$/)

  await ui.press({ key: 'fold-tools' })
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(texts).toContain('✓ Bash · npm test --silent')
  expect(texts).toContain('✗ Read · app.tsx')
  expect(texts).toContain('0:00')
  expect(((await ui.find({ type: 'Button', key: 'fold-tools' })) as any).props.label).toBe('2 вызова ⌄')
  await ui.unmount()
})

test('the computer section keeps the switch for the watcher', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('store.set', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'fold-pc' })
  const sw = (await ui.find({ type: 'Button', key: 'pc-toggle' })) as any
  expect(sw.props.label).toBe('Выключить замеры (освободит ~70 МБ)')
  await ui.press({ key: 'pc-toggle' })
  expect(((await ui.find({ type: 'Button', key: 'pc-toggle' })) as any).props.label).toBe('Включить замеры')
  expect(((await ui.find({ type: 'Button', key: 'fold-pc' })) as any).props.label).toBe('выключен ⌄')
  await ui.unmount()
})

test('one meta line: the turn time and the calls, in good Russian', async () => {
  expect(callsRu(1)).toBe('1 вызов')
  expect(callsRu(3)).toBe('3 вызова')
  expect(callsRu(8)).toBe('8 вызовов')
  expect(callsRu(12)).toBe('12 вызовов')
  expect(callsRu(22)).toBe('22 вызова')
  expect(metaLine({ cols: 40, tools: 8, turnAt: 1 }, 224001)).toBe('3:44 · 8 вызовов инструментов')
  expect(metaLine({ cols: 40, tools: 1, lastMs: 83000 }, 0)).toBe('Последний ход 1:23 · 1 вызов инструментов')
  expect(metaLine({ cols: 40, tools: 0 }, 0)).toBe('Ждёт задачу')
})

test('the pane draws Tikinson on the desktop, at the atlas frame size', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = (await ui.find({ type: 'Svg' })) as any
  expect(svg).toBeDefined()
  expect([svg.props.width, svg.props.height]).toEqual([192, 208])
  expect(await ui.find({ type: 'Text', text: /^Tikinson$/ })).toBeDefined()
  // A Box's height counts rows on the desktop: none may hold the picture.
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.some((b: any) => typeof b.props.height === 'number' && b.props.height > 3)).toBe(false)
  await ui.unmount()
})

test('in a terminal the meters fall back to the surface bars', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 30 }],
    changed: ['rateLimits'],
  } as any)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(texts).toContain('30%')
  // The terminal draws the bar as its own row: name and figure.
  expect(texts).toContain('Использовано лимита сессии 30%')
  await ui.unmount()
})

test('every Button shows its whole label: icons and section chevrons stay short', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const buttons = (await ui.findAll({ type: 'Button' })) as any[]
  // A desktop draws a Button's label alone, so a long one is cut in a narrow pane.
  expect(buttons.filter(b => String(b.props.label).length > 24).map(b => b.props.label)).toEqual([])
  // Section titles are plain text beside their chevron, never inside a button.
  const titles = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(titles).toContain('Компьютер')
  expect(titles).toContain('Инструменты')
  await ui.unmount()
})

import { toolName, toolWhat } from './info'

test('tool rows stay short: no MCP prefix, the home folder as ~', async () => {
  expect(toolName('mcp__ccd_turn__update_plan')).toBe('update_plan')
  expect(toolName('Bash')).toBe('Bash')
  expect(toolWhat({ command: 'ls -la "C:/Users/Alex/projects/demo"' })).toBe('ls -la "~/projects/demo"')
  expect(toolWhat({ command: String.raw`cd C:\Users\Someone\proj && npm test` })).toBe(String.raw`cd ~\proj && npm test`)
})

test('a meter name is one Text of its own, beside its aside', async ($, on) => {
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 19, 12) }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 30 }],
    changed: ['rateLimits'],
  } as any)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
  expect(texts).toContain('Сессия')
  expect(texts).toContain(' · 5 ч')
  await ui.unmount()
})
