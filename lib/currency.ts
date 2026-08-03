/*
    Currency data, as its own entry point.

    Split off the root so that importing the input does not put the currency
    lists in a bundle-size report. Tree-shaking already removed them from real
    builds — measured at 0.9 kB gzipped — but the tools people judge a package
    by measure the whole entry, and a reviewer reads the badge.

    Everything here reads `Intl`. There is no bundled table of currencies.
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
