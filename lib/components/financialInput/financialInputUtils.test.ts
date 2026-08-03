import { describe, expect, it } from 'vitest';
import { DEFAULT_SEPARATORS, listCurrencies } from '../../utils';
import {
  DEFAULT_MAX_DIGITS,
  DEFAULT_SCALE,
  parseAmount,
  applyShortcut,
  getShortcutExponent,
  isShortcut,
  isValidInsert,
  isValidNumberString,
  sanitiseNumericText
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

/*
    The one-call entry point, for using the parsing without the component.
 */
describe('parseAmount', () => {
  it.each([
    // text                 -> number      note
    ['1k', 1000, 'the shorthand people actually type'],
    ['2.5m', 2500000, 'a fraction of a million'],
    ['1b', 1000000000, 'billions'],
    ['4.35h', 435, 'exact — 4.35 * 100 is 434.99999999999994 in floats'],
    ['1,000', 1000, 'already grouped'],
    ['$1,234.56 USD', 1234.56, 'straight off a spreadsheet'],
    ['(1,234.00)', -1234, 'an accounting negative'],
    ['-42', -42, 'a plain negative'],
    ['1 234 567', 1234567, 'space-grouped'],
    ['007', 7, 'leading zeros'],
    ['0', 0, 'zero']
  ])('parseAmount(%j) -> %j (%s)', (text, expected) => {
    expect(parseAmount(text as string)).toBe(expected);
  });

  it.each([
    ['not a number', 'prose'],
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['.', 'a lone separator'],
    ['1.2.3', 'two separators']
  ])('parseAmount(%j) -> null (%s)', (text) => {
    expect(parseAmount(text)).toBeNull();
  });

  it('reads other conventions when told to', () => {
    expect(parseAmount('1.234,56', { group: '.', decimal: ',' })).toBe(1234.56);
  });

  it('takes custom shortcuts', () => {
    expect(parseAmount('5t', DEFAULT_SEPARATORS, { t: 1000 })).toBe(5000);
  });
});

/*
    Chained multipliers. Typing "1kk" has always given 1,000,000, because each
    keystroke multiplies what is already there — but the paste path kept only
    the last letter and threw the rest away, so the same characters pasted gave
    1,000, and "2.5mk" gave 2,500 rather than 2.5 billion. A wrong number that
    looks plausible, in a financial input.
 */
describe('sanitiseNumericText: chained shortcuts', () => {
  const SV = { group: ' ', decimal: ',' };

  it.each([
    // text        -> canonical    note
    ['1kk', '1000000', 'two multiplies, as typing it does'],
    ['1km', '1000000000', 'mixed, left to right'],
    ['2.5mk', '2500000000', 'on a fraction'],
    ['1kkk', '1000000000', 'three'],
    ['1k', '1000', 'one is unchanged'],
    ['kk', '1000000', 'bare, reads as one of that unit'],
    ['2.5m', '2500000', 'the ordinary case still works']
  ])('%j -> %j (%s)', (text, expected) => {
    expect(sanitiseNumericText(text)).toBe(expected);
  });

  /*
      The reason the run must sit against the digits. These are real currency
      codes spelled entirely with shortcut letters, and a space is what tells
      them apart from a multiplier someone typed.
   */
  it.each([
    // text            separators  -> canonical  note
    ['1 000 KM', SV, '1000', 'Bosnian marks, not 1e12'],
    ['1 MMK', SV, '1', 'Myanmar kyat, not 1e15'],
    ['1 234,56 kr', SV, '1234.56', 'Swedish krona'],
    ['$1,234.56 USD', DEFAULT_SEPARATORS, '1234.56', 'dollars'],
    ['1,234.56 MKD', DEFAULT_SEPARATORS, '1234.56', 'Macedonian denar'],
    ['2,5 m', SV, '2.5', 'a spaced letter is currency text, not a multiplier'],
    /*
        Found by the sweep below, not by hand. XCG's symbol is "Cg." and that
        period was being read as a decimal point: "Cg.1234" came out as 0.1234,
        and "1,234.56 Cg." was refused for holding two of them. "kr." and "Rs."
        have the same shape.
     */
    ['1234 Cg.', DEFAULT_SEPARATORS, '1234', 'a symbol ending in a period'],
    ['Cg.1234', DEFAULT_SEPARATORS, '1234', 'and leading with one'],
    [
      '1,234.56 Cg.',
      DEFAULT_SEPARATORS,
      '1234.56',
      'a real decimal point survives alongside it'
    ]
  ])(
    '%j is currency text, not a multiplier (%s)',
    (text, separators, expected) => {
      expect(sanitiseNumericText(text, separators)).toBe(expected);
    }
  );
});

/*
    Every currency the runtime knows, swept rather than sampled.

    The hand-picked cases above were found by guessing which codes are spelled
    with shortcut letters. That is exactly the kind of list that misses one, so
    this drives the whole of Intl through the sanitiser: a pasted amount must
    come back as itself, never multiplied by the currency it is labelled with.

    The table is built at collection time, so a failure names the currency.
 */
describe('no currency reads as a multiplier', () => {
  const currencies = listCurrencies('en-US', 'all');

  it('has a list worth sweeping', () => {
    expect(currencies.length).toBeGreaterThan(100);
  });

  it.each(
    currencies.flatMap(({ code, symbol }) =>
      [
        [code, `1234 ${code}`],
        [code, `${code} 1234`],
        [`${code} symbol ${symbol}`, `1234 ${symbol}`],
        [`${code} symbol ${symbol}`, `${symbol}1234`]
      ].filter(([, text]) => !/\d/.test(String(text).replace('1234', '')))
    )
  )('%s: %j stays 1234', (_label, text) => {
    expect(sanitiseNumericText(String(text))).toBe('1234');
  });
});
