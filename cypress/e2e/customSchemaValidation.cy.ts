describe('customSchemaValidation form validation', () => {
  it('should validate the form with onSubmit mode', () => {
    cy.visit('http://localhost:3000/customSchemaValidation/onSubmit');
    cy.get('button').click();

    cy.focused().should('have.attr', 'name', 'firstName');

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"] + p').contains('selectNumber error');
    cy.get('input[name="minRequiredLength"] + p').contains(
      'minRequiredLength error',
    );
    cy.get('input[name="radio"] + p').contains('radio error');

    cy.get('input[name="firstName"]').type('bill');
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('input[name="pattern"]').type('luo');
    cy.get('input[name="min"]').type('1');
    cy.get('input[name="max"]').type('21');
    cy.get('input[name="minDate"]').type('2019-07-30');
    cy.get('input[name="maxDate"]').type('2019-08-02');
    cy.get('input[name="lastName"]').clear().type('luo');
    cy.get('input[name="minLength"]').type('2');
    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').check();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('26');
  });

  it('should validate the form with onBlur mode', () => {
    cy.visit('http://localhost:3000/customSchemaValidation/onBlur');

    cy.get('input[name="firstName"]').focus();
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="firstName"]').type('bill');
    cy.get('input[name="lastName"]').focus();
    cy.get('input[name="lastName"]').blur();
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('input[name="lastName"]').blur();
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"]').focus();
    cy.get('select[name="selectNumber"]').blur();
    cy.get('select[name="selectNumber"] + p').contains('selectNumber error');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('input[name="pattern"]').type('luo');
    cy.get('input[name="min"]').type('1');
    cy.get('input[name="max"]').type('21');
    cy.get('input[name="minDate"]').type('2019-07-30');
    cy.get('input[name="maxDate"]').type('2019-08-02');
    cy.get('input[name="lastName"]').clear().type('luo');
    cy.get('input[name="minLength"]').type('2');
    cy.get('input[name="minLength"]').blur();

    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('input[name="radio"]').first().focus();
    cy.get('input[name="radio"]').first().blur();
    cy.get('input[name="radio"] + p').contains('radio error');
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').check();

    cy.get('p').should('have.length', 0);
  });

  it('should validate the form with onChange mode', () => {
    cy.visit('http://localhost:3000/customSchemaValidation/onChange');

    cy.get('input[name="firstName"]').type('bill');
    cy.get('input[name="lastName"]').focus();
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('input[name="lastName"]').clear();
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('select[name="selectNumber"]').select('');
    cy.get('select[name="selectNumber"] + p').contains('selectNumber error');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('input[name="pattern"]').type('luo');
    cy.get('input[name="min"]').type('1');
    cy.get('input[name="max"]').type('21');
    cy.get('input[name="minDate"]').type('2019-07-30');
    cy.get('input[name="maxDate"]').type('2019-08-02');
    cy.get('input[name="lastName"]').clear().type('luo');
    cy.get('input[name="minLength"]').type('2');

    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('input[name="radio"]').first().focus();
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').check();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('23');
  });
});
