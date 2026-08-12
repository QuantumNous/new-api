describe('basic form validation', () => {
  it('should validate the form and reset the form', () => {
    cy.visit('http://localhost:3000/basic/onSubmit');
    cy.get('button#submit').click();

    cy.focused().should('have.attr', 'name', 'nestItem.nest1');

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="nestItem.nest1"] + p').contains('nest 1 error');
    cy.get('input[name="arrayItem.0.test1"] + p').contains(
      'array item 1 error',
    );
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"] + p').contains('selectNumber error');
    cy.get('select[name="multiple"] + p').contains('multiple error');
    cy.get('input[name="minRequiredLength"] + p').contains(
      'minRequiredLength error',
    );
    cy.get('input[name="radio"] + p').contains('radio error');
    cy.get('input[name="checkbox"] + p').contains('checkbox error');
    cy.get('input[name="checkboxArray"] + p').contains('checkboxArray error');
    cy.get('input[name="validate"] + p').contains('validate error');

    cy.get('input[name="firstName"]').type('bill');
    cy.get('input[name="firstName"]').type('a');
    cy.get('input[name="arrayItem.0.test1"]').type('ab');
    cy.get('input[name="nestItem.nest1"]').type('ab');
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('input[name="pattern"]').type('luo');
    cy.get('input[name="min"]').type('1');
    cy.get('input[name="max"]').type('21');
    cy.get('input[name="minDate"]').type('2019-07-30');
    cy.get('input[name="maxDate"]').type('2019-08-02');
    cy.get('input[name="lastName"]').clear().type('luo');
    cy.get('input[name="minLength"]').type('b');
    cy.get('input[name="validate"]').type('test');

    cy.get('input[name="pattern"] + p').contains('pattern error');
    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('select[name="multiple"]').select(['optionA']);
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').check();
    cy.get('input[name="checkboxArray"]').check('3');
    cy.get('select[name="multiple"]').select(['optionA', 'optionB']);

    cy.get('p').should('have.length', 0);

    cy.get('#submit').click();

    cy.get('pre').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        nestItem: { nest1: 'ab' },
        arrayItem: [{ test1: 'ab' }],
        firstName: 'billa',
        lastName: 'luo',
        min: '11',
        max: '19',
        minDate: '2019-08-01',
        maxDate: '2019-08-01',
        minLength: 'bbi',
        minRequiredLength: 'bi',
        selectNumber: '1',
        pattern: 'luo23',
        radio: '1',
        checkbox: true,
        checkboxArray: ['3'],
        multiple: ['optionA', 'optionB'],
        validate: 'test',
      }),
    );
    cy.get('#submit').click();

    cy.get('#resetForm').click();
    cy.get('input[name="firstName"]').should('not.have.value');
    cy.get('input[name="lastName"]').should('not.have.value');
    cy.get('select[name="selectNumber"]').should('have.value', '');
    cy.get('input[name="minRequiredLength"]').should('not.have.value');
    cy.get('input[name="radio"]').should('not.have.value');
    cy.get('input[name="max"]').should('not.have.value');
    cy.get('input[name="min"]').should('not.have.value');
    cy.get('input[name="minLength"]').should('not.have.value');
    cy.get('input[name="checkbox"]').should('not.have.value');
    cy.get('input[name="pattern"]').should('not.have.value');
    cy.get('input[name="minDate"]').should('not.have.value');
    cy.get('input[name="maxDate"]').should('not.have.value');
    cy.get('#renderCount').contains('35');

    cy.get('#on-invalid-called-times').contains('1');
  });

  it('should validate the form with onTouched mode', () => {
    cy.visit('http://localhost:3000/basic/onTouched');
    cy.get('input[name="nestItem.nest1"]').focus();
    cy.get('input[name="nestItem.nest1"]').type('test');
    cy.get('input[name="nestItem.nest1"]').clear();
    cy.get('p').should('have.length', 0);
    cy.get('input[name="nestItem.nest1"]').blur();
    cy.get('input[name="nestItem.nest1"] + p').contains('nest 1 error');

    cy.get('input[name="arrayItem.0.test1"]').focus();
    cy.get('input[name="arrayItem.0.test1"]').blur();
    cy.get('input[name="arrayItem.0.test1"] + p').contains(
      'array item 1 error',
    );

    cy.get('select[name="selectNumber"]').focus();
    cy.get('select[name="selectNumber"]').blur();
    cy.get('select[name="selectNumber"] + p').contains('selectNumber error');
    cy.get('select[name="selectNumber"]').select('1');

    cy.get('input[name="radio"]').first().focus();
    cy.get('input[name="radio"]').first().blur();
    cy.get('input[name="radio"] + p').contains('radio error');
    cy.get('input[name="radio"]').check('1');

    cy.get('input[name="checkbox"]').focus();
    cy.get('input[name="checkbox"]').blur();
    cy.get('input[name="checkbox"] + p').contains('checkbox error');
    cy.get('input[name="checkbox"]').check();
    cy.get('input[name="checkbox"]').blur();

    cy.get('input[name="nestItem.nest1"]').type('test');
    cy.get('input[name="arrayItem.0.test1"]').type('test');

    cy.get('p').should('have.length', 0);

    cy.get('#renderCount').contains('11');
  });

  it('should validate the form with onBlur mode and reset the form', () => {
    cy.visit('http://localhost:3000/basic/onBlur');

    cy.get('input[name="nestItem.nest1"]').focus();
    cy.get('input[name="nestItem.nest1"]').blur();
    cy.get('input[name="nestItem.nest1"] + p').contains('nest 1 error');
    cy.get('input[name="nestItem.nest1"]').type('a');

    cy.get('input[name="arrayItem.0.test1"]').focus();
    cy.get('input[name="arrayItem.0.test1"]').blur();
    cy.get('input[name="arrayItem.0.test1"] + p').contains(
      'array item 1 error',
    );
    cy.get('input[name="arrayItem.0.test1"]').type('a');

    cy.get('input[name="firstName"]').focus();
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="firstName"]').type('bill');

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
    cy.get('input[name="minLength"]').type('b');
    cy.get('input[name="minLength"]').blur();
    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('select[name="multiple"]').select(['optionA']);
    cy.get('input[name="radio"]').first().focus();
    cy.get('input[name="radio"]').first().blur();
    cy.get('input[name="radio"] + p').contains('radio error');
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').focus();
    cy.get('input[name="checkbox"]').blur();
    cy.get('input[name="checkbox"] + p').contains('checkbox error');
    cy.get('input[name="checkbox"]').check();
    cy.get('input[name="checkbox"]').blur();

    cy.get('p').should('have.length', 0);

    cy.get('#resetForm').click();
    cy.get('input[name="firstName"]').should('not.have.value');
    cy.get('input[name="lastName"]').should('not.have.value');
    cy.get('select[name="selectNumber"]').should('have.value', '');
    cy.get('input[name="minRequiredLength"]').should('not.have.value');
    cy.get('input[name="radio"]').should('not.have.value');
    cy.get('input[name="max"]').should('not.have.value');
    cy.get('input[name="min"]').should('not.have.value');
    cy.get('input[name="minLength"]').should('not.have.value');
    cy.get('input[name="checkbox"]').should('not.have.value');
    cy.get('input[name="pattern"]').should('not.have.value');
    cy.get('input[name="minDate"]').should('not.have.value');
    cy.get('input[name="maxDate"]').should('not.have.value');
    cy.get('#renderCount').contains('26');
  });

  it('should validate the form with onChange mode and reset the form', () => {
    cy.visit('http://localhost:3000/basic/onChange');

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
    cy.get('input[name="minLength"]').type('b');

    cy.get('input[name="pattern"] + p').contains('pattern error');
    cy.get('input[name="minLength"] + p').contains('minLength error');
    cy.get('input[name="min"] + p').contains('min error');
    cy.get('input[name="max"] + p').contains('max error');
    cy.get('input[name="minDate"] + p').contains('minDate error');
    cy.get('input[name="maxDate"] + p').contains('maxDate error');

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('select[name="multiple"]').select(['optionA']);
    cy.get('input[name="radio"]').check('1');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');
    cy.get('input[name="checkbox"]').check();

    cy.get('p').should('have.length', 0);

    cy.get('#resetForm').click();
    cy.get('input[name="firstName"]').should('not.have.value');
    cy.get('input[name="lastName"]').should('not.have.value');
    cy.get('select[name="selectNumber"]').should('have.value', '');
    cy.get('input[name="minRequiredLength"]').should('not.have.value');
    cy.get('input[name="radio"]').should('not.have.value');
    cy.get('input[name="max"]').should('not.have.value');
    cy.get('input[name="min"]').should('not.have.value');
    cy.get('input[name="minLength"]').should('not.have.value');
    cy.get('input[name="checkbox"]').should('not.have.value');
    cy.get('input[name="pattern"]').should('not.have.value');
    cy.get('input[name="minDate"]').should('not.have.value');
    cy.get('input[name="maxDate"]').should('not.have.value');
    cy.get('#renderCount').contains('22');
  });
});
