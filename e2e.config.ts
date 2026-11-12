import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

// e2e (https://github.com/e2e-inc/e2e) as an external runner.
// No `agents` block: tests use locators and assertions only, so no model is called and no API key is needed.
// Run with E2E_TELEMETRY_DISABLED=1. Build first: `npm run build`.
const PORT = Number(process.env.E2E_PORT || 4180);

export default {
  tests: ['tests/e2e/**/*.e2e.ts'],
  retries: 0,
  trace: 'on',
  reporters: ['list', 'junit'],
  targets: [{
    engine: web({ viewport: { width: 375, height: 812 } }),
    app: {
      url: `http://127.0.0.1:${PORT}`,
      command: {
        executable: 'node',
        args: ['tests/e2e/serve.mjs'],
        reuseExisting: false,
        log: '.e2e/logs/app.log',
      },
    },
  }],
} satisfies E2EConfig;
