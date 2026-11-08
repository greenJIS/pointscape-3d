# Pointscape 3D

A web puzzle in enhanced 3D. Every arrow is a line with a head. Tap an arrow whose path is clear and it slides off the
board. Tap one that is blocked and you lose a heart. Clear the board to win.

It is a remake of the idea behind the mobile game "Pointers" (Arrows). It reuses none of that game's art, audio, levels
or name.

## Difficulties

| Difficulty | Layers | Levels |
| ---------- | ------ | ------ |
| Easy       | 1      | 100    |
| Medium     | 2      | 100    |
| Hard       | 3      | 100    |
| Extreme    | 4      | 100    |
| Insane     | 5      | 100    |

Easy is open from the start. Clearing 10 levels of one difficulty opens the next. There is no Undo.

## Getting started

You need Node 24 (pinned in `.nvmrc`, so `nvm use` picks it) and npm.

```bash
npm install
npm run dev
```

Other commands:

```bash
npm test             # unit tests (Vitest)
npm run lint         # ESLint, including canonical Tailwind class checks
npm run format:check # Prettier
npm run build        # type check and production build into dist/
npm run preview      # serve the production build
```

## Project layout

```text
src/core/   pure game logic, no browser or three.js
src/game/   state, progress, settings, saving
src/view/   three.js scene and animation
src/ui/     React screens and parts
public/     static files, such as the favicon
docs/       requirements, plan and UI plan (kept local, not in the repository)
```

Commit messages follow `type(scope): summary` (feat, fix, chore, refactor, docs, test, ci, build, perf, style,
revert) and are checked by commitlint through a Husky hook.

## Documents

The design documents live in `docs/` on the author's machine and are not published with the repository:

- Requirements (SRS): what the game must do, with numbered requirements.
- Plan and research: why the game is built this way.
- UI plan: every screen and its rules.

## Status

The game is playable end to end: name screen, Home, difficulty and level pick, the 3D board with stacked layers,
hearts, hints, win and lose, saved progress, settings, How to play and sound. All 500 levels are generated from
seeds and checked solvable.

Still open: the animation numbers are guesses and need tuning by hand, the difficulty curve needs playtesting, and
there is no deploy workflow yet. Publishing to GitHub Pages is planned for when the game is ready. The Vite `base` is
already set to `/pointscape-3d/` for it.
