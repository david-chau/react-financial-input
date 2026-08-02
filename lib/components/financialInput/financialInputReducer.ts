import { Nullable } from '../../types';
import { InputType } from '../../enums';
import {
  DEFAULT_SEPARATORS,
  Separators,
  containsLetters,
  formatCanonical,
  formatNumber,
  formatNumberString,
  mapCursorToFormatted,
  parseNumber
} from '../../utils';
import {
  applyShortcut,
  isShortcut,
  isValidInsert,
  isValidNumberString,
  sanitiseNumericText
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
  separators: Separators;
  /*
      True between compositionstart and compositionend. Android soft keyboards
      emit insertCompositionText for every keystroke of a word still being
      composed, with data that cannot be trusted until the composition ends.
   */
  isComposing?: boolean;
}

export const createInitialState = (
  value?: Nullable<number>,
  separators: Separators = DEFAULT_SEPARATORS
): FinancialInputState => {
  const displayValue =
    value === null || value === undefined
      ? ''
      : formatNumber(value, separators);

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
  selectionStart: number,
  separators: Separators
): FinancialInputState => ({
  displayValue,
  numericValue: parseNumber(displayValue, separators),
  cursor: mapCursorToFormatted(
    targetValue,
    selectionStart,
    displayValue,
    separators
  ),
  rejected: false
});

const insert = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const { targetValue, selectionStart, scale, maxDigits, separators } = action;
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

    const shifted = applyShortcut(
      targetValue.replace(data, ''),
      data,
      separators
    );

    if (shifted === null || !isValidNumberString(shifted, maxDigits, scale)) {
      return reject(state, selectionStart - 1);
    }

    const displayValue = formatCanonical(shifted, separators);

    return {
      displayValue,
      numericValue: parseNumber(displayValue, separators),
      cursor: displayValue.length,
      rejected: false
    };
  }

  if (!isValidInsert(targetValue, data, maxDigits, scale, separators)) {
    return reject(state, selectionStart - 1);
  }

  return accept(
    formatNumberString(targetValue, separators),
    targetValue,
    selectionStart,
    separators
  );
};

const remove = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const { targetValue, selectionStart, separators } = action;

  /*
      Backspacing a grouping separator only moves the caret. The separator is
      formatter output, not something the user typed, so deleting it would just
      be undone by the next reformat.
   */
  if (state.displayValue.charAt(selectionStart) === separators.group) {
    return { ...state, cursor: selectionStart, rejected: false };
  }

  return accept(
    formatNumberString(targetValue, separators),
    targetValue,
    selectionStart,
    separators
  );
};

/*
    Cut, forward delete and the word/line deletes. Deleting can only ever remove
    characters from an already-valid value, so there is nothing to validate —
    just reformat what is left.
 */
const removeRange = (action: FinancialInputAction): FinancialInputState =>
  accept(
    formatNumberString(action.targetValue, action.separators),
    action.targetValue,
    action.selectionStart,
    action.separators
  );

/*
    Paste, drop, and iOS autocorrect replacements.

    This text never passed through the keystroke validation, so it is sanitised
    rather than rejected outright — "$1,234.56 USD" is a number a user plainly
    meant to enter. Text with no number in it is refused and the previous value
    kept.
 */
const replace = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const { targetValue, scale, maxDigits, separators } = action;

  const sanitised = sanitiseNumericText(targetValue, separators);

  if (sanitised === null || !isValidNumberString(sanitised, maxDigits, scale)) {
    return reject(state, state.cursor);
  }

  const displayValue = formatCanonical(sanitised, separators);

  return {
    displayValue,
    numericValue: parseNumber(displayValue, separators),
    cursor: displayValue.length,
    rejected: false
  };
};

/*
    Mid-composition. The value is shown exactly as the IME produced it, with no
    formatting and no committed numeric value: reformatting under a composing
    IME makes Android's keyboard fight the input, and the text is not final
    anyway. reduceCompositionEnd does the real work once it settles.
 */
const hold = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => ({
  ...state,
  displayValue: action.targetValue,
  cursor: action.selectionStart,
  rejected: false
});

/*
    compositionend. The composed text is final now, so it goes through the same
    sanitising path as a paste — Android's `data` is unreliable, but the input's
    value is not.
 */
export const reduceCompositionEnd = (
  state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState => {
  const next = replace(state, action);

  if (!next.rejected) {
    return next;
  }

  /*
      A refused commit cannot simply keep the current state: while composing,
      displayValue holds the IME's raw unvalidated text, so keeping it would
      leave "abc" on screen. Rebuild from the last committed numeric value,
      which hold() deliberately never touched.
   */
  return {
    ...createInitialState(state.numericValue, action.separators),
    rejected: true
  };
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
  maxDigits: number,
  separators: Separators = DEFAULT_SEPARATORS
): FinancialInputState => {
  const shifted = applyShortcut(state.displayValue, character, separators);

  if (shifted === null || !isValidNumberString(shifted, maxDigits, scale)) {
    return reject(state, state.cursor);
  }

  const displayValue = formatCanonical(shifted, separators);

  return {
    displayValue,
    numericValue: parseNumber(displayValue, separators),
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

    case InputType.DELETE_BY_CUT:
    case InputType.DELETE_BY_DRAG:
    case InputType.DELETE_CONTENT_FORWARD:
    case InputType.DELETE_WORD_BACKWARD:
    case InputType.DELETE_WORD_FORWARD:
    case InputType.DELETE_SOFT_LINE_BACKWARD:
    case InputType.DELETE_SOFT_LINE_FORWARD:
    case InputType.DELETE_ENTIRE_SOFT_LINE:
      return removeRange(action);

    case InputType.INSERT_FROM_PASTE:
    case InputType.INSERT_FROM_DROP:
    case InputType.INSERT_REPLACEMENT_TEXT:
      return replace(state, action);

    /*
        Some browsers emit insertCompositionText without ever firing the
        composition events, so this falls back to treating it as a paste
        rather than holding forever.
     */
    case InputType.INSERT_COMPOSITION_TEXT:
      return action.isComposing ? hold(state, action) : replace(state, action);

    /*
        The browser's undo stack tracks its own edits, not the reformatted
        value React renders, so replaying it would restore something that was
        never shown. Left alone, and quiet: the user did nothing wrong.
     */
    case InputType.HISTORY_UNDO:
    case InputType.HISTORY_REDO:
      return ignore(state);

    default:
      return ignore(state);
  }
};
