import { describe, expect, it } from 'vitest';
import { InputType } from '../../enums';
import { DEFAULT_SEPARATORS, Separators } from '../../utils';
import {
  FinancialInputState,
  HISTORY_LIMIT,
  createInitialState,
  reduceClear,
  reduceCompositionEnd,
  reduceHistory,
  reduceInput,
  reduceShortcut
} from './financialInputReducer';
import {
  DEFAULT_MAX_DIGITS,
  DEFAULT_SCALE,
  Range,
  SHORTCUT_EXPONENTS
} from './financialInputUtils';

const stateOf = (
  displayValue: string,
  numericValue: number | null = null
): FinancialInputState => ({
  displayValue,
  numericValue,
  cursor: displayValue.length,
  rejected: false,
  past: [],
  future: []
});

const run = (
  state: FinancialInputState,
  inputType: string,
  data: string | null,
  targetValue: string,
  selectionStart: number,
  scale: number = DEFAULT_SCALE,
  maxDigits: number = DEFAULT_MAX_DIGITS,
  isComposing: boolean = false,
  separators: Separators = DEFAULT_SEPARATORS,
  exponents: Record<string, number> = SHORTCUT_EXPONENTS,
  range: Range = 'ALL'
) =>
  reduceInput(state, {
    inputType,
    data,
    targetValue,
    selectionStart,
    scale,
    maxDigits,
    separators,
    exponents,
    range,
    isComposing
  });

describe('createInitialState', () => {
  it.each([
    // value       displayValue  numericValue
    [undefined, '', null],
    [null, '', null],
    [0, '0', 0],
    [1000, '1,000', 1000],
    [1234.5, '1,234.5', 1234.5]
  ])('createInitialState(%j) -> %j / %j', (value, displayValue, numeric) => {
    const state = createInitialState(value);

    expect(state.displayValue).toBe(displayValue);
    expect(state.numericValue).toBe(numeric);
  });
});

describe('insertText', () => {
  it.each([
    // before      data  targetValue  caret  ->  displayValue  numericValue  cursor  note
    ['', '1', '1', 1, '1', 1, 1, 'first digit'],
    ['1', '2', '12', 2, '12', 12, 2, 'second digit'],
    [
      '999',
      '9',
      '9999',
      4,
      '9,999',
      9999,
      5,
      'caret moves past the new separator'
    ],
    [
      '1,000',
      '0',
      '1,0000',
      6,
      '10,000',
      10000,
      6,
      'typing at the end regroups'
    ],
    ['1', '.', '1.', 2, '1.', 1, 2, 'a trailing decimal point is kept'],
    ['1.', '5', '1.5', 3, '1.5', 1.5, 3, 'first decimal place'],
    [
      '1.5',
      '0',
      '1.50',
      4,
      '1.50',
      1.5,
      4,
      'trailing zero is kept while typing'
    ],
    ['', '.', '.', 1, '.', null, 1, 'a lone decimal point commits no value']
  ])(
    'from %j typing %j -> %j (%s)',
    (
      before,
      data,
      targetValue,
      caret,
      displayValue,
      numericValue,
      cursor,
      _note
    ) => {
      const next = run(
        stateOf(before as string),
        InputType.INSERT_TEXT,
        data as string,
        targetValue as string,
        caret as number
      );

      expect(next.rejected).toBe(false);
      expect(next.displayValue).toBe(displayValue);
      expect(next.numericValue).toBe(numericValue);
      expect(next.cursor).toBe(cursor);
    }
  );

  it.each([
    // before    data  targetValue   caret  scale  note
    ['1.23', '4', '1.234', 5, 2, 'a third decimal place at scale 2'],
    ['1', '.', '1.', 2, 0, 'any decimal point at scale 0'],
    ['1.2', '.', '1.2.', 4, 2, 'a second decimal point'],
    ['0', '1', '01', 2, 2, 'a leading zero'],
    ['1', 'z', '1z', 2, 2, 'a letter that is not a shortcut'],
    ['12345678901', '2', '123456789012', 12, 2, 'past the digit limit']
  ])(
    'from %j typing %j is refused (%s)',
    (before, data, targetValue, caret, scale) => {
      const state = stateOf(before as string);
      const next = run(
        state,
        InputType.INSERT_TEXT,
        data as string,
        targetValue as string,
        caret as number,
        scale as number
      );

      expect(next.rejected).toBe(true);
      expect(next.displayValue).toBe(state.displayValue);
      expect(next.numericValue).toBe(state.numericValue);
    }
  );
});

describe('shortcuts', () => {
  it.each([
    // before   data  targetValue  caret  ->  displayValue  numericValue  note
    ['1', 'k', '1k', 2, '1,000', 1000, 'k multiplies by a thousand'],
    ['2.5', 'm', '2.5m', 4, '2,500,000', 2500000, 'm on a fraction'],
    ['1.1', 'h', '1.1h', 4, '110', 110, 'exact: 1.1 * 100 drifts in floats'],
    ['1', 'h', '1h', 2, '100', 100, 'h multiplies by a hundred'],
    ['1', 'b', '1b', 2, '1,000,000,000', 1000000000, 'b'],
    ['', 'k', 'k', 1, '1,000', 1000, 'a bare shortcut'],
    ['1', 'K', '1K', 2, '1,000', 1000, 'uppercase works too']
  ])(
    'from %j typing %j -> %j (%s)',
    (before, data, targetValue, caret, displayValue, numericValue) => {
      const next = run(
        stateOf(before as string),
        InputType.INSERT_TEXT,
        data as string,
        targetValue as string,
        caret as number
      );

      expect(next.rejected).toBe(false);
      expect(next.displayValue).toBe(displayValue);
      expect(next.numericValue).toBe(numericValue);
      expect(next.cursor).toBe((displayValue as string).length);
    }
  );

  it('refuses a shortcut that would exceed maxDigits', () => {
    const next = run(
      stateOf('999999999'),
      InputType.INSERT_TEXT,
      'b',
      '999999999b',
      10
    );

    expect(next.rejected).toBe(true);
    expect(next.displayValue).toBe('999999999');
  });
});

describe('reduceShortcut', () => {
  it.each([
    // displayValue  character  ->  displayValue  numericValue  note
    ['2.5', 'm', '2,500,000', 2500000, 'same result as typing the letter'],
    ['1', 'k', '1,000', 1000, 'k'],
    ['1.1', 'h', '110', 110, 'exact, no float drift'],
    ['1,000', 'k', '1,000,000', 1000000, 'operates on the formatted value'],
    ['', 'k', '1,000', 1000, 'on an empty value, reads as one of that unit'],
    ['0', 'k', '0', 0, 'zero stays zero']
  ])(
    'applying %j to %j -> %j (%s)',
    (displayValue, character, expected, numericValue) => {
      const next = reduceShortcut(
        stateOf(displayValue as string),
        character as string,
        DEFAULT_SCALE,
        DEFAULT_MAX_DIGITS
      );

      expect(next.rejected).toBe(false);
      expect(next.displayValue).toBe(expected);
      expect(next.numericValue).toBe(numericValue);
      expect(next.cursor).toBe((expected as string).length);
    }
  );

  it.each([
    ['1', 'z', 'not a shortcut character'],
    ['999999999', 'b', 'would exceed maxDigits']
  ])('refuses %j + %j (%s)', (displayValue, character) => {
    const state = stateOf(displayValue);
    const next = reduceShortcut(
      state,
      character,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS
    );

    expect(next.rejected).toBe(true);
    expect(next.displayValue).toBe(state.displayValue);
  });
});

describe('deleteContentBackward', () => {
  it.each([
    // before      targetValue  caret  ->  displayValue  numericValue  cursor  note
    ['1,000', '1,00', 4, '100', 100, 3, 'deleting a digit regroups'],
    ['100', '10', 2, '10', 10, 2, 'no separators involved'],
    ['5', '', 0, '', null, 0, 'deleting the last character clears the value'],
    ['1.5', '1.', 2, '1.', 1, 2, 'deleting a decimal digit'],
    ['0.', '0', 1, '0', 0, 1, 'deleting the decimal point'],
    ['.', '', 0, '', null, 0, 'deleting a lone decimal point'],
    ['1,234,567', '1,234,56', 8, '123,456', 123456, 7, 'regroups down a level']
  ])(
    'from %j deleting to %j -> %j (%s)',
    (before, targetValue, caret, displayValue, numericValue, cursor, _note) => {
      const next = run(
        stateOf(before as string),
        InputType.DELETE_CONTENT_BACKWARD,
        null,
        targetValue as string,
        caret as number
      );

      expect(next.rejected).toBe(false);
      expect(next.displayValue).toBe(displayValue);
      expect(next.numericValue).toBe(numericValue);
      expect(next.cursor).toBe(cursor);
    }
  );

  it('backspacing a grouping separator only moves the caret', () => {
    const state = stateOf('1,000', 1000);
    const next = run(state, InputType.DELETE_CONTENT_BACKWARD, null, '1000', 1);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe('1,000');
    expect(next.numericValue).toBe(1000);
    expect(next.cursor).toBe(1);
  });
});

/*
    Paste, drop and iOS replacement text never passed keystroke validation, so
    the reducer sanitises the resulting value rather than refusing it outright.
    `targetValue` is what the input holds after the browser applied the edit.
 */
describe.each([
  InputType.INSERT_FROM_PASTE,
  InputType.INSERT_FROM_DROP,
  InputType.INSERT_REPLACEMENT_TEXT
])('%s', (inputType) => {
  it.each([
    // targetValue          -> displayValue   numericValue  note
    ['1234.56', '1,234.56', 1234.56, 'a plain number'],
    ['1,234.56', '1,234.56', 1234.56, 'already grouped'],
    ['$1,234.56', '1,234.56', 1234.56, 'a currency symbol'],
    ['$1,234.56 USD', '1,234.56', 1234.56, 'symbol and code'],
    ['  1234  ', '1,234', 1234, 'surrounding whitespace'],
    ['(1,234.00)', '-1,234.00', -1234, 'accounting negative'],
    ['-1234', '-1,234', -1234, 'a leading minus'],
    ['2.5m', '2,500,000', 2500000, 'a shortcut suffix'],
    ['1 234 567', '1,234,567', 1234567, 'space-grouped'],
    ['007', '7', 7, 'leading zeros are dropped']
  ])('accepts %j -> %j (%s)', (targetValue, displayValue, numericValue) => {
    const next = run(
      stateOf(''),
      inputType,
      null,
      targetValue as string,
      (targetValue as string).length
    );

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe(displayValue);
    expect(next.numericValue).toBe(numericValue);
  });

  it.each([
    ['abc', 'no digits at all'],
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['.', 'a lone decimal point'],
    ['1.2.3', 'two decimal points'],
    ['1.234', 'more decimals than scale allows'],
    ['123456789012', 'more digits than maxDigits allows']
  ])('refuses %j (%s)', (targetValue) => {
    const state = stateOf('1,000', 1000);
    const next = run(state, inputType, null, targetValue, targetValue.length);

    expect(next.rejected).toBe(true);
    expect(next.displayValue).toBe('1,000');
    expect(next.numericValue).toBe(1000);
  });
});

describe('range deletes', () => {
  it.each([
    // inputType                          targetValue  -> displayValue  numeric
    [InputType.DELETE_BY_CUT, '1234', '1,234', 1234],
    [InputType.DELETE_BY_DRAG, '1234', '1,234', 1234],
    [InputType.DELETE_CONTENT_FORWARD, '1234', '1,234', 1234],
    [InputType.DELETE_WORD_BACKWARD, '', '', null],
    [InputType.DELETE_WORD_FORWARD, '', '', null],
    [InputType.DELETE_SOFT_LINE_BACKWARD, '', '', null],
    [InputType.DELETE_ENTIRE_SOFT_LINE, '', '', null]
  ])('%s -> %j', (inputType, targetValue, displayValue, numericValue) => {
    const next = run(
      stateOf('1,234,567', 1234567),
      inputType as string,
      null,
      targetValue as string,
      (targetValue as string).length
    );

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe(displayValue);
    expect(next.numericValue).toBe(numericValue);
  });
});

/*
    Android soft keyboards emit insertCompositionText per keystroke while a word
    is still being composed. Reformatting mid-composition makes the IME fight
    the input, so the raw text is held until compositionend commits it.
 */
describe('IME composition', () => {
  it.each([
    // composing text held verbatim, no numeric value committed
    ['1'],
    ['12'],
    ['123'],
    ['1234']
  ])('holds %j unformatted while composing', (targetValue) => {
    const next = run(
      stateOf(''),
      InputType.INSERT_COMPOSITION_TEXT,
      targetValue,
      targetValue,
      targetValue.length,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe(targetValue);
    expect(next.numericValue).toBe(null);
  });

  it('formats and commits once the composition ends', () => {
    const composing = run(
      stateOf(''),
      InputType.INSERT_COMPOSITION_TEXT,
      '1234567',
      '1234567',
      7,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    expect(composing.displayValue).toBe('1234567');

    const committed = reduceCompositionEnd(composing, {
      inputType: InputType.INSERT_COMPOSITION_TEXT,
      data: null,
      targetValue: '1234567',
      selectionStart: 7,
      scale: DEFAULT_SCALE,
      maxDigits: DEFAULT_MAX_DIGITS,
      separators: DEFAULT_SEPARATORS,
      exponents: SHORTCUT_EXPONENTS,
      range: 'ALL'
    });

    expect(committed.displayValue).toBe('1,234,567');
    expect(committed.numericValue).toBe(1234567);
  });

  /*
      A refused commit must not leave the IME's raw text on screen. While
      composing, displayValue holds unvalidated text, so rejecting has to
      rebuild from the last committed numeric value.
   */
  /*
      Letters no longer reach this point — they are refused while composing, by
      "composition that can never become a number" below. These are the values
      that are composable but still fail to commit.
   */
  it.each([
    ['1.234', 'more decimals than scale allows'],
    ['', 'nothing at all']
  ])('restores the committed value when %j is refused (%s)', (composed) => {
    const held = run(
      stateOf('1,000', 1000),
      InputType.INSERT_COMPOSITION_TEXT,
      composed,
      composed,
      composed.length,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    expect(held.displayValue).toBe(composed);

    const committed = reduceCompositionEnd(held, {
      inputType: InputType.INSERT_COMPOSITION_TEXT,
      data: null,
      targetValue: composed,
      selectionStart: composed.length,
      scale: DEFAULT_SCALE,
      maxDigits: DEFAULT_MAX_DIGITS,
      separators: DEFAULT_SEPARATORS,
      exponents: SHORTCUT_EXPONENTS,
      range: 'ALL'
    });

    expect(committed.rejected).toBe(true);
    expect(committed.displayValue).toBe('1,000');
    expect(committed.numericValue).toBe(1000);
  });

  it('treats composition text as a paste when no composition is active', () => {
    const next = run(
      stateOf(''),
      InputType.INSERT_COMPOSITION_TEXT,
      '1234',
      '1234',
      4
    );

    expect(next.displayValue).toBe('1,234');
    expect(next.numericValue).toBe(1234);
  });
});

describe('history', () => {
  /*
      The browser's undo stack holds its own edits, not the reformatted value
      React rendered, so replaying it would restore something never shown. Left
      alone, and quiet — the user did nothing wrong.
   */
  it.each([
    [InputType.HISTORY_UNDO],
    [InputType.HISTORY_REDO],
    ['insertTranspose']
  ])('%s leaves the value untouched without erroring', (inputType) => {
    const state = stateOf('1,000', 1000);
    const next = run(state, inputType, null, '1,0009', 6);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe('1,000');
    expect(next.numericValue).toBe(1000);
  });
});

describe('undo and redo', () => {
  const type = (state: FinancialInputState, digit: string, target: string) =>
    run(state, InputType.INSERT_TEXT, digit, target, target.length);

  it('walks back through each edit, then forward again', () => {
    const one = type(stateOf(''), '1', '1');
    const two = type(one, '2', '12');
    const three = type(two, '3', '123');

    expect(three.displayValue).toBe('123');

    const back1 = run(three, InputType.HISTORY_UNDO, null, '123', 3);
    expect(back1.displayValue).toBe('12');
    expect(back1.numericValue).toBe(12);

    const back2 = run(back1, InputType.HISTORY_UNDO, null, '12', 2);
    expect(back2.displayValue).toBe('1');

    const back3 = run(back2, InputType.HISTORY_UNDO, null, '1', 1);
    expect(back3.displayValue).toBe('');
    expect(back3.numericValue).toBe(null);

    const forward = run(back3, InputType.HISTORY_REDO, null, '', 0);
    expect(forward.displayValue).toBe('1');

    const forward2 = run(forward, InputType.HISTORY_REDO, null, '1', 1);
    expect(forward2.displayValue).toBe('12');
  });

  it.each([
    [InputType.HISTORY_UNDO, 'undo'],
    [InputType.HISTORY_REDO, 'redo']
  ])('%s at the boundary is a no-op, not an error (%s)', (inputType) => {
    const state = stateOf('1,000', 1000);
    const next = run(state, inputType, null, '1,000', 5);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe('1,000');
  });

  it('discards the redo stack once a fresh edit lands', () => {
    const two = type(type(stateOf(''), '1', '1'), '2', '12');
    const undone = run(two, InputType.HISTORY_UNDO, null, '12', 2);

    expect(undone.displayValue).toBe('1');
    expect(undone.future).toHaveLength(1);

    const edited = type(undone, '9', '19');

    expect(edited.displayValue).toBe('19');
    expect(edited.future).toHaveLength(0);

    const redone = run(edited, InputType.HISTORY_REDO, null, '19', 2);
    expect(redone.displayValue).toBe('19');
  });

  it('undoes a shortcut expansion in one step', () => {
    const base = type(stateOf(''), '2', '2');
    const expanded = run(base, InputType.INSERT_TEXT, 'k', '2k', 2);

    expect(expanded.displayValue).toBe('2,000');

    const undone = run(expanded, InputType.HISTORY_UNDO, null, '2,000', 5);
    expect(undone.displayValue).toBe('2');
  });

  it('undoes a paste in one step', () => {
    const typed = type(stateOf(''), '5', '5');
    const pasted = run(
      typed,
      InputType.INSERT_FROM_PASTE,
      null,
      '$1,234.56',
      9
    );

    expect(pasted.displayValue).toBe('1,234.56');

    const undone = run(pasted, InputType.HISTORY_UNDO, null, '1,234.56', 8);
    expect(undone.displayValue).toBe('5');
  });

  it('does not record a refused keystroke', () => {
    const typed = type(stateOf(''), '1', '1');
    const refused = run(typed, InputType.INSERT_TEXT, 'z', '1z', 2);

    expect(refused.rejected).toBe(true);
    expect(refused.past).toHaveLength(typed.past.length);
  });

  it(`keeps at most ${HISTORY_LIMIT} snapshots`, () => {
    let state = stateOf('');

    for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) {
      const target = '1'.repeat(Math.min(i, 11));
      state = { ...type(state, '1', target), displayValue: `${i}` };
      state = { ...state, past: state.past };
    }

    expect(state.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });
});

describe('reduceClear', () => {
  it('empties the value and reports null', () => {
    const state = stateOf('1,234.56', 1234.56);
    const cleared = reduceClear(state);

    expect(cleared.displayValue).toBe('');
    expect(cleared.numericValue).toBe(null);
    expect(cleared.cursor).toBe(0);
    expect(cleared.rejected).toBe(false);
  });

  /*
      A clear button is only safe to offer if it can be taken back, so it goes
      through the history like any other edit.
   */
  it('is undoable', () => {
    const state = stateOf('1,234.56', 1234.56);
    const cleared = reduceClear(state);

    expect(cleared.past).toHaveLength(1);

    const restored = run(cleared, InputType.HISTORY_UNDO, null, '', 0);

    expect(restored.displayValue).toBe('1,234.56');
    expect(restored.numericValue).toBe(1234.56);
  });

  it('records nothing when the value is already empty', () => {
    const cleared = reduceClear(stateOf(''));

    expect(cleared.past).toHaveLength(0);
  });
});

/*
    Traces recorded from real phones through the Debug (Playground) story, not
    invented. Both of these passed every emulated test and still failed on
    hardware, which is exactly what this table exists to stop.
 */
describe('recorded device traces', () => {
  it('android: backspace at the end reports selectionStart 0', () => {
    /*
        The caret cannot legitimately be at 0 after deleting the last
        character. Honouring it sent the caret to the front on every delete:
        "1,000|" became "|100".
     */
    const next = run(
      stateOf('1,000', 1000),
      InputType.DELETE_CONTENT_BACKWARD,
      null,
      '1,00',
      0
    );

    expect(next.displayValue).toBe('100');
    expect(next.cursor).toBe(3);
  });

  it.each([
    // previous     after      lying caret  -> cursor  note
    ['1,000', '1,00', 0, 3, 'delete at the end'],
    ['1,234,567', '1,234,56', 0, 7, 'regrouping down a level'],
    ['1,000', ',000', 0, 0, 'deleting the first character really is 0'],
    ['1,234', '1,34', 0, 1, 'deleting in the middle']
  ])(
    'android: %j -> %j with caret %i lands at %i (%s)',
    (before, after, caret, expected) => {
      const next = run(
        stateOf(before as string),
        InputType.DELETE_CONTENT_BACKWARD,
        null,
        after as string,
        caret as number
      );

      expect(next.cursor).toBe(expected);
    }
  );

  it('samsung: commits a shortcut without waiting for compositionend', () => {
    /*
        Samsung composes the whole word and defers compositionend until the
        field loses focus, so "2k" sat on screen while every other platform
        had already shown "2,000".
     */
    const composing = run(
      stateOf('2', 2),
      InputType.INSERT_COMPOSITION_TEXT,
      '2k',
      '2k',
      2,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    expect(composing.displayValue).toBe('2,000');
    expect(composing.numericValue).toBe(2000);
  });

  it.each([
    // composed  -> committed  note
    ['2k', '2,000', 'the reported case'],
    ['2.5m', '2,500,000', 'a fraction'],
    ['1b', '1,000,000,000', 'billions'],
    ['300h', '30,000', 'hundreds']
  ])('samsung: composing %j commits %j (%s)', (composed, expected) => {
    const next = run(
      stateOf(''),
      InputType.INSERT_COMPOSITION_TEXT,
      composed,
      composed,
      composed.length,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    expect(next.displayValue).toBe(expected);
  });

  /*
      "ab" used to be held here too. It is now refused on sight, since no
      further keystroke could turn it into a number — see "composition that can
      never become a number".
   */
  it.each([
    ['2', 'still just digits'],
    ['12', 'more digits'],
    ['2.', 'a fraction being started']
  ])('samsung: keeps holding %j (%s)', (composed) => {
    const next = run(
      stateOf(''),
      InputType.INSERT_COMPOSITION_TEXT,
      composed,
      composed,
      composed.length,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      true
    );

    // Held verbatim: not a finished token, so nothing to commit yet.
    expect(next.displayValue).toBe(composed);
    expect(next.numericValue).toBe(null);
  });
});

/*
    Android keyboards offer the clipboard as a chip above the keys. Tapping it
    emits insertText carrying the whole string, not insertFromPaste — so it
    used to hit the keystroke path, where "$" and "(" are not valid characters,
    and was refused. Ctrl+V on the same device sends insertFromPaste and always
    worked, which is what disguised it as a platform problem.

    Recorded from a real SwiftKey session; the log read:
      insertText · data="(1,234.00)" · "" -> ""
 */
describe('insertText carrying more than one character', () => {
  it.each([
    // before   data                 targetValue          -> display     numeric   note
    [
      '',
      '(1,234.00)',
      '(1,234.00)',
      '-1,234.00',
      -1234,
      'the recorded SwiftKey trace'
    ],
    [
      '',
      '$1,234.56 USD',
      '$1,234.56 USD',
      '1,234.56',
      1234.56,
      'currency chip'
    ],
    ['', '1234.56', '1234.56', '1,234.56', 1234.56, 'plain'],
    ['', '1,234.56', '1,234.56', '1,234.56', 1234.56, 'already grouped'],
    ['', '2.5m', '2.5m', '2,500,000', 2500000, 'a shortcut token expands'],
    ['12', '345', '12345', '12,345', 12345, 'appended to an existing value'],
    [
      '',
      '12 34',
      '12 34',
      '1,234',
      1234,
      'a space is stripped — spreadsheets copy that way, and fr-FR groups with it'
    ]
  ])(
    'from %j inserting %j -> %j',
    (before, data, targetValue, displayValue, numericValue, _note) => {
      const next = run(
        stateOf(before as string),
        InputType.INSERT_TEXT,
        data as string,
        targetValue as string,
        (targetValue as string).length
      );

      expect(next.rejected).toBe(false);
      expect(next.displayValue).toBe(displayValue);
      expect(next.numericValue).toBe(numericValue);
    }
  );

  it.each([
    // data              targetValue         note
    ['rubbish', 'rubbish', 'a suggestion-strip word has no number in it'],
    ['1.234', '1.234', 'still bound by scale'],
    ['999999999999', '999999999999', 'still bound by maxDigits']
  ])('refuses %j (%s)', (data, targetValue, _note) => {
    const next = run(
      stateOf('99'),
      InputType.INSERT_TEXT,
      data as string,
      targetValue as string,
      (targetValue as string).length
    );

    expect(next.rejected).toBe(true);
    expect(next.displayValue).toBe('99');
  });

  // One character is a keystroke, and must stay on the strict path.
  it('leaves single-character insertText on the typing path', () => {
    const next = run(stateOf('1'), InputType.INSERT_TEXT, '$', '1$', 2);

    expect(next.rejected).toBe(true);
  });
});

/*
    An IME is left alone while composing, because reformatting under it makes
    the keyboard fight the input. But "left alone" was taken to mean "shows
    anything": an iOS pinyin keyboard puts "ni hao" and then 你好 straight into
    the field, which replaced the committed amount on screen — and iOS fires no
    compositionend for it, so it never cleaned itself up.

    Recorded from a real iPhone:
      insertCompositionText · data="你好" · composing · "" → "你好"
 */
describe('composition that can never become a number', () => {
  const composing = (
    state: FinancialInputState,
    targetValue: string,
    isComposing = true
  ) =>
    run(
      state,
      InputType.INSERT_COMPOSITION_TEXT,
      targetValue,
      targetValue,
      targetValue.length,
      DEFAULT_SCALE,
      DEFAULT_MAX_DIGITS,
      isComposing
    );

  it.each([
    // composing text   note
    ['ni', 'pinyin, before any character is chosen'],
    ['ni hao', 'and once it has a space in it'],
    ['你好', 'the Chinese characters themselves'],
    ['你好ni hao', 'the mix the real device produced'],
    ['abc', 'plain letters that are not shortcuts']
  ])('refuses %j while composing (%s)', (text) => {
    const state = createInitialState(1234);
    const next = composing(state, text as string);

    expect(next.rejected).toBe(true);
    // The committed amount stays on screen rather than being replaced.
    expect(next.displayValue).toBe('1,234');
    expect(next.numericValue).toBe(1234);
  });

  /*
      What must keep working: Android composes digits a character at a time,
      and Samsung defers compositionend until blur, so a finished shortcut
      token still has to commit on sight.
   */
  it.each([
    // composing text  ->  displayValue  note
    ['2', '2', 'a digit mid-composition is held raw'],
    ['20', '20', 'and the next one'],
    ['1.5', '1.5', 'a decimal separator is composable'],
    ['2k', '2,000', 'a finished shortcut commits without compositionend'],
    ['-5', '-5', 'a minus sign is composable']
  ])('holds %j -> %j (%s)', (text, expected) => {
    const next = composing(createInitialState(null), text as string);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe(expected);
  });
});

/*
    reduceHistory is the entry point the hook calls for Ctrl+Z and Ctrl+Y. The
    undo and redo tables above reach undo() and redo() directly, so the
    dispatch between them — the exported function — was never executed.
 */
describe('reduceHistory', () => {
  const typed = (...values: string[]) =>
    values.reduce(
      (state, value) =>
        run(state, InputType.INSERT_TEXT, value.slice(-1), value, value.length),
      createInitialState(null)
    );

  it.each([
    ['undo', '1'],
    ['redo', '12']
  ])('dispatches %s', (direction, expected) => {
    const state = typed('1', '12');
    const undone = reduceHistory(state, 'undo');

    expect(
      direction === 'undo'
        ? undone.displayValue
        : reduceHistory(undone, 'redo').displayValue
    ).toBe(expected);
  });

  // Neither end of the history is an error; there is simply nothing to do.
  it.each([
    ['undo' as const, 'the start'],
    ['redo' as const, 'the end']
  ])('is a quiet no-op at %s of the history (%s)', (direction, _note) => {
    const state = createInitialState(1234);
    const next = reduceHistory(state, direction);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe('1,234');
  });
});

/*
    Some browsers report insertText with a null `data` rather than the
    character. The reducer falls back to an empty string, and nothing had ever
    handed it a null to prove that.
 */
describe('insertText with no data', () => {
  it('falls back rather than throwing', () => {
    const next = run(stateOf('1'), InputType.INSERT_TEXT, null, '12', 2);

    expect(next.displayValue).toBe('12');
    expect(next.rejected).toBe(false);
  });
});
