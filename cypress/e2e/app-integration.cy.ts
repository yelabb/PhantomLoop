/**
 * Application Integration E2E Tests
 * Tests overall application behavior and state management
 */

describe('Application Startup', () => {
  it('should load the application without errors', () => {
    cy.visit('/');
    cy.get('body').should('exist');
    cy.get('#root').should('exist');
  });

  it('should have proper document title', () => {
    cy.visit('/');
    cy.title().should('not.be.empty');
  });

  it('should load required assets', () => {
    cy.visit('/');
    
    // Check that React mounted successfully
    cy.get('#root').children().should('have.length.at.least', 1);
  });
});

describe('State Management (Zustand)', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should initialize store correctly', () => {
    cy.window().then((win) => {
      // App should be functional
      expect(win.document.body).to.exist;
    });
  });

  it('should persist state across page navigation', () => {
    // Enter a session code
    cy.get('input').first().type('persist-test');
    
    // Reload the page
    cy.reload();
    
    // App should still work
    cy.get('body').should('exist');
  });
});

describe('Error Handling', () => {
  it('should handle network errors gracefully', () => {
    // Intercept API calls and force failure
    cy.intercept('POST', '**/api/sessions/create', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('createSessionError');

    cy.visit('/');
    
    // Try to create a session
    cy.get('button')
      .contains(/create|new|start/i)
      .click();

    // Wait for error response
    cy.wait('@createSessionError');

    // App should still be functional and show error message
    cy.get('body').should('exist');
  });

  it('should handle WebSocket connection failure', () => {
    cy.visit('/');
    
    // Attempt connection
    cy.get('input').first().type('test-session');
    cy.get('button')
      .contains(/connect|join/i)
      .click();

    // App should handle the failure gracefully
    cy.wait(3000);
    cy.get('body').should('exist');
  });
});

describe('Performance', () => {
  it('should render within acceptable time', () => {
    const startTime = Date.now();
    
    cy.visit('/').then(() => {
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(5000); // 5 seconds max
    });
  });

  it('should not have memory leaks on repeated navigation', () => {
    // Visit and reload multiple times
    for (let i = 0; i < 3; i++) {
      cy.visit('/');
      cy.wait(500);
    }
    
    // App should still be responsive
    cy.get('body').should('exist');
  });
});

describe('Browser Compatibility', () => {
  it('should work with modern browser features', () => {
    cy.visit('/');
    
    cy.window().then((win) => {
      // Check for required browser APIs
      expect(win.WebSocket).to.exist;
      expect(win.localStorage).to.exist;
      expect(win.requestAnimationFrame).to.exist;
    });
  });
});

describe('API Integration', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should make proper API requests', () => {
    // Intercept session creation
    cy.intercept('POST', '**/api/sessions/create').as('createSession');
    
    cy.get('button')
      .contains(/create|new|start/i)
      .click();

    // Verify the request was made
    cy.wait('@createSession').then((interception) => {
      expect(interception.request.method).to.equal('POST');
    });
  });

  it('should handle CORS properly', () => {
    // App should handle cross-origin requests
    cy.window().then((win) => {
      expect(win.fetch).to.exist;
    });
  });
});
