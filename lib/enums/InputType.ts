/*
    The subset of input types FinancialInput handles.
    See https://w3c.github.io/input-events/#interface-InputEvent-Attributes
 */
export enum InputType {
  INSERT_TEXT = 'insertText',
  INSERT_FROM_PASTE = 'insertFromPaste',
  INSERT_FROM_DROP = 'insertFromDrop',
  /** iOS autocorrect and the QuickType bar replace a whole run of text. */
  INSERT_REPLACEMENT_TEXT = 'insertReplacementText',
  /** Android soft keyboards, while a word is still being composed. */
  INSERT_COMPOSITION_TEXT = 'insertCompositionText',
  DELETE_BY_CUT = 'deleteByCut',
  DELETE_BY_DRAG = 'deleteByDrag',
  DELETE_CONTENT_BACKWARD = 'deleteContentBackward',
  DELETE_CONTENT_FORWARD = 'deleteContentForward',
  DELETE_WORD_BACKWARD = 'deleteWordBackward',
  DELETE_WORD_FORWARD = 'deleteWordForward',
  DELETE_SOFT_LINE_BACKWARD = 'deleteSoftLineBackward',
  DELETE_SOFT_LINE_FORWARD = 'deleteSoftLineForward',
  DELETE_ENTIRE_SOFT_LINE = 'deleteEntireSoftLine',
  HISTORY_UNDO = 'historyUndo',
  HISTORY_REDO = 'historyRedo'
}
