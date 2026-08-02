/*
    Storybook's iframe endpoint renders a story with no sidebar, toolbar or
    addon panel — a bare page containing just the component. It means the e2e
    tests and the demo recordings drive the same stories that ship, with no
    separate demo app to keep in sync.
 */
export const storyUrl = (id: string): string =>
  `/iframe.html?id=${id}&viewMode=story`;

export const STORIES = {
  default: storyUrl('financialinput--default'),
  shortcuts: storyUrl('financialinput--shortcuts'),
  wholeNumbersOnly: storyUrl('financialinput--whole-numbers-only'),
  withValue: storyUrl('financialinput--with-value'),
  withFloatingLabel: storyUrl('financialinput--with-floating-label'),
  variants: storyUrl('financialinput--variants'),
  errorFeedback: storyUrl('financialinput--error-feedback'),
  withClearButton: storyUrl('financialinput--with-clear-button'),
  shortcutButtons: storyUrl('financialinput--shortcut-buttons')
};
