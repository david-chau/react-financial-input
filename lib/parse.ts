/*
    Parsing and formatting, as its own entry point — and the only one with no
    'use client' on it.

    That directive is what makes this a separate file rather than a corner of
    the root. A module marked 'use client' turns every export into a client
    reference in the Next.js App Router, so `parseAmount` imported from the
    root could not run in a server action, however pure it is. The docs said
    it ran "server-side quite happily"; in the App Router it did not.

    Nothing here imports React, touches the DOM, or holds state. It is the same
    rules the input applies to a paste, callable anywhere.
 */
export {
  parseAmount,
  DEFAULT_SHORTCUTS
} from './components/financialInput/financialInputUtils';

export {
  formatNumber,
  shiftDecimal,
  toCanonical,
  formatCanonical
} from './utils/number';

export type { Separators } from './utils/number';
