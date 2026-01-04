---
localeCode: zh-CN
order: 51
category: 输入类
title: TreeSelect 树选择器
icon: doc-treeselect
brief: 树选择器用于多层级树形数据的结构化展示 & 选取，例如显示文件夹与文件的列表、显示组织架构成员列表等等。
---

## 代码演示

### 如何引入

```jsx import
import { TreeSelect } from '@douyinfe/semi-ui';
```
### 基本用法

最简单的用法，默认为单选模式，每一级菜单项均可选择。

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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
        <TreeSelect
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData}
            placeholder="请选择"
        />
    );
};
```

### 多选

设置 `multiple`，可以进行多选。多选情况下所有子项都被选择时，自动勾选显示其父项。  
通过 `leafOnly` 属性，可以设置只展示叶子节点，同时 onChange 的回调入参也会只有叶子节点的值。  

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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
    return ( 
        <div>
            <TreeSelect
                style={{ width: 300 }}
                multiple
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                placeholder="请选择"
            />
            <br/>
            <br/>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                leafOnly
                placeholder="只渲染叶子节点"
            />
            <br/>
            <br/>
        </div>
    );
};
```

### 限制标签展示数量

在多选的场景中，利用 `maxTagCount` 可以限制展示的标签数量，超出部分将以 +N 的方式展示。  
使用 `showRestTagsPopover` (>= v2.22.0) 可以设置在超出 `maxTagCount` 后，hover +N 是否显示 Popover，默认为 `false`。并且，还可以在 `restTagsPopoverProps` 属性中配置 Popover。

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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

    const textStyle = { margin: '20px 0 10px' };

    return ( 
        <div>
            <h4 style={textStyle}>maxTagCount=2:</h4>
            <TreeSelect
                multiple
                maxTagCount={2}
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                placeholder="当选中标签超过两个将折叠"
                defaultValue={['Beijing', 'Chengdu', 'Canada']}
            />
            <h4 style={textStyle}>maxTagCount=2, showRestTagsPopover:</h4>
            <TreeSelect
                showRestTagsPopover={true}
                restTagsPopoverProps={{ position: 'top' }}
                multiple
                maxTagCount={2}
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                placeholder="hover +N 查看"
                defaultValue={['Beijing', 'Chengdu', 'Canada']}
            />
        </div>
    );
};
```

### 可搜索的

通过设置 `filterTreeNode` 属性可支持搜索功能。默认对 `label` 值进行搜索，可通过 `treeNodeFilterProp` 更改。

如果只希望展示过滤后的结果，可以设置 `showFilteredOnly` 。

如果想要获取搜索结果的具体信息，可使用 `onSearch` 回调函数，函数具体参数见 API 列表。

```jsx live=true
import React from 'react';
import { TreeSelect, Switch } from '@douyinfe/semi-ui';
class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            showFilteredOnly: false,
        };
        this.onChange = this.onChange.bind(this);
        this.onSearch = this.onSearch.bind(this);
    }
    onChange(showFilteredOnly) {
        this.setState({ showFilteredOnly });
    }
    onSearch(inputValue, filteredExpandedKeys, filteredNodes) {
        console.log('onSearch', inputValue, filteredExpandedKeys, filteredNodes);
    }
    render() {
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
        const { showFilteredOnly } = this.state;
        return (
            <>
                <span>showFilteredOnly</span>
                <Switch
                    checked={showFilteredOnly}
                    onChange={this.onChange}
                    size="small"
                />
                <br/>
                <br/>
                <TreeSelect
                    style={{ width: 300 }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    treeData={treeData}
                    filterTreeNode
                    showFilteredOnly={showFilteredOnly}
                    placeholder="单选可搜索的"
                    onSearch={this.onSearch}
                />
                <br/>
                <br/>
                <TreeSelect
                    style={{ width: 300 }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    treeData={treeData}
                    multiple
                    filterTreeNode
                    maxTagCount={2}
                    showFilteredOnly={showFilteredOnly}
                    placeholder="多选可搜索的"
                    searchPlaceholder="请输入关键字开始搜索"
                    onSearch={this.onSearch}
                />
                <br/>
                <br/>
                <TreeSelect
                    style={{ width: 300 }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    treeData={treeData}
                    multiple
                    filterTreeNode
                    maxTagCount={2}
                    showFilteredOnly={showFilteredOnly}
                    placeholder="搜索框autofocus"
                    searchPlaceholder="autofocus"
                    searchAutoFocus
                    onSearch={this.onSearch}
                />
            </>
        );
    }
}
```

### 搜索框位置

可以使用 `searchPosition` 来设置搜索框的位置，可选: `dropdown`(默认)、`trigger`。

当输入框位于 trigger 时: 
1. 搜索框占位符由 `placeholder` 控制；
2. `showClear=true` 时，点击输入框的清空按钮，将同时清空 inputValue 和 value。

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
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
    return (
        <>
            <TreeSelect
                searchPosition="trigger"
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                filterTreeNode
                placeholder="单选"
            />
            <br />
            <br />
            <TreeSelect
                searchPosition="trigger"
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                filterTreeNode
                maxTagCount={2}
                placeholder="多选"
            />
        </>
    );
};
```

### 尺寸大小

可以通过 `size` 设置尺寸大小，可选: 'small'、'default'、'large'

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
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
        <div>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                size="small"
                placeholder="small"
            />
            <br />
            <br />
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                size="default"
                placeholder="default"
            />
            <br />
            <br />
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                size="large"
                placeholder="large"
            />
        </div>
    );
};
```

### 默认展开

`defaultExpandAll` 和 `expandAll` 均可以设置 `TreeSelect` 的默认展开/收起状态。二者的区别是，`defaultExpandAll` 只在初始化时生效，而 `expandAll` 不仅会在初始化时生效，当数据(`treeData`)发生动态更新时，`expandAll` 也仍然生效。

在下面的 demo 中，`TreeData` 更新后，`defaultExpandAll` 失效，`expandAll` 仍然生效。

```jsx live=true
import React, { useEffect, useState } from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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

    const [data, setData] = useState([]);

    useEffect(() => {
        setTimeout(() => setData(treeData), 500);
    }, []);

    return (
        <>
            <TreeSelect
                style={{ width: 300, marginBottom: 20 }}
                expandAll
                treeData={data}
                placeholder="expandAll"
            />
            <TreeSelect
                style={{ width: 300 }}
                defaultExpandAll
                treeData={data}
                placeholder="defaultExpandAll"
            />
        </>
    );
};

```

### 禁用

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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
        <div>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                disabled
                placeholder="禁用下拉菜单"
            />
            <br />
            <br />
            <TreeSelect
                style={{ width: 300 }}
                defaultValue={'Shanghai'}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                disabled
            />
            <br />
            <br />
            <TreeSelect
                style={{ width: 300 }}
                defaultValue={['Shanghai', 'North America']}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                disabled
            />
        </div>
    );
};
```

### 严格禁用

可以使用 `disableStrictly` 来开启严格禁用。开启严格禁用后，当节点是 disabled 的时候，则不能通过子级或者父级的关系改变选中状态。

以下面的 demo 为例，节点"中国"开启了严格禁用，因此，当我们改变其父节点"亚洲"的选中状态时，也不会影响到节点"中国"的选中状态。

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
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
        }
    ];
    return ( 
        <div>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                disableStrictly
                multiple
                defaultValue={['Shanghai']}
            />
        </div>
    );
};

```

### 受控
传入 `value` 时即为受控组件，可以配合 `onChange` 使用。
```jsx live=true hideInDSM
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            value: 'Shanghai'
        };
    }
    onChange(value) {
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
            }
        ];
        return (
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                value={this.state.value}
                placeholder="请选择"
                onChange={e => this.onChange(e)}
            />
        );
    }
}
```

### 节点选中关系
版本：>= 2.5.0

多选时，可以使用 `checkRelation` 来设置节点之间选中关系的类型，可选：'related'（默认）、'unRelated'。当选中关系为 'unRelated' 时，意味着节点之间的选中互不影响。

```jsx live=true
import React from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';
() => {
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
        <TreeSelect
            multiple
            defaultValue='Asia'
            checkRelation='unRelated'
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData}
        />
    );
};
```

### 开启搜索的展开受控
传入 `expandedKeys` 时即为展开受控组件，可以配合 `onExpand` 使用。当展开受控时，如果开启 `filterTreeNode` 并进行搜索是不会再自动展开节点的，此时，节点的展开完全由 `expandedKeys` 来控制。
你可以利用 `onSearch` 的入参 `filteredExpandedKeys`（version: >= 2.6.0） 来实现展开受控时的搜索展开效果。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
    const [expandedKeys, setExpandedKeys] = useState([]);
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
        }
    ];
    return (
        <TreeSelect
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData}
            filterTreeNode
            expandedKeys={expandedKeys}
            onExpand={expandedKeys => {
                setExpandedKeys(expandedKeys);
            }}
            onSearch={(inputValue, filteredExpandedKeys, filteredNodes) => {
                setExpandedKeys([...filteredExpandedKeys, ...expandedKeys]);
            }}
        />
    );
};
```

### 虚拟化
列表虚拟化，用于大量树节点的情况。开启后，动画效果将被关闭。

`virtualize` 是一个包含下列值的对象： 
- height: 高度值，如果为 string 必须有计算高度才能被渲染出来，即其父节点有 offsetHeight。建议传入数组。
- width: 宽度值，默认 100%
- itemSize: 每行的treeNode的高度，必传

如果带搜索框，建议开启 `showFilteredOnly` 减少多余节点的渲染。

```jsx live=true hideInDSM
import React from 'react';
import { TreeSelect, Button } from '@douyinfe/semi-ui';
class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            gData: [],
            total: 0,
        };
        this.onGen = this.onGen.bind(this);
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
  
    render() {
        const style = {
            width: 260,
            height: 360,
            border: '1px solid var(--semi-color-border)'
        };
        return (
            <div style={{ padding: '0 20px' }}>
                <Button onClick={this.onGen}>生成数据: </Button>
                <span>共 {this.state.total} 个节点</span>
                <br/>
                <br/>
                {this.state.gData.length ? (
                    <TreeSelect
                        style={{ width: 300 }}
                        treeData={this.state.gData}
                        filterTreeNode
                        showFilteredOnly
                        placeholder="Please select"
                        dropdownStyle={{ 
                            // height: 300,
                            overflow: 'hidden'
                        }}
                        virtualize={{
                            itemSize: 28,
                            // dropDown height 300 minus search box height minus padding 8 * 2
                            // or if you set dropdown height, it will fill 100% of rest space
                            height: 236                
                        }}
                    />
                ) : null}
            </div>
        );
    }
}
```

### 动态更新数据
```jsx live=true hideInDSM
import React from 'react';
import { TreeSelect, Button } from '@douyinfe/semi-ui';
class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            treeData: [],
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
                    value: `${i}-${ci}`
                };
                return child;
            });
            let item = {
                key: `${i}`,
                label: `Item-${i}`,
                value: `${i}`,
                children
            };
            return item;
        });
        this.setState({ treeData });
    }
    render() {
        return (
            <>
                <TreeSelect
                    style={{ width: 300 }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    treeData={this.state.treeData}
                    placeholder="请选择"
                />
                <br/>
                <br/>
                <Button onClick={this.add}>
                    动态改变数据
                </Button>
            </>
        );
    }
}
```

### 异步加载数据
通过设置 `loadData` 可以动态加载数据，此时需要在数据中传入 `isLeaf` 标明叶子节点。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
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
            treeData={treeData}
            style={{ width: 300 }}
            placeholder="请选择"
        />
    );
};
```

### 自定义 Trigger

如果默认的触发器样式满足不了你的需求，可以用 `triggerRender` 自定义选择框的展示。

triggerRender 入参如下:

```typescript
interface TriggerRenderProps {
    componentProps: TreeSelectProps;// 所有用户传给 TreeSelect 的 props
    disabled: boolean;              // 是否禁用 TreeSelect
    value: TreeNodeData[];              // 已选中的 node 的数据
    inputValue: string;             // 当前 input 框的输入值
    onClear: e => void;             // 用于清空值的函数
    placeholder: string;            // placeholder
    /* 删除单个 item 时调用的函数，以 item 的 key 作为入参， 
     * 从 v2.32.0 版本开始支持 
    */
    onRemove: key => void;          
    /**
     * 用于在 Input 框值更新时候启动搜索，当你在 triggerRender 自定义的
     * Input 组件值更新时，你应该调用该函数，用于向 TreeSelect 内部
     * 同步状态, 使用同时需要设置 filterTreeNode 参数非 false, 
     * searchPosition 为 'trigger'
     * 从 v2.32.0 版本开始支持
    */
    onSearch: inputValue => void;   
}
```

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { TreeSelect, Button, Tag, TagInput } from '@douyinfe/semi-ui';

function Demo() {
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

    const renderTrigger = useCallback((props) => {
        const { value, onSearch, onRemove, inputValue } = props;
        const tagInputValue = value.map(item => item.key);
        const renderTagInMultiple = (key) => {
            const label = value.find(item => item.key === key).label;
            const onCloseTag = (value, e, tagKey) => {
                onRemove(tagKey);
            };
            return <Tag style={{ marginLeft: 2 }} tagKey={key} key={key} onClose={onCloseTag} closable>{label}</Tag>;
        };
        return (
            <TagInput
                inputValue={inputValue}
                value={tagInputValue}
                onInputChange={onSearch}
                renderTagItem={renderTagInMultiple}
            />
        );
    }, []);

    return (
        <TreeSelect
            triggerRender={renderTrigger}
            filterTreeNode
            searchPosition="trigger"
            multiple
            treeData={treeData}
            placeholder='Custom Trigger'
            onChange={onValueChange}
            style={{ width: 300 }}
        />
    );
}
```

### 自定义渲染已选项

你可以通过 renderSelectedItem 自定义选择框中已选项标签的渲染结构。

- 单选时 `renderSelectedItem(treeNode: TreeNodeData) => content:ReactNode`
- 多选时 `renderSelectedItem(treeNode: TreeNodeData, { index:number, onClose:function }) => { isRenderInTag:bool, content:ReactNode }`
    - isRenderInTag 为 true 时，会自动将 content 包裹在 Tag 中渲染（带有背景色以及关闭按钮）
    - isRenderInTag 为 false 时，将直接渲染返回的 content

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { TreeSelect, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const [value, setValue] = useState([]);
    const treeData = useMemo(() => [
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
    ], []);
    
    return (
        <>
            <h4>单选</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                renderSelectedItem={item => item.label}
            />
            <h4>多选+ isRenderInTag=true</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                multiple
                renderSelectedItem={(item, { index, onClose }) => ({ content: item.label, isRenderInTag: true })}
            />
            <h4>多选 + isRenderInTag=false</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                multiple
                maxTagCount={2}
                renderSelectedItem={(item, { index, onClose }) => {
                    return ({ 
                        content: (
                            <Tag 
                                key={index} 
                                color="white" 
                                closable 
                                onClose={onClose}
                            >
                                {item.value}
                            </Tag>
                        ), 
                        isRenderInTag: false
                    });
                }}
            />
        </>
    );
}
```

## API参考

### TreeSelect

| 属性            | 说明                                                                                                                                        | 类型          | 默认值          |
|-------------   |--------------------------------------------------------------------------------------------------------------------------------------------| -------------- | -------------- |
| arrowIcon | 自定义右侧下拉箭头Icon，当showClear开关打开且当前有选中值时，hover会优先显示clear icon                                                            |  ReactNode |       | 
| autoAdjustOverflow| 浮层被遮挡时是否自动调整方向（暂时仅支持竖直方向，且插入的父级为 body）                                                                    | boolean | true| 
| autoExpandParent | 是否自动展开父节点                                                                                                                  | boolean | false | 
| autoMergeValue | 设置自动合并 value。具体而言是，开启后，当某个父节点被选中时，value 将不包括该节点的子孙节点。（在leafOnly为false的情况下生效）。v2.61.0 后提供     | boolean | true |
| borderless        | 无边框模式，v2.33.0后提供                                                                                                          | boolean | false |
| checkRelation | 多选时，节点之间选中状态的关系，可选：'related'、'unRelated'。v2.5.0后提供                                                                  | string | 'related' |
| className | 选择框的 `className` 属性                                                                                                                 | string | - | - |
| clearIcon | 可用于自定义清除按钮, showClear为true时有效。v2.25.0后提供                                                                                     | ReactNode | - |
| clickToHide  | 选择后是否自动关闭下拉弹层，仅单选模式有效                                                                                                   | boolean| true |
| clickTriggerToHide  | 面板打开状态下，点击 Trigger 后是否关闭面板。v2.32.0后提供                                                                            | boolean| true |
| defaultExpandAll | 设置在初始化时是否展开所有节点。而如果后续数据(`treeData`)发生改变，这个 api 是无法影响节点的展开情况的，如果有这个需要可以使用 `expandAll`          | boolean | false |
| defaultExpandedKeys | 默认展开的节点，显示其直接子级                                                                                                       | string\[] | - |
| defaultOpen | 默认展开下拉菜单                                                                                                                           | boolean | false |
| defaultValue | 指定默认选中的条目                                    | <ApiType detail='string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[]'>ValueType</ApiType> | - |
| disabled | 是否禁用                                                                                                                                     | boolean | false |
| disableStrictly | 是否严格禁用                                                                                                                           | boolean | false |
| dropdownClassName | 下拉菜单的 `className` 属性                                                                                                          | string | - |
| dropdownMatchSelectWidth | 下拉菜单最小宽度是否等于Select                                                                                                  | boolean | true |
| dropdownMargin | 下拉菜单计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin。v2.25.0后提供    | object\|number |
| dropdownStyle | 下拉菜单的样式                                                                                                                            | CSSProperties | - |
| emptyContent | 当搜索无结果时展示的内容                                                                                                                     | ReactNode | `暂无数据` |
| expandAction | 展开逻辑，可选 false, 'click', 'doubleClick'。默认值为 false，即仅当点击展开按钮时才会展开                                                        | boolean \| string | false |
| expandAll | 设置是否默认展开所有节点，若后续数据(`treeData`)发生改变，默认的展开情况也是会受到这个 api 影响的                                                         | boolean | false |
| expandedKeys | （受控）展开的节点，默认展开节点显示其直接子级                                                                                                   | string[] | - |
| expandIcon | 自定义展开图标，使用[示例](/zh-CN/navigation/tree#%E8%87%AA%E5%AE%9A%E4%B9%89%E5%B1%95%E5%BC%80%20Icon) | ReactNode \| (props: expandProps)=>ReactNode | - | 2.75.0 |
| keyMaps | 自定义节点中 key、label、value 的字段。v2.47.0后提供。如果 keyMaps 中设置 label 的自定义名称并且开启了搜索，为保证搜索正确，需要将 treeNodeFilterProp 设置为 treeData 的键之一或者通过 filterTreeNode 自定义搜索函数                                                                                            | object |  - |
| filterTreeNode | 是否根据输入项进行筛选，默认用 `treeNodeFilterProp` 的值作为要筛选的 `TreeNodeData` 的属性值, data 参数自 v2.28.0 开始提供                         | boolean\| <ApiType detail='(inputValue: string, treeNodeString: string, data?: TreeNodeData) => boolean'>Function</ApiType> | false |
| getPopupContainer  | 指定父级 DOM，弹层将会渲染至该 DOM 中，自定义需要设置 `position: relative` 这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                                                       | function():HTMLElement | - |
| labelEllipsis | 是否开启label的超出省略，默认虚拟化状态下开启                                                                                                   | boolean | false\|true(虚拟化) | 
| leafOnly | 多选模式下是否开启 onChange 回调入参及展示标签只有叶子节点                                                                                            | boolean | false |
| loadData | 异步加载数据，需要返回一个Promise                                                                                                                 | (treeNode: TreeNodeData) => Promise |- |
| loadedKeys | （受控）已经加载的节点，配合 loadData 使用                                                                                                       | Set< string > | - |
| maxTagCount | 最多显示多少个 tag                                                                                                                           | number | - |
| motionExpand | 是否开启选项树节点动画                                                                                                                        | boolean | true |
| multiple | 是否支持多选                                                                                                                                     | boolean | false | - |
| optionListStyle | optionList的样式                                                                                                                          | CSSProperties | - |
| outerBottomSlot  | 渲染在弹出层底部，与 optionList 平级的自定义 slot                                                                                            | ReactNode  |  - | 
| outerTopSlot| 渲染在弹出层顶部，与 optionList 平级的自定义 slot，注意如果开启了 filterTreeNode 会取代搜索框，可以通过 search 方法来自行处理                              |  ReactNode  |  - | 
| placeholder | 选择框默认文字                                                                                                                                  | string | - | 
| position | 下拉菜单位置，可选值参考 Tooltip position。v2.25.0后提供                                                                                              | string | bottomLeft |
| prefix | 前缀标签                                                                                                                                            | ReactNode | - |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                                                 | boolean | - |
| renderFullLabel | 完全自定义label的渲染函数，[入参及用法详见](/zh-CN/navigation/tree#高级定制)                                                                     | (obj) => ReactNode | - |
| renderLabel | 自定义label的渲染函数，searchWord 参数自 2.65.0 开始支持。[入参及用法详见](/zh-CN/navigation/tree#自定义节点内容)                                                                        | <ApiType detail='(label: ReactNode, data: TreeNodeData, searchWord: string) => ReactNode'>(label, data, searchWord) => ReactNode</ApiType> | - |
| renderSelectedItem | 自定义渲染已选项                                                                                                                         | Function | - |
| restTagsPopoverProps | Popover 的配置属性，可以控制 position、zIndex、trigger 等，具体参考[Popover](/zh-CN/show/popover#API%20%E5%8F%82%E8%80%83) 。v2.22.0后提供  | PopoverProps | {} |
| searchAutoFocus | 搜索框自动聚焦                                                                                                                              | boolean | false |
| searchPlaceholder | 搜索框默认文字                                                                                                                            | string | - | 
| searchPosition | 设置搜索框的位置，可选: `dropdown`、`trigger`                                                                                                  | string | `dropdown` |
| showClear | 当值不为空时，trigger 是否展示清除按钮                                                                                                               | boolean | false | 
| showFilteredOnly | 搜索状态下是否只展示过滤后的结果                                                                                                               | boolean | false | 
| showLine | 选项面板中选项显示连接线。v2.50.0后提供                                                                                                                | boolean | false |
| showRestTagsPopover | 当超过 maxTagCount，hover 到 +N 时，是否通过 Popover 显示剩余内容。v2.22.0后提供                                                              | boolean | false |
| showSearchClear | 是否显示搜索框的清除按钮                                                                                                                       | boolean | true |
| size | 选择框大小，可选 `large`，`small`，`default`                                                                                                             | string | `default` |
| style | 选择框的样式                                                                                                                                           | CSSProperties | - |
| suffix | 后缀标签                                                                                                                                             | ReactNode | - |
| treeData | `treeNodes` 数据，如果设置则不需要手动构造 `TreeNode` 节点（`key` 值在整个树范围内唯一）                                                                    | TreeNodeData[] | \[] |
| treeNodeFilterProp | 搜索时输入项过滤对应的 `TreeNodeData` 属性                                                                                                   | string | `label` |
| treeNodeLabelProp | 作为显示的 `prop` 设置                                                                                                                      | string | `label` | 
| triggerRender | 自定义触发器渲染方法                                                                                                                             | (props: TriggerRenderProps) => ReactNode | - |
| validateStatus | 校验结果，可选 `warning`、`error`、 `default`（只影响样式背景色）                                                                                  | string | - |
| value | 当前选中的节点的value值，传入该值时将作为受控组件     | <ApiType detail='string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[]'>ValueType</ApiType>| - |
| virtualize | 列表虚拟化，用于大量树节点的情况，由 height, width, itemSize 组成，参考 Tree - Virtualize Object。开启后将关闭动画效果。                                     | object | - |
| zIndex | treeSelect下拉菜单的zIndex                                                                                                                             | number | 1030 |
| onBlur | 失去焦点时的回调                                                                                                                                        | Function(event) | - |
| onChange | 选中树节点时调用此函数，默认返回值为当前所有选中项的value值及节点属性；如果是通过tag关闭，event参数为null                                                         | Function | - |
| onChangeWithObject | 是否将选中项 option 的其他属性作为回调。设为 true 时，onChange 的入参类型Function(node\|node[], e) 此时如果是受控，也需要把 value 设置成 object，且必须含有 value 的键值；defaultValue同理。    | boolean | false |
| onClear     | 点击清除按钮时触发的回调。v2.52.0后提供                                                                                                               | (e: Event) => void |  -  |
| onExpand | 展示节点时调用                                           | <ApiType detail='(expandedKeys:array, {expanded: bool, node}) => void'>(expandedKeys, object) => void</ApiType> | - |
| onFocus | 聚焦时的回调                                                                                                                                           | Function(event) | - |
| onLoad | 节点加载完毕时触发的回调                            | <ApiType detail='(loadedKeys: Set<string\>, treeNode: TreeNodeData) => void'>(loadedKeys, treeNode) => void</ApiType> | - |
| onSearch | 文本框值变化时回调。 <br/>入参 `filteredExpandedKeys` 表示因为搜索或 value / defaultValue 而展开的节点的 key, 可以配合 expandedKeys 受控时使用。**filteredExpandedKeys 在 2.6.0 中新增**；<br/>入参 `filteredNodes` 是搜索命中的节点。**filteredNodes 在 2.57.0 中新增**|  <ApiType detail='function(input: string, filteredExpandedKeys: string[], filteredNodes: TreeNodeData[])'>(input, filteredExpandedKeys, filteredNodes)=>void</ApiType>  |  |
| onSelect | 被选中时调用，返回值为当前事件选项的key值              | <ApiType detail='(selectedKey:string, selected: bool, selectedNode: TreeNodeData) => void'>(selectedKey, selected, selectedNode)=>void</ApiType> | - |
| onVisibleChange     | 弹出层展示/隐藏时触发的回调                                                                                                                    | Function(isVisible:boolean) |     |

### TreeNodeData

> __不同 `TreeNodeData` 的 key 值要求必填且唯一。__`label` 允许重复。value 值非必填。此时 onChange, value, defaultValue 及 onChangeWithObject 中所取的 value 属性值将改为 key 值。
> 为了保证行为的符合预期，treeData 中的 value 值或者全部不填写，或者全部填写且唯一，不建议混写。

| 属性            | 说明         | 类型           | 默认值          |
|-------------   | ----------- | -------------- | -------------- |
| value | 属性值 | string\|number | - |
| label | 展示的文本 | string\|ReactNode | - |
| icon | 自定义图标 | ReactNode | - |
| disabled | 是否禁用，多选状态下支持 | boolean | false |
| key | required且要求唯一 | string | - |
| isLeaf| 是否为叶子节点 | boolean |-|


### Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| Name    | Description  |
|---------|--------------|
| search(sugInput: string)  | 如果需要在外部自定义搜索框，可以在自定义搜索框值变更时主动调用该方法，改变筛选结果 |


## Accessibility

### ARIA

- TreeSelect 会自动设置 `aria-label` 为 'TreeSelect'，也支持用户自行设置 `aria-label` 来表示该 TreeSelect 作用;
- TreeSelect 允许用户设置 `aria-describedby`、`aria-errormessage`、`aria-invalid`、`aria-labelledby`、`aria-required`，另外，Form 会为 Form.TreeSelect 自动设置这些属性;
- TreeSelect 会自动为每个子节点分别设置 `aria-disabled`、`aria-checked`、`aria-selected`、`aria-level` 来表明节点状态及层级;

示例:
```typescript
    <TreeSelect
        /* other attributes */
        aria-label='example treeSelect'
    />
```


## 设计变量
<DesignToken/>