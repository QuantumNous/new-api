// table.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe('table', () => {
    it('row selection', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=table--selection-table&args=&viewMode=story');
        cy.get('.semi-table-row-head .semi-checkbox-inner-display').click();
        cy.get('.semi-checkbox-checked').should('have.length', 4);
    });

    /**
     * 测试 columns 为字面量时刷新 Table，页码应保持当前页
     * 即更新 columns 不影响 currentPage
     */
    it('columns change ', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-columns-change&viewMode=story');
        cy.get('.semi-page-item').contains('2').click();
        cy.get('.semi-table-tbody .semi-checkbox').eq(1).click()
            .then(() => {
                cy.get('.semi-page-item').contains('2').should('have.class', 'semi-page-item-active');
            });
    });

    it('defaultFilteredValue', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--default-filtered-value&args=&viewMode=story');
        // 筛选为默认值
        cy.contains('显示第 1 条-第 10 条，共 23 条');
        // 动态变更数据后，默认筛选生效
        cy.get('.semi-button').contains('toggle change dataSource (46/25)').click();
        cy.contains('显示第 1 条-第 10 条，共 12 条');
        // 筛选手动设置为空后，动态变更数据，筛选值为空
        cy.get('.semi-table-column-filter').click();
        cy.get('.semi-dropdown-menu .semi-dropdown-item:nth-child(2)').click();
        cy.get('.semi-button').contains('toggle change dataSource (46/25)').click();
        cy.contains('显示第 1 条-第 10 条，共 46 条');
    });

    it('jsx columns nested change', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-header-merge&args=&viewMode=story');
        cy.get('[data-cy=button]').click();
        cy.contains("Base Information");
        cy.contains("Company Information");
    });

    it('scroll', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--scroll-bar&args=&viewMode=story');
     
        cy.get('.semi-table-body').scrollTo('bottom');
        cy.get('.semi-table-body').scrollTo('top');
        cy.get('.semi-table-body').scrollTo('left');
        cy.get('.semi-table-body').scrollTo('right');
    });

    it('resizable header', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--resizable-columns&args=&viewMode=story');
        
        cy.get('.react-resizable-handle').eq(0)
            .trigger('mousedown', { which: 1 })
            .trigger('mousemove', { clientX: 400, clientY: 100 })
            .trigger('mouseup', { force: true });
        cy.get('.semi-table-row-cell').eq(0).should('have.css', 'width').and('eq', '364px');
        cy.get('.react-resizable-handle').eq(1)
            .trigger('mousedown', { which: 1 })
            .trigger('mousemove', { clientX: 800, clientY: 100 })
            .trigger('mouseup', { force: true });
        cy.get('.semi-table-row-cell').eq(1).should('have.css', 'width').and('eq', '400px');
    });

    it('scroll table header click', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-on-header-row&args=&viewMode=story');
        cy.contains('标题').click();
        cy.contains('header click').should('be.visible');
    });

    it('infinite scroll', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--infinite-scroll-demo&args=&viewMode=story');
        // fixed the viewport
        cy.viewport(1000, 660);

        // the virtualied table should not load all table item
        cy.get('div[role="row"]').should('have.length.below', 30);

        // test the scroll in virtualized table 
        cy.get('.semi-table-body').scrollTo('bottom');
        // Wait for the scroll result to take effect
        cy.wait(500);
        cy.get('div[role="gridcell"]').contains('Edward King 14');
        cy.get('.semi-table-body').scrollTo('bottom');
        cy.wait(500);
        cy.get('div[role="row"]').contains('Edward King 34');
        cy.get('.semi-table-body').scrollTo('top');
        cy.wait(500);
        cy.get('div[role="row"]').contains('Edward King 0');
    });

    it.skip('scrollToFirstRowOnChange', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--virtualized&args=&viewMode=story');
        cy.get('.semi-table-body').scrollTo(0, 150);
        cy.get('div[role="button"]').click();
        cy.get('div[role="row"]').contains('Edward King 9983');
    });

    it('resize', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--dynamic-table&args=&viewMode=story');
        cy.viewport(1000, 660);
        cy.get('.semi-switch').eq(0).click();
        cy.get('.semi-table-body').should('have.css', "max-height", "300px");
    });

    it('fix filter', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-filter&args=&viewMode=story');
        cy.get('.semi-table-column-filter').click();
        cy.get('.semi-checkbox').contains('Semi Design 设计稿').click();
        cy.get('.semi-checkbox').contains('Semi Pro 设计稿').click();
        cy.get('.semi-table-tbody .semi-table-row').eq(0).should('contain', 'Semi Design 设计稿0.fig');
        cy.get('.semi-table-tbody .semi-table-row').eq(1).should('contain', 'Semi Pro 设计稿1.fig');
    });

    it('empty filters', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--empty-filters&args=&viewMode=story');
        // filter title with `Semi Pro`
        cy.get('.semi-input').type('Semi Pro');
        // expect title contains `Semi Pro`
        cy.get('.semi-table-body .semi-table-row').eq(0).contains('Semi Pro');
        cy.get('.semi-table-body .semi-table-row').eq(1).contains('Semi Pro');
        cy.get('.semi-table-body .semi-table-row').eq(2).contains('Semi Pro');
        cy.contains('显示第 1 条-第 10 条，共 23 条');
    });

    it('fixed row selection header state', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fix-select-all-325&args=&viewMode=story');
        cy.get('.semi-table-row-head .semi-checkbox-inner-display').click();
        cy.get('.semi-checkbox-checked').should('have.length', 3);
        cy.get('.semi-page-item').contains('2').click();
        cy.get('.semi-table-row-head .semi-checkbox-checked');
        cy.get('.semi-table-row-head .semi-checkbox-indeterminate').should('not.exist');
        cy.get('.semi-checkbox-checked').should('have.length', 4);
        cy.get('.semi-table-tbody .semi-checkbox-inner-display').eq(0).click();
        cy.get('.semi-table-row-head .semi-checkbox-indeterminate');
        cy.get('.semi-table-row-head .semi-checkbox-inner-display').click();
        cy.get('.semi-table-row-head .semi-checkbox-checked');
        cy.get('.semi-checkbox-checked').should('have.length', 4);
    });

    it('normal table ellipsis title', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--ellipsis-normal-table&args=&viewMode=story');
        cy.get('.semi-table-row-head-title').eq(0).should('have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(1).should('have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(2).should('have.attr', 'title');
        cy.get('.semi-table-row-head-ellipsis').eq(3).should('have.attr', 'title');
    });

    it('fixed table ellipsis title', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--ellipsis-fixed-table&args=&viewMode=story');
        cy.get('.semi-table-row-head-title').eq(0).should('have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(1).should('have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(2).should('have.attr', 'title');
        cy.get('.semi-table-row-head-ellipsis').eq(3).should('have.attr', 'title');
    });

    it('fixed table ellipsis showTitle false', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--show-title-table&args=&viewMode=story');
        cy.get('.semi-table-row-head-title').eq(0).should('not.have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(1).should('not.have.attr', 'title');
        cy.get('.semi-table-row-head-title').eq(2).should('not.have.attr', 'title');
        cy.get('.semi-table-row-head-ellipsis').eq(3).should('not.have.attr', 'title');
        cy.get('.semi-table-row-cell').eq(0).should('not.have.attr', 'title');
        cy.get('.semi-table-row-cell').eq(1).should('not.have.attr', 'title');
        cy.get('.semi-table-row-cell').eq(2).should('not.have.attr', 'title');
        cy.get('.semi-table-row-cell').eq(3).should('not.have.attr', 'title');
    });

    it('fixed onChange filter incorrect, when setting defaultFilteredValue & without onFilter', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fix-on-change&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        cy.get('.semi-table-column-sorter').eq(1).click();
        // filters 长度应该为 1
        cy.get('@consoleLog').should('be.calledWith', 1);
    });

    it('resizable onHeaderCell', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--resizable-table&viewMode=story');
        cy.get('.test-1').should('have.length', 1);
        cy.get('.test-2').should('have.length', 1);
    });

    it('test sorter sortOrder parameter', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--sorter-sort-order&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog'); // 测试时用到控制台的前置步骤
            },
        });

        cy.get('.semi-table-column-sorter').eq(0).click();
        cy.get('.semi-table-tbody .semi-table-row').eq(4).should('contain.text', '未知');
        cy.get('.semi-table-tbody .semi-table-row').eq(5).should('contain.text', '未知');
        cy.get('.semi-table-column-sorter').eq(0).click();
        cy.get('.semi-table-tbody .semi-table-row').eq(4).should('contain.text', '未知');
        cy.get('.semi-table-tbody .semi-table-row').eq(5).should('contain.text', '未知');
    });

    it('test given pageSize + showSizeChanger', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-pagination&viewMode=story');
        cy.get('.semi-page-switch').eq(0).click();
        cy.get('.semi-select-option').eq(0).click();
        cy.wait(500);
        cy.get('.semi-page-item').eq(4).click();
        cy.get('.semi-table-pagination-info').should('contain.text', '显示第 31 条-第 40 条，共 46 条')
        cy.get('.semi-page-item-active').eq(0).should('contain.text', '4');
        cy.get('.semi-page-item').eq(5).click();
        cy.get('.semi-table-pagination-info').should('contain.text', '显示第 41 条-第 46 条，共 46 条')
        cy.get('.semi-page-item-active').eq(0).should('contain.text', '5');
    })

    it('test virtualized showHeader false', () => {
        cy.visit('http://localhost:6006/iframe.html?args=&id=table--show-header&viewMode=story');
        cy.get('.semi-table-header').should('have.length', 1);
        cy.window().then(window => {
            const header = window.document.querySelector('.semi-table-header');
            const style = window.getComputedStyle(header);
            expect(style.height).eq('0px');
        });
    })

    it('test keepDOM', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--keep-dom&viewMode=story');
        cy.get('[data-cy=expand] .semi-table-row-hidden').should('have.length', 3);
        cy.get('[data-cy=tree] .semi-table-row-hidden').should('have.length', 5);
        cy.get('[data-cy=tree] .semi-table-expand-icon').eq(0).click();
        cy.get('[data-cy=tree] .semi-table-row-hidden').should('have.length', 3);
        cy.get('[data-cy=section] .semi-table-row-hidden').should('have.length', 10);
        cy.get('[data-cy=section] .semi-table-expand-icon').eq(0).click({ force: true });
        cy.get('[data-cy=section] .semi-table-row-hidden').should('have.length', 7);
    });

    it('test header selected status when all rows are disabled and selected ', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-all-disabled-and-selected&viewMode=story');
        cy.get('button').contains('点击全选').click();
        cy.get('.semi-table-thead .semi-checkbox-checked').should('exist')
    });

    it('test hidden rowSelection in resizable Table', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-row-selection-hidden-resizable&viewMode=story');
        cy.get('.semi-button').eq(0).click();
        cy.get('.semi-table-column-selection').should('not.exist');
        cy.get('.semi-button').eq(0).click();
        cy.get('.semi-table-column-selection').should('exist');
    });

    it('test renderFilterDropdown', () => {
        cy.visit('http://localhost:6006/iframe.html?args=&id=table--feat-render-filter-dropdown&viewMode=story');

        // 测试第一个筛选器
        cy.get('.semi-table-column-filter').eq(0).click();
        cy.get('.semi-input').should('be.focused');
        cy.get('.semi-input').type('12');
        cy.get('.semi-button').contains('筛选+关闭').click();
        cy.get('.semi-table-tbody .semi-table-row').should('have.length', 1);
        cy.wait(200);
        cy.get('.semi-table-column-filter').eq(0).click();
        cy.get('.semi-input').should('be.focused');
        cy.get('.semi-button').contains('清除+关闭').click();
        cy.get('.semi-table-tbody .semi-table-row').should('have.length', 10);
        cy.wait(200);
        cy.get('.semi-table-column-filter').eq(0).click();
        cy.get('.semi-input').should('be.focused');
        cy.get('.semi-button').contains('直接关闭').click();
        cy.get('.semi-dropdown').should('not.exist');
        cy.wait(300);
        // 测试第二个筛选器
        cy.get('.semi-table-column-filter').eq(1).click();
        cy.get('.semi-input').should('have.value', '姜鹏志');
        cy.get('.semi-button').contains('清除后不关闭').click();
        cy.get('.semi-table-pagination-info').should('contain', '显示第 1 条-第 10 条，共 46 条');
        cy.get('.semi-dropdown').should('exist');
        cy.wait(200);
        cy.get('.semi-table-column-filter').eq(1).click();
        cy.get('.semi-input').type('郝宣');
        cy.get('.semi-button').contains('筛选后不关闭').click();
        cy.get('.semi-table-pagination-info').should('contain', '显示第 1 条-第 10 条，共 23 条');
        cy.get('.semi-dropdown').should('exist');
        cy.get('.semi-button').contains('直接关闭').click();
        cy.get('.semi-dropdown').should('not.exist');
    });

    it('test expandedRowKeys with defaultExpandGroupKeys', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-default-expanded-grouped-rows&viewMode=story');
        cy.get('.semi-table-tbody tr').eq(1).should('have.class', 'semi-table-row-expanded');
    });

    it('test header rowSelection is not selected when dataSource is empty', () => {
        cy.visit('http://localhost:6006/iframe.html?args=&id=table--fixed-row-selection-empty&viewMode=story');
        cy.get('.semi-table-thead .semi-checkbox-unChecked').should('exist');
    });

    it('test onGroupedRow return object includes className', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-on-grouped-row-class-name&viewMode=story');
        cy.get('tbody .semi-table-row-section').eq(0).should('have.class', 'test-group');
    });


    it('test virtualized table ref', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--fixed-virtualized-ref&viewMode=story');
        cy.get('.semi-button').eq(0).click();
        cy.wait(300);
        cy.get('.semi-table-row-cell').should('contain.text', 'Semi Design 设计稿20.fig');
    });
      
    it('test rowSelection onCell and onHeaderCell', () => {
        cy.visit('http://localhost:6006/iframe.html?id=table--row-selection-on-cell&viewMode=story');
        cy.get('.test-th').should('have.attr', 'style').should('contain', 'background: blue');
        cy.get('.test-td').should('have.attr', 'style').should('contain', 'background: red');
    });
});
