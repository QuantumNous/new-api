describe('scrollList', () => {
    it('scroll to the specified position after clicking', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=scrolllist--scroll-list-simple&args=&viewMode=story');
        cy.get('.semi-scrolllist-item-sel').contains('1');
        cy.get('.semi-scrolllist-item').contains('5').click();
        cy.get('.semi-scrolllist-item-sel').contains('5');
    });

    // todo: due to the https://github.com/DouyinFE/semi-design/pull/2723, temporarily skip this test case
    // it.skip('infinite scroll', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=scrolllist--single-scroll-list&args=&viewMode=story');
    //     cy.wait(500);
    //     cy.get('li[aria-selected="true"]').contains(0);
    //     cy.get('.semi-scrolllist-item-wheel .semi-scrolllist-list-outer').scrollTo('right', { duration: 2000 });
    //     cy.wait(1000);
    //     cy.get('.semi-scrolllist-item-wheel .semi-scrolllist-list-outer').scrollTo('top', { duration: 2000 });
    //     cy.wait(500);
    //     cy.get('.semi-scrolllist-item-wheel .semi-scrolllist-list-outer').scrollTo('bottom', { duration: 2000 });
    // });

    // todo: due to the https://github.com/DouyinFE/semi-design/pull/2723, temporarily skip this test case
    // it.skip('click options', () => {
    //     // cy.visit('http://127.0.0.1:6006/iframe.html?id=scrolllist--single-scroll-list&args=&viewMode=story');
    //     // cy.get('li[aria-selected="true"]').contains(0);
    //     // cy.get('.semi-scrolllist-list-outer').contains(59).click();
    //     // cy.get('li[aria-selected="true"]').contains(0);
    // });
});