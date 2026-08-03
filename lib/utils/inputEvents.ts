import { InputType } from '../enums';
import { commonPrefixLength, commonSuffixLength } from './string';

/*
    Nothing in here knows about currency, formatting or React. It is the part
    of this library that is really about *browsers* rather than about money:
    working out what a user did to a text field, across desktop, iOS and
    Android, where the same gesture arrives under different names or under no
    name at all.

    FinancialInput is built on it, which is the only reason to trust it — every
    quirk recorded here was found by a real device failing.
 */

/** What the user did, independent of which event reported it. */
export type EditKind =
  /** One character arrived. A keystroke. */
  | 'insert'
  /** More than one arrived at once: a paste, a drop, autocorrect, a clipboard chip. */
  | 'insertBulk'
  /** Characters were removed and none added. */
  | 'delete'
  /** Characters were removed and others put in their place. */
  | 'replace'
  /** An IME is mid-word. The text is not final and may still change. */
  | 'compose'
  /** The browser's own undo or redo stack. */
  | 'history'
  /** Nothing changed. */
  | 'none'
  /** An inputType outside the set below, with no diff to fall back on. */
  | 'unknown';

/*
    Which inputTypes mean what.

    `insertText` is deliberately absent: it is the one that cannot be decided
    from its name. A keystroke sends it with one character, and so does the
    clipboard chip above an Android keyboard with an entire string — so the
    length of the text decides, not the type. That distinction is the whole
    reason this table is not just a lookup.
 */
const KIND_BY_INPUT_TYPE: Record<string, EditKind> = {
  [InputType.INSERT_FROM_PASTE]: 'insertBulk',
  [InputType.INSERT_FROM_DROP]: 'insertBulk',
  [InputType.INSERT_REPLACEMENT_TEXT]: 'insertBulk',
  [InputType.INSERT_COMPOSITION_TEXT]: 'compose',
  [InputType.DELETE_BY_CUT]: 'delete',
  [InputType.DELETE_BY_DRAG]: 'delete',
  [InputType.DELETE_CONTENT_BACKWARD]: 'delete',
  [InputType.DELETE_CONTENT_FORWARD]: 'delete',
  [InputType.DELETE_WORD_BACKWARD]: 'delete',
  [InputType.DELETE_WORD_FORWARD]: 'delete',
  [InputType.DELETE_SOFT_LINE_BACKWARD]: 'delete',
  [InputType.DELETE_SOFT_LINE_FORWARD]: 'delete',
  [InputType.DELETE_ENTIRE_SOFT_LINE]: 'delete',
  [InputType.HISTORY_UNDO]: 'history',
  [InputType.HISTORY_REDO]: 'history'
};

/*
    The kind an inputType implies on its own, or null when the name is not
    enough. `insertText` returns null: only the length of what arrived can say
    whether it was a keystroke or a paste wearing a keystroke's name.
 */
export const classifyInputType = (
  inputType: string | null | undefined
): EditKind | null =>
  inputType ? (KIND_BY_INPUT_TYPE[inputType] ?? null) : null;

/** Any of the delete inputTypes, whatever gesture produced it. */
export const isDeleteInputType = (inputType: string): boolean =>
  classifyInputType(inputType) === 'delete';

export interface Edit {
  kind: EditKind;
  /** The reported inputType, when there was an event to read it from. */
  inputType: string | null;
  /*
      Where the change starts, measured from the two strings rather than taken
      from selectionStart.

      Android reports selectionStart 0 for a backspace at the end of the value,
      and honouring it threw the caret to the front of the field on every
      delete. The strings cannot lie in the same way.
   */
  at: number;
  /** What was put in. Empty for a pure delete. */
  text: string;
  /** What was taken out. Empty for a pure insert. */
  removed: string;
  /** More than one character arrived at once, so it was not typed. */
  isBulk: boolean;
}

/*
    What changed between two values, and what kind of edit it was.

    Pass the InputEvent when you have one — inside an `input` or `beforeinput`
    handler — and the reported inputType is used where it is decisive.

    Omit it and everything is derived from the strings alone, which is the
    case if all you have is React's onChange. That is enough to know what was
    inserted or removed and where, and it is what most desktop code needs.

    What a diff cannot recover:

    - a paste of "12345" is indistinguishable from five fast keystrokes, so a
      bulk insert is inferred from length and may be wrong about provenance
    - composition is invisible; `compose` is only ever reported from an event
    - undo cannot be told from retyping

    Nothing here validates. It reports what happened; deciding whether to allow
    it is the caller's business.
 */
export const describeEdit = (
  before: string,
  after: string,
  event?: { inputType?: string | null; data?: string | null } | null
): Edit => {
  const inputType = event?.inputType ?? null;

  const at = commonPrefixLength(before, after);
  const suffix = commonSuffixLength(before, after, at);

  const removed = before.slice(at, before.length - suffix);
  const text = after.slice(at, after.length - suffix);

  /*
      The event's data beats the diff for a bulk insert. Replacing a selection
      leaves a diff that has both halves, but the keyboard already told us
      exactly what it put in.
   */
  const inserted = inputType && event?.data ? event.data : text;
  const isBulk = inserted.length > 1;

  const declared = classifyInputType(inputType);

  const derived: EditKind =
    text && removed
      ? 'replace'
      : text
        ? isBulk
          ? 'insertBulk'
          : 'insert'
        : removed
          ? 'delete'
          : 'none';

  /*
      insertText is the exception the table cannot cover, so its kind comes
      from the length instead: one character is a keystroke, more arrived in
      bulk. That is what makes an Android clipboard chip readable — it reports
      insertText and hands over an entire string.
   */
  const kind: EditKind =
    inputType === InputType.INSERT_TEXT
      ? isBulk
        ? 'insertBulk'
        : 'insert'
      : (declared ?? (inputType ? 'unknown' : derived));

  return { kind, inputType, at, text, removed, isBulk };
};
