import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // The API lifecycle tests run real AES-GCM and SHA-256 work end to end; on a busy CI runner
    // they can pass 5 s, Vitest's default, without anything being wrong.
    testTimeout: 20_000,
  },
});
