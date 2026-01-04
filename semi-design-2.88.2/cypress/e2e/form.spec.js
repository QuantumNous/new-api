// form.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

/**
 * why use `.then`?
 * @see https://docs.cypress.io/guides/core-concepts/variables-and-aliases#Return-Values
 */
describe('Form', () => {
    it('formApi-setValue with array field path, 3 -> 2, remove middle line field', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/form--use-form-api-set-value-update-array');
        cy.get(':nth-child(3) > .semi-button').click();
        // line 1
        cy.get('[x-field-id="effects[0].name"] > .semi-form-field-main > .semi-input-wrapper > input').should('have.value', '1-name');
        cy.get('[x-field-id="effects[0].type"] > .semi-form-field-main > .semi-input-wrapper > input').should('have.value', '1-type');
        // line 2
        cy.get('[x-field-id="effects[1].name"] > .semi-form-field-main > .semi-input-wrapper > input').should('have.value', '3-name');
        cy.get('[x-field-id="effects[1].type"] > .semi-form-field-main > .semi-input-wrapper > input').should('have.value', '3-type');
        // cy.get('body').find('.semi-popover .semi-datepicker').should('have.length', 0);
    });
});