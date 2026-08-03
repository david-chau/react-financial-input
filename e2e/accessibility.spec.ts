import AxeBuilder from '@axe-core/playwright';
import { Page, expect, test } from '@playwright/test';
import { STORIES } from './storyUrl';

/*
    Automated accessibility, because the manual kind did not catch this.

    @storybook/addon-a11y was installed and reported nothing, since nobody
    opened the panel. Meanwhile the currency combobox shipped two *critical*
    ARIA violations: <ul role="listbox"> whose children were <li> wrapping
    <button role="option">, so a listbox did not own its options and an option's
    parent was not a listbox. That is the markup UTILS.md tells people to copy.

    Three rules are switched off throughout. They fire on every story because
    Storybook renders a component alone in an iframe with no <main> and no <h1>
    — properties of the harness, not of anything this library ships.
 */
const HARNESS_RULES = ['landmark-one-main', 'page-has-heading-one', 'region'];

const audit = (page: Page) =>
  new AxeBuilder({ page }).disableRules(HARNESS_RULES).analyze();

test.describe('accessibility', () => {
  for (const [name, url] of [
    ['default', STORIES.default],
    ['floating label', STORIES.withFloatingLabel],
    ['clear button', STORIES.withClearButton],
    ['multiplier keys', STORIES.shortcutButtons],
    ['variants', STORIES.variants],
    ['error feedback', STORIES.errorFeedback]
  ] as const) {
    test(`${name} has no violations`, async ({ page }) => {
      await page.goto(url);
      await page.locator('input').first().waitFor();

      const { violations } = await audit(page);

      expect(
        violations.map((violation) => `${violation.id} [${violation.impact}]`)
      ).toEqual([]);
    });
  }

  /*
      The combobox is audited with its list open, which is the state that was
      broken. Closed, there is no listbox to get wrong.
   */
  test('the currency combobox has no violations, open', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();
    await combobox.click();
    await page.getByRole('option').first().waitFor();

    const { violations } = await audit(page);

    expect(
      violations.map((violation) => `${violation.id} [${violation.impact}]`)
    ).toEqual([]);
  });

  /*
      The listbox has to own its options directly. Asserted on structure as
      well as through axe, so the reason survives even if a rule is renamed.
   */
  test('every option is a direct child of the listbox', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();
    await combobox.click();
    await page.getByRole('option').first().waitFor();

    const parentsAreListbox = await page.evaluate(() =>
      [...document.querySelectorAll('[role="option"]')].every(
        (option) => option.parentElement?.getAttribute('role') === 'listbox'
      )
    );

    expect(parentsAreListbox).toBe(true);
  });

  // The focused option must be announced, which needs aria-activedescendant.
  test('announces the active option', async ({ page }) => {
    await page.goto(STORIES.withCurrencySearch);
    const combobox = page.getByRole('combobox', { name: 'Currency' });
    await combobox.waitFor();
    await combobox.click();
    await combobox.press('ArrowDown');

    await expect(combobox).toHaveAttribute('aria-activedescendant', /.+/);
  });
});
