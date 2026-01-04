describe('autoComplete', () => {

    it('key press', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=autocomplete--basic-usage&args=&viewMode=story');

        cy.wait(400);
        cy.realPress("Tab");

        cy.get('input').type('123');
        // open panel
        cy.get('input').type('{enter}');
        cy.get('.semi-popover');

        // close panel
        cy.get('input').type('{enter}');
        cy.get('.semi-popover').should('not.exist');
        cy.get('input').should('have.value', '123');
    
        // test downArrow and upArrow
        cy.get('input').type('{enter}');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{upArrow}');
        cy.get('input').type('{esc}');
        cy.get('input').should('have.value', '123');

        // test downArrow when panel hidden
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{enter}');
        cy.get('input').should('have.value', '123@gmail.com');

        // test upArrow when panel hidden
        cy.get('input').type('{upArrow}');
        cy.get('input').type('{upArrow}');
        cy.get('input').type('{enter}');
        cy.get('input').should('have.value', '123@qq.com');

        cy.get('input').trigger('mouseover');
        cy.get('.semi-input-clearbtn').click();
        cy.root().click('right');
        cy.get('input').should('have.value', '');

        // // test enter
        // cy.get('input').click();
        // cy.get('input').type('456');
        // cy.get('input').type('{downArrow}');
        // cy.get('input').type('{enter}');
        // cy.get('#root').click('right');
        // cy.get('input').should('have.value', '456@gmail.com');
    });

    it('mouse over option ', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=autocomplete--basic-usage&args=&viewMode=story');
        cy.get('input').type('123');
        cy.get('.semi-portal').contains('123@163.com').trigger('mouseover');
        cy.get('input').type('{downArrow}');
        cy.get('input').type('{enter}');
        cy.get('input').should('have.value', '123@qq.com');
    });

    it('click outer side handler', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=autocomplete--basic-usage&args=&viewMode=story');
        cy.get('input').type('123');
        cy.get('.semi-portal').contains('123@163.com');
        cy.get('body').click();
        cy.get('.semi-portal').should('not.exist');
    });

});