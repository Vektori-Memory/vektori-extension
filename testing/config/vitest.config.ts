import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',
    
    // Global setup/teardown
    setupFiles: [path.resolve(__dirname, '../setup/test-setup.ts')],
    
    // Coverage configuration
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
      // TODO: Set thresholds once initial coverage is established
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      // },
    },
    
    // Globals (makes describe, it, expect available without imports)
    globals: true,
    
    // Test file patterns
    include: [
      'testing/unit/**/*.test.ts',
      'testing/unit/**/*.test.js',
    ],
    
    // Timeout for individual tests (5s default)
    testTimeout: 5000,
  },
  
  resolve: {
    alias: {
      // Alias for chrome API mocks
      chrome: path.resolve(__dirname, '../utils/chrome-mock.ts'),
      // Alias for shared modules
      '@shared': path.resolve(__dirname, '../../shared'),
      '@parsers': path.resolve(__dirname, '../../parsers'),
      '@content': path.resolve(__dirname, '../../content'),
    },
  },
});
