import { clear } from 'jest-date-mock';
import * as _ from 'lodash';

import Tooltip from '../index';
import Button from '../../button';
import Select from '../../select';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { strings } from '../../../semi-foundation/tooltip/constants';

import { genAfterEach, genBeforeEach, mount, sleep } from '../../_test_/utils';

describe(`Tooltip`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test appearance`, async () => {
        const containerId = `container`;
        const scrollItemId = `scroll-item`;
        const scrollContainerId = `scroll-container`;
        const triggerId = `trigger`;

        const demo = mount(
            <div
                style={{
                    height: 320,
                    width: 320,
                    display: 'inline-block',
                    overflow: 'auto',
                    padding: 50,
                    marginTop: 100,
                }}
                id={scrollContainerId}
            >
                <div style={{ height: 480, width: 320 }} id={scrollItemId}>
                    <div id={containerId}></div>
                    <Tooltip
                        motion={false}
                        content={'Content'}
                        visible={true}
                        trigger={'click'}
                        getPopupContainer={() => document.getElementById(containerId)}
                    >
                        <Button id={triggerId}>Click here</Button>
                    </Tooltip>
                </div>
            </div>
        );

        const elem = demo.find(Tooltip);
        const tooltipOuter = document.querySelector(`.${BASE_CLASS_PREFIX}-portal-inner`);

        // check if rendered
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`).length).toBe(1);

        // scroll
        await sleep(100);
        const deltaY = 50;
        const scrollContainer = demo.find(`#${scrollContainerId}`);
        const oldTop = window.getComputedStyle(tooltipOuter).top;
        scrollContainer.getDOMNode().scrollTop += deltaY;
        scrollContainer.simulate('scroll');
        await sleep(100);
        const curTop = window.getComputedStyle(tooltipOuter).top;
        expect(oldTop).toBe(curTop);

        // click inside
        document.querySelector(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`).click();
        await sleep(100);
        expect(elem.state(`visible`)).toBe(true);

        // click outside
        // document.body.click();
        document.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
        // demo.find(`#${triggerId}`)
        //     .at(0)
        //     .simulate(`mouseDown`);
        await sleep(100);
        expect(elem.state('visible')).toBe(false);

        // click button to show tooltip
        document.getElementById(triggerId).click();
        await sleep(100);
        expect(elem.state('visible')).toBe(true);

        // unmount elem
        demo.unmount();
        await sleep(100);
        // document.body.click();
        document.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
        expect(document.getElementsByClassName(`${BASE_CLASS_PREFIX}-tooltip-wrapper`).length).toBe(0);
    });

    test(`test appearance with motion`, async () => {
        const containerId = 'container';
        const scrollItemId = `scroll-item`;
        const scrollContainerId = `scroll-container`;
        const triggerId = `trigger`;

        const refObj = { current: null };
        const refFn = sinon.spy();

        const demo = mount(
            <div style={{ height: 2000 }}>
                <div
                    style={{
                        height: 320,
                        width: 320,
                        display: 'inline-block',
                        overflow: 'auto',
                        padding: 50,
                        marginTop: 100,
                    }}
                    id={scrollContainerId}
                >
                    <div style={{ height: 480, width: 320 }} id={scrollItemId}>
                        <div id={containerId}></div>
                        <Tooltip
                            motion={true}
                            showArrow={true}
                            content={'Content'}
                            visible={true}
                            trigger={'click'}
                            getPopupContainer={() => document.getElementById(containerId)}
                        >
                            <Button ref={refObj} id={triggerId}>
                                Click here
                            </Button>
                        </Tooltip>
                        {/* <Tooltip
                            disabled={true}
                            motion={true}
                            showArrow={true}
                            content={'Content'}
                            visible={true}
                            trigger={'click'}
                            getPopupContainer={() => document.getElementById(containerId)}
                        >
                            <Button disabled block>
                                Click here
                            </Button>
                        </Tooltip> */}
                        <Tooltip
                            motion={true}
                            showArrow={true}
                            content={'Content'}
                            visible={true}
                            trigger={'click'}
                            // getPopupContainer={() => document.getElementById(containerId)}
                            wrapWhenSpecial={false}
                        >
                            <Button ref={refFn}>Click here</Button>
                        </Tooltip>
                    </div>
                </div>
            </div>
        );

        await sleep(100);
        const portalInners = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-portal-inner`);
        expect(portalInners.length).toBe(2);

        expect(refObj.current).not.toBeNull();
        expect(refFn.called).toBeTruthy();

        // click outside
        // document.body.click();
        document.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
        await sleep(100);
        expect(
            demo
                .find(Tooltip)
                .map(el => el.state('visible'))
                .reduce((count, v) => (v ? count + 1 : count), 0)
        ).toBe(0);
    });

    test(`test special appearance`, async () => {
        const containerId = 'container';
        const scrollItemId = `scroll-item`;
        const scrollContainerId = `scroll-container`;

        const demo = mount(
            <div style={{ height: 2000 }}>
                <div
                    style={{
                        height: 320,
                        width: 320,
                        display: 'inline-block',
                        overflow: 'auto',
                        padding: 50,
                        marginTop: 100,
                    }}
                    id={scrollContainerId}
                >
                    <div style={{ height: 480, width: 320 }} id={scrollItemId}>
                        <div id={containerId}></div>
                        <Tooltip motion={true} showArrow={true} content={'Content'} visible={true} trigger={'click'}>
                            <span style={{ display: 'block' }}>Click here</span>
                        </Tooltip>
                        <Tooltip motion={true} showArrow={true} content={'Content'} visible={true} trigger={'click'}>
                            <Button block>Click here</Button>
                        </Tooltip>
                        <Tooltip motion={true} showArrow={true} content={'Content'} visible={true} trigger={'click'}>
                            Click Me
                        </Tooltip>
                    </div>
                </div>
            </div>
        );

        await sleep(100);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-portal-inner`).length).toBe(3);
        // expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-icons-triangle_arrow`).length).toBe(3);
    });

    test(`test events`, async () => {
        const close = sinon.spy(() => {
            demo.setProps({ visible: false });
        });

        const demo = mount(
            <Tooltip
                motion={true}
                showArrow={true}
                content={
                    <article>
                        <Button onClick={close} />
                    </article>
                }
                visible={true}
                trigger={'click'}
            >
                <span style={{ display: 'block' }}>Click here</span>
            </Tooltip>
        );

        await sleep(100);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-portal-inner`).length).toBe(1);

        document.querySelector(`.${BASE_CLASS_PREFIX}-portal-inner .${BASE_CLASS_PREFIX}-button`).click();
        await sleep(100);
        expect(demo.state('visible')).toBe(false);
    });

    test(`vertical position: `, async () => {
        const close = sinon.spy(() => {
            demo.setProps({ visible: false });
        });

        const demo = mount(
            <Tooltip
                position="left"
                motion={true}
                showArrow={true}
                content={
                    <article>
                        <Button onClick={close} />
                    </article>
                }
                visible={true}
                trigger={'click'}
                motion={() => false}
            >
                <span style={{ display: 'block' }}>Click here</span>
            </Tooltip>
        );

        await sleep(100);
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-portal-inner svg path`).getAttribute('d')).toBe('M0 0L1 0C1 4, 2 5.5, 4 7.5S7,10 7,12S6 14.5, 4 16.5S1,20 1,24L0 24L0 0z');

    });
    test(`test position: `, async () => {
        const positionList = strings.POSITION_SET
        for (const position of positionList) {
            const demo = mount(
                <Tooltip
                    position={position}
                    content={
                        <article>
                            1
                        </article>
                    }
                    visible={true}
                >
                    <span style={{ display: 'block' }}>Click here</span>
                </Tooltip>
            );
            await sleep(100);
            expect(document.querySelector(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`).getAttribute('x-placement')).toBe(position);
        }
    });

  it(`test click outside handler`, async () => {
    const containerId = `container`
    const demo = mount(
      <div style={{ height: 480, width: 320 }}>
        <div id={containerId}>Hello Semi</div>
        <Tooltip
          content='Content'
          trigger='click'
          motion={false}
        >
          <Button >Click here</Button>
        </Tooltip>
      </div>
    );

    const toolTipElem = demo.find(Tooltip);
    const buttonElem = demo.find(Button);
    // click inside
    buttonElem.simulate('click');
    toolTipElem.update();
    await sleep(100);
    expect(toolTipElem.state(`visible`)).toBe(true);

    // click outside
    // document.body.click();
    document.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
    toolTipElem.update();
    await sleep(100);
    expect(toolTipElem.state('visible')).toBe(false);

    // click button to show tooltip
    buttonElem.simulate('click');
    toolTipElem.update();
    await sleep(100);
    expect(toolTipElem.state('visible')).toBe(true);

    document.getElementById(containerId).dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
    toolTipElem.update();
    await sleep(100);
    expect(toolTipElem.state('visible')).toBe(false);
  });
});

it('wrapperClassName', () => {
    const wrapperWithMultipleChildren = mount(
        <Tooltip wrapperClassName='test' content={'hi bytedance'}>
            <Button>正常的多个按钮</Button>
            <Button>正常的多个按钮</Button>
        </Tooltip>
    );
    expect(wrapperWithMultipleChildren.exists('.test')).toEqual(true);
    const wrapperWithDisabledButton = mount(
        <Tooltip wrapperClassName='test' content={'hi bytedance'}>
            <Button disabled>正常的多个按钮</Button>
        </Tooltip>
    );
    expect(wrapperWithDisabledButton.exists('.test')).toEqual(true);
    const wrapperWithDisabledSelect = mount(
        <Tooltip wrapperClassName='test' content={'hi bytedance'}>
            <Select disabled placeholder='请选择业务线' style={{ width: 120 }}>
                <Select.Option value='abc'>抖音</Select.Option>
                <Select.Option value='hotsoon'>火山</Select.Option>
                <Select.Option value='jianying' disabled>剪映</Select.Option>
                <Select.Option value='xigua'>西瓜视频</Select.Option>
            </Select>
        </Tooltip>
    );
    expect(wrapperWithDisabledSelect.exists('.test')).toEqual(true);
});
