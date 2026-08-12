describe('watchDefaultValues', () => {
  it('should return default value with watch', () => {
    cy.visit('http://localhost:3000/watch-default-values');

    cy.get('#watchAll').should(
      'have.text',
      '{"test":"test","test1":{"firstName":"firstName","lastName":["lastName0","lastName1"],"deep":{"nest":"nest"}},"flatName[1]":{"whatever":"flat"}}',
    );
    cy.get('#array').should('have.text', '["test",{"whatever":"flat"}]');
    cy.get('#getArray').should('have.text', '["lastName0","lastName1"]');
    cy.get('#object').should('have.text', '["test","firstName"]');
    cy.get('#single').should('have.text', '"firstName"');
    cy.get('#singleDeepArray').should('have.text', '"lastName0"');
  });
});
