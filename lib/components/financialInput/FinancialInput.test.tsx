import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinancialInput } from './FinancialInput';

/*
    Deliberately thin. The formatting and validation rules are covered by the
    reducer and util tables; this file only proves the wiring holds together in
    a real DOM.
 */

const setup = (props = {}) => {
  const user = userEvent.setup();
  render(<FinancialInput {...props} />);

  return { user, input: screen.getByRole('textbox') as HTMLInputElement };
};

describe('<FinancialInput />', () => {
  it('formats digits as they are typed', async () => {
    const { user, input } = setup();

    await user.type(input, '1234567');

    expect(input).toHaveValue('1,234,567');
  });

  it('expands a shortcut', async () => {
    const { user, input } = setup();

    await user.type(input, '2.5m');

    expect(input).toHaveValue('2,500,000');
  });

  it('reports the numeric value, not the formatted one', async () => {
    const onChange = vi.fn();
    const { user, input } = setup({ onChange });

    await user.type(input, '1000');

    expect(onChange).toHaveBeenLastCalledWith(1000);
  });

  it('refuses a third decimal place and reports it', async () => {
    const onError = vi.fn();
    const { user, input } = setup({ onError });

    await user.type(input, '1.234');

    expect(input).toHaveValue('1.23');
    expect(onError).toHaveBeenCalled();
  });

  it('backspaces across a grouping separator', async () => {
    const { user, input } = setup();

    await user.type(input, '1000');
    expect(input).toHaveValue('1,000');

    await user.type(input, '{Backspace}');
    expect(input).toHaveValue('100');
  });

  it('renders the given value formatted', () => {
    const { input } = setup({ value: 1234567.5 });

    expect(input).toHaveValue('1,234,567.5');
  });

  it('sets the attributes that make mobile show a numeric keypad', () => {
    const { input } = setup();

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('merges a consumer className with its own', () => {
    const { input } = setup({ className: 'my-input' });

    expect(input).toHaveClass('rfi-input', 'my-input');
  });

  it('passes native input props straight through', () => {
    const { input } = setup({
      placeholder: 'Amount',
      disabled: true,
      name: 'amount',
      'aria-label': 'Amount'
    });

    expect(input).toHaveAttribute('placeholder', 'Amount');
    expect(input).toHaveAttribute('name', 'amount');
    expect(input).toBeDisabled();
  });

  it('forwards a ref to the underlying input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<FinancialInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('still calls a consumer onInput handler', async () => {
    const onInput = vi.fn();
    const { user, input } = setup({ onInput });

    await user.type(input, '1');

    expect(onInput).toHaveBeenCalled();
  });
});
