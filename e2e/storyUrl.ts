/*
    Storybook's iframe endpoint renders a story with no sidebar, toolbar or
    addon panel — a bare page containing just the component. It means the e2e
    tests and the demo recordings drive the same stories that ship, with no
    separate demo app to keep in sync.
 */
export const storyUrl = (id: string): string =>
  `/iframe.html?id=${id}&viewMode=story`;

/** Same story, without the version badge — for the demo recordings. */
export const withoutBadge = (url: string) => `${url}&rfiBadge=0`;

/*
    Storybook reads `args` off the URL, so a story's controls can be driven
    from a test without adding a test-only story to do the same job.
 */
export const withArgs = (url: string, args: Record<string, string>) =>
  `${url}&args=${Object.entries(args)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')}`;

export const STORIES = {
  debugPlayground: storyUrl('financialinput--debug-playground'),
  keyboardTester: storyUrl('financialinput--keyboard-tester'),
  default: storyUrl('financialinput--default'),
  shortcuts: storyUrl('financialinput--shortcuts'),
  wholeNumbersOnly: storyUrl('financialinput--whole-numbers-only'),
  withValue: storyUrl('financialinput--with-value'),
  withFloatingLabel: storyUrl('financialinput--with-floating-label'),
  variants: storyUrl('financialinput--variants'),
  errorFeedback: storyUrl('financialinput--error-feedback'),
  withClearButton: storyUrl('financialinput--with-clear-button'),
  withCurrencySearch: storyUrl('financialinput--with-currency-search'),
  shortcutButtons: storyUrl('financialinput--shortcut-buttons')
};
