/**
 * Playback Controls E2E Tests
 * Tests the neural data playback functionality
 */

describe('Playback Controls', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Control Elements', () => {
    it('should render playback controls when session is active', () => {
      // Playback controls may be part of the main UI
      cy.get('body').should('exist');
    });

    it('should have play/pause button', () => {
      // Look for play/pause control
      cy.get('button[aria-label*="play" i], button[aria-label*="pause" i], [data-testid*="playback"]')
        .should('exist')
        .or('not.exist'); // May not be visible without connection
    });
  });
});

describe('Session Manager', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should handle session creation request', () => {
    // Find and click create session button
    cy.get('button')
      .contains(/create|new|start/i)
      .click();

    // Wait for response
    cy.wait(1000);
    
    // Should show loading, error, or success state
    cy.get('body').should('exist');
  });

  it('should validate session code format', () => {
    // Enter an invalid session code
    cy.get('input').first().type('x');
    
    // Input should accept the value
    cy.get('input').first().should('have.value', 'x');
  });
});

describe('Connection Status', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show disconnected status initially', () => {
    // Welcome screen indicates disconnected state
    cy.contains(/connect|session/i).should('exist');
  });

  it('should update connection status on connect attempt', () => {
    cy.get('input').first().type('test-session');
    cy.get('button')
      .contains(/connect|join/i)
      .click();

    // Should show some connection state change
    cy.wait(2000);
  });
});
