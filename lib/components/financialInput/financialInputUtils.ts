import { Nullable, StringKeyedMap } from '../../types';
import { Shortcut } from '../../enums';
import {
  CANONICAL_DECIMAL,
  DEFAULT_SEPARATORS,
  Separators,
  buildDecimalPattern,
  hasLeadingZero,
  hasMultipleDecimals,
  shiftDecimal,
  toCanonical
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

/** The public shape: characters to multipliers. */
export const DEFAULT_SHORTCUTS: StringKeyedMap<number> = {
  [Shortcut.HUNDRED]: 100,
  [Shortcut.THOUSAND]: 1_000,
  [Shortcut.MILLION]: 1_000_000,
  [Shortcut.BILLION]: 1_000_000_000
};

/** Whether negatives are accepted at all. */
export type Range = 'ALL' | 'POSITIVE';

/*
    Consumers configure shortcuts as multipliers, which is the natural way to
    think about them. Internally they are powers of ten, because that is what
    shiftDecimal needs to stay exact. A multiplier that is not a power of ten
    has no exact representation and is refused.
 */
export const toExponent = (multiplier: number): Nullable<number> => {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return null;
  }

  const exponent = Math.log10(multiplier);

  return Number.isInteger(exponent) ? exponent : null;
};

export const toExponents = (
  shortcuts: StringKeyedMap<number>
): StringKeyedMap<number> => {
  const exponents: StringKeyedMap<number> = {};

  Object.entries(shortcuts).forEach(([character, multiplier]) => {
    const exponent = toExponent(multiplier);

    if (exponent !== null) {
      exponents[character.toLowerCase()] = exponent;
    }
  });

  return exponents;
};

export const getShortcutExponent = (
  character: Nullable<string>,
  exponents: StringKeyedMap<number> = SHORTCUT_EXPONENTS
): Nullable<number> => {
  if (character === null || character.length !== 1) {
    return null;
  }

  const exponent = exponents[character.toLowerCase()];

  return exponent === undefined ? null : exponent;
};

export const isShortcut = (
  character: Nullable<string>,
  exponents: StringKeyedMap<number> = SHORTCUT_EXPONENTS
): boolean => getShortcutExponent(character, exponents) !== null;

/*
    Applies a shortcut to the digits typed before it. An empty base means the
    user typed the shortcut on its own, which reads as one of that unit —
    "k" is 1,000. An explicit "0" multiplies out to 0, as it should.
 */
export const applyShortcut = (
  base: string,
  character: string,
  separators: Separators = DEFAULT_SEPARATORS,
  exponents: StringKeyedMap<number> = SHORTCUT_EXPONENTS
): Nullable<string> => {
  const exponent = getShortcutExponent(character, exponents);

  if (exponent === null) {
    return null;
  }

  const canonical = toCanonical(base, separators);

  return shiftDecimal(canonical === '' ? '1' : canonical, exponent);
};

/*
    Extracts a number from arbitrary text — a paste, a drop, or an iOS
    autocorrect replacement. Unlike typing, this text was not filtered
    keystroke by keystroke, so it can be anything the clipboard held:
    "$1,234.56 USD", "(1,234.00)", "2.5m", or a paragraph of prose.

    Returns null when there is no number in there to take.
 */
export const sanitiseNumericText = (
  text: string,
  separators: Separators = DEFAULT_SEPARATORS,
  exponents: StringKeyedMap<number> = SHORTCUT_EXPONENTS
): Nullable<string> => {
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
  const exponent = trailing
    ? getShortcutExponent(trailing[1], exponents)
    : null;

  /*
      Everything that is not a digit or the configured fraction separator goes,
      which takes currency symbols, spaces, letters and grouping separators with
      it. The survivor is canonical once the fraction separator is normalised.
   */
  const digits = trimmed
    .replace(buildDecimalPattern(separators), '')
    .split(separators.decimal)
    .join(CANONICAL_DECIMAL);

  if (digits === '' || digits === CANONICAL_DECIMAL) {
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
  scale: number,
  separators: Separators = DEFAULT_SEPARATORS,
  range: Range = 'ALL'
): boolean => {
  /*
      A grouping separator or a space is never typed directly — both are
      formatter output, so their appearance in `data` means something was
      pasted or dropped rather than typed.
   */
  if (data.includes(separators.group) || /\s/.test(data)) {
    return false;
  }

  const canonical = toCanonical(targetValue, separators);

  if (range === 'POSITIVE' && canonical.startsWith('-')) {
    return false;
  }

  if (canonical === '' || canonical === '-') {
    return true;
  }

  if (canonical === CANONICAL_DECIMAL) {
    return scale > 0;
  }

  if (hasMultipleDecimals(canonical)) {
    return false;
  }

  const [integer, fraction = ''] = canonical.split(CANONICAL_DECIMAL);

  if (canonical.includes(CANONICAL_DECIMAL) && scale === 0) {
    return false;
  }

  return (
    !hasLeadingZero(canonical) &&
    !isAboveScale(fraction, scale) &&
    !isAboveMaxDigits(integer, maxDigits)
  );
};

/*
    Validates a number string produced by the library itself, such as the result
    of applying a shortcut.
 */
export const isValidNumberString = (
  canonical: Nullable<string>,
  maxDigits: number,
  scale: number,
  range: Range = 'ALL'
): boolean => {
  if (canonical === null) {
    return false;
  }

  if (range === 'POSITIVE' && canonical.startsWith('-')) {
    return false;
  }

  const [integer, fraction = ''] = canonical.split(CANONICAL_DECIMAL);

  return (
    !isAboveMaxDigits(integer, maxDigits) && !isAboveScale(fraction, scale)
  );
};
