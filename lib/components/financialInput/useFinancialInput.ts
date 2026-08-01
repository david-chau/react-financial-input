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
  reduceInput,
  reduceShortcut
} from './financialInputReducer';

/** The class is inert unless `react-financial-input/styles.css` is imported. */
export const INPUT_CLASS_NAME = 'rfi-input';

export interface FinancialInputOptions {
  /** Maximum number of decimal places. Defaults to 2. Use 0 for whole numbers. */
  scale?: number;
  /** Maximum number of integer digits. Defaults to 11. */
  maxDigits?: number;
  /*
      Which keyboard mobile raises. Defaults to 'text'.

      Mobile numeric keypads have no letter keys, so 'decimal' and 'numeric'
      make the h/k/m/b shortcuts physically unreachable on a phone — which
      leaves an ordinary formatted number input, and the shortcuts working on
      every device is the point of this library.

      Set 'decimal' or 'numeric' if a numeric keypad matters more than typed
      shortcuts for your users; pair it with `applyShortcut` and a row of tap
      targets so the multipliers stay reachable.
   */
  inputMode?: 'decimal' | 'numeric' | 'text';
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
  const {
    scale = DEFAULT_SCALE,
    maxDigits = DEFAULT_MAX_DIGITS,
    inputMode = 'text'
  } = options;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<FinancialInputState>(() =>
    createInitialState(value)
  );

  /*
      Merging the caller's ref has to be cached on the caller's ref identity.
      Building it inline would hand React a new callback ref on every render,
      and React detaches and re-attaches a ref whose identity changed — so a
      consumer's callback ref would fire on every render. If that callback sets
      state, the result is an infinite render loop.
   */
  const mergedRef = useRef<{
    external: Ref<HTMLInputElement> | undefined;
    merged: (node: HTMLInputElement | null) => void;
  } | null>(null);

  const getMergedRef = (external?: Ref<HTMLInputElement>) => {
    if (!mergedRef.current || mergedRef.current.external !== external) {
      mergedRef.current = { external, merged: mergeRefs(inputRef, external) };
    }

    return mergedRef.current.merged;
  };

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
      Applies a multiplier as if it had been typed. The escape hatch for mobile
      keypads, which have no letter keys — wire it to a row of tap targets.
   */
  const applyShortcut = (character: string) => {
    const next = reduceShortcut(state, character, scale, maxDigits);

    setState(next);
    inputRef.current?.focus();

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
    /*
        type stays 'text' always: type="number" cannot hold a value containing
        grouping separators, so the browser would reject the formatted value.

        inputMode defaults to 'text' so that the h/k/m/b shortcuts are typeable
        on a phone. Every mobile numeric keypad omits letter keys, so 'decimal'
        would silently reduce this to an ordinary formatted number input on
        exactly the devices this library exists to handle. Consumers who want
        the keypad set options.inputMode and reach the multipliers through
        applyShortcut instead.

        Both sit before ...rest, so a caller can still override either.
     */
    type: 'text',
    inputMode,
    autoComplete: 'off',
    ...rest,
    ref: getMergedRef(ref),
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
    getInputProps,
    applyShortcut
  };
};
