// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('notification', () => {
    it('useNotification', () => {
        cy.visit("http://localhost:6006/iframe.html?id=notification--use-notification-demo&args=&viewMode=story");
        cy.get('.semi-button').click();
        cy.get('[data-cy=notice-container] .semi-notification-notice').should("have.length", 5);
        // addNotice 返回 id 是固定的，等待代码修改
        // cy.wait(1000);
        // cy.get('[data-cy=notice-container] .semi-notification-notice .semi-notification-notice-icon-close').first().click();
        // cy.get('[data-cy=notice-container] .semi-notification-notice').should("have.length", 4);
    });
});