describe('avatar', () => {
    it('keyboard test', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=avatar--focus-test&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        // focus + esc + enter
        cy.get('#initial_focus_point').click();
        cy.wait(100);
        cy.get('#initial_focus_point').realPress('Tab'); // 按下tab键
        cy.wait(100);
        cy.get('.semi-avatar').eq(0).should('have.class', 'semi-avatar-focus'); // 第一个avatar应该有focus样式
        cy.get('.semi-avatar').eq(0).type('{enter}'); // 在第一个tag上按enter
        cy.wait(100);
        cy.get('@consoleLog').should('be.calledWith', 'click avatar 1'); // 控制台应该打印“click avatar 1”
        cy.get('.semi-avatar').eq(0).type('{esc}'); // 在第一个tag上按ESC
        cy.wait(100);
        cy.get('.semi-avatar').eq(0).should('not.have.class', 'semi-avatar-focus'); // 第一个avatar应该无focus样式
        cy.get('.semi-avatar').eq(0).type('{backspace}'); // 模拟聚焦状态按其他按键的兜底
    });

    it('src Change', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=avatar--src-change&args=&viewMode=story');
        cy.get('.semi-radio').eq(1).click(); // 点击第二个按钮，切换src为successSrc2
        cy.wait(500);
        cy.get('.semi-avatar').eq(0).should('have.class', 'semi-avatar-img'); // 图片成功加载，avatar应该具备class: semi-avatar-img
        cy.get('.semi-radio').eq(2).click(); // 点击第三个按钮，切换src为errorSrc
        cy.wait(1000);
        cy.get('.semi-avatar').eq(0).should('have.class', 'semi-avatar-grey'); // 图片加载失败，avatar应该具备class: semi-avatar-grey
    });
});