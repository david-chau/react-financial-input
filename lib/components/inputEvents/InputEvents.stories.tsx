import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputEventsPanel } from './InputEventsPanel';

/*
    Separate from the FinancialInput stories on purpose. These utilities have
    nothing to do with currency, and filing them under the currency input would
    suggest otherwise.
 */
const meta: Meta<typeof InputEventsPanel> = {
  title: 'Input events',
  component: InputEventsPanel,
  parameters: { layout: 'fullscreen' }
};

export default meta;

type Story = StoryObj<typeof InputEventsPanel>;

/*
    Read the two panels side by side, then paste something. The left column is
    what a desktop app already has; the right is what one extra argument buys.
 */
export const Playground: Story = {};

/*
    Same panel at phone width, which is where the difference stops being
    academic: soft keyboards send gestures desktop code never sees.
 */
export const OnAPhone: Story = {
  name: 'On a phone',
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
