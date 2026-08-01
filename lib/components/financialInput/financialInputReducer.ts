import { Nullable } from '../../types';
import { InputType } from '../../enums';
import {
  GROUP_SEPARATOR,
  containsLetters,
  formatNumber,
  formatNumberString,
  mapCursorToFormatted,
  parseNumber
} from '../../utils';
import {
  applyShortcut,
  isShortcut,
  isValidInsert,
  isValidNumberString
} from './financialInputUtils';

export interface FinancialInputState {
  /** What the input shows, formatted. */
  displayValue: string;
  /** The committed numeric value, or null while the value is incomplete. */
  numericValue: Nullable<number>;
  /** Where the caret should sit once React has re-rendered. */
  cursor: number;
  /** True when the action was refused and the previous value was kept. */
  rejected: boolean;
}

export interface FinancialInputAction {
  inputType: string;
  /** The characters the browser inserted. Null for most delete operations. */
  data: Nullable<string>;
  /** The input's value *after* the browser applied the edit. */
  targetValue: string;
  selectionStart: number;
  scale: number;
  maxDigits: number;
}

export const createInitialState = (
  value?: Nullable<number>
): FinancialInputState => {
  const displayValue =
    value === null || value === undefined ? '' : formatNumber(value);

  return {
    displayValue,
    numericValue: value ?? null,
    cursor: displayValue.length,
    rejected: false
  };
};

/*
    Keeps the previous value and puts the caret back where the refused character
    would have been, so the input visibly refuses rather than silently swallowing.
 */
const reject = (
  state: FinancialInputState,
  cursor: number
): FinancialInputState => ({
  ...state,
  cursor: Math.max(0, cursor),
  rejected: true
});

/*
    Keeps the previous value without reporting an error. Used for input types
    that are not handled yet: the edit is undone, but the user did not do
    anything wrong, so onError must stay quiet.
 */
const ignore = (state: FinancialInputState): FinancialInputState => ({
  ...state,
  rejected: false
});

const accept = (
  displayValue: string,
  targetValue: string,
  selectionStart: number
): FinancialInputState => ({
  displayValue,
  numericValue: parseNumber(displayValue),
  cursor: mapCursorToFormatted(targetValue, selectionStart, displayValue),
  rejected: false
});

const insert = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const { targetValue, selectionStart, scale, maxDigits } = action;
  const data = action.data ?? '';

  /*
      A letter in the value means a shortcut was typed. Anything that is not a
      known shortcut character is refused before the value is validated, so that
      "1a" never reaches the number parsing.
   */
  if (containsLetters(targetValue)) {
    if (!isShortcut(data)) {
      return reject(state, selectionStart - 1);
    }

    const shifted = applyShortcut(targetValue.replace(data, ''), data);

    if (shifted === null || !isValidNumberString(shifted, maxDigits, scale)) {
      return reject(state, selectionStart - 1);
    }

    const displayValue = formatNumberString(shifted);

    return {
      displayValue,
      numericValue: parseNumber(displayValue),
      cursor: displayValue.length,
      rejected: false
    };
  }

  if (!isValidInsert(targetValue, data, maxDigits, scale)) {
    return reject(state, selectionStart - 1);
  }

  return accept(formatNumberString(targetValue), targetValue, selectionStart);
};

const remove = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const { targetValue, selectionStart } = action;

  /*
      Backspacing a grouping separator only moves the caret. The separator is
      formatter output, not something the user typed, so deleting it would just
      be undone by the next reformat.
   */
  if (state.displayValue.charAt(selectionStart) === GROUP_SEPARATOR) {
    return { ...state, cursor: selectionStart, rejected: false };
  }

  return accept(formatNumberString(targetValue), targetValue, selectionStart);
};

/*
    Applies a shortcut to the current value without anything having been typed.

    Mobile numeric keypads have no letter keys, so on a phone the h/k/m/b
    shortcuts are physically unreachable. This is what lets a consumer put a tap
    target next to the input and get the same result.
 */
export const reduceShortcut = (
  state: FinancialInputState,
  character: string,
  scale: number,
  maxDigits: number
): FinancialInputState => {
  const shifted = applyShortcut(state.displayValue, character);

  if (shifted === null || !isValidNumberString(shifted, maxDigits, scale)) {
    return reject(state, state.cursor);
  }

  const displayValue = formatNumberString(shifted);

  return {
    displayValue,
    numericValue: parseNumber(displayValue),
    cursor: displayValue.length,
    rejected: false
  };
};

/*
    Pure. Every platform quirk becomes a row in the reducer's test table rather
    than a branch in the component.
 */
export const reduceInput = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  switch (action.inputType) {
    case InputType.INSERT_TEXT:
      return insert(state, action);

    case InputType.DELETE_CONTENT_BACKWARD:
      return remove(state, action);

    /*
        Phase 2. These keep the previous value, which is what the component
        already did in practice — the old handlers were empty, so React
        re-rendered the previous value and the edit was reverted anyway. They
        are ignored rather than rejected: the user did nothing wrong, so
        onError must stay quiet until these are properly implemented.
     */
    case InputType.INSERT_FROM_PASTE:
    case InputType.INSERT_FROM_DROP:
    case InputType.INSERT_COMPOSITION_TEXT:
    case InputType.DELETE_BY_CUT:
    case InputType.DELETE_CONTENT_FORWARD:
      return ignore(state);

    default:
      return ignore(state);
  }
};
