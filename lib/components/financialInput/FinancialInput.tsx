import { InputHTMLAttributes, forwardRef } from 'react';
import { Nullable } from '../../types';
import {
  FinancialInputOptions,
  UseFinancialInputOptions,
  useFinancialInput
} from './useFinancialInput';

export interface FinancialInputOwnProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange'
> {
  /** Called when a keystroke is refused, for example a third decimal place. */
  onError?: () => void;
  options?: FinancialInputOptions;
}

/*
    Two shapes, discriminated on `valueType`. Numbers are the default; strings
    are for state that is already text — see StringValueOptions on the hook for
    what is accepted in and what comes back out.
 */
export type FinancialInputProps = FinancialInputOwnProps &
  (
    | {
        valueType?: 'number';
        value?: Nullable<number>;
        onChange?: (value: Nullable<number>) => void;
      }
    | {
        valueType: 'string';
        value?: Nullable<string>;
        onChange?: (value: Nullable<string>) => void;
      }
  );

export const FinancialInput = forwardRef<HTMLInputElement, FinancialInputProps>(
  ({ value, onChange, onError, valueType, options, ...rest }, ref) => {
    const { getInputProps } = useFinancialInput({
      value,
      onChange,
      onError,
      valueType,
      options
    } as UseFinancialInputOptions);

    return <input {...getInputProps({ ...rest, ref })} />;
  }
);

FinancialInput.displayName = 'FinancialInput';
