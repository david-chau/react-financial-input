/*
    Named CursorSelection rather than Selection so it does not shadow the DOM's
    global Selection type.
 */
export interface CursorSelection {
  start: number;
  end: number;
}
