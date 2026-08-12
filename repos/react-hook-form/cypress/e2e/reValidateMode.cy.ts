describe('re-validate mode', () => {
  it('should re-validate the form only onSubmit with mode onSubmit and reValidateMode onSubmit', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onSubmit/onSubmit');

    cy.get('button#submit').click();

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="lastName"]').type('luo12');

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('button#submit').click();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('4');
  });

  it('should re-validate the form only onBlur with mode onSubmit and reValidateMode onBlur', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onSubmit/onBlur');
    cy.get('input[name="firstName"]').focus();
    cy.get('input[name="firstName"]').blur();

    cy.get('input[name="lastName"]').focus();
    cy.get('input[name="lastName"]').blur();
    cy.get('p').should('have.length', 0);

    cy.get('button#submit').click();

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="lastName"]').type('luo12');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('input[name="lastName"]').blur();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('5');
  });

  it('should re-validate the form only onSubmit with mode onBlur and reValidateMode onSubmit', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onBlur/onSubmit');

    cy.get('button#submit').click();

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="lastName"]').type('luo12');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('input[name="lastName"]').blur();

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('button#submit').click();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('4');
  });

  it('should re-validate the form only onSubmit with mode onChange and reValidateMode onSubmit', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onChange/onSubmit');

    cy.get('button#submit').click();

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"]').type('luo12');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('button#submit').click();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('4');
  });

  it('should re-validate the form onBlur only with mode onBlur and reValidateMode onBlur', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onBlur/onBlur');

    cy.get('input[name="firstName"]').focus();
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"]').focus();
    cy.get('input[name="lastName"]').blur();
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="lastName"]').type('luo12');
    cy.get('input[name="lastName"] + p').contains('lastName error');
    cy.get('input[name="lastName"]').blur();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('6');
  });

  it('should re-validate the form onChange with mode onBlur and reValidateMode onChange', () => {
    cy.visit('http://localhost:3000/re-validate-mode/onBlur/onChange');

    cy.get('input[name="firstName"]').focus();
    cy.get('input[name="firstName"]').blur();
    cy.get('input[name="firstName"] + p').contains('firstName error');
    cy.get('input[name="lastName"]').focus();
    cy.get('input[name="lastName"]').blur();
    cy.get('input[name="lastName"] + p').contains('lastName error');

    cy.get('input[name="firstName"]').clear();
    cy.get('input[name="lastName"]').clear();

    cy.get('button#submit').click();

    cy.get('input[name="firstName"]').type('luo123456');
    cy.get('input[name="lastName"]').type('luo12');

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('7');
  });
});
