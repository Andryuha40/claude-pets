# Claude Pets · Tikinson

[Русский](README.md) · English

A living pet for Claude Code. **Tikinson** sits in a pane beside the chat and shows, in real time, what Claude is up to: thinking, working, waiting for you, or done.

![Tikinson: thinking, working, waiting, done, failed](media/tikinson-states.gif)

## Why

- **Status at a glance.** Claude often works for minutes at a time: reading files, running commands, editing code. Instead of scrolling the transcript, glance at Tikinson to see whether it is thinking, running off to execute a command, or already giving you a thumbs-up.
- **Never miss the moment you're needed.** When Claude asks a question or waits for plan approval, Tikinson shrugs with open hands. You catch it out of the corner of your eye, even while looking at another part of the app.
- **Less of a black box.** The caption under the character names the tool running right now (Bash, Edit, Read…) and counts the calls in this turn.
- **An interface with character.** A serious developer tool gets a little warmer: your workspace has a companion, not just text and spinners.
- **Calmer long tasks.** The animation tells you work is moving, not stuck. Errors and interruptions are just as visible: Tikinson gets upset.
- **A template for your own mods.** It's a compact Claude Code mod example: turn events, a pane, session state, SVG animation. Use it as a starting point for your own pet or status indicator.

## How Tikinson reacts

| | What Claude does | What Tikinson does |
| :---: | --- | --- |
| <img src="media/tikinson-think.gif" width="96" alt="thinking"> | starts a turn, thinks about the answer | hand on chin |
| <img src="media/tikinson-run.gif" width="96" alt="working"> | calls a tool | runs; the caption names the tool |
| <img src="media/tikinson-wait.gif" width="96" alt="waiting"> | asks you a question or shows a plan | shrugs with open hands |
| <img src="media/tikinson-done.gif" width="96" alt="done"> | finishes the turn | thumbs up, rests after 6 s |
| <img src="media/tikinson-fail.gif" width="96" alt="failed"> | turn interrupted or API error | gets upset |
| <img src="media/tikinson-wave.gif" width="96" alt="hello"> | new session | waves |
| <img src="media/tikinson-idle.gif" width="96" alt="idle"> | nothing is happening | rests |

Subagents don't drive the pet: while a subagent works, Tikinson keeps running with the caption `Agent`.

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

## Usage

- The pane opens by itself when a session starts. Closed it? Run `/tikinson`.
- The animation is drawn in Claude Desktop. In a terminal you get a text status under the prompt instead.

## How it works

The mod listens to Claude Code events: `turn.start` (a turn begins), `tool.call` (a tool runs), `turn.complete` (a turn ends), and keeps the current mood in session state. The pane draws frames from Tikinson's sprite atlas as an SVG with SMIL animation. Code: [`hooks/register.tsx`](hooks/register.tsx); reaction tests: [`hooks/pet.test.tsx`](hooks/pet.test.tsx).

## License and credits

**Tikinson — Andrey / [Andryuha40](https://github.com/Andryuha40).** The character comes from the [codexpets](https://github.com/Andryuha40/codexpets) collection.

The character, its images and animations are licensed for personal, non-commercial use only, with no changes to the artwork. Full text in [LICENSE.md](LICENSE.md). Frames are taken from the codexpets atlas without altering the drawing: cut into strips and compressed to WebP.
