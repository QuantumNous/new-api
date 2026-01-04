import { TreeSelect, Icon } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';


const treeChildren = [
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
];

const treeData = [
    {
        label: '亚洲',
        value: 'Yazhou',
        key: 'yazhou',
        children: [
            {
                label: '中国',
                value: 'Zhongguo',
                key: 'zhongguo',
                children: treeChildren,
            },
            {
                label: '日本',
                value: 'Riben',
                key: 'riben',
                children: [
                    {
                        label: '东京',
                        value: 'Dongjing',
                        key: 'dongjing'
                    },
                    {
                        label: '大阪',
                        value: 'Daban',
                        key: 'daban'
                    }
                ]
            },
        ],
    },
    {
        label: '北美洲',
        value: 'Beimeizhou',
        key: 'beimeizhou',
        children: [
            {
                label: '美国',
                value: 'Meiguo',
                key: 'meiguo'
            },
            {
                label: '加拿大',
                value: 'Jianada',
                key: 'jianada'
            }
        ]
    },
];

const treeData2 = [
    {
        label: '亚洲',
        value: 'Asia',
        key: '0',
        children: [
            {
                label: '中国',
                value: 'China',
                key: '0-0',
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: '0-0-0',
                    },
                    {
                        label: '上海',
                        value: 'Shanghai',
                        key: '0-0-1',
                    },
                ],
            },
        ],
    },
    {
        label: '北美洲',
        value: 'North America',
        key: '1',
    }
];

const treeData3 = [
    {
        label: '亚洲',
        value: 'Asia',
        key: '0',
        children: [
            {
                label: '中国',
                value: 'China',
                key: '0-0',
            },
        ],
    },
    {
        label: '北美洲',
        value: 'North America',
        key: '1',
    }
];

const specialTreeData = [
    {
      label1: '亚洲',
      value1: 'Yazhou',
      key1: 'yazhou',
      children1: [
        {
          label1: '中国',
          value1: 'Zhongguo',
          key1: 'zhongguo',
          disabled1: true,
          children1: [
            {
              label1: '北京',
              value1: 'Beijing',
              key1: 'beijing',
            },
            {
              label1: '上海',
              value1: 'Shanghai',
              key1: 'shanghai',
            },
          ],
        },
        {
          label1: '日本',
          value1: 'Riben',
          key1: 'riben',
          children1: [
            {
              label1: '东京',
              value1: 'Dongjing',
              key1: 'dongjing',
            },
            {
              label1: '大阪',
              value1: 'Daban',
              key1: 'daban',
            },
          ],
        },
      ],
    },
    {
      label1: '北美洲',
      value1: 'Beimeizhou',
      key1: 'beimeizhou',
      children1: [
        {
          label1: '美国',
          value1: 'Meiguo',
          key1: 'meiguo',
        },
        {
          label1: '加拿大',
          value1: 'Jianada',
          key1: 'jianada',
        },
      ],
    },
];

const treeDataEnNA = {
    label: 'North America',
    value: 'North America',
    key: '1',
    children: [
        {
            label: 'United States',
            value: 'United States',
            key: '1-0'
        },
        {
            label: 'Canada',
            value: 'Canada',
            key: '1-1'
        }
    ]
}

const treeDataEn = [
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
                        key: '0-1-0'
                    }
                ]
            },
        ],
    },
    treeDataEnNA
];

const defaultKeyMaps = {
    value: 'value1',
    key: 'key1',
    label: 'label1',
    children: 'children1',
    disabled: 'disabled1'
}

const treeChildrenWithoutValue = [
    {
        label: '北京',
        key: 'beijing',
    },
    {
        label: '上海',
        key: 'shanghai',
    },
];

const treeDataWithoutValue = [
    {
        label: '亚洲',
        key: 'yazhou',
        children: [
            {
                label: '中国',
                key: 'zhongguo',
                children: treeChildrenWithoutValue,
            },
            {
                label: '日本',
                key: 'riben',
                children: [
                    {
                        label: '东京',
                        key: 'dongjing'
                    },
                    {
                        label: '大阪',
                        key: 'daban'
                    }
                ]
            },
        ],
    },
    {
        label: '北美洲',
        key: 'beimeizhou',
        children: [
            {
                label: '美国',
                key: 'meiguo'
            },
            {
                label: '加拿大',
                key: 'jianada'
            }
        ]
    },
];

let commonProps = {
    motion: false,
    motionExpand: false,
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0,
};

function getTreeSelect(props) {
    props = { treeData: treeData, ...props }
    return mount(
        <TreeSelect
            {...commonProps}
            defaultOpen={true}
            {...props}
        />,
        {
            attachTo: document.getElementById('container')
        }
    );
}

describe('TreeSelect', () => {

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

    it('className / style', () => {
        let props = {
            className: 'test',
            style: { height: 420 },
        };
        let treeSelect = getTreeSelect(props);
        expect(treeSelect.hasClass('test')).toEqual(true);
        expect(treeSelect.find('div.test')).toHaveStyle('height', 420);
    });

    it('placeholder', () => {
        const props = {
            placeholder: 'semi'
        };
        const treeSelect = getTreeSelect(props);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection-placeholder`).instance().textContent).toEqual('semi');
    });

    it('validateStatus', () => {
        const props = {};
        const treeSelect = getTreeSelect(props);
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-error`)).toEqual(false);
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-warning`)).toEqual(false);
        treeSelect.setProps({ validateStatus: 'error' });
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-error`)).toEqual(true);
        treeSelect.setProps({ validateStatus: 'warning' });
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-warning`)).toEqual(true);
    });

    it('outerBottomSlot', () => {
        let outerBottomSlot = <div class="outer-slot">outer</div>;
        let props = {
            outerBottomSlot: outerBottomSlot,
        };
        const treeSelect = getTreeSelect(props);
        expect(treeSelect.contains(outerBottomSlot)).toEqual(true);
    });

    it('size', () => {
        const props = {};
        const treeSelect = getTreeSelect(props);
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-large`)).toEqual(false);
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-small`)).toEqual(false);
        treeSelect.setProps({ size: 'large' });
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-large`)).toEqual(true);
        treeSelect.setProps({ size: 'small' });
        expect(treeSelect.exists(`.${BASE_CLASS_PREFIX}-tree-select-small`)).toEqual(true);
    });

    it('custom dropdownClassName / dropdownStyle / zIndex', () => {
        let props = {
            dropdownClassName: 'test',
            dropdownStyle: {
                color: 'red',
            },
            zIndex: 2000,
        };
        let treeSelect = getTreeSelect(props);
        expect(treeSelect.exists('.test')).toEqual(true);
        expect(treeSelect.find('.test')).toHaveStyle('color', 'red');
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-portal`).style.zIndex).toEqual("2000");
    });

    it('dropdownMatchSelectWidth = true', () => {
        // dropdownMatchSelectWidth default is true
        let props = {
            style: { width: 90 },
            defaultValue: 'abc',
        };
        let treeSelect = getTreeSelect(props);
        // cause jsdom doesn't support layout engine like browser, so you can't access offsetWidth/scrollWidth or use getBoundingRect(), it will always return 0;
        // just use getComputedStyle to avoid this problem.
        let selector = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select`).getDOMNode();
        let selectorWidth = window.getComputedStyle(selector).width; // expect 90px
        let list = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-popover`).getDOMNode();
        let listWidth = window.getComputedStyle(list).minWidth;
        expect(selectorWidth).toEqual(listWidth);
        treeSelect.unmount();
    });

    it('dropdownMatchSelectWidth = false', () => {
        let props = {
            style: { width: 90 },
            defaultValue: 'abc',
            dropdownMatchSelectWidth: false,
        };
        let treeSelect = getTreeSelect(props);
        let selector = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select`).getDOMNode();
        let selectorWidth = window.getComputedStyle(selector).width; // expect 90px
        let list = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-popover`).getDOMNode();
        let listWidth = window.getComputedStyle(list).minWidth;
        expect(selectorWidth).not.toEqual(listWidth);
        treeSelect.unmount();
    });

    it('getPopupContainer', () => {
        let treeSelect = getTreeSelect({
            getPopupContainer: () => document.querySelector(`.${BASE_CLASS_PREFIX}-tree-select`),
        });
        let dom = document.querySelector(`.${BASE_CLASS_PREFIX}-tree-select`);
        expect(dom.querySelectorAll(`.${BASE_CLASS_PREFIX}-tree-select-popover`).length).toEqual(1);
    });

    it('custom prefix / suffix / insetLabel', () => {
        let prefix = <div className="prefix">prefix content</div>;
        let suffix = <div className="suffix">suffix content</div>;
        let insetLabel = 'semi';
        const props = {
            prefix: prefix,
            suffix: suffix,
        };
        let treeSelect = getTreeSelect(props);
        expect(treeSelect.contains(prefix)).toEqual(true);
        expect(treeSelect.contains(suffix)).toEqual(true);
        treeSelect.unmount();
        let ntreeSelect = getTreeSelect({ insetLabel: insetLabel });
        expect(ntreeSelect.contains(insetLabel)).toEqual(true);
        ntreeSelect.unmount();
    });

    it('empty data', () => {
        let treeSelect = getTreeSelect({
            treeData: [],
            emptyContent: 'empty'
        });
        let node = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(node.length).toEqual(1);
        expect(node.hasClass(`${BASE_CLASS_PREFIX}-tree-option-empty`)).toEqual(true);
        expect(node.instance().textContent).toEqual('empty');
    });

    it('defaultOpen', () => {
        let props = {
            defaultOpen: false,
        };
        let treeSelect = getTreeSelect(props);
        expect(treeSelect.state().isOpen).toEqual(false);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-popover`).exists()).toEqual(false);
        treeSelect.unmount();

        let ntreeSelect = getTreeSelect({ defaultOpen: true, });
        expect(ntreeSelect.state().isOpen).toEqual(true);
        expect(ntreeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-popover`).exists()).toEqual(true);
        let options = ntreeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(ntreeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(2);
        expect(options.at(0).getDOMNode().textContent).toEqual('亚洲');
        expect(options.at(1).getDOMNode().textContent).toEqual('北美洲');
    });

    it('defaultValue', () => {
        // auto expand parent, if node exist means parent is open
        let treeSelect = getTreeSelect({
            defaultValue: 'Beijing'
        });
        let selectedNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('北京');
        expect(selectedNode.instance().textContent).toEqual('北京');
        treeSelect.unmount();
        // array case only select first item
        let tree2 = getTreeSelect({
            defaultValue: ['Riben', 'Beijing']
        });
        let selectedNode2 = tree2.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode2.instance().textContent).toEqual('日本');
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('日本');
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    })

    it('defaultExpandedKeys', () => {
        // auto expand parent
        let treeSelect = getTreeSelect({
            defaultExpandedKeys: ['zhongguo', 'beimeizhou']
        });
        // yazhou beimeizhou
        let topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        // zhongguo riben
        let children = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`);
        expect(children.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(children.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    })

    it('defaultExpandAll', () => {
        let treeSelect = getTreeSelect({
            defaultExpandAll: true
        });
        let nodes = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        let collapsed = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes.length).toEqual(10);
        expect(collapsed.length).toEqual(0);

        treeSelect.setProps({ treeData: treeData2});
        treeSelect.update();
        const nodes2 = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed2 = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes2.length).toEqual(2);
        expect(collapsed2.length).toEqual(2);
    })

    it('expandAll', () => {
        const treeSelect = getTreeSelect({
            expandAll: true
        });
        const nodes = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes.length).toEqual(10);
        expect(collapsed.length).toEqual(0);

        treeSelect.setProps({ treeData: treeData2});
        treeSelect.update();
        const nodes2 = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed2 = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes2.length).toEqual(5);
        expect(collapsed2.length).toEqual(0);
    })

    it('if expandedKeys values work', () => {
        // auto expand parent
        let treeSelect = getTreeSelect({
            expandedKeys: ['beimeizhou']
        });
        // yazhou beimeizhou
        let topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        treeSelect.setProps({ expandedKeys: ['yazhou', 'zhongguo', 'beimeizhou'] });
        treeSelect.update();
        // zhongguo riben
        let children = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`);
        expect(children.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(children.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('if expand behavior works / onExpand', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            onExpand: spyOnExpand,
        });
        // yazhou
        let topNodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        let expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        // expand yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledOnce).toBe(true);
        expect(spyOnExpand.calledWithMatch(["yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // zhongguo riben
        let topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        // collapse yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledWithMatch([], { expanded: false, node: { key: 'yazhou' } })).toEqual(true);
        topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('if expandedKeys controlled work / onExpand', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            expandedKeys: ['beimeizhou'],
            onExpand: spyOnExpand,
        });
        // yazhou
        let topNodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        let expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        // expand yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledWithMatch(["beimeizhou", "yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // zhongguo riben
        let topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('select item / onSelect / onChange', () => {
        let spyOnSelect = sinon.spy(() => { });
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        let nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch('beijing', true, { key: "beijing" })).toEqual(true);
        expect(spyOnChange.calledWithMatch('Beijing', { key: "beijing" })).toEqual(true);

        let selectBox = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select`).at(0);
        selectBox.simulate('click');
        // classname
        nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        expect(nodeBeijing.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(true);
        // render in input box
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('北京');

        // change
        let nodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // select asia
        nodeAsia.simulate('click');
        // onSelect & onChange
        expect(spyOnSelect.calledWithMatch('yazhou', true, { key: "yazhou" })).toEqual(true);
        expect(spyOnChange.calledWithMatch('Yazhou', { key: "yazhou" })).toEqual(true);

        selectBox.simulate('click');
        // classname
        nodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        expect(nodeAsia.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(true);
        // render in input box
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('亚洲');
    });

    it('onClear', () => {
        let spyOnClear = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            defaultExpandAll: true,
            onClear: spyOnClear,
            showClear: true,
        });

        let nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');

        let nodeSelectTree = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select.${BASE_CLASS_PREFIX}-tree-select-single`).at(0);
        nodeSelectTree.simulate('mouseenter');

        let nodeClearIcon = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-clearbtn`).at(0);
        nodeClearIcon.simulate('click');

        expect(spyOnClear.calledOnce).toBe(true);
    })

    it('onChange + value not changed', () => {
        let spyOnSelect = sinon.spy(() => { });
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
            defaultValue: 'Beijing'
        });
        let nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.notCalled).toBe(true);
    });

    it('onChange + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            defaultExpandAll: true,
            onChangeWithObject: true,
            onChange: spyOnChange,
        });
        let nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({ key: "beijing" })).toEqual(true);
    });

    it('treeNodeLabelProp', () => {
        // auto expand parent, if node exist means parent is open
        let treeSelect = getTreeSelect({
            defaultValue: 'Beijing',
            treeNodeLabelProp: 'value'
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('Beijing');

        // select asia
        let nodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        nodeAsia.simulate('click');
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('Yazhou');
    })

    it('filterTreeNode = true shows input box', () => {
        let treeSelect = getTreeSelect({});
        let searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.exists()).toEqual(false);
        treeSelect.setProps({
            filterTreeNode: true
        });
        treeSelect.update();
        searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.exists()).toEqual(true);
    });

    it('searchPlaceholder', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            searchPlaceholder: 'test',
        });
        let searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.find('input').instance().getAttribute('placeholder')).toEqual('test');
    });

    it('onSearch', () => {
        let onSearch = value => { };
        let spyOnSearch = sinon.spy(onSearch);
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            onSearch: spyOnSearch,
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'semi';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(spyOnSearch.calledOnce).toBe(true);
        expect(spyOnSearch.calledWithMatch(searchValue)).toBe(true);

        /* Check the input parameters of onSearch */
        searchValue = '北京';
        event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(spyOnSearch.callCount).toBe(2);
        const firstCall = spyOnSearch.getCall(1);
        const args = firstCall.args;
        expect(args[0]).toEqual('北京');
        expect(args[1].includes('yazhou')).toEqual(true);
        expect(args[1].includes('zhongguo')).toEqual(true);
    });

    it('filterTreeNode shows correct result', () => {
        let treeSelect1 = getTreeSelect({
            filterTreeNode: true,
        });
        const searchWrapper = treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = '北';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(6);
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(2);
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).at(0).instance().textContent).toEqual('北');
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).at(1).instance().textContent).toEqual('北');
        treeSelect1.unmount();

        let treeSelect2 = getTreeSelect({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
        });
        const searchWrapper2 = treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue2 = 'an';
        let event2 = { target: { value: searchValue2 } };
        searchWrapper2.find('input').simulate('change', event2);
        expect(treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(10);
    });

    it('filterTreeNode + no result', () => {
        let treeSelect1 = getTreeSelect({
            filterTreeNode: true,
        });
        const searchWrapper = treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(2);
        expect(treeSelect1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(0);
        treeSelect1.unmount();

        let treeSelect2 = getTreeSelect({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
        });
        const searchWrapper2 = treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue2 = '北';
        let event2 = { target: { value: searchValue2 } };
        searchWrapper2.find('input').simulate('change', event2);
        expect(treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(2);
    });

    it('async load data', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        const then = jest.fn(() => Promise.resolve());
        const loadData = jest.fn(() => ({ then }));
        const data = {
            label: '亚洲',
            value: 'Asia',
            key: 'asia',
        };
        const treeSelect = getTreeSelect({
            loadData,
            loadedKeys: ['0-1'],
            treeData: [data]
        });
        const topNodeAsia = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        const expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        expandIcon.simulate('click', nativeEvent);
        expect(loadData).toHaveBeenCalledWith(data);
        expect(then).toHaveBeenCalled();
    });

    it('filterTreeNode + treeNodeFilterProp', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(6);
    });

    it('filterTreeNode + showFilteredOnly + no result', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            showFilteredOnly: true,
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        let node = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(node.length).toEqual(1);
        expect(node.hasClass(`${BASE_CLASS_PREFIX}-tree-option-empty`)).toEqual(true);
    });

    it('filterTreeNode + showFilteredOnly shows correct result', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            showFilteredOnly: true,
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = '北';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(4);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(2);
    });

    it('filterTreeNode as a func', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: (inputValue, treeNode) => treeNode === inputValue,
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        searchWrapper.find('input').simulate('change', { target: { value: '北' } });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(0);
        // update
        searchWrapper.find('input').simulate('change', { target: { value: '北京' } });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(1);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).instance().textContent).toEqual('北京');
    });

    it('controlled: value shows correct', () => {
        let treeSelect = getTreeSelect({
            value: 'Beijing'
        });
        let selectedNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('北京');
        treeSelect.unmount();
        // array case only select first item
        let treeSelect2 = getTreeSelect({
            value: ['Riben', 'Beijing']
        });
        let selectedNode2 = treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode2.instance().textContent).toEqual('日本');
        expect(treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('日本');
        expect(treeSelect2.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('controlled: fire onChange and ui not update', () => {
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            value: '',
            defaultExpandAll: true,
            onChange: spyOnChange,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
        let nodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch("Beijing")).toEqual(true);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
    });

    it('controlled: value + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            value: {
                label: '北京',
                value: 'Beijing',
                key: 'beijing',
            },
            defaultExpandAll: true,
            onChange: spyOnChange,
            onChangeWithObject: true,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(true);
    });

    it('virtualized: fixed height', () => {
        let treeSelect = getTreeSelect({
            defaultExpandAll: true,
            virtualize: {
                itemSize: 28,
                height: 84,
            },
        });
        // virtual list
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-virtual-list`).exists()).toEqual(true);
        // fewer nodes
        let nodes = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(nodes.length).toBeLessThan(10);
    });

    it('disabled', () => {
        let treeSelect = getTreeSelect({
            disabled: true,
        });
        let inputBox = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-disabled`);
        expect(inputBox.exists()).toEqual(true);
        expect(treeSelect.state().isOpen).toEqual(false);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-wrapper`).exists()).toEqual(false);

        inputBox.simulate('click');
        expect(treeSelect.state().isOpen).toEqual(false);
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-wrapper`).exists()).toEqual(false);
    });

    it('renderSelectedItem', () => {
        let spyOnSelect = sinon.spy(() => { });
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            renderSelectedItem: treeNode => treeNode.value,
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        const yaZhouKey = 'yazhou';
        const yaZhouValue = 'Yazhou';
        let nodeYaZhou = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        nodeYaZhou.simulate('click');
        // 判断回调，这里其实没有更新，不是很重要
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnSelect.getCall(0).args[0]).toEqual(yaZhouKey);
        expect(spyOnChange.getCall(0).args[0]).toEqual(yaZhouValue);
        // 判断已选项的渲染
        const innerHTML = document.querySelector('.semi-tree-select-selection span').textContent;
        expect(innerHTML).toEqual(yaZhouValue);
    });

    it('search autofocus', () => {
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            searchAutoFocus: true,
        });
        let selectEle = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select`)
        selectEle.simulate('click');
        setTimeout(() => {
            let searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)

            const searchInput = searchWrapper.find(`input`)
            expect(searchInput.matchesElement(document.activeElement)).toEqual(true);
            done();
        }, 100);
    });

    it('treeData is updated should not clear value when uncontrolled mode and single selection', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        const treeSelect = getTreeSelect({
            defaultExpandAll: true
        });
        treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-option-list .${BASE_CLASS_PREFIX}-tree-option`)
            .at(2)
            .simulate('click', nativeEvent);
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeChildren});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeData2});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('');
    });

    it('treeData is updated should not clear value when uncontrolled mode and multiple selection', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        const treeSelect = getTreeSelect({
            defaultExpandAll: true,
            multiple: true,
        });
        treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-option-list .${BASE_CLASS_PREFIX}-tree-option`)
            .at(2)
            .simulate('click', nativeEvent);
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeChildren});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeData2});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .length
        ).toEqual(0);
    });

    it('treeData is updated should not clear value when controlled mode and single selection', () => {
        const treeSelect = getTreeSelect({
            defaultExpandAll: true,
            value: 'Beijing'
        });
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeChildren});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeData3});
        treeSelect.update();
        // If the value exists, but not in the treeData, the value will be displayed in the trigger
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select .${BASE_CLASS_PREFIX}-tree-select-selection span`)
            .getDOMNode()
            .textContent
        ).toEqual('Beijing');
    });

    it('treeData is updated should not clear value when controlled mode and multiple selection', () => {
        const treeSelect = getTreeSelect({
            defaultExpandAll: true,
            multiple: true,
            value: 'Beijing'
        });
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeChildren});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .getDOMNode()
            .textContent
        ).toEqual('北京');
        treeSelect.setProps({ treeData: treeData3});
        treeSelect.update();
        expect(
            treeSelect
            .find(`.${BASE_CLASS_PREFIX}-tree-select-selection .${BASE_CLASS_PREFIX}-tag-group .${BASE_CLASS_PREFIX}-tag`)
            .at(0)
            .find(`.${BASE_CLASS_PREFIX}-tag-content`)
            .length
        ).toEqual(1);
    });

    it('expandedKeys controlled + filterTreeNode', () => {
        const spyOnExpand = sinon.spy(() => { });
        const treeSelect = getTreeSelect({
            expandedKeys: [],
            onExpand: spyOnExpand,
            filterTreeNode: true,
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        const searchValue = '北京';
        const event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(spyOnExpand.callCount).toBe(0);
        /* filter won't impact on the expansion of node when expandedKeys is controlled */
        const topNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });
    
    it('option not in treeData + treeData item with value', () => {
        const spyOnSelect = sinon.spy(() => { });
        const spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            defaultValue: 'fish',
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('fish');
        // beijing
        let topNodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        topNodeBeijing.simulate('click');
        expect(spyOnChange.calledWithMatch("Beijing")).toEqual(true);
        treeSelect.unmount(); 

        // onChangeWithObject
        treeSelect = getTreeSelect({
            defaultValue: { label: '鱼', value: 'Fish', key: 'fish' },
            onChangeWithObject: true,
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('鱼');
        // beijing
        topNodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        topNodeBeijing.simulate('click');
        expect(spyOnChange.calledWithMatch({ label: '北京', value: 'Beijing', key: 'beijing' })).toEqual(true);
        treeSelect.unmount(); 
    })

    it('option not in treeData + treeData item without value', () => {
        const spyOnSelect = sinon.spy(() => { });
        const spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            treeData: treeDataWithoutValue,
            defaultValue: 'fish',
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('fish');
        // beijing
        let topNodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        topNodeBeijing.simulate('click');
        expect(spyOnChange.calledWithMatch("beijing")).toEqual(true);
        treeSelect.unmount(); 

        // onChangeWithObject
        treeSelect = getTreeSelect({
            defaultValue: { label: '鱼', key: 'fish' },
            onChangeWithObject: true,
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        expect(treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection`).getDOMNode().textContent).toEqual('鱼');
        // beijing
        topNodeBeijing = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        topNodeBeijing.simulate('click');
        expect(spyOnChange.calledWithMatch({ label: '北京', key: 'beijing' })).toEqual(true);
        treeSelect.unmount(); 
    })

    it('keyMaps', () => {
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            treeData: specialTreeData,
            defaultValue: 'Beijing',
            onChange: spyOnChange,
            defaultExpandAll: true,
            motion: false,
            keyMaps: defaultKeyMaps
        });
        let disabledNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`).at(0);
        expect(disabledNode.find(`.${BASE_CLASS_PREFIX}-tree-option-label-text`).instance().textContent).toEqual('中国');
        let selectedNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        let nodeShanghai = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(1);
        // select beijing
        nodeShanghai.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch("Shanghai")).toEqual(true);
        let selectContentNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection-content`)
        expect(selectContentNode.instance().textContent).toEqual('上海');
    });

    it('keyMaps + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let treeSelect = getTreeSelect({
            treeData: specialTreeData,
            defaultValue: {
                label1: '北京',
                value1: 'Beijing',
                key1: 'beijing',
            },
            onChangeWithObject: true,
            onChange: spyOnChange,
            defaultExpandAll: true,
            keyMaps: defaultKeyMaps
        });
        let disabledNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`).at(0);
        expect(disabledNode.find(`.${BASE_CLASS_PREFIX}-tree-option-label-text`).instance().textContent).toEqual('中国');
        let selectedNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        let nodeShanghai = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(1);
        // select beijing
        nodeShanghai.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({
            label1: '上海',
            value1: 'Shanghai',
            key1: 'shanghai',
        })).toEqual(true);
        let selectContentNode = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-select-selection-content`)
        expect(selectContentNode.instance().textContent).toEqual('上海');
    });

    it('onSearch + filteredNodes', () => {
        let spyOnSearch = sinon.spy(() => { });
        console.log('treeDataEn', treeDataEn);
        let treeSelect = getTreeSelect({
            filterTreeNode: true,
            treeData: treeDataEn,
            onSearch: spyOnSearch
        });
        const searchWrapper = treeSelect.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'o';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        const firstCall = spyOnSearch.getCall(0);
        const args = firstCall.args;
        expect(args[0]).toEqual(searchValue);
        expect(args[1]).toEqual(['0-1', '0']);
        expect(args[2]).toEqual([
            treeDataEnNA,
            { "label": "Osaka", "value": "Osaka", "key": "0-1-0" }
        ]);
    });
})
