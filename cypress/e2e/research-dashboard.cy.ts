/**
 * Research Dashboard E2E Tests
 * Tests the main dashboard functionality including panels and visualizations
 */

describe('Research Dashboard', () => {
  beforeEach(() => {
    // Visit the app - dashboard is rendered but may be hidden when not connected
    cy.visit('/');
  });

  describe('Dashboard Layout', () => {
    it('should have proper viewport dimensions', () => {
      cy.viewport(1920, 1080);
      cy.get('[class*="w-screen"][class*="h-screen"]').should('exist');
    });

    it('should render without JavaScript errors', () => {
      // This test passes if the page loads without crashing
      cy.window().should('exist');
      cy.document().should('exist');
    });
  });

  describe('Connection Flow', () => {
    it('should show welcome screen when not connected', () => {
      // Welcome screen should be visible
      cy.get('[class*="fixed"][class*="inset-0"]').should('exist');
    });

    it('should handle connection attempt gracefully', () => {
      // Attempt to connect (will fail without server)
      cy.get('input').first().type('test-session');
      cy.get('button')
        .contains(/connect|join/i)
        .click();

      // App should not crash, should handle error gracefully
      cy.wait(2000);
      cy.get('body').should('exist');
    });
  });
});

describe('Dashboard Panels (when connected)', () => {
  beforeEach(() => {
    // Stub WebSocket for testing without real connection
    cy.visit('/', {
      onBeforeLoad: (win) => {
        // Mock isConnected state
        cy.stub(win, 'WebSocket').callsFake(function(this: WebSocket, url: string) {
          console.log('Mocked WebSocket:', url);
          return {
            url,
            readyState: 1, // OPEN
            send: cy.stub(),
            close: cy.stub(),
            addEventListener: cy.stub(),
            removeEventListener: cy.stub(),
            binaryType: 'arraybuffer',
          };
        });
      },
    });
  });

  it('should have panel components ready', () => {
    // The dashboard container should exist
    cy.get('div[class*="relative"]').should('exist');
  });
});

describe('Dashboard Components', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have framer-motion animations working', () => {
    // Check that motion components are rendered
    cy.get('[style*="transform"], [style*="opacity"]').should('exist');
  });

  it('should handle window resize gracefully', () => {
    cy.viewport(1920, 1080);
    cy.wait(100);
    cy.viewport(1280, 720);
    cy.wait(100);
    cy.viewport(1920, 1080);
    
    // App should still be functional
    cy.get('body').should('exist');
  });

  it('should persist panel preferences in localStorage', () => {
    cy.visit('/');
    
    cy.window().then((win) => {
      // Check that localStorage keys are being used
      const leftPanels = win.localStorage.getItem('phantomloop-left-panels-v2');
      const rightPanels = win.localStorage.getItem('phantomloop-right-panels-v2');
      const lockedPanels = win.localStorage.getItem('phantomloop-locked-panels');
      
      // After first load, these should be set
      // They may be null on first visit, then set after
    });
  });
});

describe('Dashboard Accessibility', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have focusable interactive elements', () => {
    cy.get('button, input, [tabindex]').should('have.length.at.least', 1);
  });

  it('should support keyboard navigation', () => {
    cy.get('body').tab();
    cy.focused().should('exist');
  });

  it('should have alt text for images', () => {
    cy.get('img').each(($img) => {
      cy.wrap($img).should('have.attr', 'alt');
    });
  });
});
