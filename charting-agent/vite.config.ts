/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // No base path needed for Vercel
  // base: '/Viz-Agent/', 
  
  test: {
    globals: true, // Use global variables (describe, it, expect) like Jest
    environment: 'node', // Specify environment for testing Node.js code
    // Explicitly include test files from both src and api directories
    include: ['./src/**/*.test.ts', './api/charting/*.test.ts'],
    coverage: {
      provider: 'v8', // Specify the coverage provider
      reporter: ['text', 'json', 'html'], // Report formats
      reportsDirectory: './coverage', // Where to output reports
      // Coverage include/exclude (Source files to measure):
      include: ['src/**/*.ts', 'api/charting/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'api/**/*.test.ts', // Exclude all test files from coverage
        'src/types.ts',
        'src/vite-env.d.ts',
        'vite.config.ts',
        'postcss.config.js', // Add other config files if any
        'tailwind.config.js' // Add other config files if any
      ],
      all: true, // Ensure even untested files are included in the report
    },
  },
}); 