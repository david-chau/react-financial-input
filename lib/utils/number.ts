import { Nullable } from '../types';

/*
    Phase 1 hardcodes the separators. Phase 2 turns these two constants into
    `groupSeparator` / `decimalSeparator` props, threaded through as parameters.
 */
export const GROUP_SEPARATOR = ',';
export const DECIMAL_SEPARATOR = '.';

/*
    Removes the grouping separators from a formatted number.
    Example: "123,456,789" to "123456789"
 */
export const stripGroupSeparators = (value: string): string =>
  value.split(GROUP_SEPARATOR).join('');

/*
    Parses a formatted number to a number. Returns null when there is nothing to
    parse yet — "", "." and "-" are all legitimate intermediate states while typing.
    Example: "123,456.78" to 123456.78
 */
export const parseNumber = (value: string): Nullable<number> => {
  const raw = stripGroupSeparators(value);

  if (raw === '' || raw === DECIMAL_SEPARATOR || raw === '-') {
    return null;
  }

  const parsed = Number(raw);

  return Number.isNaN(parsed) ? null : parsed;
};

/*
    Groups the digits of an integer. Deliberately never applied to a fraction —
    grouping the fraction is what turned ".1234" into ".1,234".
    Example: "123456789" to "123,456,789"
 */
export const groupInteger = (integer: string): string => {
  const isNegative = integer.startsWith('-');
  const digits = isNegative ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);

  return isNegative ? `-${grouped}` : grouped;
};

/*
    Formats a number string for display, grouping only the integer part and
    preserving a trailing decimal point and trailing zeros, so that "1.", "1.0"
    and "1.50" all survive a round trip while being typed.
    Example: "1234.50" to "1,234.50"
 */
export const formatNumberString = (value: string): string => {
  const raw = stripGroupSeparators(value);
  const decimalIndex = raw.indexOf(DECIMAL_SEPARATOR);

  if (decimalIndex === -1) {
    return groupInteger(raw);
  }

  return (
    groupInteger(raw.slice(0, decimalIndex)) +
    DECIMAL_SEPARATOR +
    raw.slice(decimalIndex + 1)
  );
};

export const formatNumber = (value: number): string =>
  formatNumberString(String(value));

/*
    Maps a caret position in the browser's unformatted value onto the formatted
    one, by counting the characters that are not grouping separators.

    Counting rather than adjusting by the change in separator count, because the
    latter only holds for a local edit: select-all then overtype changes the
    separator count by more than the caret moved, which drove the caret to 0 and
    reversed the next keystrokes.
 */
export const mapCursorToFormatted = (
  rawValue: string,
  rawCursor: number,
  formatted: string
): number => {
  let significant = 0;

  for (let i = 0; i < rawCursor && i < rawValue.length; i += 1) {
    if (rawValue[i] !== GROUP_SEPARATOR) {
      significant += 1;
    }
  }

  if (significant === 0) {
    return 0;
  }

  let seen = 0;

  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] !== GROUP_SEPARATOR) {
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
  value.includes(DECIMAL_SEPARATOR)
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;

/*
    Multiplies by a power of ten by moving the decimal point through the string.
    Exact by construction: "1.1" shifted 2 places is "110", where 1.1 * 100
    gives 110.00000000000001 in floating point. This is what replaced the
    bignumber.js dependency.
 */
export const shiftDecimal = (value: string, places: number): string => {
  const raw = stripGroupSeparators(value);

  if (places === 0) {
    return raw;
  }

  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  const decimalIndex = unsigned.indexOf(DECIMAL_SEPARATOR);

  const digits =
    decimalIndex === -1
      ? unsigned
      : unsigned.slice(0, decimalIndex) + unsigned.slice(decimalIndex + 1);
  const integerLength = decimalIndex === -1 ? unsigned.length : decimalIndex;
  const pointAt = integerLength + places;

  let shifted: string;

  if (pointAt <= 0) {
    shifted = `0${DECIMAL_SEPARATOR}${'0'.repeat(-pointAt)}${digits}`;
  } else if (pointAt >= digits.length) {
    shifted = digits + '0'.repeat(pointAt - digits.length);
  } else {
    shifted =
      digits.slice(0, pointAt) + DECIMAL_SEPARATOR + digits.slice(pointAt);
  }

  const normalised = trimTrailingFractionZeros(trimLeadingZeros(shifted));

  return isNegative ? `-${normalised}` : normalised;
};

export const hasMultipleDecimals = (value: string): boolean =>
  value.split(DECIMAL_SEPARATOR).length > 2;

export const containsDecimal = (value: string): boolean =>
  value.includes(DECIMAL_SEPARATOR);

/*
    A leading zero is only invalid in front of another digit — "0" and "0.5" are
    both legitimate things to be part-way through typing.
 */
export const hasLeadingZero = (value: string): boolean =>
  /^-?0[0-9]/.test(value);

export const containsOnlyNumberCharacters = (value: string): boolean =>
  /^-?[0-9]*\.?[0-9]*$/.test(stripGroupSeparators(value));
