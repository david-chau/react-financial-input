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
    Parsing and formatting, with no React in them. `parseAmount` applies the
    same rules a paste goes through; `shiftDecimal` is the exact powers-of-ten
    multiply that replaced bignumber.js.
 */
export {
  parseAmount,
  DEFAULT_SHORTCUTS
} from './components/financialInput/financialInputUtils';

export {
  formatNumber,
  shiftDecimal,
  toCanonical,
  formatCanonical
} from './utils/number';
export type { Separators } from './utils/number';

/*
    Currency data, read from Intl rather than a bundled table.
    `supportsFlagEmoji` reports whether this platform draws flags at all.
 */
export {
  listCurrencies,
  searchCurrencies,
  toFlagEmoji,
  supportsFlagEmoji,
  CURRENCY_PRESETS,
  DEFAULT_CURRENCY_PRESET
} from './utils/currency';
export type {
  CurrencyOption,
  CurrencyPreset,
  CurrencySearchOptions,
  ResolvedCurrency,
  SymbolPosition
} from './utils/currency';

/*
    Reading input events — the part of this library that is about browsers
    rather than about money, and useful on any text field.
 */
export {
  classifyInputType,
  describeEdit,
  isDeleteInputType
} from './utils/inputEvents';
export type { Edit, EditKind } from './utils/inputEvents';

export { InputType } from './enums/InputType';

/** `T | null`, which is what every value in this API means by "empty". */
export type { Nullable } from './types/Nullable';
