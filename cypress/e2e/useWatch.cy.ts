describe('useWatch', () => {
  it('should only trigger render when interact with input 1', () => {
    cy.visit('http://localhost:3000/useWatch');
    cy.get('input[name="test"]').type('t');

    cy.get('#parentCounter').contains('2');
    cy.get('#childCounter').contains('2');
    cy.get('#grandChildCounter').contains('3');
    cy.get('#grandChild1Counter').contains('3');
    cy.get('#grandChild2Counter').contains('3');
    cy.get('#grandchild01').contains('t');
    cy.get('#grandchild00').contains('t');

    cy.get('input[name="test"]').type('h');
    cy.get('#grandchild00').contains('th');
    cy.get('#grandchild01').contains('th');
    cy.get('#grandchild2').contains('t');
  });

  it('should only trigger render when interact with input 2', () => {
    cy.visit('http://localhost:3000/useWatch');
    cy.get('input[name="test1"]').type('h');

    cy.get('#parentCounter').contains('2');
    cy.get('#childCounter').contains('2');
    cy.get('#grandChildCounter').contains('3');
    cy.get('#grandChild1Counter').contains('3');
    cy.get('#grandChild2Counter').contains('3');

    cy.get('input[name="test1"]').type('h');
    cy.get('input[name="test"]').type('h');
    cy.get('#grandchild00').contains('h');
    cy.get('#grandchild01').contains('h');
    cy.get('#grandchild1').contains('hh');
    cy.get('#grandchild2').contains('hhh');
  });

  it('should only trigger render when interact with input 3', () => {
    cy.visit('http://localhost:3000/useWatch');
    cy.get('input[name="test2"]').type('e');

    cy.get('#parentCounter').contains('2');
    cy.get('#childCounter').contains('2');
    cy.get('#grandChildCounter').contains('3');
    cy.get('#grandChild1Counter').contains('3');
    cy.get('#grandChild2Counter').contains('3');

    cy.get('input[name="test2"]').type('eh');

    cy.get('input[name="test1"]').type('eh');
    cy.get('input[name="test"]').type('eh');
    cy.get('#grandchild00').contains('eh');
    cy.get('#grandchild01').contains('eh');
    cy.get('#grandchild1').contains('eh');
    cy.get('#grandchild2').contains('eheheeh');
  });
});
