import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_DIGITS,
  DEFAULT_SCALE,
  applyShortcut,
  getShortcutExponent,
  isShortcut,
  isValidInsert,
  isValidNumberString
} from './financialInputUtils';

describe('shortcuts', () => {
  it.each([
    // character  expected
    ['h', 2],
    ['k', 3],
    ['m', 6],
    ['b', 9],
    ['K', 3],
    ['M', 6],
    ['x', null],
    ['', null],
    ['kk', null],
    [null, null]
  ])('getShortcutExponent(%j) -> %j', (character, expected) => {
    expect(getShortcutExponent(character)).toBe(expected);
  });

  it.each([
    ['k', true],
    ['z', false],
    [null, false]
  ])('isShortcut(%j) -> %s', (character, expected) => {
    expect(isShortcut(character)).toBe(expected);
  });

  it.each([
    // base       character  expected      note
    ['1', 'k', '1000', 'the common case'],
    ['2.5', 'm', '2500000', 'a fraction expands exactly'],
    [
      '1.1',
      'h',
      '110',
      'no floating point drift: 1.1 * 100 is 110.00000000000001'
    ],
    ['', 'k', '1000', 'a bare shortcut reads as one of that unit'],
    ['0', 'k', '0', 'an explicit zero multiplies out to zero'],
    ['1,234', 'k', '1234000', 'grouping separators are stripped first'],
    ['1', 'z', null, 'not a shortcut'],
    ['-2', 'k', '-2000', 'negatives keep their sign']
  ])('applyShortcut(%j, %j) -> %j (%s)', (base, character, expected, _note) => {
    expect(applyShortcut(base as string, character as string)).toBe(expected);
  });
});

describe('isValidInsert', () => {
  const scale = DEFAULT_SCALE;
  const maxDigits = DEFAULT_MAX_DIGITS;

  it.each([
    // targetValue        data  scale  expected  note
    ['1', '1', 2, true, 'a digit'],
    ['1234', '4', 2, true, 'more digits'],
    ['1.5', '5', 2, true, 'one decimal place'],
    ['1.55', '5', 2, true, 'exactly at the scale limit'],
    [
      '1.234',
      '4',
      2,
      false,
      'regression: scale was never enforced on this path'
    ],
    ['1.5', '5', 0, false, 'scale 0 rejects any decimal'],
    ['.', '.', 2, true, 'a lone decimal point is a valid start'],
    ['.', '.', 0, false, 'unless decimals are off'],
    ['1.2.3', '.', 2, false, 'two decimal points'],
    ['01', '1', 2, false, 'a leading zero'],
    ['0', '0', 2, true, 'a lone zero'],
    ['0.5', '5', 2, true, 'zero before a decimal point'],
    ['', '', 2, true, 'an empty value'],
    ['1 2', ' ', 2, false, 'a space is never typed into a number'],
    ['1,2', ',', 2, false, 'nor is a grouping separator'],
    ['-1', '-', 2, true, 'a negative']
  ])(
    'isValidInsert(%j, %j, scale %i) -> %s (%s)',
    (targetValue, data, testScale, expected) => {
      expect(isValidInsert(targetValue, data, maxDigits, testScale)).toBe(
        expected
      );
    }
  );

  it.each([
    // targetValue         maxDigits  expected  note
    ['12345678901', 11, true, 'exactly at the digit limit'],
    ['123456789012', 11, false, 'one digit over'],
    ['-12345678901', 11, true, 'the sign does not count towards the limit'],
    ['1234.56', 4, true, 'only the integer counts towards the limit'],
    ['12345.6', 4, false, 'integer over the limit']
  ])(
    'isValidInsert(%j, maxDigits %i) -> %s (%s)',
    (targetValue, testMaxDigits, expected) => {
      expect(isValidInsert(targetValue, '1', testMaxDigits, scale)).toBe(
        expected
      );
    }
  );
});

describe('isValidNumberString', () => {
  it.each([
    // value          maxDigits  scale  expected
    ['1000', 11, 2, true],
    ['1000.5', 11, 2, true],
    ['1000.555', 11, 2, false],
    ['123456789012', 11, 2, false],
    ['-1000', 11, 2, true],
    [null, 11, 2, false]
  ])(
    'isValidNumberString(%j, %i, %i) -> %s',
    (value, maxDigits, scale, expected) => {
      expect(isValidNumberString(value, maxDigits, scale)).toBe(expected);
    }
  );
});

/*
    Regression. isValidInsert checked leading zeros, scale and digit count but
    never that the value was actually numeric, so any short run of punctuation
    was accepted — then parsed to NaN and reported as null. "==12====123" got
    through because it has no letters, no second separator, eleven characters
    and no leading zero.
 */
describe('isValidInsert rejects non-numeric characters', () => {
  it.each([
    ['==12====123', 'the reported case'],
    ['1=2', 'an equals sign'],
    ['12$34', 'a currency symbol'],
    ['1_000', 'an underscore'],
    ['1+2', 'a plus'],
    ['1/2', 'a slash'],
    ['1e5', 'scientific notation'],
    ['(123)', 'parentheses, which only paste understands'],
    ['1 2', 'an embedded space'],
    ['#1', 'a hash']
  ])('refuses %j (%s)', (targetValue) => {
    expect(
      isValidInsert(targetValue, targetValue.slice(-1), DEFAULT_MAX_DIGITS, 2)
    ).toBe(false);
  });

  it.each([
    ['123', 'plain digits'],
    ['1.5', 'a fraction'],
    ['-42', 'a negative'],
    ['1,234', 'grouping separators the formatter added'],
    ['', 'empty'],
    ['.', 'a lone separator'],
    ['-', 'a lone minus']
  ])('still accepts %j (%s)', (targetValue) => {
    expect(
      isValidInsert(
        targetValue,
        targetValue.slice(-1) || '1',
        DEFAULT_MAX_DIGITS,
        2
      )
    ).toBe(true);
  });
});
