import { Nullable } from '../types';
import { DEFAULT_SEPARATORS, Separators } from './number';

export type SymbolPosition = 'prefix' | 'suffix';

export interface ResolvedCurrency {
  symbol: string;
  position: SymbolPosition;
}

/*
    Resolves a currency's symbol and which side it belongs on, from Intl rather
    than a hand-maintained table. Every ISO 4217 code works, and suffix
    currencies come out right without special-casing — "1 000 kr" in sv-SE,
    "$1,000" in en-US.

    Returns null for an unknown code, so the caller can leave the input
    unadorned rather than rendering a broken symbol.
 */
export const resolveCurrency = (
  currency: string,
  locale?: string
): Nullable<ResolvedCurrency> => {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol'
    }).formatToParts(1);

    const symbolIndex = parts.findIndex((part) => part.type === 'currency');

    if (symbolIndex === -1) {
      return null;
    }

    const numberIndex = parts.findIndex((part) =>
      ['integer', 'decimal', 'fraction'].includes(part.type)
    );

    return {
      symbol: parts[symbolIndex].value,
      position: symbolIndex < numberIndex ? 'prefix' : 'suffix'
    };
  } catch {
    // RangeError for an invalid currency code or locale.
    return null;
  }
};

/*
    Reads the grouping and fraction separators a locale actually uses, so
    `locale: 'de-DE'` can configure the input without the caller having to know
    that Germany writes 1.234,56.
 */
export const resolveSeparators = (locale?: string): Separators => {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);

    const group = parts.find((part) => part.type === 'group')?.value;
    const decimal = parts.find((part) => part.type === 'decimal')?.value;

    return {
      group: group ?? DEFAULT_SEPARATORS.group,
      decimal: decimal ?? DEFAULT_SEPARATORS.decimal
    };
  } catch {
    return DEFAULT_SEPARATORS;
  }
};

export interface CurrencyOption extends ResolvedCurrency {
  /** ISO 4217 code, e.g. "SEK". */
  code: string;
  /** The currency's name in the given locale, e.g. "Swedish Krona". */
  name: string;
}

/*
    Every currency the runtime knows about, for a picker. The list comes from
    Intl rather than a bundled table, so it stays a few hundred bytes of code
    instead of a few kilobytes of data that goes stale.

    Intl.supportedValuesOf is ES2022; where it is missing the caller gets
    whatever codes it passed, or nothing.
 */
export const listCurrencies = (
  locale?: string,
  codes?: string[]
): CurrencyOption[] => {
  const available =
    codes ??
    (typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('currency')
      : []);

  const names =
    typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(locale ? [locale] : undefined, {
          type: 'currency'
        })
      : null;

  return available
    .map((code) => {
      const resolved = resolveCurrency(code, locale);

      if (!resolved) {
        return null;
      }

      return {
        code,
        name: names?.of(code) ?? code,
        symbol: resolved.symbol,
        position: resolved.position
      };
    })
    .filter(
      (option: CurrencyOption | null): option is CurrencyOption =>
        option !== null
    );
};
