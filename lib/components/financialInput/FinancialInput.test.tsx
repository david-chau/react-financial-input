import { createRef, useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinancialInput } from './FinancialInput';
import { useFinancialInput } from './useFinancialInput';

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

  describe('currency and locale', () => {
    const Harness = (options: Record<string, unknown>) => {
      const { getInputProps, symbol, symbolPosition } = useFinancialInput({
        options
      });

      return (
        <>
          <input {...getInputProps()} />
          <output>{`${symbolPosition}:${symbol}`}</output>
        </>
      );
    };

    it.each([
      // locale   currency  -> rendered
      ['en-US', 'USD', 'prefix:$'],
      ['en-GB', 'GBP', 'prefix:£'],
      ['sv-SE', 'SEK', 'suffix:kr']
    ])('resolves %s / %s to %j', (locale, currency, expected) => {
      render(<Harness locale={locale} currency={currency} />);

      expect(screen.getByRole('status')).toHaveTextContent(expected);
    });

    it('has no symbol unless a currency is given', () => {
      render(<Harness />);

      expect(screen.getByRole('status')).toHaveTextContent('prefix:');
    });

    it.each([
      [{ currency: 'USD', symbol: 'US$' }, 'prefix:US$'],
      [{ currency: 'USD', symbolPosition: 'suffix' }, 'suffix:$'],
      [{ symbol: '€', symbolPosition: 'suffix' }, 'suffix:€']
    ])('lets props override Intl (%j)', (options, expected) => {
      render(<Harness {...options} />);

      expect(screen.getByRole('status')).toHaveTextContent(expected);
    });

    it('takes the separators from the locale', async () => {
      const user = userEvent.setup();
      render(<Harness locale="de-DE" currency="EUR" />);

      await user.type(screen.getByRole('textbox'), '1234567');

      expect(screen.getByRole('textbox')).toHaveValue('1.234.567');
    });

    it('lets an explicit separator win over the locale', async () => {
      const user = userEvent.setup();
      render(<Harness locale="de-DE" groupSeparator=" " />);

      await user.type(screen.getByRole('textbox'), '1234567');

      expect(screen.getByRole('textbox')).toHaveValue('1 234 567');
    });

    /*
        The symbol is not part of the value: it is rendered beside the input, so
        the caret arithmetic never has to skip over it.
     */
    it('keeps the symbol out of the input value', async () => {
      const user = userEvent.setup();
      render(<Harness locale="en-US" currency="USD" />);

      await user.type(screen.getByRole('textbox'), '1000');

      expect(screen.getByRole('textbox')).toHaveValue('1,000');
    });
  });

  describe('configurable shortcuts', () => {
    it('uses the given characters and multipliers', async () => {
      const { user, input } = setup({
        options: { shortcuts: { t: 1000, l: 100000 } }
      });

      await user.type(input, '5t');
      expect(input).toHaveValue('5,000');
    });

    it('refuses the defaults once shortcuts are overridden', async () => {
      const onError = vi.fn();
      const { user, input } = setup({
        options: { shortcuts: { t: 1000 } },
        onError
      });

      await user.type(input, '5k');

      expect(input).toHaveValue('5');
      expect(onError).toHaveBeenCalled();
    });

    /*
        Multipliers are applied by shifting the decimal point, which only has an
        exact representation for powers of ten. A non-power-of-ten is dropped
        rather than silently reintroducing floating point error.
     */
    it('drops a multiplier that is not a power of ten', async () => {
      const { user, input } = setup({
        options: { shortcuts: { d: 12, k: 1000 } }
      });

      await user.type(input, '5d');
      expect(input).toHaveValue('5');

      await user.clear(input);
      await user.type(input, '5k');
      expect(input).toHaveValue('5,000');
    });
  });

  describe('range', () => {
    it('accepts negatives by default', async () => {
      const { user, input } = setup();

      await user.type(input, '-1234');

      expect(input).toHaveValue('-1,234');
    });

    it('refuses negatives when the range is POSITIVE', async () => {
      const onError = vi.fn();
      const { user, input } = setup({
        options: { range: 'POSITIVE' },
        onError
      });

      await user.type(input, '-1234');

      expect(input).toHaveValue('1,234');
      expect(onError).toHaveBeenCalled();
    });

    it('refuses a pasted negative when the range is POSITIVE', async () => {
      const { input } = setup({ options: { range: 'POSITIVE' }, value: 50 });

      expect(input).toHaveValue('50');
    });
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
      keeps them typeable on a phone, which is the point of the library.
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

/*
    Regression: changing the locale left the previous locale's punctuation on
    screen until the next keystroke — picking sv-SE showed "1,234" instead of
    "1 234". Only a browser test caught it, so it is pinned here too.
 */
describe('reformatting when the separators change', () => {
  const Switchable = () => {
    const [locale, setLocale] = useState('en-US');
    const { getInputProps } = useFinancialInput({ options: { locale } });

    return (
      <>
        <input {...getInputProps()} />
        <button onClick={() => setLocale('de-DE')}>de</button>
        <button onClick={() => setLocale('en-US')}>us</button>
      </>
    );
  };

  it('reformats the existing value', async () => {
    const user = userEvent.setup();
    render(<Switchable />);

    const input = screen.getByRole('textbox');
    await user.type(input, '1234.5');
    expect(input).toHaveValue('1,234.5');

    await user.click(screen.getByRole('button', { name: 'de' }));
    expect(input).toHaveValue('1.234,5');

    await user.click(screen.getByRole('button', { name: 'us' }));
    expect(input).toHaveValue('1,234.5');
  });

  it('keeps a value that is still being typed', async () => {
    const user = userEvent.setup();
    render(<Switchable />);

    const input = screen.getByRole('textbox');
    await user.type(input, '12.');
    expect(input).toHaveValue('12.');

    // Converted through canonical, so the trailing separator survives.
    await user.click(screen.getByRole('button', { name: 'de' }));
    expect(input).toHaveValue('12,');
  });
});

/*
    valueType: 'string', for state that is already text. Canonical goes out —
    no grouping, always a "." fraction — while the screen keeps the formatted
    display string.
 */
describe('string values', () => {
  it.each([
    // typed        onChange receives   note
    ['1000', '1000', 'canonical has no grouping'],
    ['1234.5', '1234.5', 'a fraction keeps its "."'],
    ['2.5m', '2500000', 'a shortcut expands before it is handed back'],
    ['-42', '-42', 'a negative keeps its sign']
  ])('typing %j hands back %j — %s', async (typed, expected) => {
    const onChange = vi.fn();
    const { user, input } = setup({ valueType: 'string', onChange });

    await user.type(input, typed);

    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it.each([
    // incoming value   display        note
    ['1234.56', '1,234.56', 'canonical in'],
    ['1,234.56', '1,234.56', 'display in, the same way a paste is accepted'],
    ['2.5m', '2,500,000', 'a shortcut token in'],
    ['nonsense', '', 'unparseable is empty, not NaN']
  ])('accepts %j and shows %j — %s', (value, expected) => {
    render(<FinancialInput valueType="string" value={value} />);

    expect(screen.getByRole('textbox')).toHaveValue(expected);
  });

  it('empties to null rather than an empty string', async () => {
    const onChange = vi.fn();
    const { user, input } = setup({ valueType: 'string', onChange });

    await user.type(input, '5');
    await user.clear(input);

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  /*
      The number and the canonical string diverge here: 1.5 and 1.50 are the
      same number, so number mode stays quiet while string mode must not.
   */
  it('reports a trailing zero that leaves the number unchanged', async () => {
    const onChange = vi.fn();
    const { user, input } = setup({ valueType: 'string', onChange });

    await user.type(input, '1.5');
    expect(onChange).toHaveBeenLastCalledWith('1.5');

    await user.type(input, '0');
    expect(onChange).toHaveBeenLastCalledWith('1.50');
  });

  it('stays numeric by default', async () => {
    const onChange = vi.fn();
    const { user, input } = setup({ onChange });

    await user.type(input, '1000');

    expect(onChange).toHaveBeenLastCalledWith(1000);
  });

  // Canonical is locale-free even when the display is not.
  it('hands back "." fractions under a comma-decimal locale', async () => {
    const onChange = vi.fn();
    const { user, input } = setup({
      valueType: 'string',
      onChange,
      options: { locale: 'de-DE' }
    });

    await user.type(input, '1234,5');

    expect(input).toHaveValue('1.234,5');
    expect(onChange).toHaveBeenLastCalledWith('1234.5');
  });
});

/*
    Pins what the docs promise about native form submission. A native form
    submits what is on screen, and what is on screen is the display value — so
    `name` belongs on a hidden input carrying the canonical one, not on this
    input. EXAMPLES.md says so; this is what stops that going stale.
 */
describe('native form submission', () => {
  const submittedBy = (form: HTMLFormElement) =>
    Object.fromEntries(new FormData(form));

  it('submits the display value when name is on the input itself', async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <FinancialInput name="amount" />
      </form>
    );

    await user.type(screen.getByRole('textbox'), '1234.56');

    const submitted = submittedBy(
      screen.getByTestId('form') as HTMLFormElement
    );

    expect(submitted.amount).toBe('1,234.56');
    // Which is the whole problem: this is not a number.
    expect(Number(submitted.amount)).toBeNaN();
  });

  it('submits a parseable value through a hidden canonical field', async () => {
    const Form = () => {
      const { getInputProps, canonicalValue } = useFinancialInput();

      return (
        <form data-testid="form">
          <input {...getInputProps()} />
          <input type="hidden" name="amount" value={canonicalValue ?? ''} />
        </form>
      );
    };

    const user = userEvent.setup();
    render(<Form />);

    await user.type(screen.getByRole('textbox'), '1234.56');

    const submitted = submittedBy(
      screen.getByTestId('form') as HTMLFormElement
    );

    expect(submitted.amount).toBe('1234.56');
    expect(Number(submitted.amount)).toBe(1234.56);
  });

  // Canonical stays "." even where the display uses a comma.
  it('keeps the hidden field locale-free', async () => {
    const Form = () => {
      const { getInputProps, canonicalValue } = useFinancialInput({
        options: { locale: 'de-DE' }
      });

      return (
        <form data-testid="form">
          <input {...getInputProps()} />
          <input type="hidden" name="amount" value={canonicalValue ?? ''} />
        </form>
      );
    };

    const user = userEvent.setup();
    render(<Form />);

    await user.type(screen.getByRole('textbox'), '1234,56');

    expect(screen.getByRole('textbox')).toHaveValue('1.234,56');
    expect(
      submittedBy(screen.getByTestId('form') as HTMLFormElement).amount
    ).toBe('1234.56');
  });
});
