import { useRef, useState } from 'react';
import { supportsFlagEmoji } from '../../currency';
import { Edit, describeEdit } from '../../events';

/*
    A deliberately plain <input>. No FinancialInput, no formatting, no currency
    — the point is that these utilities work on any text field, and that a
    desktop app already wiring onChange can adopt them without changing what it
    renders.

    Two readings of the same keystroke sit side by side: what the two strings
    alone can tell you, and what the InputEvent adds. The gap between the
    columns is the whole argument for using inputType.
 */

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'grid',
    gap: '1rem',
    maxWidth: 780,
    margin: '0 auto',
    padding: '1.5rem 1rem',
    font: '14px system-ui, sans-serif'
  },
  card: {
    border: '1px solid rgba(0,0,0,0.14)',
    borderRadius: 8,
    padding: '1rem'
  },
  heading: { font: '600 0.9rem system-ui', margin: '0 0 0.5rem' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.6rem 0.7rem',
    fontSize: '1rem',
    border: '1px solid rgba(0,0,0,0.23)',
    borderRadius: 4
  },
  columns: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'
  },
  code: {
    font: '0.78rem ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0
  },
  note: { font: '0.78rem system-ui', opacity: 0.7, margin: '0.4rem 0 0' },
  row: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
    margin: '0.6rem 0 0'
  },
  button: {
    padding: '0.3rem 0.6rem',
    font: '0.8rem system-ui',
    border: '1px solid rgba(0,0,0,0.23)',
    borderRadius: 999,
    background: 'transparent',
    cursor: 'pointer'
  }
};

const show = (edit: Edit | null): string =>
  edit === null ? '—' : JSON.stringify(edit, null, 2);

export const InputEventsPanel = () => {
  const [value, setValue] = useState('');
  const [fromStrings, setFromStrings] = useState<Edit | null>(null);
  const [fromEvent, setFromEvent] = useState<Edit | null>(null);
  const [log, setLog] = useState<string[]>([]);

  /*
      The previous value has to be kept by hand. React's onChange only ever
      hands over the new one, which is the reason a diff-based reading needs
      somewhere to diff from.
   */
  const previous = useRef('');

  const record = (next: string, event?: InputEvent) => {
    const strings = describeEdit(previous.current, next);
    const withEvent = event
      ? describeEdit(previous.current, next, event)
      : null;

    setFromStrings(strings);
    setFromEvent(withEvent);
    setLog((entries) =>
      [
        `${withEvent?.inputType ?? 'no event'} → ${
          withEvent?.kind ?? strings.kind
        }${
          withEvent && withEvent.kind !== strings.kind
            ? `   (the strings alone said "${strings.kind}")`
            : ''
        }`,
        ...entries
      ].slice(0, 8)
    );

    previous.current = next;
    setValue(next);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.card}>
        <p style={styles.heading}>An ordinary text input</p>
        <input
          style={styles.input}
          value={value}
          placeholder="Type, paste, undo, or use an IME"
          onInput={(reactEvent) =>
            record(
              reactEvent.currentTarget.value,
              reactEvent.nativeEvent as InputEvent
            )
          }
          onChange={() => {
            // Handled in onInput, which is where the InputEvent lives.
          }}
        />
        <div style={styles.row}>
          <button
            type="button"
            style={styles.button}
            onClick={() => {
              previous.current = '';
              setValue('');
              setFromStrings(null);
              setFromEvent(null);
              setLog([]);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            style={styles.button}
            onClick={() =>
              navigator.clipboard
                ?.writeText('$1,234.56 USD')
                .catch(() => undefined)
            }
          >
            Copy a sample, then paste it
          </button>
        </div>
        <p style={styles.note}>
          Nothing here is a currency input. It is a bare
          <code> &lt;input&gt; </code> reading the same utilities
          <code> FinancialInput </code> is built on.
        </p>
      </div>

      <div style={styles.columns}>
        <div style={styles.card}>
          <p style={styles.heading}>describeEdit(before, after)</p>
          <pre style={styles.code}>{show(fromStrings)}</pre>
          <p style={styles.note}>
            What a desktop app has today, wiring <code>onChange</code> alone.
            Position and text, inferred from the two strings.
          </p>
        </div>

        <div style={styles.card}>
          <p style={styles.heading}>describeEdit(before, after, event)</p>
          <pre style={styles.code}>{show(fromEvent)}</pre>
          <p style={styles.note}>
            The same call with the <code>InputEvent</code>. Adds provenance: a
            paste, an IME still composing, an undo.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <p style={styles.heading}>This platform</p>
        <pre style={styles.code}>
          {`flag emoji: ${
            supportsFlagEmoji() ? 'drawn' : 'not drawn — letters instead'
          }`}
        </pre>
        <p style={styles.note}>
          Windows ships no glyphs for regional indicator pairs, so the currency
          search shows <code>SE</code> rather than a Swedish flag.{' '}
          <code>supportsFlagEmoji()</code> reports it, so a flag font can be
          downloaded on the platforms that need one and nowhere else.
        </p>
      </div>

      <div style={styles.card}>
        <p style={styles.heading}>Where the two readings disagree</p>
        <pre style={styles.code}>
          {log.length === 0 ? 'Type something above.' : log.join('\n')}
        </pre>
        <p style={styles.note}>
          Paste to see it: the strings can only say &ldquo;several characters
          arrived&rdquo;, while the event says <code>insertFromPaste</code>. On
          Android, the clipboard chip above the keyboard reports
          <code> insertText </code> carrying the whole string, which is why
          length rather than name decides.
        </p>
      </div>
    </div>
  );
};
