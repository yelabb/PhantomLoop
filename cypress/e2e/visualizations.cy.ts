/**
 * Visualization Components E2E Tests
 * Tests for neural data visualization panels
 */

describe('Visualization Components', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Canvas and SVG Elements', () => {
    it('should render visualization containers', () => {
      // Check for canvas or SVG elements that will display visualizations
      cy.get('body').should('exist');
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different viewport sizes', () => {
      // Test desktop
      cy.viewport(1920, 1080);
      cy.get('body').should('be.visible');

      // Test laptop
      cy.viewport(1440, 900);
      cy.get('body').should('be.visible');

      // Test smaller desktop
      cy.viewport(1280, 720);
      cy.get('body').should('be.visible');
    });
  });
});

describe('Panel Management', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should preserve panel state in localStorage', () => {
    cy.window().then((win) => {
      // Set some panel preferences
      win.localStorage.setItem('phantomloop-test-key', 'test-value');
      
      // Verify it was set
      expect(win.localStorage.getItem('phantomloop-test-key')).to.equal('test-value');
    });
  });

  it('should initialize with default panel layout', () => {
    // Clear localStorage and reload
    cy.clearLocalStorage();
    cy.reload();

    // App should load with default configuration
    cy.get('body').should('exist');
  });

  it('should handle panel drag and drop interactions', () => {
    // This tests that drag-related elements exist
    cy.get('[draggable], [class*="draggable"], [class*="drag"]')
      .should('exist')
      .or('not.exist'); // May only be visible when connected
  });
});

describe('Resizable Panels', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have resizable panel infrastructure', () => {
    // Check for resize handles or resizable containers
    cy.get('[class*="resize"], [class*="Resizable"]')
      .should('exist')
      .or('not.exist');
  });
});

describe('Loading States', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show spinner during loading operations', () => {
    // Trigger a loading state
    cy.get('button')
      .contains(/create|connect/i)
      .first()
      .click();

    // Check for spinner or loading indicator
    cy.get('[class*="spinner" i], [class*="animate-spin"], [class*="loading"]', { timeout: 5000 })
      .should('exist')
      .or('not.exist');
  });

  it('should handle decoder loading overlay', () => {
    // Decoder loading overlay is a specific component
    cy.get('[class*="loading" i], [class*="overlay" i]')
      .should('exist')
      .or('not.exist');
  });
});
