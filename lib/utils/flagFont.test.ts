import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
    The flag font is three files that have to travel together: the stylesheet,
    the woff2 it points at, and the attribution the CC-BY licence requires.
    None of them is imported by any JavaScript, so nothing else in this suite
    would notice them going missing — a dropped entry in `files` would ship a
    stylesheet whose font 404s, and a dropped NOTICE.md would be a licence
    breach rather than a bug.
 */
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

describe('the flag font ships intact', () => {
  it.each(['flags.css', 'flags.woff2', 'NOTICE.md'])(
    '%s is in the published files',
    (file) => {
      expect(manifest.files).toContain(file);
      expect(() => readFileSync(file)).not.toThrow();
    }
  );

  it.each([
    ['./flags.css', './flags.css'],
    ['./flags.woff2', './flags.woff2']
  ])('%s is a subpath export', (subpath, target) => {
    expect(manifest.exports[subpath]).toBe(target);
  });

  it('points at a font that is actually there', () => {
    const css = readFileSync('flags.css', 'utf8');
    const url = css.match(/url\('([^']+)'\)/)?.[1];

    expect(url).toBe('./flags.woff2');
    expect(readFileSync('flags.woff2').length).toBeGreaterThan(10_000);
  });

  /*
      The unicode-range is the whole safety argument: without it the font would
      be consulted for ordinary text, and a 80 kB download would be deciding
      what your digits look like.
   */
  it('is scoped to flag codepoints', () => {
    const css = readFileSync('flags.css', 'utf8');

    expect(css).toMatch(/unicode-range:\s*U\+1F1E6-1F1FF/);
  });

  // CC-BY 4.0 requires the attribution to travel with the artwork.
  it('carries the attribution the licence requires', () => {
    const notice = readFileSync('NOTICE.md', 'utf8');

    expect(notice).toMatch(/Twemoji/);
    expect(notice).toMatch(/CC[- ]BY|Creative Commons Attribution/i);
  });
});
