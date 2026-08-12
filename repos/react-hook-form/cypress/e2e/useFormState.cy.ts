describe('useFormState', () => {
  it('should subscribed to the form state without re-render the root', () => {
    cy.visit('http://localhost:3000/useFormState');
    cy.get('button#submit').click();

    cy.get('input[name="firstName"]').type('bill');
    cy.get('input[name="firstName"]').type('a');
    cy.get('input[name="arrayItem.0.test1"]').type('ab');
    cy.get('input[name="nestItem.nest1"]').type('ab');
    cy.get('input[name="lastName"]').type('luo123456');
    cy.get('select[name="selectNumber"]').select('1');
    cy.get('input[name="pattern"]').type('luo');
    cy.get('input[name="min"]').type('1');
    cy.get('input[name="max"]').type('21');
    cy.get('input[name="minDate"]').type('2019-07-30');
    cy.get('input[name="maxDate"]').type('2019-08-02');
    cy.get('input[name="lastName"]').clear().type('luo');
    cy.get('input[name="minLength"]').type('b');
    cy.get('input[name="minLength"]').blur();

    cy.get('#state').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: false,
        submitCount: 1,
        isValid: false,
      }),
    );

    cy.get('input[name="pattern"]').type('23');
    cy.get('input[name="minLength"]').type('bi');
    cy.get('input[name="minRequiredLength"]').type('bi');
    cy.get('input[name="min"]').clear().type('11');
    cy.get('input[name="max"]').clear().type('19');
    cy.get('input[name="minDate"]').type('2019-08-01');
    cy.get('input[name="maxDate"]').type('2019-08-01');

    cy.get('#state').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: false,
        submitCount: 1,
        isValid: true,
      }),
    );

    cy.get('#submit').click();

    cy.get('#state').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        isDirty: true,
        touched: [
          'nestItem',
          'firstName',
          'arrayItem',
          'lastName',
          'selectNumber',
          'pattern',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
        ],
        dirty: [
          'nestItem',
          'arrayItem',
          'firstName',
          'lastName',
          'min',
          'max',
          'minDate',
          'maxDate',
          'minLength',
          'minRequiredLength',
          'selectNumber',
          'pattern',
        ],
        isSubmitted: true,
        isSubmitSuccessful: true,
        submitCount: 2,
        isValid: true,
      }),
    );

    cy.get('#resetForm').click();

    cy.get('#state').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        isDirty: false,
        touched: [],
        dirty: [],
        isSubmitted: false,
        isSubmitSuccessful: false,
        submitCount: 0,
        isValid: true,
      }),
    );

    cy.get('#renderCount').contains('2');
  });
});
