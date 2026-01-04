describe('timePicker', () => {
    it.skip('select', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=timepicker--range-picker&args=&viewMode=story');
        cy.get('.semi-input').eq(0).click();
        cy.wait(500);
        cy.get('.semi-timepicker-panel-list-hour').contains('23').click();
        cy.get('.semi-timepicker-panel-list-minute').eq(0).contains('59').click();
        cy.get('.semi-timepicker-panel-list-second').eq(0).contains('59').click();
        cy.get('.semi-timepicker-panel-list-hour .semi-scrolllist-item-selected').contains('23');
        // todo: item-selected class ?
        cy.get('.semi-timepicker-panel-list-minute').contains('59');
        cy.get('.semi-timepicker-panel-list-second').contains('59');

        cy.get('.semi-input').eq(4).click();
        cy.wait(500);
        cy.get('.semi-timepicker-panel-list-ampm').contains('下午').click();
        cy.get('.semi-timepicker-panel-list-hour').eq(0).contains('09').click();
        cy.get('.semi-timepicker-panel-list-minute').eq(0).contains('09').click();
        cy.get('.semi-timepicker-panel-list-ampm .semi-scrolllist-item-sel').contains('下午');
        cy.get('.semi-timepicker-panel-list-hour .semi-scrolllist-item-sel').contains('09');
        cy.get('.semi-timepicker-panel-list-minute .semi-scrolllist-item-sel').contains('09');

        cy.get('.semi-timepicker-panel-list-ampm').contains('上午').click();
        cy.get('.semi-timepicker-panel-list-hour').eq(0).contains('10').click();
        cy.get('.semi-timepicker-panel-list-minute').eq(0).contains('10').click();
        cy.get('.semi-timepicker-panel-list-ampm .semi-scrolllist-item-sel').contains('上午');
        cy.get('.semi-timepicker-panel-list-hour .semi-scrolllist-item-sel').contains('10');
        cy.get('.semi-timepicker-panel-list-minute .semi-scrolllist-item-sel').contains('10');

    });

    it('clear', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=timepicker--range-picker&args=&viewMode=story');
        cy.get('.semi-input').eq(1).click();
        cy.wait(500);

        cy.get('.semi-input').eq(1).trigger('mouseover');
        cy.get('.semi-input-clearbtn').click();
        cy.get('.semi-input').eq(1).should('have.value', '');
    });

    it('custom trigger', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=timepicker--custom-trigger&args=&viewMode=story');
        cy.get('.semi-button-content').click();
        cy.wait(500);
        cy.get('.semi-timepicker-panel').should('exist');
        cy.get('.semi-timepicker-panel-list-hour').scrollTo('top');
        cy.root().trigger('mousedown', 'right');
        cy.wait(500);
        cy.get('.semi-timepicker-panel').should('not.exist');
    });

    it('blur', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=timepicker--time-picker-panel-default&args=&viewMode=story');
        cy.get('.semi-input-default').eq(1).click(); 
        cy.get('body').click('right');
        cy.get('.semi-input-default').eq(1).should('have.value', '10:24:18');

        cy.get('.semi-input-default').eq(1).type('10:24:181');
        // cy.get('.semi-input-wrapper-error');
        cy.get('body').click('right');
        cy.get('.semi-input-default').eq(1).should('have.value', '10:24:18');
    });

    it('timezone + disabledHours', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=timepicker--fix-2082&args=&viewMode=story');
        cy.get('.semi-input-default').eq(0).click();
        cy.get('.semi-timepicker-panel-list-hour').eq(0).contains('07').click({ force: true });
        cy.get('.semi-timepicker-panel-list-minute').eq(0).contains('10').click({ force: true });
        cy.get('body').click('right');
        cy.get('.semi-input-default').eq(0).should('have.value', '07:10');
    });
});