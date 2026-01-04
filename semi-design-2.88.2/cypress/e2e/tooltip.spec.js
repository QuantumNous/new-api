// tooltip.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

/**
 * Cypress will default scroll element into view
 * @see https://docs.cypress.io/guides/core-concepts/interacting-with-elements#Scrolling
 */

describe('tooltip', () => {
    it('leftTopOver autoAdjustOverflow', () => {
        const viewportWidth = 1200;
        const viewportHeight = 660;
        const triggerWidth = 200;
        const triggerHeight = 32;
        const leftTopPosition = { offset: { top: 0, left: 0 } }; 
        const rightBottomPosition = { offset: { top: -viewportHeight + triggerHeight, left: -viewportWidth + triggerWidth } };
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--left-top-over-auto-adjust-overflow&args=&viewMode=story');
        cy.viewport(viewportWidth, viewportHeight);
        const dataSelector = `[data-cy=leftTopOver]`;
        cy.get(dataSelector).scrollIntoView(leftTopPosition);
        cy.get(dataSelector).click({ force: true });
        cy.get('[x-placement="leftTopOver"]').should('have.length', 1);
        cy.get(dataSelector).scrollIntoView(rightBottomPosition);
        cy.get('[x-placement="rightBottomOver"]').should('have.length', 1);
    });

    // TODO:
    // it('position with over autoAdjustOverflow', () => {
    //     const viewportWidth = 600;
    //     const viewportHeight = 400;
    //     const overList = ['leftTopOver', 'rightTopOver', 'rightBottomOver', 'leftBottomOver'];

    //     cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--left-top-over-demo&args=&viewMode=story');
    //     cy.viewport(viewportWidth, viewportHeight);
    //     const dataSelector = `[data-cy=toggleVisible]`;
    //     cy.get(dataSelector).click({ force: true });
        
    //     for (let i=0; i<overList.length; i++){
    //         const dataSelector = `[data-cy=`+ overList[i] + `]`;
    //         cy.get(dataSelector).click({ force: true });
    //         cy.get('[x-placement="'+ overList[overList.length - 1 - i] +'"]').should('have.length', 1);
    //     }
    // });

    it('autoFocusHover', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const dataSelector = `[data-cy=hover]`;
        const input = `[data-cy=hoverInput]`;
        cy.get(dataSelector).trigger('mouseover');
        cy.get(input).should('be.focused');
    });
    it.skip('autoFocusHoverNoMotion', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const dataSelector = `[data-cy=hoverNoMotion]`;
        const input = `[data-cy=hoverNoMotionInput]`;
        cy.get(dataSelector).trigger('mouseover');
        cy.get(input).should('be.focused');
    });
    it('autoFocusClick', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const dataSelector = `[data-cy=click]`;
        const input = `[data-cy=clickInput]`;
        cy.get(dataSelector).click({ force: true });
        cy.get(input).should('be.focused');
    });
    it('autoFocusClickNoMotion', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const dataSelector = `[data-cy=clickNoMotion]`;
        const input = `[data-cy=clickNoMotionInput]`;
        cy.get(dataSelector).click({ force: true });
        cy.get(input).should('be.focused');
    });
    it('autoFocusControlled', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const trigger = `[data-cy=controlled]`;
        const disableBtn = `[data-cy=controlledDisableBtn]`;
        const input = `[data-cy=controlledInput]`;

        // 校验受控功能
        cy.get(disableBtn).click({ force: true });
        cy.get(input).should('not.exist');

        cy.get(trigger).click({ force: true });
        cy.get(input).should('be.focused');
    });
    it('autoFocusControlledNoMotion', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--auto-focus-content-demo&args=&viewMode=story');
        const trigger = `[data-cy=controlledNoMotion]`;
        const disableBtn = `[data-cy=controlledNoMotionDisableBtn]`;
        const input = `[data-cy=controlledNoMotionInput]`;

        // 校验受控功能
        cy.get(disableBtn).click({ force: true });
        cy.get(input).should('not.exist');

        cy.get(trigger).click({ force: true });
        cy.get(input).should('be.focused');
    });

    it.skip('adjustPosIfNeed', () => {
        const viewportWidth = 400;
        const viewportHeight = 200;
        const topAndLeft = ['topLeft', 'top', 'topRight', 'leftTop', 'left', 'leftBottom'];
        const bottomAndRight = ['bottomLeft', 'bottom', 'bottomRight', 'rightTop', 'right', 'rightBottom'];
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--adjust-pos-if-need&args=&viewMode=story');
        cy.viewport(viewportWidth, viewportHeight);

        for (let i=0; i<topAndLeft.length; i++){
            const dataSelector = `[data-cy=`+ topAndLeft[i] + `]`;
            cy.get(dataSelector).click({ force: true });
            cy.get('[x-placement="'+ bottomAndRight[i] +'"]').should('have.length', 1);
        }

        for (let i=bottomAndRight.length-1; i>=0; i--){
            const dataSelector = `[data-cy=`+ bottomAndRight[i] + `]`;
            cy.get(dataSelector).click({ force: true });
            cy.get('[x-placement="'+ topAndLeft[i] +'"]').should('have.length', 1);
        }
    });

    it('test position in tblr, fine tune to other directions', () => {
        const viewportWidth = 1000;
        const viewportHeight = 800;
        cy.visit('http://127.0.0.1:6006/iframe.html?id=tooltip--adjust-pos-if-need-tblr&args=&viewMode=story');
        cy.viewport(viewportWidth, viewportHeight);
        cy.get('div .semi-tag').eq(0).click({ force: true });
        const posRow = ['top', 'bottom', 'left', 'right'];
        const posList1 = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
        const posList2 = ['leftTop', 'leftBottom', 'rightTop', 'rightBottom'];

        for (let i = 0; i < posList1.length; i++) {
            cy.get('div .semi-tag').contains(posRow[0] + ' to ' + posList1[i]).click({ force: true });
            cy.get('[x-placement="' + posList1[i] + '"]').should('have.length', 1);
            cy.get('div .semi-tag').contains(posRow[1] + ' to ' + posList1[i]).click({ force: true });
            cy.get('[x-placement="' + posList1[i] + '"]').should('have.length', 1);
        }

        for (let i = 0; i < posList2.length; i++) {
            cy.get('div .semi-tag').contains(posRow[2] + ' to ' + posList2[i]).click({ force: true });
            cy.get('[x-placement="' + posList2[i] + '"]').should('have.length', 1);
            cy.get('div .semi-tag').contains(posRow[3] + ' to ' + posList2[i]).click({ force: true });
            cy.get('[x-placement="' + posList2[i] + '"]').should('have.length', 1);
        }
    });
});