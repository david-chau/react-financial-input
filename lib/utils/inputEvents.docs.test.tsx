import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describeEdit } from '../events';

/*
    The "digits only" component from EXAMPLES.md, copied verbatim.

    Documentation code that has never run is worse than none, and this one is
    load-bearing: it is the migration path offered to anyone with an existing
    desktop input. If it stops working, this fails rather than a reader finding
    out.

    Keep the two in step. If you change the example, change it here.
 */
const DigitsOnly = () => {
  const [value, setValue] = useState('');
  const previous = useRef('');

  return (
    <input
      value={value}
      onInput={(reactEvent) => {
        const next = reactEvent.currentTarget.value;
        const edit = describeEdit(
          previous.current,
          next,
          reactEvent.nativeEvent as InputEvent
        );

        // Still being composed by an IME: leave it alone until it settles.
        if (edit.kind === 'compose') return;

        // Judge what arrived, not which key was pressed.
        if (/[^0-9]/.test(edit.text)) {
          setValue(previous.current);
          return;
        }

        previous.current = next;
        setValue(next);
      }}
      onChange={() => {
        // onInput does the work.
      }}
    />
  );
};

describe('the EXAMPLES.md migration pattern', () => {
  const setup = () => {
    const user = userEvent.setup();
    render(<DigitsOnly />);

    return { user, input: screen.getByRole('textbox') };
  };

  it('takes digits and drops the letter between them', async () => {
    const { user, input } = setup();

    await user.type(input, '12a3');

    expect(input).toHaveValue('123');
  });

  /*
      The case the keydown guard in the example above it cannot catch at all,
      because a paste never fires keydown.
   */
  it('refuses a pasted string that is not all digits', async () => {
    const { user, input } = setup();

    await user.type(input, '5');
    await user.click(input);
    await user.paste('$1,234.56 USD');

    expect(input).toHaveValue('5');
  });

  it('accepts a pasted run of digits', async () => {
    const { user, input } = setup();

    await user.click(input);
    await user.paste('1234');

    expect(input).toHaveValue('1234');
  });
});
