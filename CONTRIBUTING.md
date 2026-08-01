# Contributing

## Architecture rules

These are not style preferences. The whole value of this library is that
platform quirks are testable without a device, and that only holds if the logic
stays out of the component.

**`.tsx` — React only.** A component file contains the render and nothing else.
No branching, no formatting, no arithmetic. `FinancialInput.tsx` is one line of
JSX, and it should stay that way.

**`.ts` — pure functions.** No React import, no DOM access, no hidden state.
Same input, same output, every time.

**Custom hooks live in `.ts`.** They contain no JSX, and keeping them out of
`.tsx` makes the "components only" rule easy to check at a glance.

**Every pure function gets an `it.each` table.** The tables _are_ the spec — a
new case is a new row, not a new test block. Add a trailing note column
explaining _why_ the row exists, especially for regressions:

```ts
it.each([
  // value    scale  expected  note
  ['1.5', 2, true, 'one decimal place'],
  ['1.234', 2, false, 'regression: scale was never enforced here']
])(
  'isValidInsert(%j, scale %i) -> %s (%s)',
  (value, scale, expected, _note) => {
    expect(isValidInsert(value, scale)).toBe(expected);
  }
);
```

## Layout

```
lib/components/financialInput/
  financialInputReducer.ts   pure (state, action) => state    <- it.each table
  financialInputUtils.ts     pure predicates and parsing      <- it.each table
  useFinancialInput.ts       state, side effects, prop-getter
  FinancialInput.tsx         render only
lib/utils/                   pure helpers                     <- it.each tables
e2e/                         Playwright: layers 2 and 3
```

New input handling belongs in the reducer as a new `case`, with rows added to
`financialInputReducer.test.ts`. It should not require touching the component.

## Verification layers

The support matrix and what backs each row are in
[DESIGN.md](DESIGN.md#verification-layers). In short:

- **L1** unit tables — where coverage actually lives. Fast, free, deterministic.
- **L2** `npx playwright test` — real browser engines; the CI matrix supplies
  the real operating systems.
- **L3** `npx playwright test --project=chromium-ime` — genuine IME composition
  events over the DevTools Protocol. Chromium only.
- **L4** real devices — not wired up yet.

A device descriptor such as `devices['Pixel 7']` is desktop Chromium with a
phone-sized viewport. It does **not** emulate a soft keyboard or an IME. Never
claim Android or iOS support on the strength of one.

## Rules that are not negotiable

- **No runtime dependencies.** If something needs a library, it probably needs
  ten lines instead. The float-exact multiply is the worked example.
- **Styling stays opt-in.** Nothing in the built JavaScript may import the
  stylesheet; CI fails the build if it does.
- **The support matrix does not get green ticks on hope.** Ship 🚧 and let the
  work turn it green.

## Commands

```bash
npm install
npm run storybook     # dev loop
npm test              # Vitest
npm run lint
npm run typecheck
npm run prettier:fix
npm run build
npx playwright test
npm run record-demos  # needs ffmpeg
```

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org), because the release
version is derived from them: `fix:` is a patch, `feat:` is a minor, `feat!:` or
a `BREAKING CHANGE:` footer is a major once past `1.0.0`.

**Squash merges use the pull request title as the commit message**, so title PRs
the same way: `fix: keep the merged ref stable`, not `Fix ref bug`.

## Releasing

Nothing manual. A bot keeps an open `chore(main): release x.y.z` PR; merging it
bumps the version, writes the changelog, tags and publishes. See [CI.md](CI.md).
