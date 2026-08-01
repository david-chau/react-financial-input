import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Nullable } from '../../types';
import { FinancialInput } from './FinancialInput';

const meta = {
  title: 'FinancialInput',
  component: FinancialInput,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onChange: fn(), onError: fn() }
} satisfies Meta<typeof FinancialInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: '0.00' }
};

export const WithValue: Story = {
  args: { value: 1234567.89 }
};

export const Controlled: Story = {
  args: { value: 1000 },
  render: function Controlled(args) {
    const [value, setValue] = useState<Nullable<number>>(args.value ?? null);

    return (
      <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'end' }}>
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
  args: { placeholder: 'try 2.5m' }
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
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <FinancialInput
          {...args}
          aria-invalid={hasError}
          onError={() => {
            args.onError?.();
            setHasError(true);
          }}
          onChange={(next) => {
            args.onChange?.(next);
            setHasError(false);
          }}
        />
        <small style={{ color: '#d92d20', minHeight: '1.2em' }}>
          {hasError ? 'That character is not allowed here' : ''}
        </small>
      </div>
    );
  }
};

/*
    The stylesheet is opt-in. Storybook imports it globally in preview.ts, so
    this story strips the class back off to show what consumers get by default.
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
