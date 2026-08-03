/*
    The public API, written out by hand.

    This file used to be four `export *` lines, which put 66 names on the
    package — reducer internals, regex builders, string helpers, and a
    `resetFlagSupportCache` that exists only so a test can clear a cache.
    Nothing chose them; they came along for the ride, and 1.0.0 would have
    frozen every one under semver.

    So the list is explicit, and it is what the documentation describes.
    Adding to it is now a deliberate act, and `index.test.ts` fails if this
    file and that intention drift apart.

    Anything not here is internal and may change in a patch. If something you
    relied on is missing, open an issue rather than reaching into `dist/` — a
    name that is asked for can be exported on purpose.
 */

// The component, and the headless hook behind it.
export { FinancialInput } from './components/financialInput/FinancialInput';
export type {
  FinancialInputProps,
  FinancialInputOwnProps
} from './components/financialInput/FinancialInput';

export { useFinancialInput } from './components/financialInput/useFinancialInput';
export type {
  FinancialInputOptions,
  UseFinancialInputOptions,
  NumberValueOptions,
  StringValueOptions
} from './components/financialInput/useFinancialInput';

export type { Range } from './components/financialInput/financialInputUtils';

/*
    Parsing lives at react-financial-input/parse, which is the only entry
    without a 'use client' banner — so it can be called from a server action or
    a server component. Re-exporting it here would put it back behind the
    directive and undo that.
 */

/*
    Currency data and input-event reading live at their own entry points too,
    so that importing the input does not measure as importing them:

      react-financial-input/currency
      react-financial-input/events

    Real bundlers already tree-shook them — 0.9 kB gzipped between the two —
    but a size report measures the whole entry, not what you used.
 */

/** `T | null`, which is what every value in this API means by "empty". */
export type { Nullable } from './types/Nullable';
