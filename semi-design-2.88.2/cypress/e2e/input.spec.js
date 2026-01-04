// input.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('input', () => {
    it('trigger password button', () => {
        cy.visit('http://localhost:6006/iframe.html?id=input--input-a-11-y&args=&viewMode=story');
        cy.get('[data-cy=password]').click();
        cy.get('[data-cy=password]').realPress('Tab');
        cy.get('.semi-input-modebtn').eq(0).should('be.focused');
        cy.get('.semi-input-modebtn').eq(0).type('{ }');
        cy.get('[data-cy=password]').should('have.value', 'Semi Design');
        cy.get('[data-cy=password]').realPress('Tab');
        cy.get('.semi-input-modebtn').eq(0).should('be.focused');
        cy.get('.semi-input-modebtn').eq(0).type('{enter}');
        cy.get('[data-cy=password]').should('have.value', 'Semi Design');
    });

    it('input--forward-ref-focus', () => {
        cy.visit('http://localhost:6006/iframe.html?id=input--forward-ref-focus&args=&viewMode=story');
        // 无 ref, 点击 prefix, suffix 是否聚集
        cy.get('.semi-input-wrapper').eq(0).children('.semi-input-prefix').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('not.be.focused');

        cy.get('.semi-input-wrapper').eq(0).children('.semi-input-suffix').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(0).children('input').should('not.be.focused');

        // 对象式 ref，点击 prefix, suffix 是否聚集， 通过 ref 调用是否聚焦
        cy.get('.semi-input-wrapper').eq(1).children('.semi-input-prefix').click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('not.be.focused');

        cy.get('.semi-input-wrapper').eq(1).children('.semi-input-suffix').click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('not.be.focused');

        cy.get('.semi-button').eq(0).click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(1).children('input').should('not.be.focused');


        // 函数式 ref，点击 prefix, suffix 是否聚集， 通过 ref 调用是否聚焦
        cy.get('.semi-input-wrapper').eq(2).children('.semi-input-prefix').click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('not.be.focused');

        cy.get('.semi-input-wrapper').eq(2).children('.semi-input-suffix').click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('not.be.focused');

        cy.get('.semi-button').eq(1).click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('be.focused');
        cy.get('body').click();
        cy.get('.semi-input-wrapper').eq(2).children('input').should('not.be.focused');
    });

    it('input autofocus should focus to text end', () => {
        cy.visit('http://localhost:6006/iframe.html?args=&id=input--fix-input-auto-focus&viewMode=story');
        cy.wait(300);
        cy.window().then(window => {
            const inputStr = window.document.body.querySelector('.semi-input').value.length;
            const count = inputStr.length;
            cy.get('div[data-cy=start]').should('contain.text', inputStr);
            cy.get('div[data-cy=end]').should('contain.text', inputStr);
        });
    });
});
