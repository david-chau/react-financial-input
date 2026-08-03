import { Nullable } from '../types';

export interface Separators {
  /** Groups thousands. "," in en-US, "." in de-DE, a space in fr-FR. */
  group: string;
  /** Separates the fraction. "." in en-US, "," in de-DE. */
  decimal: string;
  /*
      Digits per group, counted from the right, with the last entry repeating.

      [3] is the familiar thousands grouping and the default. [3, 2] is the
      Indian lakh/crore system, where 1234567890 is written 1,23,45,67,890 —
      three digits, then twos. Nine of the thirty locales checked use it:
      every Indian language, plus Nepali and Dzongkha.
   */
  groupSizes?: readonly number[];
}

export const DEFAULT_SEPARATORS: Separators = {
  group: ',',
  decimal: '.',
  // Thousands, which is what every locale does except the lakh/crore ones.
  groupSizes: [3]
};

/*
    Everything in here works in one of two forms, and keeping them straight is
    what stops separator support leaking into every function:

      display    what the user sees, using the configured separators
                 "1.234,50" in de-DE
      canonical  no grouping, always a "." fraction — what Number() parses
                 "1234.50"

    Only the boundary functions know about separators. Validation, arithmetic
    and comparison all work on canonical strings.
 */
export const CANONICAL_DECIMAL = '.';

const escapeForRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** display -> canonical */
export const toCanonical = (
  value: string,
  separators: Separators = DEFAULT_SEPARATORS
): string =>
  value
    .split(separators.group)
    .join('')
    .split(separators.decimal)
    .join(CANONICAL_DECIMAL);

/*
    Removes the grouping separators, leaving the fraction separator alone.
    Example: "123,456.78" to "123456.78"
 */
export const stripGroupSeparators = (
  value: string,
  separators: Separators = DEFAULT_SEPARATORS
): string => value.split(separators.group).join('');

/*
    Parses a displayed number. Returns null when there is nothing to parse yet —
    "", "." and "-" are all legitimate intermediate states while typing.
    Example: "123,456.78" to 123456.78
 */
export const parseNumber = (
  value: string,
  separators: Separators = DEFAULT_SEPARATORS
): Nullable<number> => {
  const canonical = toCanonical(value, separators);

  if (
    canonical === '' ||
    canonical === CANONICAL_DECIMAL ||
    canonical === '-'
  ) {
    return null;
  }

  const parsed = Number(canonical);

  return Number.isNaN(parsed) ? null : parsed;
};

/*
    Groups the digits of an integer. Deliberately never applied to a fraction —
    grouping the fraction is what turned ".1234" into ".1,234".
    Example: "123456789" to "123,456,789"
 */
export const groupInteger = (
  integer: string,
  separators: Separators = DEFAULT_SEPARATORS
): string => {
  const isNegative = integer.startsWith('-');
  const digits = isNegative ? integer.slice(1) : integer;
  const sizes = separators.groupSizes ?? [3];

  /*
      Walked from the right rather than matched with a regex, because the group
      size is not constant. The old /\B(?=(\d{3})+(?!\d))/ could only ever
      produce thousands, which quietly gave 12,345,678 where an Indian locale
      wants 1,23,45,678.
   */
  const groups: string[] = [];
  let end = digits.length;
  let step = 0;

  while (end > 0) {
    const size = sizes[Math.min(step, sizes.length - 1)];
    const start = Math.max(0, end - size);

    groups.unshift(digits.slice(start, end));
    end = start;
    step += 1;
  }

  const grouped = groups.join(separators.group);

  return isNegative ? `-${grouped}` : grouped;
};

/*
    canonical -> display. Groups only the integer part and preserves a trailing
    separator and trailing zeros, so that "1.", "1.0" and "1.50" all survive a
    round trip while being typed.
 */
export const formatCanonical = (
  canonical: string,
  separators: Separators = DEFAULT_SEPARATORS
): string => {
  const decimalIndex = canonical.indexOf(CANONICAL_DECIMAL);

  if (decimalIndex === -1) {
    return groupInteger(canonical, separators);
  }

  return (
    groupInteger(canonical.slice(0, decimalIndex), separators) +
    separators.decimal +
    canonical.slice(decimalIndex + 1)
  );
};

/*
    Reformats a displayed value: display -> canonical -> display.
    Example: "1,2,34.5" to "1,234.5"
 */
export const formatNumberString = (
  value: string,
  separators: Separators = DEFAULT_SEPARATORS
): string => formatCanonical(toCanonical(value, separators), separators);

export const formatNumber = (
  value: number,
  separators: Separators = DEFAULT_SEPARATORS
): string => formatCanonical(String(value), separators);

/*
    Maps a caret position in the browser's raw value onto the formatted one, by
    counting the characters that are not grouping separators.

    Counting rather than adjusting by the change in separator count, because the
    latter only holds for a local edit: select-all then overtype changes the
    separator count by more than the caret moved, which drove the caret to 0 and
    reversed the next keystrokes.
 */
export const mapCursorToFormatted = (
  rawValue: string,
  rawCursor: number,
  formatted: string,
  separators: Separators = DEFAULT_SEPARATORS
): number => {
  let significant = 0;

  for (let i = 0; i < rawCursor && i < rawValue.length; i += 1) {
    if (rawValue[i] !== separators.group) {
      significant += 1;
    }
  }

  if (significant === 0) {
    return 0;
  }

  let seen = 0;

  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] !== separators.group) {
      seen += 1;

      if (seen === significant) {
        return i + 1;
      }
    }
  }

  return formatted.length;
};

const trimLeadingZeros = (value: string): string =>
  value.replace(/^(-?)0+(?=\d)/, '$1');

const trimTrailingFractionZeros = (value: string): string =>
  value.includes(CANONICAL_DECIMAL)
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;

/*
    Multiplies a canonical string by a power of ten by moving the decimal point
    through it. Exact by construction: "1.1" shifted 2 places is "110", where
    1.1 * 100 gives 110.00000000000001 in floating point. This is what replaced
    the bignumber.js dependency.
 */
export const shiftDecimal = (canonical: string, places: number): string => {
  if (places === 0) {
    return canonical;
  }

  const isNegative = canonical.startsWith('-');
  const unsigned = isNegative ? canonical.slice(1) : canonical;
  const decimalIndex = unsigned.indexOf(CANONICAL_DECIMAL);

  const digits =
    decimalIndex === -1
      ? unsigned
      : unsigned.slice(0, decimalIndex) + unsigned.slice(decimalIndex + 1);
  const integerLength = decimalIndex === -1 ? unsigned.length : decimalIndex;
  const pointAt = integerLength + places;

  let shifted: string;

  if (pointAt <= 0) {
    shifted = `0${CANONICAL_DECIMAL}${'0'.repeat(-pointAt)}${digits}`;
  } else if (pointAt >= digits.length) {
    shifted = digits + '0'.repeat(pointAt - digits.length);
  } else {
    shifted =
      digits.slice(0, pointAt) + CANONICAL_DECIMAL + digits.slice(pointAt);
  }

  const normalised = trimTrailingFractionZeros(trimLeadingZeros(shifted));

  return isNegative ? `-${normalised}` : normalised;
};

/** Operates on canonical strings. */
export const hasMultipleDecimals = (canonical: string): boolean =>
  canonical.split(CANONICAL_DECIMAL).length > 2;

/*
    A leading zero is only invalid in front of another digit — "0" and "0.5" are
    both legitimate things to be part-way through typing.
 */
export const hasLeadingZero = (canonical: string): boolean =>
  /^-?0[0-9]/.test(canonical);

export const containsOnlyNumberCharacters = (canonical: string): boolean =>
  /^-?[0-9]*\.?[0-9]*$/.test(canonical);

/*
    A group separator equal to the decimal separator would make the value
    ambiguous, and an empty one would make grouping a no-op the parser could not
    undo.
 */
export const areSeparatorsValid = (separators: Separators): boolean =>
  separators.group !== separators.decimal &&
  separators.decimal !== '' &&
  !/[0-9-]/.test(separators.group + separators.decimal);

export const buildDecimalPattern = (separators: Separators): RegExp =>
  new RegExp(`[^0-9${escapeForRegExp(separators.decimal)}]`, 'g');

/*
    A fraction separator that is part of a currency symbol rather than part of
    the number: the "." in "Cg.", "kr." or "Rs.".

    Without this, "Cg.1234" sanitises to ".1234" and reads as 0.1234 — a wrong
    amount, off by four orders of magnitude — and "1,234.56 Cg." is refused
    outright for holding two decimal points.

    A separator touching a letter belongs to that letter. Written with a
    lookahead and a capture rather than a lookbehind, which older WebKit does
    not support.
 */
export const buildSymbolPunctuationPattern = (
  separators: Separators
): RegExp => {
  const decimal = escapeForRegExp(separators.decimal);

  return new RegExp(`([a-z])${decimal}|${decimal}(?=[a-z])`, 'gi');
};
