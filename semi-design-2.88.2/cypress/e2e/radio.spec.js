describe('radio', () => {
    // TODO: Check if the following test cases are necessary
    // it('radio with extra', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=radio--radio-with-extra&args=&viewMode=story');
    //     cy.get('body').tab();
    //     cy.get('.semi-radio').eq(0).click();
    // });

    it('radio extra click', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=radio--radio-with-extra&args=&viewMode=story');
        cy.get('.semi-radio').eq(0).click();
        cy.wait(100);
        cy.focused().realPress('Tab');
        cy.get('input').eq(1).type('{backspace}');
        cy.get('.semi-radio').eq(1).get('.semi-radio-inner-checked');
    });

    it('radio type button', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=radio--radio-group-button-style&args=&viewMode=story');
        cy.get('.semi-radio-buttonRadioGroup-small').eq(0).click();
        cy.focused().type('{downArrow}');
        cy.wait(100);
        cy.get('.semi-radio-buttonRadioGroup-small').eq(1).get('.semi-radio-inner-checked');
    });

    it('radio mode advance', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=radio--radio-with-advanced-mode&args=&viewMode=story');
        cy.get('.semi-radio').click();
        cy.focused().type('{backspace}');
        cy.get('svg').should('not.exist');
    });

    it('radio group advance', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=radio--radio-group-with-advanced-mode&args=&viewMode=story');
        cy.get('.semi-radio').eq(0).click();
        cy.focused().type('{backspace}');
        cy.get('.semi-radio').eq(0).get('.semi-radio-inner-checked').click();
    });
});