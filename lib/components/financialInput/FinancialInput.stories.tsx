import { useId, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Nullable } from '../../types';
import { FinancialInput, FinancialInputProps } from './FinancialInput';
import { listCurrencies, toFlagEmoji } from '../../utils';
import { useFinancialInput } from './useFinancialInput';
import { EventTesterPanel } from './EventTesterPanel';
import { KeyboardTesterPanel } from './KeyboardTesterPanel';
import { CurrencyCombobox } from './CurrencyCombobox';

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
  /*
      The full-width panels opt out of the shared frame. A meta decorator wraps
      outside a story's own, so without this the 260px box squeezed them to a
      column against the left edge.
   */
  decorators: [
    (Story, context) =>
      context.parameters.layout === 'fullscreen' ? (
        <Story />
      ) : (
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

/*
    One sidebar entry rather than a folder: Storybook reads "/" in a title as a
    nesting separator, so "Debug / Playground" would have made a folder.
 */
export const DebugPlayground: Story = {
  name: 'Debug (Playground)',
  parameters: { layout: 'fullscreen' },
  render: () => <EventTesterPanel />
};

export const KeyboardTester: Story = {
  name: 'Keyboard tester',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' }
  },
  render: () => <KeyboardTesterPanel />
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
  // Wider than the shared decorator, so the four keys sit on one row.
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    )
  ],
  render: function ShortcutButtons(args) {
    const { getInputProps, applyShortcut, numericValue } = useFinancialInput({
      options: args.options,
      onChange: args.onChange,
      onError: args.onError
    });

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <input {...getInputProps({ placeholder: '0.00' })} />
        <div className="rfi-keypad">
          {[
            ['h', 'Multiply by 100'],
            ['k', 'Multiply by 1,000'],
            ['m', 'Multiply by 1 million'],
            ['b', 'Multiply by 1 billion']
          ].map(([character, description]) => (
            <button
              key={character}
              type="button"
              className="rfi-key"
              title={description}
              aria-label={description}
              onClick={() => applyShortcut(character)}
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
    Each currency is paired with the locale that actually uses it. Both the
    symbol and which side it belongs on are properties of the locale, not the
    currency: SEK is "kr" trailing in sv-SE but "SEK" leading in en-US.
 */
const PICKER_LOCALES: Record<string, string> = {
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  JPY: 'ja-JP',
  SEK: 'sv-SE',
  INR: 'en-IN'
};

/*
    A currency picker is off by default — the component never renders one.
    `listCurrencies()` enumerates what the runtime knows from Intl, so there is
    no bundled table to go stale, and changing the selection re-resolves both
    the symbol and its side.
 */
/*
    Search rather than a dropdown, which is what 'all' (162 currencies) needs.
    Defaults to the g10 shortlist; pass 'g7', 'all', or your own array.
 */
export const WithCurrencySearch: Story = {
  render: function WithCurrencySearch(args) {
    const id = useId();
    const [currency, setCurrency] = useState('USD');
    const { getInputProps, symbol, symbolPosition, numericValue } =
      useFinancialInput({
        onChange: args.onChange,
        options: { currency, scale: currency === 'JPY' ? 0 : 2 }
      });

    return (
      <div style={{ width: 340 }}>
        <div className="rfi-group">
          <CurrencyCombobox value={currency} onChange={setCurrency} />
          <div className="rfi-field">
            <input {...getInputProps({ id, placeholder: ' ' })} />
            <label className="rfi-label" htmlFor={id}>
              Amount
            </label>
            <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
              {symbol}
            </span>
          </div>
        </div>
        <p className="rfi-helper">
          g10 by default · type to search · {symbol} ·{' '}
          {numericValue === null ? 'null' : numericValue}
        </p>
        <p className="rfi-helper">
          No locale is set here, so symbols resolve in the app&rsquo;s own
          locale — SEK reads &ldquo;SEK&rdquo; in en-US and &ldquo;kr&rdquo; in
          sv-SE. Pass <code>locale</code> to change that.
        </p>
      </div>
    );
  }
};

export const WithCurrencyPicker: Story = {
  render: function WithCurrencyPicker(args) {
    const id = useId();
    const [currency, setCurrency] = useState('USD');

    const locale = PICKER_LOCALES[currency];

    const options = useMemo(
      () =>
        Object.keys(PICKER_LOCALES).map(
          (code) => listCurrencies(PICKER_LOCALES[code], [code])[0]
        ),
      []
    );

    const { getInputProps, symbol, symbolPosition, numericValue } =
      useFinancialInput({
        onChange: args.onChange,
        options: { currency, locale, scale: currency === 'JPY' ? 0 : 2 }
      });

    return (
      <div style={{ maxWidth: 320 }}>
        <div className="rfi-group">
          <select
            className="rfi-select"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            aria-label="Currency"
          >
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {toFlagEmoji(option.code)} {option.code}
              </option>
            ))}
          </select>
          <div className="rfi-field">
            <input {...getInputProps({ id, placeholder: ' ' })} />
            <label className="rfi-label" htmlFor={id}>
              Amount
            </label>
            <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
              {symbol}
            </span>
          </div>
        </div>
        <p className="rfi-helper">
          {locale} · {symbolPosition} · scale {currency === 'JPY' ? 0 : 2} ·{' '}
          {numericValue === null ? 'null' : numericValue}
        </p>
      </div>
    );
  }
};

/*
    A clear button is off by default — the component renders a bare input and
    never adds one. `clear()` from the hook does the work, and it goes through
    the history, so Ctrl+Z puts back what was cleared.
 */
export const WithClearButton: Story = {
  render: function WithClearButton(args) {
    const id = useId();
    const { getInputProps, clear, numericValue, symbol, symbolPosition } =
      useFinancialInput({
        value: 1234.56,
        onChange: args.onChange,
        options: { locale: 'sv-SE', currency: 'SEK' }
      });

    return (
      <div style={{ display: 'grid', gap: '2rem', maxWidth: 280 }}>
        <div>
          <div className="rfi-field">
            <input {...getInputProps({ id, placeholder: ' ' })} />
            <label className="rfi-label" htmlFor={id}>
              Amount
            </label>
            <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
              {symbol}
            </span>
            {numericValue !== null && (
              <button
                type="button"
                className="rfi-clear"
                onClick={clear}
                aria-label="Clear the amount"
              >
                ×
              </button>
            )}
          </div>
          <p className="rfi-helper">
            Clear, then press Ctrl/Cmd+Z — the value comes back
          </p>
        </div>
        <p className="rfi-helper">
          Deliberately shown with a suffix symbol ({symbol}), since that is the
          case where the button and the symbol would otherwise sit on top of
          each other.
        </p>
      </div>
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
