import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../lib/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  viteFinal: async (config) => {
    /*
        Deployed to a GitHub project page, so everything is served from
        /react-financial-input/ rather than the root.
     */
    config.base = process.env.STORYBOOK_BASE_PATH ?? '/';

    // The library build config is irrelevant to Storybook and confuses it.
    delete config.build?.lib;

    return config;
  }
};

export default config;
