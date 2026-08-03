# Utilities

These are exported from the package root and work without React. Each one
tree-shakes away if you do not import it.

```ts
import {
  parseAmount,
  formatNumber,
  listCurrencies,
  searchCurrencies,
  toFlagEmoji
} from 'react-financial-input';
```

## Parsing and formatting

The same rules the input applies to a paste, as one call. No React, no DOM —
these run server-side quite happily.

```ts
parseAmount('1k'); // 1000
parseAmount('2.5m'); // 2500000
parseAmount('$1,234.56 USD'); // 1234.56
parseAmount('(1,234.00)'); // -1234   accounting negative
parseAmount('not a number'); // null

formatNumber(1234567); // '1,234,567'
formatNumber(1234.5, { group: '.', decimal: ',' }); // '1.234,5'
```

`parseAmount` takes optional separators and shortcuts as its second and third
arguments, so `parseAmount('1.234,56', { group: '.', decimal: ',' })` reads the
German convention.

| Function                                    | Returns                                         |
| ------------------------------------------- | ----------------------------------------------- |
| `parseAmount(text, separators?, shortcuts)` | `number`, or `null` if there is no number in it |
| `formatNumber(value, separators?)`          | The grouped display string                      |

**Multipliers are exact.** `4.35h` is `435`, not the `434.99999999999994` a
float multiply gives you — the decimal point is shifted through the string
rather than multiplied. See
[DESIGN.md](DESIGN.md#why-there-are-no-dependencies).

## Currency lists

`listCurrencies` and `searchCurrencies` read `Intl.supportedValuesOf`, so there
is no bundled table to go stale.

```ts
listCurrencies('en-US'); // g10 by default, 10 currencies
listCurrencies('en-US', 'g7'); // 5
listCurrencies('en-US', 'all'); // 162
listCurrencies('en-US', ['NZD', 'THB']); // your own, in your order

searchCurrencies('kron', { codes: 'all' }); // DKK, NOK, SEK — code beats name
```

Both return `CurrencyOption[]`: `{ code, name, symbol }`.

### Presets

| Preset  | Contents                                                            |
| ------- | ------------------------------------------------------------------- |
| `'g7'`  | The G7 countries' currencies — five, once the euro members collapse |
| `'g10'` | The FX market's ten. **The default**                                |
| `'all'` | Everything the runtime knows, currently 162                         |

Or pass your own `readonly string[]`, kept in the order you write it.

### Flags

```ts
toFlagEmoji('SEK'); // 🇸🇪
toFlagEmoji('XAU'); // null — gold has no country
```

Free, with no image assets: an ISO 4217 code is the ISO 3166 country code plus a
letter, and a flag emoji is that country code written in regional indicator
symbols. Codes with no country return `null`, so fall back to the code.

### Windows draws letters, not flags

Windows ships no glyphs for regional indicator pairs, so a browser renders the
two letters — `SE` instead of 🇸🇪. This is a missing font on the machine, not
something CSS or JavaScript can work around. Every other major platform is fine.

`supportsFlagEmoji()` tells you which you are on. It draws one and looks for
colour: a real flag has several hues, the letter fallback has one.

```ts
import { supportsFlagEmoji } from 'react-financial-input';

supportsFlagEmoji(); // false on Windows, true on macOS, iOS, Android, most Linux
```

It returns `false` during server rendering and anywhere without a canvas,
because the honest answer is then "cannot tell" and the fallback is the safe
branch. The result is cached — it cannot change mid-session.

### Making them appear anyway

The only real fix is a font carrying the glyphs, and that is a few hundred
kilobytes. **This library ships the hook, not the font** — a package that
advertises 4.6 kB has no business quietly adding a webfont. You choose whether
the download is worth it, and pay for it only where it is needed:

```ts
if (supportsFlagEmoji()) return; // nothing to do on most platforms

await import('./flag-font.css'); // your font, loaded on Windows alone
```

```css
@font-face {
  font-family: 'Your Flags';
  src: url('/fonts/flags.woff2') format('woff2');
  font-display: swap;
}
:root {
  --rfi-flag-font: 'Your Flags';
}
```

`styles.css` puts `--rfi-flag-font` in front of the normal stack on `.rfi-flag`,
which the currency search already carries, so setting the variable is the whole
integration. Leave it unset and the letters stay, which reads perfectly well.

Fonts that work, none of them ours to recommend over the others: Noto Color
Emoji subset to the regional indicator range, Twemoji Country Flags, or any
flag-only webfont you already license.

## Reading input events

The part of this library that is about _browsers_ rather than about money. No
React, no currency, no formatting — just working out what a user did to a text
field, across desktop, iOS and Android, where the same gesture arrives under
different names or under no name at all.

`FinancialInput` is built on these, which is the only reason to trust them:
every quirk encoded here was found by a real device failing.

```ts
import { classifyInputType, describeEdit } from 'react-financial-input';
```

### From an event

```ts
const onInput = (event: InputEvent) => {
  const edit = describeEdit(previous, input.value, event);

  edit.kind; // 'insert' | 'insertBulk' | 'delete' | 'replace'
  // | 'compose' | 'history' | 'none' | 'unknown'
  edit.at; // where it happened
  edit.text; // what went in
  edit.removed; // what came out
};
```

**`insertText` does not mean "one character".** It is the one type that cannot
be decided from its name: a keystroke sends it with one character, and so does
the clipboard chip above an Android keyboard, carrying an entire string.
`classifyInputType('insertText')` therefore returns `null`, and `describeEdit`
settles it by length. Missing that is a real bug this library shipped.

```ts
classifyInputType('insertFromPaste'); // 'insertBulk'
classifyInputType('deleteWordBackward'); // 'delete'
classifyInputType('insertText'); // null — length decides
```

### From `onChange` alone

Most desktop code wires `onChange` and nothing else. Omit the event and
everything comes from the two strings:

```ts
describeEdit('1,000', '1,00'); // { kind: 'delete',     at: 4, removed: '0' }
describeEdit('12', '12345'); // { kind: 'insertBulk', at: 2, text: '345' }
describeEdit('1234', '1x4'); // { kind: 'replace',    at: 1, text: 'x' }
```

**`at` comes from the strings, never from `selectionStart`.** Android reports
`selectionStart` as 0 for a backspace at the end of the value, and honouring it
threw the caret to the front of the field on every delete.

What a diff cannot recover, and the event can:

|                         | from strings              | from the event |
| ----------------------- | ------------------------- | -------------- |
| position and text       | yes                       | yes            |
| paste vs. fast typing   | no — inferred from length | yes            |
| composition in progress | no                        | yes            |
| undo vs. retyping       | no                        | yes            |

Nothing here validates. It reports what happened; whether to allow it is yours
to decide.

A worked migration — a desktop `onKeyDown` guard rewritten to survive phones —
is in [EXAMPLES.md](EXAMPLES.md#making-a-desktop-input-work-on-every-device),
and the **Input events** story shows both readings of the same keystroke side
by side.

## The search component

There is a working combobox in the repository at
[`CurrencyCombobox.tsx`](lib/components/financialInput/CurrencyCombobox.tsx) —
the WAI-ARIA pattern, built from `searchCurrencies`, with filtering, arrow keys
and no dependency.

It is **deliberately not exported**. It is markup to copy and change, not API to
be held to: a picker is a design decision, and the component itself stays a bare
`<input>` that renders no picker at all. Copy the file, keep the parts you want.

The **With Currency Search** story is that file with the preset, the custom array
and the locale wired to Storybook controls, so you can try the combinations
before copying anything.

## Cost

None of this is bundled data. The component alone is about 4.1 kB gzipped;
adding the search, presets and flags takes it to roughly 4.6 kB, and it all
drops out again if unused.
