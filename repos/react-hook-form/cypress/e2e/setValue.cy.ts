describe('form setValue', () => {
  it('should set input value, trigger validation and clear all errors', () => {
    cy.visit('http://localhost:3000/setValue');

    cy.get('input[name="firstName"]').should('have.value', 'wrong');
    cy.get('input[name="age"]').should('have.value', '2');
    cy.get('input[name="array.0"]').should('have.value', 'array.0');
    cy.get('input[name="array.1"]').should('have.value', 'array.1');
    cy.get('input[name="array.2"]').should('have.value', 'array.2');
    cy.get('input[name="object.firstName').should('have.value', 'firstName');
    cy.get('input[name="object.lastName').should('have.value', 'lastName');
    cy.get('input[name="object.middleName').should('have.value', 'middleName');
    cy.get('input[name="radio"]').should('have.checked', true);
    cy.get('input[name="checkboxArray"][value="2"]').should(
      'have.checked',
      true,
    );
    cy.get('input[name="checkboxArray"][value="3"]').should(
      'have.checked',
      true,
    );
    cy.get('select[name="select"]').should('have.value', 'a');
    cy.get('select[name="multiple"]')
      .invoke('val')
      .should('deep.equal', ['a', 'b']);
    cy.get('#trigger').contains('Trigger error');
    cy.get('#lastName').should('not.exist');
    cy.get('#nestedValue').contains('required');

    cy.get('#submit').click();

    cy.get('#lastName').contains('Last name error');

    cy.get('input[name="lastName"]').type('test');
    cy.get('input[name="trigger"]').type('trigger');
    cy.get('input[name="nestedValue"]').type('test');

    cy.get('#submit').click();
    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('7');

    cy.get('#setMultipleValues').click();
    cy.get('input[name="array.0"]').should('have.value', 'array[0]1');
    cy.get('input[name="array.1"]').should('have.value', 'array[1]1');
    cy.get('input[name="array.2"]').should('have.value', 'array[2]1');
    cy.get('input[name="object.firstName').should('have.value', 'firstName1');
    cy.get('input[name="object.lastName').should('have.value', 'lastName1');
    cy.get('input[name="object.middleName').should('have.value', 'middleName1');
    cy.get('input[name="nestedValue"]').should('have.value', 'a,b');
    cy.get('#renderCount').contains('7');
  });
});
