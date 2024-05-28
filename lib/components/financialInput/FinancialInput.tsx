import React, { BaseSyntheticEvent, useEffect, useRef, useState } from 'react';
import { Nullable } from 'lib/types';
import { InputType } from 'lib/enums';
import { Selection } from 'lib/types/Selection.ts';
import {
  areDecimalsAllowed,
  DEFAULT_MAX_DECIMAL_PLACES,
  DEFAULT_MAX_DIGITS,
  handleInsertShortcuts,
  isNumericValueEqualToCsv,
  isOnlyDecimalPoint,
  isValidFinancialInputInsert,
  isValidNumericFinancialInput
} from 'lib/components/financialInput/financialInputUtils.ts';
import {
  csvToNumber,
  getCommaDifference,
  numberToCsv,
  reformatCsv
} from 'lib/utils';

interface FinancialInputOptions {
  scale?: number;
  maxDigits?: number;
}

export interface FinancialInputProps {
  value?: Nullable<number>;
  onChange?: (value?: Nullable<number>) => void;
  onError?: any; // TODO: Fix type
  options?: FinancialInputOptions;
  isConsoleLoggingEnabled?: boolean;
}
export const FinancialInput: React.FC<FinancialInputProps> = (
  props: FinancialInputProps
) => {
  const {
    value,
    onChange = () => {},
    isConsoleLoggingEnabled = true,
    options = {},
    onError
  } = props;
  const { scale = DEFAULT_MAX_DECIMAL_PLACES, maxDigits = DEFAULT_MAX_DIGITS } =
    options;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selection, setSelection] = useState<Selection>({
    start: 0,
    end: 0
  });

  const setCursor = (cursor: number) =>
    setSelection({
      start: cursor,
      end: cursor
    });

  const defaultDisplayValue =
    value !== null && value !== undefined ? String(value) : '';

  const [displayValue, setDisplayValue] = useState<string>(defaultDisplayValue);

  // Utils
  const reformatCsvAndSetValues = (
    displayValue: string,
    cursor: number,
    isChanged: boolean = true
  ) => {
    const newDisplayValue = reformatCsvAndSetDisplayValueAndCursor(
      displayValue,
      cursor
    );
    if (isChanged && onChange) {
      onChange(csvToNumber(newDisplayValue));
    }
  };

  const reformatCsvAndSetDisplayValueAndCursor = (
    displayValue: string,
    cursor: number
  ) => {
    const newDisplayValue = reformatCsv(displayValue);
    setDisplayValue(newDisplayValue);
    setCursor(cursor);

    return newDisplayValue;
  };

  const shouldCallOnChange = (
    scale: number,
    targetValue: string,
    value?: Nullable<number>
  ): boolean =>
    areDecimalsAllowed(scale) && isOnlyDecimalPoint(targetValue)
      ? false
      : !isNumericValueEqualToCsv(value, targetValue);

  const handleDecimalOnly = (seletionStart: number) => {
    onChange(NaN);
    setDisplayValue('.');
    setCursor(seletionStart);
  };
  // -- End of Utils

  // Handlers
  const handleError = (cursorToSet: number) => {
    onError && onError();
    setCursor(cursorToSet);
  };
  // End of Handlers

  // Input type handlers
  const handleInsertText = (
    targetValue: string,
    data: string,
    selectionStart: number
  ) => {
    const {
      numericValueToSet: numericValueToSetForInsert,
      isError: isShortCutErrorForInsert,
      hasValidShortcut: hasValidShortcutForInsert
    } = handleInsertShortcuts(targetValue, data);

    if (isShortCutErrorForInsert) {
      handleError(selectionStart - 1);
    } else if (
      isValidFinancialInputInsert(targetValue, data, maxDigits, scale)
    ) {
      if (!shouldCallOnChange(scale, targetValue, value)) {
        reformatCsvAndSetDisplayValueAndCursor(targetValue, selectionStart);
      } else if (
        numericValueToSetForInsert !== null &&
        isValidNumericFinancialInput(
          numericValueToSetForInsert,
          maxDigits,
          scale
        )
      ) {
        const newDisplayedValue = hasValidShortcutForInsert
          ? numberToCsv(numericValueToSetForInsert)
          : reformatCsv(targetValue);

        const customSelectionStart = hasValidShortcutForInsert
          ? newDisplayedValue.length
          : selectionStart +
            getCommaDifference(displayValue, newDisplayedValue);

        reformatCsvAndSetValues(
          newDisplayedValue,
          customSelectionStart,
          shouldCallOnChange(scale, targetValue, value)
        );
      } else {
        handleError(selectionStart - 1);
      }
    } else {
      handleError(selectionStart - 1);
    }
  };

  const handleInsertFromPaste = () => {};
  const handleInsertFromDrop = () => {};
  const handleDeleteByCut = () => {};
  const handleDeleteContentBackwards = (
    targetValue: string,
    selectionStart: number
  ): void => {
    if (displayValue.charAt(selectionStart) === ',') {
      setCursor(selectionStart);
    } else {
      if (isNumericValueEqualToCsv(value, targetValue)) {
        const newDisplayValue = reformatCsv(targetValue);
        setDisplayValue(newDisplayValue);
        onChange(csvToNumber(newDisplayValue));
        setCursor(selectionStart);
      } else if (targetValue === '') {
        reformatCsvAndSetValues('', selectionStart);
      } else if (targetValue === '.') {
        handleDecimalOnly(selectionStart);
      } else if (csvToNumber(targetValue) === 0) {
        reformatCsvAndSetValues('0', selectionStart);
      } else {
        reformatCsvAndSetValues(targetValue, selectionStart);
      }
    }
  };
  const handleDeleteContentForwards = () => {};

  // --- End of input type handlers
  const handleInput = (event: BaseSyntheticEvent<InputEvent>) => {
    const { nativeEvent, target } = event;
    const { inputType, data: nativeEventData = '' } = nativeEvent;
    const { value: targetValue, selectionStart } = target;
    const data = nativeEventData ?? '';

    // console.log({ inputType, targetValue, data, selectionStart });
    switch (inputType) {
      case InputType.INSERT_TEXT:
        handleInsertText(targetValue, data, selectionStart);
        break;
      case InputType.INSERT_FROM_PASTE:
        handleInsertFromPaste();
        break;
      case InputType.INSERT_FROM_DROP:
        handleInsertFromDrop();
        break;
      case InputType.DELETE_BY_CUT:
        handleDeleteByCut();
        break;
      case InputType.DELETE_CONTENT_BACKWARD:
        handleDeleteContentBackwards(targetValue, selectionStart);
        break;
      case InputType.DELETE_CONTENT_FORWARD:
        handleDeleteContentForwards();
        break;
      default:
        isConsoleLoggingEnabled &&
          console.log(`FinancialInput - Unsupported input type: ${inputType}`);
    }
  };

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      const { start, end } = selection;
      input.setSelectionRange(start, end);
    }
  }, [inputRef, selection, displayValue]);

  return <input ref={inputRef} value={displayValue} onInput={handleInput} />;
};
