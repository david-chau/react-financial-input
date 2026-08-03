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

/*
    How many characters two strings share from the start. For a delete, that is
    exactly where the deletion happened — which is more trustworthy than the
    caret the platform reports: Android sends selectionStart 0 for a backspace
    at the end of the value, and honouring it threw the caret to the front.
 */
export const commonPrefixLength = (before: string, after: string): number => {
  const limit = Math.min(before.length, after.length);
  let index = 0;

  while (index < limit && before[index] === after[index]) {
    index += 1;
  }

  return index;
};

/*
    The mirror of commonPrefixLength, from the end. Together they bracket the
    part of a string that actually changed, which is how an edit can be located
    without trusting the caret the platform reports.

    Bounded by what the prefix already claimed, so "aa" -> "aaa" cannot count
    the same character twice and report a longer overlap than either string.
 */
export const commonSuffixLength = (
  before: string,
  after: string,
  from = 0
): number => {
  const limit = Math.min(before.length - from, after.length - from);
  let index = 0;

  while (
    index < limit &&
    before[before.length - 1 - index] === after[after.length - 1 - index]
  ) {
    index += 1;
  }

  return index;
};
