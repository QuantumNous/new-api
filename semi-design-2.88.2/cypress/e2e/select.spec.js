// form.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

/**
 * why use `.then`?
 * @see https://docs.cypress.io/guides/core-concepts/variables-and-aliases#Return-Values
 */
describe('Select', () => {

    it('option hover, change active', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--select-filter-single');
        cy.get('.semi-select').eq(0).click();
        // hover can change active index
        cy.get('.semi-select-option').eq(5).trigger('mouseover');
        cy.get('.semi-select-option-focused .semi-select-option-text').eq(0).should('have.text', 'wym');
        // press downArrow to test it
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('.semi-select-option-focused .semi-select-option-text').eq(0).should('have.text', 'opts');
    });

    it('keyboard-enter, select choose option', { keystrokeDelay: 0 }, () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--select-filter-single');
        cy.get('.semi-select').eq(0).click();
        cy.get('input').eq(0).type('o');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('input').eq(0).type('{enter}');
        cy.get('.semi-select-selection-text').eq(0).should('have.text', 'opt1');
    });

    it('clickOutSide, should hide', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--select-filter-single', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.get('.semi-select').eq(0).click();
        // should show now
        cy.get('.semi-select-option-list').should('exist');
        // should hide after click empty area
        cy.get('h5').eq(0).click();
        cy.get('.semi-select-option-list').should('not.exist');
        cy.get('@consoleLog').should('be.calledWith', 'onBlur');
    });

    it('emptyContent=null', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--empty-content');
        // when emptyContent = null， The dropdown list will not be displayed
        // so element(which class has semi-popover-wrapper) show have 0px height;
        cy.get('.semi-popover-wrapper').eq(0).should('have.css', 'height', '0px');
    });

    it('autoClearSearchValue false + remote + optionList update async', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--auto-clear-search-value');
        cy.get('.remote-select').eq(0).click();
        cy.get('.semi-select-option').eq(0).click();
        cy.get('.remote-select .semi-input').eq(0).type('123');
        cy.wait(500);
        cy.get('.semi-select-option').should('have.text', 'Design');
    });

    it('optionGroup without key setting, filter', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--select-option-group');
        cy.get('#without-key').eq(0).click();
        cy.get('#without-key .semi-input').eq(0).type('dou');
        cy.wait(500);
        cy.get('.semi-select-option-keyword').should('have.text', 'Dou');
        cy.get('.semi-select-group').should('have.text', 'Group1');
        cy.get('#without-key .semi-input').eq(0).type('{backspace}{backspace}{backspace}');
        cy.wait(500);
        cy.get('.semi-select-group').eq(0).should('have.text', 'Group1');
        cy.get('.semi-select-group').eq(1).should('have.text', 'Group2');
        cy.get('.semi-select-option').eq(0).should('have.text', 'Douyin');
        cy.get('.semi-select-option').eq(1).should('have.text', 'Ulikecam');
        cy.get('.semi-select-option').eq(2).should('have.text', 'Capcut');
        cy.get('.semi-select-option').eq(3).should('have.text', 'Xigua');
    });

    it('blur trigger by mouse click after select option', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--all-case-of-blur', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });

        cy.viewport(1000, 1000);

        cy.get('[data-cy=singleDefault]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single autoFocus onBlur');
        cy.get('@consoleLog').should('be.calledWith', 'single default onBlur');

        cy.get('[data-cy=singleFilter]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single filter onBlur');

        cy.get('[data-cy=singleClickToHide]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single clickToHide onBlur');

        cy.get('[data-cy=singleShowClear]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single showClear onBlur');

        cy.get('[data-cy=multipleDefault]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple default onBlur');

        cy.get('[data-cy=multipleFilter]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple filter onBlur');

        cy.get('[data-cy=multipleClickToHide]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple clickToHide onBlur');
       
    });

    it('blur trigger by mouse click without select option', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--all-case-of-blur', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });

        cy.viewport(1000, 1000);

        cy.get('[data-cy=singleDefault]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single autoFocus onBlur');
        cy.get('@consoleLog').should('be.calledWith', 'single default onBlur');

        cy.get('[data-cy=singleFilter]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single filter onBlur');

        cy.get('[data-cy=singleClickToHide]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single clickToHide onBlur');

        cy.get('[data-cy=singleShowClear]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'single showClear onBlur');

        cy.get('[data-cy=multipleDefault]').click();
        cy.get('.semi-select-option').eq(1).click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple default onBlur');

        cy.get('[data-cy=multipleFilter]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple filter onBlur');

        cy.get('[data-cy=multipleClickToHide]').click();
        cy.root().click('right');
        cy.get('@consoleLog').should('be.calledWith', 'multiple clickToHide onBlur');

    });

    it('Fixed PR-2139', () => {
        // 1.Select multi-select turns on onChangWithObject and value is controlled
        // 2. The current value does not exist in optionList
        // 3. The problem that rendering is not re - executed after updating other attributes in value(such as label, or any other Key)
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--update-other-key-not-in-list');
        cy.get('.render-content').eq(0).should('have.text', 'AA-Label-AA-OtherProps');
        cy.get('#change').eq(0).click();
        cy.get('.render-content').eq(0).should('have.text', 'AA-Label-2-AA-OtherProps-2');
    });

    it('Controled mode, same label text in reactNode', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--controled-same-label-in-node');
        cy.get('[data-cy=singleControl]').click();
        cy.get('[data-cy=a-1]').click();
        cy.wait(300);
        cy.get('[data-cy=singleControl]').click(); // show optionList again
        cy.wait(300);
        cy.get('[data-cy=a-1]').should('have.class', 'semi-select-option-selected');
        cy.get('[data-cy=a-2]').click();
        cy.wait(500);
        cy.get('[data-cy=singleControl]').click();
        cy.wait(300);
        cy.get('[data-cy=a-2]').should('have.class', 'semi-select-option-selected');
    });

    it('renderOptionItem, keyboard Up & Down', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--render-option-item');
        cy.get('[data-cy=multiple]').click();
        cy.wait(300);
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-2]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-3]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-4]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-5]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-6]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-7]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-8]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{downArrow}');
        cy.get('[data-cy=option-1]').should('have.class', 'custom-option-render-focused');
        cy.get('input').eq(0).type('{upArrow}');
        cy.get('[data-cy=option-8]').should('have.class', 'custom-option-render-focused');
    });

    it('Fixed PR-2465', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--fix-2465');
        cy.get('.semi-select').eq(0).click();
        cy.get('button').contains('single close').eq(0).click();
        cy.get('.semi-select').eq(0).should('have.class', 'semi-select-focus');
        cy.root().click('right');
        cy.get('.semi-select').eq(0).should('not.have.class', 'semi-select-focus');

        cy.get('.semi-select').eq(1).click();
        cy.get('button').contains('multiple close').eq(0).click();
        cy.get('.semi-select').eq(1).should('have.class', 'semi-select-focus');
        cy.root().click('right');
        cy.get('.semi-select').eq(1).should('not.have.class', 'semi-select-focus');
    });

    // it('ellipsisTrigger', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--fix-1560');

    //     // add option
    //     cy.get('.semi-select-arrow').eq(0).click();
    //     cy.get('.semi-select-option').contains('剪映').click();
    //     cy.get('.semi-tag-grey-light').eq(0).contains('+2');

    //     // reduce option
    //     cy.get('.semi-select-arrow').eq(0).click();
    //     cy.get('.semi-select-option').contains('抖音').click();
    //     cy.get('.semi-tag-large').eq(2).contains('剪映');

    //     cy.get('body').click('right');

    //     // reduce option
    //     cy.get('.semi-select-arrow').eq(1).click();
    //     cy.get('.semi-select-option').contains('西瓜视频').click();
    //     cy.get('.semi-tag-grey-light').eq(0).contains('+1');

    //     // add option
    //     cy.get('.semi-select-arrow').eq(1).click();
    //     cy.get('.semi-select-option').contains('西瓜视频').click();
    //     cy.get('.semi-tag-grey-light').eq(0).contains('+2');
        
    // });

    // it('should trigger onSearch when click x icon', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/select--select-filter-single');
    //     cy.get('.semi-select').eq(0).click();
    //     cy.get('.semi-select-option').eq(0).click();
    //     cy.get('.semi-select').eq(0).click();
    //     cy.get('.semi-select-clear').eq(0).click();
    //     cy.get('.semi-select-input .semi-input').should('have.value', '');
    // });

    // it('should trigger onBlur and onSearch', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/form--use-form-api-set-value-update-array');
    // });

    // it('keyboard-skip disabled option when press up/down', () => {

    // });

    // it('optionList scroll, should trigger onListScroll', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/form--use-form-api-set-value-update-array');
    // });



});