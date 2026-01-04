describe('anchor', () => {
    it.skip('show tooltip', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=anchor--show-tooltip&args=&viewMode=story');
        cy.get('.semi-anchor-link').contains('工具提示是一个有用的工具').trigger('mouseover');
        cy.get('.semi-portal').contains('工具提示是一个有用的工具');
        cy.get('.semi-anchor-link').eq(9).contains('工具提示是一个有用的工具').trigger('mouseover');
        cy.get('.semi-portal div[x-placement="right"]').contains('工具提示是一个有用的工具');
    });

    it('key press', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=anchor--style-position&args=&viewMode=story');
        cy.get('.semi-anchor-link').contains('contact').type('{upArrow}').type('{enter}');
        cy.get('h1').contains('Contact me').click();
    });

    it('scroll', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=anchor--target-offset&args=&viewMode=story');
        cy.get('#box').scrollTo('bottom');
        cy.get('.semi-anchor-link-title-active').contains('doc1');
        cy.wait(500);
        cy.get('#box').scrollTo('top');
        cy.get('h1').contains('whatever').click({ force: true });
    });

    it('click', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=anchor--target-offset&args=&viewMode=story');
        cy.get('.semi-anchor-link').contains('api too much').click();
        cy.get('#api').contains('API').click();
    });

    it('auto collapse', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=anchor--auto-collapse&args=&viewMode=story');
        cy.get('#collapse .semi-anchor-link').contains('组件').should('not.exist');
        cy.get('#collapse .semi-anchor-link').contains('Semi Design').click();
        cy.get('#collapse .semi-anchor-link').contains('组件').should('have.length', 1);
        cy.get('#collapse .semi-anchor-link').contains('物料').should('have.length', 1);
        cy.get('#collapse .semi-anchor-link').contains('主题商店').should('have.length', 1);

        cy.get('#no-collapse .semi-anchor-link').contains('组件').should('have.length', 1);
        cy.get('#no-collapse .semi-anchor-link').contains('Avatar').should('have.length', 1);
        cy.get('#no-collapse .semi-anchor-link').contains('Button').should('have.length', 1);
        cy.get('#no-collapse .semi-anchor-link').contains('Icon').should('have.length', 1);
    });
});