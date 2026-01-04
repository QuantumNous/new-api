describe('slider', () => {

    it('controlled slider', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        const parentSelector = '[data-cy=horizontalNoChangeSlider]';
        const sliderTrackSelector = `${parentSelector} .semi-slider-rail`;
        const sliderHandleSelector = `${parentSelector} .semi-slider-handle`;

        // test track click
        let handleInitialPos;
        cy.get(sliderHandleSelector).then(($handle) => {
            handleInitialPos = $handle.position();
        });

        cy.get(sliderTrackSelector).trigger('click', 'right');
        cy.get('@consoleLog').should('be.calledWith', 'value改变了100');

        cy.get(sliderHandleSelector).should(($button) => {
            expect($button.position()).deep.equal(handleInitialPos);
        });

        // test knob slide
        cy.get(sliderHandleSelector)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 600, pageY: 0 })
            .trigger('mouseup', { force: true });

        cy.get(sliderHandleSelector).should(($button) => {
            expect($button.position()).deep.equal(handleInitialPos);
        });
    });

    it('controlled slider with onChange', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });

        const parentSelector = `[data-cy=horizontalOnChangeSlider]`;
        const sliderTrackSelector = `${parentSelector} .semi-slider-rail`;
        const sliderHandleSelector = `${parentSelector} .semi-slider-handle`;

        // test track click
        cy.get(sliderTrackSelector).trigger('click', 'right');
        cy.get('@consoleLog').should('be.calledWith', 'value改变了100');
        cy.get(sliderHandleSelector).should('have.css', 'left', '774px');

        // test knob slide (pageX 300 = 32%)
        cy.get(sliderHandleSelector)
            .realMouseDown()
            .realMouseMove(-(774 - 774 * 0.32), 0, { position: "center" })
            .realMouseUp({ force: true });

        // left 32% = 247.68px;
        // cy.get(sliderHandleSelector).should('have.css', 'left', '32%');
        cy.window().then(window => {
            const left = (window.document.querySelector(sliderHandleSelector))['style']['left'];
            expect(left).eq("32%");
        });
    });

    it('controlled range slider', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        const parentSelector = `[data-cy=horizontalNoChangeRangeSlider]`;
        const sliderTrackSelector = `${parentSelector} .semi-slider-rail`;
        const sliderHandleSelector = `${parentSelector} .semi-slider-handle`;

        let leftKnobPos, rightKnobPos;
        cy.get(sliderHandleSelector).then((handles) => {
            leftKnobPos = handles.eq(0).position();
            rightKnobPos = handles.eq(1).position();
        });

        // test track right click
        cy.get(sliderTrackSelector).trigger('click', 'right');
        cy.get('@consoleLog').should('be.calledWith', 'value改变了10,100');

        // test track left click
        cy.get(sliderTrackSelector).trigger('click', 'left');
        cy.get('@consoleLog').should('be.calledWith', 'value改变了0,30');

        // check final knob position
        cy.get(sliderHandleSelector).should((handles) => {
            expect(handles.eq(0).position()).deep.equal(leftKnobPos);
            expect(handles.eq(1).position()).deep.equal(rightKnobPos);
        });

        // test left knob slide
        cy.get(sliderHandleSelector).eq(0)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 100, pageY: 0 })
            .trigger('mouseup', { force: true });

        // test right knob slide
        cy.get(sliderHandleSelector).eq(1)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 600, pageY: 0 })
            .trigger('mouseup', { force: true });

        cy.get(sliderHandleSelector).should((handles) => {
            expect(handles.eq(0).position()).deep.equal(leftKnobPos);
            expect(handles.eq(1).position()).deep.equal(rightKnobPos);
        });
    });

    it('controlled vertical slider', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        const parentSelector = '[data-cy=horizontalNoChangeVerticalSlider]';
        const sliderTrackSelector = `${parentSelector} .semi-slider-rail`;
        const sliderHandleSelector = `${parentSelector} .semi-slider-handle`;

        let handleInitialPos;
        cy.get(sliderHandleSelector).then(($handle) => {
            handleInitialPos = $handle.position();
        });

        // test track click
        cy.get(sliderTrackSelector).trigger('click', 'bottom');
        cy.get('@consoleLog').should('be.calledWith', 'value改变了100');

        cy.get(sliderHandleSelector).should(($button) => {
            expect($button.position()).deep.equal(handleInitialPos);
        });

        // test knob slide
        cy.get(sliderHandleSelector)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 0, pageY: 600 })
            .trigger('mouseup', { force: true });

        cy.get(sliderHandleSelector).should(($button) => {
            expect($button.position()).deep.equal(handleInitialPos);
        });
    });

    it('keyboard', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--horizontal-slider&args=&viewMode=story');
        cy.get('.semi-slider-handle').eq(0).click();
        // test keyboard event: upArrow
        cy.get('.semi-slider-handle').eq(0).type('{upArrow}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '1');
        // test keyboard event: rightArrow
        cy.get('.semi-slider-handle').eq(0).type('{rightArrow}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '2');
        // test keyboard event: downArrow
        cy.get('.semi-slider-handle').eq(0).type('{downArrow}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '1');
        // test keyboard event: leftArrow
        cy.get('.semi-slider-handle').eq(0).type('{leftArrow}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '0');
        // test keyboard event: pageup
        cy.get('.semi-slider-handle').eq(0).type('{pageup}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '10');
        // test keyboard event: pagedown
        cy.get('.semi-slider-handle').eq(0).type('{pagedown}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '0');
        // test keyboard event: End
        cy.get('.semi-slider-handle').eq(0).type('{end}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '100');
        // test keyboard event: Home
        cy.get('.semi-slider-handle').eq(0).type('{home}');
        cy.get('.semi-slider-handle').eq(0).should('have.attr', 'aria-valuenow', '0');
        // test keyboard event: tab
        cy.get('.semi-slider-handle').eq(0).realPress("Tab");
        cy.get('.semi-slider-handle').eq(1).should('be.focused');
    });

    it('range', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--horizontal-slider&args=&viewMode=story');
        // click range slider right dot
        cy.get('.semi-slider-handle').eq(2).click();
        cy.get('.semi-slider-handle').eq(2).type('{pageup}').type('{pageup}').type('{pageup}').type('{pageup}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '60');
        // The value of the left slider cannot exceed the value of the right slider
        cy.get('.semi-slider-handle').eq(2).type('{pageup}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '60');
        cy.get('.semi-slider-handle').eq(2).type('{rightArrow}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '60');
        cy.get('.semi-slider-handle').eq(2).type('{End}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '60');
        // The value of the right slider cannot be lower than the value of the left slider
        cy.get('.semi-slider-handle').eq(2).realPress("Tab");
        cy.get('.semi-slider-handle').eq(3).type('{pagedown}');
        cy.get('.semi-slider-handle').eq(3).should('have.attr', 'aria-valuenow', '60');
        cy.get('.semi-slider-handle').eq(3).type('{leftArrow}');
        cy.get('.semi-slider-handle').eq(3).should('have.attr', 'aria-valuenow', '60');
        cy.get('.semi-slider-handle').eq(3).type('{Home}');
        cy.get('.semi-slider-handle').eq(3).should('have.attr', 'aria-valuenow', '60');
        cy.get('.semi-slider-handle').eq(3).type('{pageup}');
        cy.get('.semi-slider-handle').eq(3).should('have.attr', 'aria-valuenow', '70');
        cy.get('.semi-slider-handle').eq(3).type('{End}');
        cy.get('.semi-slider-handle').eq(3).should('have.attr', 'aria-valuenow', '100');

        cy.get('.semi-slider-handle').eq(2).click();
        cy.get('.semi-slider-handle').eq(2).type('{pagedown}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '50');
        cy.get('.semi-slider-handle').eq(2).type('{Home}');
        cy.get('.semi-slider-handle').eq(2).should('have.attr', 'aria-valuenow', '0');
    });

    it('should show tooltip when hovering slider handler', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--controlled-slider-demo&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--horizontal-slider&args=&viewMode=story');
        cy.get('.semi-slider-handle').eq(0).trigger('mouseover');
        cy.get('.semi-slider-handle-tooltip').eq(0).should('have.text', '0');
    });

    it('should update value correctly in a scrollable container', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=slider--fix-2931&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        const parentSelector = '#horizontal-slider-container';
        const sliderHandleSelector = `${parentSelector} .semi-slider-handle`;
        const sliderTrackSelector = `${parentSelector} .semi-slider-rail`;

        // Scroll the container to the right
        cy.get(parentSelector).scrollTo('right');

        // test track click
        let handleInitialPos;
        cy.get(sliderHandleSelector).then(($handle) => {
            handleInitialPos = $handle.position();
        });

        cy.get(sliderTrackSelector).trigger('click', { pageX: 500, pageY: 0, force: true });
        cy.get('@consoleLog').should('be.calledWith', 'value改变了50');
    });
});
