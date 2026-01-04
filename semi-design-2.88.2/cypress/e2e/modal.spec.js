// modal.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('modal', () => {
    it('useModal', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--use-modal-demo&viewMode=story");
        cy.get(".semi-button").click();
        cy.get(".semi-modal-confirm-title-text").contains("old title");
        cy.get(".semi-modal-confirm-content").contains("old content");
        cy.wait(1000);
        cy.get(".semi-modal-confirm-title-text").contains("new title");
        cy.get(".semi-modal-confirm-content").contains("new content");
        cy.get(".semi-modal-footer .semi-button").last().contains("Confirm");
        cy.get(".semi-modal-header .semi-modal-close").click();
        cy.get(".semi-modal").should("not.exist");
    });

    it('useModal destroy', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--use-modal-destroy&viewMode=story");
        cy.get(".semi-button").click();
        cy.wait(1000);
        cy.get(".semi-modal").should("not.exist");
    });

    it('useModal afterClose', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--use-modal-after-close&viewMode=story");
        cy.get(".semi-button").click();
        cy.get(".semi-modal").should("not.exist");
        cy.get(".semi-tag").first().contains("true");
    });

    it('useModal FocusTrap', ()=>{
        cy.visit("http://localhost:6006/iframe.html?id=modal--default&viewMode=story");
        cy.get(".semi-button").click();
        cy.contains('取消').should('be.focused');
        cy.get('input').click();

        cy.get('input').realPress('Tab');
        cy.contains('hide dialog').should('be.focused');
        cy.contains('确定').focus();
        cy.contains('确定').realPress('Tab');

        cy.get('button[aria-label=close]').should('be.focused');
        // TODO: 
        // we need to remove cypress-plugin-tab cause it can't work with cypress v>10, we use cyress-real-event instead, but it didn't provide combine 
        // keyboard event in this time,
        // cy.get('button[aria-label=close]').tab({ shift: true });
        // cy.contains('确定').should('be.focused');
    });

    it('Full screen', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--full-screen&viewMode=story");
        // 测试 classname 为 .semi-modal-content-fullScreen 的高度和 classname 为 .semi-modal-mask 高度一致
        cy.get(".semi-button").click();
        cy.get('.semi-modal-content-fullScreen').then($content => {
            const contentHeight = $content[0].getBoundingClientRect().height;
            cy.get('.semi-modal-mask').then($mask => {
                const maskHeight = $mask[0].getBoundingClientRect().height;
                expect(contentHeight).to.be.equal(maskHeight); 
            });
        });
    });

    it('set height', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--set-height&viewMode=story");
        cy.get(".semi-button").click();
        cy.get('.semi-modal-content').then($content => {
            const contentHeight = $content[0].getBoundingClientRect().height;
            expect(contentHeight).to.be.equal(300);
        });
    });

    it('set height in style', () => {
        cy.visit("http://localhost:6006/iframe.html?id=modal--set-height-in-style&viewMode=story");
        cy.get(".semi-button").click();
        cy.get('.semi-modal-content').then($content => {
            const contentHeight = $content[0].getBoundingClientRect().height;
            expect(contentHeight).to.be.equal(300);
        });
    });
});
