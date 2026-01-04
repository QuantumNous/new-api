
function typeTextAtPosition(lineNumber, column, text) {
    let rightArrow = '{rightArrow}';
    let leftArrow = '{leftArrow}';
    for (let i = 0; i < column - 1; i++) {
        rightArrow += '{rightArrow}';
    }
    if (lineNumber === 1) {
        cy.get('.lines-content').children().eq(0).type(`${leftArrow}${rightArrow}${text}`);
    } else {
        cy.get('.lines-content').children().eq(lineNumber - 2).type(`${rightArrow}${text}`);
    }
}

function undo(times) {
    let z = '{meta+z}';

    for (let i = 0; i < times - 1; i++) {
        z += '{meta+z}';
    }
    cy.get('.lines-content').type(z);
}

function redo(times) {
    let z = '{meta+shift+z}';

    for (let i = 0; i < times - 1; i++) {
        z += '{meta+shift+z}';
    }
    cy.get('.lines-content').type(z);
}

describe('jsonViewer', () => {
    it('scroll to bottom', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/jsonviewer--default-json-viewer');
        cy.get('.json-viewer-container').scrollTo('bottom');
        cy.get('.lines-content').children().last().should('have.attr', 'data-line-number', '36');
    });

    it('scroll to top', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/jsonviewer--default-json-viewer');
        cy.get('.json-viewer-container').scrollTo('top');
        cy.get('.lines-content').children().first().should('have.attr', 'data-line-number', '1');
    });

    it('fold', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/jsonviewer--default-json-viewer');
        cy.get('.line-scroll-container').trigger('mouseover', { which: 1 });
        cy.get('.semi-json-viewer-line-number[data-line-number="1"]').children().should('have.length', 2);
        cy.get('.semi-json-viewer-line-number[data-line-number="1"]').children().eq(1).click();
        cy.get('.lines-content').children().should('have.length', 2);
        cy.get('.lines-content').children().last().should('have.attr', 'data-line-number', '36');

        cy.get('.line-scroll-container').trigger('mouseover', { which: 1 });
        cy.get('.semi-json-viewer-line-number[data-line-number="1"]').children().should('have.length', 2);
        cy.get('.semi-json-viewer-line-number[data-line-number="1"]').children().eq(1).click();
        cy.get('.lines-content').children().should('have.length', 21);

        cy.get('.line-scroll-container').trigger('mouseover', { which: 1 });
        cy.get('.semi-json-viewer-line-number[data-line-number="13"]').children().should('have.length', 2);
        cy.get('.semi-json-viewer-line-number[data-line-number="13"]').children().eq(1).click();
        cy.get('.lines-content').children().should('have.length', 15);

        cy.get('.line-scroll-container').trigger('mouseover', { which: 1 });
        cy.get('.semi-json-viewer-line-number[data-line-number="13"]').children().should('have.length', 2);
        cy.get('.semi-json-viewer-line-number[data-line-number="13"]').children().eq(1).click();
        cy.get('.lines-content').children().should('have.length', 21);
    });

    it('edit', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/jsonviewer--default-json-viewer');
        //insert
        typeTextAtPosition(1, 1, '{enter}');
        cy.get('.lines-content').children().eq(1).children().should('have.length', 1);
        typeTextAtPosition(2, 2, `"`);
        typeTextAtPosition(2, 3, `key`);
        typeTextAtPosition(2, 7, `:`);
        typeTextAtPosition(2, 8, `1`);
        typeTextAtPosition(2, 9, `,`);
        cy.get('.lines-content').children().eq(1).children().children().should('have.length', 5);


        // undo redo
        undo(1);
        cy.get('.lines-content').children().eq(1).children().children().should('have.length', 4);
        redo(1);
        cy.get('.lines-content').children().eq(1).children().children().should('have.length', 5);
        undo(8);
        cy.get('.lines-content').children().eq(1).children().children().should('have.length', 6);

        //del
        typeTextAtPosition(2, 1, `{backspace}`);
        cy.get('.lines-content').children().eq(0).children().children().should('have.length', 7);
        undo(1);
        cy.get('.lines-content').children().eq(0).children().children().should('have.length', 1);
        cy.get('.lines-content').children().eq(1).children().children().should('have.length', 6);

        // cut
        // typeTextAtPosition(2, 1, `{meta+x}`);
        // cy.get('.lines-content').children().eq(1).children().should('have.length', 0);
        // cy.get('.lines-content').type('{meta+z}');
        // cy.get('.lines-content').children().eq(1).children().should('have.length', 6);

        //complete
        typeTextAtPosition(14, 4, '{enter}');
        cy.get('.lines-content').children().eq(14).children().children().should('have.length', 1);
        typeTextAtPosition(15, 4, `c`);
        cy.get('.semi-json-viewer-complete-suggestions-container').children().should('have.length', 2);
        cy.get('.lines-content').type('{enter}');
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'none');
        cy.get('.lines-content').children().eq(14).children().children().should('have.length', 2);
        typeTextAtPosition(15, 11, `:`);
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'block');
        cy.get('.semi-json-viewer-complete-suggestions-container').children().should('have.length', 2);
        cy.get('.lines-content').type('{enter}');
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'none');
        typeTextAtPosition(15, 19, `,{enter}`);
        cy.get('.lines-content').children().eq(14).children().children().should('have.length', 5);
        typeTextAtPosition(16, 4, `a`);
        cy.get('.semi-json-viewer-complete-suggestions-container').children().should('have.length', 2);
        typeTextAtPosition(16, 5, `{rightArrow}`);
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'none');
        typeTextAtPosition(16, 5, `g`);
        cy.get('.semi-json-viewer-complete-suggestions-container').children().should('have.length', 2);
        cy.get('.lines-content').type('{enter}');
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'none');
        typeTextAtPosition(16, 9, `:`);
        cy.get('.lines-content').type('{enter}');
        cy.get('.semi-json-viewer-complete-container').should('have.css', 'display', 'none');
        cy.get('.lines-content').children().eq(15).children().children().should('have.length', 4);

        //search
        cy.get('.semi-json-viewer-search-bar-trigger').click();
        cy.get('.semi-json-viewer-search-bar').children().eq(0).type('a');
        cy.get('.semi-json-viewer-search-result').should('have.length.at.least', 1);
        cy.get('.semi-icon.semi-icon-default.semi-icon-whole_word').click();
        cy.get('.semi-json-viewer-search-result').should('have.length', 0);
        cy.get('.semi-icon.semi-icon-default.semi-icon-whole_word').click();
        cy.get('.semi-json-viewer-search-bar').children().eq(0).clear();
        cy.get('.semi-json-viewer-search-result').should('have.length', 0);
        const str = '\\d+';
        cy.get('.semi-json-viewer-search-bar').children().eq(0).type(str);
        cy.get('.semi-icon.semi-icon-default.semi-icon-reg_exp').click();
        cy.get('.semi-json-viewer-search-result').should('have.length.at.least', 1);
        cy.get('.semi-icon.semi-icon-default.semi-icon-reg_exp').click();
        cy.get('.semi-json-viewer-search-bar').children().eq(0).clear();

        //replace
        cy.get('.semi-json-viewer-search-bar').children().eq(0).type('a');
        cy.get('.semi-json-viewer-replace-bar').children().eq(0).type('x');
        cy.get('.semi-json-viewer-search-result').then(($el) => {
            let length = $el.length;
            cy.get('.semi-json-viewer-replace-bar').children().eq(1).click();
            cy.get('.semi-json-viewer-search-result').should('have.length', length - 1);
            cy.get('.semi-json-viewer-replace-bar').children().eq(2).click();
            cy.get('.semi-json-viewer-search-result').should('have.length', 0);
        });


    });


});
