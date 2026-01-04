describe('overflowList', () => {
    it('intersect', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=overflowlist--overlap-overflow-list&args=&viewMode=story');
        cy.viewport(500, 500);
        cy.get('.semi-tag').eq(0).contains('0');
        cy.get('.semi-tag').eq(1).contains('9');
        cy.get('.semi-overflow-list-scroll-wrapper').scrollTo('right');
        cy.get('.semi-tag').eq(0).contains('10');
    });

    // TODO: there is no problem with the local test, but it cannot pass the online test, so skip it first.
    // it.skip('resize', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=overflowlist--overflow-list-with-slide&args=&viewMode=story');
    //     cy.get('.semi-slider-handle')
    //         .trigger('mousedown', { which: 1 })
    //         .trigger('mousemove', { clientX: 100, clientY: 100 })
    //         .trigger('mouseup', { force: true });
    //     cy.get('.semi-tag').contains('+6');
    //     cy.get('.semi-slider-handle')
    //         .trigger('mousedown', { which: 1 })
    //         .trigger('mousemove', { clientX: 450, clientY: 100 })
    //         .trigger('mouseup', { force: true });
    //     cy.get('.semi-tag').contains('+2');
    // });
});