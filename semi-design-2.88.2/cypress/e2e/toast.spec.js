// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('toast', () => {
    it('useToast', () => {
        cy.visit("http://localhost:6006/iframe.html?id=toast--use-toast-demo&args=&viewMode=story");
        cy.get('.semi-button').click();
        cy.get('[data-cy=context-holder] .semi-toast').contains("ReachableContext: Light");
        cy.get('[data-cy=context-holder] .semi-toast').should("have.length", 5);
        cy.wait(200);
        cy.get('[data-cy=context-holder] .semi-toast').should("have.length", 4);
        cy.get('[data-cy=context-holder] .semi-toast .semi-toast-close-button .semi-button').first().click();
        cy.wait(200);
        cy.get('[data-cy=context-holder] .semi-toast').should("have.length", 3);
    });
});