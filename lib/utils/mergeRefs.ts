import { MutableRefObject, Ref } from 'react';

/*
    Combines the hook's internal ref with a ref forwarded by the consumer, so
    both point at the same input. React 19 accepts `ref` as a plain prop, but
    React 18 is still supported, so the component keeps using forwardRef.
 */
export const mergeRefs =
  <T>(...refs: (Ref<T> | undefined)[]) =>
  (node: T | null): void => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<T | null>).current = node;
      }
    });
  };
