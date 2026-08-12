describe('form setFocus', () => {
  it('should focus input', () => {
    cy.visit('http://localhost:3000/setFocus');
    cy.get('button:contains("Focus Input")').click();
    cy.get('input[name="focusInput"]').should('be.focused');
  });

  it('should select input content', () => {
    cy.visit('http://localhost:3000/setFocus');
    cy.get('button:contains("Select Input Content")').click();
    cy.get('input[name="selectInputContent"]')
      .type('New Value')
      .should('have.value', 'New Value');
  });

  it('should focus textarea', () => {
    cy.visit('http://localhost:3000/setFocus');
    cy.get('button:contains("Focus Textarea")').click();
    cy.get('textarea[name="focusTextarea"]').should('be.focused');
  });

  it('should select input content', () => {
    cy.visit('http://localhost:3000/setFocus');
    cy.get('button:contains("Select Textarea Content")').click();
    cy.get('textarea[name="selectTextareaContent"]')
      .type('New Value')
      .should('have.value', 'New Value');
  });
});
