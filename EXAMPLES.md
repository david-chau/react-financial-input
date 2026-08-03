# Integration examples

A runnable version of the basics is in
[`examples/playground`](examples/playground) — or
**[open it in StackBlitz](https://stackblitz.com/github/david-chau/react-financial-input/tree/main/examples/playground)**,
which needs nothing installed.

Everything below assumes:

```tsx
import { FinancialInput, useFinancialInput } from 'react-financial-input';
```

## Next.js (App Router)

The component holds state, so it needs the client boundary. Nothing else
differs — there is no dynamic import and no `ssr: false` dance, because the
markup it renders is a plain `<input>` that server-renders fine.

```tsx
'use client';

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

No `name` here on purpose — see the server actions section below for why.

The built package carries a `'use client'` banner already, so importing it from
a server component gives you the usual "needs a client boundary" error rather
than a broken hydration.

### Server actions

> **Do not put `name` on the input itself.** A native form submits whatever is
> on screen, and what is on screen is the _display_ value — `"1,234.56"`, with
> grouping separators. `Number("1,234.56")` is `NaN`. This catches people out,
> so it is worth stating plainly: the formatted string is for the user, and the
> canonical one is for you.

Carry the canonical value in a hidden input, and give _that_ the name:

```tsx
'use client';

import { useState } from 'react';
import { FinancialInput } from 'react-financial-input';

export const AmountForm = ({
  action
}: {
  action: (data: FormData) => void;
}) => {
  const [amount, setAmount] = useState<string | null>(null);

  return (
    <form action={action}>
      <label htmlFor="amount">Amount</label>
      <FinancialInput
        id="amount"
        valueType="string"
        value={amount}
        onChange={setAmount}
      />
      {/* Canonical: no grouping, always a "." fraction, whatever the locale. */}
      <input type="hidden" name="amount" value={amount ?? ''} />
      <button type="submit">Save</button>
    </form>
  );
};
```

Now `Number(formData.get('amount'))` is safe on the server, in any locale.

If you would rather submit the display value and deal with it server-side,
`parseAmount` is the same function the input uses and runs perfectly well in a
server action:

```ts
import { parseAmount } from 'react-financial-input';

const amount = parseAmount(String(formData.get('amount'))); // number | null
```

## React Hook Form

`Controller`, because the value is not a plain DOM string. `field.onChange`
takes the number directly.

```tsx
import { Controller, useForm } from 'react-hook-form';
import { FinancialInput } from 'react-financial-input';

const { control, handleSubmit } = useForm<{ amount: number | null }>({
  defaultValues: { amount: null }
});

<Controller
  name="amount"
  control={control}
  rules={{ required: true, min: 1 }}
  render={({ field, fieldState }) => (
    <FinancialInput
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
      aria-invalid={fieldState.invalid || undefined}
    />
  )}
/>;
```

`ref` is forwarded, so RHF's `setFocus('amount')` works and the field is
focusable on a failed validation.

> If your resolver schema types the field as a string — Zod's `z.string()`, say —
> add `valueType="string"` and the two agree without a coercion step.

## Formik

```tsx
import { useField } from 'formik';
import { FinancialInput } from 'react-financial-input';

const AmountField = ({ name }: { name: string }) => {
  const [field, meta, helpers] = useField<number | null>(name);

  return (
    <FinancialInput
      value={field.value}
      onChange={helpers.setValue}
      onBlur={field.onBlur}
      name={name}
      aria-invalid={(meta.touched && !!meta.error) || undefined}
    />
  );
};
```

## Material UI

The hook exists for this. `getInputProps()` returns exactly what an `<input>`
wants, so it drops into `TextField` without a `customInput` prop or a wrapper
component:

```tsx
import { TextField } from '@mui/material';
import { useFinancialInput } from 'react-financial-input';

const { getInputProps, symbol } = useFinancialInput({
  value,
  onChange,
  options: { currency: 'USD' }
});

<TextField
  label="Amount"
  slotProps={{
    htmlInput: getInputProps(),
    input: { startAdornment: symbol }
  }}
/>;
```

The currency symbol is deliberately _not_ inside the input's value — it comes
back from the hook so you can render it as an adornment. Putting it in the value
would force the caret arithmetic to skip non-digits.

On MUI v5, `slotProps.htmlInput` is `inputProps` and `slotProps.input` is
`InputProps`.

## Chakra UI

```tsx
import { Input } from '@chakra-ui/react';
import { useFinancialInput } from 'react-financial-input';

const { getInputProps } = useFinancialInput({ value, onChange });

<Input {...getInputProps()} />;
```

## A plain form, no library

Same rule as server actions: the visible input holds the display value, so the
hidden one carries the name.

```tsx
const { getInputProps, canonicalValue } = useFinancialInput();

<form
  onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    data.get('amount'); // "1234.56" — canonical, from the hidden input
  }}
>
  <label htmlFor="amount">Amount</label>
  <input {...getInputProps({ id: 'amount' })} />
  <input type="hidden" name="amount" value={canonicalValue ?? ''} />
  <button type="submit">Save</button>
</form>;
```

Putting `name` on the visible input instead submits `"1,234.56"`, separators
and all — `Number()` of that is `NaN`. There is a test pinning exactly this, so
the behaviour cannot drift out from under the docs.

Not using a `<form>` at all? `canonicalValue` is right there; no `FormData`
needed.

## Tanstack Form

```tsx
<form.Field name="amount">
  {(field) => (
    <FinancialInput
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
    />
  )}
</form.Field>
```

## Testing it

`userEvent.type` drives it the way a person would, and the value on screen is
the formatted one:

```tsx
await userEvent.type(screen.getByRole('textbox'), '2.5m');
expect(screen.getByRole('textbox')).toHaveValue('2,500,000');
```

Query by `role="textbox"`, not `spinbutton` — `type` is always `text`, since
`type="number"` cannot hold a value containing grouping separators.
