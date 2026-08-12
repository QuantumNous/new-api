describe('defaultValues async', () => {
  it('should populate defaultValue async for inputs', () => {
    cy.visit('http://localhost:3000/default-values-async');

    cy.wait(10);

    cy.get('input[name="test"]').should('have.value', 'test');
    cy.get('input[name="test1.firstName"]').should('have.value', 'firstName');
    cy.get('input[name="test1.lastName.0"]').should('have.value', 'lastName0');
    cy.get('input[name="test1.lastName.1"]').should('have.value', 'lastName1');
    cy.get('input[name="checkbox"]').eq(0).should('have.checked');
    cy.get('input[name="checkbox"]').eq(1).should('have.checked');

    cy.get('input[name="checkbox"]').eq(0).click();
    cy.get('#toggle').click();
    cy.get('#toggle').click();

    cy.get('input[name="checkbox"]').eq(0).should('not.have.checked');
    cy.get('input[name="checkbox"]').eq(1).should('have.checked');
    cy.get('input[name="checkbox"]').eq(1).click();

    cy.get('#toggle').click();
    cy.get('#toggle').click();

    cy.get('input[name="checkbox"]').eq(0).should('not.have.checked');
    cy.get('input[name="checkbox"]').eq(1).should('not.have.checked');
  });
});
