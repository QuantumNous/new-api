describe('form setValueAsyncStrictMode', () => {
  it('should set async input value correctly', () => {
    cy.visit('http://localhost:3000/setValueAsyncStrictMode');

    cy.wait(100);

    cy.get('#submit').click();

    cy.get('p').contains('["test","A","B","C","D"]');
  });
});
