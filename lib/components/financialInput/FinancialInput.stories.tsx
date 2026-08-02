import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Nullable } from '../../types';
import { FinancialInput, FinancialInputProps } from './FinancialInput';
import { useFinancialInput } from './useFinancialInput';

/*
    The floating-label stories wrap the input, so their args are wider than the
    component's own props. Typing the meta on this rather than on
    `typeof FinancialInput` is what lets `label` and `helper` be args.
 */
type FieldArgs = FinancialInputProps & {
  label?: string;
  helper?: string;
  error?: boolean;
};

const meta: Meta<FieldArgs> = {
  title: 'FinancialInput',
  component: FinancialInput,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onChange: fn(), onError: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 260, padding: '1.5rem 0' }}>
        <Story />
      </div>
    )
  ]
};

export default meta;

type Story = StoryObj<FieldArgs>;

/*
    The floating label needs a wrapper the consumer supplies, since the
    component itself renders a bare <input>. It is pure CSS — the label position
    comes from :focus-within and :placeholder-shown, which is why the input
    carries placeholder=" ".
 */
const Field = ({ label, helper, error, ...props }: FieldArgs) => {
  const id = useId();

  return (
    <div>
      <div className="rfi-field">
        <FinancialInput
          {...props}
          id={id}
          placeholder=" "
          aria-invalid={error || undefined}
        />
        <label className="rfi-label" htmlFor={id}>
          {label}
        </label>
      </div>
      {helper && (
        <p className={`rfi-helper${error ? ' rfi-helper--error' : ''}`}>
          {helper}
        </p>
      )}
    </div>
  );
};

export const Default: Story = {
  args: { placeholder: '' }
};

export const WithValue: Story = {
  args: { value: 1234567.89 }
};

/** Outlined is the default, matching Material UI's TextField. */
export const WithFloatingLabel: Story = {
  args: { label: 'Amount', helper: 'Try 1234567, or 2.5m' },
  render: (args) => <Field {...args} />
};

/*
    Every variant on one page. The stylesheet is opt-in and modelled on Material
    UI's TextField, so these are the same three names.
 */
export const Variants: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: 280 }}>
      <Field {...args} label="Outlined (default)" />
      <Field {...args} label="Filled" className="rfi-input--filled" />
      <Field {...args} label="Standard" className="rfi-input--standard" />
      <Field {...args} label="Small" className="rfi-input--small" />
      <div
        className="rfi-dark"
        style={{ background: '#121212', padding: '1.5rem', borderRadius: 8 }}
      >
        <Field {...args} label="Dark (opt-in)" />
      </div>
      <div>
        <style>{'.rfi-unstyled { all: revert; }'}</style>
        <FinancialInput
          {...args}
          className="rfi-unstyled"
          placeholder="Unstyled"
        />
        <p className="rfi-helper">No stylesheet at all — the default</p>
      </div>
    </div>
  )
};

export const Controlled: Story = {
  args: { value: 1000 },
  render: function Controlled(args) {
    const [value, setValue] = useState<Nullable<number>>(args.value ?? null);

    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <FinancialInput
          {...args}
          value={value}
          onChange={(next) => {
            args.onChange?.(next);
            setValue(next);
          }}
        />
        <small style={{ fontFamily: 'monospace', opacity: 0.7 }}>
          onChange: {value === null ? 'null' : value}
        </small>
      </div>
    );
  }
};

/** Type `1k`, `2.5m` or `3b` — the multiplier expands on the keystroke. */
export const Shortcuts: Story = {
  args: { label: 'Amount', helper: 'h ×100 · k ×1,000 · m ×1M · b ×1B' },
  render: (args) => <Field {...args} />
};

/*
    The mobile answer to shortcuts.

    Every mobile numeric keypad omits letter keys, so if you opt into
    `options.inputMode: 'decimal'` for the keypad, h/k/m/b become untypeable.
    `applyShortcut` applies a multiplier as if it had been typed, so a row of tap
    targets restores them. The buttons are yours to render and style.
 */
export const ShortcutButtons: Story = {
  args: { options: { inputMode: 'decimal' } },
  render: function ShortcutButtons(args) {
    const { getInputProps, applyShortcut, numericValue } = useFinancialInput({
      options: args.options,
      onChange: args.onChange,
      onError: args.onError
    });

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <input {...getInputProps({ placeholder: '0.00' })} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['h', 'k', 'm', 'b'].map((character) => (
            <button
              key={character}
              type="button"
              onClick={() => applyShortcut(character)}
              style={{
                flex: 1,
                padding: '0.6rem 0',
                border: '1px solid rgba(0,0,0,0.23)',
                borderRadius: 4,
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer'
              }}
            >
              {character.toUpperCase()}
            </button>
          ))}
        </div>
        <small style={{ fontFamily: 'monospace', opacity: 0.7 }}>
          value: {numericValue === null ? 'null' : numericValue}
        </small>
      </div>
    );
  }
};

/*
    Currency and locale.

    The symbol and which side it belongs on come from Intl, so every ISO 4217
    code works and suffix currencies ("1 000 kr" in sv-SE) are right without a
    symbol table. `locale` also supplies the separators, so de-DE gets
    1.234,56 without configuring anything else.

    The symbol is deliberately not inside the input's value — the hook returns
    it and you render it, which keeps the caret arithmetic working on digits
    alone.
 */
export const WithCurrency: Story = {
  render: function WithCurrency() {
    const rows: { locale: string; currency: string; label: string }[] = [
      { locale: 'en-US', currency: 'USD', label: 'United States' },
      { locale: 'en-GB', currency: 'GBP', label: 'United Kingdom' },
      { locale: 'de-DE', currency: 'EUR', label: 'Germany' },
      { locale: 'sv-SE', currency: 'SEK', label: 'Sweden' },
      { locale: 'ja-JP', currency: 'JPY', label: 'Japan' }
    ];

    return (
      <div style={{ display: 'grid', gap: '1.5rem', width: 260 }}>
        {rows.map((row) => (
          <CurrencyField key={row.currency} {...row} />
        ))}
      </div>
    );
  }
};

const CurrencyField = ({
  locale,
  currency,
  label
}: {
  locale: string;
  currency: string;
  label: string;
}) => {
  const id = useId();
  const { getInputProps, symbol, symbolPosition, numericValue } =
    useFinancialInput({
      options: { locale, currency, scale: currency === 'JPY' ? 0 : 2 }
    });

  return (
    <div>
      <div className="rfi-field">
        <input {...getInputProps({ id, placeholder: ' ' })} />
        <label className="rfi-label" htmlFor={id}>
          {label}
        </label>
        <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
          {symbol}
        </span>
      </div>
      <p className="rfi-helper">
        {currency} · {locale} · {symbolPosition} ·{' '}
        {numericValue === null ? 'null' : numericValue}
      </p>
    </div>
  );
};

/** `scale: 0` refuses the decimal point entirely. */
export const WholeNumbersOnly: Story = {
  args: { options: { scale: 0 }, placeholder: 'no decimals' }
};

export const FourDecimalPlaces: Story = {
  args: { options: { scale: 4 }, placeholder: '0.0000' }
};

export const LimitedToSixDigits: Story = {
  args: { options: { maxDigits: 6 }, placeholder: 'max 999,999' }
};

export const Disabled: Story = {
  args: { value: 1000, disabled: true }
};

/** The error state is the consumer's to render — `onError` just reports it. */
export const WithErrorState: Story = {
  render: function WithErrorState(args) {
    const [hasError, setHasError] = useState(false);

    return (
      <Field
        {...args}
        label="Amount"
        error={hasError}
        helper={
          hasError ? 'That character is not allowed here' : 'Two decimal places'
        }
        onError={() => {
          args.onError?.();
          setHasError(true);
        }}
        onChange={(next: Nullable<number>) => {
          args.onChange?.(next);
          setHasError(false);
        }}
      />
    );
  }
};

/*
    A refused keystroke flashes colour by default — a silent refusal reads as a
    dead input. Motion is opt-in via `rfi-input--shake`, because some people
    find it unpleasant; it is suppressed under prefers-reduced-motion either
    way.

    Type a third decimal place into either field.
 */
export const ErrorFeedback: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: 280 }}>
      <Field {...args} label="Flash only (default)" helper="Try 1.234" />
      <Field
        {...args}
        label="Flash and shake"
        helper="Add rfi-input--shake"
        className="rfi-input--shake"
      />
      <Field
        {...args}
        label="No feedback"
        helper="options.flashOnError: false"
        options={{ flashOnError: false }}
      />
    </div>
  )
};

export const MobileViewport: Story = {
  args: { placeholder: '0.00' },
  globals: { viewport: { value: 'mobile2', isRotated: false } }
};
