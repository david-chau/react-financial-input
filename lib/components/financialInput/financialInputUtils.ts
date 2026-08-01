import { Nullable, StringKeyedMap } from '../../types';
import { Shortcut } from '../../enums';
import {
  DECIMAL_SEPARATOR,
  hasLeadingZero,
  hasMultipleDecimals,
  hasSeparatorOrSpace,
  shiftDecimal,
  stripGroupSeparators
} from '../../utils';

export const DEFAULT_SCALE = 2;
export const DEFAULT_MAX_DIGITS = 11;

/*
    Stored as powers of ten rather than multipliers so that shiftDecimal can
    consume them directly and stay exact.
 */
export const SHORTCUT_EXPONENTS: StringKeyedMap<number> = {
  [Shortcut.HUNDRED]: 2,
  [Shortcut.THOUSAND]: 3,
  [Shortcut.MILLION]: 6,
  [Shortcut.BILLION]: 9
};

export const getShortcutExponent = (
  character: Nullable<string>
): Nullable<number> => {
  if (character === null || character.length !== 1) {
    return null;
  }

  const exponent = SHORTCUT_EXPONENTS[character.toLowerCase()];

  return exponent === undefined ? null : exponent;
};

export const isShortcut = (character: Nullable<string>): boolean =>
  getShortcutExponent(character) !== null;

/*
    Applies a shortcut to the digits typed before it. An empty base means the
    user typed the shortcut on its own, which reads as one of that unit —
    "k" is 1,000. An explicit "0" multiplies out to 0, as it should.
 */
export const applyShortcut = (
  base: string,
  character: string
): Nullable<string> => {
  const exponent = getShortcutExponent(character);

  if (exponent === null) {
    return null;
  }

  const raw = stripGroupSeparators(base);

  return shiftDecimal(raw === '' ? '1' : raw, exponent);
};

/*
    Extracts a number from arbitrary text — a paste, a drop, or an iOS
    autocorrect replacement. Unlike typing, this text was not filtered
    keystroke by keystroke, so it can be anything the clipboard held:
    "$1,234.56 USD", "(1,234.00)", "2.5m", or a paragraph of prose.

    Returns null when there is no number in there to take.
 */
export const sanitiseNumericText = (text: string): Nullable<string> => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return null;
  }

  /*
      Accountants write negatives in parentheses, and spreadsheets copy them
      out that way.
   */
  const isNegative = trimmed.startsWith('-') || /^\(.*\)$/.test(trimmed);

  // A trailing shortcut letter, so pasting "2.5m" behaves like typing it.
  const trailing = trimmed.match(/([a-z])\s*\)?\s*$/i);
  const exponent = trailing ? getShortcutExponent(trailing[1]) : null;

  const digits = trimmed.replace(
    new RegExp(`[^0-9\\${DECIMAL_SEPARATOR}]`, 'g'),
    ''
  );

  if (digits === '' || digits === DECIMAL_SEPARATOR) {
    return null;
  }

  if (hasMultipleDecimals(digits)) {
    return null;
  }

  const shifted = exponent === null ? digits : shiftDecimal(digits, exponent);
  const normalised = shifted.replace(/^0+(?=\d)/, '');

  return isNegative ? `-${normalised}` : normalised;
};

export const isAboveScale = (fraction: string, scale: number): boolean =>
  fraction.length > scale;

export const isAboveMaxDigits = (integer: string, maxDigits: number): boolean =>
  integer.replace('-', '').length > maxDigits;

/*
    Validates the value the browser has already put in the input, before it is
    accepted and reformatted. Splitting on the decimal separator is the fix for
    the bug where the scale limit was never enforced: the old code stripped the
    grouping separators and then split the result on a grouping separator, so
    the fraction was always empty.
 */
export const isValidInsert = (
  targetValue: string,
  data: string,
  maxDigits: number,
  scale: number
): boolean => {
  if (hasSeparatorOrSpace(data)) {
    return false;
  }

  const raw = stripGroupSeparators(targetValue);

  if (raw === '' || raw === '-') {
    return true;
  }

  if (raw === DECIMAL_SEPARATOR) {
    return scale > 0;
  }

  if (hasMultipleDecimals(raw)) {
    return false;
  }

  const [integer, fraction = ''] = raw.split(DECIMAL_SEPARATOR);

  if (raw.includes(DECIMAL_SEPARATOR) && scale === 0) {
    return false;
  }

  return (
    !hasLeadingZero(raw) &&
    !isAboveScale(fraction, scale) &&
    !isAboveMaxDigits(integer, maxDigits)
  );
};

/*
    Validates a number string produced by the library itself, such as the result
    of applying a shortcut.
 */
export const isValidNumberString = (
  value: Nullable<string>,
  maxDigits: number,
  scale: number
): boolean => {
  if (value === null) {
    return false;
  }

  const [integer, fraction = ''] = value.split(DECIMAL_SEPARATOR);

  return (
    !isAboveMaxDigits(integer, maxDigits) && !isAboveScale(fraction, scale)
  );
};
