import { InputHTMLAttributes, forwardRef } from 'react';
import { Nullable } from '../../types';
import { FinancialInputOptions, useFinancialInput } from './useFinancialInput';

export interface FinancialInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange'
> {
  value?: Nullable<number>;
  onChange?: (value: Nullable<number>) => void;
  /** Called when a keystroke is refused, for example a third decimal place. */
  onError?: () => void;
  options?: FinancialInputOptions;
}

export const FinancialInput = forwardRef<HTMLInputElement, FinancialInputProps>(
  ({ value, onChange, onError, options, ...rest }, ref) => {
    const { getInputProps } = useFinancialInput({
      value,
      onChange,
      onError,
      options
    });

    return <input {...getInputProps({ ...rest, ref })} />;
  }
);

FinancialInput.displayName = 'FinancialInput';
