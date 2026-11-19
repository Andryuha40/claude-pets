import type { LimitWindow, Pc, Sub } from '../types'

const MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']
const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const pad = (n: number) => String(n).padStart(2, '0')

/** `9 мая 2026` */
export function dateRu(d: Date, withYear = true): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`
}

/** `через 2 ч 14 мин`, `через 3 дн. 5 ч` */
export function untilRu(ms: number): string {
  if (ms <= 0) return 'сейчас'
  const min = Math.round(ms / 60000)
  if (min < 60) return `через ${min} мин`
  const h = Math.floor(min / 60)
  if (h < 24) return `через ${h} ч ${min % 60} мин`
  return `через ${Math.floor(h / 24)} дн. ${h % 24} ч`
}

/** `пт, 21 нояб., 14:00` */
export function whenRu(d: Date): string {
  return `${DAYS[d.getDay()]}, ${dateRu(d, false)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const WINDOW_LABEL: Record<string, string> = {
  five_hour: 'Сессия (5 ч)',
  seven_day: 'Неделя',
  spend_limit: 'Лимит расходов',
}

/** The engine's windows, in the order the pane shows them. */
export function toWindows(list: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): LimitWindow[] {
  const order = ['five_hour', 'seven_day']
  return list
    .map(w => ({ kind: w.kind, pct: w.percentUsed, ...(w.resetsAt ? { resetsAt: w.resetsAt } : {}) }))
    .sort((a, b) => (order.indexOf(a.kind) + 1 || 9) - (order.indexOf(b.kind) + 1 || 9))
}

const PLAN: Record<string, string> = {
  claude_pro: 'Pro',
  claude_max: 'Max',
  claude_team: 'Team',
  claude_enterprise: 'Enterprise',
}

/** The plan fields alone, out of `~/.claude.json`; nothing else is kept. */
export function subFromConfig(text: string): Sub | null {
  const oa = (JSON.parse(text) as { oauthAccount?: Record<string, unknown> }).oauthAccount
  if (!oa || typeof oa.organizationType !== 'string') return null
  const plan = PLAN[oa.organizationType] ?? oa.organizationType.replace(/^claude_/, '')

  return {
    plan,
    ...(typeof oa.subscriptionCreatedAt === 'string' ? { since: oa.subscriptionCreatedAt } : {}),
    ...(typeof oa.hasExtraUsageEnabled === 'boolean' ? { hasExtra: oa.hasExtraUsageEnabled } : {}),
  }
}

/**
 * The next monthly anniversary of `since` after `now`: an estimate, since
 * the login record says when the subscription began, not how it bills.
 */
export function nextMonthly(since: Date, now: Date): Date {
  const day = since.getDate()
  for (let k = 0; k < 14; k++) {
    const y = now.getFullYear()
    const m = now.getMonth() + k
    const last = new Date(y, m + 1, 0).getDate()
    const d = new Date(y, m, Math.min(day, last), since.getHours(), since.getMinutes())
    if (d.getTime() > now.getTime()) return d
  }
  return now
}

/** One `pcwatch.ps1` line (`pc <cpu> <usedMB> <totalMB> <disk>`) as a sample. */
export function pcFromLine(line: string): Pc | undefined {
  const m = /^pc (\S+) (\S+) (\S+) (\S+)\s*$/.exec(line.trim())
  if (!m) return undefined
  const [cpu, used, total, disk] = m.slice(1).map(Number) as [number, number, number, number]
  if (![cpu, used, total, disk].every(Number.isFinite) || total <= 0) return undefined

  return {
    cpu: Math.round(Math.max(0, Math.min(100, cpu))),
    ramUsedGb: Math.round(used / 102.4) / 10,
    ramTotalGb: Math.round(total / 102.4) / 10,
    disk: Math.round(Math.max(0, Math.min(100, disk))),
  }
}

/** Green below 60 %, amber below 85 %, red past it. */
export function tone(pct: number): 'success' | 'warning' | 'error' {
  return pct < 60 ? 'success' : pct < 85 ? 'warning' : 'error'
}

/** Which warning a window's fill has reached: 0, 80 or 95. */
export function warnLevel(pct: number): number {
  return pct >= 95 ? 95 : pct >= 80 ? 80 : 0
}

const base = (path: unknown) => (typeof path === 'string' ? (path.split(/[\/]/).pop() ?? path) : '')
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** What a tool call works on, in a few words: a command, a file, a pattern. */
export function toolWhat(input: Readonly<Record<string, unknown>>): string {
  const what =
    str(input.command) ||
    base(input.file_path) ||
    base(input.notebook_path) ||
    str(input.pattern) ||
    str(input.url).replace(/^https?:\/\//, '') ||
    str(input.query) ||
    str(input.description) ||
    str(input.skill) ||
    str(input.prompt)

  // The home folder reads as ~, so a path neither runs long nor shows a name.
  return what
    .replace(/[A-Za-z]:[\\/]Users[\\/][^\\/\s"']+/gi, '~')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A tool's name without an MCP server's prefix: mcp__ccd_turn__update_plan reads update_plan. */
export function toolName(tool: string): string {
  return tool.replace(/^mcp__.+?__/, '')
}

/** One line at most `cols` characters wide, ending in `…` when cut. */
export function fit(text: string, cols: number): string {
  const room = Math.max(8, cols)
  return text.length <= room ? text : `${text.slice(0, room - 1)}…`
}

/** `0:04`, `1:23`, `1:02:03` */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const ss = String(s % 60).padStart(2, '0')

  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** `1 вызов`, `3 вызова`, `8 вызовов`, `11 вызовов`, `21 вызов` */
export function callsRu(n: number): string {
  const d = n % 10
  const dd = n % 100
  const word = d === 1 && dd !== 11 ? 'вызов' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'вызова' : 'вызовов'
  return `${n} ${word}`
}

/** `22 нояб. в 10:00` */
export function atRu(d: Date): string {
  return `${dateRu(d, false)} в ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * A thin rounded bar as an SVG: the track a translucent grey that reads on a
 * light and a dark pane alike, the fill in `color`.
 */
export function barSvg(pct: number, color: string): string {
  const w = Math.max(0, Math.min(100, pct))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 4" width="260" height="4" preserveAspectRatio="none">` +
    `<rect width="260" height="4" rx="2" fill="#8c8781" fill-opacity="0.22"/>` +
    (w > 0 ? `<rect width="${Math.max(4, (260 * w) / 100).toFixed(1)}" height="4" rx="2" fill="${color}"/>` : '') +
    `</svg>`
  )
}
