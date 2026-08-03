/*
    Reading input events, as its own entry point.

    Nothing here knows about currency, money or React — it is the part of this
    library that is about browsers, and it is useful on any text field. Kept
    separate so that using it does not pull in a currency input, and so that
    using the input does not pull in this.
 */
export {
  classifyInputType,
  describeEdit,
  isDeleteInputType
} from './utils/inputEvents';

export type { Edit, EditKind } from './utils/inputEvents';

export { InputType } from './enums/InputType';
