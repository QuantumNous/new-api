describe('carousel', () => {
    it('ref method with control', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=carousel--controlled-usage&args=&viewMode=story');
        cy.get('.semi-carousel-content-item-active h3').contains('1');
        cy.get('div').contains('prev').click();
        cy.get('.semi-carousel-content-item-active h3').contains('5');
        cy.get('div').contains('next').click();
        cy.get('.semi-carousel-content-item-active h3').contains('1');
        
        cy.clock();
        cy.get('div').contains('play').click();
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('2');
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

        cy.get('div').contains('stop').click();
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

        cy.get('div').contains('play').click();
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('4');

        cy.get('div').contains('goTo3').click();
        cy.get('.semi-carousel-content-item-active h3').contains('3');

    });

    it.skip('ref method without control', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=carousel--ref-usage&args=&viewMode=story');
        cy.get('.semi-carousel-content-item-active h3').contains('1');

        cy.clock();
        cy.get('div').contains('play').click();
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('2');

        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

        cy.get('div').contains('stop').click();
        cy.tick(7300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

        cy.get('div').contains('prev').click();
        cy.tick(300);
        cy.get('.semi-carousel-content-item-active h3').contains('2');

        cy.get('div').contains('goTo3').click();
        cy.tick(300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

        cy.get('div').contains('next').click();
        // cy.tick(300);
        cy.get('.semi-carousel-content-item-active h3').contains('4');
    });

    it('mouseover and mouseleave', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=carousel--ref-usage&args=&viewMode=story');
        cy.get('.semi-carousel-content-item-active h3').contains('1');

        cy.clock(new Date().getTime());
        cy.get('div').contains('play').click();
        cy.tick(2300);
        cy.get('.semi-carousel-content-item-active h3').contains('2');

        cy.get('.semi-carousel').trigger('mouseover');
        cy.tick(400);
        cy.get('.semi-carousel-content-item-active h3').contains('2');

        cy.clock().invoke('restore');

        // todo: mouseleave test
        // cy.clock();
        // cy.get('#root').trigger('mousemove', 'right');
        // cy.wait(3000);
        // cy.get('.semi-carousel-content-item-active h3', { timeout: 0 }).contains('3');

    });

    it('auto play interval', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=carousel--auto-play-example&args=&viewMode=story');

        cy.get('.semi-carousel-content-item-active h3').contains('1');
        cy.wait(1300);
        cy.get('.semi-carousel-content-item-active h3').contains('2');
        cy.wait(1300);
        cy.get('.semi-carousel-content-item-active h3').contains('3');

    });

    it('slide direction', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=carousel--slide-direction&args=&viewMode=story');

        cy.get('.semi-carousel-arrow-next').click();
        cy.get('.semi-carousel-content-item-active h3').contains('index1');
        cy.get('.semi-carousel-content-item-slide-out').contains('index0');
        cy.get('.semi-carousel-content-item-slide-in').contains('index1');
    });

});