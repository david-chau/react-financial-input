import { expect, test, Page } from '@playwright/test';
import { STORIES, withArgs, withoutBadge } from './storyUrl';

const input = (page: Page) => page.getByRole('textbox');

const open = async (page: Page, url: string) => {
  await page.goto(url);
  await input(page).waitFor();
  await input(page).click();
};

test.describe('typing and formatting', () => {
  test('groups digits as they are typed', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1234567');

    await expect(input(page)).toHaveValue('1,234,567');
  });

  test('leaves the caret at the end after a separator is inserted', async ({
    page
  }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1000');

    await expect(input(page)).toHaveValue('1,000');
    expect(
      await input(page).evaluate(
        (element: HTMLInputElement) => element.selectionStart
      )
    ).toBe(5);
  });

  test('expands a shortcut', async ({ page }) => {
    await open(page, STORIES.shortcuts);
    await input(page).pressSequentially('2.5m');

    await expect(input(page)).toHaveValue('2,500,000');
  });

  test('refuses a third decimal place', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1.234');

    await expect(input(page)).toHaveValue('1.23');
  });

  test('refuses any decimal point when scale is 0', async ({ page }) => {
    await open(page, STORIES.wholeNumbersOnly);
    await input(page).pressSequentially('1.5');

    await expect(input(page)).toHaveValue('15');
  });

  test('backspaces across a grouping separator', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1000');
    await expect(input(page)).toHaveValue('1,000');

    await input(page).press('Backspace');
    await expect(input(page)).toHaveValue('100');
  });

  test('select-all then overtype replaces the value', async ({ page }) => {
    await open(page, STORIES.withValue);
    await expect(input(page)).toHaveValue('1,234,567.89');

    // ControlOrMeta resolves to Meta on macOS and Control everywhere else.
    await input(page).press('ControlOrMeta+a');
    await input(page).pressSequentially('42');

    await expect(input(page)).toHaveValue('42');
  });
});

/*
    Paste and drop are Phase 2 — the reducer currently ignores them, so these
    assert the value is left alone rather than corrupted.

    Note the copy is driven with real key presses rather than a synthetic
    ClipboardEvent. A dispatched ClipboardEvent is isTrusted: false, so the
    browser skips the default insertion, input.value never changes, and the test
    would pass while testing nothing. Clipboard *permissions* are Chromium-only,
    so real keys are also the only cross-engine option.
 */
test.describe('clipboard', () => {
  /*
      Copy is driven with real key presses rather than a synthetic
      ClipboardEvent: a dispatched event is isTrusted: false, so the browser
      skips the default insertion, input.value never changes, and the test would
      pass while testing nothing. Clipboard permissions are Chromium-only, so
      real keys are also the only cross-engine option.
   */
  const copyFrom = async (page: Page, text: string) => {
    await page.evaluate((value) => {
      const source = document.createElement('textarea');
      source.id = 'copy-source';
      source.value = value;
      document.body.appendChild(source);
      source.select();
    }, text);

    await page.locator('#copy-source').press('ControlOrMeta+a');
    await page.locator('#copy-source').press('ControlOrMeta+c');
    await page.evaluate(() => document.querySelector('#copy-source')?.remove());
  };

  test('pasting a formatted amount is sanitised and accepted', async ({
    page
  }) => {
    await open(page, STORIES.default);
    await copyFrom(page, '$1,234.56 USD');

    await input(page).click();
    await input(page).press('ControlOrMeta+v');

    await expect(input(page)).toHaveValue('1,234.56');
  });

  test('pasting text with no number in it is refused', async ({ page }) => {
    await open(page, STORIES.withValue);
    await expect(input(page)).toHaveValue('1,234,567.89');

    await copyFrom(page, 'not a number');

    await input(page).click();
    await input(page).press('ControlOrMeta+a');
    await input(page).press('ControlOrMeta+v');

    await expect(input(page)).toHaveValue('1,234,567.89');
  });

  test('cutting the selection clears the value', async ({ page }) => {
    await open(page, STORIES.withValue);

    await input(page).press('ControlOrMeta+a');
    await input(page).press('ControlOrMeta+x');

    await expect(input(page)).toHaveValue('');
  });
});

/*
    Regression: the stylesheet used to switch on prefers-color-scheme, which put
    white text and a white border on a still-white page and made the input
    invisible. Playwright defaults to the light scheme, so this only shows up if
    the dark scheme is asked for explicitly.
 */
/*
    Driven from the keystroke rather than the historyUndo input type: the
    browser stops emitting that once its own stack is exhausted, which happens
    as soon as React overwrites the value — so only the first Ctrl+Z ever
    arrived. This caught that.
 */
/*
    Regression: isValidInsert checked leading zeros, scale and digit count but
    never that the value was numeric, so "==12====123" was accepted and then
    parsed to NaN.
 */
test.describe('character validation', () => {
  test('refuses punctuation that is not part of a number', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('==12====123');

    await expect(input(page)).toHaveValue('12,123');
  });

  /*
      Colour by default, motion only when asked for. Asserted on the computed
      animation-name rather than by eye, because "it looked fine" is how the
      dark-mode bug shipped.
   */
  const FEEDBACK: [number, string, string][] = [
    [0, 'rfi-flash', 'default is colour only'],
    [1, 'rfi-flash, rfi-shake', 'rfi-input--shake opts into motion']
  ];

  for (const [index, expected, note] of FEEDBACK) {
    test(`error feedback on field ${index} is ${expected} (${note})`, async ({
      page
    }) => {
      await page.goto(STORIES.errorFeedback);
      const field = page.getByRole('textbox').nth(index);
      await field.waitFor();
      await field.click();
      await field.pressSequentially('1.234');

      await expect(field).toHaveClass(/rfi-input--rejected/);
      expect(
        await field.evaluate(
          (element) => getComputedStyle(element).animationName
        )
      ).toBe(expected);
    });
  }

  test('flags a refused keystroke, then clears it', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1.23');
    await input(page).press('4');

    await expect(input(page)).toHaveClass(/rfi-input--rejected/);
    await expect(input(page)).not.toHaveClass(/rfi-input--rejected/, {
      timeout: 3000
    });
  });
});

/*
    Regression: the resolved-values panel put the user agent on one line, which
    pushed the page wider than the phone and made it scroll sideways.
 */
/*
    The deployed Storybook lags whatever is on a branch, and nothing on the page
    said which build you were looking at — a merged fix and an unmerged one look
    identical.
 */
test.describe('version badge', () => {
  test('names the version on every story', async ({ page }) => {
    await open(page, STORIES.default);

    await expect(page.getByTitle(/react-financial-input/)).toBeVisible();
  });

  test('is suppressed for the demo recordings', async ({ page }) => {
    await page.goto(withoutBadge(STORIES.default));
    await input(page).waitFor();

    await expect(page.getByTitle(/react-financial-input/)).toHaveCount(0);
  });
});

test.describe('debug panel on a phone', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  test('fits the viewport without scrolling sideways', async ({ page }) => {
    await page.goto(STORIES.debugPlayground);
    await input(page).waitFor();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe('shortcut keypad', () => {
  test('spans the input, stays short, and explains itself on hover', async ({
    page
  }) => {
    await page.goto(STORIES.shortcutButtons);
    await input(page).waitFor();

    const field = await input(page).boundingBox();
    const keypad = await page.locator('.rfi-keypad').boundingBox();
    const key = await page.locator('.rfi-key').first().boundingBox();

    // The strip should line up with the field rather than trailing off short.
    expect(Math.abs((keypad?.width ?? 0) - (field?.width ?? 0))).toBeLessThan(
      2
    );

    // An accessory, not a second row of primary controls.
    expect(key?.height ?? 0).toBeLessThan(36);

    // The unit lives in the tooltip, not printed on every key.
    await expect(page.locator('.rfi-key').first()).toHaveAttribute(
      'title',
      'Multiply by 100'
    );
  });
});

/*
    Two fixes that were written, reviewed and then lost: they sat on a branch
    whose pull request had already merged, so they never reached main. Pinned
    here so their absence is a failing test rather than a silent regression.
 */
test.describe('recovered fixes', () => {
  test('full-width panels are centred, not pinned left', async ({ page }) => {
    for (const url of [STORIES.debugPlayground, STORIES.keyboardTester]) {
      await page.goto(url);
      await page.locator('input').first().waitFor();

      const gaps = await page.evaluate(() => {
        const root = document
          .querySelector('#storybook-root')
          ?.getBoundingClientRect();
        const panel = document
          .querySelector('#storybook-root > *')
          ?.getBoundingClientRect();

        if (!root || !panel) return null;

        return {
          left: panel.left - root.left,
          right: root.right - panel.right
        };
      });

      expect(Math.abs((gaps?.left ?? 0) - (gaps?.right ?? 0))).toBeLessThan(4);
    }
  });

  /*
      The other recovered fix was the <select> chevron, which went with the
      currency picker when search replaced it. Nothing renders a select any
      more, so there is no longer anything to pin.
   */
});

test.describe('currency search', () => {
  test('filters, selects by keyboard, and applies', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    const amount = page.locator('.rfi-input');
    await combobox.waitFor();

    // g10 by default — a shortlist, not 162 rows to scroll.
    await combobox.click();
    expect(await page.getByRole('option').count()).toBe(10);

    await combobox.fill('kron');
    expect(await page.getByRole('option').count()).toBe(2);

    await combobox.press('ArrowDown');
    await combobox.press('Enter');

    await amount.click();
    await amount.pressSequentially('1234');

    /*
        No locale is set, so the symbol resolves in the app's locale: SEK is
        "SEK" in en-US and "kr" only in sv-SE.
     */
    await expect(page.locator('.rfi-adornment')).toHaveText('SEK');
    await expect(amount).toHaveValue('1,234');
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();

    await combobox.click();
    await combobox.fill('zzzz');

    await expect(page.getByText('No match')).toBeVisible();
  });
});

/*
    The story's list and locale are controls, so they are driven from the URL
    rather than duplicated as test-only stories.
 */
/*
    Amounts line up on the decimal point when they are right-aligned, which is
    how every ledger sets them. Documented as the stylesheet's default, so it
    is pinned rather than left to drift.
 */
test.describe('alignment', () => {
  test('the value is right-aligned, and opts out via the custom property', async ({
    page
  }) => {
    await page.goto(STORIES.withValue);
    const field = input(page);
    await field.waitFor();

    await expect(field).toHaveCSS('text-align', 'right');

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--rfi-text-align', 'left')
    );

    await expect(field).toHaveCSS('text-align', 'left');
  });
});

/*
    The value is right-aligned, so a suffix symbol and the digits compete for
    the same edge. The reserve used to be a flat 2rem, which fits "kr" (28px)
    and not "US$" (45px) or "CHF" (46px) — so it looked correct in sv-SE and
    overlapped in most of the majors. Geometry, not appearance, so that it
    cannot pass by looking about right.
 */
test.describe('the value never runs under the currency symbol', () => {
  for (const currency of ['USD', 'CHF', 'SEK']) {
    test(`${currency} keeps its distance`, async ({ page }) => {
      await page.goto(
        withArgs(STORIES.withCurrencySearch, { locale: 'sv-SE' })
      );
      const field = input(page).last();
      await field.waitFor();

      const combobox = page.getByRole('combobox', { name: 'Currency' });
      await combobox.click();
      await combobox.fill(currency);
      await combobox.press('ArrowDown');
      await combobox.press('Enter');

      await field.click();
      await field.pressSequentially('1234');

      const overlap = await page.evaluate(() => {
        const el = document.querySelector('.rfi-input') as HTMLElement;
        const symbol = document.querySelector('.rfi-adornment') as HTMLElement;
        const box = el.getBoundingClientRect();
        const symbolBox = symbol.getBoundingClientRect();
        const reserved = parseFloat(getComputedStyle(el).paddingRight);

        // Where the text may reach, versus where the symbol starts.
        return box.right - reserved - symbolBox.left;
      });

      expect(overlap).toBeLessThanOrEqual(0);
    });
  }
});

/*
    Android keyboards show the clipboard as a chip above the keys, and tapping
    it emits insertText carrying the whole string rather than insertFromPaste.
    That routed a paste onto the keystroke path, where "$" and "(" are not
    valid characters, so the chip silently did nothing while Ctrl+V on the same
    device worked.

    Playwright cannot tap a real keyboard chip, but it can dispatch the same
    event the chip does. The event is the contract, and the reducer table has
    the recorded trace.
 */
test.describe('a clipboard chip pastes through insertText', () => {
  for (const [text, expected] of [
    ['$1,234.56 USD', '1,234.56'],
    ['(1,234.00)', '-1,234.00'],
    ['2.5m', '2,500,000']
  ] as const) {
    test(`${text} becomes ${expected}`, async ({ page }) => {
      await open(page, STORIES.default);

      await input(page).evaluate((element: HTMLInputElement, value: string) => {
        // What the keyboard does: set the value, then report insertText.
        element.value = value;
        element.dispatchEvent(
          new InputEvent('input', {
            inputType: 'insertText',
            data: value,
            bubbles: true
          })
        );
      }, text);

      await expect(input(page)).toHaveValue(expected);
    });
  }

  test('a word from the suggestion strip is still refused', async ({
    page
  }) => {
    await open(page, STORIES.withValue);
    await expect(input(page)).toHaveValue('1,234,567.89');

    await input(page).evaluate((element: HTMLInputElement) => {
      element.value = 'rubbish';
      element.dispatchEvent(
        new InputEvent('input', {
          inputType: 'insertText',
          data: 'rubbish',
          bubbles: true
        })
      );
    });

    await expect(input(page)).toHaveValue('1,234,567.89');
  });
});

/*
    Windows ships no glyphs for regional indicator pairs and draws the two
    letters instead. The fix is a font, shipped as a separate opt-in import so
    that nobody downloads 80 kB they do not need.

    What runs here is the wiring: the font is declared, it reaches the flag,
    and — because its unicode-range covers only flag codepoints — it cannot
    reach anything else. Whether Windows then paints a flag is Windows'
    business, and CI's windows-latest runner is where that would be proven.
 */
test.describe('the flag font', () => {
  test('is declared, and scoped to flag codepoints alone', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    await input(page).waitFor();

    const face = await page.evaluate(async () => {
      await document.fonts.ready;

      const flags = [...document.fonts].find(
        (font) => font.family.replace(/["']/g, '') === 'Twemoji Country Flags'
      );

      return flags ? { status: flags.status, range: flags.unicodeRange } : null;
    });

    expect(face).not.toBeNull();

    /*
        Upper-cased before comparing: WebKit normalises unicodeRange to
        lowercase and Chromium reports it as written, so a case-sensitive
        assertion passes on one engine and fails on the other.
     */
    const range = (face?.range ?? '').toUpperCase();

    // Regional indicators only: it can never paint a digit or a letter.
    expect(range).toContain('U+1F1E6');
    expect(range).not.toContain('U+0030');
  });

  test('reaches the flag and not the text beside it', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();
    await combobox.click();

    await expect(page.locator('.rfi-flag').first()).toHaveCSS(
      'font-family',
      /Twemoji Country Flags/
    );

    await expect(
      page.locator('.rfi-combobox__option strong').first()
    ).not.toHaveCSS('font-family', /Twemoji Country Flags/);
  });
});

/*
    The assertion that actually closes the Windows question.

    Declaring the @font-face and resolving the family prove wiring, not
    outcome — both pass with a corrupt woff2. This paints the glyph and looks
    at the pixels: a real flag has several hues, the letter fallback is drawn
    in one colour.

    On Windows the second half is the interesting one. The system stack must
    come back monochrome, because that is the whole reason the font ships; if
    Windows ever gains its own flag glyphs, this fails and the 80 kB can go.
 */
test.describe('the font paints a real flag', () => {
  const paint = (page: Page, family: string) =>
    page.evaluate(async (fontFamily) => {
      /*
          Canvas does not trigger a webfont download, and document.fonts.ready
          only settles what the document already asked for. Without this
          explicit load the canvas silently falls back to system fonts — which
          made this pass on macOS, where the system has flags of its own, while
          proving nothing. Windows, having none, is what exposed it.
       */
      const faces = await document.fonts.load(
        `24px ${fontFamily}`,
        '\u{1F1E8}\u{1F1E6}'
      );
      await document.fonts.ready;

      // Empty for a system family, which is fine; non-empty must have loaded.
      const loaded = faces.every((face) => face.status === 'loaded');

      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;

      const context = canvas.getContext('2d');
      if (!context) return { coloured: false, loaded: false, faces: 0 };

      context.font = `24px ${fontFamily}`;
      context.fillStyle = '#000';
      context.fillText('\u{1F1E8}\u{1F1E6}', 0, 24);

      const { data } = context.getImageData(0, 0, 32, 32);

      let coloured = false;

      for (let index = 0; index < data.length && !coloured; index += 4) {
        const [red, green, blue, alpha] = [
          data[index],
          data[index + 1],
          data[index + 2],
          data[index + 3]
        ];

        // A flag is painted in several hues; letters are one flat colour.
        coloured =
          alpha > 0 &&
          (Math.abs(red - green) > 24 || Math.abs(green - blue) > 24);
      }

      return { coloured, loaded, faces: faces.length };
    }, family);

  test('renders in colour wherever it is loaded', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    await input(page).waitFor();

    const result = await paint(page, '"Twemoji Country Flags"');

    // The webfont itself resolved, rather than the canvas quietly falling back.
    expect(result.faces).toBeGreaterThan(0);
    expect(result.loaded).toBe(true);
    expect(result.coloured).toBe(true);
  });

  /*
      And the gap it fills, measured on the platform that has it.

      Only Chromium on Windows falls through to Segoe UI Emoji, which carries
      no flags. Firefox ships Twemoji Mozilla with the browser, so it draws
      them on Windows regardless — the font is redundant there, which is worth
      encoding rather than discovering later.
   */
  test('the system stack alone is monochrome on Windows Chromium', async ({
    page,
    browserName
  }) => {
    test.skip(
      process.platform !== 'win32' || browserName !== 'chromium',
      'only meaningful on the platform that lacks the glyphs'
    );

    await page.goto(STORIES.withCurrencySearch);
    await input(page).waitFor();

    // If this ever passes, Windows grew flag glyphs and the 80 kB can go.
    expect((await paint(page, 'system-ui, sans-serif')).coloured).toBe(false);
  });
});

test.describe('currency search presets', () => {
  for (const [codes, expected] of [
    ['g7', 5],
    ['g10', 10]
  ] as const) {
    test(`the ${codes} preset lists ${expected}`, async ({ page }) => {
      await page.goto(withArgs(STORIES.withCurrencySearch, { codes }));
      const combobox = page.getByRole('combobox', { name: 'Currency' });
      await combobox.waitFor();

      await combobox.click();

      expect(await page.getByRole('option').count()).toBe(expected);
    });
  }

  test('a custom array lists exactly what was passed, in order', async ({
    page
  }) => {
    await page.goto(withArgs(STORIES.withCurrencySearch, { codes: 'custom' }));
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();

    await combobox.click();

    // The story's own custom array: NZD, THB, ZAR.
    await expect(page.getByRole('option')).toHaveText([/NZD/, /THB/, /ZAR/]);
  });

  /*
      Ported from the currency picker story that search replaced. The symbol,
      the side it sits on and the separators are all properties of the locale
      rather than of the currency, and every one of them has to re-resolve
      when the selection changes.
   */
  test('re-resolves the symbol, its side and the separators', async ({
    page
  }) => {
    await page.goto(
      withArgs(STORIES.withCurrencySearch, { locale: 'sv-SE', codes: 'g10' })
    );
    const field = input(page);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    const adornment = page.locator('.rfi-adornment');
    await field.waitFor();

    await field.click();
    await field.pressSequentially('1234.5');

    // sv-SE groups with U+00A0, not a plain space, and trails the symbol.
    await expect(field).toHaveValue('1\u00a0234,5');
    await expect(adornment).toHaveClass(/suffix/);

    await combobox.click();
    await combobox.fill('SEK');
    await combobox.press('ArrowDown');
    await combobox.press('Enter');

    await expect(adornment).toHaveText('kr');
    await expect(field).toHaveValue('1\u00a0234,5');
  });

  /*
      The symbol belongs in the field, once. Repeating it in the list is noise,
      and the flag already identifies the row.
   */
  test('labels options with a flag and code, not the symbol again', async ({
    page
  }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();

    await combobox.click();
    const first = page.getByRole('option').first();

    await expect(first).toHaveText(/\u{1F1FA}\u{1F1F8}\s*USD/u);
    await expect(first).not.toHaveText(/\$/);
  });
});

test.describe('clear button', () => {
  // sv-SE groups with U+00A0, not a plain space.
  const SEK = '1\u00a0234,56';

  test('empties the value, and undo puts it back', async ({ page }) => {
    await page.goto(STORIES.withClearButton);
    const field = input(page);
    await field.waitFor();
    await expect(field).toHaveValue(SEK);

    await page.getByRole('button', { name: 'Clear the amount' }).click();
    await expect(field).toHaveValue('');

    await field.press('ControlOrMeta+z');
    await expect(field).toHaveValue(SEK);
  });

  /*
      Not just "does not overlap" — the first attempt left about two pixels
      between the symbol and the button, which read as a collision. The insets
      are derived from the button size now, so this asserts real gaps.
   */
  test('leaves room between the symbol, the button and the edge', async ({
    page
  }) => {
    await page.goto(STORIES.withClearButton);
    await input(page).waitFor();

    const gaps = await page.evaluate(() => {
      const field = document.querySelector('.rfi-field');
      const button = field
        ?.querySelector('.rfi-clear')
        ?.getBoundingClientRect();
      const symbol = field
        ?.querySelector('.rfi-adornment--suffix')
        ?.getBoundingClientRect();
      const box = field?.querySelector('.rfi-input')?.getBoundingClientRect();

      if (!button || !symbol || !box) return null;

      return {
        symbolToButton: button.left - symbol.right,
        buttonToEdge: box.right - button.right
      };
    });

    expect(gaps?.symbolToButton ?? 0).toBeGreaterThanOrEqual(6);
    expect(gaps?.buttonToEdge ?? 0).toBeGreaterThanOrEqual(6);
  });

  test('does not sit on top of a suffix currency symbol', async ({ page }) => {
    await page.goto(STORIES.withClearButton);
    await input(page).waitFor();

    const overlap = await page.evaluate(() => {
      const field = document.querySelector('.rfi-field');
      const button = field?.querySelector('.rfi-clear');
      const symbol = field?.querySelector('.rfi-adornment--suffix');

      if (!button || !symbol) return 'missing';

      return symbol.getBoundingClientRect().right <=
        button.getBoundingClientRect().left + 1
        ? 'clear'
        : 'overlap';
    });

    expect(overlap).toBe('clear');
  });
});

test.describe('undo and redo', () => {
  test('steps back repeatedly, then forward again', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1234');
    await expect(input(page)).toHaveValue('1,234');

    await input(page).press('ControlOrMeta+z');
    await expect(input(page)).toHaveValue('123');
    await input(page).press('ControlOrMeta+z');
    await expect(input(page)).toHaveValue('12');
    await input(page).press('ControlOrMeta+z');
    await expect(input(page)).toHaveValue('1');

    await input(page).press('ControlOrMeta+Shift+z');
    await expect(input(page)).toHaveValue('12');
  });

  test('past the end of the history is a no-op', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('1');

    await input(page).press('ControlOrMeta+z');
    await input(page).press('ControlOrMeta+z');
    await input(page).press('ControlOrMeta+z');

    await expect(input(page)).toHaveValue('');
  });

  test('reverses a shortcut in a single step', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('2m');
    await expect(input(page)).toHaveValue('2,000,000');

    await input(page).press('ControlOrMeta+z');
    await expect(input(page)).toHaveValue('2');
  });

  test('a fresh edit clears the redo stack', async ({ page }) => {
    await open(page, STORIES.default);
    await input(page).pressSequentially('12');
    await input(page).press('ControlOrMeta+z');
    await input(page).pressSequentially('9');
    await expect(input(page)).toHaveValue('19');

    await input(page).press('ControlOrMeta+Shift+z');
    await expect(input(page)).toHaveValue('19');
  });
});

test.describe('colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('stays visible when the OS is dark but the page is not', async ({
    page
  }) => {
    await open(page, STORIES.default);

    const { color, borderColor } = await input(page).evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, borderColor: computed.borderTopColor };
    });

    expect(color).not.toBe('rgb(255, 255, 255)');
    expect(borderColor).not.toBe('rgba(255, 255, 255, 0.23)');
  });
});

test.describe('mobile affordances', () => {
  /*
      Every mobile numeric keypad omits letter keys, so inputmode="decimal"
      would make h/k/m/b untypeable on a phone — leaving an ordinary formatted
      number input on exactly the devices this library exists for. The default
      keeps the letters reachable; the keypad is opt-in.
   */
  test('defaults to a keyboard that can type the shortcut letters', async ({
    page
  }) => {
    await open(page, STORIES.default);

    await expect(input(page)).toHaveAttribute('inputmode', 'text');
    await expect(input(page)).toHaveAttribute('type', 'text');
  });

  test('opting into the keypad still reaches multipliers by tap', async ({
    page
  }) => {
    await open(page, STORIES.shortcutButtons);

    await expect(input(page)).toHaveAttribute('inputmode', 'decimal');

    await input(page).pressSequentially('2.5');
    /*
        By accessible name, not the visible "M": the keys carry an aria-label
        describing the multiplier, and { name: 'M' } substring-matched all four
        of them.
     */
    await page.getByRole('button', { name: 'Multiply by 1 million' }).click();

    await expect(input(page)).toHaveValue('2,500,000');
  });
});
