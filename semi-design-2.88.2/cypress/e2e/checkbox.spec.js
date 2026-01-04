describe('checkbox', () => {
    it('checkbox tab test', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=checkbox--checkbox-group-demo&args=&viewMode=story');
        cy.get('.semi-checkbox').eq(0).click();
        cy.focused().realPress('Tab');
        cy.focused().type('{backspace}');
        cy.get('.semi-checkbox').eq(1).get('.semi-checkbox-checked');
        cy.focused().type('{backspace}');
        cy.get('.semi-checkbox').eq(1).get('.semi-checkbox-unChecked');
    });

    it('checkbox disable', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=checkbox--checkbox-default&args=&viewMode=story');
        cy.get('.semi-checkbox').eq(0).click();
        cy.focused().realPress('Tab');
        cy.focused().realPress('Tab');
        cy.focused().realPress('Tab');
        cy.get('.semi-checkbox-inner-display').eq(4).get('.semi-checkbox-focus');
    });

    it('checkbox card', () => { 
        cy.visit('http://127.0.0.1:6006/iframe.html?id=checkbox--checkbox-group-card-style&args=&viewMode=story');
        cy.get('.semi-checkbox').eq(0).click();
        cy.focused().realPress('Tab');
        cy.get('.semi-checkbox').eq(1).get('.semi-checkbox-focus');
        cy.get('.semi-checkbox-focus').eq(0).type('{backspace}');
        cy.get('.semi-checkbox-inner-display').eq(1).get('.semi-icon-checkbox_tick');
    });

    it('checkbox pureCard', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=checkbox--checkbox-group-pure-card-style&args=&viewMode=story');
        cy.get('.semi-checkbox').eq(0).click();
        cy.focused().realPress('Tab');
        cy.get('.semi-checkbox').eq(1).get('.semi-checkbox-focus');
        cy.get('.semi-checkbox-focus').eq(0).type('{backspace}');
        cy.get('.semi-checkbox-inner-display').eq(1).get('.semi-icon-checkbox_tick');
    });

});