import * as _ from 'lodash';
import { spy } from 'sinon';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';

import Transfer from '../index';

const defaultItems = [
    {
        label: 'item1',
        value: '1',
        key: 'a',
    },
    {
        label: 'item2',
        value: '2',
        key: 'b',
    },
];

const dataWithGroup = [
    {
        title: '类别A',
        children: [
            { label: 'A-1', value: 1, disabled: false, key: 1 },
            { label: 'A-2', value: 2, disabled: false, key: 2 },
            { label: 'A-3', value: 3, disabled: false, key: 3 },
        ],
    },
    {
        title: '类别B',
        children: [
            { label: 'B-1', value: 4, disabled: false, key: 4 },
            { label: 'B-2', value: 5, disabled: false, key: 5 },
            { label: 'B-3（disabled）', value: 6, disabled: true, key: 6 },
        ],
    },
    {
        title: '类别C',
        children: [
            { label: 'C-1', value: 7, disabled: false, key: 7 },
            { label: 'C-2', value: 8, disabled: false, key: 8 },
            { label: 'C-3', value: 9, disabled: false, key: 9 },
            { label: 'C-4', value: 10, disabled: false, key: 10 },
            { label: 'C-5', value: 11, disabled: false, key: 11 },
            { label: 'C-6', value: 12, disabled: false, key: 12 },
            { label: 'C-7', value: 13, disabled: false, key: 13 },
        ],
    },
];

const treeData = [
    {
        label: 'Asia',
        value: 'Asia',
        key: '0',
        children: [
            {
                label: 'China',
                value: 'China',
                key: '0-0',
                children: [
                    {
                        label: 'Beijing',
                        value: 'Beijing',
                        key: '0-0-0',
                        disabled: true,
                    },
                    {
                        label: 'Shanghai',
                        value: 'Shanghai',
                        key: '0-0-1',
                    },
                    {
                        label: 'Chengdu',
                        value: 'Chengdu',
                        key: '0-0-2',
                    },
                    {
                        label: 'Chongqing',
                        value: 'Chongqing',
                        key: '0-0-3',
                    },
                ],
            },
            {
                label: 'Japan',
                value: 'Japan',
                key: '0-1',
                children: [
                    {
                        label: 'Osaka',
                        value: 'Osaka',
                        key: '0-1-0',
                    },
                ],
            },
        ],
    },
    {
        label: 'North America',
        value: 'North America',
        key: '1',
        children: [
            {
                label: 'United States',
                value: 'United States',
                key: '1-0',
            },
            {
                label: 'Canada',
                value: 'Canada',
                key: '1-1',
            },
        ],
    },
];

function getTransfer(props) {
    return mount(<Transfer {...props} />, { attachTo: document.getElementById('container') });
}

describe(`Transfer`, () => {
    beforeEach(() => {
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
        document.body.innerHTML = '';
    });

    it('custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const wrapper = getTransfer(props);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
    });

    it('defaultValue effective', () => {
        let props = {
            dataSource: defaultItems,
            defaultValue: ['1'],
        };
        const wrapper = getTransfer(props);
        expect(wrapper.state().selectedItems.has('a')).toEqual(true);
    });

    it('search effect while data change', () => {
        let props = {
            dataSource: [],
        };
        const wrapper = getTransfer(props);
        const searchIn = wrapper.find(`.${BASE_CLASS_PREFIX}-input`);
        const env = { target: { value: '2' } };
        searchIn.simulate('change', env);
        wrapper.setProps({
            dataSource: [
                { label: '1', value: 1, key: 1 },
                { label: '2', value: 2, key: 2 },
            ],
        });
        expect(wrapper.state().searchResult.has(2)).toEqual(true);
        expect(wrapper.state().searchResult.size === 1).toEqual(true);
        expect(wrapper.state().inputValue === '2').toEqual(true);
    });

    it('search', () => {
        const spyOnSearch = spy();
        let props = {
            dataSource: defaultItems,
            onSearch: spyOnSearch,
        };

        const transfer = getTransfer(props);

        const inputNode = transfer.find(`.${BASE_CLASS_PREFIX}-transfer-filter input`).at(0);
        const env = { target: { value: '1' } };

        inputNode.simulate('change', env);

        expect(spyOnSearch.calledOnce).toEqual(true);
        expect(spyOnSearch.firstCall.args).toHaveLength(1);
        expect(spyOnSearch.firstCall.args[0] === '1').toEqual(true);
    });

    it('select and change', () => {
        const spyOnChange = spy();
        const spyOnSelect = spy();
        const spyOnDeselect = spy();
        let props = {
            dataSource: defaultItems,
            onChange: spyOnChange,
            onSelect: spyOnSelect,
            onDeselect: spyOnDeselect,
        };

        const transfer = getTransfer(props);

        // select first item -> deselect first item
        const firstItem = transfer.find(`span.${BASE_CLASS_PREFIX}-transfer-item`).at(0);
        firstItem.simulate('click');
        firstItem.simulate('click');

        expect(spyOnSelect.calledOnce).toEqual(true);
        expect(spyOnDeselect.calledOnce).toEqual(true);
        expect(spyOnChange.calledTwice).toEqual(true);

        expect(spyOnChange.firstCall.args).toHaveLength(2);
        expect(Array.isArray(spyOnChange.firstCall.args[0])).toEqual(true);
        expect(spyOnChange.firstCall.args[0]).toHaveLength(1);
        expect(spyOnChange.firstCall.args[0][0]).toEqual(defaultItems[0].value);
        expect(Array.isArray(spyOnChange.firstCall.args[1])).toEqual(true);
        expect(spyOnChange.firstCall.args[1]).toHaveLength(1);
        expect(spyOnChange.firstCall.args[1][0]).toMatchObject(defaultItems[0]);

        expect(spyOnChange.secondCall.args).toHaveLength(2);
        expect(Array.isArray(spyOnChange.secondCall.args[0])).toEqual(true);
        expect(spyOnChange.secondCall.args[0]).toHaveLength(0);
        expect(Array.isArray(spyOnChange.secondCall.args[1])).toEqual(true);
        expect(spyOnChange.secondCall.args[1]).toHaveLength(0);

    });

    it('de/select all', () => {
        const spyOnChange = spy();
        let props = {
            dataSource: defaultItems,
            onChange: spyOnChange,
        };
        const transfer = getTransfer(props);

        const selectAllNode = transfer.find(`button.${BASE_CLASS_PREFIX}-transfer-header-all`).at(0);

        selectAllNode.simulate('click');
        selectAllNode.simulate('click');

        expect(spyOnChange.calledTwice).toEqual(true);
        expect(spyOnChange.firstCall.args).toHaveLength(2);
        expect(spyOnChange.firstCall.args[0]).toHaveLength(defaultItems.length);
        expect(spyOnChange.firstCall.args[1]).toHaveLength(defaultItems.length);

        expect(spyOnChange.secondCall.args).toHaveLength(2);
        expect(spyOnChange.secondCall.args[0]).toHaveLength(0);
        expect(spyOnChange.secondCall.args[1]).toHaveLength(0);

    });

    it('clear all', () => {
        const spyOnChange = spy();
        let props = {
            dataSource: defaultItems,
            onChange: spyOnChange,
            defaultValue: defaultItems.map(i=>i.value),
        };
        const transfer = getTransfer(props);
        const clearAllNode = transfer.find(`button.${BASE_CLASS_PREFIX}-transfer-header-all`).at(1);
        clearAllNode.simulate('click');

        expect(spyOnChange.calledOnce).toEqual(true);
        expect(spyOnChange.firstCall.args).toHaveLength(2);
        expect(spyOnChange.firstCall.args[0]).toHaveLength(0);
        expect(spyOnChange.firstCall.args[1]).toHaveLength(0);
    });

    it('group transfer render', () => {
        const spyOnChange = spy();
        const spyOnSearch = spy();
        const props = {
            type: 'groupList',
            defaultValue: [6],
            dataSource: dataWithGroup,
            onChange: spyOnChange,
            onSearch: spyOnSearch,
        };
        const transfer = getTransfer(props);
        expect(transfer.exists(`.${BASE_CLASS_PREFIX}-transfer`)).toEqual(true);
    });

    it('tree transfer render', () => {
        const spyOnChange = spy();
        const spyOnSearch = spy();
        const props = {
            type: 'treeList',
            draggable: true,
            dataSource: treeData,
            value: ['Shanghai'],
            showPath: true,
            onChange: spyOnChange,
            onSearch: spyOnSearch,
        };
        const transfer = getTransfer(props);

        const treeNode = transfer.find(`li.${BASE_CLASS_PREFIX}-tree-option`).at(0);

        treeNode.simulate('click');

        const inputNode = transfer.find(`.${BASE_CLASS_PREFIX}-transfer-filter input`).at(0);
        const env = { target: { value: '1' } };

        inputNode.simulate('change', env);

        expect(transfer.exists(`.${BASE_CLASS_PREFIX}-transfer`)).toEqual(true);

        expect(spyOnChange.calledOnce).toEqual(true);
        expect(spyOnChange.firstCall.args).toHaveLength(2);
        expect(spyOnChange.firstCall.args[0]).toHaveLength(4);
        expect(spyOnChange.firstCall.args[1]).toHaveLength(4);

        expect(spyOnSearch.calledOnce).toEqual(true);
        expect(spyOnSearch.firstCall.args).toHaveLength(1);
        expect(spyOnSearch.firstCall.args[0] === '1').toEqual(true);
    });
});
