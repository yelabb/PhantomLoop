// ***********************************************************
// This support file is processed and loaded automatically before
// your e2e test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// Prevent uncaught exceptions from failing tests
Cypress.on('uncaught:exception', (err, _runnable) => {
  void _runnable; // Explicitly mark as intentionally unused
  // Returning false here prevents Cypress from failing the test
  // This is useful for third-party errors or expected WebSocket disconnections
  console.warn('Uncaught exception:', err.message);
  return false;
});

// Log all failed requests for debugging
Cypress.on('fail', (error, runnable) => {
  console.error('Test failed:', runnable.title);
  console.error('Error:', error.message);
  throw error;
});
