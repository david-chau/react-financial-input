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

  return <FinancialInput value={amount} onChange={setAmount} name="amount" />;
};
```

The built package carries a `'use client'` banner already, so importing it from
a server component gives you the usual "needs a client boundary" error rather
than a broken hydration.

### Server actions

Server actions read `FormData`, which is strings — so let the input give you one
and skip the parse on the server:

```tsx
'use client';

<FinancialInput valueType="string" value={raw} onChange={setRaw} name="amount" />;
```

`onChange` hands back canonical text — `"1234.56"`, no grouping, always a `.`
fraction, whatever the user's locale — so `Number(formData.get('amount'))` is
safe on the other side.

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

The currency symbol is deliberately *not* inside the input's value — it comes
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

`getInputProps()` merges what you pass it, so `name` reaches the DOM and the
field shows up in `FormData`:

```tsx
const { getInputProps, canonicalValue } = useFinancialInput({
  valueType: 'string'
});

<form
  onSubmit={(event) => {
    event.preventDefault();
    // Or read canonicalValue directly — same string, no parsing.
    console.log(new FormData(event.currentTarget).get('amount'));
  }}
>
  <input {...getInputProps({ name: 'amount' })} />
</form>;
```

One caveat: the submitted string is the **display** value, grouping separators
and all, because that is what is on screen. `canonicalValue` from the hook is
the one to send.

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
