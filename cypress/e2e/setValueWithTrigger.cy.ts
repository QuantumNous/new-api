describe('form setValue with trigger', () => {
  it('should set input value and trigger validation', () => {
    cy.visit('http://localhost:3000/setValueWithTrigger');

    cy.get('input[name="firstName"]').type('a');
    cy.get('input[name="firstName"] + p').contains('minLength 10');
    cy.get('input[name="firstName"]').clear();
    cy.get('input[name="firstName"] + p').contains('required');
    cy.get('input[name="firstName"]').type('clear1234567');

    cy.get('input[name="lastName"]').type('a');
    cy.get('input[name="lastName"] + p').contains('too short');
    cy.get('input[name="lastName"]').type('fsdfsdfsd');
    cy.get('input[name="lastName"] + p').contains('error message');
    cy.get('input[name="lastName"]').clear();
    cy.get('input[name="lastName"]').type('bill');

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('31');
  });
});
