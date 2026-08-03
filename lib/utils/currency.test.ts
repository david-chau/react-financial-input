import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listCurrencies,
  searchCurrencies,
  resetFlagSupportCache,
  resolveCurrency,
  resolveSeparators,
  supportsFlagEmoji,
  toFlagEmoji
} from './currency';

describe('resolveCurrency', () => {
  it.each([
    // currency  locale     -> position   note
    ['USD', 'en-US', 'prefix', 'dollar leads'],
    ['EUR', 'en-IE', 'prefix', 'euro leads in Ireland'],
    ['GBP', 'en-GB', 'prefix', 'pound leads'],
    ['JPY', 'ja-JP', 'prefix', 'yen leads'],
    [
      'SEK',
      'sv-SE',
      'suffix',
      'krona trails — the case a symbol table gets wrong'
    ],
    ['EUR', 'de-DE', 'suffix', 'euro trails in Germany']
  ])('%s in %s sits as a %s (%s)', (currency, locale, position) => {
    const resolved = resolveCurrency(currency as string, locale as string);

    expect(resolved).not.toBeNull();
    expect(resolved?.position).toBe(position);
    expect(resolved?.symbol).toBeTruthy();
  });

  it.each([
    ['USD', 'en-US', '$'],
    ['GBP', 'en-GB', '£'],
    ['JPY', 'ja-JP', '￥']
  ])('resolves %s in %s to %j', (currency, locale, symbol) => {
    expect(resolveCurrency(currency, locale)?.symbol).toBe(symbol);
  });

  it.each([
    ['NOPE', 'an unknown code'],
    ['', 'an empty code'],
    ['US', 'a two-letter code']
  ])('returns null for %j (%s)', (currency) => {
    expect(resolveCurrency(currency, 'en-US')).toBeNull();
  });
});

describe('resolveSeparators', () => {
  it.each([
    // locale    group  decimal  note
    ['en-US', ',', '.', 'the default convention'],
    ['de-DE', '.', ',', 'reversed'],
    ['en-GB', ',', '.', 'same as en-US']
  ])('%s uses %j and %j (%s)', (locale, group, decimal) => {
    expect(resolveSeparators(locale as string)).toEqual({ group, decimal });
  });

  it('falls back to the default for an invalid locale', () => {
    expect(resolveSeparators('not-a-locale')).toEqual({
      group: ',',
      decimal: '.'
    });
  });

  /*
      Several locales group with non-ASCII whitespace, which catches anyone
      comparing a formatted value against a literal " ". The library treats the
      separator as an opaque string, so it works either way — this pins the
      behaviour down so it is not mistaken for a bug later.
   */
  it.each([
    // locale   code point  name
    ['sv-SE', 0x00a0, 'no-break space'],
    ['nb-NO', 0x00a0, 'no-break space'],
    ['fr-FR', 0x202f, 'narrow no-break space']
  ])('%s groups with U+%s (%s)', (locale, codePoint) => {
    const { group } = resolveSeparators(locale as string);

    expect(group.codePointAt(0)).toBe(codePoint);
    expect(group).not.toBe(' ');
  });
});

describe('listCurrencies', () => {
  it('enumerates the runtime currencies with symbols and names', () => {
    // Defaults to the g10 shortlist; 'all' is the full set.
    const all = listCurrencies('en-US', 'all');

    expect(all.length).toBeGreaterThan(50);

    const usd = all.find((option) => option.code === 'USD');

    expect(usd).toEqual({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      position: 'prefix'
    });
  });

  /*
      Position is a property of the locale, not the currency: SEK trails in
      sv-SE and leads in en-GB. A hand-written symbol table gets this wrong.
   */
  it.each([
    ['SEK', 'sv-SE', 'suffix'],
    ['SEK', 'en-GB', 'prefix'],
    ['EUR', 'de-DE', 'suffix'],
    ['EUR', 'en-IE', 'prefix'],
    ['GBP', 'en-GB', 'prefix']
  ])('%s in %s sits as a %s', (code, locale, position) => {
    expect(listCurrencies(locale as string, [code as string])[0].position).toBe(
      position
    );
  });

  it('honours an explicit shortlist, in order', () => {
    const codes = ['GBP', 'USD', 'JPY'];

    expect(listCurrencies('en-US', codes).map((o) => o.code)).toEqual(codes);
  });

  it('names currencies in the given locale', () => {
    expect(listCurrencies('de-DE', ['USD'])[0].name).not.toBe('US Dollar');
  });
});

describe('toFlagEmoji', () => {
  it.each([
    // currency  flag  note
    ['USD', '🇺🇸', 'the country code is the first two letters'],
    ['GBP', '🇬🇧', 'United Kingdom'],
    ['SEK', '🇸🇪', 'Sweden'],
    ['JPY', '🇯🇵', 'Japan'],
    ['EUR', '🇪🇺', 'supranational, but the EU flag exists']
  ])('toFlagEmoji(%j) -> %s (%s)', (currency, flag) => {
    expect(toFlagEmoji(currency)).toBe(flag);
  });

  it.each([
    ['XAU', 'gold has no country'],
    ['XDR', 'special drawing rights'],
    ['', 'empty'],
    ['1SD', 'not letters']
  ])('returns null for %j (%s)', (currency) => {
    expect(toFlagEmoji(currency)).toBeNull();
  });

  it('builds the flag from regional indicator symbols, not an asset', () => {
    // U+1F1FA U+1F1F8 — two code points, no image, no table.
    expect(
      [...(toFlagEmoji('USD') ?? '')].map((c) => c.codePointAt(0))
    ).toEqual([0x1f1fa, 0x1f1f8]);
  });
});

describe('presets', () => {
  it.each([
    // preset  expected                                            note
    ['g7', 'USD EUR JPY GBP CAD', 'five, because the euro members collapse'],
    ['g10', 'USD EUR JPY GBP CHF AUD NZD CAD SEK NOK', "the FX market's ten"]
  ])('%s is %s (%s)', (preset, expected) => {
    expect(
      listCurrencies('en-US', preset as 'g7' | 'g10')
        .map((option) => option.code)
        .join(' ')
    ).toBe(expected);
  });

  it('all returns everything the runtime knows', () => {
    expect(listCurrencies('en-US', 'all').length).toBeGreaterThan(100);
  });

  it('takes your own array, in your order', () => {
    expect(
      listCurrencies('en-US', ['NZD', 'THB']).map((option) => option.code)
    ).toEqual(['NZD', 'THB']);
  });
});

describe('searchCurrencies', () => {
  const codes = (query: string, options = {}) =>
    searchCurrencies(query, { locale: 'en-US', ...options }).map((o) => o.code);

  it.each([
    // query    first result  note
    ['usd', 'USD', 'an exact code'],
    ['us', 'USD', 'a code prefix beats a name containing "us"'],
    ['gb', 'GBP', 'another prefix'],
    ['swed', 'SEK', 'by name'],
    ['yen', 'JPY', 'by name again']
  ])('%j finds %s first (%s)', (query, expected) => {
    expect(codes(query as string)[0]).toBe(expected);
  });

  it('returns the head of the list for an empty query', () => {
    // A combobox needs something to show before anything is typed.
    expect(codes('', { codes: 'g7' })).toEqual([
      'USD',
      'EUR',
      'JPY',
      'GBP',
      'CAD'
    ]);
  });

  it('respects the limit', () => {
    expect(codes('a', { limit: 3 })).toHaveLength(3);
  });

  it('searches within a preset only', () => {
    expect(codes('kron', { codes: 'g7' })).toEqual([]);
    expect(codes('kron', { codes: 'g10' })).toEqual(['NOK', 'SEK']);
  });

  it('finds nothing for nonsense', () => {
    expect(codes('zzzzz')).toEqual([]);
  });
});

describe('the default shortlist', () => {
  /*
      A picker wants a list people recognise, not 162 rows to scroll. Asking
      for 'all' is explicit.
   */
  it('is g10, not everything', () => {
    expect(listCurrencies('en-US')).toHaveLength(10);
    expect(listCurrencies('en-US', 'all').length).toBeGreaterThan(100);
  });

  it('applies to search as well', () => {
    expect(searchCurrencies('kron', { locale: 'en-US' })).toHaveLength(2);
    expect(
      searchCurrencies('kron', { locale: 'en-US', codes: 'all' }).length
    ).toBeGreaterThan(2);
  });
});

/*
    Windows ships no glyphs for regional indicator pairs, so it draws the two
    letters instead of a flag. Detection is by drawing one and looking for
    colour: a real flag has several hues, the letter fallback has one.

    jsdom has no canvas, which exercises the branch that matters most — the
    answer has to be "no" wherever it cannot be measured, so callers fall back
    rather than promising flags that will not appear.
 */
describe('supportsFlagEmoji', () => {
  beforeEach(() => resetFlagSupportCache());

  it('says no when there is no canvas to draw on', () => {
    expect(supportsFlagEmoji()).toBe(false);
  });

  it('says no during server rendering', () => {
    const { document: real } = globalThis;

    // @ts-expect-error deliberately removing it, as a server would not have it
    delete globalThis.document;

    try {
      expect(supportsFlagEmoji()).toBe(false);
    } finally {
      globalThis.document = real;
    }
  });

  it('reports a colourful glyph as supported', () => {
    resetFlagSupportCache();

    const painted = new Uint8ClampedArray(16 * 16 * 4);
    // One vivid red pixel: channels far enough apart to read as colour.
    painted[0] = 220;
    painted[1] = 20;
    painted[2] = 20;
    painted[3] = 255;

    const context = {
      font: '',
      fillText: () => undefined,
      getImageData: () => ({ data: painted })
    };

    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag) as HTMLCanvasElement;

      if (tag === 'canvas') {
        element.getContext = (() => context) as never;
      }

      return element;
    });

    try {
      expect(supportsFlagEmoji()).toBe(true);
    } finally {
      vi.restoreAllMocks();
      resetFlagSupportCache();
    }
  });

  it('reports a monochrome fallback as unsupported', () => {
    resetFlagSupportCache();

    const grey = new Uint8ClampedArray(16 * 16 * 4);
    // The letters, drawn in one text colour.
    grey[0] = 30;
    grey[1] = 30;
    grey[2] = 30;
    grey[3] = 255;

    const context = {
      font: '',
      fillText: () => undefined,
      getImageData: () => ({ data: grey })
    };

    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag) as HTMLCanvasElement;

      if (tag === 'canvas') {
        element.getContext = (() => context) as never;
      }

      return element;
    });

    try {
      expect(supportsFlagEmoji()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      resetFlagSupportCache();
    }
  });
});
