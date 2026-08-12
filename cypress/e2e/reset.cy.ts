describe('form reset', () => {
  it('should be able to re-populate the form while reset', () => {
    cy.visit('http://localhost:3000/reset');

    cy.get('input[name="firstName"]').type('0 wrong');
    cy.get('input[name="array.1"]').type('1 wrong');
    cy.get('input[name="objectData.test"]').type('2 wrong');
    cy.get('input[name="lastName"]').type('lastName');
    cy.get('input[name="deepNest.level1.level2.data"]').type('whatever');

    cy.get('button').click();

    cy.get('input[name="firstName"]').should('have.value', 'bill');
    cy.get('input[name="lastName"]').should('have.value', 'luo');
    cy.get('input[name="array.1"]').should('have.value', 'test');
    cy.get('input[name="objectData.test"]').should('have.value', 'data');
    cy.get('input[name="deepNest.level1.level2.data"]').should(
      'have.value',
      'hey',
    );
  });

  it('should be able to re-populate the form while reset keeping dirty values', () => {
    cy.visit('http://localhost:3000/resetKeepDirty');
    cy.get('input[name="firstName"]').should('have.value', '');
    cy.get('input[name="users"]').should('have.value', 'users#0');
    cy.get('input[name="objectData.test"]').should('have.value', '');
    cy.get('input[name="lastName"]').should('have.value', '');
    cy.get('input[name="deepNest.level1.level2.data"]').should(
      'have.value',
      '',
    );

    cy.contains('button', 'Add item').click();
    cy.get('input[name="users"]').should('have.value', 'users#1');
    cy.contains('button', 'button').click();

    cy.get('input[name="firstName"]').should('have.value', 'bill');
    cy.get('input[name="lastName"]').should('have.value', 'luo');
    cy.get('input[name="users"]').should('have.value', 'users#1');
    cy.get('input[name="objectData.test"]').should('have.value', 'data');
    cy.get('input[name="deepNest.level1.level2.data"]').should(
      'have.value',
      'hey',
    );
  });
});
