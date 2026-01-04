describe('tabs', () => {
    it('activeKey', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--active-key&args=&viewMode=story');

        cy.get('.semi-tabs').contains('帮助').click();
        cy.get('.semi-tabs-pane-active').contains('帮助');
        cy.get('.semi-tabs').contains('关于').click();
        cy.get('.semi-tabs-pane-active').contains('关于');
    });

    it('tab list change', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--tab-list-change&args=&viewMode=story');
        cy.get('.semi-tabs').contains('帮助').click();
        cy.get('.semi-tabs-bar').should('have.length', 1);
    });

    it('current pane render', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--render-current-pane&args=&viewMode=story');
        cy.get('.semi-tabs-content').contains('文档');
        cy.get('.semi-tabs').contains('帮助').click();
        cy.get('.semi-tabs-content').contains('帮助');
        cy.get('.semi-tabs').contains('关于').click();
        cy.get('.semi-tabs-content').contains('关于');
    });

    it('collapse', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--collapse-tabs&args=&viewMode=story');
        cy.viewport(800, 1600);
        cy.get('.semi-tabs-content').eq(0).contains('Content of card tab 0');
        cy.get('.semi-button').eq(1).trigger('mouseover', { force: true });
        cy.get('.semi-dropdown').contains('Tab-6').click({ force: true });
        cy.get('.semi-tabs-content').eq(0).contains('Content of card tab 6');

        // Tab-10 visible
        cy.get('.semi-button').eq(0).click({ force: true });
        cy.get('.semi-tabs-tab').contains('Tab-10').click({ force: true });
        cy.get('.semi-tabs-content').eq(0).contains('Content of card tab 10');
    });

    it('keyboard test when the tabs is horizontal', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--disabled-tab&args=&viewMode=story');
        cy.get('[id=semiTab2]').click();
        cy.get('[id=semiTab2]').should('be.focused');

        cy.get('[id=semiTab2]').type('{rightArrow}');
        cy.get('[id=semiTab5]').should('be.focused');

        cy.get('[id=semiTab5]').type('{home}');
        cy.get('[id=semiTab1]').should('be.focused');

        cy.get('[id=semiTab1]').type('{leftArrow}');
        cy.get('[id=semiTab5]').should('be.focused');

        cy.get('[id=semiTab5]').type('{rightArrow}');
        cy.get('[id=semiTab1]').should('be.focused');

        cy.get('[id=semiTab1]').type('{end}');
        cy.get('[id=semiTab5]').should('be.focused');

        cy.get('[id=semiTab5]').type('{enter}');
        cy.get('[id=semiTab5]').realPress('Tab');
        cy.get("[id=semiTabPanel5]").should('be.focused');
    });

    it('keyboard test when the tabs is vertical', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--vertical-tabs&args=&viewMode=story');
        cy.get('[id=semiTab1]').click();
        cy.get('[id=semiTab1]').should('be.focused');

        cy.get('[id=semiTab1]').type('{downArrow}');
        cy.get('[id=semiTab2]').should('be.focused');

        cy.get('[id=semiTab2]').type('{upArrow}');
        cy.get('[id=semiTab1]').should('be.focused');
    });

    it('keyboard test when the tabs is closable', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--tab-closable&args=&viewMode=story');
        cy.get('[data-tabkey=semiTab1]').eq(0).click();
        cy.get('[data-tabkey=semiTab1]').eq(0).should('be.focused');

        cy.get('[data-tabkey=semiTab1]').eq(0).type('{backspace}');
        cy.get('[data-tabkey=semiTab1]').should('not.exist');
    });

    it('collapsible', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--fix-1456&args=&viewMode=story');

        // Ensure the correctness of the dropdown item after selection
        cy.get('[id=semiTab2]').click();
        cy.get('.semi-button').eq(1).trigger('mouseover');
        cy.get('.semi-dropdown-content .semi-dropdown-item').contains('tab-7').should('exist');
        cy.get('li span').contains('Tab-0').should('not.exist');
        
        cy.get('.semi-button').eq(1).trigger('mouseout');

        // Make sure that the state of the button does not change after vertical scrolling makes the tabs obscured
        cy.get('.semi-button').eq(2).click();
        cy.get('[id=wrapper]').scrollTo(0, 40);
        cy.get('.semi-button-disabled').eq(0).should('exist');
        cy.get('.semi-tabs-bar-arrow .semi-button-primary').eq(0).should('exist');
    });

    it.skip('activeTab is within the viewport after collapse Tabs did mount', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--collapse-scroll-into-view-demo&args=&viewMode=story');

        cy.wait(1000);
        cy.get('.semi-tabs-tab').contains('Tab-9').should('exist').and('be.visible');
    });

    it('showRestInDropdown', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tabs--show-rest-in-dropdown-demo&args=&viewMode=story');

        cy.get('.semi-button').eq(1).trigger('mouseover');
        cy.get('.semi-dropdown-content .semi-dropdown-item').should('not.exist');
    });
   
});