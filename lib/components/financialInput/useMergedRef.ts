import { Ref, RefObject, useRef } from 'react';
import { mergeRefs } from '../../utils';

/*
    Merges the caller's ref with the internal one, cached on the caller's ref
    identity.

    The caching is the whole point, and it is load-bearing. Building the merged
    ref inline would hand React a new callback ref on every render, and React
    detaches and re-attaches a ref whose identity changed — so a consumer's
    callback ref would fire on every render. If that callback sets state, the
    result is an infinite render loop, which is exactly what happened once and
    is why `FinancialInput.test.tsx` counts ref invocations.
 */
export const useMergedRef = (internal: RefObject<HTMLInputElement | null>) => {
  const cache = useRef<{
    external: Ref<HTMLInputElement> | undefined;
    merged: (node: HTMLInputElement | null) => void;
  } | null>(null);

  return (external?: Ref<HTMLInputElement>) => {
    if (!cache.current || cache.current.external !== external) {
      cache.current = { external, merged: mergeRefs(internal, external) };
    }

    return cache.current.merged;
  };
};
