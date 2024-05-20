import React, { BaseSyntheticEvent, useEffect, useRef, useState } from 'react';
import { Nullable } from 'src/types';
import { InputType } from 'src/enums';
import { Selection } from 'src/types/Selection';
import { toCommaSeparatedNumber } from '../../utils';

interface FinancialInputOptions {
  scale?: number;
  maxDigits?: number;
}

export interface FinancialInputProps {
  value?: Nullable<number>;
  onChange?: (value: Nullable<number>) => void;
  options?: FinancialInputOptions;
}
export const FinancialInput: React.FC<FinancialInputProps> = (
  props: FinancialInputProps
) => {
  const { value, onChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Selection>({
    start: 0,
    end: 0
  });

  const defaultDisplayValue =
    value !== null && value !== undefined ? String(value) : '';

  const [displayValue, setDisplayValue] = useState<string>(defaultDisplayValue);

  const handleInput = (event: BaseSyntheticEvent<InputEvent>) => {
    const { nativeEvent, target } = event;
    const { inputType } = nativeEvent;
    const { value: targetValue, selectionStart } = target;

    switch (inputType) {
      case InputType.INSERT_TEXT:
      case InputType.INSERT_FROM_PASTE:
      case InputType.DELETE_BY_CUT:
      case InputType.DELETE_CONTENT_BACKWARD:
      case InputType.DELETE_CONTENT_FORWARD:
        // sanitize targetValue string -> number
        setDisplayValue(toCommaSeparatedNumber(targetValue));

        setSelection({
          start: selectionStart,
          end: selectionStart
        });
        onChange && onChange(targetValue);
        break;
      default:
        console.log(`FinancialInput - Unsupported input type: ${inputType}`);
    }
  };

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      const { start, end } = selection;
      input.setSelectionRange(start, end);
    }
  }, [inputRef, selection]);

  return <input ref={inputRef} value={displayValue} onInput={handleInput} />;
};
