# Pointscape 3D

A web puzzle in enhanced 3D. Every arrow is a line with a head. Tap an arrow whose path is clear and it slides off the
board. Tap one that is blocked and you lose a heart. Clear the board to win.

It is a remake of the idea behind the mobile game "Pointers" (Arrows). It reuses none of that game's art, audio, levels
or name.

## Level sets

Two axes. Difficulty is Tiny (8x8), Compact (12x12), Large (18x18), Vast (24x24) or Massive (32x32): it sets the
grid size. Layers are 1L to 5L: the number of stacked layers. Each pair is a track of 100 levels, so there are 25
tracks and 2,500 levels. Tiny 1L is open from the start. Clearing 10 levels of a track opens the next layer count in
its row (Tiny 1L opens Tiny 2L, and so on). Clearing 10 levels of a 1L track also opens the 1L track of the next
difficulty. There is no Undo.

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
