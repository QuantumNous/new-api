import { Icon, Dropdown, Tag } from '../../index';
import { string } from 'prop-types';
import { noop, drop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import {sleep} from "../../_test_/utils";

const defaultItems = [{ children: 'Menu Item 1' }, { children: 'Menu Item 2' }, { children: 'Menu Item 3' }];

function getSubMenu(items = defaultItems) {
    let dropdownItems = items.map(item => <Dropdown.Item {...item} />);
    return <Dropdown.Menu>{dropdownItems}</Dropdown.Menu>;
}

function getDD(props) {
    let bcProps = {
        // Dropdown use Popup Layer to show candidate option,
        // but all Popup Layer which extends from Tooltip (eg Popover, Dropdown) have animation and delay.
        // Turn off animation and delay during testing, to avoid wating (something like setTimeOut/balabala...) in the test code
        motion: false,
        mouseEnterDelay: 0,
        mouseLeaveDelay: 0,
        render: getSubMenu(),
        children: <Tag>semi dropdown</Tag>,
        ...props,
    };
    return mount(<Dropdown {...bcProps}></Dropdown>, {
        attachTo: document.getElementById('container'),
    });
}

let el_portal_inner = `.${BASE_CLASS_PREFIX}-portal-inner`;
let el_item = `.${BASE_CLASS_PREFIX}-dropdown-item`;

describe('Dropdown', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
    });

    it('Dropdown-custom className & style', () => {
        let props = {
            visible: true,
            trigger: 'custom',
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const dropdown = getDD(props);
        expect(dropdown.exists(`.${BASE_CLASS_PREFIX}-dropdown-wrapper.test`)).toEqual(true);
        expect(dropdown.find(`.${BASE_CLASS_PREFIX}-dropdown`)).toHaveStyle('color', 'red');
    });

    // Dropdown can't find `.${BASE_CLASS_PREFIX}-portal` (can confirm it't existence through documenty.body.innerHTML)
    // but find `.${BASE_CLASS_PREFIX}-portal-inner`

    // 由于.${BASE_CLASS_PREFIX}-portal 不是有dropdown或其子元素的render函数渲染出来的dom，而是portal在constructore阶段通过createElement/appendChild 插入的，所以无法使用find来找
    // 只能通过document.querySelector来获取
    it('Dropdown-zIndex', () => {
        let zIndex = 2000;
        let props = {
            visible: true,
            trigger: 'custom',
            zIndex: zIndex,
        };
        const dropdown = getDD(props);
        expect(Number(document.querySelector(`.${BASE_CLASS_PREFIX}-portal`).style.zIndex)).toEqual(zIndex);
    });

    it('Dropdown-trigger-hover', async () => {
        let props = {
            trigger: 'hover',
        };
        const dropdown = getDD(props);
        // Before hover, dropdown is not displayed
        expect(dropdown.exists(el_portal_inner)).toEqual(false);
        // After trigger, dropdown content will show
        dropdown.find(`.${BASE_CLASS_PREFIX}-tag`).simulate('mouseEnter', {});
        expect(dropdown.exists(el_portal_inner)).toEqual(true);
        expect(dropdown.find(el_item)).toHaveLength(3);
        await sleep(1000);
        // auto hide
        dropdown.find(`.${BASE_CLASS_PREFIX}-tag`).simulate('mouseLeave', {});
        await sleep(1000);
        expect(dropdown.exists(el_portal_inner)).toEqual(false);
        expect(dropdown.find(el_item)).toHaveLength(0);
    });

    it('Dropdown-trigger-click', () => {
        let props = {
            trigger: 'click',
        };
        const dropdown = getDD(props);
        // Before click
        expect(dropdown.exists(el_portal_inner)).toEqual(false);
        expect(dropdown.exists(el_item)).toEqual(false);
        // After click
        dropdown.find(`.${BASE_CLASS_PREFIX}-tag`).simulate('click', {});
        expect(dropdown.exists(el_portal_inner)).toEqual(true);
        expect(dropdown.find(el_item)).toHaveLength(3);
    });

    it('Dropdown-contentClassName', () => {
        let props = {
            contentClassName: 'test',
            trigger: 'custom',
            visible: true,
        };
        const dd = getDD(props);
        expect(dd.exists(`.${BASE_CLASS_PREFIX}-dropdown.test`)).toEqual(true);
    });

    // TODO ??? visibleChange在Jest中没有被触发，实际上代码是work的
    // it('Dropdown-onVisibleChange', () => {
    //     let onVisibleChange = visible => {
    //         debugger;
    //     };
    //     // let spyVisibleChange = sinon.spy(onVisibleChange);
    //     let props = {
    //         trigger: 'hover',
    //         onVisibleChange: onVisibleChange,
    //     };
    //     const dropdown = getDD(props);
    //     dropdown.find(`.${BASE_CLASS_PREFIX}-tag`).simulate('mouseEnter', {});
    //     expect(spyVisibleChange.calledOnce).toBe(true);
    //     expect(spyVisibleChange.calledWithMatch(true)).toBe(true);
    //     dropdown.find(`.${BASE_CLASS_PREFIX}-tag`).simulate('mouseLeave', {});
    //     expect(spyVisibleChange.calledWithMatch(false)).toBe(true);
    // });

    // it('Dropdown-clickToHide', () => {
    //     let props = {
    //         clickToHide: true,
    //     };
    // });

    it('Dropdown-showTick', () => {
        let items = [{ children: 'Item 1' }, { active: true, children: 'Item 2' }, { children: 'Item 3' }];
        let props = {
            showTick: true,
            render: getSubMenu(items),
            visible: true,
            trigger: 'custom',
        };
        let DD = getDD(props);
        expect(DD.find(`.${BASE_CLASS_PREFIX}-dropdown-item-withTick.${BASE_CLASS_PREFIX}-dropdown-item-active`).text()).toEqual('Item 2');
    });

    it('Dropdown.Item active', () => {
        let items = [{ children: 'Item 1' }, { active: true, children: 'Item 2' }, { children: 'Item 3' }];
        let props = {
            render: getSubMenu(items),
            visible: true,
            trigger: 'custom',
        };
        let DD = getDD(props);
        expect(DD.find(`.${BASE_CLASS_PREFIX}-dropdown-item-active`).text()).toEqual('Item 2');
    });

    it('Dropdown.Item type', () => {
        let types = ['primary', 'secondary', 'tertiary', 'warning', 'danger'];
        let items = types.map(type => {
            return { type, children: `${type}Item` };
        });
        let props = {
            render: getSubMenu(items),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        items.forEach(item => {
            expect(DD.find(`.${BASE_CLASS_PREFIX}-dropdown-item-${item.type}`).text()).toEqual(`${item.children}`);
        });
    });

    it('Dropdown.Item className & style', () => {
        let items = [
            { type: 'primary', children: 'primaryItem', className: 'primary-test', style: { color: 'red' } },
            { type: 'secondary', children: 'secondaryItem' },
        ];
        let props = {
            render: getSubMenu(items),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        expect(DD.find('li.primary-test')).toHaveStyle('color', 'red');
    });

    it('Dropdown.Item disabled', () => {
        let items = [
            { disabled: true, children: 'Item 1' },
            { disabled: false, children: 'Item 2' },
        ];
        let props = {
            render: getSubMenu(items),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        expect(DD.find(`.${BASE_CLASS_PREFIX}-dropdown-item-disabled`).text()).toEqual('Item 1');
    });

    it('Dropdown.Item onClick', () => {
        let onClick = event => {};
        let spyItemCLick = sinon.spy(onClick);
        let items = [{ children: 'A' }, { children: 'B', onClick: spyItemCLick, className: 'test' }];
        let props = {
            render: getSubMenu(items),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        let targetItem = DD.find('li.test');
        let event = {
            button:0,
            target: {
                value: 'B1',
            },
        };
        targetItem.simulate('click', event);
        expect(spyItemCLick.calledOnce).toEqual(true);
        expect(spyItemCLick.calledWithMatch(event)).toEqual(true);
    });

    it('Dropdown.Item onMouseEnter/onMouseLeave', () => {
        let onMouseEnter = e => {};
        let spyItemMouseEnter = sinon.spy(onMouseEnter);
        let spyItemMouseLeave = sinon.spy(e => {});
        let items = [
            { children: 'A' },
            { children: 'B', onMouseEnter: spyItemMouseEnter, onMouseLeave: spyItemMouseLeave, className: 'test' },
        ];
        let props = {
            render: getSubMenu(items),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        let targetItem = DD.find('li.test');
        let event = {
            target: {
                value: 'B1',
            },
        };
        targetItem.simulate('mouseEnter', event);
        expect(spyItemMouseEnter.calledOnce).toEqual(true);
        expect(spyItemMouseEnter.calledWithMatch(event)).toEqual(true);
        targetItem.simulate('mouseLeave', event);
        expect(spyItemMouseLeave.calledOnce).toEqual(true);
        expect(spyItemMouseLeave.calledWithMatch(event)).toEqual(true);
    });

    it('Dropdown.Title className & style', () => {
        let props = {
            render: (
                <Dropdown.Menu>
                    <Dropdown.Title className="test" style={{ margin: 5 }}>
                        分组1
                    </Dropdown.Title>
                    <Dropdown.Item>primary</Dropdown.Item>
                    <Dropdown.Item type="secondary">secondary</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Title>分组2</Dropdown.Title>
                    <Dropdown.Item type="danger">danger</Dropdown.Item>
                </Dropdown.Menu>
            ),
            trigger: 'custom',
            visible: true,
        };
        let DD = getDD(props);
        expect(DD.find('div.test')).toHaveStyle('margin', 5);
    });


    it('Dropdown array menu', () => {
        const menu = [
            { node: 'title', name: '分组1' },
            { node: 'item', name: 'primary1', type: 'primary', onClick: () => console.log('click primary') },
            { node: 'item', name: 'secondary', type: 'secondary' },
            { node: 'divider', },
            { node: 'title', name: '分组2' },
            { node: 'item', name: 'tertiary', type: 'tertiary' },
            { node: 'item', name: 'warning', type: 'warning', active: true },
            { node: 'item', name: 'danger', type: 'danger' },
        ];
        let DD = mount(<Dropdown menu={menu} trigger="custom" visible ></Dropdown>, {
            attachTo: document.getElementById('container'),
        });
        expect(DD.find('.semi-dropdown-menu').children().length).toEqual(menu.length);
        const menu2 = [
            { node: 'title', name: '分组1', iconType: 'menu' },
            { node: 'item', name: 'secondary', type: 'secondary' },
            { node: 'divider', },
            { node: 'title', name: '分组2' },
            { node: 'invalid node', name: '分组2' },
        ];
        DD.setProps({ menu: menu2 })
        DD.update()
        expect(DD.find('.semi-dropdown-menu').children().length).toEqual(menu2.length - 1);
    });
});
