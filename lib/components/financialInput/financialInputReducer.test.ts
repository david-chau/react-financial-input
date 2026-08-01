import { describe, expect, it } from 'vitest';
import { InputType } from '../../enums';
import {
  FinancialInputState,
  createInitialState,
  reduceInput
} from './financialInputReducer';
import { DEFAULT_MAX_DIGITS, DEFAULT_SCALE } from './financialInputUtils';

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
  maxDigits: number = DEFAULT_MAX_DIGITS
) =>
  reduceInput(state, {
    inputType,
    data,
    targetValue,
    selectionStart,
    scale,
    maxDigits
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

describe('unhandled input types', () => {
  /*
      These keep the previous value and stay quiet. They must not set `rejected`,
      because that would fire onError at the consumer for something the user did
      nothing wrong to trigger.
   */
  it.each([
    [InputType.INSERT_FROM_PASTE],
    [InputType.INSERT_FROM_DROP],
    [InputType.INSERT_COMPOSITION_TEXT],
    [InputType.DELETE_BY_CUT],
    [InputType.DELETE_CONTENT_FORWARD],
    ['historyUndo']
  ])('%s leaves the value untouched without erroring', (inputType) => {
    const state = stateOf('1,000', 1000);
    const next = run(state, inputType, '9', '1,0009', 6);

    expect(next.rejected).toBe(false);
    expect(next.displayValue).toBe('1,000');
    expect(next.numericValue).toBe(1000);
  });

  /*
      Phase 2. Recorded traces from real devices go here, replayed as reducer
      input. Left as todos so the intent is on record without a false green.
   */
  it.todo('android GBoard: insertCompositionText builds up "1", "12", "123"');
  it.todo('android GBoard: deleteContentBackward arrives with null data');
  it.todo('ios Safari: insertReplacementText from the QuickType bar');
  it.todo('paste of "1,234.56" is sanitised and accepted');
  it.todo('paste of "abc" is refused');
  it.todo('drag-and-drop text into the input');
});
