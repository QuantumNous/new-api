import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { difference, isEqual } from 'lodash';
import { IconEdit, IconMapPin, IconMore, IconChevronDown, IconPlus, IconMinus } from '@douyinfe/semi-icons';
import Tree from '../index';
import AutoSizer from '../autoSizer';
import { Button, ButtonGroup, Input, Popover, Toast, Space, Select, Switch, Typography, Tag } from '../../index';
import BigTree from './BigData';
import testData from './data';
import copy from 'fast-copy';

const TreeNode = Tree.TreeNode;
const { Title } = Typography;

export default {
  title: 'Tree'
}

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

const treeData1 = [
  {
    label: '亚洲',
    value: 'yazhou',
    key: 'yazhou',
    children: [
      {
        label: '中国',
        value: 'zhongguo',
        key: 'zhongguo',
        disabled: true,
        children: treeChildren,
      },
      {
        label: '日本',
        value: 'riben',
        key: 'riben',
        children: [
          {
            label: '东京',
            value: 'dongjing',
            key: 'dongjing',
          },
          {
            label: '大阪',
            value: 'daban',
            key: 'daban',
          },
        ],
      },
    ],
  },
  {
    label: '北美洲',
    value: 'beimeizhou',
    key: 'beimeizhou',
    children: [
      {
        label: '美国',
        value: 'meiguo',
        key: 'meiguo',
      },
      {
        label: '加拿大',
        value: 'jianada',
        key: 'jianada',
      },
    ],
  },
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

const treeDataWithoutValue = [
  {
    label: '亚洲',
    key: 'yazhou',
    children: [
      {
        label: '中国',
        key: 'zhongguo',
        disabled: true,
        children: treeChildren,
      },
      {
        label: '日本',
        key: 'riben',
        children: [
          {
            label: '东京',
            key: 'dongjing',
          },
          {
            label: '大阪',
            key: 'daban',
          },
        ],
      },
    ],
  },
  {
    label: '北美洲',
    key: 'beimeizhou',
    children: [
      {
        label: '美国',
        key: 'meiguo',
      },
      {
        label: '加拿大',
        key: 'jianada',
      },
    ],
  },
];

const treeDataWithIcon = [
  {
    label: 'Asia',
    value: 'Asia',
    key: '0',
    icon: <IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />,
    children: [
      {
        label: 'China',
        value: 'China',
        key: '0-0',
        icon: <IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />,
      },
      {
        label: 'Japan',
        value: 'Japan',
        key: '0-1',
        icon: <IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />,
      },
    ],
  },
];

let opts = {
  content: 'Hi, Bytedance dance dance',
  duration: 3,
};

const treeDataWithNode = [
  {
    label: (
      <span>
        <span style={{ marginRight: 30 }}>亚洲</span>
        <Button
          style={{ zIndex: 2 }}
          onClick={e => {
            Toast.info(opts);
            e.stopPropagation();
          }}
        >
          Display Toast
        </Button>
      </span>
    ),
    value: 'yazhou',
    key: 'yazhou',
    children: [
      {
        label: '中国',
        value: 'zhongguo',
        key: 'zhongguo',
        children: [
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
        ],
      },
      {
        label: '日本',
        value: 'riben',
        key: 'riben',
      },
    ],
  },
  {
    label: '北美洲',
    value: 'beimeizhou',
    key: 'beimeizhou',
    children: [
      {
        label: '美国',
        value: 'meiguo',
        key: 'meiguo',
      },
      {
        label: '加拿大',
        value: 'jianada',
        key: 'jianada',
      },
    ],
  },
];

const treeJson = {
  Node1: {
    Child1: {
      child11: '0-0-1',
      child12: '0-0-2'
    },
    Child2: {
      child21: '0-1-1',
    },
  },
  Node2: '0-1',
};

const benchmarkSet = size => {
  console.time('benchmarkSet');
  var set = new Set();
  for (var i = 0; i < size; i++) set.add(i);
  for (var i = 0; i < size; i++) set.has(i);
  console.timeEnd('benchmarkSet');
};

const benchmarkArr = size => {
  console.time('benchmarkArr');
  var arr = [];
  for (var i = 0; i < size; i++) arr.push(i);
  for (var i = 0; i < size; i++) arr.indexOf(i);
  console.timeEnd('benchmarkArr');
};

export const BenchMark = () => {
  const size = 100000;
  benchmarkSet(size);
  benchmarkArr(size);
  return <div>check console please</div>;
};

BenchMark.story = {
  name: 'bench mark',
};

export const SimpleTree = () => (
  <Tree
    treeData={treeData1}
    // onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
    // onSelect={(e, bool, node) => console.log('select', e, bool, node)}
    // onChange={e => console.log('change', e)}
    onContextMenu={(e, node) => console.log(e.currentTarget, node)}
    onDoubleClick={(e, node) => console.log(e, node)}
    motion={true}
  />
);

SimpleTree.story = {
  name: 'simple tree',
};

export const MultipleTree = () => (
  <Tree
    treeData={treeData1}
    multiple
    labelInValue
    // onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
    // onSelect={(e, bool) => console.log('select', e, bool)}
    onContextMenu={(e, node) => console.log(e, node)}
    onDoubleClick={(e, node) => console.log(e, node)}
    onChange={e => console.log('change', e)}
  />
);

MultipleTree.story = {
  name: 'multiple tree',
};

export const SearchableTree = () => (
  <Tree
    treeData={treeData1}
    filterTreeNode
    treeNodeFilterProp="value"
    multiple
    searchStyle={{ width: '300px' }}
  />
);

SearchableTree.story = {
  name: 'searchable tree',
};

export const DisabledTree = () => (
  <Tree treeData={treeData1} defaultValue={['dongjing', 'daban']} multiple disabled />
);

DisabledTree.story = {
  name: 'disabled tree',
};

export const DefaultTree = () => (
  <div>
    <Tree treeData={treeData1} defaultValue={['zhongguo']} />
    <br />
    <Tree
      treeData={treeData1}
      multiple
      defaultValue={['shanghai', 'dongjing', 'beijing', 'daban']}
      onChange={e => console.log(e)}
      onSelect={e => console.log(e)}
    />
  </div>
);

DefaultTree.story = {
  name: 'default tree',
};

export const ExpandAction = () => (
  <div>
    <Tree treeData={treeData1} defaultValue={['zhongguo']} />
    <br />
    <Tree
      treeData={treeData1}
      //multiple
      defaultValue={['shanghai', 'dongjing', 'beijing', 'daban']}
      expandAction="click"
      onDoubleClick={e => console.log(e.detail)}
    />
    <br />
    <Tree
      treeData={treeData1}
      multiple
      defaultValue={['shanghai', 'dongjing', 'beijing', 'daban']}
      expandAction="doubleClick"
    />
  </div>
);

ExpandAction.story = {
  name: 'expandAction',
};

class Demo extends React.Component {
  constructor() {
    super();
    this.state = {
      value: 'shanghai',
    };
  }

  onChange(value) {
    this.setState({ value });
  }

  render() {
    return (
      <Tree
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        value={this.state.value}
        placeholder="Please select"
        onChange={e => this.onChange(e)}
      />
    );
  }
}

export const ControlledComponentSingle = () => <Demo />;

ControlledComponentSingle.story = {
  name: 'controlled Component single',
};

class Demo2 extends React.Component {
  constructor() {
    super();
    this.state = {
      value: ['shanghai', 'beijing', 'zhongguo'],
    };
  }

  onChange(value) {
    console.log(value);
    this.setState({ value });
  }

  render() {
    console.log(this.state.value);
    return (
      <Tree
        style={{ width: 300 }}
        multiple
        dropdownStyle={{ maxHeight: 200, overflow: 'auto' }}
        treeData={treeData1}
        value={this.state.value}
        placeholder="Please select"
        onChange={e => this.onChange(e)}
      />
    );
  }
}

export const ControlledComponentMultiple = () => <Demo2 />;

ControlledComponentMultiple.story = {
  name: 'controlled Component multiple',
};

export const JsonTree = () => (
  <div>
    <Tree
      treeDataSimpleJson={treeJson}
      onChange={e => console.log('change', e)}
      onSelect={e => console.log('select', e)}
    />
    <br />
    <Tree
      treeDataSimpleJson={treeJson}
      multiple
      onChange={e => console.log(e)}
      onSelect={e => console.log(e)}
    />
  </div>
);

JsonTree.story = {
  name: 'json tree',
};

export const IconTree = () => (
  <div>
    <Tree treeData={treeDataWithIcon} />
    <br />
    <Tree treeData={treeDataWithIcon} multiple blockNode />
  </div>
);

IconTree.story = {
  name: 'icon tree',
};

export const DirectoryTree = () => <Tree treeData={treeData1} directory multiple blockNode />;

DirectoryTree.story = {
  name: 'directory tree',
};

const button = (
  <ButtonGroup size="small" theme="borderless">
    <Button
      onClick={e => {
        Toast.info(opts);
        e.stopPropagation();
      }}
    >
      提示
    </Button>
    <Button>点击</Button>
  </ButtonGroup>
);

const style = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const treeDataWithNode2 = [
  {
    label: (
      <div style={style}>
        <span>亚洲</span>
        <ButtonGroup size="small" theme="borderless">
          {button}
        </ButtonGroup>
      </div>
    ),
    value: 'yazhou',
    key: 'yazhou',
    children: [
      {
        label: (
          <div style={style}>
            <span>中国</span>
            {button}
          </div>
        ),
        value: 'zhongguo',
        key: 'zhongguo',
        children: [
          {
            label: (
              <div style={style}>
                <span>test</span>
                {button}
              </div>
            ),
            value: 'test',
            key: 'test',
          },
        ],
      },
      {
        label: (
          <div style={style}>
            <span>日本</span>
            {button}
          </div>
        ),
        value: 'riben',
        key: 'riben',
      },
    ],
  },
];

export const TreeLabelUsingNode = () => (
  <div>
    <Tree treeData={treeDataWithNode2} blockNode defaultExpandAll />
  </div>
);

TreeLabelUsingNode.story = {
  name: 'tree label using node',
};

const treeDataTest = [
  {
    value: '一级标签1',
    label: '一级标签1',
    id: 1,
    key: '1',
  },
];

class TagSideSheet2 extends React.Component {
  constructor() {
    super();
    this.state = {
      tagList: [],
      visibles: false,
    };
    this.onVisible = this.onVisible.bind(this);
    this.renderLabel = this.renderLabel.bind(this);
    this.transLabel = this.transLabel.bind(this);
  }

  componentDidMount() {
    let tagList = [...treeDataTest];
    this.setState({
      tagList,
    });
  }

  onVisible(visibles) {
    this.setState({
      visibles,
    });
  }

  renderLabel(item) {
    const { visibles } = this.state;
    console.log('rendering label', visibles);
    return (
      <Popover trigger="custom" position="bottomLeft" visible={visibles} content={'测试popover'}>
        <Button
          icon={<IconEdit />}
          onClick={e => {
            e.stopPropagation();
            this.onVisible(!visibles);
          }}
        >
          {item.label}
        </Button>
      </Popover>
    );
  }

  transLabel(list) {
    // list = copy(list);
    list.forEach(item => {
      item.label = this.renderLabel(item);
      // item.key += Math.random().toString().slice(0, 5);
    });
    return list;
  }

  render() {
    const { tagList = [] } = this.state;
    const transformedTags = this.transLabel(copy(tagList));
    console.log('transformedTags', transformedTags, treeDataTest);
    return <Tree treeData={transformedTags} />;
  }
}

export const TreeLabelUsingPopover = () => <TagSideSheet2 />;

TreeLabelUsingPopover.story = {
  name: 'tree label using popover',
};

export const DefaultExpandKeysTree = () => (
  <>
    <Tree treeData={treeData1} defaultExpandedKeys={['zhongguo', 'beimeizhou']} blockNode />
    <Tree treeData={treeData1} defaultExpandAll blockNode />
    <Tree treeData={treeData1} defaultExpandAll multiple blockNode />
  </>
);

DefaultExpandKeysTree.story = {
  name: 'defaultExpandKeys tree',
};

export const LabelInValueTree = () => (
  <>
    <Tree treeData={treeData1} labelInValue onChange={e => console.log(e)} />
    <Tree treeData={treeData1} labelInValue onChange={e => console.log(e)} multiple />
    <Tree treeData={treeDataWithIcon} labelInValue onChange={e => console.log(e)} multiple />
  </>
);

LabelInValueTree.story = {
  name: 'labelInValue tree',
};

class Test extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
    };
  }

  componentDidMount() {
    setTimeout(() => {
      console.log('set loading');
      this.setState({ loading: true });
    }, 5000);
  }

  render() {
    const treeDataWithNode2 = [
      {
        label: (
          <div style={style}>
            <span>亚洲</span>
            <ButtonGroup size="small" theme="borderless">
              {button}
            </ButtonGroup>
          </div>
        ),
        value: 'yazhou',
        key: 'yazhou',
        children: [
          {
            label: (
              <div style={style}>
                <span>中国</span>
                {button}
              </div>
            ),
            value: 'zhongguo',
            key: 'zhongguo',
            children: [
              {
                label: (
                  <div style={style}>
                    <span>test</span>
                    {button}
                  </div>
                ),
                value: 'test',
                key: 'test',
              },
            ],
          },
          {
            label: (
              <div style={style}>
                <span>日本</span>
                {button}
              </div>
            ),
            value: 'riben',
            key: 'riben',
          },
        ],
      },
    ];
    return <Tree treeData={treeDataWithNode2} />;
  }
}

export const SetStateAfter5S = () => <Test />;

SetStateAfter5S.story = {
  name: 'setState after 5s',
};

class DemoExpandedKeys extends React.Component {
  constructor() {
    super();
    this.state = {
      expand: ['zhongguo', 'beimeizhou'],
    };
  }

  onExpand(expand) {
    console.log(expand);
    this.setState({ expand });
  }

  render() {
    return (
      <Tree
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        expandedKeys={this.state.expand}
        placeholder="Please select"
        onExpand={(e, rest) => this.onExpand(e, rest)}
      />
    );
  }
}

class DemoExpandeKeysMulti extends React.Component {
  constructor() {
    super();
    this.state = {
      expand: ['zhongguo'],
    };
  }

  onExpand(expand) {
    console.log(expand);
    this.setState({ expand });
  }

  render() {
    return (
      <Tree
        style={{ width: 300 }}
        multiple
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        expandedKeys={this.state.expand}
        placeholder="Please select"
        onExpand={e => this.onExpand(e)}
      />
    );
  }
}

export const ExpandedKeys = () => (
  <>
    <DemoExpandedKeys />
    <br />
    <DemoExpandeKeysMulti />
  </>
);

ExpandedKeys.story = {
  name: 'expandedKeys',
};

class DmExpandedKeys extends React.Component {
  constructor() {
    super();
    this.state = {
      treeData: [
        {
          key: '0',
          label: 'item-0',
          value: '0',
        },
      ],
    };
    this.add = this.add.bind(this);
  }

  add() {
    let itemLength = Math.floor(Math.random() * 5) + 1;
    let treeData = new Array(itemLength).fill(0).map((v, i) => {
      let length = Math.floor(Math.random() * 3);
      let children = new Array(length).fill(0).map((cv, ci) => {
        let child = {
          key: `${i}-${ci}`,
          label: `Leaf-${i}-${ci}`,
          value: `${i}-${ci}`,
        };
        return child;
      });
      let item = {
        key: `${i}`,
        label: `Item-${i}`,
        value: `${i}`,
        children,
      };
      return item;
    });
    this.setState({ treeData });
  }

  render() {
    const { treeData } = this.state;
    return (
      <>
        <Tree treeData={this.state.treeData} expandedKeys={['0', '1']} />
        <br />
        <Button onClick={this.add}>动态改变数据</Button>
      </>
    );
  }
}

export const DynamicExpandKeys = () => (
  <>
    <DmExpandedKeys />
  </>
);

DynamicExpandKeys.story = {
  name: 'dynamic expandKeys',
};

class DmSelectedKeys extends React.Component {
  constructor() {
    super();
    this.state = {
      treeData: [
        {
          key: '0',
          label: 'item-0',
          value: '0',
        },
      ],
    };
    this.add = this.add.bind(this);
  }

  add() {
    let itemLength = Math.floor(Math.random() * 5) + 1;
    let treeData = new Array(itemLength).fill(0).map((v, i) => {
      let length = Math.floor(Math.random() * 3);
      let children = new Array(length).fill(0).map((cv, ci) => {
        let child = {
          key: `${i}-${ci}`,
          label: `Leaf-${i}-${ci}`,
          value: `${i}-${ci}`,
        };
        return child;
      });
      let item = {
        key: `${i}`,
        label: `Item-${i}`,
        value: `${i}`,
        children,
      };
      return item;
    });
    this.setState({ treeData });
  }

  render() {
    const { treeData } = this.state;
    return (
      <>
        <Tree treeData={treeData} value={['0-0']} onChange={e => console.log(e)} />
        <br />
        <Button onClick={this.add}>动态改变数据</Button>
      </>
    );
  }
}

export const DynamicSelectedKey = () => (
  <>
    <DmSelectedKeys />
  </>
);

DynamicSelectedKey.story = {
  name: 'dynamic selectedKey',
};

export const LargeAmountOfData = () => (
  <>
    <BigTree />
  </>
);

LargeAmountOfData.story = {
  name: 'large amount of data',
};

export const Autosizer = () => (
  <div
    style={{
      boxSizing: 'border-box',
      height: 400,
      width: 200,
    }}
  >
    <div
      style={{
        boxSizing: 'border-box',
        height: '50%',
        width: 200,
      }}
    >
      <AutoSizer
      // defaultHeight={defaultHeight}
      // defaultWidth={defaultWidth}
      >
        {({ height, width }) => (
          <div
            style={{
              width: width,
              height: height,
            }}
          >
            {`width:${width}, height:${height}`}
          </div>
        )}
      </AutoSizer>
    </div>
  </div>
);

Autosizer.story = {
  name: 'autosizer',
};

const MotionCustomLabelDemo = () => {
  const treeData = [
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
    },
  ];

  const [hoverKey, setHoverKey] = useState();
  const cusLabel = (list = []) => {
    const recusive = (list = []) => {
      if (!list.length) {
        return;
      }
      list.forEach(item => {
        const { type, label, key } = item;
        item.label = (
          <div onMouseEnter={() => setHoverKey(key)}>
            {label}
            {hoverKey === key ? <IconMore /> : null}
          </div>
        );
        recusive(item.children);
      });
    };
    recusive(list);
    return list;
  };
  return <Tree treeData={cusLabel(treeData)} defaultExpandAll />;
};

export const MotionCustomLabel = () => <MotionCustomLabelDemo />;

MotionCustomLabel.story = {
  name: 'motion custom label',
};

const AutoParentDemo = () => {
  const [expandedKeys, setExpandedKeys] = useState(['beimeizhou']);
  const [selectedKeys, setSelectedKeys] = useState(['beimeizhou']);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const onExpand = expandedKeys => {
    console.log('onExpand', expandedKeys);
    // if not set autoExpandParent to false, if children expanded, parent can not collapse.
    // or, you can remove all expanded children keys.
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const onSelect = (selectedKeys, info) => {
    console.log('onSelect:', info);
    setSelectedKeys(selectedKeys);
  };

  return (
    <div>
      <Button
        onClick={() => {
          setSelectedKeys(['riben']);
          setExpandedKeys(['riben']);
          setAutoExpandParent(true);
        }}
      >
        Update
      </Button>
      <Tree
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        onChange={onSelect}
        value={selectedKeys}
        treeData={treeData1}
        multiple
      />
    </div>
  );
};

export const AutoExpandParent = () => (
  <>
    <AutoParentDemo />
  </>
);

AutoExpandParent.story = {
  name: 'autoExpandParent',
};

const findDescendantKeys = node => {
  let res = [node.key];
  const findChild = item => {
    if (!item) return;
    const { children } = item;

    if (children && children.length) {
      children.forEach(child => {
        res.push(child.key);
        findChild(child);
      });
    }
  };
  findChild(node);
  return res;
};

class DyTreeWithExpandControlled extends React.Component {
  constructor() {
    super();
    this.state = {
      treeData: [
        {
          key: '0',
          label: 'item-0',
          value: '0',
        },
      ],
      expandedKeys: [],
      autoExpandParent: false,
      inputValue: '',
      collapsedKeys: new Set([]),
    };
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      !isEqual(prevState.treeData, this.state.treeData) ||
      !isEqual(prevState.inputValue, this.state.inputValue)
    ) {
      const { treeData, inputValue, collapsedKeys } = this.state;
      let filteredKeys = [];

      const findFilteredKey = arr => {
        arr.forEach(item => {
          if (item.label.indexOf(inputValue) > -1) {
            filteredKeys.push(item.key);
          }
          if (item.children) {
            findFilteredKey(item.children);
          }
        });
      };
      findFilteredKey(treeData);
      const expanded = difference(filteredKeys, [...collapsedKeys]);
      this.setState({
        expandedKeys: expanded,
        autoExpandParent: true,
      });
    }
  }

  add = () => {
    let itemLength = Math.floor(Math.random() * 5) + 1;
    let treeData = new Array(itemLength).fill(0).map((v, i) => {
      let length = Math.floor(Math.random() * 3) + 1;
      let children = new Array(length).fill(0).map((cv, ci) => {
        let child = {
          key: `${i}-${ci}`,
          label: `Leaf-${i}-${ci}`,
          value: `${i}-${ci}`,
        };
        return child;
      });
      let item = {
        key: `${i}`,
        label: `Item-${i}`,
        value: `${i}`,
        children,
      };
      return item;
    });
    this.setState({ treeData });
  };

  search = val => {
    this.setState({ inputValue: val });
  };

  onExpand = (keys, { expanded, node }) => {
    let collapsed = this.state.collapsedKeys;
    let desKeys = findDescendantKeys(node);
    if (!expanded) {
      desKeys.forEach(key => collapsed.add(key));
    } else {
      desKeys.forEach(key => collapsed.has(key) && collapsed.delete(key));
    }
    this.setState({
      expandedKeys: keys,
      autoExpandParent: false,
      collapsedKeys: collapsed,
    });
  };

  render() {
    const { treeData, expandedKeys, autoExpandParent } = this.state;
    return (
      <div>
        <Tree
          treeData={treeData}
          filterTreeNode
          autoExpandParent={autoExpandParent}
          expandedKeys={expandedKeys}
          onSearch={this.search}
          onExpand={this.onExpand}
        />
        <br />
        <Button onClick={this.add} style={{ margin: 20 }}>
          动态改变数据
        </Button>
      </div>
    );
  }
}

export const DynamicTreeDataWithSearchValueAndControlledExpand = () => (
  <DyTreeWithExpandControlled />
);

DynamicTreeDataWithSearchValueAndControlledExpand.story = {
  name: 'dynamic treeData with searchValue and controlled expand',
};

const CusSearchRender = () => {
  const [inputValue, setInputValue] = useState('');
  const ref = useRef();

  const setValue = value => {
    setInputValue(value);
    ref.current.search(value);
  };

  return (
    <Tree
      ref={ref}
      treeData={treeData1}
      filterTreeNode
      showFilteredOnly
      searchRender={({ prefix, placeholder }) => (
        <Input
          prefix={prefix}
          placeholder={placeholder}
          value={inputValue}
          onChange={value => setValue(value)}
        />
      )}
    />
  );
};

export const _CusSearchRender = () => (
  <>
    <CusSearchRender />
  </>
);

_CusSearchRender.story = {
  name: 'CusSearchRender',
};

const RefSearch = () => {
  const ref = useRef();
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
            },
            {
              label: 'Shanghai',
              value: 'Shanghai',
              key: '0-0-1',
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
  return (
    <div>
      <Input aria-label='filter tree' onChange={v => ref.current.search(v)} />
      <Tree
        treeData={treeData}
        defaultValue="Shanghai"
        blockNode={false}
        ref={ref}
        filterTreeNode
        searchRender={() => null}
      />
    </div>
  );
};

export const _RefSearch = () => (
  <>
    <RefSearch />
  </>
);

_RefSearch.story = {
  name: 'RefSearch',
};

const initTreeDate = [
  {
    label: 'Expand to load',
    key: '0',
  },
  {
    label: 'Expand to load',
    key: '1',
  },
  {
    label: 'Tree Node',
    key: '2',
    isLeaf: true,
  },
];

function updateTreeData(list, key, children) {
  return list.map(node => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateTreeData(node.children, key, children) };
    }

    return node;
  });
}

const LoadingTreeDemo = () => {
  const [treeData, setTreeData] = useState(initTreeDate);

  function onLoadData({ key, children }) {
    return new Promise(resolve => {
      if (children) {
        resolve();
        return;
      }

      setTimeout(() => {
        setTreeData(origin =>
          updateTreeData(origin, key, [
            {
              label: 'Child Node',
              key: `${key}-0`,
            },
            {
              label: 'Child Node',
              key: `${key}-1`,
            },
          ])
        );
        resolve();
      }, 1000);
    });
  }

  return <Tree loadData={onLoadData} treeData={copy(treeData)} />;
};

export const Loading = () => (
  <>
    <LoadingTreeDemo />
  </>
);

Loading.story = {
  name: 'loading',
};

const LoadingWithSearch = () => {
  const [treeData, setTreeData] = useState(initTreeDate);

  function onLoadData({ key, children }) {
    return new Promise(resolve => {
      if (children) {
        resolve();
        return;
      }

      setTimeout(() => {
        setTreeData(origin =>
          updateTreeData(origin, key, [
            {
              label: 'Child Node',
              key: `${key}-0`,
            },
            {
              label: 'Child Node',
              key: `${key}-1`,
            },
          ])
        );
        resolve();
      }, 1000);
    });
  }

  return <Tree loadData={onLoadData} treeData={copy(treeData)} filterTreeNode />;
};

export const _LoadingWithSearch = () => (
  <>
    <LoadingWithSearch />
  </>
);

_LoadingWithSearch.story = {
  name: 'Loading with search',
};

const DisabledStrictly = () => {
  return (
    <>
      <span> disable shanghai(checked), China </span>
      <Tree
        treeData={[
          {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            children: [
              {
                label: 'China',
                value: 'China',
                key: '0-0',
                disabled: true,
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
                    disabled: true,
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
        ]}
        defaultValue="Shanghai"
        multiple
        defaultExpandAll
        disableStrictly
      />
      <br />
      <span> disable shanghai(checked), beijing(checked) </span>
      <Tree
        treeData={[
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
                    disabled: true,
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
        ]}
        defaultValue={['Shanghai', 'Beijing']}
        multiple
        defaultExpandAll
        disableStrictly
      />
      <span> disable shanghai(checked) </span>
      <Tree
        treeData={[
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
                    disabled: true,
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
        ]}
        defaultValue={['Shanghai']}
        multiple
        defaultExpandAll
        disableStrictly
      />
      <br />
      <span> disable shanghai </span>
      <Tree
        treeData={[
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
                    label: 'Chengdu',
                    value: 'Chengdu',
                    key: '0-0-2',
                  },
                  {
                    label: 'Shanghai',
                    value: 'Shanghai',
                    key: '0-0-1',
                    disabled: true,
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
        ]}
        multiple
        defaultExpandAll
        disableStrictly
      />
      <span> disable China(checked) - Shanghai </span>
      <Tree
        treeData={[
          {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            children: [
              {
                label: 'China',
                value: 'China',
                key: '0-0',
                disabled: true,
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
                    disabled: true,
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
        ]}
        defaultValue="China"
        multiple
        defaultExpandAll
        disableStrictly
      />
      <span> disable China </span>
      <Tree
        treeData={[
          {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            children: [
              {
                label: 'China',
                value: 'China',
                key: '0-0',
                disabled: true,
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
        ]}
        multiple
        defaultExpandAll
        disableStrictly
      />
    </>
  );
};

export const DisableStrictly = () => <DisabledStrictly />;

DisableStrictly.story = {
  name: 'disableStrictly',
};

const ActionTree = () => {
  let initData = [
    {
      label: 'Asia',
      value: 'Asia',
      key: 'asia',
      children: [
        {
          label: 0,
          value: `${0}`,
          key: `${0}`,
        },
        {
          label: 1,
          value: `${1}`,
          key: `${1}`,
        },
        {
          label: 2,
          value: `${2}`,
          key: `${2}`,
        },
        {
          label: 3,
          value: `${3}`,
          key: `${3}`,
        },
        {
          label: 4,
          value: `${4}`,
          key: `${4}`,
        },
      ],
    },
  ];

  const [data, setData] = useState(initData);

  const remove = key => {
    let ind = data[0].children.findIndex(item => item.key === key);
    if (ind >= 0) {
      let items = copy(data);
      items[0].children.splice(ind, 1);
      setData(items);
    }
  };

  return (
    <Tree
      treeData={copy(data)}
      renderLabel={(label, data) => (
        <div>
          {label}
          <Button onClick={() => remove(data.key)}>remove</Button>
        </div>
      )}
    />
  );
};

export const DeleteOrAddChildNode = () => <ActionTree />;

DeleteOrAddChildNode.story = {
  name: 'Delete or Add Child Node',
};

const MutipleHLTree = () => {
  const [selected, setSelected] = useState(new Set());
  const [selectedThroughParent, setSelectedThroughParent] = useState(new Set());

  const findDescendantKeys = node => {
    let res = [node.key];
    const findChild = item => {
      if (!item) return;
      const { children } = item;

      if (children && children.length) {
        children.forEach(child => {
          res.push(child.key);
          findChild(child);
        });
      }
    };
    findChild(node);
    return res;
  };

  const handleSelect = (key, bool, node) => {
    setSelected(new Set([key]));
    const descendantKeys = findDescendantKeys(node);
    setSelectedThroughParent(new Set(descendantKeys));
  };

  const renderLabel = ({ className, data, onClick, expandIcon }) => {
    const { label, icon, key } = data;
    const isLeaf = !(data.children && data.children.length);
    const style = {
      backgroundColor: selected.has(key)
        ? 'rgba(var(--semi-blue-0), 1)'
        : selectedThroughParent.has(key)
          ? 'rgba(var(--semi-blue-0), .5)'
          : 'transparent',
    };
    return (
      <li className={className} role="treeitem" onClick={onClick} style={style}>
        {isLeaf ? null : expandIcon}
        {icon ? icon : null}
        <span>{label}</span>
      </li>
    );
  };

  const treeStyle = {
    width: 260,
    height: 420,
    border: '1px solid var(--semi-color-border)',
  };
  return (
    <Tree
      treeData={treeData1}
      renderFullLabel={renderLabel}
      onSelect={handleSelect}
      style={treeStyle}
    />
  );
};

export const RenderOuterLable = () => <MutipleHLTree />;

RenderOuterLable.story = {
  name: 'renderOuterLable',
};

export const TreeWithoutValueProps = () => (
  <Tree
    treeData={treeDataWithoutValue}
    value="meiguo"
    defaultExpandAll
    onChange={(...args) => console.log(args)}
  />
);

TreeWithoutValueProps.story = {
  name: 'tree without value props',
};

const DnDTree = () => {
  const initialData = [
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
    {
      label: 'Europe',
      value: 'Europe',
      key: '2',
    },
  ];

  const [treeData, setTreeData] = useState(initialData);
  const [showLine, setShowLine] = useState(false);

  // const [expandedKeys, setExpandedKeys] = useState(['zhongguo']);

  function onDragEnter(info) {
    console.log(info);
    // if in controlled expandedKeys mode
    // setExpandedKeys(info.expandedKeys)
  }

  function onDrop(info) {
    const { dropToGap, node, dragNode } = info;
    const dropKey = node.key;
    const dragKey = dragNode.key;
    const dropPos = node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
    const data = [...treeData];
    const loop = (data, key, callback) => {
      data.forEach((item, ind, arr) => {
        if (item.key === key) return callback(item, ind, arr);
        if (item.children) return loop(item.children, key, callback);
      });
    };

    let dragObj;
    loop(data, dragKey, (item, ind, arr) => {
      arr.splice(ind, 1);
      dragObj = item;
    });

    if (!dropToGap) {
      // inset into the dropPosition
      loop(data, dropKey, (item, ind, arr) => {
        item.children = item.children || [];
        item.children.push(dragObj);
      });
    } else if (dropPosition === 1 && node.children && node.expanded) {
      // has children && expanded and drop into the node bottom gap
      // insert to the top 这里我们添加在头部，可以是任意位置
      loop(data, dropKey, item => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else {
      let dropNodeInd;
      let dropNodePosArr;
      loop(data, dropKey, (item, ind, arr) => {
        dropNodePosArr = arr;
        dropNodeInd = ind;
      });
      if (dropPosition === -1) {
        // insert to top
        dropNodePosArr.splice(dropNodeInd, 0, dragObj);
      } else {
        // insert to bottom
        dropNodePosArr.splice(dropNodeInd + 1, 0, dragObj);
      }
    }
    setTreeData(data);
  }

  const onSwitchChange = useCallback((value) => {
    setShowLine(value);
  }, []);

  return (
    <>
      <Switch onChange={onSwitchChange}/>
      <Tree
        treeData={treeData}
        draggable
        showLine={showLine}
        //expandedKeys={expandedKeys}
        onDragEnter={onDragEnter}
        onDrop={onDrop}
      />
    </>
    
  );
};

export const DraggableTree = () => <DnDTree />;

DraggableTree.story = {
  name: 'draggable Tree',
};

const TestTree = () => {
  return (
    <Tree
      treeData={testData}
      // motion={false}
      style={{ height: '100%' }}
      filterTreeNode
      expandAction="click"
      showFilteredOnly
    />
  );
};

export const Draggable = () => <TestTree />;

Draggable.story = {
  name: 'draggable',
};

export const RenderFullLabelWithDraggable = () => {
  const [selected, setSelected] = useState(new Set());
  const [selectedThroughParent, setSelectedThroughParent] = useState(new Set());
  const defaultTreeData = [
    {
      label: '黑色固定按钮',
      key: 'fix-btn-0',
    },
    {
      label: '模块',
      key: 'module-0',
      children: [
        {
          label: '可自由摆放的组件',
          key: 'free-compo-0',
        },
        {
          label: '分栏容器',
          key: 'split-col-0',
          children: [
            {
              label: '按钮组件',
              key: 'btn-0',
            },
            {
              label: '按钮组件',
              key: 'btn-1',
            },
          ],
        },
      ],
    },
    {
      label: '模块',
      key: 'module-1',
      children: [
        {
          label: '自定义组件',
          key: 'cus-0',
        },
      ],
    },
  ];
  const [treeData, setTreeData] = useState(defaultTreeData);

  const onDrop = info => {
    const { dropToGap, node, dragNode } = info;
    const dropKey = node.key;
    const dragKey = dragNode.key;
    const dropPos = node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    const data = [...treeData];
    const loop = (data, key, callback) => {
      data.forEach((item, ind, arr) => {
        if (item.key === key) return callback(item, ind, arr);
        if (item.children) return loop(item.children, key, callback);
      });
    };

    let dragObj;
    loop(data, dragKey, (item, ind, arr) => {
      arr.splice(ind, 1);
      dragObj = item;
    });

    if (!dropToGap) {
      loop(data, dropKey, (item, ind, arr) => {
        item.children = item.children || [];
        item.children.push(dragObj);
      });
    } else if (dropPosition === 1 && node.children && node.expanded) {
      loop(data, dropKey, item => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else {
      let dropNodeInd;
      let dropNodePosArr;
      loop(data, dropKey, (item, ind, arr) => {
        dropNodePosArr = arr;
        dropNodeInd = ind;
      });
      if (dropPosition === -1) {
        dropNodePosArr.splice(dropNodeInd, 0, dragObj);
      } else {
        dropNodePosArr.splice(dropNodeInd + 1, 0, dragObj);
      }
    }
    setTreeData(data);
  };

  const findDescendantKeys = node => {
    let res = [node.key];
    const findChild = item => {
      if (!item) return;
      const { children } = item;

      if (children && children.length) {
        children.forEach(child => {
          res.push(child.key);
          findChild(child);
        });
      }
    };
    findChild(node);
    return res;
  };

  const handleSelect = (key, bool, node) => {
    setSelected(new Set([key]));
    const descendantKeys = findDescendantKeys(node);
    setSelectedThroughParent(new Set(descendantKeys));
  };

  const renderLabel = ({ className, data, onClick, expandIcon }) => {
    const { label, icon, key } = data;
    const isLeaf = !(data.children && data.children.length);
    const style = {
      backgroundColor: selected.has(key)
        ? 'rgba(var(--semi-blue-0), 1)'
        : selectedThroughParent.has(key)
          ? 'rgba(var(--semi-blue-0), .5)'
          : 'transparent',
    };
    return (
      <li className={className} role="treeitem" onClick={onClick} style={style}>
        {isLeaf ? <span style={{ width: 24 }}></span> : expandIcon}
        {icon ? icon : null}
        <span>{label}</span>
      </li>
    );
  };

  const treeStyle = {
    height: 420,
    border: '1px solid var(--semi-color-border)',
  };

  return (
    <Tree
      treeData={treeData}
      draggable
      onDrop={onDrop}
      renderFullLabel={renderLabel}
      onSelect={handleSelect}
      style={treeStyle}
      defaultExpandAll
    />
  );
};

RenderFullLabelWithDraggable.story = {
  name: 'renderFullLabel with draggable',
};

export const CheckRelationDemo = () => {
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
    {
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
  ];
  const [value, setValue] = useState('China');
  const [value2, setValue2] = useState();
  const [value3, setValue3] = useState();
  const style = {
    width: 260,
    height: 420,
    border: '1px solid var(--semi-color-border)'
  };
  const handleChange = value => {
    console.log(value);
    setValue(value);
  };
  const handleChange2 = value => {
    console.log(value);
    setValue2(value);
  };
  const handleChange3 = value => {
    console.log(value);
    setValue3(value);
  };
  return (
    <>
      <div>checkRelation='unRelated'</div>
      <Tree
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 中国节点为 disabled</div>
      <Tree
        treeData={treeData1}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 中国节点为 disabled + 严格禁用</div>
      <Tree
        treeData={treeData1}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        disableStrictly
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + defaultValue 为 China</div>
      <Tree
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        defaultValue='China'
      />
      <br /><br />
      <div>checkRelation='unRelated' + 受控 + value 初始为 China</div>
      <Tree
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        value={value}
        onChange={handleChange}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 受控 + onChangeWithObject</div>
      <Tree
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        value={value2}
        onChangeWithObject
        onChange={handleChange2}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 受控 + leafOnly，此时 leafOnly 失效</div>
      <Tree
        leafOnly
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        value={value3}
        onChange={handleChange3}
      />
      <br /><br />
      <div>checkRelation='unRelated' + onSelect </div>
      <Tree
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        onSelect={(value, status, node) => console.log('select', value, status, node)}
      />
    </>
  );
};

export const ValueImpactExpansionWithDynamicTreeData = () => {
  const json = {
    "Node0": {
      "Child Node0-0": '0-0',
      "Child Node0-1": '0-1',
    },
    "Node1": {
      "Child Node1-0": '1-0',
      "Child Node1-1": '1-1',
    }
  }
  const json2 = {
    "Updated Node0": {
      "Updated Child Node0-0": {
        'Updated Child Node0-0-0': '0-0'
      },
      "Updated Child Node0-1": '0-1',
    },
    "Updated Node1": {
      "Updated Child Node1-0": '1-0',
      "Updated Child Node1-1": '1-1',
    }
  }
  const style = {
    width: 260,
    height: 420,
    border: '1px solid var(--color-border)'
  }
  const [value, setValue] = useState('0-0')
  const [tree, setTree] = useState(json);
  const handleValueButtonClick = () => {
    if (value === '0-0') {
      setValue('1-0');
    } else {
      setValue('0-0');
    }
  }
  const handleTreeDataButtonClick = () => {
    if (isEqual(tree, json)) {
      setTree(json2);
    } else {
      setTree(json);
    }
  }
  return (
    <>
      <div>value 受控时，当 treeData/treeDataSimpleJson 改变时，应该根据 value 自动展开</div>
      <Tree
        value={value}
        treeDataSimpleJson={tree}
        style={style}
        onChange={v => setValue(v)}
      />
      <Space>
        <Button onClick={handleValueButtonClick}>改变 value</Button>
        <Button onClick={handleTreeDataButtonClick}>改变 TreeData</Button>
      </Space>
    </>
  )
}

class DemoV extends React.Component {
  constructor() {
    super();
    this.state = {
      gData: [],
      total: 0,
      align: 'center',
      scrollKey: '',
      expandAll: false,
      showLine: false,
    };
    this.onGen = this.onGen.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.onInputBlur = this.onInputBlur.bind(this);
    this.onSelectChange = this.onSelectChange.bind(this);
    this.treeRef = React.createRef();
  }

  generateData(x = 5, y = 4, z = 3, gData = []) {
    // x：每一级下的节点总数。y：每级节点里有y个节点、存在子节点。z：树的level层级数（0表示一级）
    function _loop(_level, _preKey, _tns) {
      const preKey = _preKey || '0';
      const tns = _tns || gData;

      const children = [];
      for (let i = 0; i < x; i++) {
        const key = `${preKey}-${i}`;
        tns.push({ label: `${key}-标签`, key: `${key}-key`, value: `${key}-value` });
        if (i < y) {
          children.push(key);
        }
      }
      if (_level < 0) {
        return tns;
      }
      const __level = _level - 1;
      children.forEach((key, index) => {
        tns[index].children = [];
        return _loop(__level, key, tns[index].children);
      });

      return null;
    }
    _loop(z);

    function calcTotal(x, y, z) {
      const rec = n => (n >= 0 ? x * y ** n-- + rec(n) : 0);
      return rec(z + 1);
    }
    return { gData, total: calcTotal(x, y, z) };
  }

  onGen() {
    const { gData, total } = this.generateData();
    this.setState({
      gData,
      total
    });
  };

  onScroll(scrollKey, align) {
    this.treeRef?.current.scrollTo({ key: scrollKey, align });
  }

  onInputChange(value) {
    this.setState({
      scrollKey: value,
    })
  }

  onInputBlur(e) {
    const { value } = e.target;
    this.onScroll(value, this.state.align);
  }

  onSelectChange(align) {
    this.setState({
      align: align,
    })
    this.onScroll(this.state.scrollKey, align);
  }

  render() {
    const style = {
      width: 260,
      border: '1px solid var(--semi-color-border)'
    };
    return (
      <div style={{ padding: '0 20px' }}>
        <Button onClick={this.onGen}>生成数据: </Button>
        <span>共 {this.state.total} 个节点</span>
        <br />
        <br />
        <div style={{ display: 'flex', alignItems: 'center', }}>
          <span>defaultExpandAll</span>
          <Switch onChange={(value) => {
            this.setState({
              expandAll: value,
            })
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', }}>
          <span>showLine</span>
          <Switch onChange={(value) => {
            this.setState({
              showLine: value,
            })
          }} />
        </div>
        <br />
        <span>跳转的key：</span>
        <Input
          placeholder={'格式：x-x-key'}
          style={{ width: 180, marginRight: 20 }}
          onChange={this.onInputChange}
          onBlur={this.onInputBlur}
        ></Input>
        <span>scroll align：</span>
        <Select
          defaultValue='center'
          style={{ width: 180 }}
          optionList={['center', 'start', 'end', 'smart', 'auto'].map(item => ({
            value: item,
            label: item,
          }))}
          onChange={this.onSelectChange}
        >
        </Select>
        <br />
        <br />
        {this.state.gData.length ? (
          <Tree
            key={`key-${this.state.expandAll}`}
            ref={this.treeRef}
            defaultExpandAll={this.state.expandAll}
            showLine={this.state.showLine}
            treeData={this.state.gData}
            filterTreeNode
            showFilteredOnly
            style={style}
            virtualize={{
              // if set height for tree, it will fill 100%
              height: 300,
              itemSize: 28,
            }}
          />
        ) : null}
      </div>
    );
  }
}

export const issue1124 = () => {
  const [v, setV] = useState(['1']);
  const initialData = [
    {
      label: 'Expand to load',
      value: '0',
      key: '0',
    },
    {
      label: 'Expand to load',
      value: '1',
      key: '1',
    },
    {
      label: 'Leaf Node',
      value: '2',
      key: '2',
      isLeaf: true,
    },
  ];
  const [treeData, setTreeData] = useState(initialData);

  function updateTreeData(list, key, children) {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  }

  const onChange = (value) => {
    setV(value);
  }

  function onLoadData({ key, children }) {
    return new Promise(resolve => {
      if (children) {
        resolve();
        return;
      }
      setTimeout(() => {
        setTreeData(origin =>
          updateTreeData(origin, key, [
            {
              label: `Child Node${key}-0`,
              key: `${key}-0`,
              value: `${key}-0`,
            },
            {
              label: `Child Node${key}-1`,
              key: `${key}-1`,
              value: `${key}-1`,
            },
          ]),
        );
        resolve();
      }, 1000);
    });
  }
  return (
    <Tree
      onChange={onChange}
      loadData={onLoadData}
      treeData={[...treeData]}
      value={v}
      multiple
    />
  );
}

export const virtualizeTree = () => <DemoV />;

virtualizeTree.story = {
  name: 'virtualize tree',
};

export const SearchableAndExpandedKeys = () => {
  const [expandedKeys1, setExpandedKeys1] = useState([]);
  const [expandedKeys2, setExpandedKeys2] = useState([]);
  const [expandedKeys3, setExpandedKeys3] = useState([]);
  const [expandedKeys4, setExpandedKeys4] = useState([]);
  return (
    <>
      <Title heading={6}>expandedKeys 受控</Title>
      <Tree
        style={{ width: 300, marginBottom: 30 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        expandedKeys={expandedKeys1}
        defaultValue='beijing'
        onExpand={v => {
          console.log('onExpand value: ', v);
          setExpandedKeys1(v);
        }}
      />
      <Title heading={6}>expandedKeys 受控 + 开启搜索</Title>
      <Tree
        style={{ width: 300, marginBottom: 30 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        filterTreeNode
        defaultValue='beijing'
        expandedKeys={expandedKeys2}
        onExpand={v => {
          console.log('onExpand value: ', v);
          setExpandedKeys2(v);
        }}
      />
      <Title heading={6}>expandedKeys 受控 + 开启搜索 + 搜索时更新 expandedKeys</Title>
      <Tree
        style={{ width: 300, marginBottom: 30 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        filterTreeNode
        expandedKeys={expandedKeys3}
        defaultValue='beijing'
        onExpand={v => {
          console.log('onExpand value: ', v);
          setExpandedKeys3(v)
        }}
        onSearch={(input, filterExpandedKeys) => {
          console.log('onExpand filterExpandedKeys: ', filterExpandedKeys);
          setExpandedKeys3(filterExpandedKeys);
        }}
      />
      <Title heading={6}>expandedKeys 受控 + 开启搜索 + showFilteredOnly + 搜索时更新 expandedKeys</Title>
      <Tree
        style={{ width: 300, marginBottom: 30 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData1}
        filterTreeNode
        showFilteredOnly
        expandedKeys={expandedKeys4}
        defaultValue='beijing'
        onExpand={v => {
          console.log('onExpand value: ', v);
          setExpandedKeys4(v)
        }}
        onSearch={(input, filterExpandedKeys) => {
          console.log('onExpand filterExpandedKeys: ', filterExpandedKeys);
          setExpandedKeys4(filterExpandedKeys);
        }}
      />
    </>
  )
}

export const UnRelatedAndAsyncLoad = () => {
  const initialData = [
    {
      label: 'Expand to load0',
      value: '0',
      key: '0',
    },
    {
      label: 'Expand to load1',
      value: '1',
      key: '1',
    },
    {
      label: 'Leaf Node',
      value: '2',
      key: '2',
      isLeaf: true,
    },
  ];
  const [treeData, setTreeData] = useState(initialData);

  function updateTreeData(list, key, children) {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  }

  function onLoadData({ key, children }) {
    return new Promise(resolve => {
      if (children) {
        resolve();
        return;
      }
      setTimeout(() => {
        setTreeData(origin =>
          updateTreeData(origin, key, [
            {
              label: `Child Node${key}-0`,
              key: `${key}-0`,
            },
            {
              label: `Child Node${key}-1`,
              key: `${key}-1`,
            },
          ]),
        );
        resolve();
      }, 1000);
    });
  }
  return (
    <>
      <span>issue 1852: checkRelation='unRelated', 异步加载数据</span>
      <Tree
        checkRelation='unRelated'
        defaultValue={['0']}
        multiple
        loadData={onLoadData}
        treeData={[...treeData]}
      />
    </>
  );
};

const constructLargeData = () => {
  const newArray = (new Array(10)).fill(0).map((item, m) => {
    const parent = {
      key: `key-${m}`,
      label: `node-${m}`,
      children: []
    }
    new Array(100).fill(0).map((item, n) => {
      const children = {
        key: `key-${m}-${n}`,
        label: `value-${m}-${n}`,
        children: []
      }
      new Array(10).fill(0).map((item, o) => {
        const grandChildren = {
          key: `key-${m}-${n}-${o}`,
          label: `value-${m}-${n}-${o}`,
        }
        children.children.push(grandChildren);
      });
      parent.children.push(children);
    });
    return parent;
  });
  return newArray;
}

export const ChangeTreeData = () => {
  const [sign, setSign] = useState(true);

  const treeData1 = useMemo(() => {
    return constructLargeData();
  }, []);

  const treeData2 = useMemo(() => {
    return constructLargeData();
  }, []);

  const onButtonClick = useCallback(() => {
    setSign((sign) => {
      return !sign;
    })
  }, []);

  return <>
    <Button onClick={onButtonClick}>点击修改TreeData</Button>
    <br /><br />
    <Tree
      treeData={sign ? treeData1 : treeData2}
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      placeholder="请选择"
    />
  </>
}

export const KeyMaps = () => {
  const [withObject, setWithObject] = useState(false);
  const [value1, setValue1] = useState(undefined);
  const [value2, setValue2] = useState([]);
  const [expandKeys, setExpandedKeys] = useState(undefined);

  const onSingleChange = useCallback((value) => {
    console.log('onSingleChange', value);
    setValue1(value);
  }, []);

  const onMultipleChange = useCallback((value) => {
    console.log('onMultipleChange', value);
    setValue2(value);
  }, []);

  const normalChange = useCallback((value) => {
    console.log('onChange', value);
  }, []);

  const normalExpanded = useCallback((expandedKeys, { expanded, node }) => {
    console.log('onExpanded', expandedKeys, expanded, copy(node));

  }, []);

  const normalSearch = useCallback((input, filteredExpandedKeys) => {
    console.log('onSearch', input, filteredExpandedKeys);
  }, []);

  const keyMaps = useMemo(() => {
    return {
      value: 'value1',
      key: 'key1',
      label: 'label1',
      children: 'children1',
      disabled: 'disabled1'
    };
  }, []);

  const switchChange = useCallback((checked) => {
    setWithObject(checked);
    setValue1(undefined);
    setValue2(undefined);
  }, []);

  const regularTreeProps = useMemo(() => ({
    keyMaps: keyMaps,
    treeData: specialTreeData,
    style: { width: 300 },
    onChange: normalChange,
    onExpand: normalExpanded,
    onChangeWithObject: withObject,
  }), [withObject]);

  const defaultSelectedObj = {
    label1: '北京',
    value1: 'Beijing',
    key1: 'beijing',
  };

  return (
    <>
      <span>onChangeWithObject</span><Switch checked={withObject} onChange={switchChange} />
      <div key={String(withObject)} style={{ marginTop: 10 }}>
        <span>Single select</span>
        <Tree
          {...regularTreeProps}
          defaultValue={withObject ? [defaultSelectedObj] : 'Beijing'}
        />
        <span>Single select, onSearch, filterTreeNode</span>
        <Tree
          {...regularTreeProps}
          filterTreeNode
          onSearch={normalSearch}
        />
        <span>Single select, controlled</span>
        <Tree
          {...regularTreeProps}
          value={value1}
          onChange={onSingleChange}
        />
        <span>Multiple select</span>
        <Tree
          {...regularTreeProps}
          multiple
          defaultValue={withObject ? [defaultSelectedObj] : ['Beijing']}
        />
        <span>Multiple select, controlled, disableStrictly</span>
        <Tree
          {...regularTreeProps}
          multiple
          value={value2}
          disableStrictly
          onChange={onMultipleChange}
        />
        <span>Multiple, 展开受控</span>
        <Tree
          {...regularTreeProps}
          multiple
          expandedKeys={expandKeys}
          onExpand={(expandedKeys, { expanded, node }) => {
            setExpandedKeys(expandedKeys);
          }}
        />
      </div>
    </>
  );
}


export const ShowLine = () => {
  const [showLine,setShowLine] = useState(true);
  return (
    <div>
    <h2>showLine
      <Switch checked={showLine} onChange={(checked)=>{setShowLine(checked)}}/>
    </h2>
    <h2>单选</h2>
    <Tree
      showLine={showLine}
      treeData={treeDataWithoutValue}
      value="meiguo"
      defaultExpandAll
      onChange={(...args) => console.log(args)}
    />
    <h2>多选</h2>
    <Tree
      showLine={showLine}
      treeData={[
        {
          label: 'Asia',
          value: 'Asia',
          key: '0',
          children: [
            {
              label: 'China',
              value: 'China',
              key: '0-0',
              disabled: true,
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
                  disabled: true,
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
      ]}
      defaultValue="Shanghai"
      multiple
      defaultExpandAll
      disableStrictly
    />
  </div>
  )
}

ShowLine.story = {
  name: 'show line',
};

export const CustomRenderIcon = () => {
  const iconFunc = useCallback((props) => {
    const { data } = props;
    return data.suffix ? <Tag>{data.suffix}</Tag> : null
  })

  const treeDataWithSuffix = [
    {
      label: 'package',
      key: '0',
      children: [
        {
          label: 'semi.py',
          suffix: 'Py',
          key: '1'
        },
        {
          label: 'semi.js',
          suffix: 'Js',
          key: '2'
        }
      ]
    }, 
  ]

  return (<Tree
      defaultExpandAll
      treeData={treeDataWithSuffix}
      icon={iconFunc}
  />);
}

export const AutoMerge = () => {
  const [value, setValue] = useState([]);

  const onChange = useCallback((val) => {
    console.log('onChange', val);
    setValue(val);
  }, []);

  return (
    <>
      <Tree
        autoMergeValue={false}
        style={{ width: 300}}
        multiple
        value={value}
        onChange={onChange}
        treeData={treeData1}
      />
    </>
  )
}

export const CustomExpandIcon = () => {
  const expandIconFunc = useCallback((props) => {
    const { expanded, onClick, className } = props;
    if (expanded) {
      return <IconMinus size="small" className={className} onClick={onClick}/>
    } else {
      return <IconPlus size="small" className={className} onClick={onClick}/>
    }
  });

  return (
    <>
      <p>expandIcon 是 ReactNode</p>
      <Tree
        style={{ width: 300}}
        expandIcon={<IconChevronDown size="small" className='testCls'/>}
        multiple
        defaultExpandedKeys={['yazhou']}
        treeData={treeData1}
      />
      <br />
      <br />
      <p>expandIcon 是函数</p>
      <Tree
        style={{ width: 300}}
        multiple
        expandIcon={expandIconFunc}
        defaultExpandedKeys={['yazhou']}
        treeData={treeData1}
      />
    </>
  );
}