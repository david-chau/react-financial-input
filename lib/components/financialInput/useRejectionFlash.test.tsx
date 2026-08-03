import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { REJECTED_FLASH_MS, useRejectionFlash } from './useRejectionFlash';

/*
    The flash is what makes a refused keystroke visible — without it the value
    simply does not change, which reads as a dead input. It was only ever
    exercised incidentally through the component, so the disabled path and the
    timer expiry had never run.
 */
const Harness = ({ enabled }: { enabled: boolean }) => {
  const { isFlashing, flash } = useRejectionFlash(enabled);

  return (
    <button type="button" onClick={flash} data-flashing={isFlashing}>
      flash
    </button>
  );
};

/*
    The hook turns the flag off and straight back on inside
    requestAnimationFrame, so a second refusal restarts the animation rather
    than riding out the first.

    Order matters here: useFakeTimers installs its own rAF, so the stub has to
    come after it or it is immediately replaced. That is what made the first
    version of this test fail while the behaviour was correct.
 */
const withFakeTimers = () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);

    return 0;
  });
};

describe('useRejectionFlash', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = (enabled: boolean) => {
    render(<Harness enabled={enabled} />);

    return screen.getByRole('button');
  };

  it('does nothing at all when disabled', () => {
    const button = setup(false);

    act(() => button.click());

    expect(button.dataset.flashing).toBe('false');
  });

  it('flashes, then stops on its own', async () => {
    withFakeTimers();
    const button = setup(true);

    act(() => button.click());
    expect(button.dataset.flashing).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REJECTED_FLASH_MS + 10);
    });

    expect(button.dataset.flashing).toBe('false');
  });

  it('restarts rather than riding out the first flash', async () => {
    withFakeTimers();
    const button = setup(true);

    act(() => button.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REJECTED_FLASH_MS - 50);
    });

    act(() => button.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    // The first timer would have ended it by now; the second kept it alive.
    expect(button.dataset.flashing).toBe('true');
  });

  // The timer must not outlive the component that owns it.
  it('clears its timer on unmount', () => {
    withFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(<Harness enabled />);

    act(() => screen.getByRole('button').click());
    unmount();

    expect(clear).toHaveBeenCalled();
  });
});

/*
    Both scheduled callbacks are cancelled on unmount, not just the timer.

    Found by auditing for leaks rather than by a failure: the frame fired after
    the component was gone and set state on it. React makes that a silent
    no-op, so nothing had ever complained.
 */
describe('teardown cancels everything it scheduled', () => {
  it('cancels the pending frame on unmount', () => {
    const pending: FrameRequestCallback[] = [];
    let cancelled = 0;

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending.push(callback);

      return pending.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      cancelled += 1;
    });

    const { unmount } = render(<Harness enabled />);

    act(() => screen.getByRole('button').click());
    expect(pending).toHaveLength(1);

    unmount();

    expect(cancelled).toBeGreaterThan(0);
  });

  it('cancels the previous frame when a second refusal arrives', () => {
    let cancelled = 0;

    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {
      cancelled += 1;
    });

    render(<Harness enabled />);
    const button = screen.getByRole('button');

    act(() => button.click());
    act(() => button.click());

    // The first frame is dropped rather than left to fire alongside the second.
    expect(cancelled).toBeGreaterThan(0);
  });
});
