describe('tag', () => {
    it('tag group with max count', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tag--tag-group&args=&viewMode=story');

        // focus and esc
        cy.get('.semi-tag-content').eq(3).click();
        cy.get('.semi-portal');
    });

    it('keyboard test', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tag--tag-avatar&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        // cy.visit('http://127.0.0.1:6006/iframe.html?id=tag--tag-avatar&args=&viewMode=story');
        // focus + esc + enter

        
        /**
         * TODO:
         * cypress v>10 后，原有的  cypress-plugin-tab无法再使用，即 cy.body.tab() 的方式调用会报错
         * 同时 cypress-real-event 的 realPress('Tab') 在某些情况下依然不符合预期，所以这里暂时将一部分 tab的测试逻辑注释掉，避免阻塞整个测试流程
         */
        // cy.realPress('Tab'); // 按下tab键
        // cy.body.tab(); // 按下tab键
        // cy.get('.semi-tag').eq(0).should('be.focused'); // 第一个tag应该被focus

        cy.get('.semi-tag').eq(0).type('{enter}'); // 在第一个tag上按enter
        cy.get('@consoleLog').should('be.calledWith', '如果能重来，我要做李白'); // 控制台应该打印“如果能重来，我要做李白”
        cy.get('.semi-tag').eq(0).type('{esc}'); // 在第一个tag上按ESC
        cy.get('.semi-tag').eq(0).should('not.be.focused'); // 第一个tag应该没有被focus

        // // backspace
        cy.get('.semi-tag').eq(0).realPress('Tab');
        cy.get('.semi-tag').eq(4).should('be.focused');
        cy.get('.semi-tag').eq(4).type('{backspace}'); // 在第5个tag上按backspace
        cy.get('.semi-tag').eq(4).get('.semi-tag-invisible'); // 第5个tag上应该被隐藏
    });
});