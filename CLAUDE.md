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
- **`inputMode` defaults to `'text'`, not `'decimal'`.** Every mobile numeric
  keypad omits letter keys — the `ABC`/`DEF` printed under iOS's digits are
  cosmetic — so `'decimal'` makes the `h`/`k`/`m`/`b` shortcuts physically
  unreachable on a phone, reducing the library to an ordinary formatted number
  input on exactly the devices it exists for. The keypad is opt-in via
  `options.inputMode`, paired with `applyShortcut` for tap targets. Do not
  "fix" this back to `decimal`.
- `type` is always `'text'`. `type="number"` cannot hold a value containing
  grouping separators.

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

Phase 1 and Phase 2 are both done. Every `InputEvent` type is handled: paste,
drop and iOS replacement text are sanitised rather than refused; cut, forward
delete and the word/line deletes reformat what is left; Android IME composition
holds raw text between `compositionstart` and `compositionend`, then validates
on commit. `historyUndo`/`historyRedo` stay ignored on purpose — the browser's
undo stack holds edits React never rendered.

Also shipped: controlled-mode sync, `groupSeparator`/`decimalSeparator`,
`locale`, `currency`, configurable `shortcuts`, and `range: 'POSITIVE'`.

Remaining, in the DESIGN.md roadmap: real-device CI (L4), IME on Firefox and
WebKit (no CDP equivalent), and a possible string-valued API.

## Things that will bite

- **Canonical vs display form.** Display uses the configured separators;
  canonical has no grouping and always a `.` fraction. Validation, arithmetic
  and comparison work on canonical. Only `toCanonical` and `formatCanonical`
  know about separators — keep it that way rather than threading them further.
- **The currency symbol is never in the input's value.** It is returned from
  the hook and rendered beside the input. Putting it in the value would force
  the caret arithmetic to skip non-digits and every validation path to strip
  them off.
- **Several locales group with non-ASCII whitespace** — sv-SE and nb-NO use
  U+00A0, fr-FR uses U+202F. Invisible in a diff; a test comparing against a
  literal `" "` fails confusingly.
- **The merged ref is cached on the caller's ref identity.** Rebuilding it per
  render makes React re-attach every render, and a consumer's state-setting
  callback ref then loops forever.
