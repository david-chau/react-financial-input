import { useState } from 'react';
import { FinancialInput, useFinancialInput } from 'react-financial-input';
// Its own entry: the only one that also runs on a server.
import { parseAmount } from 'react-financial-input/parse';
import { CurrencyCombobox } from './CurrencyCombobox';

/*
    A scratchpad, not a demo reel. Every panel is a few lines you can delete or
    rewrite — the point is to have something running before you install
    anything. Browse every state in Storybook instead:
    https://david-chau.github.io/react-financial-input/
 */

const Panel = ({
  title,
  hint,
  children
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <section style={{ display: 'grid', gap: '0.5rem' }}>
    <h2 style={{ font: '600 0.95rem system-ui', margin: 0 }}>{title}</h2>
    <p style={{ font: '0.8rem system-ui', margin: 0, opacity: 0.65 }}>{hint}</p>
    {children}
  </section>
);

const Readout = ({ children }: { children: React.ReactNode }) => (
  <code style={{ font: '0.8rem ui-monospace, monospace', opacity: 0.75 }}>
    {children}
  </code>
);

export const App = () => {
  const [amount, setAmount] = useState<number | null>(1234.56);
  const [raw, setRaw] = useState<string | null>('1234.56');
  const [currency, setCurrency] = useState('USD');

  // The headless path: same behaviour, your own markup.
  const { getInputProps, applyShortcut, symbol, symbolPosition } =
    useFinancialInput({ options: { currency, locale: 'en-US' } });

  return (
    <main
      style={{
        display: 'grid',
        gap: '2rem',
        maxWidth: 420,
        margin: '0 auto',
        padding: '2rem 1rem',
        font: '1rem system-ui'
      }}
    >
      <header>
        <h1 style={{ font: '700 1.3rem system-ui', margin: 0 }}>
          react-financial-input
        </h1>
        <p style={{ font: '0.85rem system-ui', opacity: 0.65 }}>
          Type <code>1234567</code>, or <code>2.5m</code>. The shortcuts work on
          a phone too, which is the point of the library.
        </p>
      </header>

      <Panel title="Numbers (the default)" hint="onChange gives you a number.">
        <FinancialInput value={amount} onChange={setAmount} />
        <Readout>{amount === null ? 'null' : amount}</Readout>
      </Panel>

      <Panel
        title="Strings"
        hint="valueType='string' — canonical out, so it is safe to POST as-is."
      >
        <FinancialInput valueType="string" value={raw} onChange={setRaw} />
        <Readout>{raw === null ? 'null' : JSON.stringify(raw)}</Readout>
      </Panel>

      <Panel
        title="Currency"
        hint="Type to search 162 of them. Symbol and separators follow the locale, not the code."
      >
        <div className="rfi-group">
          <CurrencyCombobox
            value={currency}
            onChange={setCurrency}
            codes="g10"
          />
          <div className="rfi-field">
            <input {...getInputProps()} />
            <span className={`rfi-adornment rfi-adornment--${symbolPosition}`}>
              {symbol}
            </span>
          </div>
        </div>
      </Panel>

      <Panel
        title="Multiplier keys"
        hint="For a numeric keypad, which has no letter keys."
      >
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {['h', 'k', 'm', 'b'].map((character) => (
            <button
              key={character}
              type="button"
              onClick={() => applyShortcut(character)}
            >
              {character.toUpperCase()}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="No React needed" hint="parseAmount runs anywhere.">
        <Readout>
          parseAmount(&apos;$1,234.56 USD&apos;) ={' '}
          {String(parseAmount('$1,234.56 USD'))}
        </Readout>
      </Panel>
    </main>
  );
};
