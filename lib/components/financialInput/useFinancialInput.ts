import {
  InputHTMLAttributes,
  Ref,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { Nullable } from '../../types';
import { mergeRefs } from '../../utils';
import { DEFAULT_MAX_DIGITS, DEFAULT_SCALE } from './financialInputUtils';
import {
  FinancialInputState,
  createInitialState,
  reduceInput
} from './financialInputReducer';

/** The class is inert unless `react-financial-input/styles.css` is imported. */
export const INPUT_CLASS_NAME = 'rfi-input';

export interface FinancialInputOptions {
  /** Maximum number of decimal places. Defaults to 2. Use 0 for whole numbers. */
  scale?: number;
  /** Maximum number of integer digits. Defaults to 11. */
  maxDigits?: number;
}

export interface UseFinancialInputOptions {
  value?: Nullable<number>;
  onChange?: (value: Nullable<number>) => void;
  onError?: () => void;
  options?: FinancialInputOptions;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

/*
    React 18 types the onInput handler with FormEvent, React 19 with its own
    InputEvent. Only these two fields are needed, so a structural type keeps the
    hook compiling against both.
 */
interface InputLikeEvent {
  nativeEvent: Event;
  currentTarget: HTMLInputElement;
}

export const useFinancialInput = ({
  value,
  onChange,
  onError,
  options = {}
}: UseFinancialInputOptions = {}) => {
  const { scale = DEFAULT_SCALE, maxDigits = DEFAULT_MAX_DIGITS } = options;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<FinancialInputState>(() =>
    createInitialState(value)
  );

  const handleInput = (event: InputLikeEvent) => {
    const { inputType, data } = event.nativeEvent as globalThis.InputEvent;
    const target = event.currentTarget;

    const next = reduceInput(state, {
      inputType,
      data,
      targetValue: target.value,
      selectionStart: target.selectionStart ?? target.value.length,
      scale,
      maxDigits
    });

    setState(next);

    if (next.rejected) {
      onError?.();
    } else if (next.numericValue !== state.numericValue) {
      onChange?.(next.numericValue);
    }
  };

  /*
      Puts the caret back after React re-renders with the reformatted value.
      Guarded on focus and on the caret already being in the right place, so it
      cannot steal focus or fight a user who is selecting text.
   */
  useLayoutEffect(() => {
    const input = inputRef.current;

    if (!input || document.activeElement !== input) {
      return;
    }

    if (
      input.selectionStart === state.cursor &&
      input.selectionEnd === state.cursor
    ) {
      return;
    }

    input.setSelectionRange(state.cursor, state.cursor);
  }, [state]);

  const getInputProps = ({
    className,
    onInput,
    ref,
    ...rest
  }: InputProps = {}): InputProps => ({
    type: 'text',
    // The reason mobile shows a numeric keypad instead of the alphabet.
    inputMode: 'decimal',
    autoComplete: 'off',
    ...rest,
    ref: mergeRefs(inputRef, ref),
    value: state.displayValue,
    className: className
      ? `${INPUT_CLASS_NAME} ${className}`
      : INPUT_CLASS_NAME,
    onInput: (event) => {
      handleInput(event);
      onInput?.(event);
    }
  });

  return {
    inputRef,
    displayValue: state.displayValue,
    numericValue: state.numericValue,
    getInputProps
  };
};
