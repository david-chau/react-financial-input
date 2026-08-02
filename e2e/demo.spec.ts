import { test, Page } from '@playwright/test';
import { STORIES, withoutBadge } from './storyUrl';

/*
    Marketing recordings, not evidence — see typing.spec.ts and composition.spec.ts
    for what actually proves the cross-platform claim. Playwright records WebM;
    scripts/record-demos.sh converts to GIF with ffmpeg.
 */

const typeSlowly = async (page: Page, text: string) => {
  await page.getByRole('textbox').pressSequentially(text, { delay: 220 });
  await page.waitForTimeout(900);
};

const open = async (page: Page, url: string) => {
  await page.goto(url);
  await page.getByRole('textbox').waitFor();
  await page.getByRole('textbox').click();
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
