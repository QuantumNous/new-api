describe('calendar', () => {
    it('event render', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=calendar--event-render&args=&viewMode=story');
        
        // check the week col event
        cy.get('.semi-calendar-event-item').contains('7月23日 8:32');

        // check the day col and click event
        cy.get('.semi-radio-inner-display').eq(0).click({ force: true });
        cy.get('.semi-calendar-event-item').contains('7月23日 8:32');
        cy.get('li[data-time="01:30:00"]').click({ force: true });
        cy.get('div').contains('当前点击的日期是23号');

        cy.get('.semi-radio-inner-display').eq(2).click({ force: true });
        // test show card and hide
        cy.get('div').contains('还有3项').eq(0).click({ force: true });
        cy.get('.semi-calendar-month-event-card');
        cy.get('body').click('right');
        cy.get('.semi-calendar-month-event-card').should('not.exist');

        cy.get('div').contains('还有3项').eq(0).click({ force: true });
        cy.wait(100);
        cy.get('.semi-calendar-month-event-card-close').click({ force: true });
        cy.get('.semi-calendar-month-event-card').should('not.exist');

        cy.get('.semi-radio-inner-display').eq(3).click({ force: true });
        cy.get('li[data-time="09:30:00"]').eq(1).click({ force: true });
        cy.get('div').contains('当前点击的日期是24号');
    });

    it('month event render', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=calendar--month-event-render&args=&viewMode=story');
        cy.get('.eventDay').should('have.length', 7);
    })
});