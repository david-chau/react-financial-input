# react-financial-input

[![CI](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml/badge.svg)](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/react-financial-input)](https://www.npmjs.com/package/react-financial-input)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-financial-input)](https://bundlephobia.com/package/react-financial-input)
[![license](https://img.shields.io/npm/l/react-financial-input)](./LICENSE)

A React currency input that formats as you type, with `h`/`k`/`m`/`b` multiplier
shortcuts that work on **every device, including phones**.

Zero runtime dependencies. Unstyled by default.

```
1234567  ->  1,234,567
2.5m     ->  2,500,000
```

|                                |                                                   |
| ------------------------------ | ------------------------------------------------- |
| Digits group as you type       | ![](docs/demo-digits-group-as-you-type.gif)       |
| Shortcuts expand               | ![](docs/demo-shortcuts-expand.gif)               |
| Backspacing across a separator | ![](docs/demo-backspacing-across-a-separator.gif) |

**[Browse every state in Storybook →](https://david-chau.github.io/react-financial-input/)**

## Why

- **Shortcuts work on mobile.** Most currency inputs ask for a numeric keypad,
  which has no letter keys — so `2.5m` is impossible to type on a phone. This one
  keeps the multipliers reachable everywhere. ([why](DESIGN.md#why-the-keyboard-defaults-to-text-on-mobile))
- **Built on `InputEvent`, not key codes.** Soft keyboards often send no key code
  at all. Reading `inputType` is what makes the same code path work on a desktop
  keyboard, Gboard and iOS. ([how](DESIGN.md#how-input-is-handled))
- **Exact arithmetic.** `4.35h` is `435`, not the `434.99999999999994` a float
  multiply gives you — with no big-number dependency. ([how](DESIGN.md#why-there-are-no-dependencies))
- **Yours to style.** Unstyled by default, an optional Material-UI-flavoured
  stylesheet if you want one, or a headless hook to bring your own input.
  ([tiers](DESIGN.md#styling))

## Install

```bash
npm install react-financial-input
```

React 18 or 19 is required as a peer dependency. There are no other dependencies.

## Usage

```tsx
import { FinancialInput } from 'react-financial-input';

<FinancialInput value={amount} onChange={setAmount} />;
```

`onChange` receives a `number`, or `null` while the value is incomplete — an
empty input, or a lone `.` part-way through typing. It is never `NaN`.

Every native `<input>` prop is passed through (`placeholder`, `disabled`, `name`,
`onBlur`, `aria-*`), and `ref` is forwarded to the underlying input.

| Prop                | Type                               | Default     | Description                                                        |
| ------------------- | ---------------------------------- | ----------- | ------------------------------------------------------------------ |
| `value`             | `number \| null`                   | `undefined` | The numeric value.                                                 |
| `onChange`          | `(value: number \| null) => void`  | —           | Called with the numeric value, not the formatted string.           |
| `onError`           | `() => void`                       | —           | Called when a keystroke is refused, such as a third decimal place. |
| `options.scale`     | `number`                           | `2`         | Maximum decimal places. `0` refuses the decimal point entirely.    |
| `options.maxDigits` | `number`                           | `11`        | Maximum integer digits.                                            |
| `options.inputMode` | `'text' \| 'decimal' \| 'numeric'` | `'text'`    | Which keyboard mobile raises.                                      |

### Shortcuts

| Key | Multiplier     |
| --- | -------------- |
| `h` | ×100           |
| `k` | ×1,000         |
| `m` | ×1,000,000     |
| `b` | ×1,000,000,000 |

Typing a shortcut on its own reads as one of that unit, so `k` gives `1,000`.

### Styling

Nothing is loaded unless you ask for it:

```tsx
<FinancialInput />                              // unstyled, no CSS at all
<FinancialInput className="border rounded" />   // your own classes

import 'react-financial-input/styles.css';      // optional, MUI-flavoured
```

### Headless

Keep the formatting and validation, bring your own input:

```tsx
import { useFinancialInput } from 'react-financial-input';

const { getInputProps } = useFinancialInput({ value, onChange: setValue });

<TextField slotProps={{ htmlInput: getInputProps() }} />; // MUI
<Input {...getInputProps()} />; // Chakra
```

## Docs

- **[DESIGN.md](DESIGN.md)** — why it behaves the way it does: the mobile
  keyboard trade-off, the device support matrix and how each row is verified,
  styling variants and the floating label.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — architecture rules and local setup.
- **[CI.md](CI.md)** — what each workflow does, and how to publish a new version.

## License

MIT
