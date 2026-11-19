# Claude Pets · Tikinson

[![Telegram: Tikinson Games](https://img.shields.io/badge/Telegram-Tikinson%20Games-26A5E4?logo=telegram&logoColor=white)](https://t.me/tikinsongames)

**The character is based on drawings by the artist Tikinson — [Tikinson Games on Telegram](https://t.me/tikinsongames).** Tikinson is his nickname, and the character is his self-portrait.

[Русский](README.md) · English

A living pet and a small dashboard for Claude Code. **Tikinson** sits in a pane beside the chat and shows, in real time, what Claude is up to: thinking, working, waiting for you, or done. Below him: how much of your limits and context is used, and, when you want them, your plan, your computer's load and the list of tools called.

![Tikinson: thinking, working, waiting, done, failed](media/tikinson-states.gif)

## What Tikinson is for

- **Status at a glance.** Claude often works for minutes at a time: reading files, running commands, editing code. Instead of scrolling the chat, glance at Tikinson to see whether it is thinking, running off to execute a command, or already giving you a thumbs-up.
- **Never miss the moment you're needed.** When Claude asks a question or waits for plan approval, Tikinson shrugs and a soft chime plays. When a long task is done, a second chime. Feel free to switch to another window.
- **No surprises with limits.** See what share of the 5-hour and weekly limits is used and when each resets. At 80% and 95% a warning pops up, so a limit doesn't run out mid-task.
- **Context under control.** A meter shows how full the context window is. When it's nearly full and Claude is about to start forgetting the beginning of the conversation, a "Compact context" button appears.
- **Less of a black box.** The turn's time and number of tool calls sit on one line; the "Tools" section lists what was called, on what, and for how long.
- **Is the computer coping?** CPU, memory and disk in their own section. Handy when Claude runs heavy builds and tests on a small machine.
- **An interface with character.** A serious developer tool gets a little warmer: your workspace has a companion, not just text and spinners.
- **A template for your own mods.** A compact Claude Code mod example: turn events, a pane, session state, SVG animation, a background process, sound, tests. Use it as a starting point for your own pet or indicator.

## How Tikinson reacts

| | What Claude does | What Tikinson does |
| :---: | --- | --- |
| <img src="media/tikinson-think.gif" width="96" alt="thinking"> | starts a turn, thinks about the answer | hand on chin |
| <img src="media/tikinson-run.gif" width="96" alt="working"> | calls a tool | runs; the caption names the tool |
| <img src="media/tikinson-wait.gif" width="96" alt="waiting"> | asks you a question or shows a plan | shrugs; a chime plays |
| <img src="media/tikinson-done.gif" width="96" alt="done"> | finishes the turn | thumbs up (a chime after a turn over 10 s), rests after 6 s |
| <img src="media/tikinson-fail.gif" width="96" alt="failed"> | turn interrupted or API error | gets upset |
| <img src="media/tikinson-wave.gif" width="96" alt="hello"> | new session | waves |
| <img src="media/tikinson-idle.gif" width="96" alt="idle"> | nothing is happening | rests |

Subagents don't drive the pet: while a subagent works, Tikinson keeps running with the caption `Agent`.

## What's in the pane

Top to bottom (the pane's labels are in Russian):

1. **Tikinson** and his state: "Думает…" (thinking), "Работает: Bash" (working), "Готово!" (done).
2. **The time line:** "3:44 · 8 вызовов инструментов" (8 tool calls); between turns, the last turn's time.
3. **The control row:** the speaker 🔊 / 🔇 turns the chimes on and off; the arrow ︿ / ﹀ folds everything below. Both choices are kept across sessions.
4. **Limits used** — three meters, percentage on the right:
   - "Сессия · 5 ч" (session) and the time until it resets;
   - "Неделя" (week) and its reset date;
   - "Контекст" (context) and the token count. From 85%, a button to compact the context.
5. **Folding sections**, closed at the start of every session:
   - **Компьютер** (computer) — CPU, memory, disk, and the switch for the measurements;
   - **Подписка** (plan) — the plan, its start date, an estimate of the next charge, whether extra usage is billed;
   - **Инструменты** (tools) — the turn's latest calls: tool, what it worked on, duration, ✓ or ✗.

Every figure is live: Claude Code's engine pushes limits and context after each answer, and the computer's load refreshes every 5 seconds.

## Install

In a Claude Code terminal session:

```
/plugin install tikinson-pet --marketplace Andryuha40/claude-pets
```

Answer `y` to add the marketplace, then pick a scope (`user` for every session).

From a shell:

```bash
claude plugin install tikinson-pet --marketplace Andryuha40/claude-pets
```

In the Claude Desktop app, where `/plugin` doesn't run: click **+** next to the prompt box → **Plugins** → **Add marketplace** with `Andryuha40/claude-pets` → **Add plugin**.

Updating from 0.1: reinstall with the same command, or update the marketplace in `/plugin`.

## Usage

- The pane opens by itself when a session starts. Closed it? Run `/tikinson`.
- The animation and meters are drawn in Claude Desktop. In a terminal you get a text status and the terminal's own progress bars.

## Requirements and limits

- **The computer section and the chimes** are built for Windows: a bundled PowerShell script, `hooks/pcwatch.ps1`, reads the counters, and the Windows system player plays the sound. On macOS the Claude Code engine plays the sound, and the computer section shows "нет данных" (no data). Tested on Windows 10 only.
- **Limits** show only when you sign in with a Claude plan (Pro, Max, Team), and appear after the first answer of a session.
- **The next charge date is an estimate:** the next monthly anniversary of the plan's start. With yearly billing it will be wrong.
- **The button icons** are font glyphs: the mod API allows no SVG inside a button and no hover tooltips.

## Tokens and performance

**Tokens: no extra spend.** The mod adds nothing to the system prompt, makes no model calls and doesn't change tool results. It only listens to events and draws a pane, which the model never sees. The one exception is running `/tikinson` by hand: its short reply line goes into the history (a few tokens per run).

**CPU: next to nothing.** During the fastest animation, all Claude processes together — the app, the engine and the panes — used **0.49% of the CPU** over 20 seconds (Windows 10, 12 threads). The animation runs as SVG; the time line ticks once a second without redrawing the rest of the pane.

**Computer measurements** run in one background PowerShell process per session: about **1.4 s** of CPU at start, below measurement precision after that, and about **70 MB** of memory. The switch in the computer section stops the process and frees the memory; the choice is kept.

**Sound:** about 0.3 s of CPU per chime, only when it plays.

**The mod's own memory:** about 0.6 MB — Tikinson's frames, embedded in the code.

## Privacy

- The mod sends nothing over the network.
- From `~/.claude.json` it reads the plan fields only: the plan's name, its start date, and whether extra usage is billed. No email, name or keys.
- The tools list shows your home folder as `~`.

## How it works

The mod listens to Claude Code events — `turn.start`, `tool.call`, `turn.complete` (turns and tools), `session.measure` (limits and context) — and keeps everything in session state. The pane draws frames from Tikinson's sprite atlas as SVG with SMIL animation.

| File | What's inside |
| --- | --- |
| [`hooks/register.tsx`](hooks/register.tsx) | events, state, the pane |
| [`hooks/timer.ts`](hooks/timer.ts) | the time line, ticking on its own |
| [`hooks/info.ts`](hooks/info.ts) | formatting of dates, numbers and captions |
| [`hooks/pcwatch.ps1`](hooks/pcwatch.ps1) | CPU, memory and disk measurements |
| [`hooks/pet.test.tsx`](hooks/pet.test.tsx) | tests of the reactions and the pane |
| `sounds/` | two soft chimes, synthesized for this mod |

## License and credits

**Tikinson — Andrey / [Andryuha40](https://github.com/Andryuha40).** The character comes from the [codexpets](https://github.com/Andryuha40/codexpets) collection and is based on drawings by the artist Tikinson: [Tikinson Games on Telegram](https://t.me/tikinsongames).

The character, its images and animations are licensed for personal, non-commercial use only, with no changes to the artwork. Full text in [LICENSE.md](LICENSE.md). Frames are taken from the codexpets atlas without altering the drawing: cut into strips and compressed to WebP.
