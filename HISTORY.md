# A short history

Two bursts of work, twenty-six months apart, of almost exactly the same size.

```
2024-05-15 → 2024-05-28    47 commits
                           ( nothing )
2026-08-01 → 2026-08-03    47 commits
```

## Before: finput

The problem this library exists for is older than the library. Scott Logic's
[finput](https://github.com/ScottLogic/finput) was solving it years earlier: a
financial input where the value formats as you type, and where every way a
person can put text into a field — typing, pasting, dragging, autocorrecting —
has to be understood rather than assumed.

That is harder than it sounds, and it is why the problem keeps being solved
again. A number input is trivial. A number input that reformats itself under a
moving caret, on a keyboard that may not report keys at all, is not.

## 2024: two weeks, then silence

The first era built the shape of the thing. A React component, formatting via a
`csv`-prefixed set of helpers, jest and React Testing Library, a Storybook
config added and then removed again, and `bignumber.js` for the multiplier
arithmetic.

It did not finish. The last commit is `Update npm-publish.yml`, and the four
before it are `Test build CI`, `Test build CI`, `Test build CI`, `Test build
CI`. The project did not end on a decision; it ended mid-fight with its own
publish pipeline.

What that pipeline said, in the state it was abandoned:

```yaml
runs-on: macos-11
```

GitHub retired `macos-11` later that year. So even setting aside whoever
stopped working on it, the workflow could never have run again. Every push to
`main` for the next two years failed before it started.

Left behind in the component:

```ts
const handleInsertFromPaste = () => {};
const handleInsertFromDrop = () => {};
const handleDeleteByCut = () => {};
const handleDeleteContentForwards = () => {};

onError?: any; // TODO: Fix type
```

Four empty functions where the README promised the library "prevents invalid
input whether typed, dragged or pasted". The claim was written before the code
was, which is a very ordinary way for a side project to die.

## 2026: the revival

The second era started by reading what was actually there, which is how the
`macos-11` line and the four stubs turned up. In rough order:

**Infrastructure first, because nothing could ship without it.** The publish
workflow was rewritten from scratch. npm had changed underneath it in the
meantime: granular access tokens no longer publish under 2FA, so the fix was
not a new token but Trusted Publishing — OIDC, no long-lived secret in the
repository at all, provenance attached automatically. Releases became
release-please plus Conventional Commits, so merging a pull request is the
release.

That part was not smooth. A release was tagged with no component and never
published; the cause was one `separate-pull-requests: false` in a config file,
and the first fix for it was wrong. Later, a release pull request written before
another merge landed swallowed a feature into a patch version, which is recorded
honestly in [CHANGELOG.md](CHANGELOG.md) rather than quietly renumbered.

**Then the stack.** Jest to Vitest, ESLint 8 to flat config, React 18 and 19
both supported and both tested — later widened to `>=18.0.0`,
which immediately exposed that `@types/react@18.0` has no `useRef<T>(undefined)`
overload and the declared floor had been broken all along.

**Then the build.** Vite 5 to 8, Storybook 8 to 10 — but the interesting part
was not the version numbers. `vite` itself sat in `dependencies`, so every
consumer of a currency input was installing a build tool. Beside it,
`optionalDependencies` pinned `@rollup/rollup-linux-x64-gnu`, a workaround for
an npm bug fixed long before, which forced a Linux binary onto Mac installs.
`tsup` was in there too, a second bundler for a project that already had one,
and `vite-plugin-lib-inject-css` — whose entire job is to inject CSS imports
into the JavaScript bundle, which is exactly what the opt-in stylesheet must
never allow.

Both `dependencies` and `optionalDependencies` are now empty objects.

**Then the last real dependency.** `bignumber.js` was there for one multiply.
Every shortcut multiplier is a power of ten, so the decimal point can be shifted
through the string instead — ten lines, exact, and `4.35h` is `435` rather than
the `434.99999999999994` a float gives you. That left zero runtime
dependencies, which is the headline the README can now actually make.

**Then the four stubs.** Paste, drop, cut and forward delete were implemented,
along with word and line deletes, iOS replacement text, and Android IME
composition. The logic moved into a pure reducer with `it.each` tables, so each
platform quirk is a row rather than a branch.

**Then everything around it.** Storybook deployed to GitHub Pages, Playwright
across real Windows and macOS runners, IME composition driven over CDP, demo
GIFs recorded from the same stories that ship, and documentation split so the
README stays a quick start.

## What the devices taught

The interesting part of the second era was not the infrastructure. It was that
almost every real bug came from a physical phone, and none of them could have
been found by reasoning.

| Found on | What was wrong                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android  | `selectionStart` reports 0 for a backspace at the end of the value, so the caret jumped to the front on every delete                                         |
| Samsung  | `compositionend` is deferred until blur, so `2k` sat on screen while every other platform showed `2,000`                                                     |
| SwiftKey | The clipboard chip above the keyboard sends `insertText` carrying an entire string, so pastes were validated as if one character had been typed, and refused |
| iOS      | A pinyin keyboard put Chinese characters into a numeric field, and fires no `compositionend` to clean up after itself                                        |
| Windows  | No glyphs for regional indicator pairs, so currency flags rendered as two letters                                                                            |

Two more came from reading rather than typing: pasting `2.5mk` silently produced
2,500 instead of 2.5 billion, and `1 000 KM` — Bosnian marks — parsed as a
thousand billion, because both are spelled with shortcut letters.

Every one of them is now a row in a test table, which is the only reason they
stay fixed.

## Where it stands

Published, automated, and honest about its limits. The support matrix marks what
is verified and by which layer, rather than painting everything green: real
devices confirmed several rows, and no amount of emulation can confirm the rest,
because nobody owns every phone.

The headline used to say "works on every device". It says something narrower
now, and truer.

## 1.0.0

Cut after seven rounds of looking for reasons not to.

Each round found something, and the list is a fair description of what a
"finished" side project actually hides: an API of 66 names nobody had chosen,
TypeScript declarations that were wrong for CommonJS consumers, two critical
ARIA violations in the widget the docs told people to copy, a `'use client'`
banner that made the parsing unusable in the server action the examples
demonstrated, a load-bearing rule with no test holding it, and grouping that
was wrong for every Indian locale.

The seventh round found nothing, and a deliberate hunt for memory leaks found
one uncancelled animation frame that was not a leak.

None of that was visible from the outside. The library worked the whole time.
