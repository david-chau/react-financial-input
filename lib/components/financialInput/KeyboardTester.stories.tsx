import { CSSProperties, InputHTMLAttributes } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FinancialInput } from './FinancialInput';

/*
    Open this on a real device and tap each field to see which keyboard the OS
    actually raises.

    The point is comparison. If the FinancialInput rows raise the same keyboard
    as the plain `inputmode="decimal"` row below them, the component is doing its
    job and any remaining difference is the keyboard app's. Samsung's keyboard,
    for one, ignores `inputmode` entirely and keys off `type`.
 */

const meta: Meta = {
  title: 'FinancialInput/Keyboard tester',
  parameters: {
    layout: 'fullscreen',
    // The whole point is to look at this on a phone.
    viewport: { defaultViewport: 'mobile1' }
  }
};

export default meta;

type Story = StoryObj;

interface Row {
  label: string;
  note?: string;
  /*
      Omitting these is what lets one object be spread onto either a bare
      <input> or a FinancialInput, which narrows `value` to a number and
      redefines `onError` as a validation callback rather than a DOM event.
   */
  props: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange' | 'onError'
  >;
  ours?: 'default' | 'decimal';
}

const ROWS: Row[] = [
  {
    label: 'FinancialInput (default)',
    note: 'type=text · inputmode=text — letters typeable, so k/m/b work here',
    props: { placeholder: '0.00' },
    ours: 'default'
  },
  {
    label: 'FinancialInput (inputMode: decimal)',
    note: 'opt-in keypad — nicer for digits, but k/m/b become untypeable',
    props: { placeholder: '0.00' },
    ours: 'decimal'
  },
  {
    label: 'Plain text',
    note: 'type=text — the full alphabetic keyboard',
    props: { type: 'text', placeholder: 'John Doe' }
  },
  {
    label: 'Text, no autocorrect',
    note: 'autocapitalize=none · autocorrect=off',
    props: {
      type: 'text',
      autoCapitalize: 'none',
      autoCorrect: 'off',
      placeholder: 'johndoe123'
    }
  },
  {
    label: 'Numeric pad',
    note: 'inputmode=numeric · pattern=[0-9]* — digits only, no decimal',
    props: {
      type: 'text',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      placeholder: '12345'
    }
  },
  {
    label: 'Decimal pad',
    note: 'inputmode=decimal — what FinancialInput uses',
    props: { type: 'text', inputMode: 'decimal', placeholder: '99.99' }
  },
  {
    label: 'Telephone',
    note: 'type=tel — adds + * #',
    props: { type: 'tel', placeholder: '(555) 555-5555' }
  },
  {
    label: 'Email',
    note: 'type=email — adds @ and .',
    props: { type: 'email', placeholder: 'example@domain.com' }
  },
  {
    label: 'URL',
    note: 'type=url — adds / and .com',
    props: { type: 'url', placeholder: 'https://example.com' }
  },
  {
    label: 'Number',
    note: 'type=number — why FinancialInput cannot use it: a number input refuses "1,234"',
    props: { type: 'number', placeholder: '1234' }
  }
];

const styles = {
  page: {
    padding: '1rem',
    background: '#f5f5f7',
    minHeight: '100vh',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  card: {
    marginBottom: '0.75rem',
    padding: '0.875rem',
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: '#333'
  },
  note: {
    display: 'block',
    marginTop: '0.5rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.6875rem',
    color: '#666',
    wordBreak: 'break-word' as const
  },
  bare: {
    width: '100%',
    padding: '0.625rem',
    border: '1px solid #ccc',
    borderRadius: 6,
    // 16px or larger, otherwise iOS zooms the page in on focus.
    fontSize: 16,
    boxSizing: 'border-box' as const
  }
} satisfies Record<string, CSSProperties>;

export const AllKeyboards: Story = {
  render: () => (
    <div style={styles.page}>
      {ROWS.map((row) => (
        <div key={row.label} style={styles.card}>
          <label style={styles.label}>{row.label}</label>

          {row.ours ? (
            <FinancialInput
              {...row.props}
              options={
                row.ours === 'decimal' ? { inputMode: 'decimal' } : undefined
              }
              style={{ fontSize: 16 }}
            />
          ) : (
            <input {...row.props} style={styles.bare} />
          )}

          {row.note && <small style={styles.note}>{row.note}</small>}
        </div>
      ))}
    </div>
  )
};
