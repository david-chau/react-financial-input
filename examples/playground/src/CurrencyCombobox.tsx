import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CurrencyOption,
  CurrencyPreset,
  searchCurrencies,
  toFlagEmoji
} from 'react-financial-input';

/*
    Copied verbatim from the library's own story, save for the import above.

    That is the intended way to use it: the combobox is deliberately NOT
    exported, because a picker is a design decision and FinancialInput stays a
    bare <input> that renders none. `searchCurrencies` and `toFlagEmoji` are
    the public parts, and this file is the markup around them — yours to change.

    A native <select> stops being usable somewhere past a couple of dozen
    options, and `all` is 162. This is the WAI-ARIA combobox pattern: a text
    input that filters, a listbox, and arrow keys to move through it.
 */

export interface CurrencyComboboxProps {
  value: string;
  onChange: (code: string) => void;
  locale?: string;
  /** 'g7', 'g10', 'all', or your own array. Defaults to g10. */
  codes?: readonly string[] | CurrencyPreset;
  label?: string;
}

export const CurrencyCombobox = ({
  value,
  onChange,
  locale,
  codes,
  label = 'Currency'
}: CurrencyComboboxProps) => {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchCurrencies(query, { locale, codes }),
    [query, locale, codes]
  );

  // Close on a click elsewhere, the way a native select would.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);

    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const choose = (option: CurrencyOption) => {
    onChange(option.code);
    setQuery('');
    setIsOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActive((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;

        // Wrap, so holding an arrow key cannot dead-end.
        return (next + results.length) % Math.max(results.length, 1);
      });

      return;
    }

    if (event.key === 'Enter' && isOpen && results[active]) {
      event.preventDefault();
      choose(results[active]);

      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="rfi-combobox" ref={root}>
      <input
        className="rfi-combobox__input"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={label}
        value={isOpen ? query : `${toFlagEmoji(value) ?? ''} ${value}`.trim()}
        placeholder="Search"
        onFocus={() => {
          setIsOpen(true);
          setActive(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />

      {isOpen && (
        <ul className="rfi-combobox__list" id={listId} role="listbox">
          {results.length === 0 && (
            <li className="rfi-combobox__empty">No match</li>
          )}

          {results.map((option, index) => (
            <li key={option.code}>
              <button
                type="button"
                role="option"
                aria-selected={option.code === value}
                className={`rfi-combobox__option${
                  index === active ? ' rfi-combobox__option--active' : ''
                }`}
                // Pointer down, not click: the input's blur would close the
                // list before a click ever landed.
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onPointerEnter={() => setActive(index)}
              >
                <span aria-hidden>{toFlagEmoji(option.code) ?? '  '}</span>
                <strong>{option.code}</strong>
                <small>{option.name}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
