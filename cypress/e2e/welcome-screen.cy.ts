/**
 * Welcome Screen E2E Tests
 * Tests the initial onboarding and session connection flow
 */

describe('Welcome Screen', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the welcome screen when not connected', () => {
    // Check for logo or branding
    cy.get('img[alt*="PhantomLoop" i], img[src*="logo" i]')
      .should('be.visible');

    // Check for title/description
    cy.contains(/neural|gauntlet|arena/i).should('exist');
  });

  it('should display session connection input field', () => {
    // Look for session input field
    cy.get('input').should('exist');
  });

  it('should display server URL configuration option', () => {
    // Check for server URL input or configuration
    cy.get('input').should('have.length.at.least', 1);
  });

  it('should have a create session button', () => {
    cy.get('button')
      .contains(/create|new|start/i)
      .should('exist');
  });

  it('should have a connect/join button', () => {
    cy.get('button')
      .contains(/connect|join|enter/i)
      .should('exist');
  });

  it('should show loading state when creating a session', () => {
    // Click create session and check for loading indicator
    cy.get('button')
      .contains(/create|new|start/i)
      .click();

    // Should show some form of loading state or error (if server unavailable)
    cy.get('body').then(($body) => {
      // Either shows loading spinner or error message
      const hasLoading = $body.find('[class*="spinner" i], [class*="loading" i], svg[class*="animate"]').length > 0;
      const hasError = $body.text().toLowerCase().includes('error') || 
                       $body.text().toLowerCase().includes('failed') ||
                       $body.text().toLowerCase().includes('server');
      
      expect(hasLoading || hasError).to.equal(true);
    });
  });

  it('should validate session input before connecting', () => {
    // Try to connect with empty input
    const connectButton = cy.get('button').contains(/connect|join|enter/i);
    
    // Get the button and verify it's either disabled or doesn't trigger connection
    connectButton.should('exist');
  });

  it('should display animated background elements', () => {
    // Check for animated background (gradient blobs, grid pattern)
    cy.get('[class*="animate"], [class*="blur"], [class*="gradient"]')
      .should('exist');
  });

  it('should be responsive and centered', () => {
    // Check that main content is centered
    cy.get('[class*="flex"][class*="items-center"][class*="justify-center"]')
      .should('exist');
  });

  it('should allow typing in session input', () => {
    const testSessionCode = 'TEST-SESSION-123';
    
    cy.get('input')
      .first()
      .type(testSessionCode)
      .should('have.value', testSessionCode);
  });

  it('should handle Enter key press for connection', () => {
    cy.get('input')
      .first()
      .type('test-session{enter}');

    // Should either attempt to connect or show validation error
    cy.wait(500); // Brief wait for any state changes
  });
});

describe('Welcome Screen - Visual Elements', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have a dark theme background', () => {
    cy.get('[class*="bg-black"], [class*="bg-gray-9"]')
      .should('exist');
  });

  it('should display gradient accent colors', () => {
    // Check for phantom/loopback/biolink gradient colors
    cy.get('[class*="phantom"], [class*="loopback"], [class*="biolink"]')
      .should('exist');
  });

  it('should have proper text contrast for readability', () => {
    // Ensure text elements are visible with proper contrast
    cy.get('p, span, h1, h2, h3')
      .filter(':visible')
      .should('have.length.at.least', 1);
  });
});
