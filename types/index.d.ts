export type Mood = 'idle' | 'wave' | 'think' | 'run' | 'wait' | 'done' | 'fail'

export type Pet = {
  mood: Mood
  /** What Claude is doing right now: a tool name, a reason. */
  detail: string
  /** Tool calls in this turn. */
  tools: number
  /** Tool calls running right now. */
  running: number
  /** When the running turn began, epoch ms; absent between turns. */
  turnAt?: number
  /** When the latest running tool began, epoch ms. */
  toolAt?: number
  /** How long the last finished turn took, ms. */
  lastMs?: number
}

/** One rate-limit window, as the engine last measured it. */
export type LimitWindow = {
  /** `five_hour`, `seven_day`, `spend_limit`, ... */
  kind: string
  /** 0 to 100. */
  pct: number
  /** ISO 8601, when the window resets. */
  resetsAt?: string
}

/** The context window, as the engine last measured it. */
export type Ctx = {
  /** 0 to 100, once a response reported a fill. */
  pct?: number
  tokens?: number
  window: number
}

/** The subscription as the local login record names it. */
export type Sub = {
  /** `Pro`, `Max`, `Team`, ... */
  plan: string
  /** ISO 8601, when the subscription started. */
  since?: string
  /** Whether usage past the limits is billed. */
  hasExtra?: boolean
}

/** The computer, as pcwatch.ps1 last sampled it. */
export type Pc = {
  cpu: number
  ramUsedGb: number
  ramTotalGb: number
  disk: number
}

/** One tool call of the current turn, as the tools list shows it. */
export type Call = {
  id: string
  tool: string
  /** What it worked on: a command, a file, a pattern. */
  what: string
  /** When it began, epoch ms. */
  at: number
  /** How long it took, once done. */
  ms?: number
  isError?: boolean
}

/** The person's choices, kept across sessions in `$.store`. */
export type Prefs = {
  isMuted: boolean
  isPcOn: boolean
  /** The info under the toolbar is folded away. */
  isCompact: boolean
}

/** Which folding sections are open; closed at each session's start. */
export type Open = {
  pc: boolean
  sub: boolean
  tools: boolean
}

/** The highest limit warning shown per window, until that window resets. */
export type Warned = Record<string, { level: number; resetsAt?: string }>

declare module 'claude-code' {
  interface PluginState {
    'tikinson-pet': {
      pet: Shaped<Pet>
      limits: Shaped<LimitWindow[]>
      ctx: Shaped<Ctx | null>
      sub: Shaped<Sub | null>
      pc: Shaped<Pc | null>
      prefs: Shaped<Prefs>
      open: Shaped<Open>
      calls: Shaped<Call[]>
      warned: Shaped<Warned>
      /** Why the computer block has no figures, when the watcher failed. */
      pcNote: string
      /** Bumped once a minute so reset countdowns stay current. */
      tick: number
    }
  }
}
