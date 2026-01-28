// ***********************************************************
// This support file is processed and loaded automatically before
// your component test files.
// ***********************************************************

import './commands';

// Import global styles for component testing
// import '../../src/index.css';

// Mount command for React components
import { mount } from 'cypress/react18';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
