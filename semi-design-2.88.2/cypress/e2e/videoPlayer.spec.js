describe('videoPlayer', () => {

    it('basic element check', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--basic');
        cy.get('.semi-videoPlayer-poster').should('exist');
        cy.get('.semi-videoPlayer-wrapper-dark').should('exist');
        cy.get('.semi-videoPlayer-error').should('not.exist');
        cy.get('.semi-videoPlayer-pause').should('exist');
        cy.get('img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg');
        cy.get('video').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4');
    });
    
    it('control list', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--control-list');
        cy.get('.semi-icon-flip-horizontal').should('not.exist');
        cy.get('.semi-icon-mini_player').should('not.exist');
    });

    it('theme', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--theme');
        cy.get('.semi-videoPlayer-wrapper-dark').should('exist');
        cy.get('.semi-videoPlayer-wrapper-light').should('exist');
    });

    it('set seek time', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--set-seek-time');
        cy.wait(500);
        cy.get('body').type('{rightArrow}');
        cy.get('.semi-videoPlayer-controls-time').contains('00:05').should('exist');
    });

    it('set play list', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--playback-rate-list');
        cy.get('.semi-videoPlayer-controls-menu-item').contains('1.0x').trigger('mouseover');
        cy.get('.semi-videoPlayer-controls-popup-menu-item').contains('1.0x').should('exist');
        cy.get('.semi-videoPlayer-controls-popup-menu-item').contains('1.5x').should('exist');
        cy.get('.semi-videoPlayer-controls-popup-menu-item').contains('2.0x').should('exist');
        cy.get('.semi-videoPlayer-controls-popup-menu-item').contains('1.25x').should('not.exist');
        cy.get('.semi-videoPlayer-controls-popup-menu-item').contains('0.75x').should('not.exist');
    });

    it('volume', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--volume');
        cy.get('.semi-icon-mute').should('exist');
    });

    it('video load error', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--no-resource');
        cy.get('.semi-videoPlayer').contains('视频加载错误').should('exist');
    });

    it('chapter', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=videoplayer--chapter');
        cy.get('.semi-videoPlayer-progress-slider').should('have.length', 4);
        cy.get('.semi-videoPlayer-progress-slider').eq(1).trigger('mouseover');
        cy.get('.semi-tooltip-content').contains('功能介绍').should('exist');
    });
});