import { describe, expect, it } from 'vitest';
import {
  containsOnlyNumberCharacters,
  formatNumber,
  formatNumberString,
  groupInteger,
  hasLeadingZero,
  hasMultipleDecimals,
  mapCursorToFormatted,
  parseNumber,
  shiftDecimal,
  stripGroupSeparators
} from './number';

describe('groupInteger', () => {
  it.each([
    // integer          expected
    ['', ''],
    ['1', '1'],
    ['100', '100'],
    ['1000', '1,000'],
    ['123456789', '123,456,789'],
    ['-1000', '-1,000'],
    ['-123456789', '-123,456,789']
  ])('groupInteger(%j) -> %j', (integer, expected) => {
    expect(groupInteger(integer)).toBe(expected);
  });
});

describe('formatNumberString', () => {
  it.each([
    // raw               expected            note
    ['', '', 'empty stays empty'],
    ['1234', '1,234', 'groups the integer'],
    ['1234.5', '1,234.5', 'groups the integer only'],
    ['.1234', '.1234', 'regression: the fraction was grouped as ".1,234"'],
    ['1234.5678', '1,234.5678', 'regression: fraction left alone'],
    ['1.', '1.', 'a trailing decimal point survives being typed'],
    ['1.0', '1.0', 'a trailing zero survives being typed'],
    ['1.50', '1.50', 'trailing zeros are not normalised away'],
    ['.', '.', 'a lone decimal point is a valid intermediate state'],
    ['-1234.5', '-1,234.5', 'negatives group too'],
    ['1,2,34', '1,234', 'reformats a mangled value']
  ])('formatNumberString(%j) -> %j (%s)', (raw, expected) => {
    expect(formatNumberString(raw)).toBe(expected);
  });
});

describe('parseNumber', () => {
  it.each([
    // formatted        expected
    ['', null],
    ['.', null],
    ['-', null],
    ['0', 0],
    ['1,234', 1234],
    ['1,234.56', 1234.56],
    ['-1,234.56', -1234.56],
    ['1.', 1],
    ['0.5', 0.5]
  ])('parseNumber(%j) -> %j', (formatted, expected) => {
    expect(parseNumber(formatted)).toBe(expected);
  });
});

describe('shiftDecimal', () => {
  it.each([
    // value      places  expected     note
    ['1', 3, '1000', 'k on a whole number'],
    ['1.1', 2, '110', 'regression: 1.1 * 100 is 110.00000000000001 in floats'],
    [
      '4.35',
      2,
      '435',
      'regression: 4.35 * 100 is 434.99999999999994 in floats'
    ],
    ['0.07', 2, '7', 'regression: 0.07 * 100 is 7.000000000000001 in floats'],
    ['1.005', 2, '100.5', 'regression: 1.005 * 100 is 100.49999999999999'],
    ['1.1', 3, '1100', 'k on a fraction'],
    ['2.5', 6, '2500000', 'm'],
    ['1', 9, '1000000000', 'b'],
    ['1', 2, '100', 'h'],
    ['0.5', 2, '50', 'shifting past the decimal point'],
    ['0.001', 2, '0.1', 'still a fraction afterwards'],
    ['1.005', 2, '100.5', 'partial shift'],
    ['0', 3, '0', 'zero multiplies out to zero'],
    ['-1.1', 3, '-1100', 'negatives keep their sign'],
    ['1', 0, '1', 'no shift'],
    ['1,000', 3, '1000000', 'strips grouping separators first']
  ])('shiftDecimal(%j, %i) -> %j (%s)', (value, places, expected) => {
    expect(shiftDecimal(value, places)).toBe(expected);
  });

  it.each([
    // value   places  product          exact
    ['1.1', 2, 1.1 * 100, 110],
    ['4.35', 2, 4.35 * 100, 435],
    ['0.07', 2, 0.07 * 100, 7],
    ['1.005', 2, 1.005 * 100, 100.5]
  ])(
    'shiftDecimal(%j, %i) is exact where the float product %d is not',
    (value, places, product, exact) => {
      expect(product).not.toBe(exact);
      expect(Number(shiftDecimal(value as string, places as number))).toBe(
        exact
      );
    }
  );
});

describe('hasLeadingZero', () => {
  it.each([
    // value    expected  note
    ['0', false, 'a lone zero is fine'],
    ['0.5', false, 'zero before a decimal point is fine'],
    ['01', true, 'zero before a digit is not'],
    ['00', true, 'two zeros'],
    ['-01', true, 'negative with a leading zero'],
    ['10', false, 'trailing zero is fine']
  ])('hasLeadingZero(%j) -> %s (%s)', (value, expected) => {
    expect(hasLeadingZero(value)).toBe(expected);
  });
});

describe('miscellaneous predicates', () => {
  it.each([
    ['1.2.3', true],
    ['1.23', false],
    ['123', false]
  ])('hasMultipleDecimals(%j) -> %s', (value, expected) => {
    expect(hasMultipleDecimals(value)).toBe(expected);
  });

  it.each([
    ['1,234,567', '1234567'],
    ['1234', '1234'],
    ['', '']
  ])('stripGroupSeparators(%j) -> %j', (value, expected) => {
    expect(stripGroupSeparators(value)).toBe(expected);
  });

  it.each([
    // rawValue        rawCursor  formatted      expected  note
    ['1', 1, '1', 1, 'first character'],
    ['1,0000', 6, '10,000', 6, 'caret stays at the end after regrouping'],
    ['9999', 4, '9,999', 5, 'caret moves past a newly inserted separator'],
    ['1,00', 4, '100', 3, 'caret moves back when a separator disappears'],
    ['1,234,56', 8, '123,456', 7, 'regrouping down a level'],
    [
      '4',
      1,
      '4',
      1,
      'regression: select-all then overtype drove the caret to 0, reversing digits'
    ],
    ['', 0, '', 0, 'empty value'],
    ['1234567', 0, '1,234,567', 0, 'caret at the start stays at the start'],
    ['1234567', 3, '1,234,567', 4, 'caret in the middle skips the separator']
  ])(
    'mapCursorToFormatted(%j, %i, %j) -> %i (%s)',
    (rawValue, rawCursor, formatted, expected) => {
      expect(
        mapCursorToFormatted(
          rawValue as string,
          rawCursor as number,
          formatted as string
        )
      ).toBe(expected);
    }
  );

  it.each([
    ['1234', true],
    ['1,234.56', true],
    ['-1.5', true],
    ['1e21', false],
    ['1k', false],
    ['abc', false]
  ])('containsOnlyNumberCharacters(%j) -> %s', (value, expected) => {
    expect(containsOnlyNumberCharacters(value)).toBe(expected);
  });

  it.each([
    [1234, '1,234'],
    [1234.5, '1,234.5'],
    [0, '0'],
    [-1000, '-1,000']
  ])('formatNumber(%d) -> %j', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });
});
