import { Cascader, Icon } from '../../index';
import { clear } from 'jest-date-mock';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const animationMs = 200;

const sleep = (ms = animationMs) =>
    new Promise((resolve, reject) =>
        setTimeout(() => {
            resolve(ms);
        }, ms)
    );

const getPopupContainer = () => document.querySelector(`.${BASE_CLASS_PREFIX}-cascader`);

const treeData = [
    {
        label: '亚洲',
        value: 'Asia',
        key: 'Asia',
        children: [
            {
                label: '中国',
                value: 'China',
                key: 'China',
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: 'beijing',
                    },
                    {
                        label: '上海',
                        value: 'Shanghai',
                        key: 'shanghai',
                    },
                ],
            },
        ],
    },
    {
        label: '北美洲',
        value: 'North America',
        key: 'North America',
        children: [
            {
                label: '美国',
                value: 'United States',
                key: 'United States',
            },
            {
                label: '加拿大',
                value: 'Canada',
                key: 'Canada',
            },
        ],
    },
];

const treeDataWithDisabled = [
    {
        label: '亚洲',
        value: 'Asia',
        key: 'Asia',
        children: [
            {
                label: '中国',
                value: 'China',
                key: 'China',
                disabled: true,
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: 'beijing',
                    },
                    {
                        label: '上海',
                        value: 'Shanghai',
                        key: 'shanghai',
                    },
                ],
            },
            {
                label: '韩国',
                value: 'Hanguo',
                key: 'hanguo',
            }
        ],
    }
];

const treeDataWithReactNode = [
    {
        label: <strong>亚洲</strong>,
        value: 'Asia',
        key: 'Asia',
        children: [
            {
                label: '中国',
                value: 'China',
                key: 'China',
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: 'beijing',
                    },
                    {
                        label: <div>上海</div>,
                        value: 'Shanghai',
                        key: 'shanghai',
                    },
                ],
            }
        ],
    },
    {
        label: <p>北美洲</p>,
        value: 'North America',
        key: 'North America',
    }
];

let commonProps = {
    // Cascader use Popup Layer to show candidate option,
    // but all Popup Layer which extends from Tooltip (eg Popover, Dropdown) have animation and delay.
    // Turn off animation and delay during testing, to avoid wating (something like setTimeOut/balabala...) in the test code
    motion: false,
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0,
};

function render(props) {
    props = { treeData: treeData, ...commonProps, ...props };
    return mount(<Cascader {...props} />, {
        attachTo: document.getElementById('container'),
    });
}

describe('Cascader', () => {
    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        // clear();
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
        document.body.innerHTML = '';
    });

    it('className / style', () => {
        let props = {
            className: 'test',
            style: { height: 420 },
        };
        let cascader = render(props);
        expect(cascader.hasClass('test')).toEqual(true);
        expect(cascader.find('div.test')).toHaveStyle('height', 420);
    });

    it('with placeholder', () => {
        const props = { placeholder: 'semi' };
        const cascader = render(props);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection-placeholder`).instance().textContent).toEqual(
            'semi'
        );
    });

    it('with validateStatus', () => {
        const props = {};
        const cascader = render(props);
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-error`)).toEqual(false);
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-warning`)).toEqual(false);
        cascader.setProps({ validateStatus: `error` });
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-error`)).toEqual(true);
        cascader.setProps({ validateStatus: `warning` });
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-warning`)).toEqual(true);
    });

    it('different size', () => {
        const props = {};
        const cascader = render(props);
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-large`)).toEqual(false);
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-small`)).toEqual(false);
        cascader.setProps({ size: 'large' });
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-large`)).toEqual(true);
        cascader.setProps({ size: 'small' });
        expect(cascader.exists(`.${BASE_CLASS_PREFIX}-cascader-small`)).toEqual(true);
    });

    it('custom prefix / suffix / insetLabel', () => {
        let prefix = <div className="prefix">prefix content</div>;
        let suffix = <div className="suffix">suffix content</div>;
        let insetLabel = 'semi';
        const props = {
            prefix: prefix,
            suffix: suffix,
        };
        let cascader = render(props);
        expect(cascader.contains(prefix)).toEqual(true);
        expect(cascader.contains(suffix)).toEqual(true);
        cascader.unmount();
        let cascader2 = render({ insetLabel: insetLabel });
        expect(cascader2.contains(insetLabel)).toEqual(true);
        cascader2.unmount();
    });

    it('empty data / empty content', () => {
        let cascader = render({
            treeData: [],
            defaultOpen: true,
        });
        // await sleep();
        let opt = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`);
        expect(opt.length).toEqual(1);
        expect(opt[0].className.includes(`${BASE_CLASS_PREFIX}-cascader-option-empty`)).toEqual(true);
        cascader.setProps({ emptyContent: 'test' });
        cascader.update();
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0].textContent).toEqual('test');
        // done();
    });

    it('dynamic treeData in multiple and uncontrolled mode', () => {
        const cascader = render({
            defaultValue: 'Asia',
            multiple: true,
        });
        const opt = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-selection-multiple .${BASE_CLASS_PREFIX}-tag`);
        expect(opt.length).toEqual(1);
        cascader.setProps({ treeData: treeDataWithDisabled });
        cascader.update();
        expect(opt.length).toEqual(1);
    });

    it('dynamic treeData in multiple and controlled mode', () => {
        const cascader = render({
            value: 'Asia',
            multiple: true,
        });
        const opt = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-selection-multiple .${BASE_CLASS_PREFIX}-tag`);
        expect(opt.length).toEqual(1);
        cascader.setProps({ treeData: treeDataWithDisabled });
        cascader.update();
        expect(opt.length).toEqual(1);
    });

    it('getPopupContainer', () => {
        let cascader = render({
            getPopupContainer: getPopupContainer,
            defaultOpen: true,
        });
        // await sleep();
        let dom = document.querySelector(`.${BASE_CLASS_PREFIX}-cascader`);
        expect(dom.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-lists`).length).toEqual(1);
        // done();
    });

    it('defaultOpen', () => {
        let cascader = render({
            defaultOpen: true,
        });
        // await sleep();
        expect(cascader.state().isOpen).toEqual(true);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-lists`).length).toEqual(1);
        // done();
    });

    it('custom dropdownClassNam/dropdownStyle/zIndex', () => {
        let props = {
            dropdownClassName: 'test',
            dropdownStyle: {
                color: 'red',
            },
            defaultOpen: true,
            zIndex: 2000,
        };
        let cascader = render(props);
        // await sleep();
        const dropdown = document.querySelector(`.${BASE_CLASS_PREFIX}-cascader-popover`);
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-portal`).style.zIndex).toEqual('2000');
        expect(dropdown.className.includes('test')).toEqual(true);
        expect(dropdown.style.color).toEqual('red');
        // done();
    });

    it('defaultValue', () => {
        let cascader = render({
            defaultValue: ['Asia', 'China', 'Beijing'],
            defaultOpen: true,
        });
        // await sleep();
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        expect(lists.length).toEqual(3);
        let activeItems = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-active`);
        expect(activeItems.length).toEqual(2);
        expect(activeItems[0].textContent).toEqual('亚洲');
        expect(activeItems[1].textContent).toEqual('中国');
        let selectItem = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-select`);
        expect(selectItem.length).toEqual(1);
        expect(selectItem[0].textContent).toEqual('北京');
        expect(selectItem[0].querySelectorAll(`.${BASE_CLASS_PREFIX}-icon`).length).toEqual(1);
        // done();
    });

    it('displayProp', () => {
        let cascader = render({
            defaultValue: ['Asia', 'China', 'Beijing'],
            displayProp: 'value',
        });
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            'Asia / China / Beijing'
        );
    });

    it('displayRender', () => {
        let spyOnRender = sinon.spy(() => {});
        let cascader = render({
            defaultValue: ['Asia', 'China', 'Beijing'],
            displayRender: spyOnRender,
        });
        expect(spyOnRender.calledWithMatch(['亚洲', '中国', '北京'])).toEqual(true);
        cascader.unmount();

        let cusRender = render({
            defaultValue: ['Asia', 'China', 'Beijing'],
            displayRender: list => '已选择：' + list.join(' -> '),
        });
        expect(cusRender.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '已选择：亚洲 -> 中国 -> 北京'
        );
    });

    it('label is ReactNode when unsearchable and single-selection mode', () => {
        const cascader = render({
            defaultValue: ['Asia', 'China', 'Shanghai'],
            treeData: treeDataWithReactNode
        });
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection span strong`).getDOMNode().textContent).toEqual(
            '亚洲'
        );
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection span div`).getDOMNode().textContent).toEqual(
            '上海'
        );
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection span`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 上海'
        );

        cascader.unmount();

        const cascader2 = render({
            defaultValue: ['North America'],
            treeData: treeDataWithReactNode,
        });
        expect(cascader2.find(`.${BASE_CLASS_PREFIX}-cascader-selection span p`).getDOMNode().textContent).toEqual(
            '北美洲'
        );
        expect(cascader2.find(`.${BASE_CLASS_PREFIX}-cascader-selection span`).getDOMNode().textContent).toEqual(
            '北美洲'
        );
        cascader2.unmount();

        const cascader3 = render({
            defaultValue: ['Asia', 'China', 'Shanghai'],
            treeData: treeDataWithReactNode,
            separator: ' - '
        });
        expect(cascader3.find(`.${BASE_CLASS_PREFIX}-cascader-selection span strong`).getDOMNode().textContent).toEqual(
            '亚洲'
        );
        expect(cascader3.find(`.${BASE_CLASS_PREFIX}-cascader-selection span div`).getDOMNode().textContent).toEqual(
            '上海'
        );
        expect(cascader3.find(`.${BASE_CLASS_PREFIX}-cascader-selection span`).getDOMNode().textContent).toEqual(
            '亚洲 - 中国 - 上海'
        );
        cascader3.unmount();
    });

    it('disabled', () => {
        let cascader = render({
            disabled: true,
        });
        expect(
            document
                .querySelector(`.${BASE_CLASS_PREFIX}-cascader`)
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-disabled`)
        ).toEqual(true);
        // cannot select
        let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBox.simulate('click');
        // await sleep();
        expect(cascader.state().isOpen).toEqual(false);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-lists`).length).toEqual(0);
        // done();
    });

    it('disabled + defaultValue', () => {
        const cascaderWithSingle = render({
            treeData: treeDataWithDisabled,
            changeOnSelect: true,
            defaultValue:['Asia', 'China']
        });
        expect(
            cascaderWithSingle
            .find(`.${BASE_CLASS_PREFIX}-cascader-selection span`)
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('亚洲 / 中国');
        cascaderWithSingle.unmount();

        const cascaderWithSingleFilter = render({
            treeData: treeDataWithDisabled,
            changeOnSelect: true,
            filterTreeNode: true,
            defaultValue:['Asia', 'China']
        });
        expect(
            cascaderWithSingleFilter
            .find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper span`)
            .getDOMNode()
            .textContent
            ).toEqual('亚洲 / 中国');
        cascaderWithSingleFilter.unmount();

        const cascaderWithSingleControlled = render({
            treeData: treeDataWithDisabled,
            changeOnSelect: true,
            value: ['Asia', 'China'],
        });
        expect(cascaderWithSingleControlled.find(`.${BASE_CLASS_PREFIX}-cascader-selection span`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国'
        );
        cascaderWithSingleControlled.unmount();

        const cascaderWithMultiple = render({
            treeData: treeDataWithDisabled,
            multiple: true,
            defaultValue:['Asia', 'China']
        });
        expect(
            cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-tag .${BASE_CLASS_PREFIX}-tag-content`)
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('中国');
        cascaderWithMultiple.unmount();

        const cascaderWithMultipleFilter = render({
            treeData: treeDataWithDisabled,
            multiple: true,
            filterTreeNode: true,
            defaultValue:['Asia', 'China']
        });
        expect(
            cascaderWithMultipleFilter
            .find(`.${BASE_CLASS_PREFIX}-tag .${BASE_CLASS_PREFIX}-tag-content`)
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('中国');
        cascaderWithMultipleFilter.unmount();

        const cascaderWithMultipleControlled = render({
            treeData: treeDataWithDisabled,
            multiple: true,
            value:['Asia', 'China']
        });
        expect(
            cascaderWithMultipleControlled
            .find(`.${BASE_CLASS_PREFIX}-tag .${BASE_CLASS_PREFIX}-tag-content`)
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('中国');
        cascaderWithMultipleControlled.unmount();
    });

    it('select item / onSelect / onChange', () => {
        let spyOnSelect = sinon.spy(() => {});
        let spyOnChange = sinon.spy(() => {});
        let cascader = render({
            defaultOpen: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        // let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        // selectBox.simulate('click');
        // await sleep();
        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        expect(lists.length).toEqual(1);
        lists[0].querySelectorAll('li')[0].click();

        lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        expect(lists.length).toEqual(2);
        expect(spyOnSelect.notCalled).toBe(true);
        expect(spyOnChange.notCalled).toBe(true);
        expect(
            lists[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-active`)
        ).toEqual(true);

        lists[1].querySelectorAll('li')[0].click();

        lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        expect(lists.length).toEqual(3);
        expect(spyOnSelect.notCalled).toBe(true);
        expect(spyOnChange.notCalled).toBe(true);
        expect(
            lists[1]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-active`)
        ).toEqual(true);

        lists[2].querySelectorAll('li')[0].click();
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch('Beijing')).toEqual(true);
        expect(spyOnChange.calledWithMatch(['Asia', 'China', 'Beijing'])).toEqual(true);
        expect(
            lists[2]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-icon-tick`).length
        ).toEqual(1);

        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
        // done();
    });

    it('filterTreeNode = true shows input box', () => {
        let cascader = render({
            filterTreeNode: true,
            searchPlaceholder: 'placeholder',
        });
        let searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        expect(searchWrapper.exists()).toEqual(true);
        expect(
            searchWrapper
                .find('span')
                .getDOMNode()
                .textContent
            ).toEqual('placeholder');
    });

    it('onSearch', () => {
        let onSearch = value => {};
        let spyOnSearch = sinon.spy(onSearch);
        let cascader = render({
            filterTreeNode: true,
            onSearch: spyOnSearch,
        });
        let searchValue = '${BASE_CLASS_PREFIX}';
        let event = { target: { value: searchValue } };
        cascader.simulate('click');
        const input = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection input`);
        input.simulate('change', event);
        expect(spyOnSearch.calledOnce).toBe(true);
        expect(spyOnSearch.calledWithMatch(searchValue)).toBe(true);
    });

    it('onSelect + changeOnSelect', async () => {
        let spyOnSelect = sinon.spy(() => {});
        let spyOnChange = sinon.spy(() => {});
        let cascader = render({
            defaultOpen: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
            changeOnSelect: true,
        });
        // await sleep();
        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[0].querySelectorAll('li')[0].click();
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch('Asia')).toEqual(true);
        expect(spyOnChange.calledWithMatch(['Asia'])).toEqual(true);
        expect(
            lists[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-select`)
        ).toEqual(true);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual('亚洲');

        lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[1].querySelectorAll('li')[0].click();
        expect(spyOnSelect.calledWithMatch('China')).toEqual(true);
        expect(spyOnChange.calledWithMatch(['Asia', 'China'])).toEqual(true);
        expect(
            lists[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-active`)
        ).toEqual(true);
        expect(
            lists[1]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-select`)
        ).toEqual(true);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国'
        );
    });

    // display none not working properly
    it('filterTreeNode shows correct result', () => {
        let cascader = render({
            filterTreeNode: true,
            defaultOpen: true,
        });
        // let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        // selectBox.simulate('click');
        // await sleep();
        const searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        let searchValue = '北';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);

        // await sleep();
        let resList = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-label-highlight`);
        expect(resList.length).toEqual(3);
        // debugger
        // expect(resList[0].textContent).toEqual('亚洲/中国/北京');
        // done();
    });

    // display none not working properly
    it('filterTreeNode + treeNodeFilterProp', () => {
        let cascader = render({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
            defaultOpen: true,
        });
        // let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        // selectBox.simulate('click');
        // await sleep();
        const searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);

        // await sleep();
        let resList = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-label-highlight`);
        expect(resList.length).toEqual(1);
        // debugger
        // expect(resList[0].textContent).toEqual('亚洲/中国/北京');
        // done();
    });

    it('filterTreeNode + no result', () => {
        let cascader = render({
            filterTreeNode: true,
            defaultOpen: true,
            emptyContent: 'test',
        });
        // await sleep();
        const searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);

        // await sleep();
        let opt = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`);
        expect(opt.length).toEqual(1);
        expect(opt[0].className.includes(`${BASE_CLASS_PREFIX}-cascader-option-empty`)).toEqual(true);
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0].textContent).toEqual('test');
        // done();
    });

    it('filterTreeNode as a func', () => {
        let cascader = render({
            filterTreeNode: (inputValue, cascaderNode) => cascaderNode === inputValue,
            defaultOpen: true,
        });
        const searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        searchWrapper.find('input').simulate('change', { target: { value: '北' } });

        // await sleep();
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-option-label-highlight`).length).toEqual(0);
        // done();
    });

    it('controlled: value shows correct', () => {
        let cascader = render({
            value: ['Asia', 'China', 'Beijing'],
        });
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
    });

    it('controlled: fire onChange and ui not update', () => {
        let spyOnChange = sinon.spy(() => {});
        let cascader = render({
            value: ['Asia', 'China', 'Beijing'],
            defaultOpen: true,
            onChange: spyOnChange,
            changeOnSelect: true,
        });
        // await sleep();

        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[0].querySelectorAll('li')[0].click();
        expect(spyOnChange.calledOnce).toBe(true);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
        // done();
    });

    it('async load data', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => {} } };
        const then = jest.fn(() => Promise.resolve());
        const loadData = jest.fn(() => ({ then }));
        const data = {
            label: '亚洲',
            value: 'Asia',
        };
        let cascader = render({
            loadData,
            defaultOpen: true,
            treeData: [data],
        });
        let topNodeAsia = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-option`).at(0);
        topNodeAsia.simulate('click', nativeEvent);
        expect(loadData).toHaveBeenCalledWith([data]);
        expect(then).toHaveBeenCalled();
    });

    it('select item + onChange + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => {});
        let cascader = render({
            defaultOpen: true,
            onChange: spyOnChange,
            onChangeWithObject: true,
        });
        // let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        // selectBox.simulate('click');
        // await sleep();
        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[0].querySelectorAll('li')[0].click();
        lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[1].querySelectorAll('li')[0].click();
        lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[2].querySelectorAll('li')[0].click();
        expect(spyOnChange.calledOnce).toBe(true);
        expect(
            spyOnChange.calledWithMatch([
                {
                    label: '亚洲',
                    value: 'Asia',
                    key: 'Asia',
                    children: [
                        {
                            label: '中国',
                            value: 'China',
                            key: 'China',
                            children: [
                                {
                                    label: '北京',
                                    value: 'Beijing',
                                    key: 'beijing',
                                },
                                {
                                    label: '上海',
                                    value: 'Shanghai',
                                    key: 'shanghai',
                                },
                            ],
                        },
                    ],
                },
                {
                    label: '中国',
                    value: 'China',
                    key: 'China',
                    children: [
                        {
                            label: '北京',
                            value: 'Beijing',
                            key: 'beijing',
                        },
                        {
                            label: '上海',
                            value: 'Shanghai',
                            key: 'shanghai',
                        },
                    ],
                },
                {
                    label: '北京',
                    value: 'Beijing',
                    key: 'beijing',
                },
            ])
        ).toEqual(true);
        expect(
            lists[2]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-icon-tick`).length
        ).toEqual(1);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
        // done();
    });

    it('select item + onChange + onChangeWithObject + changeOnSelect', () => {
        let spyOnChange = sinon.spy(() => {});
        let cascader = render({
            defaultOpen: true,
            onChange: spyOnChange,
            onChangeWithObject: true,
            changeOnSelect: true,
        });
        let lists = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`);
        lists[0].querySelectorAll('li')[0].click();
        expect(spyOnChange.calledOnce).toBe(true);
        expect(
            spyOnChange.calledWithMatch([
                {
                    label: '亚洲',
                    value: 'Asia',
                    key: 'Asia',
                    children: [
                        {
                            label: '中国',
                            value: 'China',
                            key: 'China',
                            children: [
                                {
                                    label: '北京',
                                    value: 'Beijing',
                                    key: 'beijing',
                                },
                                {
                                    label: '上海',
                                    value: 'Shanghai',
                                    key: 'shanghai',
                                },
                            ],
                        },
                    ],
                },
            ])
        ).toEqual(true);
        expect(
            lists[0]
                .querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option`)[0]
                .className.includes(`${BASE_CLASS_PREFIX}-cascader-option-select`)
        ).toEqual(true);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual('亚洲');
    });

    it('controlled: value shows correct', () => {
        let cascader = render({
            value: [
                {
                    label: '亚洲',
                    value: 'Asia',
                    key: 'Asia',
                    children: [
                        {
                            label: '中国',
                            value: 'China',
                            key: 'China',
                            children: [
                                {
                                    label: '北京',
                                    value: 'Beijing',
                                    key: 'beijing',
                                },
                                {
                                    label: '上海',
                                    value: 'Shanghai',
                                    key: 'shanghai',
                                },
                            ],
                        },
                    ],
                },
                {
                    label: '中国',
                    value: 'China',
                    key: 'China',
                    children: [
                        {
                            label: '北京',
                            value: 'Beijing',
                            key: 'beijing',
                        },
                        {
                            label: '上海',
                            value: 'Shanghai',
                            key: 'shanghai',
                        },
                    ],
                },
                {
                    label: '北京',
                    value: 'Beijing',
                    key: 'beijing',
                },
            ],
            onChangeWithObject: true,
        });
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
    });

    it('onClear and showClear', () => {
        const spyOnClear = sinon.spy(() => { });
        const cascader = render({
            defaultValue: ['Asia', 'China', 'Beijing'],
            showClear: true,
            onClear: spyOnClear,
            placeholder: "请选择所在地区"
        });
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '亚洲 / 中国 / 北京'
        );
        cascader.simulate('mouseEnter', {}).find(`.${BASE_CLASS_PREFIX}-cascader-clearbtn`).simulate('click');
        expect(spyOnClear.calledOnce).toBe(true);
        expect(cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).getDOMNode().textContent).toEqual(
            '请选择所在地区'
        );
        cascader.unmount();
    });

    it('filterLeafOnly = false', () => {
        let cascader = render({
            filterTreeNode: true,
            defaultOpen: true,
            filterLeafOnly: false
        });
        // let selectBox = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        // selectBox.simulate('click');
        // await sleep();
        const searchWrapper = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-search-wrapper`);
        let searchValue = '亚';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);

        // await sleep();
        let resList = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-label-highlight`);
        expect(resList.length).toEqual(4);
        // debugger
        // expect(resList[0].textContent).toEqual('亚洲/中国/北京');
        // done();
    });

    it('showNext',()=>{
        // expand next menu by hover
        // 通过 hover 展开 Dropdown 的子菜单
        const cascaderWithHover = render({
            showNext: 'hover',
        });
        const selectBox = cascaderWithHover.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBox.simulate('click');
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`).length).toEqual(1);
        cascaderWithHover
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .simulate('mouseEnter');
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`).length).toEqual(2);
        cascaderWithHover.unmount();

        // expand next menu by click
        // 通过 click 展开 Dropdown 的子菜单
        const cascaderWithClick = render({
            showNext: 'click',
        });
        const selectBox2 = cascaderWithClick.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBox2.simulate('click');
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`).length).toEqual(1);
        cascaderWithClick
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .simulate('mouseEnter');
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`).length).toEqual(1);
        cascaderWithClick
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .simulate('click');
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-list`).length).toEqual(2);
        cascaderWithClick.unmount();
        
    })

    it('disableStrictly', ()=>{
        // disable strictly
        const cascaderWithDisableStrictly = render({
            showNext: 'hover',
            treeData:treeDataWithDisabled,
            disableStrictly: true,
            multiple: true,
        });
        expect(cascaderWithDisableStrictly.state().checkedKeys.size).toEqual(0); 
        expect(cascaderWithDisableStrictly.state().disabledKeys.size).toEqual(3); 
        // open dropdown
        const selectBoxWithDisableStrictly = cascaderWithDisableStrictly.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBoxWithDisableStrictly.simulate('click');
        // click checkbox
        cascaderWithDisableStrictly
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-label`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        // check checkedKeys
        expect(cascaderWithDisableStrictly.state().checkedKeys.size).toEqual(1); 
        cascaderWithDisableStrictly.unmount();

        // default disable
        const cascaderWithDisable = render({
            showNext: 'hover',
            treeData:treeDataWithDisabled,
            multiple: true,
        });
        expect(cascaderWithDisable.state().checkedKeys.size).toEqual(0); 
        expect(cascaderWithDisable.state().disabledKeys.size).toEqual(0); 
        // open dropdown
        const selectBoxWithDisable = cascaderWithDisable.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBoxWithDisable.simulate('click');
        // click checkbox
        cascaderWithDisable
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-label`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        // check checkedKeys
        expect(cascaderWithDisable.state().checkedKeys.size).toEqual(5); 
        cascaderWithDisable.unmount();
    });

    it('multiple + onChangeWithObject', () => {
        const cascader = render({
            multiple: true,
            onChangeWithObject: true,
            defaultValue: [
                {
                    label: '北美洲',
                    value: 'North America',
                    key: 'North America',
                    children: [
                        {
                            label: '美国',
                            value: 'United States',
                            key: 'United States',
                        },
                        {
                            label: '加拿大',
                            value: 'Canada',
                            key: 'Canada',
                        },
                    ],
                },
                {
                    label: '美国',
                    value: 'United States',
                    key: 'United States',
                }
            ]
        });
        const tags = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags.length).toEqual(1);
        expect(
            tags
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .getDOMNode()
            .textContent
        ).toEqual('美国');
    });

    it('multiple select enableLeafClick', () => {
        const cascaderWithMultiple = render({
            multiple: true,
            enableLeafClick: true,
            treeData: [
                {
                    label: '北美洲',
                    value: 'North America',
                    key: 'North America',
                    children: [
                        {
                            label: '美国',
                            value: 'United States',
                            key: 'United States',
                        },
                        {
                            label: '加拿大',
                            value: 'Canada',
                            key: 'Canada',
                        },
                    ],
                },
                {
                    label: '南美洲',
                    value: 'Nanmeiguo',
                    key: 'Nanmeiguo',
                }
            ]
        })
        const selectBox = cascaderWithMultiple.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBox.simulate('click');
        // click checkbox
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(1)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-label`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        expect(cascaderWithMultiple.state().checkedKeys.size).toEqual(1);
        // click option cancel checked
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(1)
            .simulate('click')
        expect(cascaderWithMultiple.state().checkedKeys.size).toEqual(0);
        // click option select
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .simulate('click')
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(1)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(0)
            .simulate('click')
        expect(cascaderWithMultiple.state().checkedKeys.size).toEqual(1);
        const states = cascaderWithMultiple.state()
        cascaderWithMultiple.unmount();
    })

    it('multiple select disable enableLeafClick', () => {
        const cascaderWithMultiple = render({
            multiple: true,
            treeData: [
                {
                    label: '北美洲',
                    value: 'North America',
                    key: 'North America',
                    children: [
                        {
                            label: '美国',
                            value: 'United States',
                            key: 'United States',
                        },
                        {
                            label: '加拿大',
                            value: 'Canada',
                            key: 'Canada',
                        },
                    ],
                },
                {
                    label: '南美洲',
                    value: 'Nanmeiguo',
                    key: 'Nanmeiguo',
                }
            ]
        })
        const selectBox = cascaderWithMultiple.find(`.${BASE_CLASS_PREFIX}-cascader-selection`).at(0);
        selectBox.simulate('click');
        // click checkbox
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(1)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-label`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-checkbox`)
            .at(0)
            .simulate('click');
        expect(cascaderWithMultiple.state().checkedKeys.size).toEqual(1);
        // click option can't cancel checked
        cascaderWithMultiple
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-cascader-option`)
            .at(1)
            .simulate('click')
        expect(cascaderWithMultiple.state().checkedKeys.size).toEqual(1);
        cascaderWithMultiple.unmount();
    })

    it('separator', () => {
        const cascader = render({
            filterTreeNode: true,
            defaultValue: ['Asia', 'China', 'Beijing'],
            separator: ' > ',
            defaultOpen: true,
        });
        const span = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection span`);
        expect(span.getDOMNode().textContent).toEqual('亚洲 > 中国 > 北京'); 
        cascader.simulate('click');
        const input = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection input`);
        const event = { target: { value: '中国' } };
        input.simulate('change', event);
        expect(
            cascader
            .find(`.${BASE_CLASS_PREFIX}-cascader-option-list li`)
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('亚洲 > 中国 > 北京');
        cascader.unmount();
    });

    it('search ref method', () => {
        let r;
        const cascader = render({
            ref: (ref) => { r = ref },
            filterTreeNode: true,
            searchPosition: 'custom',
            defaultOpen: true,
        });
        r.search('北京');
        expect(cascader.state().inputValue).toEqual('北京');
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-cascader-option-label-highlight`)[0]
            .textContent
        ).toEqual('北京');
        cascader.unmount();
    });

    it('triggerRender', () => {
        const spyTriggerRender = sinon.spy(() => <span>123</span>);
        const cascaderAutoMerge = render({
            multiple: true,
            triggerRender: spyTriggerRender,
            defaultValue: 'Asia'
        });
        cascaderAutoMerge.simulate('click');
        const firstCall = spyTriggerRender.getCall(0);
        const args = firstCall.args[0]; 
        /* check arguments of triggerRender */
        expect(args.value.size).toEqual(1);
        expect(args.value).toEqual(new Set('0'));
        cascaderAutoMerge.unmount();

        const spyTriggerRender2 = sinon.spy(() => <span>123</span>);
        const cascaderNoAutoMerge = render({
            multiple: true,
            triggerRender: spyTriggerRender2,
            defaultValue: 'Asia',
            autoMergeValue: false,
        });
        cascaderNoAutoMerge.simulate('click');
        const firstCall2 = spyTriggerRender2.getCall(0);
        const args2 = firstCall2.args[0]; 
        /* check arguments of triggerRender */
        expect(args2.value.size).toEqual(4);
        expect(args2.value).toEqual(new Set(['0','0-0','0-0-1','0-0-0']));
        cascaderNoAutoMerge.unmount();
    });

    it('autoMergeValue', () => {
        const cascader = render({
            multiple: true,
            autoMergeValue: false,
            defaultValue: 'Asia',
        });
        const tags = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags.length).toEqual(4);
        cascader.unmount();

        const cascaderAutoMerge = render({
            multiple: true,
            autoMergeValue: true,
            defaultValue: 'Asia',
        });
        const tags2 = cascaderAutoMerge.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags2.length).toEqual(1);
        expect(
            tags2
                .find(`.${BASE_CLASS_PREFIX}-tag-content`)
                .getDOMNode()
                .textContent
        ).toEqual('亚洲');
        cascaderAutoMerge.unmount();
    });

    it('leafOnly', () => {
        /* autoMergeValue and leafOnly are both false */
        const cascader = render({
            multiple: true,
            autoMergeValue: false,
            leafOnly: false,
            defaultValue: 'Asia',
        });
        const tags = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags.length).toEqual(4);
        cascader.unmount();

        /* autoMergeValue and leafOnly are both true */
        const cascader2 = render({
            multiple: true,
            autoMergeValue: true,
            leafOnly: true,
            defaultValue: 'Asia',
        });
        const tags2 = cascader2.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags2.length).toEqual(2);
        cascader2.unmount();

        /* autoMergeValue is false, leafOnly is true */
        const cascader3 = render({
            multiple: true,
            autoMergeValue: false,
            leafOnly: true,
            defaultValue: 'Asia',
        });
        const tags3 = cascader3.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags3.length).toEqual(2);
        cascader3.unmount();

        /* autoMergeValue is true, leafOnly is false */
        const cascader4 = render({
            multiple: true,
            autoMergeValue: true,
            leafOnly: false,
            defaultValue: 'Asia',
        });
        const tags4 = cascader4.find(`.${BASE_CLASS_PREFIX}-cascader-selection .${BASE_CLASS_PREFIX}-tag`)
        expect(tags4.length).toEqual(1);
        expect(
            tags4
                .find(`.${BASE_CLASS_PREFIX}-tag-content`)
                .getDOMNode()
                .textContent
        ).toEqual('亚洲');
        cascader4.unmount();
    });

    it('ref method', () => {
        let r;
        let props = {
            ref: (ref) => { r = ref },
            filter: true,
            multiple: true,
        };

        let select = render(props);
        r.open();
        expect(select.state().isOpen).toEqual(true);

        r.close();
        expect(select.state().isOpen).toEqual(false);
    });

    it('autoMerge false & value []', () => {
        const cascader = render({
            multiple: true,
            autoMergeValue: false,
            value: [],
            placeholder: "autoMergeValue 为 false"
        });

        const placeholder = cascader.find(`.${BASE_CLASS_PREFIX}-cascader-selection-placeholder`)
        expect(placeholder.getDOMNode().textContent).toEqual('autoMergeValue 为 false');
        cascader.unmount();
    })

    it('value not in TreeData', () => {
        const cascader = render({
            multiple: true,
            value: [ "value", "notIn",  "treeData"],
            placeholder: "value not in treeData, show placeholder",
            autoMergeValue: false,
            filterTreeNode: true,
        });

        const placeholder = cascader.find(`.${BASE_CLASS_PREFIX}-input`)
        expect(placeholder.getDOMNode().placeholder).toEqual('value not in treeData, show placeholder');
        cascader.unmount();
    })
});
