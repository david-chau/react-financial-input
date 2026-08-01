export const containsLetters = (value: string): boolean =>
  /[a-zA-Z]/.test(value);

/*
    Returns true if the value ends in a decimal point.
    Example(s): "123." returns true, "12.34" returns false
 */
export const endsInDecimal = (value: string): boolean => /[.]$/.test(value);

/*
    Grouping separators and spaces are never something the user types directly —
    they are only ever inserted by the formatter.
 */
export const hasSeparatorOrSpace = (value: string): boolean =>
  /[ ,]/.test(value);
