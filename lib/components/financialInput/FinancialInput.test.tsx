import { createRef, useCallback, useState } from 'react';
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

  describe('separators', () => {
    const deDE = { groupSeparator: '.', decimalSeparator: ',' };

    it('groups and parses in the German convention', async () => {
      const onChange = vi.fn();
      const { user, input } = setup({ options: deDE, onChange });

      await user.type(input, '1234567');
      expect(input).toHaveValue('1.234.567');

      await user.type(input, ',5');
      expect(input).toHaveValue('1.234.567,5');
      expect(onChange).toHaveBeenLastCalledWith(1234567.5);
    });

    it('refuses the English decimal point when the comma is the separator', async () => {
      const onError = vi.fn();
      const { user, input } = setup({ options: deDE, onError });

      await user.type(input, '1.5');

      // The "." is a grouping separator here, so it is formatter output only.
      expect(input).toHaveValue('15');
      expect(onError).toHaveBeenCalled();
    });

    it('renders an initial value with the configured separators', () => {
      const { input } = setup({ value: 1234567.89, options: deDE });

      expect(input).toHaveValue('1.234.567,89');
    });

    it('expands shortcuts with the configured separators', async () => {
      const { user, input } = setup({ options: deDE });

      await user.type(input, '2,5m');

      expect(input).toHaveValue('2.500.000');
    });

    it('throws when the separators are ambiguous', () => {
      // Both the same would make "1,234" impossible to interpret.
      expect(() =>
        render(
          <FinancialInput
            options={{ groupSeparator: ',', decimalSeparator: ',' }}
          />
        )
      ).toThrow(/invalid separators/);
    });
  });

  describe('controlled mode', () => {
    const Controlled = ({ initial }: { initial: number | null }) => {
      const [value, setValue] = useState<number | null>(initial);

      return (
        <>
          <FinancialInput value={value} onChange={setValue} />
          <button onClick={() => setValue(5000)}>set</button>
          <button onClick={() => setValue(null)}>clear</button>
          <output>{value === null ? 'null' : value}</output>
        </>
      );
    };

    it('follows the value prop when the parent changes it', async () => {
      const user = userEvent.setup();
      render(<Controlled initial={1000} />);

      expect(screen.getByRole('textbox')).toHaveValue('1,000');

      await user.click(screen.getByRole('button', { name: 'set' }));
      expect(screen.getByRole('textbox')).toHaveValue('5,000');

      await user.click(screen.getByRole('button', { name: 'clear' }));
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    /*
        The parent echoing back the value this input just emitted is not an
        external change. Reformatting on it would discard a trailing "." or the
        zero in "1.50" while the user is still typing.
     */
    it('does not reformat while typing when the parent echoes the value back', async () => {
      const user = userEvent.setup();
      render(<Controlled initial={null} />);

      const input = screen.getByRole('textbox');

      await user.type(input, '1.50');

      expect(input).toHaveValue('1.50');
      expect(screen.getByRole('status')).toHaveTextContent('1.5');
    });

    it('keeps a trailing decimal point while typing', async () => {
      const user = userEvent.setup();
      render(<Controlled initial={null} />);

      const input = screen.getByRole('textbox');

      await user.type(input, '12.');

      expect(input).toHaveValue('12.');
    });
  });

  /*
      Mobile numeric keypads have no letter keys, so inputmode="decimal" would
      make the h/k/m/b shortcuts unreachable on a phone. Defaulting to "text"
      keeps them typeable on every device, which is the point of the library.
   */
  it('defaults to a keyboard that can type the shortcut letters', () => {
    const { input } = setup();

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it.each([
    // options.inputMode  expected   note
    [undefined, 'text', 'default keeps the shortcut letters typeable'],
    ['decimal', 'decimal', 'opt in to a keypad, losing typed shortcuts'],
    ['numeric', 'numeric', 'keypad without a decimal key'],
    ['text', 'text', 'explicit default']
  ])('options.inputMode %j renders %j (%s)', (inputMode, expected, _note) => {
    const { input } = setup({
      options: inputMode ? { inputMode } : {}
    });

    expect(input).toHaveAttribute('inputmode', expected);
  });

  it('never uses type=number, which cannot hold a grouped value', () => {
    const { input } = setup({ options: { inputMode: 'decimal' } });

    expect(input).toHaveAttribute('type', 'text');
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

  /*
      Regression: the merged ref used to be rebuilt on every render, so React
      detached and re-attached it each time and the consumer's callback ref
      fired repeatedly. A callback ref that sets state then looped until React
      threw "Maximum update depth exceeded".
   */
  it('does not re-invoke a stable callback ref on re-render', async () => {
    let attachments = 0;

    const Harness = () => {
      const [, setTick] = useState(0);
      const ref = useCallback((node: HTMLInputElement | null) => {
        if (node) attachments += 1;
      }, []);

      return (
        <>
          <FinancialInput ref={ref} />
          <button onClick={() => setTick((tick) => tick + 1)}>rerender</button>
        </>
      );
    };

    const user = userEvent.setup();
    render(<Harness />);
    expect(attachments).toBe(1);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button'));

    expect(attachments).toBe(1);
  });

  it('survives a callback ref that sets state', async () => {
    const Harness = () => {
      const [tagName, setTagName] = useState('');
      const ref = useCallback((node: HTMLInputElement | null) => {
        if (node) setTagName(node.tagName);
      }, []);

      return (
        <>
          <FinancialInput ref={ref} />
          <output>{tagName}</output>
        </>
      );
    };

    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('status')).toHaveTextContent('INPUT');

    await user.type(screen.getByRole('textbox'), '1000');
    expect(screen.getByRole('textbox')).toHaveValue('1,000');
  });

  it('still calls a consumer onInput handler', async () => {
    const onInput = vi.fn();
    const { user, input } = setup({ onInput });

    await user.type(input, '1');

    expect(onInput).toHaveBeenCalled();
  });
});
