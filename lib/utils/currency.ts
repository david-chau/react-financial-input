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
/*
    How many digits go in each group, read out of Intl rather than assumed.

    Grouping is not three digits everywhere. The Indian lakh/crore system
    writes 1234567890 as 1,23,45,67,890 — three, then twos — and it is used by
    every Indian language locale plus Nepali and Dzongkha. Hard-coding thousands
    silently produced 12,34,56,7890 worth of wrongness for a very large number
    of people.

    Measured from a probe long enough to show at least three groups: the
    rightmost group's length is the primary size, the one beside it the
    secondary. The leftmost is whatever remainder is left over, so it is
    ignored.
 */
const resolveGroupSizes = (format: Intl.NumberFormat): number[] => {
  const lengths = format
    .formatToParts(1234567890)
    .filter((part) => part.type === 'integer')
    .map((part) => part.value.length)
    .reverse();

  const [primary, secondary] = lengths;

  if (!primary || !secondary) {
    return [3];
  }

  return primary === secondary ? [primary] : [primary, secondary];
};

export const resolveSeparators = (locale?: string): Separators => {
  try {
    const format = new Intl.NumberFormat(locale);
    const parts = format.formatToParts(11111.1);

    const group = parts.find((part) => part.type === 'group')?.value;
    const decimal = parts.find((part) => part.type === 'decimal')?.value;

    return {
      group: group ?? DEFAULT_SEPARATORS.group,
      decimal: decimal ?? DEFAULT_SEPARATORS.decimal,
      groupSizes: resolveGroupSizes(format)
    };
  } catch {
    return DEFAULT_SEPARATORS;
  }
};

/*
    Shortlists people actually ask for. G7 is the seven countries' currencies,
    which is five once the euro members are collapsed; G10 is the FX market's
    ten, which is a different list and includes NOK and NZD.

    Just arrays — pass your own instead if these are not the ones you want.
 */
export const CURRENCY_PRESETS = {
  g7: ['USD', 'EUR', 'JPY', 'GBP', 'CAD'],
  g10: ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'AUD', 'NZD', 'CAD', 'SEK', 'NOK']
} as const;

/** A preset name, or 'all' for everything the runtime knows. */
export type CurrencyPreset = keyof typeof CURRENCY_PRESETS | 'all';

/*
    g10 by default rather than everything. A picker wants a shortlist people
    recognise, not 162 rows to scroll; ask for 'all' when you mean all.
 */
export const DEFAULT_CURRENCY_PRESET: CurrencyPreset = 'g10';

const resolveCodes = (
  codes: readonly string[] | CurrencyPreset = DEFAULT_CURRENCY_PRESET
): readonly string[] | undefined => {
  if (codes === 'all') {
    return undefined;
  }

  if (typeof codes === 'string') {
    return CURRENCY_PRESETS[codes];
  }

  return codes;
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
  codes?: readonly string[] | CurrencyPreset
): CurrencyOption[] => {
  const available =
    resolveCodes(codes) ??
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

/*
    A flag emoji for a currency, e.g. "SEK" to a Swedish flag.

    Costs nothing: ISO 4217 codes are the ISO 3166 country code plus a letter,
    and a flag emoji is just that country code written in regional indicator
    symbols. No image assets, no lookup table.

    Two caveats worth knowing before you use it.

    Windows does not render flag emoji at all — it shows the two letters
    instead. That degrades acceptably ("US", "SE") but it is not a flag.

    Supranational and metal codes have no country: EUR maps to the EU flag,
    which exists, but XAU (gold) maps to "XA", which does not. Returns null for
    anything that is not a plausible region, so the caller can fall back to the
    code.
 */
export const toFlagEmoji = (currency: string): Nullable<string> => {
  const region = currency.slice(0, 2).toUpperCase();

  if (!/^[A-Z]{2}$/.test(region) || region.startsWith('X')) {
    return null;
  }

  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const LETTER_A = 'A'.charCodeAt(0);

  return String.fromCodePoint(
    ...[...region].map(
      (letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - LETTER_A
    )
  );
};

export interface CurrencySearchOptions {
  locale?: string;
  /** A preset name, your own array, or everything by default. */
  codes?: readonly string[] | CurrencyPreset;
  /** Cap the result, since a combobox rarely wants 160 rows. */
  limit?: number;
}

/*
    Filters currencies for a search box, matching the code or the name.

    Ranked so the code wins: typing "us" should put USD first rather than
    burying it under every currency whose name happens to contain "us". An
    empty query returns the head of the list, which is what a combobox wants to
    show before anything is typed.
 */
export const searchCurrencies = (
  query: string,
  { locale, codes, limit = 20 }: CurrencySearchOptions = {}
): CurrencyOption[] => {
  const all = listCurrencies(locale, codes);
  const needle = query.trim().toLowerCase();

  if (needle === '') {
    return all.slice(0, limit);
  }

  const rank = (option: CurrencyOption): number => {
    const code = option.code.toLowerCase();
    const name = option.name.toLowerCase();

    if (code === needle) return 0;
    if (code.startsWith(needle)) return 1;
    if (name.toLowerCase().startsWith(needle)) return 2;
    if (name.includes(needle)) return 3;
    if (code.includes(needle)) return 4;

    return Number.POSITIVE_INFINITY;
  };

  return all
    .map((option) => ({ option, score: rank(option) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) => a.score - b.score || a.option.code.localeCompare(b.option.code)
    )
    .slice(0, limit)
    .map(({ option }) => option);
};

/*
    Whether this platform draws flag emoji at all.

    Windows does not. It has no glyphs for regional indicator pairs, so a
    browser falls back to rendering the two letters — "SE" rather than the
    Swedish flag. Nothing in CSS or JavaScript changes that; the glyphs simply
    are not on the machine.

    Detected by drawing one and looking for colour. A real flag is painted in
    several hues; the letter fallback is drawn in a single text colour, so a
    pixel whose channels differ from one another means the flag rendered.

    Returns false where there is no canvas to draw on — during server rendering,
    or in a test environment without one — because the honest answer to "does
    this platform draw flags" is then "cannot tell", and the fallback is the
    safe branch either way.
 */
let flagSupport: Nullable<boolean> = null;

export const supportsFlagEmoji = (): boolean => {
  if (flagSupport !== null) {
    return flagSupport;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;

  const context = canvas.getContext('2d');

  if (!context) {
    return false;
  }

  context.font = '16px sans-serif';
  context.fillText('\u{1F1E8}\u{1F1E6}', 0, 14);

  const { data } = context.getImageData(0, 0, 16, 16);
  let coloured = false;

  for (let index = 0; index < data.length && !coloured; index += 4) {
    const [red, green, blue, alpha] = [
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3]
    ];

    // Any painted pixel that is not a shade of grey.
    coloured =
      alpha > 0 && (Math.abs(red - green) > 24 || Math.abs(green - blue) > 24);
  }

  flagSupport = coloured;

  return coloured;
};

/** Test seam. The result is cached, since it cannot change mid-session. */
export const resetFlagSupportCache = (): void => {
  flagSupport = null;
};
