describe('tree', () => {
    it('clear search value', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tree--searchable-tree&args=&viewMode=story');
        
        // type riben and expect riben node to expand
        cy.get('input').eq(0).type('riben');
        cy.get('.semi-tree-option-label-text').contains('日本');

        // clear value and expect all nodes to unexpand
        cy.get('input').eq(0).trigger('mouseover');
        cy.get('.semi-input-clearbtn').click();
        cy.get('.semi-tree-option-label-text').contains('日本').should('not.exist');
        cy.get('.semi-tree-option-label-text').contains('中国').should('not.exist');
    });

    it('load data', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tree--loading&args=&viewMode=story');

        cy.get('.semi-tree-option-label-text').contains('Child Node').should('not.exist');

        cy.get('.semi-icon-tree_triangle_down').eq(0).click();
        cy.wait(1000);
        cy.get('.semi-tree-option-label-text').contains('Child Node');
    });

    it('filter data', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tree--dynamic-tree-data-with-search-value-and-controlled-expand&args=&viewMode=story');
        
        cy.get('.semi-tree-option-expand-icon').should('not.exist');
        cy.get('input').eq(0).type('0-0');
        cy.get('button').contains('动态改变数据').click();
        cy.get('.semi-tree-option-expand-icon');
    });

    it("unRelated + async load", () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tree--un-related-and-async-load&args=&viewMode=story');
        cy.get('.semi-checkbox').eq(0).get('.semi-checkbox-inner-checked').should("exist");
        cy.get('.semi-icon-tree_triangle_down').eq(0).trigger('click');
        // sync load, 1000ms
        cy.wait(1000);
        cy.get('.semi-checkbox').eq(0).get('.semi-checkbox-inner-checked').should("exist");
    });

});