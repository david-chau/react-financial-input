import { describe, expect, it } from 'vitest';
import * as currency from './currency';
import * as events from './events';
import * as root from './index';
import * as parse from './parse';

/*
    Three entry points, each with a stated surface.

    Currency data and event reading were split off the root because a size
    report measures the whole entry rather than what you imported. Real
    bundlers already tree-shook them — 0.9 kB gzipped between the two — but
    the number a reviewer reads comes from the entry, and that number is the
    one people judge a library by.

    Splitting only helps while the root stays clean, so this asserts the
    separation rather than trusting it.
 */
/*
    The one entry with no 'use client' on it.

    A module carrying that directive has every export turned into a client
    reference by the Next.js App Router, so parseAmount on the root could not
    run in a server action — while the docs said it ran "server-side quite
    happily". Keeping it here, and out of the root, is what makes that true.
 */
describe('react-financial-input/parse', () => {
  const SURFACE = [
    'parseAmount',
    'formatNumber',
    'shiftDecimal',
    'toCanonical',
    'formatCanonical',
    'DEFAULT_SHORTCUTS'
  ].sort();

  it('exports exactly what it means to', () => {
    expect(Object.keys(parse).sort()).toEqual(SURFACE);
  });

  it('parses without React or a DOM', () => {
    expect(parse.parseAmount('$1,234.56 USD')).toBe(1234.56);
    expect(parse.shiftDecimal('4.35', 2)).toBe('435');
  });
});

describe('react-financial-input/currency', () => {
  const SURFACE = [
    'listCurrencies',
    'searchCurrencies',
    'toFlagEmoji',
    'supportsFlagEmoji',
    'CURRENCY_PRESETS',
    'DEFAULT_CURRENCY_PRESET'
  ].sort();

  it('exports exactly what it means to', () => {
    expect(Object.keys(currency).sort()).toEqual(SURFACE);
  });

  it('still reads Intl rather than a bundled table', () => {
    // A table would go stale; Intl cannot.
    expect(currency.listCurrencies('en-US', 'all').length).toBeGreaterThan(100);
  });
});

describe('react-financial-input/events', () => {
  const SURFACE = [
    'classifyInputType',
    'describeEdit',
    'isDeleteInputType',
    'InputType'
  ].sort();

  it('exports exactly what it means to', () => {
    expect(Object.keys(events).sort()).toEqual(SURFACE);
  });

  it('works on any text field, with no currency involved', () => {
    expect(events.describeEdit('12', '12345').kind).toBe('insertBulk');
  });
});

describe('the root stays out of their way', () => {
  it.each([
    'parseAmount',
    'formatNumber',
    'shiftDecimal',
    'listCurrencies',
    'searchCurrencies',
    'toFlagEmoji',
    'supportsFlagEmoji',
    'CURRENCY_PRESETS',
    'DEFAULT_CURRENCY_PRESET',
    'classifyInputType',
    'describeEdit',
    'isDeleteInputType',
    'InputType'
  ])('does not re-export %s', (name) => {
    expect(root).not.toHaveProperty(name);
  });

  // Nothing is exported twice, which would defeat the split.
  it('shares no names with either subpath', () => {
    const shared = Object.keys(root).filter(
      (name) => name in currency || name in events || name in parse
    );

    expect(shared).toEqual([]);
  });
});
