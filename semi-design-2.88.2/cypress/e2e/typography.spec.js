describe('typography', () => {
    it('ellipsis', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--ellipsis-collapsible&args=&viewMode=story');
        cy.viewport(500, 500);
        cy.get('.semi-typography span').eq(0).contains('...');
        cy.get('.semi-typography-ellipsis-expand').eq(0).contains('展开').click();
        cy.get('.semi-typography').eq(0).contains('四大优势');

        cy.get('.semi-typography-ellipsis-expand').eq(0).contains('收起').click();
        cy.get('.semi-typography span').eq(0).contains('...');

    });

    // Todo：本地测试无问题，线上会挂，先忽略
    // it('ellipsis from center', () => {
    //     cy.visit('http://localhost:6006/iframe.html?args=&id=typography--ellipsis-from-center');
    //     cy.viewport(800, 1000);
    //     cy.get('[data-cy=nowrap-middile-ellipsis1]').should('contain', '...');
    //     cy.get('[data-cy=nowrap-middile-ellipsis2]').should('contain', '...');
    // });

    // Todo：本地测试无问题，线上会挂，先忽略
    // it('showTooltip', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--show-tooltip&args=&viewMode=story');
    //     cy.get('.semi-typography-ellipsis').eq(0).trigger('mouseover');
    //     cy.wait(2000);
    //     cy.get('.semi-tooltip-wrapper').contains('css 截断，本内容超出长度限制');
    //     cy.get('.semi-typography-ellipsis').eq(0).trigger('mouseout');
    //     cy.wait(2000);
    //     cy.get('.semi-typography-ellipsis').eq(1).trigger('mouseover');
    //     cy.wait(2000);
    //     cy.get('.semi-tooltip-wrapper').contains('pos 为 middle，无 expanded');
    // });

    // todo:  The test currently work only in Electron
    // because the clipboard permission is granted when Cypress starts it.
    it('copyable', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--copyable&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        cy.viewport(800, 1000);
        cy.get('.semi-typography-action-copy').eq(1).click();
        // 测试 copyable 中 onCopy 回调，控制台应该打印“点击右边的图标复制文本。”
        cy.get('@consoleLog').should('be.calledWith', '点击右边的图标复制文本。'); 
        cy.get('span').contains('复制成功');
        
        // cy.window()
        //     .its('navigator.clipboard')
        //     .invoke('点击右边的图标复制文本。');

        // 测试自定义复制图标是否正确
        cy.get('.semi-icon-setting').eq(0).click();
        cy.get('.semi-typography-action-copied').eq(1).children('span').contains('复制成功');
    });

    // Todo：本地测试无问题，线上会挂，先忽略
    // it('resize', () => {
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--container-resize&args=&viewMode=story');
    //     cy.viewport(800, 1000);
    //     // 第一个，第二个容器宽度与页面一致，此时页面宽为 800，
    //     // 第一个 test，内容长度超出 2 行， css 截断为 2 行
    //     cy.get('.semi-typography-ellipsis').eq(0).should('have.css', 'height').and('eq', '40px');
    //     // 第二个 test, js 截断，有展开按钮
    //     cy.get('.semi-typography-ellipsis-expand').eq(0).contains('展开');

    //     cy.viewport(1860, 1000);
    //     // 屏幕尺寸变化， 内容长度符合尺寸要求，不发生截断
    //     // 第一个 test 需要完整显示， 以下测试仅明确尺寸变化
    //     // Todo： 更直接确定尺寸变化
    //     // 第二个 test 无展开按钮
    //     cy.get('.semi-typography-ellipsis-expand').should('not.exist');

    //     // 重新调整为宽度 800 原尺寸
    //     cy.viewport(800, 1000);
    //     cy.get('.semi-typography-ellipsis-expand').should('not.exist');
    //     cy.get('.semi-typography-ellipsis').eq(0).should('have.css', 'height').and('eq', '40px');
    //     cy.get('.semi-typography-ellipsis-expand').eq(0).contains('展开');

    // });

    it('edge case', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--edge-cases&args=&viewMode=story');
        cy.viewport(800, 1000);

        // 第二个 test 为固定尺寸，容器宽度符合预期，不应该显示展开按钮
        cy.get('.semi-typography-ellipsis').eq(1).children('.semi-typography-ellipsis-expand').should('not.exist');
    });

    it('js ellipsis, no truncate, no tooltip', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--js-ellipsis-no-tooltip&args=&viewMode=story');
        cy.viewport(800, 1000);
        cy.get('.semi-typography').trigger('mouseover');
        cy.wait(1000);
        cy.get('.semi-tooltip-content').should('not.exist');;
    });

    // work in local， work in online chrome，fail in test-coverage/cypress, ignore
    // it('custom render tooltip', () => {
    //     cy.viewport(800, 1000);
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--custom-tooltip&args=&viewMode=story');
    //     cy.get('.semi-typography').trigger('mouseover');
    //     cy.wait(2000);
    //     cy.get('.semi-tooltip-wrapper').eq(0).should('have.attr', 'style').should('contain', 'background-color: var(--semi-color-primary)');
    // });

    // 功能符合预期，通过 mouseover trigger 有问题，暂时忽略
    // it('ellipsis popover cls name', () => {
    //     cy.viewport(800, 1000);
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--global-ellipsis-popover-cls&args=&viewMode=story');
    //     cy.get('.semi-typography').trigger('mouseover');
    //     cy.wait(2000);
    //     cy.get('.testPopoverCls.semi-typography-ellipsis-popover').should('exist');
    // });

    // work in local， fail in online,  ignore
    // it('single row css ellipsis accurate', () => {
    //     cy.viewport(800, 1000);
    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=typography--single-row-css-ellipsis-accurate&args=&viewMode=story');
    //     cy.get('.semi-typography').trigger('mouseover');
    //     cy.wait(2000);
    //     cy.get('.semi-tooltip-content').contains('Latin America-巴西-圣保罗');
    // });

});