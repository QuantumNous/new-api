// inputNumber.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('inputNumber', () => {
    it('fix precision delete bug', () => {
        cy.visit('http://localhost:6006/iframe.html?id=inputnumber--fix-precision-786&viewMode=story');
        cy.get('[data-cy=fix-precision-786] .semi-input').click().clear();
        cy.get('[data-cy=fix-precision-786] .semi-input').type('aaa');
        cy.get('[data-cy=fix-precision-786] .semi-input').blur();
        cy.get('[data-cy=fix-precision-786] .semi-input').should('have.value', '');
    });

    it('a11y', () => {
        cy.visit('http://localhost:6006/iframe.html?id=inputnumber--input-number-a-11-y&args=&viewMode=story');
        cy.get('input[data-cy=default]').click();
        cy.get('input[data-cy=default]').type('{upArrow}');
        cy.get('input[data-cy=default]').should('have.value', '1');
        cy.get('input[data-cy=default]').trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'upArrow', keyCode: 38, shiftKey: true });
        cy.get('input[data-cy=default]').should('have.value', '11');
        cy.get('input[data-cy=default]').type('{downArrow}');
        cy.get('input[data-cy=default]').should('have.value', '10');

        cy.get('input[data-cy=step]').click();
        cy.get('input[data-cy=step]').type('{upArrow}');
        cy.get('input[data-cy=step]').should('have.value', '5');
        cy.get('input[data-cy=step]').trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'upArrow', keyCode: 38, shiftKey: true });
        cy.get('input[data-cy=step]').should('have.value', '105');
        cy.get('input[data-cy=step]').trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'downArrow', keyCode: 40, shiftKey: true });
        cy.get('input[data-cy=step]').should('have.value', '5');
    });

    it('click prefix/suffix to focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=inputnumber--prefix-suffix&args=&viewMode=story');
        cy.get('.semi-input-wrapper').eq(0).children('.semi-input-prefix').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('not.be.focused');

        cy.get('.semi-input-wrapper').eq(0).children('.semi-input-suffix').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('not.be.focused');
    });

    it('fixed formatter error in controlled mode', () => {
        cy.visit('http://localhost:6006/iframe.html?id=inputnumber--fix-1772&viewMode=story');
        cy.get('.semi-input-number .semi-input').should('have.value', '60000');
        cy.get('.semi-input-number .semi-input-number-button-up').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60001');
        cy.get('.semi-input-number .semi-input-number-button-up').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60002');
        cy.get('.semi-input-number .semi-input-number-button-down').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60001');
        cy.get('.semi-input-number .semi-input-number-button-down').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60000');
    });

    it('fixed formatter error in controlled mode + focus and click add button', () => {
        cy.visit('http://localhost:6006/iframe.html?id=inputnumber--fix-1772&viewMode=story');
        cy.get('.semi-input-number .semi-input').should('have.value', '60000');
        cy.get('.semi-input-number .semi-input').click();
        cy.get('.semi-input-number .semi-input-number-button-up').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60001');
        cy.get('.semi-input-number .semi-input-number-button-up').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60002');
        cy.get('.semi-input-number .semi-input-number-button-down').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60001');
        cy.get('.semi-input-number .semi-input-number-button-down').click();
        cy.get('.semi-input-number .semi-input').should('have.value', '60000');
    });
});