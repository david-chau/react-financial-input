import { useEffect, useRef, useState } from 'react';

/** Must outlast the longest animation in styles.css. */
export const REJECTED_FLASH_MS = 450;

/*
    A refused keystroke is otherwise completely silent — the value simply does
    not change, which reads as a dead input. This holds a flag for long enough
    to run the animation, so the refusal is visible without the consumer having
    to wire up an error state.

    Lifted out of useFinancialInput, which had grown to 439 lines in a single
    function. This part has nothing to do with formatting and its own timer to
    clean up, so it is easier to be sure of on its own.
 */
export const useRejectionFlash = (enabled: boolean) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /*
      The frame is cancelled as carefully as the timer.

      Not a leak — the callback holds its closure for a single frame, and React
      18 makes a setState on an unmounted component a silent no-op, so nothing
      warns and nothing breaks. But an audit for leaks found it firing after
      unmount, and leaving one of two scheduled callbacks uncancelled is the
      kind of asymmetry that becomes a real leak the moment someone moves it to
      a longer queue.
   */
  const frame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    []
  );

  const flash = () => {
    if (!enabled) {
      return;
    }

    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
    }

    // Off then on, so a second refusal restarts the animation rather than
    // riding out the first one.
    setIsFlashing(false);
    frame.current = requestAnimationFrame(() => setIsFlashing(true));

    timer.current = setTimeout(() => setIsFlashing(false), REJECTED_FLASH_MS);
  };

  return { isFlashing, flash };
};
