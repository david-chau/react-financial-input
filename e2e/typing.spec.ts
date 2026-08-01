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
  test('pasting does not corrupt the value', async ({ page }) => {
    await open(page, STORIES.withValue);
    await expect(input(page)).toHaveValue('1,234,567.89');

    await input(page).press('ControlOrMeta+a');
    await input(page).press('ControlOrMeta+c');
    await input(page).press('End');
    await input(page).press('ControlOrMeta+v');

    await expect(input(page)).toHaveValue('1,234,567.89');
  });
});

test.describe('mobile affordances', () => {
  test('asks for a numeric keypad', async ({ page }) => {
    await open(page, STORIES.default);

    await expect(input(page)).toHaveAttribute('inputmode', 'decimal');
    await expect(input(page)).toHaveAttribute('type', 'text');
  });
});
