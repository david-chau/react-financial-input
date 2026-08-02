import { expect, test, Page } from '@playwright/test';
import { STORIES } from './storyUrl';

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
    await page.getByRole('button', { name: 'M' }).click();

    await expect(input(page)).toHaveValue('2,500,000');
  });
});
