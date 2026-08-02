import { describe, expect, it } from 'vitest';
import { listCurrencies, resolveCurrency, resolveSeparators } from './currency';

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
    const all = listCurrencies('en-US');

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
