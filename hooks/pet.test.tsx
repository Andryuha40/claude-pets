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

  return row?.text
}

test('Tikinson follows the turn: thinks, works, thinks, finishes', async ($, on) => {
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
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))

  await $.turn.start({ text: 'hi', turnId: 't3' })
  await $.turn.complete({ turnId: 't3', reason: 'aborted', isAborted: true, answer: '' } as any)
  expect(await caption($)).toBe('Что-то пошло не так: прервано')
})
