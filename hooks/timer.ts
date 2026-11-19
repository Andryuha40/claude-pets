// Surface module: the status's meta line, "3:44 · 8 вызовов инструментов",
// ticking once a second on the surface's own clock, so the rest of the pane
// (Tikinson's picture among it) is not drawn again every second.
import type { ClientModule } from 'claude-code'

import { callsRu, clock, fit } from './info'

export type TimerProps = {
  /** The row's width in characters; longer text is shortened, never wrapped. */
  cols: number
  /** Tool calls in the running (or last) turn. */
  tools: number
  /** When the turn began, in epoch ms; absent between turns. */
  turnAt?: number
  /** How long the last finished turn took, in ms. */
  lastMs?: number
}

export function metaLine(p: TimerProps, now: number): string {
  const count = `${callsRu(p.tools)} инструментов`
  if (p.turnAt) return `${clock(now - p.turnAt)} · ${count}`
  if (p.lastMs !== undefined) return `Последний ход ${clock(p.lastMs)} · ${count}`

  return 'Ждёт задачу'
}

const Timer: ClientModule<TimerProps, number> = (props, surface) => {
  const { Text } = surface.elements
  if (surface.state === undefined) {
    surface.setState(0)
    surface.every(1000, () => surface.setState((surface.state ?? 0) + 1))
  }

  return Text({ dimColor: true, tabular: true, size: 'footnote', children: fit(metaLine(props, Date.now()), props.cols) })
}

export default Timer
