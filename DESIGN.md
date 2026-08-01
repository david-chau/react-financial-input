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

The `KeyboardDiagnostics` and `Keyboard tester` stories report what a given
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

✅ shipped and tested — 🚧 not implemented; the input keeps its previous value
rather than corrupting it — ⚠️ see [keyboards that ignore
`inputmode`](#keyboards-that-ignore-inputmode).

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

## Roadmap

1. Paste, drop, cut and forward-delete
2. Android `insertCompositionText` handling
3. Controlled-mode sync when the `value` prop changes externally
4. `groupSeparator` / `decimalSeparator` props, for `1.000,50`
5. Opt-in currency symbol via `Intl`, overridable with a prop
6. Configurable shortcuts and a positive-only range
7. Real-device CI
