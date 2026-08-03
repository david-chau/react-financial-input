import { CSSProperties, Fragment } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

/*
    The page Storybook opens on. Everything else in the sidebar assumes you
    already know what you are looking at; this does not.
 */

const meta: Meta = {
  title: 'Introduction',
  parameters: { layout: 'fullscreen' }
};

export default meta;

type Story = StoryObj;

const styles = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    lineHeight: 1.6,
    color: '#101828'
  },
  h1: { fontSize: '1.6rem', margin: '0 0 0.5rem' },
  lede: { fontSize: '1rem', color: '#475467', margin: '0 0 2rem' },
  h2: { fontSize: '1rem', margin: '2rem 0 0.5rem' },
  card: {
    display: 'grid',
    gridTemplateColumns: 'minmax(9rem, auto) 1fr',
    gap: '0.4rem 1rem',
    padding: '1rem',
    border: '1px solid #e4e7ec',
    borderRadius: 10,
    fontSize: '0.85rem'
  },
  name: { fontWeight: 600 },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.8rem',
    background: '#f2f4f7',
    padding: '0.1rem 0.3rem',
    borderRadius: 4
  },
  pre: {
    background: '#f2f4f7',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    overflowX: 'auto' as const,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.8rem'
  }
} satisfies Record<string, CSSProperties>;

const TOUR: [string, string][] = [
  [
    'Debug (Playground)',
    'Type, paste, drag and undo, and watch every browser event as it fires. Start here if something looks wrong on your device.'
  ],
  [
    'Default',
    'The component with nothing configured — a bare, unstyled input.'
  ],
  ['Variants', 'Every look the optional stylesheet offers, on one page.'],
  ['Shortcuts', 'Type 2.5m and watch it become 2,500,000.'],
  [
    'Shortcut Buttons',
    'The same multipliers as tap targets, for a numeric keypad.'
  ],
  [
    'With Currency',
    'Symbols and separators resolved from Intl for five locales.'
  ],
  ['Controlled', 'Driven by a parent’s state, showing what onChange reports.'],
  ['With Error State', 'What a refused keystroke looks like.'],
  ['Mobile Viewport', 'The component at phone width.']
];

export const Welcome: Story = {
  render: () => (
    <div style={styles.page}>
      <h1 style={styles.h1}>react-financial-input</h1>
      <p style={styles.lede}>
        A React currency input that formats as you type, with{' '}
        <code style={styles.code}>h</code> <code style={styles.code}>k</code>{' '}
        <code style={styles.code}>m</code> <code style={styles.code}>b</code>{' '}
        multiplier shortcuts that work on every device, including phones.
      </p>

      <h2 style={styles.h2}>New to Storybook?</h2>
      <p>
        The list on the left is a set of live examples. Click any of them and
        the component appears in the middle — it is real and interactive, so
        type into it. The panel underneath has tabs: <strong>Controls</strong>{' '}
        lets you change the props and see the result immediately, and{' '}
        <strong>Actions</strong> logs the values the component reports back.
      </p>

      <h2 style={styles.h2}>Where to go</h2>
      <div style={styles.card}>
        {TOUR.map(([name, description]) => (
          <Fragment key={name}>
            <div style={styles.name}>{name}</div>
            <div>{description}</div>
          </Fragment>
        ))}
      </div>

      <h2 style={styles.h2}>Try this first</h2>
      <p>
        Open <strong>Playground</strong> and type{' '}
        <code style={styles.code}>2.5m</code>. Then press{' '}
        <code style={styles.code}>Ctrl/Cmd+Z</code> — it undoes the whole
        expansion in one step. Then paste{' '}
        <code style={styles.code}>$1,234.56 USD</code> and watch it become a
        number.
      </p>

      <h2 style={styles.h2}>Using it in an app</h2>
      <pre style={styles.pre}>
        {`npm install react-financial-input

import { FinancialInput } from 'react-financial-input';

<FinancialInput value={amount} onChange={setAmount} />`}
      </pre>
      <p style={{ fontSize: '0.85rem', color: '#475467' }}>
        It is unstyled by default. The looks in <strong>Variants</strong> come
        from an optional stylesheet you opt into with{' '}
        <code style={styles.code}>
          import &apos;react-financial-input/styles.css&apos;
        </code>
        .
      </p>
    </div>
  )
};
