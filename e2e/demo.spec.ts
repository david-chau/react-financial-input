import { test, Page } from '@playwright/test';
import { STORIES, withoutBadge } from './storyUrl';

/*
    Marketing recordings, not evidence — see typing.spec.ts and composition.spec.ts
    for what actually proves the cross-platform claim. Playwright records WebM;
    scripts/record-demos.sh converts to GIF with ffmpeg.

    Slow deliberately: a GIF that types at machine speed shows the result but
    not the behaviour, and the behaviour is the point.
 */

// Needed by the paste demo; harmless for the rest.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const typeSlowly = async (page: Page, text: string) => {
  await page.getByRole('textbox').pressSequentially(text, { delay: 220 });
  await page.waitForTimeout(900);
};

const open = async (page: Page, url: string) => {
  await page.goto(url);
  await page.getByRole('textbox').first().waitFor();
  await page.getByRole('textbox').first().click();
  await page.waitForTimeout(600);
};

test('demo: digits group as you type', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withFloatingLabel));
  await typeSlowly(page, '1234567');
});

test('demo: shortcuts expand', async ({ page }) => {
  await open(page, withoutBadge(STORIES.shortcuts));
  await typeSlowly(page, '2.5m');
});

test('demo: backspacing across a separator', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withFloatingLabel));
  await typeSlowly(page, '1000');

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('textbox').press('Backspace');
    await page.waitForTimeout(300);
  }

  await page.waitForTimeout(600);
});

/*
    Undo is one step per edit, so an expansion comes back as what was typed
    rather than unwinding character by character.
 */
test('demo: undo restores in one step', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withFloatingLabel));
  await typeSlowly(page, '2.5m');

  await page.getByRole('textbox').press('ControlOrMeta+z');
  await page.waitForTimeout(1200);
});

test('demo: a refused keystroke flashes', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withFloatingLabel));
  await typeSlowly(page, '1.23');

  // A third decimal place at scale 2.
  await page.getByRole('textbox').press('4');
  await page.waitForTimeout(1200);
});

test('demo: paste is sanitised', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withFloatingLabel));

  await page.evaluate(() => navigator.clipboard.writeText('$1,234.56 USD'));
  await page.waitForTimeout(700);

  await page.getByRole('textbox').press('ControlOrMeta+v');
  await page.waitForTimeout(1400);
});

test('demo: clear button, and undo brings it back', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withClearButton));
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Clear the amount' }).click();
  await page.waitForTimeout(900);

  await page.getByRole('textbox').press('ControlOrMeta+z');
  await page.waitForTimeout(1200);
});

test('demo: currency picker', async ({ page }) => {
  await open(page, withoutBadge(STORIES.withCurrencyPicker));
  await typeSlowly(page, '1234.5');

  for (const currency of ['SEK', 'EUR', 'JPY']) {
    await page
      .getByRole('combobox', { name: 'Currency' })
      .selectOption(currency);
    await page.waitForTimeout(1100);
  }
});

test('demo: search 162 currencies', async ({ page }) => {
  await page.goto(withoutBadge(STORIES.withCurrencySearch));
  await page.locator('.rfi-input').waitFor();

  await page.locator('.rfi-input').click();
  await page.locator('.rfi-input').pressSequentially('1234', { delay: 200 });
  await page.waitForTimeout(500);

  const combobox = page.getByRole('combobox', { name: 'Currency' });
  await combobox.click();
  await page.waitForTimeout(900);

  await combobox.pressSequentially('kron', { delay: 260 });
  await page.waitForTimeout(900);

  await combobox.press('ArrowDown');
  await page.waitForTimeout(500);
  await combobox.press('Enter');
  await page.waitForTimeout(1300);
});

test('demo: multiplier keys for a numeric keypad', async ({ page }) => {
  await open(page, withoutBadge(STORIES.shortcutButtons));
  await typeSlowly(page, '2.5');

  await page.getByRole('button', { name: 'Multiply by 1 million' }).click();
  await page.waitForTimeout(1200);
});
