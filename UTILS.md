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
symbols. Two caveats — **Windows renders no flag emoji at all**, showing the two
letters instead, and codes with no country return `null`, so fall back to the
code.

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
