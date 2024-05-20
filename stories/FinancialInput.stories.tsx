import { fn } from '@storybook/test';
import { useArgs } from '@storybook/preview-api';
import { FinancialInput, FinancialInputProps, Nullable } from '../src';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
export default {
  title: 'Example/FinancialInput',
  component: FinancialInput,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered'
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {}
};

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Uncontrolled = {
  args: {}
};

export const Controlled = {
  args: {
    value: 100,
    onChange: fn()
  },
  render: function Component(args: FinancialInputProps) {
    const [, setArgs] = useArgs();

    const onChange = (value: Nullable<number>) => {
      // Call the provided callback
      // This is used for the Actions tab
      args.onChange?.(value);

      // Update the arg in Storybook
      setArgs({ value });
    };

    // Forward all args and overwrite onValueChange
    return <FinancialInput {...args} onChange={onChange} />;
  }
};
