import { expect, test } from '@playwright/test';
import { STORIES } from './storyUrl';

/*
    Layer 3: the Android GBoard path, driven for real without a device.

    A device descriptor such as devices['Pixel 7'] is desktop Chromium with a
    phone viewport and a spoofed user agent — it does not run Android and it
    does not run GBoard, so it emits plain insertText. `insertCompositionText`
    originates in the IME, and the only way to produce a genuine one without
    hardware is Chromium's DevTools Protocol.

    Chromium-only. Firefox and WebKit have no equivalent, so their composition
    quirks stay in the reducer's unit table.
 */
test.describe('IME composition', () => {
  test('composition events reach the component', async ({ page, context }) => {
    await page.goto(STORIES.default);

    const input = page.getByRole('textbox');
    await input.waitFor();
    await input.click();

    const inputTypes = await page.evaluate(() => {
      const seen: string[] = [];
      const element = document.querySelector('input');

      element?.addEventListener('beforeinput', (event) => {
        seen.push((event as InputEvent).inputType);
      });

      (window as unknown as { __seen: string[] }).__seen = seen;

      return seen;
    });

    const cdp = await context.newCDPSession(page);

    await cdp.send('Input.imeSetComposition', {
      text: '1',
      selectionStart: 0,
      selectionEnd: 1
    });
    await cdp.send('Input.insertText', { text: '1' });

    const observed = await page.evaluate(
      () => (window as unknown as { __seen: string[] }).__seen
    );

    expect(inputTypes).toEqual([]);
    expect(observed).toContain('insertCompositionText');
  });

  /*
      Phase 2. Once the reducer handles insertCompositionText, this asserts the
      value actually forms. Until then the component deliberately ignores it,
      and pretending otherwise here would be a false green.
   */
  test.fixme('composed digits build up a formatted value', async ({
    page,
    context
  }) => {
    await page.goto(STORIES.default);

    const input = page.getByRole('textbox');
    await input.click();

    const cdp = await context.newCDPSession(page);

    for (const text of ['1', '12', '123', '1234']) {
      await cdp.send('Input.imeSetComposition', {
        text,
        selectionStart: 0,
        selectionEnd: text.length
      });
    }

    await cdp.send('Input.insertText', { text: '1234' });

    await expect(input).toHaveValue('1,234');
  });
});
