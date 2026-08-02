import type { Preview } from '@storybook/react-vite';

/*
    Storybook opts in to the stylesheet so the stories and the recorded demo
    GIFs show the styled input. Consumers of the library do not get this unless
    they import it themselves.
 */
import '../styles.css';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Introduction',
          'FinancialInput',
          ['Playground'],
          'Keyboard tester'
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
