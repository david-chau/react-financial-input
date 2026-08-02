import {
  CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { Nullable } from '../../types';
import { useFinancialInput } from './useFinancialInput';

/*
    A bench for watching what the browser actually does.

    Every action a user can perform on an input produces a different
    `InputEvent.inputType`, and which one you get varies by platform, browser and
    keyboard app. This story logs them live, so you can perform the gesture on a
    real device and read off what fired rather than guessing.

    The clipboard buttons prime the clipboard and then get out of the way: a
    synthetic ClipboardEvent is `isTrusted: false`, so the browser skips the
    default insertion and nothing real is exercised. You perform the paste —
    Cmd/Ctrl+V, or long-press then Paste on a phone.
 */

interface LoggedEvent {
  id: number;
  type: string;
  inputType: string;
  data: string;
  isComposing: boolean;
  before: string;
  after: string;
}

const SAMPLES = [
  { label: 'plain', text: '1234.56' },
  { label: 'grouped', text: '1,234.56' },
  { label: 'currency', text: '$1,234.56 USD' },
  { label: 'accounting', text: '(1,234.00)' },
  { label: 'shortcut', text: '2.5m' },
  { label: 'rubbish', text: 'not a number' }
];

/*
    What each gesture should produce. Rows marked "varies" are the reason this
    story exists — they are the ones worth checking on a real device.
 */
const CHEATSHEET: {
  action: string;
  inputType: string;
  handling: string;
  notes: string;
}[] = [
  {
    action: 'Type a digit',
    inputType: 'insertText',
    handling: 'validated, then formatted',
    notes: 'Refused if it breaks scale, maxDigits, range or leading zero'
  },
  {
    action: 'Type h / k / m / b',
    inputType: 'insertText',
    handling: 'multiplier applied by decimal shift',
    notes: 'Unreachable on a numeric keypad — see applyShortcut'
  },
  {
    action: 'Backspace',
    inputType: 'deleteContentBackward',
    handling: 'reformatted; a separator only moves the caret',
    notes: 'data is null on every platform'
  },
  {
    action: 'Delete (forward)',
    inputType: 'deleteContentForward',
    handling: 'reformatted',
    notes: 'No Delete key on most phone keyboards'
  },
  {
    action: 'Cut',
    inputType: 'deleteByCut',
    handling: 'reformatted',
    notes: 'Ctrl/Cmd+X, or the selection menu on mobile'
  },
  {
    action: 'Paste',
    inputType: 'insertFromPaste',
    handling: 'sanitised, then validated',
    notes: 'Symbols, spaces and letters stripped; refuses if no number remains'
  },
  {
    action: 'Drag text in',
    inputType: 'insertFromDrop',
    handling: 'sanitised, then validated',
    notes: 'Desktop only'
  },
  {
    action: 'Drag text out',
    inputType: 'deleteByDrag',
    handling: 'reformatted',
    notes: 'Fires on the source input'
  },
  {
    action: 'Autocorrect / QuickType',
    inputType: 'insertReplacementText',
    handling: 'sanitised, then validated',
    notes: 'iOS mostly; replaces a whole run of text'
  },
  {
    action: 'Type on Android (Gboard)',
    inputType: 'insertCompositionText',
    handling: 'held raw while composing, committed on compositionend',
    notes: 'varies — data is unreliable until the composition ends'
  },
  {
    action: 'Option/Alt+Backspace',
    inputType: 'deleteWordBackward',
    handling: 'reformatted',
    notes: 'varies by OS and browser'
  },
  {
    action: 'Cmd+Backspace',
    inputType: 'deleteSoftLineBackward',
    handling: 'reformatted',
    notes: 'macOS; Windows may send deleteWordBackward repeatedly'
  },
  {
    action: 'Undo (Ctrl/Cmd+Z)',
    inputType: 'historyUndo',
    handling: 'steps back through the component\u2019s own history',
    notes:
      "The browser's stack holds raw text React never rendered, so it is not used"
  },
  {
    action: 'Redo (Ctrl/Cmd+Shift+Z)',
    inputType: 'historyRedo',
    handling: 'steps forward again; cleared by any fresh edit',
    notes: 'One step per accepted edit — a paste or shortcut undoes in one'
  }
];

const styles = {
  page: {
    /* Centred like every other story, rather than pinned to the left edge. */
    margin: '0 auto',
    padding: '1.5rem 1rem 3rem',
    // Nothing here may push the page wider than the phone.
    width: 'min(760px, 100%)',
    boxSizing: 'border-box' as const,
    overflowX: 'hidden' as const,
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: 'grid',
    gap: '1.25rem'
  },
  panel: {
    minWidth: 0,
    padding: '0.875rem',
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 10
  },
  heading: { margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700 },
  row: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.4rem' },
  button: {
    padding: '0.45rem 0.7rem',
    border: '1px solid rgba(0,0,0,0.23)',
    borderRadius: 6,
    background: 'transparent',
    font: 'inherit',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  buttonAccent: {
    borderColor: '#d92d20',
    color: '#d92d20'
  },
  log: {
    margin: 0,
    paddingLeft: '1.1rem',
    maxHeight: 220,
    overflowY: 'auto' as const,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.65rem',
    lineHeight: 1.6,
    overflowWrap: 'anywhere' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.7rem'
  },
  cell: {
    border: '1px solid #e4e7ec',
    padding: '0.35rem 0.5rem',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
  },
  definitions: {
    display: 'grid',
    /*
        minmax(0, …) on both tracks is what actually allows the cells to
        shrink — without it the user agent string forces the whole page wide
        and the phone scrolls sideways.
     */
    gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
    gap: '0.2rem 0.75rem',
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.65rem',
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const
  },
  note: {
    fontSize: '0.7rem',
    opacity: 0.75,
    lineHeight: 1.5
  }
} satisfies Record<string, CSSProperties>;

export const EventTesterPanel = () => {
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const [numeric, setNumeric] = useState<Nullable<number>>(null);
  const [copied, setCopied] = useState('');
  const nextId = useRef(0);
  const before = useRef('');
  const [device, setDevice] = useState<Record<string, string>>({});

  const { getInputProps, inputRef, applyShortcut, clear } = useFinancialInput({
    onChange: setNumeric
  });

  // Back to a clean slate: value, log and clipboard hint together.
  const resetAll = () => {
    clear();
    setLog([]);
    setCopied('');
  };

  const record = useCallback(
    (type: string, inputType: string, data: string, isComposing: boolean) => {
      const after = inputRef.current?.value ?? '';

      setLog((entries) =>
        [
          {
            id: (nextId.current += 1),
            type,
            inputType,
            data,
            isComposing,
            before: before.current,
            after
          },
          ...entries
        ].slice(0, 40)
      );
    },
    [inputRef]
  );

  // Read once after mount, so it never depends on ref-attachment timing.
  useEffect(() => {
    const node = inputRef.current;

    if (!node) return;

    setDevice({
      type: node.type,
      inputMode: node.inputMode || '(empty)',
      'attr inputmode': node.getAttribute('inputmode') ?? '(absent)',
      touch: 'ontouchstart' in window ? 'yes' : 'no',
      'screen width': `${window.screen.width}px`,
      'user agent': navigator.userAgent
    });
  }, [inputRef]);

  /*
        Listening natively rather than through React, so the log shows exactly
        what the browser emitted — including the events the component does not
        handle.
     */
  useEffect(() => {
    const node = inputRef.current;

    if (!node) return;

    before.current = node.value;

    /*
          beforeinput only captures the value *before* the edit — recording
          there made every row read "x → x". The result is only known once the
          input event has fired, and that event carries inputType too.
       */
    const onBeforeInput = () => {
      before.current = node.value;
    };

    const onInput = (event: Event) => {
      const input = event as InputEvent;
      const { inputType, data, isComposing } = input;

      /*
            React has not re-rendered yet, so node.value here is still the raw
            value the browser produced. Reading it after paint is what shows
            the formatted result the user actually sees.
         */
      requestAnimationFrame(() =>
        record('input', inputType, data ?? '(null)', isComposing)
      );
    };

    const onComposition = (event: Event) =>
      record(event.type, '—', (event as CompositionEvent).data ?? '', true);

    const onClipboard = (event: Event) =>
      record(
        event.type,
        '—',
        (event as ClipboardEvent).clipboardData?.getData('text') ?? '',
        false
      );

    node.addEventListener('beforeinput', onBeforeInput);
    node.addEventListener('input', onInput);
    ['compositionstart', 'compositionupdate', 'compositionend'].forEach((t) =>
      node.addEventListener(t, onComposition)
    );
    ['paste', 'copy', 'cut', 'drop'].forEach((t) =>
      node.addEventListener(t, onClipboard)
    );

    return () => {
      node.removeEventListener('beforeinput', onBeforeInput);
      node.removeEventListener('input', onInput);
      ['compositionstart', 'compositionupdate', 'compositionend'].forEach((t) =>
        node.removeEventListener(t, onComposition)
      );
      ['paste', 'copy', 'cut', 'drop'].forEach((t) =>
        node.removeEventListener(t, onClipboard)
      );
    };
  }, [inputRef, record]);

  const putOnClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
    } catch {
      setCopied('clipboard blocked — copy the sample by hand');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <p style={styles.heading}>What this device resolved</p>
        <dl style={styles.definitions}>
          {Object.entries(device).map(([key, value]) => (
            <Fragment key={key}>
              <dt style={{ opacity: 0.6 }}>{key}</dt>
              <dd style={{ margin: 0 }}>{value}</dd>
            </Fragment>
          ))}
        </dl>
        <small
          style={{ ...styles.note, display: 'block', marginTop: '0.5rem' }}
        >
          Expected <code>type=text</code> and <code>inputmode=text</code>, so
          the h/k/m/b letters stay typeable. If you opt into a keypad and it is
          still not numeric, the keyboard app is ignoring <code>inputmode</code>{' '}
          — Samsung&rsquo;s does. Switch to Gboard to confirm.
        </small>
      </div>

      <div style={styles.panel}>
        <p style={styles.heading}>Input</p>
        <input {...getInputProps({ placeholder: '0.00' })} />
        <p style={{ ...styles.code, fontSize: '0.7rem', opacity: 0.7 }}>
          onChange: {numeric === null ? 'null' : numeric}
        </p>

        <p style={styles.heading}>
          1. Put a sample on the clipboard, then paste it yourself
        </p>
        <div style={styles.row}>
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              style={styles.button}
              onClick={() => putOnClipboard(sample.text)}
            >
              {sample.label}
            </button>
          ))}
        </div>
        {copied && (
          <p style={{ ...styles.code, fontSize: '0.7rem' }}>
            clipboard: {JSON.stringify(copied)} — now press Ctrl/Cmd+V, or
            long-press the input and choose Paste
          </p>
        )}

        <p style={styles.heading}>2. Or drag this into the input</p>
        <span
          draggable
          onDragStart={(event) =>
            event.dataTransfer.setData('text/plain', '$9,876.54')
          }
          style={{
            ...styles.button,
            display: 'inline-block',
            cursor: 'grab'
          }}
        >
          $9,876.54
        </span>

        <p style={styles.heading}>3. Multipliers</p>
        <div className="rfi-keypad" style={{ maxWidth: 260 }}>
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

        <p style={styles.heading}>4. Other gestures</p>
        <div style={styles.row}>
          <button
            type="button"
            style={styles.button}
            onClick={() => {
              inputRef.current?.focus();
              document.execCommand('undo');
            }}
          >
            Undo
          </button>
          <button
            type="button"
            style={styles.button}
            onClick={() => {
              inputRef.current?.focus();
              document.execCommand('redo');
            }}
          >
            Redo
          </button>
          <button
            type="button"
            style={styles.button}
            onClick={() => inputRef.current?.select()}
          >
            Select all
          </button>

          <button
            type="button"
            style={styles.button}
            onClick={() => setLog([])}
          >
            Clear log
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.buttonAccent }}
            onClick={resetAll}
          >
            Reset all
          </button>
        </div>
      </div>

      <div style={styles.panel}>
        <p style={styles.heading}>Events, newest first</p>
        {log.length === 0 ? (
          <p style={{ ...styles.code, opacity: 0.6, fontSize: '0.7rem' }}>
            Nothing yet — type, paste, drag or undo above.
          </p>
        ) : (
          <ol style={styles.log} data-rfi-log>
            {log.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.inputType}</strong>
                {entry.inputType === '—' && <em>{entry.type}</em>} · data=
                {JSON.stringify(entry.data)}
                {entry.isComposing && ' · composing'} ·{' '}
                {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div style={styles.panel}>
        <p style={styles.heading}>
          What each gesture should produce, and how it is handled
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Action</th>
                <th style={styles.cell}>inputType</th>
                <th style={styles.cell}>Handling</th>
                <th style={styles.cell}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {CHEATSHEET.map((row) => (
                <tr key={row.action}>
                  <td style={styles.cell}>{row.action}</td>
                  <td style={{ ...styles.cell, ...styles.code }}>
                    {row.inputType}
                  </td>
                  <td style={styles.cell}>{row.handling}</td>
                  <td style={{ ...styles.cell, opacity: 0.75 }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
