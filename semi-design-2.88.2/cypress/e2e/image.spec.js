describe('image', () => {
    it('basic image', () => {
        // 1. Image 基础功能测试，点击图片，打开预览，点击预览区域，关闭预览
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        // 测试图片宽高是否和设置一致, width, height API
        cy.get('.semi-image-img-preview').should('have.css', 'width').and('eq', '360px');
        cy.get('.semi-image-img-preview').should('have.css', 'height').and('eq', '200px');
        // 点击图片区域触发预览
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        // 点击预览非操作区域触发预览关闭
        cy.get('.semi-image-preview').click();
        cy.get('.semi-image-preview').should('not.exist');
    
        // 2. Image 设置 preview = {false}, 不可预览
        cy.get('#preview').children('.semi-switch').click();
        cy.get('.semi-image-img').click();
        cy.get('.semi-image-preview').should('not.exist');
    });

    it('load error Image', () => {
        // 图片加载失败显示加载失败样式
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--load-error-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-image-status').eq(0).children('.semi-icon-upload_error').should('exist');
        // 测试自定义加载失败占位图 fallback API
        cy.get('.semi-image-status').eq(1).children('span').should('have.attr', 'style').should('contain', 'font-size: 50px;');
    });

    it('controlled Preview single', () => {
        // 测试单独使用 ImagePreview 的 visible 受控显示功能
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--controlled-preview-single&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-button').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('.semi-image-preview').click();
        cy.get('.semi-image-preview').should('not.exist');
    });

    it('image show controlled', () => {
        // 测试 Image 的 visible 受控显示功能
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--image-show-controlled&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('.semi-image-preview').click();
        cy.get('.semi-image-preview').should('not.exist');
    });

    it('controlled preview multiple', () => {
        // 测试 多个 Image 的 visbile 受控显示功能
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--controlled-preview-multiple&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-button').click();
        cy.get('.semi-image-preview').should('exist');
        // 切换到下一张图片
        cy.get('.semi-image-preview-next').should('be.visible');
        cy.get('.semi-image-preview-next').click();
        cy.get('.semi-image-preview-footer-page').contains('2/3');
        cy.get('.semi-image-preview').should('exist');
        // 切换到上一张图片
        cy.get('.semi-image-preview-prev').should('be.visible');
        cy.get('.semi-image-preview-prev').click();
        cy.get('.semi-image-preview-footer-page').contains('1/3');
    });

    // 测试鼠标拖拽图片
    it('mouse drag', () => {
        cy.viewport(1440, 800);
        // 设置的视宽1440px, 高800px，根据 ImagePreview 的计算规则（以宽高中最大 padding 为80px（平均分到左右，上下）为准），
        // 图片的原始尺寸为1440px, 高800px
        // 对于当前图片而言，会以高为基准，则缩放比例 zoom = （800 - 80）/ 800 = 0.9开始
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.wait(200);
        // 验证打开预览时候的 zoom 为0.9， 即宽1296px，高为720px
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1296px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '720px');
        // 点击放大按钮
        cy.get('.semi-image-preview-footer').children('.semi-icon-plus').click();
        cy.wait(200);
        // 默认的单次点击步长是0.1，预期单次点击之后的 zoom 为 1， 即宽度为和原来的尺寸一致，宽1440px, 高800px
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1440px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '800px');
        cy.get('.semi-image-preview-footer').children('.semi-icon-plus').click();
        cy.get('.semi-image-preview-footer').children('.semi-icon-plus').click();
        cy.wait(200);
        // 再经过两次点击放大后，预期 zoom = 1.2， 宽1728px， 高960px， translate.x = 0 translate.y = 0
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1728px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '960px'); 
        
        // zoom = 1.2， 宽1728px， 高960px， translate.x = 0 translate.y = 0, 鼠标移动 x * y = 200 * 100, 
        // (1728 - 1440) / 2 = 144 | (960 - 800) / 2 = 80
        // 图片拖动策略是图片只能够拖动到图片边缘和容器边缘重合，因此预期 translate.y 为 144，translate.x 为 80
        cy.get('.semi-image-preview-image-img').trigger('mousedown', { clientX: 0, clientY: 0 });
        cy.wait(200);
        cy.get('.semi-image-preview-image-img').trigger('mousemove', { clientX: 200, clientY: 100, buttons: 1 });
        cy.wait(200);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'style').should('contain', 'translate(144px, 80px)');
    });

    // 测试鼠标滚动滚轮放大，缩小图片
    it('mouse wheel', () => {
        cy.viewport(1440, 800);
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-image-img-preview').click();
        // zoom = 0.9， width = '1296px'，height = '720px'
        cy.get('.semi-image-preview').should('exist');
        cy.wait(200);
        // 验证滚轮向上滚动放大图片
        cy.get('.semi-image-preview-image-img').trigger('mouseover', { clientX: 720, clientY: 400 });
        // 触发 wheel 事件， 参数 deltaY 表示纵向滚动量， 
        cy.get('.semi-image-preview-image-img').trigger('wheel', { deltaY: -10, bubbles: true });
        // 单次滚动向上滚动滚轮，zoom = zoom + zoomStep = 1, width = '1440px', height = '800px'
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1440px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '800px');
        // 验证滚轮向下滚动缩小图片
        cy.get('.semi-image-preview-image-img').trigger('mouseover', { clientX: 720, clientY: 400 });
        // 触发 wheel 事件， 参数 deltaY 表示纵向滚动量， 验证缩小
        cy.get('.semi-image-preview-image-img').trigger('wheel', { deltaY: 10, bubbles: true });
        // 单次滚动向下滚动滚轮，zoom = zoom - zoomStep = 0.9,  width = '1296px'，height = '720px'
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1296px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '720px');
    });

    // 测试自定义预览图片功能： 预览图片和 Image 中的图片 src 不同
    it('custom preview Image', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--custom-preview-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('.semi-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-small.jpeg');
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-big.png');
    });

    // 通过回调函数 API
    it('test callback func', () => {
        cy.viewport(1200, 800);
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--test-call-back-func&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.wait(3000);

        cy.get('.semi-image-img-preview').eq(1).click();
        cy.wait(100);
        
        // 测试点击 footer 上一张按钮回调
        cy.get('.semi-image-preview-footer').children('.semi-icon-chevron_left').click();
        cy.get('@consoleLog').should('be.calledWith', 'prev');

        // 测试点击 footer 操作区域下一张按钮回调
        cy.get('.semi-image-preview-footer').children('.semi-icon-chevron_right').click();
        cy.get('@consoleLog').should('be.calledWith', 'next');

        // 测试点击 middle 下一张按钮回调
        cy.get('.semi-icon-arrow_right').click();
        cy.get('@consoleLog').should('be.calledWith', 'next');

        // 测试点击 middle 上一张按钮回调
        cy.get('.semi-icon-arrow_left').click();
        cy.get('@consoleLog').should('be.calledWith', 'prev');

        // 测试预览 footer 操作区域的放大，缩小回调
        cy.get('.semi-image-preview-footer').children('.semi-icon-plus').click();
        cy.get('.semi-image-preview-footer').children('.semi-icon-minus').click();
        cy.get('@consoleLog').should('be.calledWith', 'zoom out');
        cy.get('.semi-image-preview-footer').children('.semi-icon-plus').click();
        cy.get('@consoleLog').should('be.calledWith', 'zoom in');

        // 测试拖拽按钮是否触发回调
        const sliderHandleSelector ='.semi-slider-handle';
        // test knob slide
        cy.get(sliderHandleSelector)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 1200, pageY: 0 })
            .trigger('mouseup', { force: true });
        cy.get('@consoleLog').should('be.calledWith', 'zoom in');

        cy.get(sliderHandleSelector)
            .trigger('mousedown')
            .trigger('mousemove', { pageX: 0, pageY: 0 })
            .trigger('mouseup', { force: true });
        cy.get('@consoleLog').should('be.calledWith', 'zoom out');
        
        // 测试 footer 下载回调
        cy.get('.semi-image-preview-footer').children('.semi-icon-download').click();
        cy.get('@consoleLog').should('be.calledWith', 'download');

        // 测试 footer 旋转回调
        cy.get('.semi-image-preview-footer').children('.semi-icon-rotate').click();
        cy.get('@consoleLog').should('be.calledWith', 'rotate change');
    });

    // 测试 infinite API
    it('infinite load', () => {
        // 设置 infinite = true 
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-preview&args=&viewMode=story');
        cy.wait(3000);
        cy.get('#infinite').children('.semi-switch').click();
        cy.get('.semi-image-img-preview').eq(1).click();
        cy.wait(100);
        cy.get('.semi-image-preview-prev').click();
        cy.wait(100);
        // 到第一张图片时候，可以通过 prev 按钮 切换到最后一张
        cy.get('.semi-image-preview-prev').should('exist').click();
        cy.wait(100);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beach.jpeg');
        // 从最后一张图片，可以切换到前一张图片
        cy.get('.semi-image-preview-next').should('exist').click();
        cy.wait(100);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg');
    });

    // 测试 closeOnEsc API
    it('basic image', () => {
        // 1. Image 基础功能测试，点击图片，打开预览，点击预览区域，关闭预览
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        // 测试 esc 退出预览功能
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('body').type('{esc}', { force: true });
        cy.get('.semi-image-preview').should('not.exist');
        // closeOnEsc = false, 关闭点击 esc 退出预览功能
        cy.get('#escOut').children('.semi-switch').click();
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('body').type('{esc}', { force: true });
        cy.get('.semi-image-preview').should('exist');
        cy.get('.semi-image-preview').click();
    });

    // 测试 disableDownload API
    it('disable download', () => {
        // 设置 disableDownload，无法下载
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('#disableDownload').children('.semi-switch').click();
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview-footer').children('.semi-icon-download').should('have.class', 'semi-image-preview-footer-disabled');
    });

    // 测试 maskClosable API
    it('maskClosable', () => {
        // 设置 disableDownload，无法下载
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-image&args=&viewMode=story');
        cy.wait(2000);
        cy.get('#maskClosable').children('.semi-switch').click();
        cy.get('.semi-image-img-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('.semi-image-preview').click();
        cy.get('.semi-image-preview').should('exist');
        cy.get('.semi-icon-close').click();
        cy.get('.semi-image-preview').should('not.exist');
    });

    // 测试 getPopupContainer API
    it('custom container', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--custom-container&args=&viewMode=story');
        cy.wait(3000);
        cy.get('.semi-image-img-preview').eq(0).click();
        cy.get('.semi-image-preview').parent('.semi-portal').parent().should('have.attr', 'id', 'container');
    });  

    // 测试自定义预览顶部信息 renderHeader API
    it('custom render top', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--custom-render-title&args=&viewMode=story');
        cy.wait(3000);
        cy.get('.semi-image-img-preview').eq(0).click();
        cy.get('.semi-image-preview').should('exist');
        // 点击预览后，title 部分的信息为自定义信息
        cy.get('.semi-image-preview-header-title').children('div').contains('lamp1');
        cy.get('.semi-image-preview-next').should('be.visible');
        cy.get('.semi-image-preview-next').click();
        // 切换图片后，title 部分会切换为对应的自定义信息
        cy.get('.semi-image-preview-header-title').children('div').contains('lamp2');
    });

    // 测试自定义预览操作区 renderPreviewMenu API
    it('custom render footer', () => {
        cy.viewport(1200, 800);
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--custom-render-footer-menu&args=&viewMode=story', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });
        cy.wait(3000);
        cy.get('.semi-image-img-preview').eq(0).click();
        cy.get('.semi-image-preview').should('exist');
        
        // 点击预览后，footer操作区域信息为自定义页脚信息
        cy.get('.semi-icon-chevron_right').click();
        cy.wait(500);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/seaside.jpeg');
        cy.get('.semi-icon-chevron_left').click();
        cy.wait(500);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg');
        
        // 对于 lion.jpeg（原尺寸1080 * 720）， 因为container（1200 * 800），初始 zoom 为 1 （1080 * 720）
        cy.get('.semi-icon-minus').click();
        cy.wait(500);
        // zoom = 0.9, width * height = 972 * 648
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '972px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '648px');

        cy.get('.semi-icon-plus').click();
        cy.wait(500);
        // zoom = 1, width * height = 1080 * 720
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1080px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '720px');

        cy.get('.semi-icon-plus').click();
        cy.get('.semi-icon-plus').click();
        cy.wait(500);
        // zoom = 1.2,
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1296px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '864px');

        // 点击原始尺寸按钮，zoom = 1， width * height = 1080 * 720
        cy.get('.semi-icon-real_size_stroked').click();
        cy.wait(500);
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1080px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '720px');

        cy.get('.semi-icon-minus').click();
        cy.get('.semi-icon-minus').click();
        cy.wait(500);
        // zoom = 0.8， width * height = 864 * 576
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '864px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '576px');
        
        // 在 container 1200 * 800时， 适应页面尺寸为 zoom 为 1， width * height = 1080 * 720
        cy.get('.semi-icon-window_adaption_stroked').click();
        cy.wait(500);
        cy.get('.semi-image-preview-image-img').should('have.css', 'width').and('eq', '1080px');
        cy.get('.semi-image-preview-image-img').should('have.css', 'height').and('eq', '720px');

        // 测试点击向右旋转，向左旋转按键
        cy.get('.semi-icon-rotate').eq(0).click();
        cy.wait(500);
        cy.get('.semi-image-preview-image-img').should('have.attr', 'style').should('contain', 'rotate(90deg)');
        cy.get('.semi-icon-rotate').eq(1).click();
        cy.get('.semi-image-preview-image-img').should('have.attr', 'style').should('contain', 'rotate(0deg)');

        // 测试下载按键
        cy.get('.semi-icon-download').click();
        cy.get('@consoleLog').should('be.calledWith', 'download');
    });

    // 测试 showTooltip API
    it('show operation tooltip', () => {
        // 测试 Image 的 预览 footer 操作区域 hover 到相关图标是否 tooltip 提示
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-preview&args=&viewMode=story');
        cy.wait(2000);
        cy.get('#showTooltip').children('.semi-switch').click();
        cy.wait(1000);
        cy.get('.semi-image-img-preview').eq(1).click();
        cy.get('.semi-image-preview').should('exist');

        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_left').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('上一张');
        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_left').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_right').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('下一张');
        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_right').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-minus').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('缩小');
        cy.get('.semi-image-preview-footer').find('.semi-icon-minus').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-plus').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('放大');
        cy.get('.semi-image-preview-footer').find('.semi-icon-plus').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('原始尺寸');
        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').click();

        cy.get('.semi-image-preview-footer').find('.semi-icon-window_adaption_stroked').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('适应页面');
        cy.get('.semi-image-preview-footer').find('.semi-icon-window_adaption_stroked').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-rotate').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('旋转');
        cy.get('.semi-image-preview-footer').find('.semi-icon-rotate').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-download').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('下载');
        cy.get('.semi-image-preview-footer').find('.semi-icon-download').trigger('mouseout');
    });

    // 测试 xxxTooltip API
    it('custom operation tooltip', () => {
        // 测试 Image 的 预览 footer 操作区域 hover 到相关图标是否 自定义 tooltip 提示
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-preview&args=&viewMode=story');
        cy.wait(2000);
        cy.get('#showTooltip').children('.semi-switch').click();
        cy.get('#customTooltip').children('.semi-switch').click();
        cy.wait(1000);
        cy.get('.semi-image-img-preview').eq(1).click();
        cy.get('.semi-image-preview').should('exist');

        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_left').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Prev');
        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_left').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_right').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Next');
        cy.get('.semi-image-preview-footer').find('.semi-icon-chevron_right').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-minus').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('ZoomOut');
        cy.get('.semi-image-preview-footer').find('.semi-icon-minus').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-plus').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('ZoomIn');
        cy.get('.semi-image-preview-footer').find('.semi-icon-plus').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Original size');
        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-real_size_stroked').click();

        cy.get('.semi-image-preview-footer').find('.semi-icon-window_adaption_stroked').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Adaption');
        cy.get('.semi-image-preview-footer').find('.semi-icon-window_adaption_stroked').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-rotate').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Rotate');
        cy.get('.semi-image-preview-footer').find('.semi-icon-rotate').trigger('mouseout');

        cy.get('.semi-image-preview-footer').find('.semi-icon-download').trigger('mouseover');
        cy.get('.semi-tooltip-wrapper').contains('Download');
        cy.get('.semi-image-preview-footer').find('.semi-icon-download').trigger('mouseout');
    });

    // 测试在预览状态下，图片改变 ratio 状态后，切换图片，ratio 状态是否正确
    //（在未受控 ratio ，无默认 ratio 情况下，切换后的图片ratio 应该为适应页面）
    it('ratio status after change pic', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--basic-preview&args=&viewMode=story');
        cy.wait(2000);
        // 进入预览状态
        cy.get('.semi-image-img-preview').eq(0).click();
        cy.get('.semi-image-preview').should('exist');
        // 图片默认 ratio 为适应页面，调整为 1:1
        cy.get('.semi-image-preview-footer').children('.semi-icon-real_size_stroked').click();
        // 切换图片到下一张
        cy.get('.semi-image-preview-footer').children('.semi-icon-chevron_right').click();
        cy.wait(1000);
        // 当前 ratio 状态应该为适应页面
        cy.get('.semi-icon-real_size_stroked').should('exist');
    });

    // 测试懒加载状态下 src 变化时候图片是否正常加载
    it('src change', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--issue-1526&args=&viewMode=story');
        // 等待 5000 ms， 确保当前src 已经完全改变上
        cy.wait(5000);
        // 进入预览状态
        cy.get('.semi-image-img').eq(0).should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg');
    });

    // defaultCurrentIndex
    it('defaultCurrentIndex', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--default-current-index&args=&viewMode=storyi');
        cy.get('.semi-button').eq(0).click();
        // 等待 2000 ms， 确保当前src 已经完全改变上
        cy.wait(2000);
        cy.get('.semi-image-preview-image-img').eq(0).should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/seaside.jpeg');
    });

    // 测试懒加载
    it.skip('lazyLoad + lazyLoadMargin', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--lazy-load-image&args=&viewMode=storyi');
        cy.get('.semi-image-img').eq(4).should('have.attr', 'data-src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag5.png');
        cy.get('.semi-image-img').eq(4).should('not.have.attr', 'src');
        cy.get('.semi-image-preview-group').eq(0).scrollTo('bottom');
        cy.get('.semi-image-img').eq(4).should('have.attr', 'src', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag5.png');
        cy.get('.semi-image-img').eq(4).should('not.have.attr', 'data-src');
    });

    // 测试在图片高度非常小时候，图片显示是否正常
    // 关联 issue: https://github.com/DouyinFE/semi-design/issues/1838
    it('small height Image', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--small-height-image&args=&viewMode=storyi');

        cy.get('.semi-image').eq(0) // 获取 div 元素
            .then((divElement) => {
                const divTop = divElement[0].getBoundingClientRect().top; // 获取 div 元素顶部相对于视口顶部的距离
                cy.get('.semi-image-img').eq(0) // 获取 img 元素
                    .then((imgElement) => {
                        const imgTop = imgElement[0].getBoundingClientRect().top; // 获取 img 元素顶部相对于视口顶部的距离
                        expect(imgTop).to.equal(divTop); 
                    });
            });
    });

    // API：previewCls， previewStyle，测试 preview 的 className 和 style 是否生效
    it("previewCls & previewStyle", () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?id=image--preview-cls-and-preview-style&args=&viewMode=storyi');
        cy.wait(4000);
        cy.get('.semi-image-img-preview').eq(0).click();
        cy.get('.semi-image-preview').eq(0).should('have.class', 'test-preview');
        cy.get('.semi-image-preview').eq(0).should('have.attr', 'style').should('contain', 'background: lightblue;');
        cy.get('.semi-image-preview').click();
        cy.get('.semi-image-img-preview').eq(1).click();
        cy.get('.semi-image-preview').eq(0).should('have.class', 'test-imagePreview');
        cy.get('.semi-image-preview').eq(0).should('have.attr', 'style').should('contain', 'background: lightgreen;');
    });
});
