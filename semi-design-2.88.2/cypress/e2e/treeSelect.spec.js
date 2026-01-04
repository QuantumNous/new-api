describe('treeSelect', () => {
    it('searchPosition is trigger', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--search-position&args=&viewMode=story');

        // test trigger focus
        cy.get('input').eq(0).click();
        cy.get('.semi-tree-select-focus').should('exist');

        // test trigger blur
        cy.get('body').click('right');
        cy.get('.semi-tree-select-focus').should('not.exist');
    });

    it('load data', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--load-data&args=&viewMode=story');

        cy.get('.semi-tree-select-selection').click();
        cy.wait(200);
        cy.get('.semi-tree-option-list .semi-icon-tree_triangle_down').eq(0).click();
        cy.wait(1000);
        // assert data had load success
        cy.get('.semi-tree-option-list').contains('Child Node');
    });

    it('clear and close', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--check-relation-demo&args=&viewMode=story');
        cy.viewport(1000, 1000);
        
        // test remove tag
        cy.get('.semi-tag-close').eq(3).click();
        cy.get('.semi-tag-content').contains('Japan').should('not.exist');

        cy.get('.semi-tree-select-selection').eq(8).contains('China');
        cy.get('.semi-tree-select-selection').eq(8).trigger('mouseover');
        cy.get('.semi-tree-select-clearbtn').click();
        cy.get('.semi-tagInput-wrapper .semi-tag').should('not.exist');

        // multiple When triggerSearch, clicking the clear button will trigger to clear Input
        cy.get('input').eq(1).type('dddd');
        cy.get('.semi-tree-select-selection').eq(8).trigger('mouseover');
        cy.get('.semi-tree-select-clearbtn').click();
        cy.get('.semi-tree-select-selection').eq(8).get('input').should('have.value', '');

        cy.get('body').click('right');
        // wait for the panel close
        cy.wait(500);

        // single selection  When triggerSearch, clicking the clear button will trigger to clear Input
        cy.get('input').eq(2).type('dddd');
        cy.get('.semi-tree-select-selection').eq(9).trigger('mouseover');
        cy.get('.semi-tree-select-clearbtn').click();
        cy.get('.semi-tree-select-selection').eq(9).get('input').should('have.value', '');
    });

    it('clear by key press', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--check-relation-demo&args=&viewMode=story');
        cy.get('.semi-tree-select-selection').eq(8).contains('China');
        cy.get('.semi-tree-select-selection').eq(8).trigger('mouseover');
        cy.get('.semi-tree-select-clearbtn').focus();
        cy.get('.semi-tree-select-clearbtn').type('{enter}');
        cy.get('.semi-tagInput-wrapper .semi-tag').should('not.exist');
    });

    it('onblur / onfocus', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--on-blur-on-focus&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        // 单选，点击 trigger 触发 onFocus， 点击选项触发 onBlur，
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('@consoleLog').should('be.calledWith', 'focus');
        cy.get('.semi-tree-option').eq(0).click();
        cy.get('@consoleLog').should('be.calledWith', 'blur');
        // 单选，点击 trigger 触发 onFocus，再次点击 trigger 收起面板，但不会触发 onBlur， 点击外部触发 onBlur，
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('@consoleLog').should('be.calledWith', 'focus');
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('.semi-tree-select').eq(1).click();
        cy.get('@consoleLog').should('be.calledWith', 'blur');
        // 多选， 点击 trigger 触发 onFocus，在此点击再次点击收起面板，但不会触发 onBlur， 点击外部触发 onBlur，
        cy.get('@consoleLog').should('be.calledWith', 'focus');
        cy.get('.semi-tree-select').eq(1).click();
        cy.get('.semi-tree-select').eq(2).click();
        cy.get('@consoleLog').should('be.calledWith', 'blur');
    });

    it('filterTreeNode & virtualize', () => {
        // 该例子为测试当 filterTreeNode 和 virtualize 功能同时使用时, 点击选中是否符合预期
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--search-position-in-trigger-and-virtualize');
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('.semi-tree-option').eq(0).click();
        cy.get('.semi-tree-select-selection-TriggerSearchItem').eq(0).should('contain.text', '亚洲');
    });

    it('treeSelect clickTriggerToHide', () => {
        // 测试 clickTriggerToHide API 是否符合预期
        // 未设置 clickTriggerToHide， 默认为 true， 面板打开状态下再次点击会关闭
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--click-trigger-to-hide');
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('.semi-tree-select-popover').should('exist');
        cy.get('.semi-tree-select').eq(0).click();
        cy.get('.semi-tree-select-popover').should('not.exist');

        // clickTriggerToHide 设置为 false， 面板打开的状态下再次点击不会关闭
        cy.get('.semi-tree-select').eq(1).click();
        cy.get('.semi-tree-select-popover').should('exist');
        cy.get('.semi-tree-select').eq(1).click();
        cy.get('.semi-tree-select-popover').should('exist');
    });

    it("unRelated + async load", () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--un-related-and-async-load');
        cy.get('.semi-checkbox').eq(0).get('.semi-checkbox-inner-checked').should("exist");
        cy.get('.semi-icon-tree_triangle_down').eq(0).trigger('click');
        // sync load, 1000ms
        cy.wait(1000);
        cy.get('.semi-checkbox').eq(0).get('.semi-checkbox-inner-checked').should("exist");
    });

    it('expanded controlled + showFilteredOnly', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--issue-1542');
        // cy.get('.semi-tree-select-selection').eq(0).trigger('click');
        cy.get('.semi-tree-select-inputTrigger').eq(0).children(".semi-input").eq(0).type('b');
        // showFilteredOnly，因此搜索后的选项应该只有 3 项
        cy.get('.semi-tree-option').should('have.length', 3);
        // 清空搜索框，由 state 中的 expandedKeys 决定展示展示项，应该只有两项
        cy.get('.semi-tree-select-inputTrigger').eq(0).children(".semi-input").eq(0).clear();
        cy.get('.semi-tree-option').should('have.length', 2);
        cy.get('.semi-tree-select-inputTrigger').eq(0).children(".semi-input").eq(0).type('s');
        cy.get('.semi-tree-option').should('have.length', 9);
        // 搜索状态下，输入框有值，被筛选的选项点击展开按钮行为正常
        cy.get('.semi-tree-option').eq(1).children('.semi-icon-tree_triangle_down').eq(0).trigger('click');
        cy.get('.semi-tree-option').should('have.length', 6);
        cy.get('body').click();
        // 等待弹出层收起
        cy.wait(500);
        cy.get('.semi-tree-select-selection').eq(0).trigger('click');
        // 等待弹出层展开
        cy.wait(500);
        cy.get('.semi-tree-option').should('have.length', 2);
        cy.get('body').click();
        // 等待弹出层收起
        cy.wait(500);
        cy.get('.semi-tree-select-inputTrigger').eq(0).children(".semi-input").eq(0).type('o');
        cy.get('.semi-tree-option').should('have.length', 4);
        cy.get('.semi-tree-option').eq(3).trigger('click');
        cy.wait(1000);
        cy.get('.semi-tree-select-selection').eq(0).trigger('click');
        cy.wait(1000);
        // 此时展开项目由选中项和原来的 state 中的 expandedKeys 决定
        cy.get('.semi-tree-option').should('have.length', 2);
        cy.get('.semi-icon-tree_triangle_down').eq(0).trigger('click');
        cy.get('.semi-tree-option').should('have.length', 4);
    });

    it('filterTreeNode + loadData', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--load-data');
        cy.get('.semi-tree-select-selection').eq(0).trigger('click');
        cy.wait(1000);
        cy.get('.semi-tree-option').eq(0).trigger('click');
        cy.get('.semi-tree-option-list').should('not.exist');
        cy.get('.semi-tree-select-selection').eq(0).trigger('click');
        cy.wait(1000);
        cy.get('.semi-tree-option.semi-tree-option-level-1.semi-tree-option-selected.semi-tree-option-collapsed').should('exist');
    });

    it('multiple, checkRelation = unRelated, triggerRender', () => {
        cy.visit("http://127.0.0.1:6006/iframe.html?id=treeselect--trigger-render-add-method");
        cy.get('.semi-tagInput').eq(1).trigger('click');
        cy.get('.semi-tree-option').eq(2).trigger('click');
        cy.get('.semi-tree-option').eq(3).trigger('click');
        cy.get('.semi-tagInput-wrapper').eq(1).get('.semi-tag-content').should('have.length', 2);
        cy.get('.semi-tagInput-wrapper').eq(1).get('.semi-tag-content').eq(0).contains('北京');
        cy.get('.semi-tagInput-wrapper').eq(1).get('.semi-tag-content').eq(1).contains('上海');
    });

    it('multiple, checkRelation = related, triggerRender', () => {
        cy.visit("http://127.0.0.1:6006/iframe.html?id=treeselect--trigger-render-add-method");
        cy.get('.semi-tagInput').eq(0).trigger('click');
        cy.get('.semi-tree-option').eq(2).trigger('click');
        cy.get('.semi-tree-option').eq(3).trigger('click');
        cy.get('.semi-tagInput-wrapper').eq(1).get('.semi-tag-content').should('have.length', 1);
        cy.get('.semi-tagInput-wrapper').eq(1).get('.semi-tag-content').eq(0).contains('亚洲');
    });

    it('single, triggerRender', () => {
        cy.visit("http://127.0.0.1:6006/iframe.html?id=treeselect--trigger-render-add-method");
        cy.get('.semi-button').eq(0).trigger('click');
        cy.get('.semi-tree-option').eq(0).trigger('click');
        cy.get('.semi-button-content-left').eq(0).contains('亚洲');
    })

    it('default open', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--multiple')
        cy.get('.semi-tree-select-popover').should('have.length', 1);
        cy.get('#invisible-span').eq(0).trigger('mousedown');
        cy.get('.semi-tree-select-popover').should('not.exist');
    })

    it('esc close panel', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--search-position-in-trigger-and-virtualize');
        // cy.get('.semi-input').trigger('click');
        cy.get('.semi-input').type('中');
        cy.get('.semi-tree-select-popover').should('have.length', 1);
        cy.get('.semi-input').type('{esc}', { force: true });
        cy.get('.semi-tree-select-popover').should('not.exist');
    })

    it('showFilteredOnly + searchPosition in trigger', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--show-filtered-only');
        // cy.get('.semi-tree-select').trigger('click');
        cy.get('.semi-input').type('上');
        cy.get('.semi-tree-option').should('have.length', 3);
        cy.get('#info').trigger('mousedown');
        cy.wait(500);
        cy.get('.semi-tree-select').trigger('click');
        cy.get('.semi-tree-option').should('have.length', 2);
    })

    it('keyMaps + search', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--filter-and-key-maps');
        cy.get('.semi-tree-select').trigger('click');
        cy.get('.semi-input').type('1');
        cy.get('.semi-tree-option-expand-icon').eq(0).trigger('click');
        cy.get('.semi-tree-option-label-text').eq(0).contains('Asia');
    })

    it('disabled treeSelect can have focus border', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=treeselect--fixed-2968');
        cy.get('.semi-tree-select').focus();
        // semi-tree-select 层级的元素的 border 应该存在，并且 border color 应该是 transparent
        cy.get('.semi-tree-select').should('have.css', 'border-color', 'rgba(0, 0, 0, 0)');  
    })
});

