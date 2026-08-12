describe('useFieldArray', () => {
  it('should behaviour correctly without defaultValues', () => {
    cy.visit('http://localhost:3000/useFieldArray/normal');

    cy.get('#appendAsync').click();

    cy.focused().should('have.attr', 'id', 'field0');

    cy.get('ul > li').eq(0).get('input').should('have.value', 'appendAsync');

    cy.focused().should('have.attr', 'id', 'field0');

    cy.get('#prependAsync').click();

    cy.get('ul > li').eq(0).get('input').should('have.value', 'prependAsync');

    cy.get('#insertAsync').click();

    cy.focused().should('have.attr', 'id', 'field1');

    cy.get('#field1').should('have.value', 'insertAsync');

    cy.get('#swapAsync').click();

    cy.get('#field0').should('have.value', 'insertAsync');
    cy.get('#field1').should('have.value', 'prependAsync');

    cy.get('#moveAsync').click();

    cy.get('#field1').should('have.value', 'insertAsync');
    cy.get('#field0').should('have.value', 'prependAsync');

    cy.get('#updateAsync').click();

    cy.get('#field0').should('have.value', 'updateAsync');

    cy.get('#replaceAsync').click();

    cy.get('#field0').should('have.value', '12. lorem');
    cy.get('#field1').should('have.value', '12. ipsum');
    cy.get('#field2').should('have.value', '12. dolor');
    cy.get('#field3').should('have.value', '12. sit amet');

    cy.get('#removeAsync').click();

    cy.get('#resetAsync').click();

    cy.get('ul > li').should('not.exist');
  });
});
