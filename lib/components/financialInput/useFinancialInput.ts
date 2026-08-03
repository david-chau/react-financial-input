import {
  InputHTMLAttributes,
  KeyboardEvent,
  Ref,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Nullable, StringKeyedMap } from '../../types';
import {
  DEFAULT_SEPARATORS,
  SymbolPosition,
  areSeparatorsValid,
  formatCanonical,
  mergeRefs,
  resolveCurrency,
  resolveSeparators,
  toCanonical
} from '../../utils';
import {
  DEFAULT_MAX_DIGITS,
  DEFAULT_SCALE,
  DEFAULT_SHORTCUTS,
  Range,
  parseAmount,
  toExponents
} from './financialInputUtils';
import { InputType } from '../../enums';
import {
  FinancialInputState,
  createInitialState,
  reduceClear,
  reduceCompositionEnd,
  reduceHistory,
  reduceInput,
  reduceShortcut
} from './financialInputReducer';

/** The class is inert unless `react-financial-input/styles.css` is imported. */
export const INPUT_CLASS_NAME = 'rfi-input';

/** Added for a moment when a keystroke is refused, so the refusal is visible. */
export const REJECTED_CLASS_NAME = 'rfi-input--rejected';

/** Must outlast the longest animation in styles.css. */
const REJECTED_FLASH_MS = 450;

export interface FinancialInputOptions {
  /** Maximum number of decimal places. Defaults to 2. Use 0 for whole numbers. */
  scale?: number;
  /** Maximum number of integer digits. Defaults to 11. */
  maxDigits?: number;
  /** Thousands separator. "," by default; "." for de-DE, " " for fr-FR. */
  groupSeparator?: string;
  /** Fraction separator. "." by default; "," for de-DE and fr-FR. */
  decimalSeparator?: string;
  /*
      Characters to multipliers, defaulting to h/k/m/b. Multipliers must be
      powers of ten — anything else has no exact decimal-shift representation
      and is dropped.
   */
  shortcuts?: StringKeyedMap<number>;
  /** 'POSITIVE' refuses negatives outright. Defaults to 'ALL'. */
  range?: Range;
  /*
      Briefly flag the input when a keystroke is refused. On by default:
      without it a refusal is completely silent, which reads as a dead input.

      The stylesheet flashes colour only. Add the `rfi-input--shake` class for
      motion as well; it is opt-in because some people find the movement
      unpleasant, and it is suppressed under prefers-reduced-motion regardless.
   */
  flashOnError?: boolean;
  /*
      A BCP 47 locale, used to derive the separators and the currency symbol.
      Explicit groupSeparator / decimalSeparator win over it.
   */
  locale?: string;
  /*
      An ISO 4217 code, e.g. 'USD'. Opt-in: with no currency there is no symbol.
      The symbol and which side it sits on come from Intl, so every code works
      and suffix currencies ("1 000 kr") are right without special-casing.

      The symbol is *not* put inside the input's value. It is returned from the
      hook for you to render beside the input, which keeps the caret arithmetic
      operating on digits alone. See the WithCurrency story.
   */
  currency?: string;
  /** Overrides the symbol Intl resolved. */
  symbol?: string;
  /** Overrides the side Intl resolved. */
  symbolPosition?: SymbolPosition;
  /*
      Which keyboard mobile raises. Defaults to 'text'.

      Mobile numeric keypads have no letter keys, so 'decimal' and 'numeric'
      make the h/k/m/b shortcuts physically unreachable on a phone — which
      leaves an ordinary formatted number input, and the shortcuts staying
      typeable on a phone is the point of this library.

      Set 'decimal' or 'numeric' if a numeric keypad matters more than typed
      shortcuts for your users; pair it with `applyShortcut` and a row of tap
      targets so the multipliers stay reachable.
   */
  inputMode?: 'decimal' | 'numeric' | 'text';
}

interface CommonInputOptions {
  onError?: () => void;
  options?: FinancialInputOptions;
}

/** The default. `onChange` hands back a number, or null while incomplete. */
export interface NumberValueOptions extends CommonInputOptions {
  valueType?: 'number';
  value?: Nullable<number>;
  onChange?: (value: Nullable<number>) => void;
}

/*
    For state that is already text: a form storing raw input, a backend that
    wants a string, or a form library whose fields are strings.

    `value` accepts either form — canonical "1234.56", display "1,234.56", or a
    shortcut token like "2.5m", since that is what a paste already goes through.
    `onChange` hands back **canonical**: no grouping, always a "." fraction,
    never locale punctuation, so it is safe to send onward. The formatted string
    on screen is `displayValue` from the hook.
 */
export interface StringValueOptions extends CommonInputOptions {
  valueType: 'string';
  value?: Nullable<string>;
  onChange?: (value: Nullable<string>) => void;
}

export type UseFinancialInputOptions = NumberValueOptions | StringValueOptions;

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
  valueType = 'number',
  options = {}
}: UseFinancialInputOptions = {}) => {
  /*
      The union is for callers; inside, both modes take the same path and only
      differ in what `emit` hands back. One cast here beats branching types
      through every call site.
   */
  const emitChange = onChange as
    ((next: Nullable<number | string>) => void) | undefined;

  const {
    scale = DEFAULT_SCALE,
    maxDigits = DEFAULT_MAX_DIGITS,
    inputMode = 'text',
    groupSeparator,
    decimalSeparator,
    shortcuts = DEFAULT_SHORTCUTS,
    range = 'ALL',
    flashOnError = true,
    locale,
    currency,
    symbol: symbolOverride,
    symbolPosition: positionOverride
  } = options;

  /*
      Intl is resolved once per locale/currency rather than per keystroke: it is
      comparatively expensive, and none of the typing paths need it.
   */
  const resolvedCurrency = useMemo(
    () => (currency ? resolveCurrency(currency, locale) : null),
    [currency, locale]
  );

  const localeSeparators = useMemo(
    () => (locale ? resolveSeparators(locale) : DEFAULT_SEPARATORS),
    [locale]
  );

  const exponents = useMemo(() => toExponents(shortcuts), [shortcuts]);

  /*
      Rebuilt only when the separators actually change, so the object identity
      stays stable and does not defeat the comparisons below.
   */
  const separators = useMemo(
    () => ({
      group: groupSeparator ?? localeSeparators.group,
      decimal: decimalSeparator ?? localeSeparators.decimal
    }),
    [groupSeparator, decimalSeparator, localeSeparators]
  );

  if (!areSeparatorsValid(separators)) {
    throw new Error(
      `react-financial-input: invalid separators { group: ${JSON.stringify(
        groupSeparator
      )}, decimal: ${JSON.stringify(decimalSeparator)} }. They must differ, ` +
        'and neither may be a digit or a minus sign.'
    );
  }

  /*
      A string `value` goes through the same sanitising a paste gets, so
      "1,234.56", "1234.56" and "2.5m" are all accepted. Everything downstream
      of here works on the number.
   */
  const toNumber = (
    raw: Nullable<number | string> | undefined
  ): Nullable<number> =>
    typeof raw === 'string'
      ? parseAmount(raw, separators, shortcuts)
      : (raw ?? null);

  /*
      Canonical, not display: no grouping and always a "." fraction. Taken from
      the display string rather than rebuilt from the number, so a value still
      being typed keeps its shape — "1.50" stays "1.50" instead of collapsing
      to "1.5", and "1." survives mid-edit.
   */
  const toCanonicalValue = (snapshot: FinancialInputState): Nullable<string> =>
    snapshot.displayValue === ''
      ? null
      : toCanonical(snapshot.displayValue, separators);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<FinancialInputState>(() =>
    createInitialState(toNumber(value), separators)
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

  /*
      Android soft keyboards emit insertCompositionText for every keystroke of a
      word still being composed. Reformatting mid-composition makes the IME
      fight the input, so the reducer holds the raw text until the composition
      ends. This ref is the only thing the reducer cannot work out for itself.
   */
  const isComposing = useRef(false);

  /*
      A refused keystroke is otherwise silent — the value simply does not
      change, which reads as a dead input. A brief flash says "that was
      refused" without the consumer having to wire up an error state.
   */
  const [isFlashing, setIsFlashing] = useState(false);
  /*
      The undefined is in the type parameter, not just the argument: @types/react
      18.0 has no useRef<T>(undefined) overload — React 19's types added it — and
      the package claims support from 18.0.0.
   */
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const flashRejection = () => {
    if (!flashOnError) {
      return;
    }

    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
    }

    // Off then on, so a second refusal restarts the animation.
    setIsFlashing(false);
    requestAnimationFrame(() => setIsFlashing(true));

    flashTimer.current = setTimeout(
      () => setIsFlashing(false),
      REJECTED_FLASH_MS
    );
  };

  /*
      String mode fires on a change of canonical rather than of the number,
      because the two differ: typing the trailing zero of "1.50" leaves the
      number at 1.5, and a string consumer still needs to be told.
   */
  const emit = (next: FinancialInputState) => {
    if (valueType === 'string') {
      const nextValue = toCanonicalValue(next);

      if (nextValue !== toCanonicalValue(state)) {
        emitChange?.(nextValue);
      }

      return;
    }

    if (next.numericValue !== state.numericValue) {
      emitChange?.(next.numericValue);
    }
  };

  const commit = (next: FinancialInputState) => {
    setState(next);

    if (next.rejected) {
      flashRejection();
      onError?.();
    } else {
      emit(next);
    }
  };

  const toAction = (
    target: HTMLInputElement,
    inputType: string,
    data = null
  ) => ({
    inputType,
    data,
    targetValue: target.value,
    selectionStart: target.selectionStart ?? target.value.length,
    scale,
    maxDigits,
    separators,
    exponents,
    range,
    isComposing: isComposing.current
  });

  const handleInput = (event: InputLikeEvent) => {
    const { inputType, data } = event.nativeEvent as globalThis.InputEvent;
    const target = event.currentTarget;

    commit(reduceInput(state, { ...toAction(target, inputType), data }));
  };

  /*
      Undo and redo are handled here rather than from the historyUndo input
      type: the browser stops emitting it once its own stack is exhausted,
      which happens as soon as React overwrites the value, so only the first
      Ctrl+Z would ever arrive.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    const key = event.key.toLowerCase();

    // Ctrl+Y is redo on Windows.
    const direction =
      key === 'y'
        ? 'redo'
        : key === 'z'
          ? event.shiftKey
            ? 'redo'
            : 'undo'
          : null;

    if (!direction) {
      return;
    }

    event.preventDefault();
    commit(reduceHistory(state, direction));
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (event: InputLikeEvent) => {
    isComposing.current = false;

    // The composed text is final now, so validate and format it for real.
    commit(
      reduceCompositionEnd(
        state,
        toAction(event.currentTarget, InputType.INSERT_COMPOSITION_TEXT)
      )
    );
  };

  /*
      Empties the value and returns focus, for a clear button. Undoable, since
      it goes through the history like any other edit.
   */
  const clear = () => {
    commit(reduceClear(state));
    inputRef.current?.focus();
  };

  /*
      Applies a multiplier as if it had been typed. The escape hatch for mobile
      keypads, which have no letter keys — wire it to a row of tap targets.
   */
  const applyShortcut = (character: string) => {
    const next = reduceShortcut(
      state,
      character,
      scale,
      maxDigits,
      separators,
      exponents,
      range
    );

    setState(next);
    inputRef.current?.focus();

    if (next.rejected) {
      onError?.();
    } else {
      emit(next);
    }
  };

  /*
      Controlled mode: follow the `value` prop when the parent changes it.

      Adjusted during render rather than in an effect. React documents this as
      the way to derive state from a changed prop — an effect would render once
      with a stale value, then again to correct it, and trips the
      react-hooks/set-state-in-effect rule.
      https://react.dev/reference/react/useState#storing-information-from-previous-renders

      Guarded on two things. The prop must actually have changed, so an
      unrelated re-render cannot clobber what is being typed. And it must differ
      from the committed value, because a parent echoing back the value this
      input just emitted is not an external change — reformatting on that would
      discard a trailing "." or the zero in "1.50" mid-edit.
   */
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);

    const incoming = toNumber(value);

    if (incoming !== state.numericValue) {
      setState(createInitialState(incoming, separators));
    }
  }

  /*
      Reformat when the separators change — a locale or currency switch, or
      explicit separator props. Without this the value keeps the old locale's
      punctuation until the next keystroke: picking sv-SE left "1,234" on
      screen instead of "1 234".

      Converted through canonical rather than rebuilt from numericValue, so a
      value still being typed keeps its shape: "1." becomes "1," rather than
      collapsing to "1".
   */
  const [lastSeparators, setLastSeparators] = useState(separators);

  if (separators !== lastSeparators) {
    setLastSeparators(separators);

    if (state.displayValue !== '') {
      const displayValue = formatCanonical(
        toCanonical(state.displayValue, lastSeparators),
        separators
      );

      setState({ ...state, displayValue, cursor: displayValue.length });
    }
  }

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
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
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
    className: [INPUT_CLASS_NAME, isFlashing && REJECTED_CLASS_NAME, className]
      .filter(Boolean)
      .join(' '),
    onInput: (event) => {
      handleInput(event);
      onInput?.(event);
    },
    onKeyDown: (event) => {
      handleKeyDown(event);
      onKeyDown?.(event);
    },
    onCompositionStart: (event) => {
      handleCompositionStart();
      onCompositionStart?.(event);
    },
    onCompositionEnd: (event) => {
      handleCompositionEnd(event);
      onCompositionEnd?.(event);
    }
  });

  return {
    inputRef,
    displayValue: state.displayValue,
    numericValue: state.numericValue,
    /** No grouping, always a "." fraction — the form to send onward. */
    canonicalValue: toCanonicalValue(state),
    getInputProps,
    applyShortcut,
    clear,
    separators,
    /** Resolved from `currency` unless overridden. Empty when not opted in. */
    symbol: symbolOverride ?? resolvedCurrency?.symbol ?? '',
    symbolPosition: positionOverride ?? resolvedCurrency?.position ?? 'prefix'
  };
};
