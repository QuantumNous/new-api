---
localeCode: zh-CN
order: 35
category: 输入类
title:  Cascader 级联选择
icon: doc-cascader
brief: 用于选择多级分类下的某个选项。
---

## 使用场景

与 TreeSelect 组件的区别:

- TreeSelect: 核心价值在于**目标节点**，层级结构是为了方便用户快速筛选出目标选项，最终的节点才是用户想要的内容，常见于文件/文件夹选择、组织架构、权限分配等场景。
- Cascader: 核心价值在于**路径**，用户选择的不是一个孤立的点，而是一条从根到叶的完整路径，常用于地理位置，商品分类等场景。

## 代码演示


### 如何引入

```jsx import
import { Cascader } from '@douyinfe/semi-ui';
```

### 基本用法

最简单的用法，默认只可以选叶子节点。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
        />
    );
};
```

### 多选

version: >= 1.28.0

设置 `multiple`，可以进行多选。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            multiple
        />
    );
};
```

### 可搜索的

通过设置 `filterTreeNode` 属性可支持搜索功能。

默认对 `label` 值进行搜索（使用字符串的 includes 方法进行匹配，不区分大小写），可通过 `treeNodeFilterProp` 指定其他属性值进行搜索。
如 `label` 为 ReactNode，可在 treeData 中使用其他字段存储纯文本，并通过 `treeNodeFilterProp` 指定该字段进行搜索。

默认搜索结果只会展示叶子结点的路径，想要显示更多的结果，可以设置 `filterLeafOnly` 为 `false`。

```jsx live=true
import React, { useState } from 'react';
import { Cascader, Typography } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    const labelNodeTreeData = [
        {
            label: <Tooltip content="说明">浙江省</Tooltip>,
            labelText: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: <Tooltip content="说明">杭州市</Tooltip>,
                    labelText: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: <Tooltip content="说明">西湖区</Tooltip>,
                            labelText: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: <Tooltip content="说明">萧山区</Tooltip>,
                            labelText: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: <Tooltip content="说明">临安区</Tooltip>,
                            labelText: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: <Tooltip content="说明">宁波市</Tooltip>,
                    labelText: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: <Tooltip content="说明">海曙区</Tooltip>,
                            labelText: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: <Tooltip content="说明">江北区</Tooltip>,
                            labelText: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];

    return (
        <div>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="默认对label值进行搜索"
                filterTreeNode
            />
            <br/>
            <br/>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="对value值进行搜索"
                filterTreeNode
                treeNodeFilterProp='value'
            />
            <br/>
            <br/>
            <Typography.Title heading={6}>filterLeafOnly=false:</Typography.Title>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="filterLeafOnly=false"
                filterTreeNode
                filterLeafOnly={false}
            />
            <br/>
            <br/>
            <Typography.Title heading={6}>Label 为 ReactNode，指定其他属性进行搜索</Typography.Title>
            <Cascader
                style={{ width: 300 }}
                treeData={labelNodeTreeData}
                placeholder="Search for labelText"
                filterTreeNode
                treeNodeFilterProp='labelText'
            />
        </div>
    );
};
```



### 可搜索的多选

支持多选和搜索同时使用（version >= v1.28.0)，在这种场景下，可以通过按下 BackSpace 键来删除对应的已选项目。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const [value, setValue] = useState(['zhejiang', 'ningbo', 'haishu']);
    const onChange = (val) => { setValue(val); };
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            value={value}
            multiple
            filterTreeNode
            onChange={e => onChange(e)}
        />
    );
};
```

可以使用 `filterSorter` 对筛选后的数据进行排序， `filterSorter` 于 v2.28.0 开始提供。

```jsx live=true
import React, { useState } from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: 'Product',
            value: 'Product',
            children: [
                {
                    label: 'Semi-Material',
                    value: 'Semi-Material',
                    
                },
                {
                    label: 'Semi-DSM',
                    value: 'Semi-DSM',
                    
                },
                {
                    label: 'Semi',
                    value: 'Semi',
                    
                },
                {
                    label: 'Semi-C2D',
                    value: 'Semi-C2D',
                },
                {
                    label: 'Semi-D2C',
                    value: 'Semi-D2C',
                },
            ],
        }
    ];
    return (
        <div>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="输入 s 查看排序效果"
                filterTreeNode
                filterSorter={(first, second, inputValue) => {
                    const firstData = first[first.length - 1];
                    const lastData = second[second.length - 1];
                    if (firstData.label === inputValue) {
                        return -1;
                    } else if (lastData.label === inputValue) {
                        return 1;
                    } else {
                        return firstData.label < lastData.label ? -1 : 1;
                    }
                }}
            />
        </div>
    );
};
```

如果想要自定义渲染搜索后的选项，可以使用 `filterRender` 实现整行的自定义渲染，`filterRender` 于 v2.28.0 开始提供，函数参数如下：

``` tsx
interface FilterRenderProps {
    className: string;
    inputValue: string;     // 搜索栏搜索内容
    disabled: boolean;      // 是否禁用
    data: CascaderData[];   // 搜索结果数据
    selected: boolean;      // 单选时的选中状态  
    checkStatus:  {         // 多选时的选中状态
        checked: boolean;
        halfChecked: boolean;
    };
    onClick: (e: React.MouseEvent) => void;  // 单选点击选中回调
    onCheck: (e: React.MouseEvent) => void; // 多选点击选中回调
 }
```

使用示例如下

```jsx live=true
import React, { useState } from 'react';
import { Cascader, Typography, Checkbox } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: 'Semi',
            value: 'Semi',
            children: [
                {
                    label: 'Semi-Material Semi-Material Semi-Material Semi-Material',
                    value: 'Semi-Material',
                    
                },
                {
                    label: 'Semi-DSM Semi-DSM Semi-DSM Semi-DSM',
                    value: 'Semi-DSM',
                    
                },
                {
                    label: 'Semi Design Semi Design Semi Design Semi Design',
                    value: 'Semi',
                    
                },
                {
                    label: 'Semi-C2D Semi-C2D Semi-C2D Semi-C2D Semi-C2D',
                    value: 'Semi-C2D',
                },
                {
                    label: 'Semi-D2C Semi-D2C Semi-D2C Semi-D2C Semi-D2C ',
                    value: 'Semi-D2C',
                },
            ],
        }
    ];
    const { Text } = Typography;

    const renderSearchOptionSingle = (props) => {
        const { className, data, selected, onClick } = props;

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
                className={className}
                style={{ justifyContent: 'flex-start' }}
                role="treeitem"
                onClick={onClick}
            > 
                <Text 
                    ellipsis={{ showTooltip: { opts: { style: { wordBreak: 'break-all' } } } }} 
                    style={{ width: 270, color: selected ? 'var(--semi-color-primary)': undefined }}
                >
                    {data.map(item => item.label ).join(' / ')}
                </Text>
            </li>
        );
    };

    const renderSearchOptionMultiple = (props) => {
        const { className, data, checkStatus, onCheck } = props;

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
                className={className}
                style={{ justifyContent: 'flex-start' }}
                role="treeitem"
                onClick={onCheck}
            > 
                <Checkbox
                    onChange={onCheck}
                    indeterminate={checkStatus.halfChecked}
                    checked={checkStatus.checked}
                    style={{ marginRight: 8 }}
                />
                <Text 
                    ellipsis={{ showTooltip: { opts: { style: { wordBreak: 'break-all' } } } }} 
                    style={{ width: 250 }}
                >
                    {data.map(item => item.label).join(' / ')}
                </Text>
            </li>
        );
    };
    
    return (
        <div>
            <p>鼠标 hover 到选项可查看被省略文本完整内容</p>
            <br />
            <Cascader
                style={{ width: 320 }}
                treeData={treeData}
                placeholder="单选，输入 s 自定义搜索选项渲染结果"
                filterTreeNode
                filterRender={renderSearchOptionSingle}
            />
            <br />
            <Cascader
                multiple
                style={{ width: 320, marginTop: 20 }}
                treeData={treeData}
                placeholder="多选，输入 s 自定义搜索选项渲染结果"
                filterTreeNode
                filterRender={renderSearchOptionMultiple}
            />
        </div>
    );
};

```

如果搜索结果中存在大量 Option，可以通过设置 virtualizeInSearch 开启搜索结果面板的虚拟化来优化性能，virtualizeInSearch 自 v2.44.0 提供。virtualizeInSearch 是一个包含下列值的对象：

- height: Option 列表高度值
- width: Option 列表宽度值
- itemSize: 每行 Option 的高度

```jsx live=true
import React from 'react';
import { Cascader, Checkbox, Typography } from '@douyinfe/semi-ui';

() => {
    const treeData = useMemo(() => (
        ['通用', '场景'].map((label, m) => ({
            label: label,
            value: m,
            children: new Array(100).fill(0).map((item, n)=> ({
                value: `${m}-${n}`,
                label: `${m}-${n} 第二级`,
                children: new Array(20).fill(0).map((item, o)=> ({
                    value: `${m}-${n}-${o}`,
                    label: `${m}-${n}-${o} 第三级详细内容`,
                })),
            }))
        }))
    ), []);
    
    let virtualize = {
        // 高度为面板默认高度为 180px 减去上下padding 2 * 8px
        height: 172,
        width: 320,
        itemSize: 36, 
    };

    const filterRender = useCallback((props) => {
        const { data, onCheck, checkStatus, className } = props;
        return (
            <div 
                key={data.value}
                className={className}
                style={{ justifyContent: 'start', padding: '8px 16px 8px 12px', boxSizing: 'border-box' }}
            >
                <Checkbox
                    onChange={onCheck}
                    indeterminate={checkStatus.halfChecked}
                    checked={checkStatus.checked}
                    style={{ marginRight: 8 }}
                />
                <Typography.Text
                    ellipsis={{ showTooltip: { opts: { style: { wordBreak: 'break-all' } } } }}
                    style={{ maxWidth: 260 }}
                >
                    {data.map(item => item.label).join(' | ')}
                </Typography.Text>
            </div>
        );
    }, []);
     
    return (
        <Cascader
            multiple
            filterTreeNode
            style={{ width: 320 }}
            treeData={treeData}
            placeholder="输入 通用 or 场景 进行搜索"
            virtualizeInSearch={virtualize}
            filterRender={filterRender}
        />
    );
};
```

### 限制标签展示数量

version: >= 1.28.0

在多选的场景中，利用 maxTagCount 可以限制展示的标签数量，超出部分将以 +N 的方式展示。

使用 showRestTagsPopover 可以设置在超出 maxTagCount 后，hover +N 是否显示 Popover，默认为 false。并且，还可以在 restTagsPopoverProps 属性中配置 Popover。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            multiple
            showRestTagsPopover={true}
            restTagsPopoverProps={{ position: 'top' }}
            maxTagCount={1}
            defaultValue={[
                ['zhejiang', 'ningbo', 'haishu'],
                ['zhejiang', 'hangzhou', 'xihu']
            ]}
        />
    );
};
```

### 限制选中数量

version: >= 1.28.0

在多选的场景中，利用 max 可以限制多选选中的数量。超出 max 后将触发 onExceed 回调。

```jsx live=true
import React from 'react';
import { Cascader, Toast } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            multiple
            max={1}
            onExceed={v=>{
                Toast.warning('exceed max');
                console.log(v);
            }}
            defaultValue={['zhejiang', 'ningbo', 'haishu']}
        />
    );
};
```

### 选择即改变

在单选的情况下，还可以通过设置 `changeOnSelect`，允许选中父级选项。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <div>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                changeOnSelect
                placeholder="选择即改变"
            />
            <br/>
            <br/>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                changeOnSelect
                placeholder="可搜索的选择即改变"
                filterTreeNode
            />
        </div>
    );
};
```

### 自定义显示

可以通过 `displayProp` 设置回填选项显示的属性值，默认为 `label`。

```jsx live=true
import React from 'react';
import { Cascader, Typography } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <>
            <Typography.Title heading={6}>单选</Typography.Title>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="回填时显示数据的value值"
                displayProp='value'
                defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
            />
            <br />
            <br />
            <Typography.Title heading={6}>多选</Typography.Title>
            <Cascader
                multiple
                style={{ width: 300 }}
                treeData={treeData}
                defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
                placeholder="回填时显示数据的value值"
                displayProp='value'
            />
        </>
    );
};
```

可以通过设置 `displayRender` 可以设定返回格式。

单选 (`multiple=false`) 时, `displayRender((labelPath: string[]) => ReactNode)`, 其中 labelPath 是由 label 构成的 path 数组。

多选 (`multiple=true`) 时, `displayRender((item: Entity, index: number) => ReactNode)`, 其中 item 为节点的相关数据。

```typescript
interface Entity {
    children?: Entity[];         // children list
    data: CascaderData;              // treedata
    ind: number;                 // index
    key: string;                 // key
    level: number;               // node level
    parent?: Entity;             // parent data
    parentKey?: string;          // parent key
    path: string[];              // key path
    valuePath: string[];         // value path
}
```

```jsx live=true
import React from 'react';
import { Cascader, Tag, Typography } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <>
            <Typography.Title heading={6}>单选</Typography.Title>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="自定义回填时显示数据的格式"
                displayRender={list => '已选择：' + list.join(' -> ')}
                defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
            />
            <br />
            <br />
            <Typography.Title heading={6}>多选</Typography.Title>
            <Cascader
                multiple
                style={{ width: 300 }}
                treeData={treeData}
                defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
                placeholder="自定义回填时显示数据的格式"
                displayRender={(item, idx) => (
                    <Tag
                        style={{ marginRight: 4 }}
                        color='white'
                        key={`${idx}-${item.data.label}`}
                    >
                        {item.data.label}
                    </Tag>
                )}
            />
        </>
    );
};
```

### 自定义分隔符

版本: >=2.2.0

可以使用 `separator` 设置分隔符, 包括：搜索时显示在下拉框的内容以及单选时回显到 Trigger 的内容的分隔符。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
            filterTreeNode
            separator=' > '
        />
    );
};
```

### 禁用

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                }
            ],
        }
    ];
    return (
        <div>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="请选择所在地区"
                disabled
            />
            <br />
            <br />
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="请选择所在地区"
                defaultValue={['zhejiang', 'hangzhou', 'xihu']}
                filterTreeNode
                disabled
            />
        </div>
    );
};
```

### 严格禁用

version: >= 1.32.0

可以使用 disableStrictly 来开启严格禁用。开启严格禁用后，当节点是 disabled 的时候，则不能通过子级或者父级的关系改变选中状态。

以下面的 demo 为例，节点"宁波"开启了严格禁用，因此，当我们改变其父节点"浙江省"的选中状态时，也不会影响到节点"宁波"的选中状态。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    disabled: true,
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            multiple
            placeholder="请选择所在地区"
            disableStrictly
        />
    );
};
```

### 展示子菜单的时机

version: >= 1.29.0

可以使用 `showNext` 设置展开 Dropdown 子菜单的触发时机，可选: `click`（默认）、`hover`。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                }
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            showNext="hover"
        />
    );
};
```

### 在顶部/底部渲染附加项

我们在级联选择器的顶部、底部分别预留了插槽，你可以通过 `topSlot` 或 `bottomSlot` 来设置。

```jsx live=true
import React from 'react';
import { Cascader, Typography } from '@douyinfe/semi-ui';

() => {
    const { Text } = Typography;
    const slotStyle = {
        height: '36px',
        display: 'flex',
        padding: '0 32px',
        alignItems: 'center',
        cursor: 'pointer',
        borderTop: '1px solid var(--semi-color-border)'
    };
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
            bottomSlot={
                <div style={slotStyle}>
                    <Text>找不到相关选项？</Text>
                    <Text link>去新建</Text>
                </div>
            }
        />
    );
};
```

### 受控

传入 `value` 时即为受控组件，可以配合 `onChange` 使用。

```jsx live=true hideInDSM
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            value: []
        };
    }
    onChange(value) {
        this.setState({ value });
    }
    render() {
        const treeData = [
            {
                label: '浙江省',
                value: 'zhejiang',
                children: [
                    {
                        label: '杭州市',
                        value: 'hangzhou',
                        children: [
                            {
                                label: '西湖区',
                                value: 'xihu',
                            },
                            {
                                label: '萧山区',
                                value: 'xiaoshan',
                            },
                            {
                                label: '临安区',
                                value: 'linan',
                            },
                        ],
                    },
                    {
                        label: '宁波市',
                        value: 'ningbo',
                        children: [
                            {
                                label: '海曙区',
                                value: 'haishu',
                            },
                            {
                                label: '江北区',
                                value: 'jiangbei',
                            }
                        ]
                    },
                ],
            }
        ];
        return (
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="请选择所在地区"
                value={this.state.value}
                onChange={e => this.onChange(e)}
            />
        );
    }
}
```

### 自动合并 value
版本: >=1.28.0

在多选（multiple=true）场景中，当我们选中祖先节点时，如果希望 value 不包含它对应的子孙节点，则可以通过 `autoMergeValue` 来设置，默认为 true。当 autoMergeValue 和 leafOnly 同时开启时，后者优先级更高。

```jsx live=true
import React, { useState } from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const [value, setValue] = useState([]);
    const onChange = value => {
        console.log(value);
        setValue(value);
    };
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="autoMergeValue 为 false"
            value={value}
            multiple
            autoMergeValue={false}
            onChange={e => onChange(e)}
        />
    );
};
```

### 仅叶子节点
版本: >=2.2.0

在多选时，可以通过开启 leafOnly 来设置 value 只包含叶子节点，即显示的 Tag 和 onChange 的参数 value 只包含 value。

```jsx live=true
import React, { useState } from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const [value, setValue] = useState([]);
    const onChange = value => {
        console.log(value);
        setValue(value);
    };
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <Cascader
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="开启 leafOnly"
            value={value}
            multiple
            leafOnly
            onChange={e => onChange(e)}
        />
    );
};
```

### 节点选中关系

版本：>= 2.71.0

多选时，可以使用 `checkRelation` 来设置节点之间选中关系的类型，可选：'related'（默认）、'unRelated'。当选中关系为 'unRelated' 时，意味着节点之间的选中互不影响。

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';
() => {
    const treeData = [
        {
            label: '亚洲',
            value: 'Asia',
            children: [
                {
                    label: '中国',
                    value: 'China',
                    children: [
                        {
                            label: '北京',
                            value: 'Beijing',
                        },
                        {
                            label: '上海',
                            value: 'Shanghai',
                        },
                    ],
                },
            ],
        },
        {
            label: '北美洲',
            value: 'North America',
        }
    ];
    return (
        <Cascader
            multiple
            defaultValue={[
                ['Asia'],
                ['Asia', 'China', 'Beijing']
            ]}
            checkRelation='unRelated'
            style={{ width: 300 }}
            treeData={treeData}
        />
    );
};
```

### 动态更新数据

```jsx live=true hideInDSM
import React from 'react';
import { Cascader, Button } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            treeData: [],
        };
        this.add = this.add.bind(this);
    }
    add() {
        let itemLength = Math.floor(Math.random() * 3) + 1;
        let treeData = new Array(itemLength).fill(0).map((v, i) => {
            let length = Math.floor(Math.random() * 3);
            let children = new Array(length).fill(0).map((cv, ci) => {
                let child = {
                    key: `${i}-${ci}`,
                    label: `Item-${i}-${ci}`,
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
                <Cascader
                    style={{ width: 300 }}
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
可以使用 loadData 实现异步加载数据
**v>=1.8.0**  
**不能与搜索同时使用**

```jsx live=true hideInDSM
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const initialData = [
        {
            label: 'Node1',
            value: '0-0',
        },
        {
            label: 'Node2',
            value: '0-1',
        },
        {
            label: 'Node3',
            value: '0-2',
            isLeaf: true
        },
    ];
    const [data, setData] = useState(initialData);
    
    const updateTreeData = (list, value, children) => {
        return list.map(node => {
            if (node.value === value) {
                return { ...node, children };
            }
            if (node.children) {
                return { ...node, children: updateTreeData(node.children, value, children) };
            }
            return node;
        });
    };

    const onLoadData = selectedOpt => {
        const targetOpt = selectedOpt[selectedOpt.length - 1];
        const { label, value } = targetOpt;
        return new Promise(resolve => {
            if (targetOpt.children) {
                resolve();
                return;
            }

            setTimeout(() => {
                setData(origin =>
                    updateTreeData(origin, value, [
                        {
                            label: `${label} - 1`,
                            value: `${label}-1`,
                            isLeaf: selectedOpt.length > 1
                        },
                        {
                            label: `${label} - 2`,
                            value: `${label}-2`,
                            isLeaf: selectedOpt.length > 1
                        },
                    ]),
                );
                resolve();
            }, 1000);
        });
    };

    return (
        <Cascader
            style={{ width: 300 }}
            treeData={data}
            loadData={onLoadData}
            placeholder="Please select"
        />
    );
};
```


### 超长列表

当你的数据结构层级特别深时，Cascader下拉菜单可能会超出屏幕，此时我们建议为下拉菜单设置 overflow-x: auto 以及一个合适的 width 宽度（ 建议以N+0.5列的宽度为准，最右侧显示半列，以给用户一种右侧尚有待展开项，可以水平方向滚动的视觉暗示）

```jsx live=true
import React from 'react';
import { Cascader } from '@douyinfe/semi-ui';

() => {
    const treeData = [
        {
            label: 'A',
            value: 'A',
            children: [
                {
                    label: 'B',
                    value: 'B',
                    children: [
                        {
                            label: 'C',
                            value: 'C',
                            children: [
                                {
                                    label: 'D',
                                    value: 'D',
                                    children: [
                                        {
                                            label: 'E',
                                            value: 'E',
                                            children: [
                                                {
                                                    label: 'F',
                                                    value: 'F',
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                }
            ]
        }
    ];
    return (
        <Cascader
            dropdownClassName='components-cascader-demo'
            style={{ width: 300 }}
            treeData={treeData}
            placeholder="请选择所在地区"
        />
    );
};
```

```css
.components-cascader-demo {
    .semi-cascader-option-lists {
        max-width: 510px;
        overflow-x: auto;
    }
}
```

### 自定义 Trigger

如果默认的触发器样式满足不了你的需求，可以用`triggerRender`自定义选择框的展示

triggerRender 入参如下

```typescript
interface TriggerRenderProps {
    /* Cascader 的 props */
    componentProps: CascaderProps;
    /* 是否禁用 Cascader */
    disabled: boolean;
    /**
     * 已选中的 node 在 treeData 中的层级位置，如下例子，
     * 当选中浙江省-杭州市-萧山区时，此处 value 为 '0-0-1'
     */
    value?: string | Set<string>;
    /* 当前 Input 框的输入值 */
    inputValue: string;
    /**
     * 用于更新 input 框值的函数，当你在 triggerRender 自定义的
     * Input 组件值更新时，你应该调用该函数，用于向 Cascader 内部
     * 同步状态, 使用时需要设置 filterTreeNode 参数非 false
     */
    onSearch: (inputValue: string) => void;
    /* 用于清空值的函数 */
    onClear: () => void;
    /* Placeholder */
    placeholder?: string;
    /* 用于删除单个 item ， 入参为 value */
    onRemove: (value) => void
}
```

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { Cascader, Button, Tag, TagInput } from '@douyinfe/semi-ui';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';

function Demo() {
    const treeData = useMemo(() => [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ], []);

    const closeIcon = useCallback((value, onClear) => {
        return value ? <IconClose onClick={onClear} /> : <IconChevronDown />;
    }, []);

    const triggerRenderSingle = ({ value, placeholder, onClear, ...rest }) => {
        return (
            <Button theme={'light'} icon={closeIcon(value, onClear)} iconPosition={'right'}>
                {value && value.length > 0 ? getLabelFromValue(value) : placeholder}
            </Button>
        );
    };

    const getLabelFromValue = useCallback((value) => {
        const valueArr = value.split('-').map(item => Number(item));
        let resultData = treeData;
        valueArr.forEach((item, index) => {
            resultData = index === 0 ? resultData[item] : resultData.children[item];
        });
        return resultData.label;
    }, [treeData]);

    const triggerRenderMultiple = useCallback((props) => {
        const { value, onSearch, onRemove } = props;
        const onCloseTag = (value, e, tagKey) => {
            onRemove(tagKey);
        };

        const renderTagItem = (value) => {
            const label = getLabelFromValue(value);
            return <Tag tagKey={value} key={value} closable onClose={onCloseTag} style={{ marginLeft: 2 }}>{label}</Tag>;
        };
        
        return (
            <TagInput
                value={Array.from(value)}
                onInputChange={onSearch}
                renderTagItem={renderTagItem}
            />
        );
    }, []);

    return (
        <>
            <Cascader
                treeData={treeData}
                placeholder='Custom Trigger'
                triggerRender={triggerRenderSingle}
            />
            <br />
            <Cascader
                triggerRender={triggerRenderMultiple}
                multiple
                filterTreeNode
                treeData={treeData}
                style={{ width: 300 }}
                placeholder='Custom Trigger'
            />
        </>
    );
}
```

## API 参考

### Cascader

| 属性                 | 说明                                                                                                                                                  | 类型                                                                                      | 默认值                         | 版本   |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|--------------------------------|--------|
| arrowIcon            | 自定义右侧下拉箭头 Icon，当 showClear 开关打开且当前有选中值时，hover 会优先显示 clear icon                                                                                      | ReactNode                                                                                 | -                              | 1.15.0 |
| autoAdjustOverflow   | 是否自动调整下拉框展开方向，用于边缘遮挡时自动调整展开方向                                                                                                                       | boolean                                                                                   | true                           | -      |
| autoMergeValue       | 设置自动合并 value。具体而言是，开启后，当某个父节点被选中时，value 将不包括该节点的子孙节点。不支持动态切换                                                                                        | boolean                                                                                   | true                           | 1.28.0 |
| bottomSlot           | 底部插槽                                                                                                                                                | ReactNode                                                                                 | -                              | 1.27.0 |
| borderless        | 无边框模式  >=2.33.0                                                                                                                                     | boolean                         |           |
| changeOnSelect       | 是否允许选择非叶子节点                                                                                                                                         | boolean                                                                                   | false                          | -      |
| checkRelation | 多选时，节点之间选中状态的关系，可选：'related'、'unRelated'。  | string | 'related' | v2.71.0 |
| className            | 选择框的 className 属性                                                                                                                                   | string                                                                                    | -                              | -      |
| clearIcon            | 可用于自定义清除按钮, showClear为true时有效                                                                                                                       | ReactNode                                                                                 | -                              | 2.25.0 |
| defaultOpen          | 设置是否默认打开下拉菜单                                                                                                                                        | boolean                                                                                   | false                          | -      |
| defaultValue         | 指定默认选中的条目                                                                                                                                           | string\|number\|CascaderData\|(string\|number\|CascaderData)[]                            | -                              | -      |
| disabled             | 是否禁用                                                                                                                                                | boolean                                                                                   | false                          | -      |
| displayProp          | 设置回填选项显示的属性值                                                                                                                                        | string                                                                                    | `label`                        | -      |
| displayRender        | 设置回填格式                                                                                                                                              | (selected: string[] \| Entity, idx?: number) => ReactNode                                 | selected => selected.join('/') | -      |
| dropdownMargin       | 下拉菜单计算溢出时的增加的冗余值，详见[issue#549](https://github.com/DouyinFE/semi-design/issues/549)，作用同 Tooltip margin                                               | object\|number                                                                            | -                              | 2.25.0 |
| dropdownClassName    | 下拉菜单的 className 属性                                                                                                                                  | string                                                                                    | -                              | -      |
| dropdownStyle        | 下拉菜单的样式                                                                                                                                             | object                                                                                    | -                              | -      |
| expandIcon | 自定义展开 icon | ReactNode | - | 2.68.0 |
| emptyContent         | 当搜索无结果时展示的内容                                                                                                                                        | ReactNode                                                                                 | `暂无数据`                     | -      |
| filterLeafOnly       | 搜索结果是否只展示叶子结点路径                                                                                                                                     | boolean                                                                                   | true                           | 1.26.0 |
| filterRender         | 自定义渲染筛选后的选项                                                                                                                                         | (props: FilterRenderProps) => ReactNode;                                                  | -                              | 2.28.0 |
| filterSorter         | 对筛选后的选项进行排序                                                                                                                                         | (first: CascaderData, second: CascaderData, inputValue: string) => number                 | -                              | 2.28.0 |
| filterTreeNode       | 设置筛选，默认用 treeNodeFilterProp 的值作为要筛选的 TreeNode 的属性值， data 参数自 v2.28.0 开始提供                                                                           | ((inputValue: string, treeNodeString: string, data?: CascaderData) => boolean) \| boolean | false                          | -      |
| getPopupContainer    | 指定父级 DOM，下拉框将会渲染至该 DOM 中，自定义需要设置 position: relative   这会改变浮层 DOM 树位置，但不会改变视图渲染位置。                                                                                               | () => HTMLElement                                                                         | () => document.body            | -      |
| leafOnly             | 多选时设置 value 只包含叶子节点，即显示的 Tag 和 onChange 的 value 参数只包含叶子节点。不支持动态切换                                                                                   | boolean                                                                                   | false                          | 2.2.0  |
| loadData             | 异步加载数据，需要返回一个Promise                                                                                                                                | (selectOptions: CascaderData[]) => Promise< void >                                        | -                              | 1.8.0  |
| max                  | 多选时，限制多选选中的数量，超出 max 后将触发 onExceed 回调                                                                                                               | number                                                                                    | -                              | 1.28.0 |
| maxTagCount          | 多选时，标签的最大展示数量，超出后将以 +N 形式展示                                                                                                                         | number                                                                                    | -                              | 1.28.0 |
| motion               | 设置下拉框弹出的动画                                                                                                                                          | boolean                                                                                   | true                           | -      |
| mouseEnterDelay      | 鼠标移入后，延迟显示下拉框的时间，单位毫秒                                                                                                                               | number                                                                                    | 50                             | -      |
| mouseLeaveDelay      | 鼠标移出后，延迟消失下拉框的时间，单位毫秒                                                                                                                               | number                                                                                    | 50                             | -      |
| multiple             | 设置多选                                                                                                                                                | boolean                                                                                   | false                          | 1.28.0 |
| placeholder          | 选择框默认文字                                                                                                                                             | string                                                                                    | -                              | -      |
| position             | 方向，可选值：`top`,`topLeft`,`topRight`,`left`,`leftTop`,`leftBottom`,`right`,`rightTop`,`rightBottom`,`bottom`,`bottomLeft`,`bottomRight`                | string                                                                                    | `bottom`                       | 2.16.0 |
| prefix               | 前缀标签                                                                                                                                                | ReactNode                                                                                 | -                              | 0.28.0 |
| preventScroll        | 指示浏览器是否应滚动文档以显示新聚焦的元素，作用于组件内的 focus 方法                                                                                                              | boolean                                                                                   | -                              | 2.15.0 |
| restTagsPopoverProps | Popover 的配置属性，可以控制 position、zIndex、trigger 等，具体参考[Popover](/zh-CN/show/popover#API%20%E5%8F%82%E8%80%83)                                            | PopoverProps                                                                              | {}                             | 1.28.0 |
| searchPlaceholder    | 搜索框默认文字                                                                                                                                             | string                                                                                    | -                              | -      |
| searchPosition | 设置搜索框的位置，可选: `trigger`、`custom` | string| `trigger` | 2.54.0 |
| separator            | 自定义分隔符，包括：搜索时显示在下拉框的内容以及单选时回显到 Trigger 的内容的分隔符                                                                                                      | string                                                                                    | `/`                            | 2.2.0  |
| showClear            | 是否展示清除按钮                                                                                                                                            | boolean                                                                                   | false                          | 0.35.0 |
| showNext             | 设置展开 Dropdown 子菜单的方式，可选: `click`、`hover`                                                                                                            | string                                                                                    | `click`                        | 1.29.0 |
| showRestTagsPopover  | 当超过 maxTagCount，hover 到 +N 时，是否通过 Popover 显示剩余内容                                                                                                    | boolean                                                                                   | false                          | 1.28.0 |
| size                 | 选择框大小，可选 `large`，`small`，`default`                                                                                                                  | string                                                                                    | `default`                      | -      |
| stopPropagation      | 是否阻止下拉框上的点击事件冒泡                                                                                                                                     | boolean                                                                                   | true                           | -      |
| disableStrictly      | 设置是否开启严格禁用。开启后，当节点是 disabled 的时候，则不能通过子级或者父级的关系改变选中状态                                                                                               | boolean                                                                                   | false                          | 1.32.0 |
| style                | 选择框的样式                                                                                                                                              | CSSProperties                                                                             | -                              | -      |
| suffix               | 后缀标签                                                                                                                                                | ReactNode                                                                                 | -                              | 0.28.0 |
| topSlot              | 顶部插槽                                                                                                                                                | ReactNode                                                                                 | -                              | 1.27.0 |
| treeData             | 展示数据，具体属性参考 [CascaderData](#CascaderData)                                                                                                           | CascaderData[]                                                                            | []                             | -      |
| treeNodeFilterProp   | 搜索时输入项过滤对应的 CascaderData 属性                                                                                                                         | string                                                                                    | `label`                        | -      |
| triggerRender        | 自定义触发器渲染方法                                                                                                                                          | (props: TriggerRenderProps) => ReactNode                                                  | -                              | 0.34.0 |
| validateStatus       | trigger 的校验状态，仅影响展示样式。可选: default、error、warning                                                                                                     | string                                                                                    | `default`                      | -      |
| value                | （受控）选中的条目                                                                                                                                           | string\|number\|CascaderData\|(string\|number\|CascaderData)[]                            | -                              | -      |
| virtualizeInSearch   | 搜索列表虚拟化，用于大量树节点的情况，由 height, width, itemSize 组成 | Object | - | - | - |
| zIndex               | 下拉菜单的 zIndex                                                                                                                                        | number                                                                                    | 1030                           | -      |
| enableLeafClick      | 多选时，是否启动点击叶子节点选项触发勾选                                                                                                                                | boolean                                                                                   | false                          | 2.2.0  |
| onBlur               | 失焦 Cascader 的回调                                                                                                                                     | (e: MouseEvent) => void                                                                   | -                              | -      |
| onChange | 选中树节点时调用此函数，默认返回选中项 path 的 value 数组                                                                                                                 | (value: string\|number\| CascaderData |(string\|number\|CascaderData)[]) => void | - | - |
| onChangeWithObject | 是否将选中项 option 的其他属性作为回调。设为 true 时，onChange 的入参类型会从 string/number 变为 TreeNode。此时如果是受控，也需要把 value 设置成 CascaderData 类型，且必须含有 value 的键值，defaultValue 同理 | boolean | false | 1.16.0 |
| onClear| showClear 为 true 时，点击清空按钮触发的回调                                                                                                                      | () => void | - | 1.29.0 |
| onDropdownVisibleChange       | 下拉框切换时的回调                                                                                                                                           | (visible: boolean) => void | - | 0.35.0 |
| onExceed| 多选时，超出 max 后触发的回调                                                                                                                                   | (checkedItem: Entity[]) => void | - | 1.28.0 |
| onFocus| 聚焦 Cascader 的回调                                                                                                                                     | (e: MouseEvent) => void | - | - |
| onListScroll | 下拉面板滚动的回调                                                                                                                                           | (e: React.Event, panel: { panelIndex: number; activeNode: CascaderData; } ) => void | - | 1.15.0 |
| onLoad | 节点加载完毕时触发的回调                                                                                                                                        | (newLoadedKeys: Set< string >, data: CascaderData) => void |- | 1.8.0 |
| onSearch | 文本框值变化时回调                                                                                                                                           | (value: string) => void | - | - |
| onSelect | 被选中时调用，返回选中项的 value                                                                                                                                 | (value: string \| number \| (string \| number)[]) => void| - | - |

### CascaderData

| 属性     | 说明                    | 类型           | 默认值 |
|----------|-----------------------|----------------|--------|
| children | 子节点                  | CascaderData[] | -      |
| disabled | 不可选状态 **>=0.35.0** | boolean        | -      |
| isLeaf   | 叶子节点                | boolean        | -      |
| label    | 展示的文本（必填）        | ReactNode      | -      |
| loading  | 正在加载                | boolean        | -      |
| value    | 属性值（必填）            | string\|number | -      |

## Methods

绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| 方法        | 说明                                | 版本    |
| ----------- | ----------------------------------- | ------- |
| close       | 调用时可以手动关闭下拉列表          | v2.30.0 |
| open        | 调用时可以手动展开下拉列表          | v2.30.0 |
| focus       | 调用时可以手动聚焦                 | v2.34.0 |
| blur        | 调用时可以手动失焦                 | v2.34.0 |
| search(value: string) | 手动触发搜索，需同时设置 filterTreeNode 开启搜索，searchPosition 为 `custom` 自定义展示搜素框  | v2.54.0 |

## Accessibility

### ARIA

- Cascader 支持传入 `aria-label`、`aria-describedby`、`aria-errormessage`、`aria-invalid`、`aria-labelledby`、`aria-required` 来表示该 Cascader 的相关信息;
- Cascader 支持通过按下 Enter 键来选中选项、清空选项、展开下拉框

## 文案规范
- 选择器选项
  - 如果没有默认选项，就使用“Select”做占位文案
  - 选项要按首字母顺序或者其他有逻辑的排列顺序，使用户更好地找到选项
  - 使用语句书写规范（首字母大写，其余小写），避免在句尾使用逗号和分号
  - 清晰表达出选项所表示的选择目的

## 设计变量
<DesignToken/>
