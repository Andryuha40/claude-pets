export type Mood = 'idle' | 'wave' | 'think' | 'run' | 'wait' | 'done' | 'fail'

export type Pet = {
  mood: Mood
  /** What Claude is doing right now: a tool name, a reason. */
  detail: string
  /** Tool calls in this turn. */
  tools: number
  /** Tool calls running right now. */
  running: number
}

declare module 'claude-code' {
  interface PluginState {
    'tikinson-pet': { pet: Shaped<Pet> }
  }
}
