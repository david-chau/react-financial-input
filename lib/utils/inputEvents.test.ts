import { describe, expect, it } from 'vitest';
import { InputType } from '../enums';
import {
  classifyInputType,
  describeEdit,
  isDeleteInputType
} from './inputEvents';

describe('classifyInputType', () => {
  it.each([
    // inputType                              kind          note
    [InputType.INSERT_FROM_PASTE, 'insertBulk', 'a paste is always bulk'],
    [InputType.INSERT_FROM_DROP, 'insertBulk', 'so is a drop'],
    [
      InputType.INSERT_REPLACEMENT_TEXT,
      'insertBulk',
      'iOS autocorrect replaces a run'
    ],
    [InputType.INSERT_COMPOSITION_TEXT, 'compose', 'an IME mid-word'],
    [InputType.DELETE_CONTENT_BACKWARD, 'delete', 'backspace'],
    [InputType.DELETE_ENTIRE_SOFT_LINE, 'delete', 'and every other delete'],
    [InputType.HISTORY_UNDO, 'history', 'the browser stack'],
    [
      InputType.INSERT_TEXT,
      null,
      'undecidable by name: a keystroke and a clipboard chip both send it'
    ],
    ['formatBold', null, 'outside the set'],
    [null, null, 'nothing reported at all']
  ])('%s -> %s (%s)', (inputType, expected, _note) => {
    expect(classifyInputType(inputType)).toBe(expected);
  });

  it.each([
    [InputType.DELETE_BY_CUT, true],
    [InputType.DELETE_WORD_FORWARD, true],
    [InputType.INSERT_TEXT, false],
    [InputType.HISTORY_REDO, false]
  ])('isDeleteInputType(%s) -> %s', (inputType, expected) => {
    expect(isDeleteInputType(inputType)).toBe(expected);
  });
});

/*
    The onChange bridge: no event, only the two strings. This is what desktop
    code has when it wires onChange and nothing else.
 */
describe('describeEdit from strings alone', () => {
  it.each([
    // before      after         kind          at  text     removed  note
    ['', '1', 'insert', 0, '1', '', 'first character'],
    ['12', '123', 'insert', 2, '3', '', 'appended'],
    ['13', '123', 'insert', 1, '2', '', 'inserted in the middle'],
    ['12', '12345', 'insertBulk', 2, '345', '', 'more than one at once'],
    ['1,000', '1,00', 'delete', 4, '', '0', 'backspace at the end'],
    ['1,000', '000', 'delete', 0, '', '1,', 'deleted from the front'],
    ['1234', '1x4', 'replace', 1, 'x', '23', 'a selection overtyped'],
    ['12', '12', 'none', 2, '', '', 'nothing changed'],
    ['12', '', 'delete', 0, '', '12', 'cleared'],
    ['aa', 'aaa', 'insert', 2, 'a', '', 'a repeat cannot double-count']
  ])(
    '%j -> %j is %s at %i',
    (before, after, kind, at, text, removed, _note) => {
      const edit = describeEdit(before as string, after as string);

      expect(edit.kind).toBe(kind);
      expect(edit.at).toBe(at);
      expect(edit.text).toBe(text);
      expect(edit.removed).toBe(removed);
      expect(edit.inputType).toBe(null);
    }
  );
});

describe('describeEdit with an event', () => {
  it.each([
    // before  after      inputType                          data      kind          note
    [
      '',
      '1',
      InputType.INSERT_TEXT,
      '1',
      'insert',
      'one character is a keystroke'
    ],
    [
      '',
      '$1,234.56 USD',
      InputType.INSERT_TEXT,
      '$1,234.56 USD',
      'insertBulk',
      'the Android clipboard chip: insertText carrying a whole string'
    ],
    [
      '',
      '1234',
      InputType.INSERT_FROM_PASTE,
      null,
      'insertBulk',
      'a real paste, where data is null'
    ],
    [
      '1,234',
      '',
      InputType.DELETE_BY_CUT,
      null,
      'delete',
      'cut reports its own type'
    ],
    [
      '',
      'ni',
      InputType.INSERT_COMPOSITION_TEXT,
      'ni',
      'compose',
      'an IME, which a diff alone could never reveal'
    ],
    [
      '1,234',
      '1,234',
      InputType.HISTORY_UNDO,
      null,
      'history',
      'undo, even with no visible change yet'
    ],
    [
      '1',
      '1',
      'formatBold',
      null,
      'unknown',
      'a type outside the set is not guessed at'
    ]
  ])('%j -> %j via %s is %s', (before, after, inputType, data, kind, _note) => {
    const edit = describeEdit(before as string, after as string, {
      inputType: inputType as string,
      data: data as string | null
    });

    expect(edit.kind).toBe(kind);
    expect(edit.inputType).toBe(inputType);
  });

  /*
      The recorded Android trace. A diff of these strings alone would read as a
      bulk insert; the point is that the event agrees, and says why.
   */
  it('reads the clipboard chip the same way the reducer does', () => {
    const edit = describeEdit('', '(1,234.00)', {
      inputType: InputType.INSERT_TEXT,
      data: '(1,234.00)'
    });

    expect(edit).toEqual({
      kind: 'insertBulk',
      inputType: 'insertText',
      at: 0,
      text: '(1,234.00)',
      removed: '',
      isBulk: true
    });
  });

  // Replacing a selection: the diff has both halves, and data has the truth.
  it('prefers the event data over the diff for a replacement', () => {
    const edit = describeEdit('1234', '19', {
      inputType: InputType.INSERT_TEXT,
      data: '9'
    });

    expect(edit.kind).toBe('insert');
    expect(edit.removed).toBe('234');
    expect(edit.at).toBe(1);
  });
});
