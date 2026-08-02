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
      storySort: {
        order: [
          'Introduction',
          'FinancialInput',
          ['Debug (Playground)', 'Default', 'Variants']
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
