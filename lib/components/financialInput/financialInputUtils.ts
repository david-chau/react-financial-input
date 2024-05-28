import { Nullable, NullableOrUndefinable, StringKeyedMap } from 'lib/types';
import {
  containsDecimals,
  containsOnlyNumberRelatedCharacters,
  csvToNumber,
  csvToStringNumber,
  hasLeadingZero,
  hasMultipleDecimals
} from 'lib/utils';
import BigNumber from 'bignumber.js';
import {
  containsLetters,
  endsInDecimal,
  hasCommasOrSpaces
} from 'lib/utils/string.ts';
import { Shortcut } from 'lib/enums/Shortcut.ts';

export const DEFAULT_MAX_DECIMAL_PLACES: number = 2;
export const DEFAULT_MAX_DIGITS: number = 11;

export const SHORTCUT_TO_MULTIPLIER: StringKeyedMap<number> = {
  [Shortcut.HUNDRED]: 100,
  [Shortcut.THOUSAND]: 1000,
  [Shortcut.MILLION]: 1000000,
  [Shortcut.BILLION]: 1000000000
};

export const areDecimalsAllowed = (scale: number): boolean => scale > 0;
export const isOnlyDecimalPoint = (value: string): boolean => value === '.';

export const isNumericValueEqualToCsv = (
  numericValue: NullableOrUndefinable<number>,
  csv: string
): boolean => {
  const sanitizedTargetValue = endsInDecimal(csv) ? csv.replace('.', '') : csv;
  return csvToNumber(sanitizedTargetValue) === numericValue;
};

export interface HandleInsertShortcutsResult {
  numericValueToSet: Nullable<number | BigNumber>;
  isError: boolean;
  hasValidShortcut: boolean;
}

export const isValidInputShortcut = (shortcut: Nullable<string>): boolean =>
  shortcut !== null && !!SHORTCUT_TO_MULTIPLIER[shortcut.toLowerCase()];

export const computeShortcut = (
  baseValue: number | BigNumber,
  shortcut: Nullable<string>
): number | BigNumber => {
  if (isValidInputShortcut(shortcut)) {
    return multipleShortcut(baseValue, shortcut);
  } else {
    return baseValue;
  }
};

export const multipleShortcut = (
  baseValue: number | BigNumber,
  shortcut: Nullable<string>
): number | BigNumber => {
  if (isValidInputShortcut(shortcut)) {
    const multiplier =
      shortcut !== null && SHORTCUT_TO_MULTIPLIER[shortcut.toLowerCase()];

    if (multiplier) {
      if (baseValue === 0) {
        return multiplier;
      } else {
        const baseValueNumber: BigNumber = new BigNumber(baseValue);
        return baseValueNumber.multipliedBy(multiplier).toNumber();
      }
    }
  }
  return baseValue;
};

export const handleInsertShortcuts = (
  insertValue: string,
  data: Nullable<string>
): HandleInsertShortcutsResult => {
  let numericValueToSet: Nullable<number | BigNumber> = null;
  let isError: boolean = false;
  let hasValidShortcut: boolean = false;

  if (data !== null && containsLetters(insertValue)) {
    if (isValidInputShortcut(data)) {
      // Remove shortcut from string
      const baseValue = insertValue.replace(data, '');
      numericValueToSet = computeShortcut(csvToNumber(baseValue), data);
      hasValidShortcut = true;
    } else {
      isError = true;
    }
  } else if (!isOnlyDecimalPoint(insertValue)) {
    numericValueToSet = csvToNumber(insertValue);
  }

  return {
    numericValueToSet,
    isError,
    hasValidShortcut
  };
};

export const isStringNumberAboveMaxDecimalPlaces = (
  stringNumber: string,
  maxDecimalPlaces: number
) => stringNumber.length > maxDecimalPlaces;

export const isIntegerAboveMaxLength = (
  integer: string,
  maxDigits?: number
): boolean => (maxDigits === undefined ? false : integer.length > maxDigits);

export const isValidFinancialInputInsert = (
  targetValue: string,
  data: string,
  maxDigits: number,
  scale: number
): boolean => {
  const _areDecimalsAllowed: boolean = areDecimalsAllowed(scale);

  if (isOnlyDecimalPoint(targetValue)) {
    return _areDecimalsAllowed;
  }

  if (
    hasMultipleDecimals(targetValue) ||
    (!_areDecimalsAllowed && containsDecimals(targetValue))
  ) {
    return false;
  }

  const targetValueWithoutCommas = csvToStringNumber(targetValue);

  const [integer, fraction = ''] = targetValueWithoutCommas.split(',');

  return (
    !hasLeadingZero(targetValue) &&
    !hasCommasOrSpaces(data) &&
    !isStringNumberAboveMaxDecimalPlaces(fraction, scale) &&
    !isIntegerAboveMaxLength(integer, maxDigits)
  );
};

export const isValidNumericFinancialInput = (
  value: Nullable<number | BigNumber>,
  maxDigits: number,
  scale: number
): boolean => {
  if (value === null) {
    return false;
  }

  const stringValue = String(value);
  const [integer, fraction = ''] = stringValue.split('.');
  const absInteger = integer.replace('-', '');

  return (
    containsOnlyNumberRelatedCharacters(stringValue) &&
    !isIntegerAboveMaxLength(absInteger, maxDigits) &&
    !isStringNumberAboveMaxDecimalPlaces(fraction, scale)
  );
};
