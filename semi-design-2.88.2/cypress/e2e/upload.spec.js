describe('upload', () => {
    it('drag and drop', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=upload--draggable&args=&viewMode=story');

        cy.get('.semi-upload-drag-area').eq(0).selectFile('README.md', { force: true, action: 'drag-drop' });
        cy.get('.semi-upload-file-card-info-main-text').contains('README.md');

        // todo: upload file folder by drag and drop
        // cypress not surpport yet
    });

    it('limit', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=upload--auto-replace-limit-1&args=&viewMode=story');

        cy.get('input[type=file]').eq(0).selectFile('README.md', { force: true });
        cy.get('.semi-upload-file-card-info-main-text').contains('README.md');
        cy.get('input[type=file]').eq(0).selectFile('README.md', { force: true });
        cy.get('.semi-upload-file-card-info-main-text').contains('README.md');
    });

    it('replace', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=upload--test-replace-func&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        // not an acceptable type
        cy.get('input[type=file]').eq(3).selectFile('README.md', { force: true });

        // not an acceptable size
        cy.get('input[type=file]').eq(5).selectFile('README.md', { force: true });
        cy.get('div').not('.semi-upload-file-list');

        cy.get('input[type=file]').eq(1).selectFile('README.md', { force: true });
        
        // assert
        cy.get('.semi-upload').eq(1).get('div').not('.semi-upload-file-list');
        cy.get('@consoleLog').should('be.calledWith', 'onSizeError');
        cy.get('.semi-upload-file-card-info-main-text').contains('README.md');
    });

    it('ref method insert', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=upload--insert&args=&viewMode=story',  {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        cy.get('input[type=file]').eq(1).selectFile('README.md', { force: true });
        cy.get('input[type=file]').eq(1).selectFile('README.md', { force: true });


        // test file number limit
        cy.get('span').contains('插入首项上传1').click();
        cy.get('span').contains('插入首项上传1').click();
        cy.get('.semi-upload-file-list').get('div[role="listitem"]').should('have.length', 1);

        // test file number limit
        cy.get('span').contains('插入首项上传2').click();
        cy.get('span').contains('插入首项上传2').click();
        cy.get('.semi-upload-file-list').get('div[role="listitem"]').should('have.length', 3);

        // test size limit
        cy.get('span').contains('插入首项上传3').click();
        cy.get('@consoleLog').should('be.calledWith', 'onSizeError');
        
    });

});