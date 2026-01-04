---
localeCode: zh-CN
order: 60
category: 导航类
title:  Tree 树形控件
icon: doc-tree
brief: 树型结构列表。
---


## 代码演示

### 如何引入

```jsx import
import { Tree } from '@douyinfe/semi-ui';
```

### 基本用法

最简单的用法，默认为单选模式，每一级菜单项均可选择。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            defaultExpandAll
            style={style}
        />
    );
};
```

### 多选

设置 `multiple`，可以进行多选。多选情况下所有子项都被选择时，自动勾选显示其父项。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            multiple
            defaultExpandAll
            style={style}
        />
    );
};
```

### 可搜索的

通过设置 `filterTreeNode` 属性可支持搜索功能。默认对 `label` 值进行搜索，可通过 `treeNodeFilterProp` 更改。
如果只希望展示过滤后的结果，可以设置 `showFilteredOnly` 。
```jsx live=true
import React from 'react';
import { Tree, Switch } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            showFilteredOnly: false,
        };
        this.onChange = this.onChange.bind(this);
    }
    onChange(showFilteredOnly) {
        this.setState({ showFilteredOnly });
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
        const style = {
            width: 260,
            height: 420,
            border: '1px solid var(--semi-color-border)'
        };
        const { showFilteredOnly } = this.state;
        return (
            <>
                <span>showFilteredOnly</span>
                <Switch
                    checked={showFilteredOnly}
                    onChange={this.onChange}
                    size="small"
                />
                <br />
                <Tree
                    treeData={treeData}
                    multiple
                    filterTreeNode
                    showFilteredOnly={showFilteredOnly}
                    style={style}
                />
            </>
        );
    }
}
```

设置 `filterTreeNode` 属性开启搜索后，可以通过设置 `searchRender` 自定义搜索框的渲染方法，设置为`false`时可以隐藏搜索框。
```jsx live=true
import React from 'react';
import { Tree, Input } from '@douyinfe/semi-ui';

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
        <Tree
            filterTreeNode
            searchRender={({ prefix, ...restProps }) => (
                <Input
                    prefix='Search'
                    {...restProps}
                />
            )}
            treeData={treeData}
        />
    );
};

```

### 手动触发搜索
可以通过ref的方式获取tree的实例，调用tree的`search`方法进行搜索。注意需要同时设置`filterTreeNode`开启搜索，如果搜索框在tree外部，可以通过设置`searchRender=false`隐藏tree内部的搜索框。
```jsx live=true
import React from 'react';
import { Tree, Input } from '@douyinfe/semi-ui';

() => {
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
            <Input aria-label='filter tree' prefix="Search" showClear onChange={v => ref.current.search(v)} />
            <div style={{ marginTop: 20 }}>搜索结果如下：</div>
            <Tree
                ref={ref}
                filterTreeNode
                searchRender={false}
                treeData={treeData}
                blockNode={false}
            />
        </div>
    );
};
```

### 简单 JSON 格式的数据
可以通过 `treeDataSimpleJson` 传入 JSON 形式的 `treeNodes` 数据。此时 key-value 键值对中的 key 值将作为 `TreeNodeData` 的 `key` 和 `label`，`value` 值将作为 `TreeNodeData` 的 `value`。返回值为包含选中节点的 JSON 数据。

```jsx live=true hideInDSM
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

() => {
    const json = {
        "Node1": {
            "Child Node1": '0-0-1',
            "Child Node2": '0-0-2',
        },
        "Node2": "0-1"
    };
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeDataSimpleJson={json}
            multiple
            onChange={e => console.log('当前所有选中项: ', e)}
            onSelect={e => console.log('当前选项: ', e)}
            style={style}
        />

    );
};
```

### 行显示节点
可以通过设置 `blockNode` 使节点显示为整行，此时悬浮选中高亮状态都会显示整行。默认打开。
关闭时只高亮节点 label。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
        <div>
            <Tree
                treeData={treeData}
                defaultValue='Shanghai'
                blockNode={false}
            />
            <br />
            <Tree
                treeData={treeData}
                defaultValue='Shanghai'
                multiple
                blockNode={false}
            />
        </div>
    );
};
```

### 自定义节点内容
`TreeNodeData` 的 label 属性支持传入 ReactNode 来自定义显示的节点内容。注意如果设置 `filterTreeNode` 开启搜索，默认是对 label 的值进行搜索，当 label 为节点时，需要自定义 `filterTreeNode` 的函数来满足搜索需求。

在**v>=1.6.0**的版本中，你也可以使用 `renderLabel` 来传入自定义的渲染方法，此时搜索值仍为treeData中的相应的label属性。
```jsx live=true
import React from 'react';
import { Tree, ButtonGroup, Button } from '@douyinfe/semi-ui';

() => {
    const opts = {
        content: 'Hi, Bytedance dance dance',
        duration: 3,
    };

    const button = (
        <ButtonGroup
            size="small"
            theme="borderless"
        >
            <Button
                onClick={e => {
                    Toast.info(opts);
                    e.stopPropagation();
                }}
            >提示</Button>
            <Button>点击</Button>
        </ButtonGroup>
    );

    const style = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const treeDataWithNode = [
        {
            label: (
                <div style={style}>
                    <span>亚洲</span>
                    {button}
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
                    key: 'zhongguo'
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
        }
    ];
    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeDataWithNode}
            style={treeStyle}
        />
    );
};
```

过长省略。在**v>=1.6.0**的版本中，可以使用 `renderLabel` 来实现文本过长省略的效果。
```jsx live=true
import React from 'react';
import { Tree, Button, Typography } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

() => {
    const renderBtn = (content) => (
        <Button
            onClick={e => {
                Toast.info({ content });
                e.stopPropagation();
            }}
            icon={<IconMore />}
            size="small"
        />
    );
    const renderLabel = (label, item) => (
        <div style={{ display: 'flex' }}>
            <Typography.Text
                ellipsis={{ showTooltip: true }}
                style={{ width: 'calc(100% - 48px)' }}
            >
                {label}
            </Typography.Text>
            {renderBtn(item.key)}
        </div>
    );
    const treeDataWithNode = [
        {
            label: '亚洲亚洲亚洲亚洲亚洲亚洲亚洲亚洲',
            value: 'yazhou',
            key: 'yazhou',
            children: [
                {
                    label: '中国中国中国中国中国中国中国中国',
                    value: 'zhongguo',
                    key: 'zhongguo'
                },
                {
                    label: '日本日本日本日本日本日本日本日本',
                    value: 'riben',
                    key: 'riben',
                },
            ],
        }
    ];
    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeDataWithNode}
            renderLabel={renderLabel}
            style={treeStyle}
        />
    );
};
```


### 自定义图标
通过设置 `icon` 属性可添加自定义图标。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';
import { IconMapPin } from '@douyinfe/semi-icons';

() => {
    const treeData = [
        {
            label: 'Asia',
            value: 'Asia',
            key: '0',
            icon: (<IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />),
            children: [
                {
                    label: 'China',
                    value: 'China',
                    key: '0-0',
                    icon: (<IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />)
                },
                {
                    label: 'Japan',
                    value: 'Japan',
                    key: '0-1',
                    icon: (<IconMapPin style={{ color: 'var(--semi-color-text-2)' }} />)
                },
            ],
        }
    ];
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            style={style}
        />
    );
};
```

### 目录树模式

通过设置 `directory` 属性可显示为目录树模式。目录树模式下自带目录图标，可以通过自定义图标覆盖。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            directory
            style={style}
        />
    );
};
```

### 禁用

可以使用 `disableStrictly` 来开启严格禁用。开启严格禁用后，当节点是 disabled 的时候，则不能通过子级或者父级的关系改变选中状态。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            defaultValue='Shanghai'
            multiple
            disableStrictly
            style={style}
        />
    );
};
```

### 节点选中关系
版本：>= 2.5.0

多选时，可以使用 `checkRelation` 来设置节点选中关系的类型，可选：'related'（默认）、'unRelated'。当选中关系为 'unRelated'，意味着节点之间的选中互不影响。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            multiple
            checkRelation='unRelated'
            defaultExpandAll
            style={style}
        />
    );
};
```

### 默认展开

`defaultExpandAll` 和 `expandAll` 均可以设置 `Tree` 的默认展开/收起状态。二者的区别是，`defaultExpandAll` 只在初始化时生效，而 `expandAll` 不仅会在初始化时生效，当数据(`treeData`/`treeDataSimpleJson`)发生动态更新时，`expandAll` 也仍然生效。

其中，`expandAll` 是从 1.30.0 开始支持的。

在下面的 demo 中，点击按钮更新 `TreeData` 后，`defaultExpandAll` 失效，`expandAll` 仍然生效。

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Tree, Button } from '@douyinfe/semi-ui';
() => {
    const json = {
        "Node1": { 
            "Child Node1": '0-0-1',
            "Child Node2": '0-0-2',
        },
        "Node2": "0-1"
    };
    const json2 = {
        "Node3": {
            "Child Node1": '0-0-1',
            "Child Node2": '0-0-2',
            "Child Node3": '0-0-3',
            "Child Node4": '0-0-4',
        },
        "Node2": "0-1",
    };
    const style = {
        marginRight: 20,
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)',
    };
    const [tree, setTree] = useState(json);
    const handleClick = () => {
        setTree(json2);
    };
    return (
        <>
            <Button onClick={handleClick} style={{ marginBottom: 10 }}>
                点击更新 TreeData
            </Button>
            <div style={{ display: 'flex' }}>
                <div>
                    <span>defaultExpandAll</span>
                    <Tree
                        defaultExpandAll
                        treeDataSimpleJson={tree}
                        style={style}
                    />
                </div>
                <div>
                    <span>expandAll</span>
                    <Tree
                        expandAll
                        treeDataSimpleJson={tree}
                        style={style}
                    />
                </div>
            </div>
        </>
    );
};

```

### 开启搜索的展开受控
传入 `expandedKeys` 时即为展开受控组件，可以配合 `onExpand` 使用。当展开受控时，如果开启 `filterTreeNode` 并进行搜索是不会再自动展开节点的，此时，节点的展开完全由 `expandedKeys` 来控制。你可以利用 `onSearch` 的入参 `filteredExpandedKeys`（version: >= 2.38.0） 来实现展开受控时的搜索展开效果。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
        <Tree
            style={{ width: 300 }}
            treeData={treeData}
            filterTreeNode
            expandedKeys={expandedKeys}
            onExpand={expandedKeys => {
                setExpandedKeys(expandedKeys);
            }}
            onSearch={(inputValue, filteredExpandedKeys) => {
                setExpandedKeys([...filteredExpandedKeys]);
            }}
        />
    );
};
```

### 受控

传入 `value` 时即为受控组件，可以配合 `onChange` 使用。
```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
        const style = {
            width: 260,
            height: 420,
            border: '1px solid var(--semi-color-border)'
        };
        return (
            <Tree
                treeData={treeData}
                value={this.state.value}
                onChange={value => this.onChange(value)}
                style={style}
            />
        );
    }
}
```

### 自动展开父节点

在展开受控的情况下，当开启了 `autoExpandParent` ，如果想要收起父元素，则需要把它的所有子元素均收起后才可以。默认情况下，`autoExpandParent` 为 false，即：父元素收起不受到子元素的影响。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            expandedKeys: ['0', '0-0']
        };
    }
    onExpand(value) {
        this.setState({ expandedKeys: value });
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
        const style = {
            width: 260,
            height: 420,
            border: '1px solid var(--semi-color-border)'
        };
        return (
            <>
                <div>
                    需要先将“中国”节点收起后，才能够收起“亚洲”节点
                </div>
                <br />
                <Tree
                    autoExpandParent
                    treeData={treeData}
                    onExpand={v=>this.onExpand(v)}
                    expandedKeys={this.state.expandedKeys}
                    style={style}
                />
            </>
        );
    }
}
```

### 自定义展开 Icon

可以通过 `expandIcon` 自定义展开 Icon。 支持传入 ReactNode 或者函数。`expandIcon` 自 2.75.0 开始支持。

```ts
expandIcon: ReactNode | ((props: {
    onClick: (e: MouseEvent) => void;
    className: string;
    expanded: boolean;
}))
```

示例如下：

```jsx live=true 
() => {
    const treeData = [
        {
            label: '亚洲',
            key: 'yazhou',
            children: [
                {
                    label: '中国',
                    key: 'zhongguo',
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
                },
            ],
        },
        {
            label: '北美洲',
            key: 'beimeizhou',
        },
    ];
    const expandIconFunc = useCallback((props) => {
        const { expanded, onClick, className } = props;
        if (expanded) {
        return <IconMinus size="small" className={className} onClick={onClick}/>
        } else {
        return <IconPlus size="small" className={className} onClick={onClick}/>
        }
    });
    const style = {
        width: 260,
        height: 200,
        border: '1px solid var(--semi-color-border)'
    };

  return (
    <>
      <p>expandIcon 是  ReactNode</p>
      <Tree
        style={{ width: 300}}
        expandIcon={<IconChevronDown size="small" className='testCls'/>}
        multiple
        defaultExpandedKeys={['yazhou']}
        treeData={treeData}
        style={style}
      />
      <br />
      <p>expandIcon 是函数 </p>
      <Tree
        style={{ width: 300}}
        multiple
        expandIcon={expandIconFunc}
        defaultExpandedKeys={['yazhou']}
        treeData={treeData}
        style={style}
      />
    </>
  );
}
```

### 连接线

通过 `showLine` 设置节点之间的连接线，默认为 false，从 2.50.0 开始支持

```jsx live=true hideInDSM
import React, { useState, useCallback } from 'react';
import { Tree, Switch } from '@douyinfe/semi-ui';

() => {
    const [show, setShow] = useState(true);
    const onChange = useCallback((value) => {
        setShow(value);
    }, []);
    const treeData = useMemo(() => {
        return [
            {
                label: 'parent-0',
                key: 'parent-0',
                children: [
                    {
                        label: 'leaf-0-0',
                        key: 'leaf-0-0',
                        children: [
                            {
                                label: 'leaf-0-0-0',
                                key: 'leaf-0-0-0',
                            },
                            {
                                label: 'leaf-0-0-1',
                                key: 'leaf-0-0-1',
                            },
                            {
                                label: 'leaf-0-0-2',
                                key: 'leaf-0-0-2',
                            },
                        ]
                    },
                    {
                        label: 'leaf-0-1',
                        key: 'leaf-0-1',
                    }
                ]
            },
            {
                label: 'parent-1',
                key: 'parent-1',
            }
        ];
    }, []);

    const style = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', columnGap: 5, marginBottom: 5 }}>
                <strong>showLine </strong>
                <Switch checked={show} onChange={onChange} />
            </div>
            <Tree
                showLine={show}
                defaultExpandAll
                treeData={treeData}
                style={style}
            />
        </>
    );
};
```

### 虚拟化
列表虚拟化，用于大量树节点的情况。开启后，动画效果将被关闭。

`virtualize` 是一个包含下列值的对象： 
- height: 高度值，如果为 string 必须有计算高度才能被渲染出来，即其父节点有 offsetHeight
- width: 宽度值，默认 100%
- itemSize: 每行的treeNode的高度，必传

如果带搜索框，建议开启 `showFilteredOnly` 减少多余节点的渲染。

```jsx live=true hideInDSM
import React from 'react';
import { Tree, Button } from '@douyinfe/semi-ui';

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
            border: '1px solid var(--semi-color-border)'
        };
        return (
            <div style={{ padding: '0 20px' }}>
                <Button onClick={this.onGen}>生成数据: </Button>
                <span>共 {this.state.total} 个节点</span>
                <br />
                <br />
                {this.state.gData.length ? (
                    <Tree
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
```

### 动态更新数据

```jsx live=true hideInDSM
import React from 'react';
import { Tree, Button } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            treeData: [{
                key: '0',
                label: 'item-0',
                value: '0'
            }],
        };
        this.add = this.add.bind(this);
    }
    add() {
        const itemLength = Math.floor(Math.random() * 5) + 1;
        const treeData = new Array(itemLength).fill(0).map((v, i) => {
            const length = Math.floor(Math.random() * 3);
            const children = new Array(length).fill(0).map((cv, ci) => {
                const child = {
                    key: `${i}-${ci}`,
                    label: `Leaf-${i}-${ci}`,
                    value: `${i}-${ci}`
                };
                return child;
            });
            const item = {
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
        const { treeData } = this.state;
        const style = {
            width: 260,
            height: 420,
            border: '1px solid var(--semi-color-border)'
        };
        return (
            <div style={style}>
                <Tree
                    treeData={treeData}
                />
                <br />
                <Button onClick={this.add} style={{ margin: 20 }}>
                    动态改变数据
                </Button>
            </div>
        );
    }
}
```

### 异步加载数据
通过设置 loadData 可以动态加载数据，此时需要在数据中传入 isLeaf 标明叶子节点。

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Tree } from '@douyinfe/semi-ui';

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
        <Tree
            loadData={onLoadData}
            treeData={[...treeData]}
        />
    );
};
```

### 可拖拽的Tree

通过设置 draggable 配合 onDrop 可以实现 Tree 节点的拖拽。

<Notice title='注意'>
    拖拽功能于 v 1.8.0 后开始提供。目前不支持与虚拟化同时使用
</Notice>

拖拽事件的回调入参如下：
```
- onDragEnd: function({ event, node: DragTreeNode })
- onDragEnter:function({ event, node: DragTreeNode, expandedKeys: string[] })
- onDragLeave:function({ event, node: DragTreeNode })
- onDragOver:function({ event, node: DragTreeNode })
- onDragStart: function({ event, node: DragTreeNode })
- onDrop:function({ event, node: DragTreeNode, dragNode: DragTreeNode, dragNodesKeys: string[], dropPosition: number, dropToGap: Boolean })
```

数据类型 DragTreeNode，除了包含 TreeNodeData 所有属性外，还包含 expanded 和 pos 属性，
```
DragTreeNode {
    expanded: Boolean,
    pos: string
    value?: string | number;
    label?: React.ReactNode;
    disabled?: boolean;
    isLeaf?: boolean;
    [key: string]: any;
}
```
- `pos` 指的是当前节点在整个 treeData 中的位置关系，如第0层第1个节点的第2个节点的第0个节点：'0-1-2-0'
- `dropPosition` 指的是被拖拽节点在当前层级中被 drop 的位置，如插入在同级的第0个节点前则为 -1，在第0个节点后则为 1，落在其上则为 0，以此类推。配合 dropToGap 可以得到更完整的判断。
- `dropToGap` 指的是被拖拽节点是否被 drop 在节点之间的位置，如果为 false 则是 drop 在某个节点上方


```jsx live=true hideInDSM
import React, { useState } from 'react';
import { Tree } from '@douyinfe/semi-ui';

() => {
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
        },
        {
            label: 'Europe',
            value: 'Europe',
            key: '2',
        }
    ];
    const [treeData, setTreeData] = useState(initialData);

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
            // insert to the top 
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

    return <Tree
        treeData={treeData}
        draggable
        onDrop={onDrop}
    />;
};
```

### 高级定制
**版本 v>=1.7.0**

Tree 组件的 api 支持了大部分的渲染需求，但是如果有非常特殊的定制要求的话，可以使用 `renderFullLabel` 来接管整行 option 的渲染效果。

renderFullLabel 参数类型如下：

```ts
type RenderFullLabelProps = {
    /* 节点数据 */
    data: BasicTreeNodeData;
    /* 层级 */
    level: number;
    /* 虚拟化情况下，该 style 必须给到 DOM 节点上*/
    style: any;
     /* 样式类名，包括内置样式，如缩进、展开按钮、过滤器、禁用、选择等。 */
    className: string;
    /* 展开按钮 */
    expandIcon: any;
    /* 选中状态 */
    checkStatus: {
        /* 是否选中 */
        checked: boolean;
        /* 是否半选 */
        halfChecked: boolean
    };
    /* 展开状态 */
    expandStatus: {
        /* 是否展开 */
        expanded: boolean;
        /* 是否加载中 */
        loading: boolean
    };
    /* 该节点是否符合筛选条件 */
    filtered: boolean | undefined;
    /* 当前搜索框输入值 */
    searchWord: string | undefined;
    /* 点击回调 */
    onClick: (e: MouseEvent) => void;
    /* 多选点击回调 */
    onCheck: (e: MouseEvent) => void;
    /* 右键点击回调 */
    onContextMenu: (e: MouseEvent) => void; 
    /* 二次点击回调 */
    onDoubleClick: (e: MouseEvent) => void;
    /* 展开回调 */
    onExpand: (e: MouseEvent) => void;
}
```

<Notice type="primary" title="注意事项">
<div>如果开启了虚拟化，需要将 style （虚拟化相关样式）赋予给渲染的 DOM 节点</div>
</Notice>

这里给几个常见的高级用法的 demo。

第一个是针对 “希望只有叶子节点可以选中，父节点只起到分组作用” 的场景。  
- 你只需要渲染叶子节点前的 Checkbox，并且点击父节点时不触发选中，点击叶子节点触发。
- 同时开启 leafOnly 可以使 onChange 的回调入参都是叶子节点。  
⚠️：renderFullLabel 只接管了渲染效果，并不影响内部的数据逻辑。但是你可以选取需要的逻辑进行渲染，或者配合受控来实现更复杂的需求。
```jsx live=true
import React from 'react';
import { Tree, Checkbox } from '@douyinfe/semi-ui';

() => {
    const renderLabel = ({
        className,
        onExpand,
        data,
        onCheck,
        checkStatus,
        expandIcon,
    }) => {
        const { label } = data;
        const isLeaf = !(data.children && data.children.length);
        return (
            <li
                className={className}
                role="treeitem"
                onClick={isLeaf ? onCheck : onExpand}
            >
                {isLeaf ? null : expandIcon}
                {isLeaf ? <div onClick={onCheck} role='checkbox' tabIndex={0} aria-checked={checkStatus.checked}>
                    <Checkbox
                        indeterminate={checkStatus.halfChecked}
                        checked={checkStatus.checked}
                        style={{ marginRight: 8 }}
                    />
                </div> : null}
                <span>{label}</span>
            </li>
        );
    };

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

    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            renderFullLabel={renderLabel}
            multiple
            leafOnly
            style={treeStyle}
        />
    );
};
```

第二个是针对 “希望只有叶子节点可以单选，父节点只起到分组作用” 的场景。  
- 你只需要点击父节点时不触发选中，点击叶子节点触发。

```jsx live=true
import React from 'react';
import { Tree } from '@douyinfe/semi-ui';

() => {
    const renderLabel = ({
        className,
        onExpand,
        onClick,
        data,
        expandIcon,
    }) => {
        const { label } = data;
        const isLeaf = !(data.children && data.children.length);
        return (
            <li
                className={className}
                role="treeitem"
                onClick={isLeaf ? onClick : onExpand}
            >
                {expandIcon}
                <span>{label}</span>
            </li>
        );
    };

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

    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };
    return (
        <Tree
            treeData={treeData}
            renderFullLabel={renderLabel}
            style={treeStyle}
            onChange={(...args) => console.log('change', ...args)}
        />
    );
};
```

第三个是针对 “单选选中父节点同时也高亮子节点” 的场景。
```jsx live=true
import React, { useState } from 'react';
import { Tree } from '@douyinfe/semi-ui';
import { IconFixedStroked, IconSectionStroked, IconAbsoluteStroked, IconInnerSectionStroked, IconComponentStroked } from '@douyinfe/semi-icons';

() => {
    const [selected, setSelected] = useState(new Set());
    const [selectedThroughParent, setSelectedThroughParent] = useState(new Set());
    const treeData = [
        {
            label: '黑色固定按钮',
            icon: <IconFixedStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            key: 'fix-btn-0'
        },
        {
            label: '模块',
            key: 'module-0',
            icon: <IconSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            children: [
                {
                    label: '可自由摆放的组件',
                    icon: <IconAbsoluteStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'free-compo-0',
                },
                {
                    label: '分栏容器',
                    icon: <IconInnerSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'split-col-0',
                    children: [
                        {
                            label: '按钮组件',
                            icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                            key: 'btn-0'
                        },
                        {
                            label: '按钮组件',
                            icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                            key: 'btn-1'
                        }
                    ]
                },
            ],
        },
        {
            label: '模块',
            icon: <IconSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            key: 'module-1',
            children: [
                {
                    label: '自定义组件',
                    icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'cus-0'
                }
            ]
        }
    ];
    const findDescendantKeys = (node) => {
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
    const renderLabel = ({
        className,
        data,
        onClick,
        expandIcon
    }) => {
        const { label, icon, key } = data;
        const isLeaf = !(data.children && data.children.length);
        const style = {
            backgroundColor: selected.has(key)
                ? 'rgba(var(--semi-blue-0), 1)'
                : selectedThroughParent.has(key)
                    ? 'rgba(var(--semi-blue-0), .5)' : 'transparent'
        };
        return (
            <li
                className={className}
                role="treeitem"
                onClick={onClick}
                style={style}
            >
                {isLeaf ? <span style={{ width: 24 }}></span> : expandIcon}
                {icon}
                <span>{label}</span>
            </li>
        );
    };

    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };

    return (
        <Tree
            treeData={treeData}
            renderFullLabel={renderLabel}
            onSelect={handleSelect}
            style={treeStyle}
            defaultExpandAll
        />
    );
};
```

### 可拖拽的高级定制

我们从 1.27.0 版本开始支持可拖拽（`draggable`）和高级定制（`renderFullLabel`）同时使用，在该版本之前，并不支持二者同时使用。

```jsx live=true
import React, { useState } from 'react';
import { Tree } from '@douyinfe/semi-ui';
import { IconFixedStroked, IconSectionStroked, IconAbsoluteStroked, IconInnerSectionStroked, IconComponentStroked } from '@douyinfe/semi-icons';

() => {
    const [selected, setSelected] = useState(new Set());
    const [selectedThroughParent, setSelectedThroughParent] = useState(new Set());
    const defaultTreeData = [
        {
            label: '黑色固定按钮',
            icon: <IconFixedStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            key: 'fix-btn-0'
        },
        {
            label: '模块',
            key: 'module-0',
            icon: <IconSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            children: [
                {
                    label: '可自由摆放的组件',
                    icon: <IconAbsoluteStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'free-compo-0',
                },
                {
                    label: '分栏容器',
                    icon: <IconSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'split-col-0',
                    children: [
                        {
                            label: '按钮组件',
                            icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                            key: 'btn-0'
                        },
                        {
                            label: '按钮组件',
                            icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                            key: 'btn-1'
                        }
                    ]
                },
            ],
        },
        {
            label: '模块',
            icon: <IconSectionStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
            key: 'module-1',
            children: [
                {
                    label: '自定义组件',
                    icon: <IconComponentStroked style={{ marginRight: 8, color: 'var(--semi-color-text-2)' }} />,
                    key: 'cus-0'
                }
            ]
        }
    ];
    const [treeData, setTreeData] = useState(defaultTreeData);

    const onDrop = (info) => {
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

    const findDescendantKeys = (node) => {
        const res = [node.key];
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

    const renderLabel = ({
        className,
        data,
        onClick,
        expandIcon
    }) => {
        const { label, icon, key } = data;
        const isLeaf = !(data.children && data.children.length);
        const style = {
            backgroundColor: selected.has(key)
                ? 'rgba(var(--semi-blue-0), 1)'
                : selectedThroughParent.has(key)
                    ? 'rgba(var(--semi-blue-0), .5)' : 'transparent'
        };
        return (
            <li
                className={className}
                role="treeitem"
                onClick={onClick}
                style={style}
            >
                {isLeaf ? <span style={{ width: 24 }}></span> : expandIcon}
                {icon}
                <span>{label}</span>
            </li>
        );
    };

    const treeStyle = {
        width: 260,
        height: 420,
        border: '1px solid var(--semi-color-border)'
    };


    return <Tree
        treeData={treeData}
        draggable
        onDrop={onDrop}
        renderFullLabel={renderLabel}
        onSelect={handleSelect}
        style={treeStyle}
        defaultExpandAll
    />;
};
```


## API参考

### Tree

| 属性            | 说明         | 类型           | 默认值          |版本          |
|-------------   | ----------- | -------------- | -------------- | --------|
| autoExpandParent | 是否自动展开父节点，默认为 false，当组件初次挂载时为 true | boolean | false | 0.34.0 |
| autoExpandWhenDragEnter | 是否允许拖拽到节点上时自动展开改节点 | boolean | true | 1.8.0 | 
| autoMergeValue | 设置自动合并 value。具体而言是，开启后，当某个父节点被选中时，value 将不包括该节点的子孙节点。（在leafOnly为false的情况下生效）| boolean | true | 2.61.0 | 
| blockNode | 行显示节点 | boolean | true | - |
| checkRelation | 多选时，节点之间选中状态的关系，可选：'related'、'unRelated' | string | 'related' | 2.5.0 |
| className | 类名 | string | - | - |
| defaultExpandAll | 设置在初始化时是否展开所有节点。而如果后续数据(`treeData`/`treeDataSimpleJson`)发生改变，这个 api 是无法影响节点的默认展开情况的，如果有这个需要可以使用 `expandAll` | boolean | false | - |
| defaultExpandedKeys | 默认展开的节点，显示其直接子级 | string\[] | - | - |
| defaultValue | 指定默认选中的条目 | string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[] | - | - |
| directory | 目录树模式 | boolean | false | - |
| disableStrictly | 当节点的disabled状态确定时，不可通过子级或者父级的关系选中 | boolean | false | 1.4.0 | 
| disabled | 禁用整个树，不可选择 | boolean | false | 0.32.0 |
| draggable | 是否允许拖拽 | boolean | false | 1.8.0 | 
| emptyContent | 当搜索无结果时展示的内容 | ReactNode | `暂无数据` | 0.32.0 |
| expandAction             | 展开逻辑，可选 false, 'click', 'doubleClick'。默认值为 false，即仅当点击展开按钮时才会展开  | boolean \| string   | false | 0.35.0       |
| expandAll | 设置是否默认展开所有节点，若后续数据(`treeData`/`treeDataSimpleJson`)发生改变，默认展开情况也是会受到这个 api 影响的 | boolean | false | 1.30.0 |
| expandedKeys | （受控）展开的节点，默认展开节点显示其直接子级 | string[] | - | - |
| expandIcon | 自定义展开图标 | ReactNode \| (props: expandProps)=>ReactNode | - | 2.75.0 |
| keyMaps | 自定义节点中 key、label、value 的字段。如果 keyMaps 中设置 label 的自定义名称并且开启了搜索，为保证搜索正确，需要将 treeNodeFilterProp 设置为 treeData 的键之一或者通过 filterTreeNode 自定义搜索函数 | object |  - | 2.47.0 |
| filterTreeNode | 是否根据输入项进行筛选，默认用 `treeNodeFilterProp` 的值作为要筛选的 `TreeNodeData` 的属性值,  data 参数自 v2.28.0 开始提供 | boolean \| ((inputValue: string, treeNodeString: string, data?: TreeNodeData) => boolean) | false | - |
| hideDraggingNode | 是否隐藏正在拖拽的节点的 dragImg | boolean | false | 1.8.0 | 
| icon | 自定义图标 | ReactNode \| (props: TreeNodeProps)=>ReactNode | - | - |
| labelEllipsis | 是否开启label的超出省略，默认虚拟化状态开启，如果有其他省略需求可以设置关闭 | boolean | false\|true(virtualized) | 1.8.0 |
| leafOnly | 多选模式下是否开启 onChange 回调入参及展示标签只有叶子节点 | boolean | false | 1.18.0 |  
| loadData | 异步加载数据，需要返回一个Promise | (treeNode?: TreeNodeData) => Promise< void > |- |  1.0.0|
| loadedKeys | （受控）已经加载的节点，配合 loadData 使用 | string[] | - | 1.0.0|
| motion | 是否开启动画 | boolean | true | - |
| multiple | 是否支持多选 | boolean | false | - |
| preventScroll | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法 | boolean |  |  |
| renderDraggingNode | 自定义正在拖拽节点的 dragImg 的 Html 元素 | (nodeInstance: HTMLElement, node: TreeNodeData) => HTMLElement | - | 1.8.0 | 
| renderFullLabel | 完全自定义label的渲染函数 | (data: object) => ReactNode | - | 1.7.0 | 
| renderLabel | 自定义label的渲染函数, searchWord 参数自 2.65.0 开始支持 | <ApiType detail='(label: ReactNode, data: TreeNodeData, searchWord: string) => ReactNode'>(label, data, searchWord) => ReactNode</ApiType> |- |  1.6.0 | 
| searchClassName | 搜索框的 `className` 属性 | string | - | - |
| searchPlaceholder | 搜索框默认文字 | string | - | - |
| searchRender | 自定义搜索框的渲染方法，为 false 时可以隐藏组件的搜索框(**V>=1.0.0**) | ((searchRenderProps: object) => ReactNode) \| false | - | 0.35.0 |
| searchStyle | 搜索框的样式 | CSSProperties | - | - |
| showClear | 支持清除搜索框 | boolean | true | 0.35.0 |
| showFilteredOnly | 搜索状态下是否只展示过滤后的结果 | boolean | false | 0.32.0 |
| showLine | 显示连接线 | boolean | false | 2.50.0 |
| style | 样式  | CSSProperties | - | - |
| treeData | treeNodes 数据，如果设置则不需要手动构造 TreeNode 节点（key值在整个树范围内唯一） | TreeNodeData[] | \[] | - |
| treeDataSimpleJson | 简单 JSON 形式的 `TreeNodeData` 数据，如果设置则不需要手动构造 TreeNode 节点，返回值为包含选中节点的Json数据 | TreeDataSimpleJson | \{} | - |
| treeNodeFilterProp | 搜索时输入项过滤对应的 `TreeNodeData` 属性 | string | `label` | - |
| value | 当前选中的节点的value值，传入该值时将作为受控组件 | string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[] | - | - |
| virtualize | 列表虚拟化，用于大量树节点的情况，由 height, width, itemSize 组成，参考 Virtualize Object。开启后将关闭动画效果。 | VirtualizeObj | - | 0.32.0 |
| onChange | 选中树节点时调用此函数，默认返回值为当前所有选中项的value值 | (value?: string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[]) => void | - | - |
| onChangeWithObject | 是否将选中项 option 的其他属性作为回调。设为 true 时，onChange 的入参类型会从 string 变为 object: { value, label, ...rest }。此时如果是受控，也需要把 value 设置成 object，且必须含有 value 的键值；defaultValue同理。 | boolean | false | - |
| onDoubleClick | 双击事件的回调 | (e: MouseEvent, node: TreeNodeData) => void | - | 0.35.0 |
| onDragEnd | onDragEnd 事件回调 | (dragProps: object) => void | - | 1.8.0 | 
| onDragEnter | onDragEnter 事件回调 | (dragEnterProps: object) => void | - | 1.8.0 | 
| onDragLeave | onDragLeave 事件回调 | (dragProps: object) => void | - | 1.8.0 | 
| onDragOver | onDragOver 事件回调 | (dragProps: object) => void | - | 1.8.0 | 
| onDragStart | onDragStart 事件回调 | (dragProps: object) => void | - | 1.8.0 | 
| onDrop | onDrop 事件回调 | (onDragProps: object) => void | - | 1.8.0 | 
| onExpand | 展示节点时调用 | (expandedKeys: string[], {expanded: boolean, node: TreeNodeData}) => void | - | - |
| onLoad | 节点加载完毕时触发的回调 | (loadedKeys: Set<string/>, treeNode: TreeNodeData) => void |- |  1.0.0|
| onContextMenu | 右键点击的回调 | (e: MouseEvent, node: TreeNodeData) => void | - | 0.35.0 |
| onSearch | 文本框值变化时回调, 入参 filteredExpandedKeys 表示因为搜索或 value / defaultValue 而展开的节点的 key, <br/>可以配合 expandedKeys 受控时使用。filteredExpandedKeys 在 2.38.0 中新增 | (sunInput: string, filteredExpandedKeys: string[]) => void | - | - |
| onSelect | 被选中时调用，返回值为当前事件选项的key值 | (selectedKey:string, selected: bool, selectedNode: TreeNodeData) => void | - | - |

### TreeNodeData

> __不同 `TreeNodeData` 的 key 值要求必填且唯一。__`label` 允许重复。**v>=1.7.0** 之前 value 值要求必须必填且唯一。
> **v>=1.7.0** 之后 value 值非必填。此时 onChange, value, defaultValue 及 onChangeWithObject 中所取的 value 属性值将改为 key 值。
> 为了保证行为的符合预期，treeData 中的 value 值或者全部不填写，或者全部填写且唯一，不建议混写。

| 属性            | 说明         | 类型           | 默认值          |
|-------------   | ----------- | -------------- | -------------- |
| value | 属性值 | string\|number | - |
| label | 展示的文本 | string\|ReactNode | - |
| icon | 自定义图标 | ReactNode | - |
| disabled | 是否禁用 | boolean | false |
| key | required且要求唯一 | string | - |
| isLeaf | 设置节点为叶子节点，在异步加载数据的情况即传入 loadData 时有效 **v>=1.0.0**| boolean | - |

### Virtualize Object

> `itemSize` 必传。

| 属性            | 说明         | 类型           | 默认值          |
|------------- | ----------- | -------------- | -------------- |
| height | 高度值，如果为 string 必须保证有计算高度，即其父节点有 offsetHeight | number\|string | '100%' |
| itemSize | 每行的treeNode的高度，必传 | number | - |
| width | 宽度值 | number\|string | '100%' |

## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

|名称 | 描述 | 类型 | 版本  |
|----|----|----|----|
| search | 手动触发搜索 | (value: string) => void |-|
| scrollTo | 在虚拟化 Tree 中，使得指定节点（该节点为当前树的已展开节点）滚动到视图 | （{key: string; align?: 'center' \| 'start' \| 'end' \| 'smart' \| 'auto';}) => void | 2.18.0 |
## Accessibility

### ARIA

- Tree 支持传入 `aria-label` 来表示该 Tree 作用;
- Tree 会自动为每个子节点分别设置 `aria-disabled`、`aria-checked`、`aria-selected`、`aria-level` 来表明节点状态及层级;
- Tree 会自动为对应部分分别设置 `role` 为 `tree`、`treeitem`。

示例:
```typescript
    <Tree
        /* other attributes */
        aria-label='example tree'
    />
```

## 文案规范
- 尽量使用短语，首字母大写
- 平级之间保持用语形式一致，例如全是地名或者是国家名

## 设计变量
<DesignToken/>
