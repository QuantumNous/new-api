import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Icon, Input, Button, Form, Popover, Tag, Typography, CheckboxGroup, TagInput, Switch } from '../../index';
import TreeSelect from '../index';
import { flattenDeep, without } from 'lodash';
import CustomTrigger from './CustomTrigger';
import { IconCreditCard, IconChevronDown, IconClose, IconPlus, IconMinus } from '@douyinfe/semi-icons';
import copy from 'fast-copy';

const TreeNode = TreeSelect.TreeNode;
const { Title } = Typography;

export default {
  title: 'TreeSelect',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

const treeData1 = [
  {
    label: 'Node1',
    value: '0-0',
    key: '0-0',
    children: [
      {
        label: 'Child Node1',
        value: '0-0-1',
        key: '0-0-1',
      },
      {
        label: 'Child Node2',
        value: '0-0-2',
        key: '0-0-2',
      },
    ],
  },
  {
    label: 'Node2',
    value: '0-1',
    key: '0-1',
  },
];

const treeData2 = [
  {
    label: '亚洲',
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
      // {
      //     label: '日本',
      //     value: 'riben',
      //     key: 'riben',
      //     children: [
      //         {
      //             label: '东京',
      //             value: 'dongjing',
      //             key: 'dongjing'
      //         },
      //         {
      //             label: '大阪',
      //             value: 'daban',
      //             key: 'daban'
      //         }
      //     ]
      // },
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

const treeData3 = [
  {
    label: 'Node1',
    value: '0-0',
    key: '0-0',
    children: [
      {
        label: 'Child Node1',
        value: '0-0-1',
        key: '0-0-1',
      },
      {
        label: 'Child Node2',
        value: '0-0-2',
        key: '0-0-2',
      },
      {
        label: 'Child Node3',
        value: '0-0-3',
        key: '0-0-3',
      },
      {
        label: 'Child Node4',
        value: '0-0-4',
        key: '0-0-4',
      },
      {
        label: 'Child Node5',
        value: '0-0-5',
        key: '0-0-5',
      },
      {
        label: 'Child Node6',
        value: '0-0-6',
        key: '0-0-6',
      },
      {
        label: 'Child Node7',
        value: '0-0-7',
        key: '0-0-7',
      },
      {
        label: 'Child Node8',
        value: '0-0-8',
        key: '0-0-8',
      },
      {
        label: 'Child Node9',
        value: '0-0-9',
        key: '0-0-9',
      },
      {
        label: 'Child Node10',
        value: '0-0-10',
        key: '0-0-10',
      },
    ],
  },
  {
    label: 'Node2',
    value: '0-1',
    key: '0-1',
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
        children: [
          {
            label: '北京',
            key: 'beijing',
          },
          {
            label: '上海',
            key: 'shanghai',
          },
        ],
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

const specialTreeData = [
  {
    label1: '亚洲',
    // value1: 'Yazhou',
    key1: 'yazhou',
    children1: [
      {
        label1: '中国',
        // value1: 'Zhongguo',
        key1: 'zhongguo',
        disabled1: true,
        children1: [
          {
            label1: '北京',
            // value1: 'Beijing',
            key1: 'beijing',
          },
          {
            label1: '上海',
            // value1: 'Shanghai',
            key1: 'shanghai',
          },
        ],
      },
      {
        label1: '日本',
        // value1: 'Riben',
        key1: 'riben',
        children1: [
          {
            label1: '东京',
            // value1: 'Dongjing',
            key1: 'dongjing',
          },
          {
            label1: '大阪',
            // value1: 'Daban',
            key1: 'daban',
          },
        ],
      },
    ],
  },
  {
    label1: '北美洲',
    // value1: 'Beimeizhou',
    key1: 'beimeizhou',
    children1: [
      {
        label1: '美国',
        // value1: 'Meiguo',
        key1: 'meiguo',
      },
      {
        label1: '加拿大',
        // value1: 'Jianada',
        key1: 'jianada',
      },
    ],
  },
];

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

export const TreeSelectWrapper = () => (
  <div>
    <div>github issue 750 修改测试用例</div>
    <CheckboxGroup>
      <TreeSelect
        showClear={true}
        expandAll
        style={{width: 400}}
        treeData={[
            {
                key: '1',
                label: '所有节点',
                value: '1',
                children: [
                    { key: '20006251', label: 'Semi', value: 'semi@bytedance.com' },
                    { key: '20006248', label: 'Design', value: 'design@bytedance.com' },
                    {
                        key: '20006205',
                        label: 'React',
                        value: 'react@bytedance.com',
                    },
                ],
            },
            ]}
        multiple
        filterTreeNode
        showFilteredOnly={true}
        leafOnly
      />
  </CheckboxGroup>
  </div>
);

TreeSelectWrapper.story = {
  name: 'treeSelect wrapper',
};

class SimpleTree extends React.Component {
  render() {
    return (
      <div>
        <TreeSelect
          style={{ width: 300 }}
          // value={this.state.value}
          dropdownStyle={{ maxHeight: 200, overflow: 'auto' }}
          treeData={treeData1}
          placeholder="Please select"
          onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
          onSelect={(e, bool) => console.log('select', e, bool)}
          onChange={(e, node) => console.log('change', e, node)}
        />
        <br />
        <br />
        <TreeSelect
          style={{ width: 300 }}
          // value={this.state.value}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData2}
          placeholder="Please select"
        />
      </div>
    );
  }
}

export const _TreeSelect = () => {
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
  return (
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      placeholder="请选择"
    />
  );
};

_TreeSelect.story = {
  name: 'tree select',
};

export const Searchable = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      searchAutoFocus
      placeholder="searchAutoFocus"
    />
  </div>
);

Searchable.story = {
  name: 'searchable',
};

export const SearchPosition = () => (
  <div style={{ background: 'var(--semi-color-bg-0)'}}>
    <TreeSelect
      searchPosition="trigger"
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      placeholder="单选"
    />
    <br />
    <br />
    <TreeSelect
      searchPosition="trigger"
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      maxTagCount={2}
      placeholder="多选"
    />
    <br />
    <br />
    <TreeSelect
      searchPosition="trigger"
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      maxTagCount={2}
      placeholder="searchAutoFocus"
      searchAutoFocus
    />
    <br />
    <br />
    <TreeSelect
      searchPosition="trigger"
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      maxTagCount={1}
      placeholder="maxTagCount=1"
    />
  </div>
);

SearchPosition.story = {
  name: 'searchPosition',
};

export const PrefixSuffixInsetLabel = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      prefix={<IconCreditCard />}
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      prefix={'1234'}
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      suffix="RMB"
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      insetLabel="blablabla"
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      insetLabel={<span>1234</span>}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      placeholder="Please select"
    />
  </div>
);

PrefixSuffixInsetLabel.story = {
  name: 'prefix suffix insetLabel',
};
PrefixSuffixInsetLabel.parameters = {
  chromatic: { disableSnapshot: false },
}

export const ValidateStatus = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      validateStatus="warning"
      placeholder="Please select"
      onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
      onSelect={(e, bool) => console.log('select', e, bool)}
      onChange={e => console.log('change', e)}
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      validateStatus="error"
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      // multiple
      placeholder="Please select"
    />
  </div>
);

ValidateStatus.story = {
  name: 'validate status',
};
ValidateStatus.parameters = {
  chromatic: { disableSnapshot: false },
}

export const Multiple = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      placeholder="Please select"
      onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
      onSelect={(e, bool) => console.log('select', e, bool)}
      onChange={e => console.log('change', e)}
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      defaultOpen
      defaultExpandAll
      motion={false}
      multiple
      placeholder="Please select"
    />
    <span id={'invisible-span'} style={{ width: 10, height: 10, position: 'fixed', top: 0, right: 0 }} />
  </div>
);

Multiple.story = {
  name: 'multiple',
};

export const MaxTagCount = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      maxTagCount={2}
      placeholder="Please select"
    />
    {/* <br />
        <br />
        <TreeSelect
            style={{ width: 300 }}
            // value={this.state.value}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData2}
            multiple
            placeholder="Please select"
        /> */}
  </div>
);

MaxTagCount.story = {
  name: 'maxTagCount',
};

export const MultipleSearchable = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
  </div>
);

MultipleSearchable.story = {
  name: 'multiple searchable',
};

export const DefaultValues = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={'shanghai'}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      // multiple
      filterTreeNode
      treeNodeFilterProp="value"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={'shanghai'}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      multiple
      treeNodeFilterProp="value"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={['shanghai', 'daban', 'dongjing']}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      multiple
      treeNodeFilterProp="value"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={['meiguo', 'dongjing']}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      multiple
      treeNodeFilterProp="value"
    />
  </div>
);

DefaultValues.story = {
  name: 'default values',
};

export const Disabled = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={'shanghai'}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      disabled
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      defaultValue={'shanghai'}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      filterTreeNode
      disabled
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
    <br />
    <br />
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      disabled
      treeNodeFilterProp="value"
      placeholder="Please select"
    />
  </div>
);

Disabled.story = {
  name: 'disabled',
};
Disabled.parameters = {
  chromatic: { disableSnapshot: false },
}

export const OptionLabelProp = () => (
  <>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      treeNodeFilterProp="value"
      treeNodeLabelProp="value"
      placeholder="Please select"
    />
  </>
);

OptionLabelProp.story = {
  name: 'optionLabelProp',
};

export const ValueInArray = () => (
  <>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      filterTreeNode
      valueInArray
      onChange={(...args) => console.log(args)}
      treeNodeFilterProp="value"
      treeNodeLabelProp="value"
      placeholder="Please select"
    />
  </>
);

ValueInArray.story = {
  name: 'valueInArray',
};

export const OnBlurOnFocus = () => (
  <>
    <div>single</div>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
    <div>multiple</div>
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
     <div>single, filterTreeNode, searchPosition=dropdown</div>
    <TreeSelect
      filterTreeNode
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
    <div>multiple, filterTreeNode, searchPosition=dropdown</div>
    <TreeSelect
      filterTreeNode
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
    <div>single, filterTreeNode, searchPosition=trigger</div>
    <TreeSelect
      searchPosition="trigger"
      filterTreeNode
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
    <div>multiple, filterTreeNode, searchPosition=trigger</div>
    <TreeSelect
      searchPosition="trigger"
      filterTreeNode
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      onBlur={(...args) => console.log('blur', args)}
      onFocus={(...args) => console.log('focus', args)}
      placeholder="Please select"
    />
  </>
);

OnBlurOnFocus.story = {
  name: 'onBlur/onFocus',
};

export const LeafOnly = () => (
  <div>
    <TreeSelect
      style={{ width: 300 }}
      // value={this.state.value}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData2}
      multiple
      leafOnly
      placeholder="Please select"
      onExpand={(e, { expanded, node }) => console.log('expand', e, expanded, node)}
      onSelect={(e, bool) => console.log('select', e, bool)}
      onChange={e => console.log('change', e)}
    />
  </div>
);

LeafOnly.story = {
  name: 'leafOnly',
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
      <TreeSelect
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData2}
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
      value: ['Shanghai'],
    };
  }
  onChange(value) {
    this.setState({ value });
  }
  render() {
    console.log(this.state.value);
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
    return (
      <TreeSelect
        style={{ width: 300 }}
        multiple
        dropdownStyle={{ maxHeight: 200, overflow: 'auto' }}
        treeData={treeData}
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

class Demo3 extends React.Component {
  constructor() {
    super();
    this.state = {
      value: ['Shanghai'],
    };
  }
  // 获取最底层值
  getDeepChildrensByNode = node => {
    return flattenDeep(
      node.map(item => {
        if (item.children) {
          return this.getDeepChildrensByNode(item.children);
        }
        return item.value;
      })
    );
  };

  onChange(value, node) {
    console.log('onchange', value);
    value = this.getDeepChildrensByNode(node);
    console.log('modifiled', value);
    this.setState({ value });
  }

  render() {
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
    return (
      <TreeSelect
        style={{ width: 300 }}
        multiple
        dropdownStyle={{ maxHeight: 200, overflow: 'auto' }}
        treeData={treeData}
        value={this.state.value}
        placeholder="Please select"
        onChange={(e, node) => this.onChange(e, node)}
      />
    );
  }
}

export const ControlledComponentMultipleValueModified = () => <Demo3 />;

ControlledComponentMultipleValueModified.story = {
  name: 'controlled Component multiple value modified',
};

class ConvertDemo extends React.Component {
  constructor(props) {
    super(props);
    this.formApi = null;
  }
  handleChange = val => {
    let finalVal = val;
    let firstClassOption = ['Asia', 'North America'];
    // 在这里去做你的value替换逻辑
    console.log('originVal:' + val);
    if (val.length === 1) {
      // do nothing
    } else {
      if (val.every(item => firstClassOption.includes(item))) {
        finalVal = val[val.length - 1];
      }
    }
    console.log('finalVal:' + finalVal);
    return finalVal;
  };
  render() {
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
    return (
      <Form getFormApi={this.getFormApi}>
        <Form.TreeSelect
          field="tree"
          label="节点（TreeSelect）"
          placeholder="请选择服务节点"
          treeData={treeData}
          convert={this.handleChange}
          filterTreeNode
          multiple
        ></Form.TreeSelect>
      </Form>
    );
  }
}

export const _ConvertDemo = () => <ConvertDemo />;

_ConvertDemo.story = {
  name: 'convert demo',
};

export const TreeselectDefaultOpenInPopover = () => (
  <Popover
    content={
      <TreeSelect
        style={{ width: 200 }}
        dropdownStyle={{ width: 200 }}
        treeData={treeData1}
        defaultOpen
        // value={this.state.value}
        // placeholder="Please select"
        // onChange={(e, node) => this.onChange(e, node)}
      />
    }
  >
    <Button style={{ marginLeft: 150 }}>悬停此处</Button>
  </Popover>
);

TreeselectDefaultOpenInPopover.story = {
  name: 'treeselect defaultOpen in popover',
};

export const CustomTriggerDemo = () => <CustomTrigger />;
CustomTriggerDemo.story = { name: 'custom trigger' };

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
          setSelectedKeys(['beijing']);
          setExpandedKeys(['beijing']);
          setAutoExpandParent(true);
        }}
      >
        Update
      </Button>
      <TreeSelect
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        onChange={onSelect}
        value={selectedKeys}
        treeData={treeData2}
        // multiple
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

export const TreeWithoutValueProps = () => (
  <TreeSelect
    treeData={treeDataWithoutValue}
    value="beijing"
    defaultExpandAll
    onChange={(...args) => console.log(args)}
  />
);

TreeWithoutValueProps.story = {
  name: 'tree without value props',
};

export const TreeSelectRenderSelectedItem = () => {
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
    {
      label: '南美洲',
      value: 'South America',
      key: '2',
    },
    {
      label: '南极洲',
      value: 'Antarctica',
      key: '3',
    },
  ];

  return (
    <>
      <h4>单选</h4>
      <TreeSelect
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
        renderSelectedItem={item => `${item.value}-${item.label}`}
      />
      <h4>多选</h4>
      <TreeSelect
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        multiple
        placeholder="请选择"
        renderSelectedItem={(item, { index, onClose }) => ({
          content: `${item.value}-${item.label}`,
          isRenderInTag: true,
        })}
      />
      <h4>多选 + isRenderInTag=false</h4>
      <TreeSelect
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        multiple
        maxTagCount={2}
        placeholder="请选择"
        renderSelectedItem={(item, { index, onClose }) => ({
          content: (
            <Tag key={index} color="white">
              {item.value}
            </Tag>
          ),
          isRenderInTag: false,
        })}
      />
    </>
  );
};

TreeSelectRenderSelectedItem.story = {
  name: 'treeSelect renderSelectedItem',
};

const DisableStrictlyDemo = () => {
  const [value, setValue] = useState(['Shanghai']);
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
          disabled: true,
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
        {
          label: '日本',
          value: 'Japan',
          key: '0-1',
        },
      ],
    },
    {
      label: '北美洲',
      value: 'North America',
      key: '1',
    },
  ];
  return (
    <div>
      <TreeSelect
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        disableStrictly
        multiple
        searchPosition="trigger"
        filterTreeNode
        value={value}
        onChange={value => setValue(value)}
      />
    </div>
  );
};

export const DisabledStrictly = () => (
  <>
    <DisableStrictlyDemo />
  </>
);

DisabledStrictly.story = {
  name: 'disabledStrictly',
};


export const CheckRelationDemo = () => {
  const treeData = treeDataEn;
  const [value, setValue] = useState('China');
  const [value2, setValue2] = useState();
  const [value3, setValue3] = useState();
  const style = {
    width: 300,
  };
  const dropdownStyle = {
    maxHeight: 400,
    overflow: 'auto'
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
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + maxTagCount=2</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        maxTagCount={2}
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + maxTagCount=2 + 开启搜索</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        maxTagCount={2}
        filterTreeNode
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + maxTagCount=2 + 开启搜索 + searchBox in trigger</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        maxTagCount={2}
        filterTreeNode
        checkRelation='unRelated'
        searchPosition='trigger'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 中国节点为 disabled</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeDataWithoutValue}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + 中国节点为 disabled + 严格禁用</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeDataWithoutValue}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        disableStrictly
        style={style}
      />
      <br /><br />
      <div>checkRelation='unRelated' + defaultValue 为 China</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        defaultValue='China'
      />
      <br /><br />
      <div>checkRelation='unRelated' + defaultValue 为 China + 开启搜索</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        filterTreeNode
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        defaultValue='China'
      />
      <br /><br />
      <div>多选 + checkRelation='unRelated' + defaultValue 为 China + 开启搜索 + searchBox in trigger + showClear</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        filterTreeNode
        showClear
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        searchPosition='trigger'
        defaultValue={['China', 'Japan']}
      />
      <br /><br />
      <div>单选 + checkRelation='unRelated' + defaultValue 为 China + 开启搜索 + searchBox in trigger + showClear</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        filterTreeNode
        showClear
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        searchPosition='trigger'
        defaultValue='China'
      />
      <br /><br />
      <div>checkRelation='unRelated' + 受控 + value 初始为 China</div>
      <TreeSelect
        dropdownStyle={dropdownStyle}
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
      <TreeSelect
        dropdownStyle={dropdownStyle}
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
      <TreeSelect
        dropdownStyle={dropdownStyle}
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
      <TreeSelect
        dropdownStyle={dropdownStyle}
        treeData={treeData}
        multiple
        checkRelation='unRelated'
        defaultExpandAll
        style={style}
        onSelect={(value,status,node)=>console.log('select', value, status, node)}
      />
    </>
  );
};

export const SearchableAndExpandedKeys = () => {
  const [expandedKeys1, setExpandedKeys1] = useState([]);
  const [expandedKeys2, setExpandedKeys2] = useState([]);
  const [expandedKeys3, setExpandedKeys3] = useState([]);
  return (
      <>
          <Title heading={6}>expandedKeys 受控</Title>
          <TreeSelect
              style={{ width: 300, marginBottom: 30 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData2}
              expandedKeys={expandedKeys1}
              defaultValue='beijing'
              onExpand={v => {
                  console.log('onExpand value: ', v);
                  setExpandedKeys1(v);
              }}
          />
          <Title heading={6}>expandedKeys 受控 + 开启搜索</Title>
          <TreeSelect
              style={{ width: 300, marginBottom: 30 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData2}
              filterTreeNode
              defaultValue='beijing'
              expandedKeys={expandedKeys2}
              onExpand={v => {
                  console.log('onExpand value: ', v);
                  setExpandedKeys2(v);
              }}
          />
          <Title heading={6}>expandedKeys 受控 + 开启搜索 + 搜索时更新 expandedKeys</Title>
          <TreeSelect
              style={{ width: 300, marginBottom: 30 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData2}
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
      </>
  )
}

export const loadData = () => {
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
    const [loadedKeys, setLoadedKeys] = useState(['2']);

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
                            label: 'Child Node',
                            key: `${key}-0`,
                        },
                        {
                            label: 'Child Node',
                            key: `${key}-1`,
                        },
                    ]),
                );
                resolve();
            }, 1000);
        });
    }
    return (
        <TreeSelect
            loadData={onLoadData}
            filterTreeNode
            treeData={treeData}
            style={{ width: 300 }}
            placeholder="请选择"
        />
    );
}


export const loadDataAndLoadedkeys = () => {
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
    const [loadedKeys, setLoadedKeys] = useState(['2']);

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

    function updateLoadedKeys(key) {
        if(!loadedKeys.includes(key)){
          setLoadedKeys([...loadedKeys, key]);
          console.log('[...loadedKeys, key]', [...loadedKeys, key]);
        }
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
                            label: 'Child Node',
                            key: `${key}-0`,
                        },
                        {
                            label: 'Child Node',
                            key: `${key}-1`,
                        },
                    ]),
                );
                // updateLoadedKeys(key);
                resolve();
            }, 1000);
        });
    }
    return (
        <TreeSelect
            loadData={onLoadData}
            filterTreeNode
            // loadedKeys={loadedKeys}
            treeData={treeData}
            style={{ width: 300 }}
            placeholder="请选择"
        />
    );
}

export const size = () => {
  const props = {
    style: { width: 300 },
    dropdownStyle: { maxHeight: 400, overflow: 'auto' },
    defaultValue: ['0-0-1', '0-0-2', '0-0-3', '0-0-4', '0-0-5', '0-0-6', '0-0-7'],
    treeData: treeData3,
    multiple: true,
    filterTreeNode: true,
    searchPosition: "trigger"
  };

  return (<>
    <TreeSelect {...props} size={'small'} placeholder={'small'} />
    <br/><br/>
    <TreeSelect {...props} size={'default'} placeholder={'default'} />
    <br/><br/>
    <TreeSelect {...props} size={'large'} placeholder={'large'} />
  </>);
}

export const valueNotInTreeDataIssue = () => {
  const treeData = [
      {
          key: "test",
          label: "测试标签",
          children: [
              {
                  key: "test_2",
                  label: "测试二级标签"
              },
              {
                  key: "jzr_test",
                  label: "之睿测试"
              }
          ]
      },
  
      {
          key: "create",
          label: "创作构思",
          children: [
              {
                  key: "material",
                  label: "素材积累"
              },
              {
                  key: "lens_script",
                  label: "分镜脚本"
              }
          ]
      }
  ];

  const treeDataWithValue = [
    {
        value: "test",
        key: "0",
        label: "测试标签",
        children: [
            {
                value: "test_2",
                key: "0-1",
                label: "测试二级标签"
            },
            {
              value: "jzr_test",
                key: "0-2",
                label: "之睿测试"
            }
        ]
    },

    {
        value: "create",
        key: "1",
        label: "创作构思",
        children: [
            {
                value: "material",
                key: "1-1",
                label: "素材积累"
            },
            {
                value: "lens_script",
                key: "1-2",
                label: "分镜脚本"
            }
        ]
    }
  ];

  const commonProps = useMemo(() => {
    return {
      multiple: true,
      style: { width: 300 },
      dropdownStyle: { maxHeight: 400, overflow: 'auto' },
      onChange: (value) => {
        console.log('onChange', value);
      },
      onSelect: (value) => {
        console.log('onSelect', value); 
      },
    };
  }, []);
  
  return (
    <>
      <p style={{ backgroundColor: 'yellowgreen', width: 'fit-content' }}>多选，无 value</p>
      <p>checkRelation='related'</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={["test_2", 0]}
          treeData={treeData}
          {...commonProps}
        />
        <p>checkRelation='unRelated'</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={["test_2", "fish"]}
          checkRelation='unRelated'
          treeData={treeData}
          {...commonProps}
        />
        <p>onChangeWithObject, checkRelation='related'</p>
        <TreeSelect
          defaultExpandAll
          onChangeWithObject
          defaultValue={[
            {
              key: "test_2",
              label: "测试二级标签"
            },
            {
              key: "fish",
              label: "鱼"
            }
          ]}
          treeData={treeData}
          {...commonProps}
        />
        <p>onChangeWithObject, checkRelation='unRelated'</p>
        <TreeSelect
          defaultExpandAll
          onChangeWithObject
          defaultValue={[
            {
              key: "test_2",
              label: "测试二级标签"
            },
            {
              key: "fish",
              label: "鱼"
            }
          ]}
          treeData={treeData}
          {...commonProps}
        />
        <p style={{ backgroundColor: 'yellowgreen', width: 'fit-content' }}>多选，有 value</p>
        <p>checkRelation='related'</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={["test", "fish"]}
          treeData={treeDataWithValue}
          {...commonProps}
        />
        <p>checkRelation='unRelated'</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={["test", "fish"]}
          checkRelation='unRelated'
          treeData={treeDataWithValue}
          {...commonProps}
        />
        <p>onChangeWithObject, checkRelation='unRelated'</p>
        <TreeSelect
          defaultExpandAll
          onChangeWithObject
          defaultValue={[
            {
              value: "test_2",
              key: "0-1",
              label: "测试二级标签"
            },
            {
              key: "fish",
              value: "Fish",
              label: "鱼"
            }
          ]}
          treeData={treeDataWithValue}
          {...commonProps}
        />
        <p>onChangeWithObject, checkRelation='unRelated'</p>
        <TreeSelect
          defaultExpandAll
          onChangeWithObject
          defaultValue={[
            {
              value: "test_2",
              key: "0-1",
              label: "测试二级标签"
            },
            {
              key: "fish",
              value: "Fish",
              label: "鱼"
            }
          ]}
          treeData={treeDataWithValue}
          {...commonProps}
        />
        <p style={{ backgroundColor: 'yellowgreen', width: 'fit-content' }}>单选，无 value</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={"fish"}
          treeData={treeData}
          {...commonProps}
          multiple={false}
        />
        <p>onChangeWithObject</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={{
            key: "fish",
            value: "Fish",
            label: "鱼"
          }}
          treeData={treeData}
          {...commonProps}
          multiple={false}
          onChangeWithObject
        />
        <p style={{ backgroundColor: 'yellowgreen', width: 'fit-content' }}>单选，有 value</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={"fish"}
          treeData={treeDataWithValue}
          {...commonProps}
          multiple={false}
        />
        <p>onChangeWithObject</p>
        <TreeSelect
          defaultExpandAll
          defaultValue={{
            key: "fish",
            value: "Fish",
            label: "鱼"
          }}
          treeData={treeDataWithValue}
          {...commonProps}
          multiple={false}
          onChangeWithObject
        />
    </>
  );
};

class ValueTypeIsNumber extends React.Component {
  constructor() {
      super();
      this.state = {
          value: 1
      };
  }
  onChange(value) {
      console.log('onChange', value);
      this.setState({ value });
  }
  render() {
      const treeData = [
           {
              label: '北美洲',
              value: 'North America',
              key: '1',
          },
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
         
      ];
      return (
          <TreeSelect
              style={{ width: 300 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData}
              value={this.state.value}
              placeholder="请选择"
              multiple
              onChange={e => this.onChange(e)}
          />
      );
  }
}

export const valueIsNumber = () => <ValueTypeIsNumber />

export const searchPositionInTriggerAndVirtualize = () => {
  return (
      <>
          <TreeSelect  
              searchPosition="trigger"
              style={{ width: 300 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData2}
              filterTreeNode
              placeholder="单选"
              virtualize={{
                  itemSize: 28,
                  // dropDown height 300 minus search box height minus padding 8 * 2
                  // or if you set dropdown height, it will fill 100% of rest space
                  height: 236                
              }}
          />
      </>
  );
};

export const clickTriggerToHide = () => (
  <>
      <p>clickTriggerToHide 未设置，默认为 true</p>
      <TreeSelect
          style={{ width: 300 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData2}
          placeholder="单选"
      />
      <p>clickTriggerToHide 设置为 false</p>
      <TreeSelect
          style={{ width: 300 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData2}
          placeholder="单选"
          clickTriggerToHide={false}
      />
  </>
);
export const triggerRenderAddMethod = () => {
  const treeData = useMemo(() => [
      {
          label: '亚洲',
          value: '亚洲',
          key: '0',
          children: [
              {
                  label: '中国',
                  value: '中国',
                  key: '0-0',
                  children: [
                      {
                          label: '北京',
                          value: '北京',
                          key: '0-0-0',
                      },
                      {
                          label: '上海',
                          value: '上海',
                          key: '0-0-1',
                      },
                  ],
              },
          ],
      },
      {
          label: '北美洲',
          value: '北美洲',
          key: '1',
      }
  ], []);

  const onValueChange = useCallback((value) => {
      console.log('onChange', value);
  });

  const closeIcon = useCallback((value, onClear) => {
      return value && value.length ? <IconClose onClick={onClear} /> : <IconChevronDown />;
  }, []);

  const renderTagItem = useCallback((item, onRemove) => (
      <Tag closable key={item.key} onClose={() => { onRemove(item.key); }}>{item.label}</Tag>
  ), []);

  const renderTrigger1 = useCallback((props) => {
    const { value, placeholder, onClear } = props;
    return (
      <Button theme={'light'} icon={closeIcon(value, onClear)} iconPosition={'right'}>
          {value && value.length ? value.map(item => item.label).join('，') : placeholder}
      </Button>
    );
  }, []);

  const renderTrigger2 = useCallback((props) => {
      const { value, onSearch, onRemove, onClear } = props;
      return (
          <div style={{ border: '1px solid grey', width: 'fit-content', padding: 5, borderRadius: 5 }}>
              {value && value.length > 0 && 
              <div style={{ width: 'fit-content', minWidth: 10, padding: 5 }}>
                  {value.map(item => renderTagItem(item, onRemove))}
              </div>
              }
              <Input style={{ width: 200 }} onChange={onSearch} />
              {closeIcon(value, onClear)}
          </div>
      );
  }, []);

  const renderTrigger3 = useCallback((props) => {
    const { value, onSearch, onRemove, inputValue } = props;
    const tagInputValue = value.map(item => item.key);
    const renderTagInMultiple = (key) => {
      const label = value.find(item => item.key === key).label;
      const onCloseTag = (value, e, tagKey) => {
        onRemove(tagKey);
      }
      return <Tag style={{ marginLeft: 2 }} tagKey={key} key={key} onClose={onCloseTag} closable>{label}</Tag>
    }
    return (
      <TagInput
        inputValue={inputValue}
        value={tagInputValue}
        onInputChange={onSearch}
        renderTagItem={renderTagInMultiple}
      />
    )
  }, []);

  return (
    <>
      <TreeSelect
          triggerRender={renderTrigger1}
          treeData={treeData}
          placeholder='Single, Custom Trigger'
          onChange={onValueChange}
          style={{ width: 300 }}
      />
      <br />
      <TreeSelect
          triggerRender={renderTrigger1}
          multiple
          treeData={treeData}
          placeholder='Multiple, custom Trigger'
          onChange={onValueChange}
          style={{ width: 300 }}
      />
      <br />
      <TreeSelect
          triggerRender={renderTrigger2}
          filterTreeNode
          searchPosition="trigger"
          multiple
          treeData={treeData}
          placeholder='Custom Trigger'
          onChange={onValueChange}
          style={{ width: 300 }}
      />
      <br />
      <TreeSelect
          defaultExpandAll
          triggerRender={renderTrigger3}
          filterTreeNode
          searchPosition="trigger"
          multiple
          treeData={treeData}
          placeholder='Custom Trigger'
          onChange={onValueChange}
          style={{ width: 300 }}
      />
      <br />
       <TreeSelect
          defaultExpandAll
          checkRelation={'unRelated'} 
          triggerRender={renderTrigger3}
          filterTreeNode
          searchPosition="trigger"
          multiple
          treeData={treeData}
          placeholder='multiple, checkRelation = unRelated'
          onChange={onValueChange}
          style={{ width: 300 }}
      />
    </>
  );
}

export const AutoSearchFocusPlusPreventScroll = () => {
  return (
      <div>
        <div style={{height: '100vh' }}>我是一个高度和视窗高度一致的div。
          <br />由于 TreeSelect 设置了 searchAutoFocus 以及 preventScroll，
          <br /> 符合预期的情况是在没有滚动屏幕情况下，你不会看到 TreeSelect 的 trigger
        </div>
        <TreeSelect
          searchAutoFocus
          searchPosition="trigger"
          preventScroll={true}
          style={{ width: 300 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData2}
          filterTreeNode
          placeholder="单选"
        />
      </div>
  );
};

export const LongLabel = () => {
  const treeData = [
    {
        label: '这是一个超长的中文测试用标题这是一个超长的中文测试用标题这是一个超长的中文测试用标题这是一个超长的中文测试用标题',
        value: 'v1',
        key: '0',
    },
    {
        label: 'ThisISAVeryLongTestSentenceThisISAVeryLongTestSentenceThisISAVeryLongTestSentence',
        value: 'v2',
        key: '1',
    }
  ];

  return (
    <>
      <p>单选</p>
      <TreeSelect
        defaultValue='v1'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
      <p>单选，可搜索, searchPosition='trigger'</p>
      <TreeSelect
        filterTreeNode
        searchPosition='trigger'
        defaultValue='v1'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
       <p>单选，可搜索, searchPosition='dropDown'</p>
      <TreeSelect
        filterTreeNode
        defaultValue='v1'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
       <p>单选</p>
      <TreeSelect
        defaultValue='v2'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
      <p>单选，可搜索, searchPosition='trigger'</p>
      <TreeSelect
        filterTreeNode
        searchPosition='trigger'
        defaultValue='v2'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
       <p>单选，可搜索, searchPosition='dropDown'</p>
      <TreeSelect
        filterTreeNode
        defaultValue='v2'
        style={{ width: 300 }}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={treeData}
        placeholder="请选择"
      />
    </>
  );
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
      <TreeSelect
        checkRelation='unRelated'
        defaultValue={['0']}
        multiple
        defaultOpen
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

  const treeData2 =  useMemo(() => {
    return constructLargeData();
  }, []);

  const onButtonClick = useCallback(() => {
    setSign((sign) => {
      return !sign;
    })
  }, []);

  return <>
    <Button onClick={onButtonClick}>点击修改TreeData</Button>
    <br/><br/>
    <TreeSelect
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
  const [value2, setValue2] = useState(undefined);
  const [expandKeys, setExpandedKeys] = useState(["yazhou", 'zhongguo']);
  
  const switchChange = useCallback((checked) => {
    setWithObject(checked);
    setValue1(undefined);
    setValue2(undefined);
  }, []);

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

  const normalExpand = useCallback((expandedKeys, {expanded, node}) => {
    console.log('onExpanded', expandedKeys, expanded, copy(node));
  }, []);

  const keyMaps = useMemo(() => {
    return {
      // value: 'value1',
      key: 'key1',
      label: 'label1',
      children: 'children1',
      disabled: 'disabled1'
    };
  }, []);

  const regularTreeProps = useMemo(() => ({
    keyMaps: keyMaps,
    treeData: specialTreeData,
    style: { width: 300 },
    dropdownStyle: { maxHeight: 400, overflow: 'auto' },
    onChange: normalChange,
    onExpand: normalExpand,
    onChangeWithObject: withObject,
  }), [withObject]);

  const defaultSelectedObj = {
    label1: '北京',
    // value1: 'Beijing',
    key1: 'beijing',
  };

  return (
    <>
      <span>onChangeWithObject</span><Switch checked={withObject} onChange={switchChange} />
      <div key={String(withObject)} style={{ marginTop: 10 }}>
        <div> Single select</div>
        <TreeSelect
          {...regularTreeProps}
          defaultValue={withObject ? defaultSelectedObj : 'beijing'}
        />
        <div> Single select, onSearch, filterTreeNode, treeNodeFilterProp</div>
        <TreeSelect
          {...regularTreeProps}
          filterTreeNode={(inputValue, treeNodeString, data)=> {
            console.log("filterTreeNode", inputValue, treeNodeString, data);
            return treeNodeString.includes(inputValue);
          }}
          treeNodeFilterProp={"key1"}
          onSearch={(input, filteredExpandedKeys) => {
            console.log('onSearch', input, filteredExpandedKeys);
          }}
        />
        <div>Single select, controlled</div>
        <TreeSelect  
          {...regularTreeProps}
          value={value1}
          onChange={onSingleChange}
        />
        <div> Multiple select</div>
        <TreeSelect
          {...regularTreeProps}
          multiple
          defaultValue={withObject ? [defaultSelectedObj] : ['beijing']}
        />
        <div> Multiple select, controlled</div>
        <TreeSelect
          {...regularTreeProps}
          value={value2}
          multiple
          onChange={onMultipleChange}
        />
        <div> Multiple select, disableStrictly</div>
        <TreeSelect
          {...regularTreeProps}
          multiple
          disableStrictly
        />
        <div> Multiple, 展开受控</div>
        <TreeSelect
          {...regularTreeProps}
          multiple
          expandedKeys={expandKeys}
          onExpand={(expandedKeys, {expanded, node}) => {
            console.log('onExpanded', expandedKeys, expanded, copy(node));
            setExpandedKeys(expandedKeys);
          }}
        />
      </div>
    </> 
  );
}

export const Issue1542 = () => {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const treeData = treeDataEn;
  const onExpand = useCallback((expandedKeys) => {
    setExpandedKeys(expandedKeys);
  }, [expandedKeys]);

  const onSearch = useCallback((inputValue, filteredExpandedKeys) => {
    const set = new Set([...filteredExpandedKeys, ...expandedKeys]);
    setExpandedKeys(Array.from(set));
  }, [setExpandedKeys]);

  return (
    <>
      <TreeSelect
          // multiple
          style={{ width: 300 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData}
          filterTreeNode
          searchPosition='trigger'
          showFilteredOnly
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          onSearch={onSearch}
      />
    </>  
  );
};

class WebComponentWrapper extends HTMLElement {
  constructor() {
      super();
      this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
      ReactDOM.render(<_TreeSelect />, this.shadowRoot);
  }
}

customElements.define('my-web-component', WebComponentWrapper);

export const WebCompTestOutside = () => {

  return (
    <my-web-component></my-web-component>
  );
};

export const CustomSelectAll = () => {
  const [value, setValue] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([])
  const treeData = treeDataEn;
  const onSearch = useCallback((inputValue, filteredExpandedKeys, _filteredNodes) => {
    setFilteredNodes(_filteredNodes)
  }, []);

  const handleOnChange = useCallback((value) => {
    setValue(value);
  }, [])

  // 是否全选
  const allSelected = useMemo(() => {
    if (!filteredNodes.length) {
      return false;
    }
    const optionValues = filteredNodes.map(i => i.value);
    return !without(optionValues, ...value).length;
  }, [filteredNodes, value]);

  const handleOnAllSelect = useCallback(() => {
    const optionValues = filteredNodes.map(i => i.value);
    handleOnChange(allSelected ? [] : optionValues);
  }, [allSelected, handleOnChange, filteredNodes]);
 
  const outerBottomSlot = useMemo(() => {
    if (!filteredNodes.length) {
      // 未筛选状态下不展示按钮
      return null;
    }
    return (
        <div style={{ padding: '5px 20px', borderTop: '1px solid var(--semi-color-border)'}}>
          <Typography.Text link={true} onClick={handleOnAllSelect}>
            {allSelected ? '取消全选' : '全选'}
          </Typography.Text>
        </div> 
    );
  }, [allSelected, handleOnAllSelect, filteredNodes]);

  return (
    <>
      <span>本用例借助 onSearch 的第三个参数_filteredNodes 自定义搜索全选功能 </span>
      <br />
      <TreeSelect
          multiple
          style={{ width: 300 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData}
          filterTreeNode
          searchPosition='trigger'
          showFilteredOnly
          onSearch={onSearch}
          onChange={handleOnChange}
          value={value}
          showClear
          outerBottomSlot={outerBottomSlot}
      />
    </>  
  );
};

export const AutoMerge = () => {
  const [value, setValue] = useState([]);

  const onChange = useCallback((val) => {
    console.log('onChange', val);
    setValue(val);
  }, []);

  return (
    <>
      <TreeSelect
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

export const showFilteredOnly = () => {
  return (
      <>
          <span id='info'>searchPosition="trigger", showFilteredOnly, multiple</span>
          <br />
          <TreeSelect
              searchPosition="trigger"
              style={{ width: 300 }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={treeData2}
              multiple
              filterTreeNode
              showFilteredOnly
              maxTagCount={2}
              placeholder="多选"
          />
      </>
  );
}

export const EmptyContent = () => {
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
    }
  ];
  return ( 
      <>
        <TreeSelect
          style={{ width: 400 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={[]}
          placeholder="点击 trigger 查看 emptyContent 为 null 效果"
          emptyContent={null}
        />
        <br /><br />
        <TreeSelect
          style={{ width: 400 }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeData={treeData}
          placeholder="输入 v 查看 emptyContent 为 null 效果"
          filterTreeNode
          showFilteredOnly
          searchPosition={"trigger"}
          emptyContent={null}
        />
      </>
  );
}

export const filterAndKeyMaps = () => {
  const treeData = [
    {
        name: 'Asia',
        value: 'Asia',
        key: '0',
        children: [
            {
                name: 'China',
                value: 'China',
                key: '0-0',
                children: [
                    {
                        name: 'Beijing',
                        value: 'Beijing',
                        key: '0-0-0',
                    },
                    {
                        name: 'Shanghai',
                        value: 'Shanghai',
                        key: '0-0-1',
                    },
                ],
            },
            {
                name: 'Japan',
                value: 'Japan',
                key: '0-1',
                children: [
                    {
                        name: 'Osaka',
                        value: 'Osaka',
                        key: '0-1-0'
                    }
                ]
            },
        ],
    },
    {
        name: 'North America',
        value: 'North America',
        key: '1',
        children: [
            {
                name: 'United States',
                value: 'United States',
                key: '1-0'
            },
            {
                name: 'Canada',
                value: 'Canada',
                key: '1-1'
            }
          ]
      }
  ];
  return (
    <TreeSelect
      style={{ width: 300 }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      treeData={treeData}
      filterTreeNode
      keyMaps={{
        key: 'key',
        value: 'value',
        label: 'name',
      }}
      placeholder="单选可搜索的"
    />
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
      <TreeSelect
        style={{ width: 300}}
        expandIcon={<IconChevronDown size="small" className='testCls'/>}
        multiple
        defaultExpandedKeys={['yazhou']}
        treeData={treeData2}
      />
      <br />
      <br />
      <p>expandIcon 是函数</p>
      <TreeSelect
        style={{ width: 300}}
        multiple
        expandIcon={expandIconFunc}
        defaultExpandedKeys={['yazhou']}
        treeData={treeData2}
      />
    </>
  );
}

export const Fixed2968 = () => {
    return ( 
        <>
        <TreeSelect
            disabled
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData1}
            placeholder="请选择"
        />
        </>
    );
}
