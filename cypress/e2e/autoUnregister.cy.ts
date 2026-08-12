describe('autoUnregister', () => {
  it('should keep all inputs data when inputs get unmounted', () => {
    cy.visit('http://localhost:3000/autoUnregister');
    cy.get('input[name="test"]').type('test');
    cy.get('input[name="test1"]').type('test1');
    cy.get('input[name="test2"]').check();
    cy.get('input[name="test3"]').check();
    cy.get('select[name="test4"]').select('Bill');
    cy.get('#input-ReactSelect > div').click();
    cy.get('#input-ReactSelect > div > div').eq(1).click();

    cy.get('button').click();
    cy.get('button').click();

    cy.get('input[name="test"]').should('has.value', 'test');
    cy.get('input[name="test1"]').should('has.value', 'test1');
    cy.get('input[name="test2"]').should('be.checked');
    cy.get('input[name="test3"]').should('be.checked');
    cy.get('select[name="test4"]').should('has.value', 'bill');
    cy.get('#input-ReactSelect > div > div > div > div').contains('Strawberry');
  });
});
