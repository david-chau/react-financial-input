import { describe, expect, it } from 'vitest';
import * as api from './index';

/*
    The public API, locked.

    Before 1.0.0 this package exported 66 names, because index.ts was four
    `export *` lines and every internal came with them — reducer cases, regex
    builders, and a cache-clearing helper that exists for one test. Semver
    would have frozen all of it.

    So the surface is written out by hand in index.ts, and asserted here. The
    point is not the number; it is that adding to it has to be deliberate. If
    this fails, either the export was intended — add it below, and document it
    — or a barrel crept back in.
 */
const PUBLIC_API = [
  // Component and hook
  'FinancialInput',
  'useFinancialInput',

  // Parsing and formatting, no React involved
  'parseAmount',
  'formatNumber',
  'shiftDecimal',
  'toCanonical',
  'formatCanonical',
  'DEFAULT_SHORTCUTS'

  /*
      Currency data and event reading are no longer here. They moved to their
      own entry points so that importing the input does not measure as
      importing them — see currency.test.ts and events.test.ts.
   */
].sort();

describe('the public API', () => {
  it('exports exactly what it means to', () => {
    expect(Object.keys(api).sort()).toEqual(PUBLIC_API);
  });

  /*
      Named individually so a failure says which one went missing, rather than
      handing over a diff of two long arrays.
   */
  it.each(PUBLIC_API)('%s is exported', (name) => {
    expect(api).toHaveProperty(name);
  });

  /*
      The specific leaks that prompted this. Each was public purely because of
      a barrel, and each would have been frozen at 1.0.0.
   */
  it.each([
    ['resetFlagSupportCache', 'a test seam for clearing a cache'],
    ['reduceInput', 'the reducer, which is internal'],
    ['createInitialState', 'internal state construction'],
    ['buildDecimalPattern', 'regex plumbing'],
    ['buildSymbolPunctuationPattern', 'more regex plumbing'],
    ['hasSeparatorOrSpace', 'a string helper'],
    ['mapCursorToFormatted', 'caret arithmetic'],
    ['isValidInsert', 'validation internals'],
    ['commonPrefixLength', 'superseded publicly by describeEdit'],
    ['HISTORY_LIMIT', 'an implementation detail of undo']
  ])('does not export %s (%s)', (name) => {
    expect(api).not.toHaveProperty(name);
  });

  // Everything callable should be callable, not an accidental undefined.
  it('has no undefined exports', () => {
    for (const [name, value] of Object.entries(api)) {
      expect(value, `${name} is undefined`).toBeDefined();
    }
  });
});
