# Design notes

Why this library behaves the way it does. For the quick start, see the
[README](README.md); for architecture rules and how to contribute, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Why the keyboard defaults to `text` on mobile

**Every mobile numeric keypad omits letter keys.** The digits on iOS's decimal
pad have `ABC`/`DEF` printed under them, but those are cosmetic — you cannot
enter a letter from that keypad.

So `inputmode="decimal"` would make `h`/`k`/`m`/`b` physically unreachable on a
phone. The multiplier shortcuts are the reason to reach for this component over a
formatted `<input>`, and losing them on mobile would leave an ordinary number
input on exactly the devices the library exists for.

Hence `options.inputMode` defaults to `'text'`. The numeric keypad is opt-in:

```tsx
<FinancialInput options={{ inputMode: 'decimal' }} />
```

If you opt in, use `applyShortcut` to keep the multipliers reachable by tap:

```tsx
const { getInputProps, applyShortcut } = useFinancialInput({
  options: { inputMode: 'decimal' }
});

return (
  <>
    <input {...getInputProps()} />
    {['h', 'k', 'm', 'b'].map((c) => (
      <button key={c} onClick={() => applyShortcut(c)}>
        {c.toUpperCase()}
      </button>
    ))}
  </>
);
```

`applyShortcut` produces exactly what typing the letter would. See the
`ShortcutButtons` story.

### Why `type` is never `number`

`type="number"` refuses to hold a value containing grouping separators, so
`1,234` would be rejected by the browser and the formatting could not exist.
`type` is always `text`; `inputmode` is what asks for a particular keyboard.

### Keyboards that ignore `inputmode`

`inputmode` is the correct, spec-compliant way to request a keyboard, and Gboard
and iOS Safari both honour it. **Some Android keyboards — Samsung's in
particular — ignore it and key off `type` alone.** There is no workaround that
preserves formatting, since `type` cannot change.

The **Debug (Playground)** and **Keyboard tester** stories report what a given
device actually resolves, which separates a library bug from a keyboard that
does not implement the attribute.

## Why there are no dependencies

The only thing that needed a library was exact multiplication. Every shortcut
multiplier is a power of ten, so the decimal point can be shifted through the
string instead:

```
shiftDecimal('4.35', 2) === '435'      // exact
4.35 * 100              === 434.99999999999994
```

That is ten lines, and it replaced `bignumber.js` — which the old code used for a
single multiply before immediately calling `.toNumber()` and discarding the
precision it had paid for.

## How input is handled

Browsers describe an edit through `InputEvent.inputType`: `insertText`,
`deleteContentBackward`, `insertFromPaste`, `insertCompositionText`, and so on.
Guessing from key codes instead is what breaks on soft keyboards, where there may
be no key code at all.

All of it lives in a pure reducer, `(state, action) => state`. That means each
platform quirk is a row in a test table rather than a branch buried in a
component, and it is why the component file is a single line of JSX.

Unhandled input types are _ignored_ rather than rejected: the previous value is
kept and `onError` stays quiet, because the user did nothing wrong.

## Input event cheatsheet

Every gesture a user can perform produces a different `InputEvent.inputType`,
and which one you get varies by platform, browser and keyboard app. This is the
full set the reducer handles, and what it does with each.

| Action                 | `inputType`                                              | Handling                                                |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Type a digit           | `insertText`                                             | validated, then formatted                               |
| Type `h`/`k`/`m`/`b`   | `insertText`                                             | multiplier applied by decimal shift                     |
| Backspace              | `deleteContentBackward`                                  | reformatted; a separator only moves the caret           |
| Delete forward         | `deleteContentForward`                                   | reformatted                                             |
| Cut                    | `deleteByCut`                                            | reformatted                                             |
| Drag text out          | `deleteByDrag`                                           | reformatted                                             |
| Word / line delete     | `deleteWord*`, `deleteSoftLine*`, `deleteEntireSoftLine` | reformatted                                             |
| Paste                  | `insertFromPaste`                                        | **sanitised**, then validated                           |
| Drag text in           | `insertFromDrop`                                         | **sanitised**, then validated                           |
| Autocorrect, QuickType | `insertReplacementText`                                  | **sanitised**, then validated                           |
| Android soft keyboard  | `insertCompositionText`                                  | held raw while composing, committed on `compositionend` |
| Undo / redo            | `historyUndo`, `historyRedo`                             | **ignored on purpose**                                  |
| Anything else          | —                                                        | ignored, value kept, `onError` stays quiet              |

Three behaviours are worth spelling out.

**Sanitised, not refused.** Pasted text never passed through keystroke
validation, so refusing anything imperfect would reject values users plainly
meant to enter. Everything that is not a digit or the fraction separator is
stripped, which takes currency symbols, spaces, letters and grouping separators
with it:

| Pasted          | Result                            |
| --------------- | --------------------------------- |
| `1,234.56`      | `1,234.56`                        |
| `$1,234.56 USD` | `1,234.56`                        |
| `(1,234.00)`    | `-1,234.00` — accounting negative |
| `2.5m`          | `2,500,000` — trailing shortcut   |
| `1 234 567`     | `1,234,567`                       |
| `not a number`  | refused, previous value kept      |
| `1.2.3`         | refused — two fraction separators |

**Two things only real hardware showed.** Both passed every emulated test.

Android reports `selectionStart: 0` for a backspace at the end of the value.
Honouring it threw the caret to the front on every delete — `1,000|` became
`|100`. The deletion point now comes from comparing the value before and after,
which no platform can misreport.

Samsung's keyboard composes the whole word and does not fire `compositionend`
until the field loses focus, so `2k` sat on screen while every other platform
had already shown `2,000`. A finished shortcut token — digits then a shortcut
letter — now commits on sight, because it needs no further input to interpret.

Recorded traces for both live in the reducer's table.

**Composition is held, not formatted.** Android emits
`insertCompositionText` for every keystroke of a word still being composed, with
`data` that cannot be trusted until it settles. Reformatting mid-composition
makes the keyboard fight the input, so the raw text is shown as-is and no
numeric value is committed until `compositionend`. A refused commit rebuilds
from the last committed value rather than leaving the IME's raw text on screen.

**Undo is the component's own.** The browser's stack holds its own edits — the
unformatted text it inserted — not the reformatted value React rendered, so
replaying it would restore something the user never saw. Instead every accepted
edit pushes a snapshot, and a fresh edit clears the redo stack.

It is driven from the **keystroke**, not the `historyUndo` input type. The
browser only emits `historyUndo` while its own stack has entries, and that stack
is exhausted the moment React overwrites the value — so the first Ctrl+Z arrives
and the second never does. Intercepting the key is the only way repeated undo
works. Verified on Chromium, Firefox and WebKit.

One step per accepted edit, so a paste or a shortcut expansion undoes in one.

> The **Debug (Playground)** story logs all of this live. Open it on a device,
> perform the gesture, and read off what actually fired. That is the fastest way
> to find out what a particular keyboard app really does.

## Using it without React

`parseAmount(text, separators?, shortcuts?)` runs the same sanitising a paste
gets and returns a number or `null`, and `formatNumber(value, separators?)` goes
the other way. Neither imports React, so both work on a server.

Everything else the library is built from is exported too — `shiftDecimal` for
exact powers-of-ten multiplication, `toCanonical` and `formatCanonical` for the
two-form conversion, `listCurrencies` and `toFlagEmoji` for currency data, and
the reducer itself. The reducer is pure, so it can be driven from a test or
another framework without a DOM.

## Verification layers

Coverage lives in L1. The browser layers confirm reality still matches it.

| Layer  | What it is                                            | What it proves                                |
| ------ | ----------------------------------------------------- | --------------------------------------------- |
| **L1** | `it.each` tables over the pure reducer                | Every `inputType` sequence, deterministically |
| **L2** | Playwright on a Windows / macOS / Linux runner matrix | Real OS key handling, real browser engines    |
| **L3** | Playwright + CDP `Input.imeSetComposition`            | Genuine composition events, without a device  |
| **L4** | Real devices (BrowserStack)                           | Real iOS Safari and real Android Gboard       |

| Capability                             | Chrome | Firefox | Safari | Android | iOS | Verified by                               |
| -------------------------------------- | ------ | ------- | ------ | ------- | --- | ----------------------------------------- |
| Type digits, group as you type         | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| `h`/`k`/`m`/`b` shortcuts              | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Backspace, including across separators | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Refuse over-scale / over-digit input   | ✅     | ✅      | ✅     | ✅      | ✅  | L1, L2                                    |
| Select-all then overtype               | ✅     | ✅      | ✅     | ✅      | ✅  | L2                                        |
| Optional numeric keypad (`inputMode`)  | —      | —       | —      | ⚠️      | ✅  | L2                                        |
| Paste                                  | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet parsed           |
| Drag and drop                          | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet parsed           |
| Cut, forward delete                    | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | value preserved, not yet applied          |
| IME composition                        | 🚧     | 🚧      | 🚧     | 🚧      | 🚧  | L3 harness in place, reducer case pending |

✅ shipped and tested — 🚧 not verified on that platform — ⚠️ see [keyboards
that ignore `inputmode`](#keyboards-that-ignore-inputmode).

The IME row is honest about its limits: composition is implemented and driven
for real through CDP, but CDP is Chromium-only, so Firefox and WebKit are
covered by the unit tables alone, and real Android and iOS need L4.

**Honest caveat.** The Android and iOS columns are Playwright device emulation:
viewport, touch and user agent. They are _not_ a real soft keyboard or IME.
`devices['Pixel 7']` is desktop Chromium with a phone-sized window. Real-device
verification (L4) is not wired up yet, which is exactly why the composition row
is 🚧.

## Styling

Four tiers, and nothing is loaded unless asked for:

1. Unstyled — a bare `<input>`, no CSS at all
2. Your own classes via `className`
3. `import 'react-financial-input/styles.css'`
4. Your own component entirely, via the headless hook

The stylesheet is a separate subpath export, and nothing in the built JavaScript
references it — CI fails the build if that ever changes. This is also why
`vite-plugin-lib-inject-css` is not used: its job is to inject CSS imports into
the bundle, which would defeat the whole arrangement.

`sideEffects` is `["**/*.css"]` rather than `false`, because a bare
`import '.../styles.css'` has no used exports and bundlers would tree-shake it
away, making the styles vanish in consumer production builds.

### Variants

The stylesheet is modelled on Material UI's TextField, hand-written, with no MUI
dependency:

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

### Dark mode is opt-in

Put `rfi-dark` (or `data-rfi-theme="dark"`) on the input or any ancestor:

```tsx
<div className="rfi-dark">
  <FinancialInput />
</div>
```

It is **not** wired to `prefers-color-scheme`, and that is deliberate. An earlier
version was, and it broke: the outlined variant is transparent by design, so it
inherits the host page's background. A user whose OS was dark but whose page was
still white got white text and a white border on white — the input disappeared
entirely. The stylesheet cannot know what surface it has been dropped onto; the
host app can.

If you do want it to follow the OS, opt in from your own stylesheet, where you
control the page background too:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --rfi-color: #fff;
    --rfi-border-color: rgba(255, 255, 255, 0.23);
    --rfi-surface: #121212;
  }
}
```

### Floating label

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

## Currency

`options.currency` takes an ISO 4217 code; `options.locale` a BCP 47 tag. The
symbol and the side it belongs on come from `Intl.NumberFormat.formatToParts`,
so every code works and suffix currencies are right without a symbol table —
`$1,000` in en-US, `1.000 €` in de-DE, `1 000 kr` in sv-SE. `options.symbol` and
`options.symbolPosition` override what Intl resolved.

**The symbol is not put inside the input's value.** The hook returns it and you
render it next to the input:

```tsx
const { getInputProps, symbol, symbolPosition } = useFinancialInput({
  options: { locale: 'sv-SE', currency: 'SEK' }
});

<div className="rfi-field">
  <input {...getInputProps()} />
  <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
    {symbol}
  </span>
</div>;
```

Injecting it into the value would mean the caret arithmetic had to skip over
non-digit characters, and every validation path had to strip them back off.
Keeping it out means both keep working on digits alone — and rendering it is a
`<span>` in the wrapper the floating label already needs.

`locale` also supplies the separators, so `locale: 'de-DE'` gives `1.234,56`
with nothing else configured. Explicit `groupSeparator` / `decimalSeparator`
win over it.

> Several locales group with **non-ASCII whitespace**: sv-SE and nb-NO use
> U+00A0, fr-FR uses U+202F. It is invisible in a diff, so a test comparing a
> formatted value against a literal `" "` will fail confusingly. The library
> treats the separator as an opaque string, so it works either way.

## Roadmap

1. Real-device CI (L4) — the only remaining gap in the support matrix
2. IME composition verified on Firefox and WebKit, which have no CDP equivalent
3. A string-valued API, for trailing zeros (`1.50`) and values above 2^53
