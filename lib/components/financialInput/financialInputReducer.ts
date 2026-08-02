import { Nullable, StringKeyedMap } from '../../types';
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
  Range,
  SHORTCUT_EXPONENTS,
  applyShortcut,
  isShortcut,
  isValidInsert,
  isValidNumberString,
  sanitiseNumericText
} from './financialInputUtils';

/** One point in the undo history. */
export interface FinancialInputSnapshot {
  displayValue: string;
  numericValue: Nullable<number>;
  cursor: number;
}

/*
    Long enough that undo feels unlimited in a single-field form, short enough
    that the state cannot grow without bound.
 */
export const HISTORY_LIMIT = 100;

export interface FinancialInputState extends FinancialInputSnapshot {
  /** True when the action was refused and the previous value was kept. */
  rejected: boolean;
  /*
      The component owns undo, because the browser's stack cannot be used: it
      holds the raw text the browser inserted, not the reformatted value React
      rendered, so replaying it restores something the user never saw. Newest
      last.
   */
  past: FinancialInputSnapshot[];
  /** Undone snapshots, newest first. Cleared by any fresh edit. */
  future: FinancialInputSnapshot[];
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
  /** Shortcut characters to powers of ten. */
  exponents: StringKeyedMap<number>;
  range: Range;
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
    rejected: false,
    past: [],
    future: []
  };
};

const snapshotOf = (state: FinancialInputState): FinancialInputSnapshot => ({
  displayValue: state.displayValue,
  numericValue: state.numericValue,
  cursor: state.cursor
});

/*
    Records the previous value in the undo history, unless nothing visible
    changed. A fresh edit discards anything that had been undone, which is how
    every text editor behaves.
 */
const remember = (
  previous: FinancialInputState,
  next: FinancialInputState
): FinancialInputState => {
  if (next.rejected || next.displayValue === previous.displayValue) {
    return next;
  }

  return {
    ...next,
    past: [...previous.past, snapshotOf(previous)].slice(-HISTORY_LIMIT),
    future: []
  };
};

/*
    Undo and redo move a snapshot between the two stacks. `rejected` stays
    false at the boundaries: reaching the end of the history is not an error.
 */
/*
    Driven from the keystroke rather than the historyUndo input type.

    The browser only emits historyUndo while its *own* undo stack has entries,
    and that stack is exhausted as soon as React overwrites the value — so the
    first Ctrl+Z arrives and the second never does. Intercepting the key is the
    only way to make repeated undo work.
 */
export const reduceHistory = (
  state: FinancialInputState,
  direction: 'undo' | 'redo'
): FinancialInputState => (direction === 'undo' ? undo(state) : redo(state));

const undo = (state: FinancialInputState): FinancialInputState => {
  const previous = state.past[state.past.length - 1];

  if (!previous) {
    return { ...state, rejected: false };
  }

  return {
    ...previous,
    rejected: false,
    past: state.past.slice(0, -1),
    future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT)
  };
};

const redo = (state: FinancialInputState): FinancialInputState => {
  const [next, ...rest] = state.future;

  if (!next) {
    return { ...state, rejected: false };
  }

  return {
    ...next,
    rejected: false,
    past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
    future: rest
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
  state: FinancialInputState,
  displayValue: string,
  targetValue: string,
  selectionStart: number,
  separators: Separators
): FinancialInputState => ({
  ...state,
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
  const {
    targetValue,
    selectionStart,
    scale,
    maxDigits,
    separators,
    exponents,
    range
  } = action;
  const data = action.data ?? '';

  /*
      A letter in the value means a shortcut was typed. Anything that is not a
      known shortcut character is refused before the value is validated, so that
      "1a" never reaches the number parsing.
   */
  if (containsLetters(targetValue)) {
    if (!isShortcut(data, exponents)) {
      return reject(state, selectionStart - 1);
    }

    const shifted = applyShortcut(
      targetValue.replace(data, ''),
      data,
      separators,
      exponents
    );

    if (
      shifted === null ||
      !isValidNumberString(shifted, maxDigits, scale, range)
    ) {
      return reject(state, selectionStart - 1);
    }

    const displayValue = formatCanonical(shifted, separators);

    return {
      ...state,
      displayValue,
      numericValue: parseNumber(displayValue, separators),
      cursor: displayValue.length,
      rejected: false
    };
  }

  if (!isValidInsert(targetValue, data, maxDigits, scale, separators, range)) {
    return reject(state, selectionStart - 1);
  }

  return accept(
    state,
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
    state,
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
const removeRange = (
  _state: FinancialInputState,
  action: FinancialInputAction
): FinancialInputState =>
  accept(
    _state,
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
  const { targetValue, scale, maxDigits, separators, exponents, range } =
    action;

  const sanitised = sanitiseNumericText(targetValue, separators, exponents);

  if (
    sanitised === null ||
    !isValidNumberString(sanitised, maxDigits, scale, range)
  ) {
    return reject(state, state.cursor);
  }

  const displayValue = formatCanonical(sanitised, separators);

  return {
    ...state,
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
  const next = remember(state, replace(state, action));

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
    rejected: true,
    past: state.past,
    future: state.future
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
  separators: Separators = DEFAULT_SEPARATORS,
  exponents: StringKeyedMap<number> = SHORTCUT_EXPONENTS,
  range: Range = 'ALL'
): FinancialInputState => {
  const shifted = applyShortcut(
    state.displayValue,
    character,
    separators,
    exponents
  );

  if (
    shifted === null ||
    !isValidNumberString(shifted, maxDigits, scale, range)
  ) {
    return reject(state, state.cursor);
  }

  const displayValue = formatCanonical(shifted, separators);

  return remember(state, {
    ...state,
    displayValue,
    numericValue: parseNumber(displayValue, separators),
    cursor: displayValue.length,
    rejected: false
  });
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
      return remember(state, insert(state, action));

    case InputType.DELETE_CONTENT_BACKWARD:
      return remember(state, remove(state, action));

    case InputType.DELETE_BY_CUT:
    case InputType.DELETE_BY_DRAG:
    case InputType.DELETE_CONTENT_FORWARD:
    case InputType.DELETE_WORD_BACKWARD:
    case InputType.DELETE_WORD_FORWARD:
    case InputType.DELETE_SOFT_LINE_BACKWARD:
    case InputType.DELETE_SOFT_LINE_FORWARD:
    case InputType.DELETE_ENTIRE_SOFT_LINE:
      return remember(state, removeRange(state, action));

    case InputType.INSERT_FROM_PASTE:
    case InputType.INSERT_FROM_DROP:
    case InputType.INSERT_REPLACEMENT_TEXT:
      return remember(state, replace(state, action));

    /*
        Some browsers emit insertCompositionText without ever firing the
        composition events, so this falls back to treating it as a paste
        rather than holding forever.

        Nothing is remembered mid-composition: the raw text is not a value the
        user could meaningfully undo to. reduceCompositionEnd records the
        committed result instead.
     */
    case InputType.INSERT_COMPOSITION_TEXT:
      return action.isComposing
        ? hold(state, action)
        : remember(state, replace(state, action));

    case InputType.HISTORY_UNDO:
      return undo(state);

    case InputType.HISTORY_REDO:
      return redo(state);

    default:
      return ignore(state);
  }
};
