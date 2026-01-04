describe('breadcrumb', () => {
    it('moreType + maxItemCount', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=breadcrumb--max-item-count-and-more-type&args=&viewMode=story');
        cy.get('.semi-breadcrumb-item-more').trigger('mouseover');
        cy.get('.semi-popover-content').children('.semi-breadcrumb-item-wrap').should('have.length', 2);
    });
});