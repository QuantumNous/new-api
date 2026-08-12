describe('controller basic form validation', () => {
  it('should validate the form and reset the form', () => {
    cy.visit('http://localhost:3000/controller/onSubmit');
    cy.get('#submit').click();

    cy.get('#TextField').contains('TextField Error');
    cy.get('#RadioGroup').contains('RadioGroup Error');
    cy.get('#Checkbox').contains('Checkbox Error');
    cy.get('#RadioGroup').contains('RadioGroup Error');
    cy.get('#Select').contains('Select Error');
    cy.get('#switch').contains('switch Error');

    cy.get('#input-checkbox input').click();
    cy.get('input[name="gender1"]').first().click();
    cy.get('#input-textField input').type('test');
    cy.get('#input-select > div > div').click();
    cy.get('.MuiPopover-root ul > li:first-child').click();
    cy.get('#input-switch input').click();
    cy.get('#input-ReactSelect > div').click();
    cy.get('#input-ReactSelect > div > div').eq(1).click();

    cy.get('.container > p').should('have.length', 0);
    cy.get('#renderCount').contains('9');
  });

  it('should validate the form with onBlur mode and reset the form', () => {
    cy.visit('http://localhost:3000/controller/onBlur');

    cy.get('p').should('have.length', 0);
    cy.get('#input-checkbox input').focus();
    cy.get('#input-checkbox input').blur();
    cy.get('#Checkbox').contains('Checkbox Error');

    cy.get('#input-textField input').focus();
    cy.get('#input-textField input').blur();
    cy.get('#TextField').contains('TextField Error');

    cy.get('#input-select > div > div').focus();
    cy.get('#input-select > div > div').blur();
    cy.get('#Select').contains('Select Error');

    cy.get('#input-switch input').focus();
    cy.get('#input-switch input').blur();
    cy.get('#switch').contains('switch Error');

    cy.get('#input-checkbox input').click();
    cy.get('#input-textField input').type('test');
    cy.get('#input-select > div > div').click();
    cy.get('.MuiPopover-root ul > li:first-child').click();
    cy.get('#input-switch input').click();
    cy.get('#input-switch input').blur();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('10');
  });

  it('should validate the form with onChange mode and reset the form', () => {
    cy.visit('http://localhost:3000/controller/onChange');

    cy.get('#input-checkbox input').click();
    cy.get('#input-checkbox input').click();
    cy.get('#Checkbox').contains('Checkbox Error');

    cy.get('#input-textField input').type('test');
    cy.get('#input-textField input').clear();
    cy.get('#TextField').contains('TextField Error');

    cy.get('#input-switch input').click();
    cy.get('#input-switch input').click();
    cy.get('#switch').contains('switch Error');

    cy.get('#input-checkbox input').click();
    cy.get('#input-textField input').type('test');
    cy.get('#input-switch input').click();

    cy.get('p').should('have.length', 0);
    cy.get('#renderCount').contains('8');
  });
});
