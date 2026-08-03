# react-financial-input

[![CI](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml/badge.svg)](https://github.com/david-chau/react-financial-input/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/react-financial-input)](https://www.npmjs.com/package/react-financial-input)
[![bundle size](https://img.shields.io/bundlejs/size/react-financial-input)](https://bundlejs.com/?q=react-financial-input)
[![license](https://img.shields.io/npm/l/react-financial-input)](https://github.com/david-chau/react-financial-input/blob/main/LICENSE)

A React currency input that formats as you type, with `h`/`k`/`m`/`b` multiplier
shortcuts that work on **every device, including phones**.

Zero runtime dependencies. Unstyled by default.

**[Open the playground in StackBlitz →](https://stackblitz.com/github/david-chau/react-financial-input/tree/main/examples/playground?file=src%2FApp.tsx)**
· **[Browse every state in Storybook →](https://david-chau.github.io/react-financial-input/)**
· **[Framework examples →](https://github.com/david-chau/react-financial-input/blob/main/EXAMPLES.md)**

## Quick start

```bash
npm install react-financial-input
```

```tsx
import { useState } from 'react';
import { FinancialInput } from 'react-financial-input';

export const AmountField = () => {
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <>
      <label htmlFor="amount">Amount</label>
      <FinancialInput id="amount" value={amount} onChange={setAmount} />
    </>
  );
};
```

Type `1234567` and you get `1,234,567`; type `2.5m` and you get `2,500,000`.
`onChange` gives you a `number`, or `null` while the value is incomplete —
never `NaN`. Want strings instead? `valueType="string"`.

Want it styled? One import, opt-in:

```tsx
import 'react-financial-input/styles.css';
```

React 18 or newer (`>=18.0.0`). Nothing else.

> **Submitting a native `<form>`?** Do not put `name` on the input — it submits
> the formatted `"1,234.56"`.
> [Use a hidden field](https://github.com/david-chau/react-financial-input/blob/main/EXAMPLES.md#a-plain-form-no-library).

## What it does

### Typing

|                            |                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Digits group as you type   | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-digits-group-as-you-type.gif) |
| `2.5m` expands to millions | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-shortcuts-expand.gif)         |

### Editing

|                                 |                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backspace across a separator    | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-backspacing-across-a-separator.gif) |
| Paste is sanitised, not refused | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-paste-is-sanitised.gif)             |
| Undo, one step per edit         | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-undo-restores-in-one-step.gif)      |

Undo is the component's own, so a paste or an expansion comes back in a single
step rather than unwinding character by character.

### Currency

|                                   |                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Symbol and separators from `Intl` | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-currency-and-separators.gif) |
| Search, for when 162 is the list  | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-search-162-currencies.gif)   |

`locale: 'de-DE'` gives `1.234,56`. `currency: 'SEK'` resolves the symbol **and**
which side it belongs on. Symbols follow the **locale**, not the currency: SEK
reads `SEK` in `en-US` and `kr` only in `sv-SE`.

### Feedback and extras

|                                      |                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Refused keystrokes flash             | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-a-refused-keystroke-flashes.gif)          |
| Clear button, undoable               | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-clear-button-and-undo-brings-it-back.gif) |
| Multiplier keys for a numeric keypad | ![](https://raw.githubusercontent.com/david-chau/react-financial-input/main/docs/demo-multiplier-keys-for-a-numeric-keypad.gif) |

The clear button, the keys, the currency picker and the floating label are all
**off by default** — the component renders a bare `<input>`. The hook gives you
the behaviour; you render the markup.
See [the extras](https://github.com/david-chau/react-financial-input/blob/main/DESIGN.md#off-by-default-extras).

## Why this one

- **Shortcuts work on mobile.** Most currency inputs ask for a numeric keypad,
  which has no letter keys — so `2.5m` is impossible to type on a phone.
  ([why](https://github.com/david-chau/react-financial-input/blob/main/DESIGN.md#why-the-keyboard-defaults-to-text-on-mobile))
- **Built on `InputEvent`, not key codes.** Soft keyboards often send no key
  code at all. ([how](https://github.com/david-chau/react-financial-input/blob/main/DESIGN.md#how-input-is-handled))
- **The awkward paths are handled.** Paste, drag-drop, cut, word delete and
  Android IME composition each have a case, not a shrug.
  ([cheatsheet](https://github.com/david-chau/react-financial-input/blob/main/DESIGN.md#input-event-cheatsheet))
- **Tested on real hardware.** Two bugs — an Android caret jump and Samsung
  deferring `compositionend` — only appeared on physical phones, and are now
  recorded traces in the test table.

## Props

Every native `<input>` prop is passed through (`placeholder`, `disabled`,
`name`, `onBlur`, `aria-*`), and `ref` is forwarded.

Four names are taken over rather than forwarded: `value`, `defaultValue` and
`onChange` carry the number or the canonical string instead of DOM strings, and
**`onError` is the refused-keystroke callback**, not the DOM's `error` handler.
`type` is always `text` — `type="number"` cannot hold a value containing
grouping separators.

| Prop                       | Type                                        | Default         | Description                                                                   |
| -------------------------- | ------------------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `value`                    | `number \| string \| null`                  | `undefined`     | Typed by `valueType`. A string may be canonical, display, or `2.5m`.          |
| `onChange`                 | `(value: number \| string \| null) => void` | —               | The number, or canonical text — never the formatted string.                   |
| `valueType`                | `'number' \| 'string'`                      | `'number'`      | Which of the two `value` and `onChange` speak.                                |
| `onError`                  | `() => void`                                | —               | Called when a keystroke is refused.                                           |
| `options.scale`            | `number`                                    | `2`             | Maximum decimal places. `0` refuses the decimal point.                        |
| `options.maxDigits`        | `number`                                    | `11`            | Maximum integer digits.                                                       |
| `options.locale`           | `string`                                    | —               | BCP 47 tag. Supplies separators and the currency symbol.                      |
| `options.currency`         | `string`                                    | —               | ISO 4217 code. The symbol is returned, not put in the value.                  |
| `options.groupSeparator`   | `string`                                    | `','`           | Overrides the locale.                                                         |
| `options.decimalSeparator` | `string`                                    | `'.'`           | Overrides the locale.                                                         |
| `options.shortcuts`        | `Record<string, number>`                    | `h`/`k`/`m`/`b` | Characters to multipliers. Must be powers of ten.                             |
| `options.range`            | `'ALL' \| 'POSITIVE'`                       | `'ALL'`         | `'POSITIVE'` refuses negatives.                                               |
| `options.inputMode`        | `'text' \| 'decimal' \| 'numeric'`          | `'text'`        | Which keyboard mobile raises.                                                 |
| `options.flashOnError`     | `boolean`                                   | `true`          | Flash on a refused keystroke. Colour only; add `rfi-input--shake` for motion. |

### Shortcuts

| Key | Multiplier     |
| --- | -------------- |
| `h` | ×100           |
| `k` | ×1,000         |
| `m` | ×1,000,000     |
| `b` | ×1,000,000,000 |

Typing one on its own reads as one of that unit, so `k` gives `1,000`. Override
with `options.shortcuts`.

## Headless

Keep the formatting and validation, bring your own input:

```tsx
import { useFinancialInput } from 'react-financial-input';

const { getInputProps } = useFinancialInput({ value, onChange: setValue });

<TextField slotProps={{ htmlInput: getInputProps() }} />; // MUI
<Input {...getInputProps()} />; // Chakra
```

The hook returns everything the extras are built from:

| Returned                       | For                                                   |
| ------------------------------ | ----------------------------------------------------- |
| `getInputProps()`              | Spread onto any input                                 |
| `applyShortcut(character)`     | Multiplier tap targets                                |
| `clear()`                      | A clear button. Undoable, like any other edit         |
| `symbol`, `symbolPosition`     | The currency symbol and which side it belongs on      |
| `numericValue`, `displayValue` | The committed number, and what is on screen           |
| `canonicalValue`               | The string to send onward — no grouping, `.` fraction |

## Without React

`parseAmount('$1,234.56 USD')` gives `1234.56`, and `parseAmount('2.5m')` gives
`2500000` — the same rules the input applies to a paste, as one call, with no
DOM. Currency lists, search and flag emoji come from `Intl` rather than a
bundled table.

All of it is in **[UTILS.md](https://github.com/david-chau/react-financial-input/blob/main/UTILS.md)**.

## Docs

- **[EXAMPLES.md](https://github.com/david-chau/react-financial-input/blob/main/EXAMPLES.md)** — Next.js, React Hook Form, Formik, MUI,
  Chakra, TanStack Form, plain forms, and how to test it.
- **[UTILS.md](https://github.com/david-chau/react-financial-input/blob/main/UTILS.md)** — the non-React exports: parsing, formatting,
  currency lists, search, flags.
- **[DESIGN.md](https://github.com/david-chau/react-financial-input/blob/main/DESIGN.md)** — why it behaves as it does: the state model and
  controlled mode, the mobile keyboard trade-off, exact multipliers, the input
  event cheatsheet, the device support matrix, styling.
- **[CONTRIBUTING.md](https://github.com/david-chau/react-financial-input/blob/main/CONTRIBUTING.md)** — architecture rules and local setup.
- **[CI.md](https://github.com/david-chau/react-financial-input/blob/main/CI.md)** — what each workflow does, and how to publish.

## License

MIT
