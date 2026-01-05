import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../setup/test-setup.ts')],
    globals: true,
    
    // Override test file patterns for integration tests
    include: [
      'testing/integration/**/*.test.ts',
      'testing/integration/**/*.test.js',
    ],
    
    // Integration tests may need longer timeouts
    testTimeout: 10000,
    
    // Run integration tests sequentially to avoid race conditions
    // Can be parallelized later once tests are stable
    maxConcurrency: 1,
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'testing/',
        'backend/',
        '*.config.ts',
        '*.config.js',
      ],
    },
  },
  
  resolve: {
    alias: {
      chrome: path.resolve(__dirname, '../utils/chrome-mock.ts'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@parsers': path.resolve(__dirname, '../../parsers'),
      '@content': path.resolve(__dirname, '../../content'),
    },
  },
});
