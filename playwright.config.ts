import { defineConfig, devices } from '@playwright/test';

/*
    Overridable, because reuseExistingServer will otherwise happily attach to a
    Storybook dev server you already have open on 6006 and test that instead of
    the build under test.
 */
const PORT = Number(process.env.RFI_PORT ?? 6006);
const baseURL = `http://127.0.0.1:${PORT}`;

/*
    Layer 2 and 3 of the cross-platform strategy in the README.

    The OS is whatever runner this executes on — that is the point. Real Windows
    key handling comes from running this on windows-latest, not from a device
    descriptor. The `mobile-*` projects only emulate viewport, touch and user
    agent: they do NOT emulate a soft keyboard or an IME, so they prove layout
    and tap behaviour and nothing more.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },

  /*
      Recordings serve the built Storybook instead of the dev server: it loads
      in about a tenth of the time and, more importantly, consistently — the GIF
      conversion trims a fixed number of leading seconds, so a variable compile
      would leave a loading spinner in frame one.
   */
  webServer: {
    command: process.env.RFI_STATIC_STORYBOOK
      ? // --host is required: vite preview otherwise binds ::1 only, and
        // Playwright polls 127.0.0.1.
        `npx vite preview --outDir storybook-static --host 127.0.0.1 --port ${PORT} --strictPort`
      : `npm run storybook -- --ci --quiet --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },

  projects: [
    {
      name: 'chromium',
      testMatch: /typing\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testMatch: /typing\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      testMatch: /typing\.spec\.ts/,
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      testMatch: /typing\.spec\.ts/,
      use: { ...devices['Pixel 7'] }
    },
    {
      name: 'mobile-safari',
      testMatch: /typing\.spec\.ts/,
      use: { ...devices['iPhone 15'] }
    },
    {
      // Layer 3. CDP is Chromium-only, so this project is too.
      name: 'chromium-ime',
      testMatch: /composition\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'demo-recording',
      testMatch: /demo\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        /*
            Video size must equal the viewport, or Playwright letterboxes the
            page into the frame. Captured larger than the final GIF so that
            ffmpeg downscales — which is sharper than upscaling.
         */
        viewport: { width: 660, height: 220 },
        video: { mode: 'on', size: { width: 660, height: 220 } }
      }
    }
  ]
});
