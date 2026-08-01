import { Fragment, useCallback, useId, useState } from 'react';
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
  args: { placeholder: '0.00' }
};

export const WithValue: Story = {
  args: { value: 1234567.89 }
};

/** Outlined is the default, matching Material UI's TextField. */
export const WithFloatingLabel: Story = {
  args: { label: 'Amount', helper: 'Try 1234567, or 2.5m' },
  render: (args) => <Field {...args} />
};

export const Filled: Story = {
  args: { label: 'Amount', className: 'rfi-input--filled' },
  render: (args) => <Field {...args} />
};

export const Standard: Story = {
  args: { label: 'Amount', className: 'rfi-input--standard' },
  render: (args) => <Field {...args} />
};

export const Small: Story = {
  args: { label: 'Amount', className: 'rfi-input--small' },
  render: (args) => <Field {...args} />
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: '1.75rem' }}>
      <Field {...args} label="Outlined" />
      <Field {...args} label="Filled" className="rfi-input--filled" />
      <Field {...args} label="Standard" className="rfi-input--standard" />
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
    The stylesheet is opt-in. Storybook imports it globally in preview.ts, so
    this story strips the styling back off to show what consumers get by
    default: a bare, unstyled input.
 */
export const Unstyled: Story = {
  args: { className: 'rfi-unstyled' },
  decorators: [
    (Story) => (
      <>
        <style>{'.rfi-unstyled { all: revert; }'}</style>
        <Story />
      </>
    )
  ]
};

export const MobileViewport: Story = {
  args: { placeholder: '0.00' },
  globals: { viewport: { value: 'mobile2', isRotated: false } }
};

/*
    Open this story on a real phone to see what the device actually does.

    `inputmode` is what asks for a numeric keypad. Every major browser honours
    it, but some Android keyboards — Samsung's most notably — ignore it and key
    off `type` alone. `type` cannot be "number" here, because a number input
    refuses to hold a value containing grouping separators.

    So if the keypad is wrong, read off the resolved values below: that is the
    difference between a library bug and a keyboard that does not implement the
    attribute.
 */
export const KeyboardDiagnostics: Story = {
  render: function KeyboardDiagnostics(args) {
    const [resolved, setResolved] = useState<Record<string, string>>({});
    const ref = useCallback((node: HTMLInputElement | null) => {
      if (!node) return;

      setResolved({
        type: node.type,
        inputMode: node.inputMode || '(empty)',
        'attr inputmode': node.getAttribute('inputmode') ?? '(absent)',
        touch: 'ontouchstart' in window ? 'yes' : 'no',
        'screen width': `${window.screen.width}px`,
        'user agent': navigator.userAgent
      });
    }, []);

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <FinancialInput {...args} ref={ref} placeholder="tap me" />
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.25rem 1rem',
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            wordBreak: 'break-word'
          }}
        >
          {Object.entries(resolved).map(([key, value]) => (
            <Fragment key={key}>
              <dt style={{ opacity: 0.6 }}>{key}</dt>
              <dd style={{ margin: 0 }}>{value}</dd>
            </Fragment>
          ))}
        </dl>
        <small style={{ opacity: 0.7, lineHeight: 1.5, fontSize: '0.7rem' }}>
          Expected <code>type=text</code> and <code>inputmode=decimal</code>. If
          both are right and the keypad still is not numeric, the keyboard app
          is ignoring <code>inputmode</code> — switch to Gboard to confirm.
        </small>
      </div>
    );
  }
};

/** scale 0 resolves inputmode to "numeric" — there is no decimal key to offer. */
export const KeyboardDiagnosticsWholeNumbers: Story = {
  ...KeyboardDiagnostics,
  args: { options: { scale: 0 } }
};
