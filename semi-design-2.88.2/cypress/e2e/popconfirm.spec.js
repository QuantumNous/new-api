// popConfirm.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('popConfirm', () => {
    it('confirm focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--keyboard-and-focus&args=&viewMode=story');
        cy.get('[data-cy=initial-focus-confirm]').click();
        cy.get('.semi-popconfirm-footer .semi-button').eq(1).should('be.focused');
        cy.get('.semi-popconfirm-footer .semi-button').eq(1).click();
        // return focus to trigger
        cy.get('[data-cy=initial-focus-confirm] .semi-button').should('be.focused');
    });

    it('cancel focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--keyboard-and-focus&args=&viewMode=story');
        cy.get('[data-cy=initial-focus-cancel]').click();
        cy.get('.semi-popconfirm-footer .semi-button').eq(0).should('be.focused');
        cy.get('.semi-popconfirm-footer .semi-button').eq(0).click();
        cy.get('[data-cy=initial-focus-cancel] .semi-button').should('be.focused');
    });

    it('content focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--keyboard-and-focus&args=&viewMode=story');
        cy.get('[data-cy=initial-focus-content]').click();
        cy.get('.semi-popconfirm-body input').eq(0).should('be.focused');
        cy.get('.semi-popconfirm-header .semi-button').eq(0).click();
        cy.get('[data-cy=initial-focus-content] .semi-button').should('be.focused');
    });

    it('content esc keydown-1', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--esc-key-down&viewMode=story');
        cy.get('[data-cy=content]').click();
        cy.get('.test-ok').type('{esc}');
        cy.get('.test-ok').should('not.exist');
    });

    it('content esc keydown-2', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--esc-key-down&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.get('[data-cy=trigger]').click();
        cy.get('.test-text').click();
        cy.get('@consoleLog').should('be.calledWith', 'clicked');
        cy.get('.test-text').type('{esc}');
        cy.get('.test-ok').should('not.exist');
    });

    it('onConfirm promise', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--promise-callback&viewMode=story');
        cy.get('.semi-button').click();
        cy.get('.semi-button').contains('确定').click();
        cy.get('.semi-button-loading').contains('确定');
        cy.wait(2000);
        cy.get('.semi-button-loading').should('not.exist');
    });

    it('onCancel promise', () => {
        cy.visit('http://localhost:6006/iframe.html?id=popconfirm--promise-callback&viewMode=story');
        cy.get('.semi-button').click();
        cy.get('.semi-button').contains('取消').click();
        cy.wait(2000);
        cy.get('.semi-button-loading').should('not.exist');;
    });
});