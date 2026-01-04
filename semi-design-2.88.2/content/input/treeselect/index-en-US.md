---
localeCode: en-US
order: 51
category: Input
title:  TreeSelect
subTitle: TreeSelect
icon: doc-treeselect
brief: TreeSelector is used for structured display & selection of multi-level tree data, such as displaying a list of folders and files, displaying a list of organizational structure members, and so on.
---
---


## When to Use

When the options to select is in tree structure, you could use TreeSelect, e.g. department hierarchy, subject system, category directory and etc.

## Demos

### How to import

```jsx import
import { TreeSelect } from '@douyinfe/semi-ui';
```

### Basic Usage

By default, TreeSelect is in single select mode and each item is selectable.

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
            ],
        },
        {
            label: 'North America',
            value: 'North America',
            key: '1',
        }
    ];
    return (
        <TreeSelect
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData}
            placeholder="Please select"
        />
    );
};
```

### Multi-choice

You could use `multiple` to set mode to multi-choice. When all child items are selected, the parent item will be selected.  
Use `leafOnly` if you prefer to render leaf nodes only and the corresponding params for onChange will also be leaf nodes values.  

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
                placeholder="Please select"
            />
            <br/>
            <br/>
            <TreeSelect
                style={{ width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                multiple
                leafOnly
                placeholder="Display leaf nodes only"
            />
        </div>
    );
};
```

### Limit Tags Number

In the multi-selection scenario, `maxTagCount` can be used to limit the number of tags displayed, and the excess part will be displayed in the form of +N.  
Use `showRestTagsPopover` (>= v2.22.0) to set whether hover +N displays Popover after exceeding `maxTagCount`, the default is `false`. Also, popovers can be configured in the `restTagsPopoverProps` property.  

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
                placeholder="When more than two tabs are selected it will collapse"
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
                placeholder="hover +N to view"
                defaultValue={['Beijing', 'Chengdu', 'Canada']}
            />
        </div>
    );
};
```

### Searchable

Use `filterTreeNode` to support search input. By default it searches the `label` property of the data. You can use `treeNodeFilterProp` to set another property to search or pass in a function to `filterTreeNode` to customize search behavior.

You could also use `showFilteredOnly` if you prefer to display filtered results only.

If you want to get specific information about the search results, you can use the `onSearch` callback function. See the API list for the specific parameters of the function.

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
                    placeholder="Single Searchable TreeSelect"
                    searchPlaceholder="Start searching"
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
                    placeholder="Multiple Searchable TreeSelect"
                    searchPlaceholder="Start searching"
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
                    placeholder="search input autofocus"
                    searchPlaceholder="autofocus"
                    searchAutoFocus
                    onSearch={this.onSearch}
                />
            </>
        );
    }
}
```


### Search Box Position

You can use `searchPosition` to set the position of the search box, optional: `dropdown` (default), `trigger`.

When the input box is at trigger:
1. The placeholder of the search box is controlled by `placeholder`;
2. When `showClear=true`, click the clear button of the input box, the inputValue and value will be cleared at the same time.

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
                placeholder="Single selection"
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
                placeholder="Multiple selection"
            />
        </>
    );
};
```

### Size

You can set the size by `size`, one of: 'small'、'default'、'large'

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

### Disabled

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
            ],
        },
        {
            label: 'North America',
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
                placeholder="Disabled TreeSelect"
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


### Disable Strictly

You can use `disableStrictly` to enable strict disabling. After enabling strict disabling, when the node is disabled, the selected state cannot be changed through the relationship between the child or the parent.

Take the following demo as an example, the node "China" is strictly disabled. Therefore, when we change the selected state of its parent node "Asia", it will not affect the selected state of the node "China".

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
                    disable: true,
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
                },
            ],
        },
        {
            label: 'North America',
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

### Default Expand All

Both `defaultExpandAll` and `expandAll` can set the default expanded/collapsed state of `TreeSelect`. The difference between the two is that `defaultExpandAll` only takes effect during initialization, while `expandAll` will take effect not only during initialization, but also when the data (`treeData`) is dynamically updated.

In the demo below, after `TreeData` is updated, `defaultExpandAll` becomes invalid, and `expandAll` still takes effect.

```jsx live=true
import React, { useState, useEffect } from 'react';
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
            ],
        },
        {
            label: 'North America',
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

### Controlled Component

You can use `value` along with `onChange` property if you want to use TreeSelect as a controlled component.

```jsx live=true
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
                ],
            },
            {
                label: 'North America',
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
                placeholder="Please select"
                onChange={e => this.onChange(e)}
            />
        );
    }
}
```

### Checked RelationShip
Version: >= 2.5.0

In multiple, `checkRelation` can be used to set the type of node selection relationship, optional: 'related' (default), 'unRelated'. When the selection relationship is 'unRelated', it means that selections between nodes do not affect each other.

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
            ],
        },
        {
            label: 'North America',
            value: 'North America',
            key: '1',
        }
    ];
    return (
        <TreeSelect
            defaultValue='Asia'
            multiple
            checkRelation='unRelated'
            style={{ width: 300 }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeData={treeData}
        />
    );
};
```

### Controlled Expansion with Search
When `expandedKeys` is passed in, it is a controlled expansion component, which can be used with `onExpand`. When the expansion is controlled, if the `filterTreeNode` is turned on and the search is performed, the node will no longer be automatically expanded. At this time, the expansion of the node is completely controlled by the `expandedKeys`. You can use the parameter `filteredExpandedKeys` (version: >= 2.6.0) of `onSearch` to realize the search expansion effect when the expansion is controlled.

```jsx live=true hideInDSM
import React, { useState } from 'react';
import { TreeSelect } from '@douyinfe/semi-ui';

() => {
    const [expandedKeys, setExpandedKeys] = useState([]);
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
            ],
        },
        {
            label: 'North America',
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
            onExpand={expandedKeys => setExpandedKeys(expandedKeys)}
            onSearch={(inputValue, filteredExpandedKeys, filteredNodes) => {
                setExpandedKeys([...filteredExpandedKeys, ...expandedKeys]);
            }}
        />
    );
};
```

### Virtualized TreeSelect
If you need to render large sets of tree structured data, you could use virtualized tree. In virtualized mode, animation / motion is disabled for better performance. 

The property `virtualize` is an object consisting of the following values: 
- height: Height of the dropDown, If passed in as a string, computed height should not be zero for render purpose, in other words, parent node should have offsetHeight. Pass in a number recommended.
- width: Width of the dropDown.
- itemSize: Height for each line of treeNode, required

If tree is searchable, you could also set `showFilteredOnly={true}` to reduce time of rendering for results.

```jsx live=true
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
        // x：number of nodes
        // y：number of nodes with children in each level
        // z：number of level
        function _loop(_level, _preKey, _tns) {
            const preKey = _preKey || '0';
            const tns = _tns || gData;

            const children = [];
            for (let i = 0; i < x; i++) {
                const key = `${preKey}-${i}`;
                tns.push({ label: `${key}-label`, key: `${key}-key`, value: `${key}-value` });
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
        return (
            <div style={{ padding: '0 20px' }}>
                <Button onClick={this.onGen}>Generate Data: </Button>
                <span>In total: {this.state.total}</span>
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
                            overflow: 'hidden'
                        }}
                        virtualize={{
                            itemSize: 28,
                            // dropDown height 300 minus search box height minus padding 8 * 2
                            // or if you set dropDown height, it will automatically fill rest space
                            height: 236                
                        }}
                    />
                ) : null}
            </div>
        );
    }
}
```

### Dynamic Update of Data

```jsx live=true
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
                    placeholder="Please select"
                />
                <br/>
                <br/>
                <Button onClick={this.add}>
                    Update Data
                </Button>
            </>
        );
    }
}
```

### Load Data Asynchronously
You could use `loadData` to load treeData asynchronously on node expansion. Notice `isLeaf` is required to mark node as leaf in treeData.

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
            placeholder="Please select"
        />
    );
};
```

### Custom Trigger

If the default trigger style cannot meet your needs, you can use `triggerRender` to customize the display of the select box.

The triggerRender input is as follows:

```typescript
interface triggerRenderProps {
    componentProps: TreeSelectProps;// TreeSelect props
    disabled: boolean;              // disabled status
    value: TreeNodeData[];              // data of the selected node
    inputValue: string;             // value of the input box
    onClear: e => void;             // onClear function
    placeholder: string;            // placeholder
    /* The function called when deleting a single item, 
     *   with the key of the item as an input parameter, 
     *  supported from version v2.32.0
     */
    onRemove: key => void;
    /* It is used to start the search when the value of the Input box is updated. 
     * When you update the value of the Input component customized by triggerRender, 
     * you should call this function to synchronize the state with the TreeSelect 
     * internally. you need to set the filterTreeNode parameter to non-false when use it,
     * and set searchPosition to 'trigger'. It is supported from v2.32.0
     */
    onSearch: inputValue => void;   
}
```

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { TreeSelect, Button, Tag, TagInput } from '@douyinfe/semi-ui';

function Demo() {
    const [value, setValue] = useState([]);
    const treeData = useMemo(() => [
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
            ],
        },
        {
            label: 'North America',
            value: 'North America',
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

### Custom Rendering Selected Item

You can use renderSelectedItem to customize the rendering structure of the selected item in the selection box.

- In not multiple mode: `renderSelectedItem(treeNode: TreeNodeData) => content: ReactNode`
- In multiple mode: `renderSelectedItem(treeNode: TreeNodeData, { index:number, onClose:function }) => { isRenderInTag: bool, content: ReactNode }`
    - When isRenderInTag is true, content wraps are automatically rendered in the Tag (with background color and close button)
    - When isRenderInTag is false, the returned content will be rendered directly

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { TreeSelect, Tag } from '@douyinfe/semi-ui';

function Demo() {
    const [value, setValue] = useState([]);
    const treeData = useMemo(() => [
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
            ],
        },
        {
            label: 'North America',
            value: 'North America',
            key: '1',
        },
        {
            label: 'South America',
            value: 'South America',
            key: '2',
        },
        {
            label: 'Antarctica',
            value: 'Antarctica',
            key: '3',
        },
    ], []);
    
    return (
        <>
            <h4>Single TreeSelect</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                renderSelectedItem={item => item.label}
            />
            <h4>Multiple + isRenderInTag=true</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                multiple
                renderSelectedItem={(item, { index, onClose }) => ({ content: item.label, isRenderInTag: true })}
            />
            <h4>Multiple + isRenderInTag=false</h4>
            <TreeSelect
                style={{ width: 300 }}
                treeData={treeData}
                multiple
                maxTagCount={2}
                renderSelectedItem={(item, { index, onClose }) => ({ content: <Tag key={index} color="white">{item.value}</Tag>, isRenderInTag: false })}
            />
        </>
    );
}
```

## API Reference

### TreeSelect

| Properties               | Instructions                                                                        | type                                                              | Default     | Version |
| ------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | ------- |
| arrowIcon|Customize the right drop-down arrow Icon, when the showClear switch is turned on and there is currently a selected value, hover will give priority to the clear icon| ReactNode | | - |
|autoAdjustOverflow|Whether the pop-up layer automatically adjusts the direction when it is obscured (only vertical direction is supported for the time being, and the inserted parent is body)|boolean | true| - |
| autoExpandParent | Toggle whether to expand parent nodes automatically | boolean | false | - |
| autoMergeValue | Sets the automerge value. Specifically, when enabled, when a parent node is selected, the value will not include the descendants of the node. (Works if leafOnly is false)| boolean | true | 2.61.0 | 
| borderless        | borderless mode  >=2.33.0                                                                                                                                                                     | boolean                         |           |
| checkRelation | In multiple, the relationship between the checked states of the nodes, optional: 'related'、'unRelated' | string | 'related' | 2.5.0 |
| className                | Class name                                                                          | string                                                            | -           | -       |
| clearIcon    | Can be used to customize the clear button, valid when showClear is true                       | ReactNode                |       | 2.25.0    |
| clickToHide  | Whether to close the drop-down layer automatically when selecting, only works in single-selection mode  | boolean    | true | - |
| clickTriggerToHide  | When the panel is open, whether to close the panel after clicking the Trigger  | boolean    | true | 2.32.0      |
| defaultExpandAll    | Set whether to expand all nodes during initialization. And if the data (`treeData`) changes, this api cannot affect the expansion of the node. If you need this, you can use `expandAll`    | boolean                     | false   | - |
| defaultExpandedKeys | Keys of default expanded nodes. Direct child nodes will be displayed. | string\[] | - | - |
| defaultOpen | Toggle whether to open dropdown menu by default | boolean | false | - |
| defaultValue             | Default value         | <ApiType detail='string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[]'>ValueType</ApiType>   | -   | -     |
| disabled                 | Disabled                                                                            | boolean                                                           | false       | -       |
| disableStrictly | Disable Strictly | boolean | false | - |
| dropdownClassName        | `className` property for dropDown                                                   | string                                                            | -           | -       |
| dropdownMatchSelectWidth | Toggle if min-width of dropDown menu should be same as width of select box          | boolean                                                           | true        | -       |
| dropdownMargin | Popup layer calculates the size of the safe area when the current direction overflows, used in scenes covered by fixed elements, more detail refer to [issue#549](https://github.com/DouyinFE/semi-design/issues/549), same as Tooltip margin | object\|number |  | 2.25.0 |
| dropdownStyle            | Style for dropDown                                                                  | CSSProperties                                                            | -           | -       |
| emptyContent             | Empty content when no data                                                          | ReactNode                                                         | `no result` | -       |
| expandAction             | Expand logic, one of false, 'click', 'doubleClick'. Default is set to false, which means item will not be expanded on clicking except on expand icon    | boolean \| string   | false | - |
| expandAll | Set whether to expand all nodes by default. If the data (`treeData`) changes, the default expansion will still be affected by this api | boolean | false |- |
| expandedKeys        | （Controlled）Keys of expanded nodes. Direct child nodes will be displayed.  | string[]                    | -       | - |
| expandIcon | Custom expand icon, [example](/en-US/navigation/tree#Custom%20expansion%20icon) | ReactNode \| (props: expandProps)=>ReactNode | - | 2.75.0 |
| keyMaps | Customize the key, label, and value fields in the node. If you set a custom name for the label in keyMaps and enable search, to ensure correct search, you need to set treeNodeFilterProp to one of the keys of treeData or use a custom search function through filterTreeNode. | object |  - | 2.47.0 |
| filterTreeNode           | Toggle whether searchable or pass in a function to customize search behavior, data parameter provided since v2.28.0 | boolean\| <ApiType detail='(inputValue: string, treeNodeString: string, data?: TreeNodeData) => boolean'>Function</ApiType> | false       | -       |
| getPopupContainer        | Container to render pop-up, you need to set 'position: relative`  This will change the DOM tree position, but not the view's rendering position.                                                    | function():HTMLElement                                            | -           | -       |
| labelEllipsis | Toggle whether to ellipsis label when overflow | boolean | false\|true(virtualized) | - |  
| leafOnly | Toggle whether to display tags for leaf nodes only and for onChange callback params in multiple mode | boolean | false | - |
| loadData | Load data asynchronously and the return value should be a promise | (treeNode: TreeNodeData) => Promise |-| - |
| loadedKeys | （Controlled）Mark node as loaded, working with `loadData` | Set< string > | - | -|
| maxTagCount              | Maximum number of tags displayed                                                    | number                                                            | -           | -       |
| motionExpand             | Toggle whether to turn on animation for expansion                                   | boolean                                                           | true        | -       |
| multiple                 | Toggle whether in multi-choice mode                                                 | boolean                                                           | false       | -       |
| optionListStyle          | Style for optionList                                                                | CSSProperties                                                     | -           |- |
| outerBottomSlot          | Rendered at the bottom of the pop-up layer, custom slot level with optionList    | ReactNode  |  - |- |
| outerTopSlot| Rendered at the top of the pop-up layer, custom slot level with optionList. If turn on filterTreeNode, it will replace search box as well. You could use static search method to customize instead. |  ReactNode  |  - |- |
| placeholder              | Placeholder for input box                                                           | string                                                            | -           | -       |
| position                 | Pop-up position, optional values refer to Tooltip position     | string          | bottomLeft           | 2.25.0       |
| prefix                   | Prefix                                                                              | ReactNode                                                         | -           | -  |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |  |  |
| renderFullLabel | Custom option render function, [Detailed Params and Usage](/en-US/navigation/tree#Advanced%20FullRender) | (obj) => ReactNode |- |
| renderLabel | Custom label render function. The searchWord parameter is supported since 2.65.0 | <ApiType detail='(label: ReactNode, data: TreeNodeData, searchWord: string) => ReactNode'>(label, data, searchWord) => ReactNode</ApiType> | -| 
| renderSelectedItem | render selected item | Function | - |- | 
| restTagsPopoverProps | The configuration properties of the [Popover](/en-US/show/popover#API%20Reference)     | PopoverProps     | {}        | 2.22.0 |
| searchAutoFocus        | Whether autofocus for search box           | boolean      | false           |-|
| searchPlaceholder        | Placeholder for search box                                                          | string                                                            | -           | -       |
| searchPosition | Set the position of the search box, one of: `dropdown`、`trigger` | string | `dropdown` | - |
| showClear | When the value is not empty, whether the trigger displays the clear button | boolean | false |  |
| showFilteredOnly | Toggle whether to displayed filtered result only in search mode | boolean | false | - |
| showLine | The option in the options panel shows connecting lines | boolean | false | 2.50.0 |
| showRestTagsPopover | When the number of tags exceeds maxTagCount and hover reaches +N, whether to display the remaining content through Popover | boolean | false | 2.22.0 |
| showSearchClear | Toggle whether to support clear search box | boolean | true | - |
| size                     | Size for input box，one of `large`，`small`，`default`                              | string                                                            | `default`   | -       |
| style                    | Inline style                                                            | CSSProperties             | -           | -       |
| suffix                   | Suffix                                                                              | ReactNode                                                         | -           |  - |
| treeData                 | Data for treeNodes                                                                  | TreeNodeData[]                                                  | \[]         | -       |
| treeNodeFilterProp       | Property in a `TreeNodeData` used to search                                             | string                                                            | `label`     | -       |
| treeNodeLabelProp        | Property in a `TreeNodeData` used to display                                            | string                                                            | `label`     | -       |
| triggerRender | Method to create a custom trigger  | (props: TriggerRenderProps) => ReactNode | - | - |
| validateStatus | Validate status，one of `warning`、`error`、 `default`, only affects the background color of the component | string | - | - |
| value                    | Value data of current item, used when TreeSelect is a controlled component     | <ApiType detail='string \| number \| TreeNodeData \| (string \| number \| TreeNodeData)[]'>ValueType</ApiType>    | -           | -       |
| virtualize | Efficiently rendering large lists, refer to Tree - VirtualizeObj. Motion is disabled when tree is rendered as virtualized list. | object | - | - |
| zIndex | zIndex for treeSelect dropDown menu | number | 1030 | - |
| onBlur                 | Callback function when treeSelect blur | function(event)                            | -           | -       |
| onFocus                 | Callback function when treeSelect focus  | function(event)                            | -           | -       |
| onChange                 | Callback function when the tree node is selected, return the value property of data | Function                           | -           | -       |
| onChangeWithObject        | Toggle whether to return all properties in an option as a return value. When set to true, onChange turn to Function(node, e)   | boolean                     | false   | - |
| onClear     | Callback triggered when clear button is clicked   | (e: Event) => void |  -  |   2.52.0  |
| onExpand                 | Callback function when expand or collapse a node                                    | <ApiType detail='(expandedKeys:array, {expanded: bool, node}) => void'>(expandedKeys, object) => void</ApiType>             | -           | -       |
| onLoad | Callback function when a node is loaded | <ApiType detail='(loadedKeys: Set<string\>, treeNode: TreeNodeData) => void'>(loadedKeys, treeNode) => void</ApiType> | - |-|
| onSearch                 | Callback function when search value changes. <br/>`filteredExpandedKeys` represents the key of the node expanded due to search or value/defaultValue, which can be used when expandedKeys is controlled<br/> **filteredExpandedKeys is supported in 2.6.0**. <br/>`filteredNodes` represents the nodes hit by the search. **filteredNodes is supported in 2.57.0**       | function(input: string, filteredExpandedKeys: string[], filteredNodes: TreeNodeData[])                                        | -           |     |
| onSelect                 | Callback function when selected, return the key property of data                    | <ApiType detail='(selectedKey:string, selected: bool, selectedNode: TreeNodeData) => void'>(selectedKey, selected, selectedNode)=>void</ApiType>                      | -           | -       |
| onVisibleChange     | A callback triggered when the pop-up layer is displayed/hidden   | function(isVisible:boolean) |     |  - |

### TreeNodeData

> **Key for `TreeNodeData` is required and must be unique**, `label` can be duplicated. Value is not required. In this case, the value property in `onChange`, `value`, `defaultValue` and `onChangeWithObject` will point to key property.
> To ensure everything behave as expected, keep a consistency of whether to have value or not to have value.

| Properties | Instructions| type              | Default |
| ---------- | ------------------------------------------- | ----------------- | ------- |
| value      | Value| string\|number           | -       |
| label      | Displayed label    | string\|ReactNode | -       |
| icon       | Icon | ReactNode         | -       |
| disabled   | Disabled, supported in multiple select mode | boolean           | false   |
| key        | Required and must be unique                 | string            | -       |
| isLeaf     | Whether it is a leaf node | boolean |-|

## Methods
Some internal methods provided by TreeSelect can be accessed through ref:

| Name    | Description  |
|---------|--------------|
| search(sugInput: string)  | If you need to customize the search box externally, you can actively call this method when the value of the custom search box changes to change the filtering results |

## Accessibility

### ARIA

- TreeSelect will automatically set `aria-label` to 'TreeSelect', and also support users to set `aria-label` to indicate the function of the TreeSelect;
- TreeSelect allows users to set `aria-describedby`, `aria-errormessage`, `aria-invalid`, `aria-labelledby`, `aria-required`, in addition, Form will automatically set these properties for Form.TreeSelect;
- TreeSelect will set `aria-disabled`, `aria-checked`, `aria-selected`, `aria-level` for each child node to indicate node status and level;

Demo:
```typescript
    <TreeSelect
        /* other attributes */
        aria-label='example treeSelect'
    />
```

## Design Tokens
<DesignToken/>