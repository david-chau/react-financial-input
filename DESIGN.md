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

The **Debug - Playground** and **Debug - Keyboard tester** stories report what a given
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

### The React floor is 18.0.0

`peerDependencies` is `>=18.0.0` rather than `^18 || ^19`, so a new major does
not produce a peer warning on a library that will almost certainly still work
with it. Nothing here reaches for a version-specific API: `useState`, `useRef`,
`useMemo`, `useEffect`, `useLayoutEffect`, `forwardRef` and the `react-jsx`
runtime all predate 18.

18.0 is the floor because of **`useId`**, which the combobox uses for its
listbox and which did not exist in 17.

CI runs the unit suite on `18.0.0` exactly as well as on the newest 18 and 19,
and typechecks on each. That third leg is not redundant: `@types/react@18.0`
has no `useRef<T>(undefined)` overload — React 19's types added it — so the
declared floor was broken while a matrix pinned to `react@18` stayed green,
because `18` resolves to the newest 18.x.

Anything above 19 is untested by definition. The range is a statement that no
API in use is expected to break, not that a future major has been verified.

## The state model

`value` is optional. Leave it off and the input manages its own state, telling
you about changes through `onChange`; pass it and the input follows the prop.

`null` means no value, in both directions: as the initial state, and as what
you receive for an empty input or a lone `.` part-way through typing. Never
`NaN`, never `undefined`.

### An echo is not an external change

The obvious controlled implementation — reformat whenever `value` changes —
destroys text mid-edit. A parent that stores what `onChange` gave it and hands
it straight back would collapse `1.` to `1` and `1.50` to `1.5` on the very
next render, because those strings and their numbers are not in bijection.

So the sync is guarded twice. The prop must actually have changed since the
last render, and it must differ from the value the input has already committed.
An echo satisfies neither, so what is being typed survives.

It is adjusted during render rather than in an effect. An effect would render
once with the stale value and again to correct it, and it trips
`react-hooks/set-state-in-effect`. [React documents deriving state from a
changed prop this way.](https://react.dev/reference/react/useState#storing-information-from-previous-renders)

### Two forms, one of them yours

`valueType` picks which one crosses the boundary:

|                  | `'number'` (default) | `'string'`                    |
| ---------------- | -------------------- | ----------------------------- |
| `value` accepts  | `number \| null`     | canonical, display, or `2.5m` |
| `onChange` gives | `number \| null`     | canonical text                |
| Fires when       | the number changes   | the canonical string changes  |

That last row is the subtle one. Typing the trailing zero of `1.50` leaves the
number at `1.5`, so number mode stays quiet — correctly, nothing about the
number changed. A string consumer still needs telling, so string mode compares
canonical instead.

Canonical is taken from the display string rather than rebuilt from the number,
which is what lets `1.50` and a mid-edit `1.` survive at all.

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
| Tap the clipboard chip | `insertText` with the whole string in `data`             | sanitised as a paste — see below                        |
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

> The **Debug - Playground** story logs all of this live. Open it on a device,
> perform the gesture, and read off what actually fired. That is the fastest way
> to find out what a particular keyboard app really does.

## Using it without React

The public surface — `parseAmount`, `formatNumber`, the currency lists and the
flags — is documented in **[UTILS.md](UTILS.md)**.

Beyond that, everything the library is built from is exported: `shiftDecimal`
for exact powers-of-ten multiplication, `toCanonical` and `formatCanonical` for
the two-form conversion, and the reducer itself. The reducer is pure, so it can
be driven from a test or another framework without a DOM.

### `insertText` does not mean "one character"

It mostly does, and treating it that way is why the clipboard chip above an
Android keyboard did nothing for a while.

SwiftKey and Samsung both offer the clipboard as a tappable chip in the
suggestion strip. Tapping it emits `insertText` with the entire string in
`data` — not `insertFromPaste`, which is what `Ctrl`+`V` and the long-press
Paste menu send. So the string went down the keystroke path, where it was
validated as though someone had typed a single character, and `$` and `(` are
not valid characters. The paste was refused and nothing appeared.

Two things made it hard to see. Every other paste gesture on the same device
worked, so it read as a device problem rather than a routing one; and iOS does
not offer the chip at all, so it could not be reproduced there.

The rule now: **one character is a keystroke, more than one arrived in bulk.**
Anything longer is sanitised rather than validated, exactly as a paste is. The
suggestion strip inserts whole words the same way, and those sanitise to
nothing and are refused, which is also what should happen.

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

### The value is right-aligned

Amounts line up on the decimal point when they are right-aligned, which is how
every ledger, statement and spreadsheet sets them, and it puts the caret where
the next digit is going to land. So the stylesheet does that by default:

```css
.rfi-input {
  text-align: var(--rfi-text-align);
}
:root {
  --rfi-text-align: right;
}
```

Set `--rfi-text-align: left` to opt out. This lives in the stylesheet rather
than in the component, because tier 1 is a genuinely bare `<input>` — a
component that emitted its own inline `text-align` would not be unstyled, and
would quietly override a consumer's own design system.

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

## Off-by-default extras

The component renders a bare `<input>` and nothing else. Everything below is
markup you supply, with the hook providing the behaviour — the same arrangement
as the floating label. That is what keeps the default surface small.

### Clear button

```tsx
const { getInputProps, clear, numericValue } = useFinancialInput();

<div className="rfi-field">
  <input {...getInputProps()} />
  {numericValue !== null && (
    <button className="rfi-clear" onClick={clear} aria-label="Clear">
      ×
    </button>
  )}
</div>;
```

`clear()` goes through the history, so Ctrl+Z puts back what was cleared — which
is what makes the button safe to offer at all. The stylesheet moves a suffix
currency symbol inboard when a clear button is present, and derives every inset
from the button's own size so the gaps hold if you change it.

### Currency picker

`listCurrencies(locale, codes?)` enumerates what the runtime knows from
`Intl.supportedValuesOf`, so there is no bundled table to go stale.

`toFlagEmoji(code)` costs nothing either: an ISO 4217 code is the ISO 3166
country code plus a letter, and a flag emoji is that country code written in
regional indicator symbols — no image assets. Two caveats. **Windows renders no
flag emoji at all**, showing the two letters instead. And codes with no country
return `null` (`XAU` is gold), so you can fall back to the code.

`.rfi-group` joins the combobox to the input so the two read as one control; the
list shows a flag and code, since the symbol already appears in the field.

**Search, not a dropdown.** There was briefly both: a native `<select>` for a
handful of currencies and a combobox for the rest. Supporting two pickers cost
more than it returned, and the `<select>` was the weaker one — it stops being
usable somewhere past a couple of dozen options, and `'all'` is 162. Only the
combobox remains, and `.rfi-select` went with the story that used it.

The presets and the cost are in **[UTILS.md](UTILS.md)**.

Changing the selection re-resolves the symbol, its side **and** the separators,
and reformats what is on screen. That last part was a bug — the value kept the
previous locale's punctuation until the next keystroke. The conversion goes
through canonical rather than rebuilding from the numeric value, so a value
still being typed keeps its shape: `1.` becomes `1,` rather than collapsing.

### Multiplier keypad

Every mobile numeric keypad omits letter keys, so if you opt into
`options.inputMode: 'decimal'` the shortcuts become untypeable. `applyShortcut`
puts them back as tap targets, and `.rfi-keypad` / `.rfi-key` style them as flat
calculator keys that stretch to the field's width. The multiplier lives in a
`title` tooltip rather than printed on every key.

### Refused keystrokes

A refusal is otherwise silent — the value simply does not change, which reads as
a dead input. The component adds `.rfi-input--rejected` for the duration of the
animation; `options.flashOnError: false` turns it off.

**Colour only by default. Motion is opt-in**, because some people find a shaking
field unpleasant and colour already says "refused":

```tsx
<FinancialInput />                              {/* flash */}
<FinancialInput className="rfi-input--shake" /> {/* flash and shake */}
```

`prefers-reduced-motion` drops the shake and keeps the flash. The flash
keyframes declare `from` and nothing else, so the browser animates back to
whatever the element's real style is — which fades out correctly on every
variant, focused or not, without hard-coding the resting colours.

## What 1.0.0 promises

A version number is a promise about change, so it is worth saying which one.

**The exported names are the contract.** Every entry point lists its exports by
hand, and a test asserts each list exactly — `index.test.ts` and
`entryPoints.test.ts`. Removing or renaming any of them is a major version.
That list is deliberately short: the package exported 66 names by accident
before 1.0.0, through four `export *` lines, and shipping that would have
frozen reducer internals and a cache-clearing test seam as public API forever.

**What is not exported may change in a patch.** The reducer, the validation
helpers, the caret arithmetic — all internal. If you need one of them, ask for
it rather than reaching into `dist/`; a name that is asked for can be exported
on purpose.

**The CSS class names are part of the contract too**, because the stylesheet is
opt-in and people build on the markup. `rfi-input`, `rfi-field`, `rfi-label`,
`rfi-adornment`, `rfi-flag` and the rest behave like exports.

**Behaviour that is documented here is behaviour you can rely on.** The
canonical-versus-display split, `null` never being `NaN`, the caret rules, the
grouping following the locale. Where a platform forced an unusual decision it is
written down with the reason, so it does not look like something safe to
"clean up" later.

**What is not promised** is in [Limits](#limits) below: numbers above 2^53,
digit glyphs outside ASCII, and the support-matrix rows nobody has hardware to
verify. Those are stated rather than implied.

## Limits

What this library does not do, stated plainly, because finding out later is
worse than reading it here.

### Numbers above 2^53

Values are carried as JavaScript `number`, so anything past
`Number.MAX_SAFE_INTEGER` — 9,007,199,254,740,991 — loses precision. That is
about nine quadrillion, so it is unreachable for most money, but it is a real
ceiling and this is a financial library.

`valueType: 'string'` gets you the canonical text rather than a number, which
preserves what was typed — including the trailing zero in `1.50`, which a
number cannot hold. But the arithmetic behind the multiplier shortcuts still
goes through a `number`, so `9007199254740991k` is not exact. Fixing that
properly means the reducer holding a decimal string end to end.

If you are handling amounts near that bound, `parseAmount` returning a number
is the wrong tool, and so is this input.

### Devices nobody has tested

The support matrix marks rows 🚧 where they are not verified, and there are six
of them. That is not modesty; it is that the verification does not exist:

- **Real-device CI (L4)** needs a device farm. Everything currently runs on
  emulated viewports or GitHub's runners, and a `devices['Pixel 7']` descriptor
  emulates viewport, touch and user agent — not a soft keyboard, and not an IME.
- **IME on Firefox and WebKit** has no equivalent of Chromium's
  `Input.imeSetComposition`, so composition cannot be driven there at all.

Several bugs in this library were found only because someone typed into a real
phone. It follows that more are waiting on devices nobody has held.

### Digits are always ASCII

`Intl` renders numbers in a locale's own script — `ne-NP` gives `१,२३,४५,६७,८९०`
and `bn-IN` gives Bengali digits. The value here is always `0`–`9`, whatever
the locale, because the value is a number a form will submit and a backend will
parse.

Grouping _is_ locale-correct, including the Indian lakh/crore system, so
`en-IN` gives `1,23,45,67,890`. Only the digit glyphs differ from what `Intl`
would print.

### One flat reserve in the stylesheet

The space kept clear for a suffix currency symbol is a fixed `3.5rem`, sized for
the widest common symbol. CSS cannot measure text, so a symbol past about four
characters will still collide; `--rfi-adornment-space` is the way out.

## Roadmap

1. Real-device CI (L4) — the only remaining gap in the support matrix
2. IME composition verified on Firefox and WebKit, which have no CDP equivalent
3. Values above 2^53. `valueType: 'string'` carries the canonical text, so the
   trailing zero in `1.50` now survives, but the arithmetic behind the shortcut
   multipliers still goes through a `number`. Fixing that means the reducer
   holding a decimal string end to end.
