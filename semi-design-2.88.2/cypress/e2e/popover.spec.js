// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('popover', () => {
    it('trigger=click + keyboard', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=click]').click();
        cy.get('[data-cy=click]').type('{downArrow}');
        cy.get('[data-cy=pop-focusable-first]').should('be.focused');
        cy.get('[data-cy=pop-focusable-first]').type('{esc}');
        cy.get('[data-cy=click]').should('be.focused');
        cy.get('[data-cy=click]').click();
        cy.get('[data-cy=click]').type('{upArrow}');
        cy.get('[data-cy=pop-focusable-last]').should('be.focused');
    });

    /**
     * electron failed
     * @see https://github.com/cypress-io/cypress/issues/20878
     */
    it.skip('trigger=hover + keyboard', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=hover]').trigger('focus');
        cy.get('[data-cy=hover]').type('{downArrow}');
        cy.get('[data-cy=pop-focusable-first]').should('be.focused');
        cy.get('[data-cy=pop-focusable-first]').type('{esc}');
        cy.get('[data-cy=hover]').trigger('focus');
        cy.get('[data-cy=hover]').type('{upArrow}');
        cy.get('[data-cy=pop-focusable-last]').should('be.focused');
    });

    /**
     * electron failed
     * @see https://github.com/cypress-io/cypress/issues/20878
     */
    it.skip('trigger=focus + keyboard', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=focus]').trigger('focus');
        cy.get('[data-cy=focus]').type('{downArrow}');
        cy.get('[data-cy=pop-focusable-first]').should('be.focused');
        cy.get('[data-cy=pop-focusable-first]').type('{esc}');
        cy.get('[data-cy=focus]').trigger('focus');
        cy.get('[data-cy=focus]').type('{upArrow}');
        cy.get('[data-cy=pop-focusable-last]').should('be.focused');
    });

    /**
     * electron failed
     * @see https://github.com/cypress-io/cypress/issues/20878
     */
    it.skip('trigger=custom + keyboard', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=custom]').trigger('click');
        cy.get('[data-cy=custom]').type('{downArrow}');
        cy.get('[data-cy=pop-focusable-first]').should('be.focused');
        cy.get('[data-cy=pop-focusable-first]').type('{esc}');
        cy.get('[data-cy=custom]').trigger('click');
        cy.get('[data-cy=custom]').type('{upArrow}');
        cy.get('[data-cy=pop-focusable-last]').should('be.focused');
    });

    it('trigger=click + focus guard', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=click]').click();
        cy.get('[data-cy=click]').type('{upArrow}');
        cy.get('[data-cy=pop]').trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'Tab' });
        cy.get('[data-cy=pop-focusable-first]').should('be.focused');
        cy.get('[data-cy=pop]').trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'Tab', shiftKey: true });
        cy.get('[data-cy=pop-focusable-last]').should('be.focused');
    });

    it('trigger=click + init focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=initial-focus]').click({ force: true });
        cy.get('[data-cy=initial-focus-input]').should('be.focused');
    });

    it('trigger=click + closeOnEsc=false', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=closeOnEsc-false]').click({ force: true });
        cy.get('[data-cy=closeOnEsc-false]').type('{esc}');
        cy.get('[data-cy=pop]').should('be.visible');
    });

    it('trigger=click + returnFocusOnClose=false', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--a-11-y-keyboard&args=&viewMode=story');
        cy.get('[data-cy=returnFocusOnClose-false]').click({ force: true });
        cy.get('[data-cy=returnFocusOnClose-false]').type('{downArrow}');
        cy.get('[data-cy=pop-focusable-first]').type('{esc}', { force: true });
        cy.get('[data-cy=returnFocusOnClose-false]').should('not.be.focused');
    });

    it('click select option in popover ', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popover--fix-nested-popover&args=&viewMode=story');
        cy.get('[data-cy=fix-nested-popover] .semi-tag').click();
        cy.get('[data-cy=select-in-popover] .semi-select').click();
        cy.get('[data-cy=select-in-popover] .semi-select').click();
        cy.get('.semi-select-option').contains('西瓜视频').click();
        cy.get('[data-cy=select-in-popover] .semi-select').should('be.visible');
        cy.get('.semi-select-option-list ').should('be.not.exist');
    });
});