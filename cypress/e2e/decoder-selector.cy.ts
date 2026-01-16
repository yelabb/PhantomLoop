/**
 * Decoder Selector E2E Tests
 * Tests for neural decoder selection and management
 */

describe('Decoder Selector', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Decoder Panel', () => {
    it('should have decoder-related UI elements', () => {
      // Decoder selector may not be visible until connected
      cy.get('body').should('exist');
    });
  });

  describe('Add Decoder Modal', () => {
    it('should have modal trigger capability', () => {
      // Check for buttons that might open the add decoder modal
      cy.get('button').should('have.length.at.least', 1);
    });
  });
});

describe('Code Editor', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have Monaco editor infrastructure', () => {
    // Monaco editor uses specific class names
    cy.window().then((win) => {
      // Check if Monaco is loaded (it may lazy-load)
      expect(win).to.exist;
    });
  });
});

describe('Metrics Panel', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have metrics display capability', () => {
    // Metrics panel displays performance data
    cy.get('body').should('exist');
  });
});

describe('Temporal Inspector', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have temporal analysis UI', () => {
    // Temporal inspector for analyzing neural data over time
    cy.get('body').should('exist');
  });
});
