/*
    Converts csv string number to string number.
    Example: "123,456,789" to "123456789"
 */

import BigNumber from 'bignumber.js';

export const csvToStringNumber = (csv: string): string => csv.replace(/,/g, '');

/*
    Converts csv string number to number.
    Example: "123,456,789" to 123456789
 */
export const csvToNumber = (csv: string): number =>
  Number(csvToStringNumber(csv));

/*
    Reformat csv string number to proper csv string number format.
    Example: "12,34,56789" to "123,456,789"
 */

export const reformatCsv = (csv: string) =>
  stringNumberToCsv(csvToStringNumber(csv));

/*
    Converts string number to csv string number
    Example: "123456789.12" to "123,456,789.12"
 */
export const stringNumberToCsv = (stringNumber: string): string => {
  if (stringNumber === '') {
    return stringNumber;
  }

  const [integer, fraction] = stringNumber.split(',');
  const hasDecimal: boolean = stringNumber.includes(',');

  let csv = addCommaSeparators(integer);

  if (hasDecimal) {
    csv += '.';
  }

  if (fraction !== undefined) {
    csv += fraction;
  }

  return csv;
};

/*
    Add comma separators to string numbers
    Example(s): "123456789" to "123,456,789"
 */
export const addCommaSeparators = (value: string): string =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const hasMultipleDecimals = (value: string): boolean =>
  value.split('.').length > 2;

export const containsDecimals = (value: string): boolean => /[.]/.test(value);

export const hasLeadingZero = (value: string): boolean =>
  /^0[0-9]+/.test(value);

export const containsOnlyNumberRelatedCharacters = (value: string): boolean =>
  /^[0-9.,hkbm-]+$/i.test(value);

/*
    Converts number (or BigNumber) to csv number
 */

export const numberToCsv = (value: number | BigNumber): string =>
  stringNumberToCsv(String(value));

export const getCommaDifference = (csvA: string, csvB: string): number =>
  csvB.split(',').length - 1 - (csvA.split(',').length - 1);
