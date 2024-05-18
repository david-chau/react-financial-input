/*
    This enum is a supported subset of input types for Financial Input
    See https://w3c.github.io/input-events/#interface-InputEvent-Attributes for more details
 */
export enum InputType {
    INSERT_TEXT = 'insertText',
    INSERT_FROM_PASTE = 'insertFromPaste',
    DELETE_BY_CUT = 'deleteByCut',
    DELETE_CONTENT_BACKWARD = 'deleteContentBackward',
    DELETE_CONTENT_FORWARD = 'deleteContentForward',
}