import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    restoreMocks: true,
    env: {
      NODE_ENV: 'test',
      PORT: '5001',
      CLIENT_URL: 'http://localhost:5173',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/workspace_test',
      LOG_LEVEL: 'silent',
    },
  },
});
