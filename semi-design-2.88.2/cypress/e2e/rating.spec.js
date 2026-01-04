describe('rating', () => {
    it('radio with extra', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=rating--tooltip-rating&args=&viewMode=story');
        // test down & right arrow
        cy.get('.semi-rating-star-second').eq(3).click();
        cy.get('#rating-result').contains('good');
        cy.get('.semi-rating-star-second').eq(3).type('{upArrow}');
        cy.get('#rating-result').contains('wonderful');
        cy.get('.semi-rating-star-second').eq(4).type('{upArrow}');
        cy.get('#rating-result').should('not.exist');
        cy.get('.semi-rating-star-second').eq(5).type('{rightArrow}', { force: true });
        cy.get('#rating-result').contains('terrible');
        // test left & up Arrow
        cy.get('.semi-rating-star-second').eq(1).click();
        cy.get('#rating-result').contains('bad');
        cy.get('.semi-rating-star-second').eq(1).type('{leftArrow}');
        cy.get('#rating-result').contains('terrible');
        cy.get('.semi-rating-star-second').eq(0).type('{downArrow}');
        cy.get('#rating-result').should('not.exist');

    });

    it('autoFocus',  () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=rating--auto-focus&args=&viewMode=story');
        cy.get('.semi-rating-star-second').eq(1).should('be.focused');
        cy.get('.semi-rating-star-second').eq(1).type('{upArrow}');
        cy.get('.semi-rating-star-second').eq(2).should('be.focused');
        cy.get('.semi-rating-star-second').eq(2).type('{downArrow}');
        cy.get('.semi-rating-star-second').eq(1).should('be.focused');
    });
});