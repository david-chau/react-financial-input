# react-financial-input

[![CI](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml/badge.svg)](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/react-financial-input)](https://www.npmjs.com/package/react-financial-input)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-financial-input)](https://bundlephobia.com/package/react-financial-input)
[![license](https://img.shields.io/npm/l/react-financial-input)](./LICENSE)

A React currency input that formats as you type, with `h`/`k`/`m`/`b` multiplier
shortcuts. **Zero runtime dependencies.** Unstyled by default.

```
1234567  ->  1,234,567
2.5m     ->  2,500,000
```

## Why this exists

Most React currency inputs are written and tested against a desktop keyboard,
and treat the browser's `InputEvent` as an afterthought. That works until a real
device shows up:

- **Android soft keyboards** report `insertCompositionText` with a `data` field
  that cannot be trusted, rather than the `insertText` a desktop keyboard sends.
- **iOS Safari** moves the caret when the value is reformatted mid-edit, so the
  next keystroke lands in the wrong place.
- **Paste and drag-and-drop** bypass keystroke validation entirely, which is how
  `$1,234.00 USD` ends up inside a numeric field.
- **Windows and macOS** disagree about which modifier means "select all".

`react-financial-input` branches on the `InputEvent` `inputType` as the primary
signal instead of guessing from key codes, so each platform's input path is
handled explicitly rather than assumed. That logic lives in a pure reducer, which
means every platform quirk is a row in a test table rather than a branch buried
in a component.

**It is not all finished yet.** The support matrix below marks what is shipped
and what is still in progress. Nothing there is aspirational.

## Demo

|                                |                                                   |
| ------------------------------ | ------------------------------------------------- |
| Digits group as you type       | ![](docs/demo-digits-group-as-you-type.gif)       |
| Shortcuts expand               | ![](docs/demo-shortcuts-expand.gif)               |
| Backspacing across a separator | ![](docs/demo-backspacing-across-a-separator.gif) |

Browse every state in [Storybook](https://david-chau.github.io/react-financial-input/).

> The recordings show the optional stylesheet. Out of the box the component is an
> unstyled `<input>`.

## Install

```bash
npm install react-financial-input
```

React 18 or 19 is required as a peer dependency. There are no other dependencies.

## Usage

```tsx
import { FinancialInput } from 'react-financial-input';

<FinancialInput
  value={amount}
  onChange={setAmount}
  options={{ scale: 2, maxDigits: 11 }}
/>;
```

`onChange` receives a `number`, or `null` while the value is incomplete — an
empty input, or a lone `.` part-way through typing. It is never `NaN`.

### Props

Every native `<input>` prop is passed through, so `placeholder`, `disabled`,
`name`, `onBlur` and `aria-*` all work as usual. `ref` is forwarded to the
underlying input.

| Prop                | Type                              | Default     | Description                                                        |
| ------------------- | --------------------------------- | ----------- | ------------------------------------------------------------------ |
| `value`             | `number \| null`                  | `undefined` | The numeric value.                                                 |
| `onChange`          | `(value: number \| null) => void` | —           | Called with the numeric value, not the formatted string.           |
| `onError`           | `() => void`                      | —           | Called when a keystroke is refused, such as a third decimal place. |
| `options.scale`     | `number`                          | `2`         | Maximum decimal places. `0` refuses the decimal point entirely.    |
| `options.maxDigits` | `number`                          | `11`        | Maximum integer digits.                                            |

### Shortcuts

| Key | Multiplier     |
| --- | -------------- |
| `h` | ×100           |
| `k` | ×1,000         |
| `m` | ×1,000,000     |
| `b` | ×1,000,000,000 |

Typing a shortcut on its own reads as one of that unit, so `k` gives `1,000`.

Multipliers are applied by shifting the decimal point through the string rather
than by multiplying floats, so `4.35h` is exactly `435` — not the
`434.99999999999994` that `4.35 * 100` produces in JavaScript. This is why there
is no `bignumber.js` dependency.

## Styling

Nothing is styled unless you ask for it. Pick a tier:

```tsx
// 1. Unstyled — a bare <input>, no CSS loaded at all.
<FinancialInput />

// 2. Your own classes.
<FinancialInput className="border rounded px-2" />

// 3. The optional stylesheet.
import 'react-financial-input/styles.css';

// 4. Your own component entirely — see the headless hook below.
```

The stylesheet is a separate export. Nothing in the JavaScript references it, so
if you do not import it, it never reaches your bundle.

### The optional stylesheet

Modelled on Material UI's TextField — but hand-written CSS, with **no MUI
dependency**. The same three variants, by class:

```tsx
<FinancialInput />                                  {/* outlined (default) */}
<FinancialInput className="rfi-input--filled" />
<FinancialInput className="rfi-input--standard" />
<FinancialInput className="rfi-input--small" />     {/* 40px instead of 56px */}
```

Retheme with custom properties rather than forking the file:

```css
:root {
  --rfi-primary: #6366f1;
  --rfi-radius: 8px;
  --rfi-height: 48px;
  --rfi-text-align: left; /* defaults to right, the finance convention */
  --rfi-surface: #fff; /* the colour the floating label paints over */
}
```

#### Floating label

The component renders a bare `<input>`, so the label needs a wrapper you supply.
It is pure CSS — no JavaScript, driven by `:focus-within` and
`:placeholder-shown`, which is why the input needs `placeholder=" "`:

```tsx
<>
  <div className="rfi-field">
    <FinancialInput id="amount" placeholder=" " aria-invalid={hasError} />
    <label className="rfi-label" htmlFor="amount">
      Amount
    </label>
  </div>
  {hasError && <p className="rfi-helper rfi-helper--error">Not allowed</p>}
</>
```

The floated label paints a slice of `--rfi-surface` behind itself to sit in the
border — the CSS-only stand-in for MUI's notched fieldset. Set `--rfi-surface` if
the field sits on anything other than white.

### Headless

`useFinancialInput` gives you the formatting and validation with none of the
markup, so you can keep your own design system's input:

```tsx
import { useFinancialInput } from 'react-financial-input';

const { getInputProps, numericValue } = useFinancialInput({
  value,
  onChange: setValue
});

<TextField slotProps={{ htmlInput: getInputProps() }} />; // MUI
<Input {...getInputProps()} />; // Chakra
```

## Device support

Backed by four layers of verification, so each cell says what it is based on:

| Layer  | What it is                                            | What it proves                                |
| ------ | ----------------------------------------------------- | --------------------------------------------- |
| **L1** | `it.each` tables over the pure reducer                | Every `inputType` sequence, deterministically |
| **L2** | Playwright on a Windows / macOS / Linux runner matrix | Real OS key handling, real browser engines    |
| **L3** | Playwright + CDP `Input.imeSetComposition`            | Genuine composition events, without a device  |
| **L4** | Real devices (BrowserStack)                           | Real iOS Safari and real Android GBoard       |

| Capability                             | Chrome | Firefox | Safari | Android | iOS | Verified by                               |
| -------------------------------------- | ------ | ------- | ------ | ------- | --- | ----------------------------------------- |
| Type digits, group as you type         | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| `h`/`k`/`m`/`b` shortcuts              | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Backspace, including across separators | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Refuse over-scale / over-digit input   | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Select-all then overtype               | ✅     | ✅      | ✅     | ✅      | ✅  | L2                                        |
| Numeric keypad on mobile (`inputMode`) | —      | —       | —      | ⚠️      | ✅  | L2                                        |
| Paste                                  | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet parsed           |
| Drag and drop                          | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet parsed           |
| Cut, forward delete                    | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet applied          |
| IME composition                        | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | L3 harness in place, reducer case pending |

✅ shipped and tested — 🚧 not implemented; the input keeps its previous value
rather than corrupting it, and `onError` stays quiet.

⚠️ The component sets `inputmode="decimal"` (or `numeric` when `scale: 0`), which
is the correct and spec-compliant way to ask for a numeric keypad. Gboard and iOS
both honour it. **Some Android keyboards — Samsung's in particular — ignore
`inputmode` and key off `type` alone**, and `type` cannot be `number` here
because a number input refuses to hold a value containing grouping separators.
`inputMode` is overridable if you need to force something else for your users.
The `KeyboardDiagnostics` story in Storybook reports what a given device
actually resolves.

**Honest caveat.** The Android and iOS columns are Playwright device emulation:
viewport, touch and user agent. They are _not_ a real soft keyboard or IME.
`devices['Pixel 7']` is desktop Chromium with a phone-sized window. Real-device
verification (L4) is not wired up yet, which is exactly why the composition row
is 🚧.

## Roadmap

1. Paste, drop, cut and forward-delete
2. Android `insertCompositionText` handling
3. Controlled-mode sync when the `value` prop changes externally
4. `groupSeparator` / `decimalSeparator` props, for `1.000,50`
5. Opt-in currency symbol via `Intl`, overridable with a prop
6. Configurable shortcuts and a positive-only range
7. Real-device CI

## Developing

```bash
npm install
npm run storybook     # the dev loop
npm test              # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build         # dist/ — ESM, CJS and .d.ts
npx playwright test   # cross-browser e2e
npm run record-demos  # regenerate docs/*.gif (needs ffmpeg)
```

Architecture rules are in [CONTRIBUTING.md](CONTRIBUTING.md). The short version:
`.tsx` holds the render and nothing else, `.ts` holds pure functions, and every
pure function gets an `it.each` table.

## License

MIT
