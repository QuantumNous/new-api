describe('form trigger', () => {
  it('should trigger input validation', () => {
    cy.visit('http://localhost:3000/trigger-validation');

    cy.get('#testError').should('be.empty');
    cy.get('#test1Error').should('be.empty');
    cy.get('#test2Error').should('be.empty');

    cy.get('#single').click();
    cy.get('#testError').contains('required');
    cy.get('#single').click();

    cy.get('#multiple').click();
    cy.get('#test1Error').contains('required');
    cy.get('#test2Error').contains('required');

    cy.get('#multiple').click();
    cy.get('#renderCount').contains('6');
  });
});
