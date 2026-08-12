describe('validate field criteria', () => {
  it('should validate the form, show all errors and clear all', () => {
    cy.visit('http://localhost:3000/validate-field-criteria');
    cy.get('button#submit').click();
    cy.get('input[name="firstName"] + p').contains('firstName required');
    cy.get('input[name="firstName"]').type('te');
    cy.get('input[name="firstName"] + p').contains('firstName minLength');
    cy.get('input[name="firstName"]').type('testtesttest');

    cy.get('input[name="min"] + p').contains('min required');
    cy.get('input[name="min"]').type('2');
    cy.get('input[name="min"] + p').contains('min min');
    cy.get('input[name="min"]').type('32');
    cy.get('input[name="min"] + p').contains('min max');
    cy.get('input[name="min"]').clear();
    cy.get('input[name="min"]').type('10');

    cy.get('input[name="minDate"] + p').contains('minDate required');
    cy.get('input[name="minDate"]').type('2019-07-01');
    cy.get('input[name="minDate"] + p').contains('minDate min');
    cy.get('input[name="minDate"]').type('2019-08-01');

    cy.get('input[name="maxDate"] + p').contains('maxDate required');
    cy.get('input[name="maxDate"]').type('2019-09-01');
    cy.get('input[name="maxDate"] + p').contains('maxDate max');
    cy.get('input[name="maxDate"]').type('2019-08-01');

    cy.get('input[name="minLength"] + p').contains('minLength required');
    cy.get('input[name="minLength"]').type('1');
    cy.get('input[name="minLength"] + p').contains('minLength minLength');
    cy.get('input[name="minLength"]').type('12');

    cy.get('select[name="selectNumber"] + p').contains('selectNumber required');
    cy.get('select[name="selectNumber"]').select('12');

    cy.get('input[name="pattern"] + p').contains('pattern required');
    cy.get('input[name="pattern"]').type('t');
    cy.get('input[name="pattern"] + p').contains('pattern pattern');
    cy.get('input[name="pattern"] + p + p').contains('pattern minLength');
    cy.get('input[name="pattern"]').clear();
    cy.get('input[name="pattern"]').type('12345');

    cy.get('select[name="multiple"] + p').contains('multiple required');
    cy.get('select[name="multiple"] + p + p').contains('multiple validate');
    cy.get('select[name="multiple"]').select('optionA');
    cy.get('select[name="multiple"]').select('optionB');

    cy.get('input[name="validate"] + p').contains('validate test');
    cy.get('input[name="validate"] + p + p').contains('validate test1');
    cy.get('input[name="validate"] + p + p + p').contains('validate test2');
    cy.get('input[name="validate"]').type('test');

    cy.get('p').should('have.length', 0);

    cy.get('#trigger').click();
    cy.get('p').should('have.length', 2);
    cy.get('b').should('have.length', 2);

    cy.get('#clear').click();
    cy.get('p').should('have.length', 0);
    cy.get('b').should('have.length', 0);

    cy.get('#renderCount').contains('28');
  });
});
