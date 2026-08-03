import type { Preview } from '@storybook/react-vite';
import { version } from '../package.json';

/*
    Storybook opts in to the stylesheet so the stories and the recorded demo
    GIFs show the styled input. Consumers of the library do not get this unless
    they import it themselves.
 */
import '../styles.css';

/*
    Which build you are actually looking at, on every screen.

    The deployed Storybook lags whatever is on a branch, and there is otherwise
    nothing on the page to tell you which is which — a fix can look missing when
    it simply has not been merged and redeployed yet.

    Suppressed with ?rfiBadge=0, which the demo recorder passes so the badge
    stays out of the GIFs.
 */
const VersionBadge = () => {
  const hidden =
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('rfiBadge') === '0';

  if (hidden) {
    return null;
  }

  return (
    <span
      style={{
        position: 'fixed',
        right: 6,
        bottom: 6,
        zIndex: 2147483647,
        padding: '2px 7px',
        borderRadius: 999,
        background: 'rgba(16, 24, 40, 0.72)',
        color: '#fff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        lineHeight: 1.6,
        letterSpacing: '0.02em',
        // Never intercept a click meant for the story underneath.
        pointerEvents: 'none',
        userSelect: 'none'
      }}
      title={`react-financial-input ${version}`}
    >
      v{version}
    </span>
  );
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <VersionBadge />
      </>
    )
  ],
  parameters: {
    options: {
      /*
          Grouped by what someone is trying to find out, rather than the order
          the stories happened to be written in: start here, then how it looks,
          then what it does, then how it is configured, then edge cases, then
          the device tools.
       */
      storySort: {
        order: [
          'Introduction',
          'FinancialInput',
          [
            // Start here
            'Debug (Playground)',
            'Default',
            'With Value',

            // How it looks
            'Variants',
            'With Floating Label',

            // What it does
            'Shortcuts',
            'Shortcut Buttons',
            'With Currency',
            'With Currency Search',
            'With Currency Picker',
            'With Clear Button',
            'Controlled',

            // How it is configured
            'Whole Numbers Only',
            'Four Decimal Places',
            'Limited To Six Digits',

            // Edge cases and states
            'Error Feedback',
            'With Error State',
            'Disabled',

            // Device tools
            'Mobile Viewport',
            'Keyboard tester'
          ]
        ]
      }
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
};

export default preview;
