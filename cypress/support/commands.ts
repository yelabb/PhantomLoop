// ***********************************************
// Custom Cypress Commands for PhantomLoop
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Connect to a PhantomLink session
       * @param sessionCode - The session code to connect to
       */
      connectToSession(sessionCode: string): Chainable<void>;

      /**
       * Wait for the dashboard to be fully loaded
       */
      waitForDashboard(): Chainable<void>;

      /**
       * Simulate WebSocket connection
       */
      mockWebSocket(): Chainable<void>;

      /**
       * Check if element is visible in viewport
       */
      isInViewport(): Chainable<boolean>;

      /**
       * Get store state (Zustand)
       */
      getStoreState(): Chainable<unknown>;
    }
  }
}

// Connect to a session via the welcome screen
Cypress.Commands.add('connectToSession', (sessionCode: string) => {
  cy.get('[data-testid="session-input"], input[placeholder*="session" i], input[placeholder*="code" i]')
    .first()
    .clear()
    .type(sessionCode);
  
  cy.get('[data-testid="connect-button"], button:contains("Connect"), button:contains("Join")')
    .first()
    .click();
});

// Wait for the research dashboard to be visible
Cypress.Commands.add('waitForDashboard', () => {
  // Wait for connection status or dashboard elements
  cy.get('[data-testid="research-dashboard"], [data-testid="dashboard"]', { timeout: 15000 })
    .should('exist');
});

// Mock WebSocket for testing without a real server
Cypress.Commands.add('mockWebSocket', () => {
  cy.window().then((win) => {
    // Create a mock WebSocket class
    const MockWebSocket = class extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      url: string;
      readyState: number = 0;
      binaryType: BinaryType = 'blob';

      constructor(url: string) {
        super();
        this.url = url;
        // Simulate connection
        setTimeout(() => {
          this.readyState = 1;
          this.dispatchEvent(new Event('open'));
        }, 100);
      }

      send(data: unknown) {
        console.log('Mock WebSocket send:', data);
      }

      close() {
        this.readyState = 3;
        this.dispatchEvent(new CloseEvent('close'));
      }
    };

    // Replace global WebSocket
    (win as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  });
});

// Check if element is visible in the viewport
Cypress.Commands.add('isInViewport', { prevSubject: 'element' }, (subject) => {
  const rect = subject[0].getBoundingClientRect();
  const windowHeight = Cypress.config('viewportHeight');
  const windowWidth = Cypress.config('viewportWidth');
  
  const isVisible = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= windowHeight &&
    rect.right <= windowWidth
  );
  
  return cy.wrap(isVisible);
});

// Get Zustand store state
Cypress.Commands.add('getStoreState', () => {
  cy.window().then((win) => {
    // Access the Zustand store if exposed
    const store = (win as unknown as { __ZUSTAND_STORE__?: { getState: () => unknown } }).__ZUSTAND_STORE__;
    if (store) {
      return store.getState();
    }
    return null;
  });
});

export {};
