describe('setValue with react native or web', () => {
  it('should only trigger re-render when form state changed or error triggered', () => {
    cy.visit('http://localhost:3000/setValueCustomRegister');
    cy.get('#dirty').contains('false');
    cy.get('#TriggerDirty').click();
    cy.get('#dirty').contains('true');
    cy.get('#TriggerNothing').click();
    cy.get('#TriggerNothing').click();
    cy.get('#TriggerNothing').click();
    cy.get('#TriggerNothing').click();

    cy.get('#WithError').click();
    cy.get('#WithError').click();

    cy.get('#WithoutError').click();
    cy.get('#WithoutError').click();

    cy.get('#WithError').click();

    cy.get('#TriggerNothing').click();
    cy.get('#renderCount').contains('8');
  });
});
