import { describe, expect, it } from 'vitest';
import { InputType } from '../../enums';
import { DEFAULT_SEPARATORS, Separators } from '../../utils';
import {
  FinancialInputState,
  createInitialState,
  reduceCompositionEnd,
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
  rejected: false
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
  it.each([
    ['abc', 'letters'],
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
