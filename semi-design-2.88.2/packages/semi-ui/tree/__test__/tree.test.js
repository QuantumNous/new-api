import { isEqual } from 'lodash';
import { IconMapPin } from '@douyinfe/semi-icons';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { Tree, Button } from '../../index';

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
        newLabel: '亚洲#1#yazhou',
        children: [
            {
                label: '中国',
                value: 'China',
                key: '0-0',
                newLabel: '中国#2#zhongguo',
                children: [
                    {
                        label: '北京',
                        value: 'Beijing',
                        key: '0-0-0',
                        newLabel: '北京#3#beijing',
                    },
                    {
                        label: '上海',
                        value: 'Shanghai',
                        key: '0-0-1',
                        newLabel: '上海#4#shanghai',
                    },
                ],
            },
        ],
    },
    {
        label: '北美洲',
        value: 'North America',
        newLabel: '北美洲#5#beimeizhou',
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

const defaultKeyMaps = {
    value: 'value1',
    key: 'key1',
    label: 'label1',
    children: 'children1',
    disabled: 'disabled1'
}

const dragNodeData = {"label":"亚洲","value":"Yazhou","key":"yazhou","children":[{"label":"中国","value":"Zhongguo","key":"zhongguo","children":[{"label":"北京","value":"Beijing","key":"beijing"},{"label":"上海","value":"Shanghai","key":"shanghai"}]},{"label":"日本","value":"Riben","key":"riben","children":[{"label":"东京","value":"Dongjing","key":"dongjing"},{"label":"大阪","value":"Daban","key":"daban"}]}],"expanded":false,"pos":"0-0"}
const dropNodeData = {"label":"北美洲","value":"Beimeizhou","key":"beimeizhou","children":[{"label":"美国","value":"Meiguo","key":"meiguo"},{"label":"加拿大","value":"Jianada","key":"jianada"}],"expanded":false,"pos":"0-1"}

function getTree(props) {
    props = { treeData: treeData, ...props }
    return mount(
        <Tree
            {...props}
            motion={true}
        />,
        {
            attachTo: document.getElementById('container')
        }
    );
}

describe('Tree', () => {

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
        let tree = getTree(props);
        expect(tree.hasClass('test')).toEqual(true);
        expect(tree.find('div.test')).toHaveStyle('height', 420);
    });

    it('blockNode', () => {
        let tree = getTree({
            defaultValue: 'Beijing'
        });
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-list-block`).exists()).toEqual(true);
        tree.setProps({ blockNode: false });

        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-list-block`).exists()).toEqual(false);
    });

    it('empty data', () => {
        let tree = getTree({
            treeData: []
        });
        let node = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(node.length).toEqual(1);
        expect(node.hasClass(`${BASE_CLASS_PREFIX}-tree-option-empty`)).toEqual(true);
    });

    it('defaultValue', () => {
        // auto expand parent, if node exist means parent is open
        let tree = getTree({
            defaultValue: 'Beijing'
        });
        let selectedNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        tree.unmount();
        // array case only select first item
        let tree2 = getTree({
            defaultValue: ['Riben', 'Beijing']
        });
        let selectedNode2 = tree2.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode2.instance().textContent).toEqual('日本');
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    })

    it('defaultExpandedKeys', () => {
        // auto expand parent
        let tree = getTree({
            defaultExpandedKeys: ['zhongguo', 'beimeizhou']
        });
        // yazhou beimeizhou
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        // zhongguo riben
        let children = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`);
        expect(children.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(children.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    })

    it('defaultExpandAll', () => {
        let tree = getTree({
            defaultExpandAll: true
        });
        let nodes = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        let collapsed = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes.length).toEqual(10);
        expect(collapsed.length).toEqual(0);

        tree.setProps({ treeData: treeData2});
        tree.update();
        const nodes2 = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed2 = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes2.length).toEqual(2);
        expect(collapsed2.length).toEqual(2);
    })

    it('expandAll', () => {
        const tree = getTree({
            expandAll: true
        });
        const nodes = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes.length).toEqual(10);
        expect(collapsed.length).toEqual(0);

        tree.setProps({ treeData: treeData2});
        tree.update();
        const nodes2 = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        const collapsed2 = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-collapsed`);
        expect(nodes2.length).toEqual(5);
        expect(collapsed2.length).toEqual(0);
    })
    

    it('directory mode', () => {
        let props = {
            defaultExpandedKeys: ['beimeizhou'],
            directory: true,
        };
        let tree = getTree(props);
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(1).find(`.${BASE_CLASS_PREFIX}-icon-folder_open`).exists()).toEqual(true);
        expect(topNode.at(0).find(`.${BASE_CLASS_PREFIX}-icon-folder`).exists()).toEqual(true);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0).find(`.${BASE_CLASS_PREFIX}-icon-file`).exists()).toEqual(true);
    });

    it('custom icon', () => {
        let props = {
            defaultExpandAll: true,
            icon: (<IconMapPin />)
        };
        let tree = getTree(props);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-icon-map_pin`).length).toEqual(10);
    });

    it('if expandedKeys values work', () => {
        // auto expand parent
        let tree = getTree({
            expandedKeys: ['beimeizhou']
        });
        // yazhou beimeizhou
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        tree.setProps({ expandedKeys: ['yazhou', 'zhongguo', 'beimeizhou'] });
        tree.update();
        // zhongguo riben
        let children = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`);
        expect(children.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(children.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('expandedKeys + autoExpandParent', () => {
        // auto expand parent is always true when mounted
        let tree = getTree({
            expandedKeys: ['beimeizhou']
        });
        // yazhou beimeizhou
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);

        tree.setProps({ expandedKeys: ['riben'] });
        tree.update();
        topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);

        // autoExpandParent
        tree.setProps({ autoExpandParent: true });
        tree.update();
        topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('if expand behavior works / onExpand', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let tree = getTree({
            onExpand: spyOnExpand,
        });
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        let expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        // expand yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledOnce).toBe(true);
        expect(spyOnExpand.calledWithMatch(["yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // yazhou beimeizhou
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        // collapse yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledWithMatch([], { expanded: false, node: { key: 'yazhou' } })).toEqual(true);
        topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('if expandedKeys controlled work / onExpand', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let tree = getTree({
            expandedKeys: ['beimeizhou'],
            onExpand: spyOnExpand,
        });
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        let expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        // expand yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(spyOnExpand.calledWithMatch(["beimeizhou", "yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // zhongguo riben
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('select item / onSelect / onChange', () => {
        let spyOnSelect = sinon.spy(() => { });
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            defaultExpandAll: true,
            onSelect: spyOnSelect,
            onChange: spyOnChange,
        });
        let nodeBeijing = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch('beijing', true, { key: "beijing" })).toEqual(true);
        expect(spyOnChange.calledWithMatch('Beijing')).toEqual(true);
        // classname
        nodeBeijing = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        expect(nodeBeijing.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(true);
        // change
        let nodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // select asia
        nodeAsia.simulate('click');
        // onSelect & onChange
        expect(spyOnSelect.calledWithMatch('yazhou', true, { key: "yazhou" })).toEqual(true);
        expect(spyOnChange.calledWithMatch('Yazhou')).toEqual(true);
        // classname
        nodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        expect(nodeAsia.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(true);
    });

    it('onChange + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            defaultExpandAll: true,
            onChangeWithObject: true,
            onChange: spyOnChange,
        });
        let nodeBeijing = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({ key: "beijing" })).toEqual(true);
    });

    it('filterTreeNode = true shows input box', () => {
        let tree = getTree({});
        let searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.exists()).toEqual(false);
        tree.setProps({ filterTreeNode: true });
        tree.update();
        searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.exists()).toEqual(true);
    });

    it('onSearch', () => {
        let onSearch = value => { };
        let spyOnSearch = sinon.spy(onSearch);
        let tree = getTree({
            filterTreeNode: true,
            onSearch: spyOnSearch,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'semi';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(spyOnSearch.calledOnce).toBe(true);
        expect(spyOnSearch.calledWithMatch(searchValue)).toBe(true);
    });

    it('emptyContent', () => {
        let onSearch = value => { };
        let spyOnSearch = sinon.spy(onSearch);
        let tree = getTree({
            filterTreeNode: true,
            onSearch: spyOnSearch,
            emptyContent: 'diy empty',
            showFilteredOnly: true,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'asd';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-label-empty`).getDOMNode().textContent).toEqual('diy empty');
    });

    it('searchClassName / searchPlaceholder / searchStyle', () => {
        let tree = getTree({
            filterTreeNode: true,
            searchClassName: 'search',
            searchPlaceholder: 'placeholder',
            searchStyle: { padding: 16 },
            showClear: true,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`)
        expect(searchWrapper.hasClass('search')).toEqual(true);
        expect(searchWrapper).toHaveStyle('padding', 16);
        expect(searchWrapper.find('input').instance().getAttribute('placeholder')).toEqual('placeholder');
    });

    it('filterTreeNode shows correct result', () => {
        let tree1 = getTree({
            filterTreeNode: true,
        });
        const searchWrapper = tree1.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = '北';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(6);
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(2);
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).at(0).instance().textContent).toEqual('北');
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).at(1).instance().textContent).toEqual('北');
        tree1.unmount();

        let tree2 = getTree({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
        });
        const searchWrapper2 = tree2.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue2 = 'an';
        let event2 = { target: { value: searchValue2 } };
        searchWrapper2.find('input').simulate('change', event2);
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(10);
    });

    it('filterTreeNode + no result', () => {
        let tree1 = getTree({
            filterTreeNode: true,
        });
        const searchWrapper = tree1.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(2);
        expect(tree1.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(0);
        tree1.unmount();

        let tree2 = getTree({
            filterTreeNode: true,
            treeNodeFilterProp: 'value',
        });
        const searchWrapper2 = tree2.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue2 = '北京';
        let event2 = { target: { value: searchValue2 } };
        searchWrapper2.find('input').simulate('change', event2);
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(2);
    });

    if('filterTreeNode + treeNodeFilterProp + hightLight right') {
        let tree = getTree({
            treeData: treeData3,
            filterTreeNode: true,
            treeNodeFilterProp: 'newLabel'
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = '中';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(3);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(1);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).instance().textContent).toEqual("中");
        tree.unmount();
    }

    it('filterTreeNode + showFilteredOnly + no result', () => {
        let tree = getTree({
            filterTreeNode: true,
            showFilteredOnly: true,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = 'Bei';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        let node = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(node.length).toEqual(1);
        expect(node.hasClass(`${BASE_CLASS_PREFIX}-tree-option-empty`)).toEqual(true);
    });

    it('filterTreeNode + showFilteredOnly shows correct result', () => {
        let tree = getTree({
            filterTreeNode: true,
            showFilteredOnly: true,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        let searchValue = '北';
        let event = { target: { value: searchValue } };
        searchWrapper.find('input').simulate('change', event);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option`).length).toEqual(4);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(2);
    });

    it('filterTreeNode as a func', () => {
        let tree = getTree({
            filterTreeNode: (inputValue, treeNode) => treeNode === inputValue,
        });
        const searchWrapper = tree.find(`.${BASE_CLASS_PREFIX}-tree-search-wrapper`);
        searchWrapper.find('input').simulate('change', { target: { value: '北' } });
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(0);
        // update
        searchWrapper.find('input').simulate('change', { target: { value: '北京' } });
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).length).toEqual(1);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-highlight`).instance().textContent).toEqual('北京');
    });

    it('controlled: value shows correct', () => {
        let tree = getTree({
            value: 'Beijing'
        });
        let selectedNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        tree.unmount();
        // array case only select first item
        let tree2 = getTree({
            value: ['Riben', 'Beijing']
        });
        let selectedNode2 = tree2.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode2.instance().textContent).toEqual('日本');
        expect(tree2.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);

    });

    it('controlled: fire onChange and ui not update', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            value: '',
            defaultExpandAll: true,
            onChange: spyOnChange,
        });
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
        let nodeBeijing = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        // select beijing
        nodeBeijing.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch("Beijing")).toEqual(true);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
    });

    it('controlled: value + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            value: {
                label: '北京',
                value: 'Beijing',
                key: 'beijing',
            },
            defaultExpandAll: true,
            onChange: spyOnChange,
            onChangeWithObject: true,
        });
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(true);
    });

    it('virtualized: fixed height', () => {
        let tree = getTree({
            defaultExpandAll: true,
            virtualize: {
                itemSize: 28,
                height: 84,
            },
        });
        // virtual list 
        debugger
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-virtual-list`).exists()).toEqual(true);
        // fewer nodes
        let nodes = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(nodes.length).toBeLessThan(10);
    });

    it('disabled', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            defaultExpandAll: true,
            disabled: true,
            onChange: spyOnChange,
        });
        let nodes = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`);
        expect(nodes.length).toEqual(10);
        // cannot select
        let nodeBeijing = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(0);
        nodeBeijing.simulate('click');
        expect(spyOnChange.notCalled).toBe(true);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
    });

    it('treedata in json format', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = mount(
            <Tree
                defaultExpandAll={true}
                onChange={spyOnChange}
                treeDataSimpleJson={{
                    "Node1": {
                        "Child1": '0-0-1',
                        "Child2": '0-0-2',
                    },
                    "Node2": "0-1"
                }}
            />,
            {
                attachTo: document.getElementById('container')
            }
        );
        let nodes = tree.find(`.${BASE_CLASS_PREFIX}-tree-option`);
        expect(nodes.length).toEqual(4);
        // select
        let child1 = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0);
        child1.simulate('click');
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({
            "Node1": {
                "Child1": '0-0-1',
            },
        })).toEqual(true);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(true);
    });

    it('onContextMenu', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnContextMenu = sinon.spy(() => { });
        let tree = getTree({
            onContextMenu: spyOnContextMenu,
        });
        let event = {};
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // right click on yazhou
        topNodeAsia.simulate('contextmenu', nativeEvent);
        expect(spyOnContextMenu.calledWithMatch(event, { key: 'yazhou' })).toEqual(true);
        // should not select item
        expect(topNodeAsia.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(false);
        expect(tree.state().selectedKeys.length).toEqual(0);
    });

    it('onDoubleClick', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnDoubleClick = sinon.spy(() => { });
        let tree = getTree({
            onDoubleClick: spyOnDoubleClick,
        });
        let event = {};
        // yazhou
        let topNodeAsia = tree.find('.semi-tree-option.semi-tree-option-level-1').at(0);
        // double click on yazhou
        topNodeAsia.simulate('doubleClick', nativeEvent);
        expect(spyOnDoubleClick.calledWithMatch(event, { key: 'yazhou' })).toEqual(true);
        // should not select item
        expect(topNodeAsia.hasClass(`${BASE_CLASS_PREFIX}-tree-option-selected`)).toEqual(false);
        expect(tree.state().selectedKeys.length).toEqual(0);
    });


    /**
     * Detect whether the expanded item will be expanded according to the value when the value
     *  or treeData is changed, when expandedKeys is not controlled
     */
     const treeJsonData1 = {
        "Node0": {
            "Child Node0-0": '0-0',
            "Child Node0-1": '0-1',
        },
        "Node1": {
            "Child Node1-0": '1-0',
            "Child Node1-1": '1-1',
        }
    };
    const treeJsonData2 = {
        "Updated Node0": { 
            "Updated Child Node0-0": {
                'Updated Child Node0-0-0':'0-0'
            }, 
            "Updated Child Node0-1": '0-1', 
        },
        "Updated Node1": { 
            "Updated Child Node1-0": '1-0', 
            "Updated Child Node1-1": '1-1', 
        }
    };

    it('expandedKeys when treeDataSimpleJson update', () => {
        const tree = mount(
            <Tree
                value='0-0'
                multiple
                treeDataSimpleJson={treeJsonData1}
            />,
            {
                attachTo: document.getElementById('container')
            }
        );
        const treeDataButton = mount(
            <Button
                onClick={() => {
                    if (isEqual(tree.props().treeDataSimpleJson, treeJsonData1)) {
                        tree.setProps({ treeDataSimpleJson: treeJsonData2 });
                        tree.update();
                    } else {
                        tree.setProps({ treeDataSimpleJson: treeJsonData1 });
                        tree.update();
                    }
                }}
            >
                update treeData
            </Button>
        );
        expect(
            tree
            .find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`)
            .at(0)
            .hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)
        ).toEqual(false);
        expect(
            tree
            .find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`)
            .at(0)
            .hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)
        ).toEqual(true);
        expect(
            tree
            .find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`)
            .at(1)
            .hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)
        ).toEqual(true);
        treeDataButton.simulate('click');
        expect(
            tree
            .find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`)
            .at(0)
            .hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)
        ).toEqual(false);
        treeDataButton.simulate('click');
        tree.unmount();
        treeDataButton.unmount();
    });

    it('expandAction = false / default behavior', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let tree = getTree({
            onExpand: spyOnExpand,
        });
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // expand yazhou
        topNodeAsia.simulate('click', nativeEvent);
        expect(spyOnExpand.notCalled).toBe(true);
        expect(tree.state().expandedKeys.size).toEqual(0);
    });

    it('expandAction = click', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let tree = getTree({
            onExpand: spyOnExpand,
            expandAction: 'click',
        });
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // expand yazhou
        topNodeAsia.simulate('click', nativeEvent);
        expect(spyOnExpand.calledOnce).toBe(true);
        expect(spyOnExpand.calledWithMatch(["yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // yazhou beimeizhou
        let topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(false);
        expect(topNode.at(1).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
        // collapse yazhou
        topNodeAsia.simulate('click', nativeEvent);
        expect(spyOnExpand.calledWithMatch([], { expanded: false, node: { key: 'yazhou' } })).toEqual(true);
        topNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`);
        expect(topNode.at(0).hasClass(`${BASE_CLASS_PREFIX}-tree-option-collapsed`)).toEqual(true);
    });

    it('expandAction = doubleClick', () => {
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: () => { } } }
        let spyOnExpand = sinon.spy(() => { });
        let tree = getTree({
            onExpand: spyOnExpand,
            expandAction: 'doubleClick',
        });
        // yazhou
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        // expand yazhou
        topNodeAsia.simulate('click', nativeEvent);
        expect(spyOnExpand.calledOnce).toBe(false);
        topNodeAsia.simulate('doubleClick', nativeEvent);
        expect(spyOnExpand.calledOnce).toBe(true);
        expect(spyOnExpand.calledWithMatch(["yazhou"], { expanded: true, node: { key: 'yazhou' } })).toEqual(true);
        // yazhou beimeizhou
        expect(tree.state().expandedKeys).toEqual(new Set(["yazhou"]));
        expect(tree.state().selectedKeys).toEqual(["yazhou"]);
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
        let tree = getTree({
            loadData,
            treeData: [data]
        });
        let topNodeAsia = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-1`).at(0);
        let expandIcon = topNodeAsia.find(`.${BASE_CLASS_PREFIX}-tree-option-expand-icon`).at(0);
        // expand yazhou
        expandIcon.simulate('click', nativeEvent);
        expect(loadData).toHaveBeenCalledWith(data);
        expect(then).toHaveBeenCalled();
    });

    it('DND - dragStart event', () => {
        const spyOnDragStart = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            onDragStart: spyOnDragStart
        });
        let dragNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(0);
        dragNode.simulate('dragStart');
        expect(spyOnDragStart.calledOnce).toBe(true);
        expect(spyOnDragStart.calledWithMatch({node: dragNodeData})).toEqual(true);
    });

    it('DND - dragEnter event', (done) => {
        const spyOnDragEnter = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            // autoExpandWhenDragEnter: false,
            onDragEnter: spyOnDragEnter
        });
        let dragNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(0);
        dragNode.simulate('dragStart');
        dragNode.simulate('dragEnter');
        // not trigger on self
        expect(spyOnDragEnter.notCalled).toBe(true);

        let dropNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(1);
        dropNode.simulate('dragEnter');
        setTimeout(() => {
            expect(spyOnDragEnter.calledOnce).toBe(true);
            expect(spyOnDragEnter.calledWithMatch({node: dropNodeData, expandedKeys: ['beimeizhou']})).toEqual(true);
            done();
        }, 500);
    });

    it('DND - dragOver event', () => {
        const spyOnDragOver = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            onDragOver: spyOnDragOver
        });
        let dropNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(1);
        dropNode.simulate('dragOver');
        expect(spyOnDragOver.calledOnce).toBe(true);
        expect(spyOnDragOver.calledWithMatch({node: dropNodeData})).toEqual(true);
    });

    it('DND - dragLeave event', () => {
        const spyOnDragLeave = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            onDragLeave: spyOnDragLeave
        });
        let dropNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(1);
        dropNode.simulate('dragLeave');
        expect(spyOnDragLeave.calledOnce).toBe(true);
        expect(spyOnDragLeave.calledWithMatch({node: dropNodeData})).toEqual(true);
    });

    it('DND - drop event', () => {
        const spyOnDrop = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            onDrop: spyOnDrop
        });
        let dragNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(0);
        dragNode.simulate('dragStart');

        let dropNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(1);
        dropNode.simulate('drop');
        expect(spyOnDrop.calledOnce).toBe(true);
        expect(spyOnDrop.calledWithMatch({
            dragNode: dragNodeData,
            dragNodesKeys: ["yazhou","zhongguo","beijing","shanghai","riben","dongjing","daban"],
            dropPosition: 1
        })).toEqual(true);
    });

    it('DND - dragEnd event', () => {
        const spyOnDragEnd = sinon.spy(() => { });
        let tree = getTree({
            draggable: true,
            onDragEnd: spyOnDragEnd
        });
        let dragNode = tree.find('.semi-tree-option.semi-tree-option-level-1').at(0);
        dragNode.simulate('dragEnd');
        expect(spyOnDragEnd.calledOnce).toBe(true);
        expect(spyOnDragEnd.calledWithMatch({node: dragNodeData})).toEqual(true);
    });

    it('keyMaps', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            treeData: specialTreeData,
            defaultValue: 'Beijing',
            onChange: spyOnChange,
            defaultExpandAll: true,
            motion: false,
            keyMaps: defaultKeyMaps
        });
        let disabledNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`).at(0);
        expect(disabledNode.find(`.${BASE_CLASS_PREFIX}-tree-option-label-text`).instance().textContent).toEqual('中国');
        let selectedNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        let nodeShanghai = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(1);
        // select beijing
        nodeShanghai.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch("Shanghai")).toEqual(true);
    });

    it('keyMaps + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
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
        let disabledNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`).at(0);
        expect(disabledNode.find(`.${BASE_CLASS_PREFIX}-tree-option-label-text`).instance().textContent).toEqual('中国');
        let selectedNode = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`);
        expect(selectedNode.instance().textContent).toEqual('北京');
        let nodeShanghai = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-3`).at(1);
        // select beijing
        nodeShanghai.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({
            label1: '上海',
            value1: 'Shanghai',
            key1: 'shanghai',
        })).toEqual(true);
    });

})
