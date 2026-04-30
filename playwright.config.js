// @ts-check
const { defineConfig } = require('@playwright/test');

// REBUILD29 §21 — PLAYWRIGHT_BASE_URL 환경변수로 production 테스트 지원
// 예: PLAYWRIGHT_BASE_URL=https://aitutor-58235609672.us-east4.run.app npx playwright test
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
const IS_REMOTE = !!process.env.PLAYWRIGHT_BASE_URL;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  // 환경변수로 remote URL 지정 시 webServer 미동작
  ...(IS_REMOTE ? {} : {
    webServer: {
      command: 'npm run dev',
      port: 5174,
      timeout: 30000,
      reuseExistingServer: true,
    },
  }),
});
