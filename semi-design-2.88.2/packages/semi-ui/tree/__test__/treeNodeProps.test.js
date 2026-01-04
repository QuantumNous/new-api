import { Tree, Button } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { IconMapPin } from '@douyinfe/semi-icons';


const treeChildren = [
    {
        label: '北京',
        value: 'beijing',
        key: 'beijing',
    },
    {
        label: '上海',
        value: 'shanghai',
        key: 'shanghai',
    },
];

const treeDataDisabled = [
    {
        label: '亚洲',
        value: 'Yazhou',
        key: 'yazhou',
        children: [
            {
                label: '中国',
                value: 'Zhongguo',
                key: 'zhongguo',
                disabled: true,
                children: treeChildren,
            },
            {
                label: '日本',
                value: 'Riben',
                key: 'riben',
            },
        ],
    }
];

const treeDataIcon = [
    {
        label: '亚洲',
        value: 'Yazhou',
        key: 'yazhou',
        children: [
            {
                label: '中国',
                value: 'Zhongguo',
                key: 'zhongguo',
                icon: (<IconMapPin />),
                children: treeChildren,
            },
            {
                label: '日本',
                value: 'Riben',
                key: 'riben',
            },
        ],
    }
];

const treeDataExtra = [
    {
        label: '亚洲',
        value: 'Yazhou',
        key: 'yazhou',
        children: [
            {
                label: '中国',
                value: 'Zhongguo',
                key: 'zhongguo',
                info: 'extra',
                children: treeChildren,
            },
            {
                label: '日本',
                value: 'Riben',
                key: 'riben',
            },
        ],
    }
];

function getTree(props) {
    return mount(
        <Tree
            defaultExpandAll
            // multiple
            {...props}
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

    it('disable', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            treeData: treeDataDisabled,
            onChange: spyOnChange,
        });
        let node = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`);
        expect(node.instance().textContent).toEqual('中国');
        node.simulate('click');
        expect(spyOnChange.notCalled).toBe(true);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
    });

    it('disable + multiple', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            treeData: treeDataDisabled,
            onChange: spyOnChange,
            multiple: true
        });
        let node = tree.find(`.${BASE_CLASS_PREFIX}-tree-option-disabled`);
        expect(node.instance().textContent).toEqual('中国');
        node.simulate('click');
        expect(spyOnChange.notCalled).toBe(true);
        expect(node.find(`.${BASE_CLASS_PREFIX}-checkbox-disabled`).exists()).toEqual(true);
    });

    it('custom icon', () => {
        let props = {
            treeData: treeDataIcon,
        };
        let tree = getTree(props);
        expect(tree.find(`.${BASE_CLASS_PREFIX}-icon-map_pin`).length).toEqual(1);
    });

    it('custom props + onChangeWithObject', () => {
        let spyOnChange = sinon.spy(() => { });
        let tree = getTree({
            treeData: treeDataExtra,
            onChangeWithObject: true,
            onChange: spyOnChange,
        });
        // zhongguo
        let node = tree.find(`.${BASE_CLASS_PREFIX}-tree-option.${BASE_CLASS_PREFIX}-tree-option-level-2`).at(0);
        node.simulate('click');
        // onSelect & onChange
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch({ info: "extra" })).toEqual(true);
    })

    it('ReactNode label', () => {
        let spyOnClick = sinon.spy(() => { });
        const treeData = [
            {
                label: (
                    <span>
                        <span style={{ marginRight: 30 }}>亚洲</span>
                        <Button
                            style={{ zIndex: 2 }}
                            onClick={e => { spyOnClick(); e.stopPropagation() }}
                        >
                            Click
                        </Button>
                    </span>
                ),
                value: 'yazhou',
                key: 'yazhou',
            }
        ];
        let tree = getTree({ treeData });
        let button = tree.find(`.${BASE_CLASS_PREFIX}-button`);
        button.simulate('click');
        expect(button.exists()).toEqual(true);
        expect(spyOnClick.calledOnce).toBe(true);
        // event stopPropagation 
        expect(tree.find(`.${BASE_CLASS_PREFIX}-tree-option-selected`).exists()).toEqual(false);
    });
})
