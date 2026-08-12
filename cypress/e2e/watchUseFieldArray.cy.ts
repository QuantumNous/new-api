describe('watchUseFieldArray', () => {
  it('should behaviour correctly when watching the field array', () => {
    cy.visit('http://localhost:3000/watch-field-array/normal');

    cy.get('#append').click();
    cy.get('#result').contains('[{"name":"2"}]');

    cy.get('#field0').type('test');
    cy.get('#result').contains('[{"name":"2test"}]');

    cy.get('#prepend').click();
    cy.get('#result').contains('[{"name":"8"},{"name":"2test"}]');

    cy.get('#append').click();
    cy.get('#append').click();
    cy.get('#append').click();
    cy.get('#update').click();
    cy.get('#result').contains(
      '[{"name":"8"},{"name":"2test"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    cy.get('#swap').click();
    cy.get('#result').contains(
      '[{"name":"8"},{"name":"10"},{"name":"2test"},{"name":"updated value"},{"name":"14"}]',
    );

    cy.get('#move').click();
    cy.get('#result').contains(
      '[{"name":"2test"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    cy.get('#insert').click();
    cy.get('#result').contains(
      '[{"name":"2test"},{"name":"22"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    cy.get('#remove').click();
    cy.get('#result').contains(
      '[{"name":"2test"},{"name":"8"},{"name":"10"},{"name":"updated value"},{"name":"14"}]',
    );

    cy.get('#removeAll').click();
    cy.get('#result').contains('[]');
    cy.get('#renderCount').contains('28');
  });

  it('should return empty when items been removed and defaultValues are supplied', () => {
    cy.visit('http://localhost:3000/watch-field-array/default');

    cy.get('#delete0').click();
    cy.get('#delete0').click();
    cy.get('#delete0').click();

    cy.get('#result').contains('[]');
  });
});
