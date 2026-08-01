# react-financial-input

React currency input. Formats as you type, `h`/`k`/`m`/`b` shortcuts. Zero
runtime dependencies, unstyled by default.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing code — the architecture
rules there are load-bearing, not preferences.

## Architecture rules

- `.tsx` = render only. No logic, no formatting, no branching.
- `.ts` = pure functions. No React, no DOM, no hidden state.
- Hooks live in `.ts` (they contain no JSX).
- Every pure function gets an `it.each` table with a trailing note column.

`FinancialInput.tsx` is a single line of JSX. Keep it that way. New input
handling is a new `case` in `financialInputReducer.ts` plus rows in its table —
it should never require touching the component.

## Constraints

- **No runtime dependencies.** `bignumber.js` was removed by replacing it with
  `shiftDecimal`, which multiplies by powers of ten by moving the decimal point
  through the string. Exact where floats are not: `4.35 * 100` is
  `434.99999999999994` in JavaScript.
- **Styling is opt-in.** `styles.css` is a separate subpath export and nothing
  in the built JavaScript may reference it. CI greps `dist/` and fails if it
  does. This is also why `vite-plugin-lib-inject-css` must not come back.
- **`sideEffects` is `["**/*.css"]`, not `false`.** With `false`, bundlers
  tree-shake a bare `import 'react-financial-input/styles.css'` away and the
  styles silently vanish in consumer production builds.
- React 18 and 19 are both supported. React 18 types `onInput` with `FormEvent`,
  React 19 with its own `InputEvent`, which is why the hook uses a structural
  event type instead of either.

## Verification

Coverage lives in the L1 unit tables, not in the browser. Playwright confirms
reality still matches them.

- `npm test` — Vitest, the tables
- `npx playwright test` — real engines; CI supplies real Windows and macOS
- `npx playwright test --project=chromium-ime` — real IME composition via CDP

Playwright device descriptors (`devices['Pixel 7']`) emulate viewport, touch and
user agent only. They do **not** emulate a soft keyboard or IME, so they cannot
produce `insertCompositionText`. Never mark the support matrix green on the
strength of one.

## Current state

Phase 1 is done: rename, publish pipeline, dependency prune, restructure,
Storybook, e2e, GIFs.

Phase 2 is unstarted and tracked in the README roadmap. The reducer currently
`ignore`s `insertFromPaste`, `insertFromDrop`, `insertCompositionText`,
`deleteByCut` and `deleteContentForward` — it keeps the previous value and stays
quiet rather than firing `onError`, because the user did nothing wrong.
