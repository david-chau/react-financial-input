export const containsLetters = (value: string): boolean =>
  /[a-zA-Z]/.test(value);

/*
    Returns true/false if value ends in decimal
    Example(s): "abc123." returns true, "abc12.34" returns false
 */
export const endsInDecimal = (value: string): boolean => /[.]$/.test(value);

export const hasCommasOrSpaces = (value: string): boolean => /[ ,]/.test(value);
