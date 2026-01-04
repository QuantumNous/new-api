---
localeCode: zh-CN
order: 50
category: 输入类
title: Transfer 穿梭框
icon: doc-transfer
width: 60%
dir: column
brief: 一个更直观高效的多选选择器，可以露出更多选项的信息，支持搜索功能，缺点是占据更多空间
---

## 代码演示

### 如何引入

```jsx import
import { Transfer } from '@douyinfe/semi-ui';
```

### 基本使用

数据项需传入 value、label、key

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';

() => {
    const data = Array.from({ length: 100 }, (v, i) => {
        return {
            label: `选项名称 ${i}`,
            value: i,
            disabled: false,
            key: `key-${i}`,
        };
    });
    return (
        <Transfer
            style={{ width: 568, height: 416 }}
            dataSource={data}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### 分组

将 type 设为 `groupList`

分组的 dataSource，一级子元素必须拥有 title 以及 children 属性，结构参考 <GroupItem\>

暂不支持多层嵌套

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';

() => {
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
    return (
        <Transfer
            type="groupList"
            defaultValue={[6]}
            style={{ width: 568 }}
            dataSource={dataWithGroup}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### 自定义筛选逻辑，自定义选项数据渲染

使用`filter`自定义搜索逻辑，返回 true 时表示当前项符合筛选规则，保留当前项在列表中的显示，返回 false 则表示不符合，当前项会被隐藏。  
当 type 为 `treeList`时，如需要自定义搜索逻辑，需设置 `filter` 为 true，并通过 `treeProps` 的 `filterTreeNode` 设置自定义的搜索函数。  
使用`renderSourceItem`，你可以自定义左侧每一条源数据的渲染结构。例如结合 Highlight 组件高亮搜索匹配文本    
使用`renderSelectedItem` 你可以自定义右侧每一条已选项的渲染结构。

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Checkbox, Avatar, Highlight } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';

() => {
    const [searchText, setSearchText] = useState('');
    const renderSourceItem = item => {
        return (
            <div className="components-transfer-demo-source-item" key={item.label}>
                <Checkbox
                    onChange={() => {
                        item.onChange();
                    }}
                    key={item.label}
                    checked={item.checked}
                    style={{ height: 52, alignItems: 'center' }}
                >
                    <Avatar color={item.color} size="small">
                        {item.abbr}
                    </Avatar>
                    <div className="info">
                        <div className="name">
                            <Highlight sourceString={item.label} searchWords={[searchText]}></Highlight>
                        </div>
                        <div className="email">
                            <Highlight sourceString={item.value} searchWords={[searchText]}></Highlight>
                        </div>
                    </div>
                </Checkbox>
            </div>
        );
    };

    const renderSelectedItem = item => {
        return (
            <div className="components-transfer-demo-selected-item" key={item.label}>
                <Avatar color={item.color} size="small">
                    {item.abbr}
                </Avatar>
                <div className="info">
                    <div className="name">{item.label}</div>
                    <div className="email">{item.value}</div>
                </div>
                <IconClose onClick={item.onRemove} />
            </div>
        );
    };

    const customFilter = (sugInput, item) => {
        return item.value.includes(sugInput) || item.label.includes(sugInput);
    };

    const data = [
        { label: '夏可漫', value: 'xiakeman@example.com', abbr: '夏', color: 'amber', area: 'US', key: 1 },
        { label: '申悦', value: 'shenyue@example.com', abbr: '申', color: 'indigo', area: 'UK', key: 2 },
        { label: '文嘉茂', value: 'wenjiamao@example.com', abbr: '文', color: 'cyan', area: 'HK', key: 3 },
        { label: '曲晨一', value: 'quchenyi@example.com', abbr: '曲', color: 'blue', area: 'India', key: 4 },
        { label: '曲晨二', value: 'quchener@example.com', abbr: '二', color: 'blue', area: 'India', key: 5 },
        { label: '曲晨三', value: 'quchensan@example.com', abbr: '三', color: 'blue', area: 'India', key: 6 },
    ];

    return (
        <Transfer
            style={{ width: 568 }}
            dataSource={data}
            filter={customFilter}
            defaultValue={['xiakeman@example.com', 'shenyue@example.com']}
            renderSelectedItem={renderSelectedItem}
            renderSourceItem={renderSourceItem}
            inputProps={{ placeholder: '搜索姓名或邮箱' }}
            onSearch={searchText => setSearchText(searchText)}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};

```

```css
.components-transfer-demo-selected-item {
    .semi-icon-close {
        visibility: hidden;
        color: var(--semi-color-tertiary);
    }
    &:hover {
        .semi-icon-close {
            visibility: visible;
        }
    }
}

.components-transfer-demo-selected-item,
.components-transfer-demo-source-item {
    height: 52px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    &:hover {
        background-color: var(--semi-color-fill-0);
    }
    .info {
        margin-left: 8px;
        flex-grow: 1;
    }
    .name {
        font-size: 14px;
        line-height: 20px;
    }
    .email {
        font-size: 12px;
        line-height: 16px;
        color: var(--semi-color-text-2);
    }
}
```

### 禁用

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const data = Array.from({ length: 20 }, (v, i) => {
        return {
            label: `选项名称 ${i}`,
            value: i,
            disabled: false,
            key: `key-${i}`,
        };
    });
    return (
        <Transfer
            style={{ width: 568, height: 416 }}
            disabled
            dataSource={data}
            defaultValue={[2, 4]}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### 拖拽排序

将 `draggable`设为 true，开启拖拽排序功能。v1.11.0 后支持

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const data = Array.from({ length: 30 }, (v, i) => {
        return {
            label: `选项名称 ${i}`,
            value: i,
            disabled: false,
            key: `key-${i}`,
        };
    });
    return (
        <Transfer
            style={{ width: 568, height: 416 }}
            dataSource={data}
            defaultValue={[2, 4]}
            draggable
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### 拖拽 + 自定义已选项渲染

将 `draggable`设为 true，开启拖拽排序功能;使用 `renderSelectedItem` 自定义右侧已选项渲染；   
你可以将触发器定义为任意你想要的ReactNode，并且添加样式。将拖拽触发器，使用 `sortableHandle` 进行包裹即可（sortableHandle于 v 1.22.0 后提供）, 

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Checkbox, Avatar } from '@douyinfe/semi-ui';
import { IconHandle, IconClose } from '@douyinfe/semi-icons';

() => {
    const renderSourceItem = item => {
        return (
            <div className="components-transfer-demo-source-item" key={item.label}>
                <Checkbox
                    onChange={() => {
                        item.onChange();
                    }}
                    key={item.label}
                    checked={item.checked}
                    style={{ height: 52, alignItems: 'center' }}
                >
                    <Avatar color={item.color} size="small">
                        {item.abbr}
                    </Avatar>
                    <div className="info">
                        <div className="name">{item.label}</div>
                        <div className="email">{item.value}</div>
                    </div>
                </Checkbox>
            </div>
        );
    };

    const renderSelectedItem = item => {
        const { sortableHandle } = item;
        const DragHandle = sortableHandle(() => <IconHandle className={`semi-right-item-drag-handler`} />); 
        return (
            <div className="components-transfer-demo-selected-item" key={item.label}>
                <DragHandle />
                <Avatar color={item.color} size="small">
                    {item.abbr}
                </Avatar>
                <div className="info">
                    <div className="name">{item.label}</div>
                    <div className="email">{item.value}</div>
                </div>
                <IconClose onClick={item.onRemove} />
            </div>
        );
    };

    const customFilter = (sugInput, item) => {
        return item.value.includes(sugInput) || item.label.includes(sugInput);
    };

    const data = [
        { label: '夏可漫', value: 'xiakeman@example.com', abbr: '夏', color: 'amber', area: 'US', key: 1 },
        { label: '申悦', value: 'shenyue@example.com', abbr: '申', color: 'indigo', area: 'UK', key: 2 },
        { label: '文嘉茂', value: 'wenjiamao@example.com', abbr: '文', color: 'cyan', area: 'HK', key: 3 },
        { label: '曲晨一', value: 'quchenyi@example.com', abbr: '曲', color: 'blue', area: 'India', key: 4 },
        { label: '曲晨二', value: 'quchener@example.com', abbr: '二', color: 'blue', area: 'India', key: 5 },
        { label: '曲晨三', value: 'quchensan@example.com', abbr: '三', color: 'blue', area: 'India', key: 6 },
    ];

    return (
        <Transfer
            draggable
            style={{ width: 568 }}
            dataSource={data}
            filter={customFilter}
            defaultValue={['xiakeman@example.com', 'shenyue@example.com']}
            renderSelectedItem={renderSelectedItem}
            renderSourceItem={renderSourceItem}
            inputProps={{ placeholder: '搜索姓名或邮箱' }}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### 自定义渲染面板头部信息

Semi 自 2.29.0 版本提供 `renderSourceHeader`, `renderSelectedHeader` 参数允许用户自定义渲染左右两个面板的头部信息。   
`renderSourceHeader: (props: SourceHeaderProps) => ReactNode`   
`renderSelectedHeader: (props: SelectedHeaderProps) => ReactNode`   
参数类型如下：

```ts
type SourceHeaderProps = {
    num: number; // 数据总数或筛选结果数目
    showButton: boolean; // 是否展示全选/取消全选按钮
    allChecked: boolean; // 当前数据是否已全选
    onAllClick: () => void // 点击全选/取消全选按钮后应调用的函数
}

type SelectedHeaderProps = {
    num: number; // 已选中数据总数
    showButton: boolean; // 是否展示清空按钮
    onClear: () => void // 点击清空按钮后应调用的函数
}
```

使用示例如下

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Button } from '@douyinfe/semi-ui';

() => {
    const data = Array.from({ length: 30 }, (v, i) => {
        return {
            label: `选项名称 ${i}`,
            value: i,
            disabled: false,
            key: `key-${i}`,
        };
    });

    const renderSourceHeader = (props) => {
        const { num, showButton, allChecked, onAllClick } = props;
        return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
            <span>共 {num} 项</span>
            {showButton && <Button
                theme="borderless"
                type="tertiary"
                size="small" 
                onClick={onAllClick}>{ allChecked ? '取消全选' : '全选' }</Button>}
        </div>;
    };

    const renderSelectedHeader = (props) => {
        const { num, showButton, onClear } = props;
        return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
            <span>{num} 项已选</span>
            {showButton && <Button
                theme="borderless"
                type="tertiary"
                size="small"
                onClick={onClear}>清空</Button>}
        </div>;
    };

    return (
        <Transfer
            style={{ width: 568, height: 416 }}
            dataSource={data}
            renderSourceHeader={renderSourceHeader}
            renderSelectedHeader={renderSelectedHeader}
        />
    );
};
```

### 完全自定义渲染

Semi 提供了 `renderSourcePanel`、`renderSelectedPanel` 入参，允许你完全自定义左右侧两个面板的渲染结构  
通过该功能，你可以直接复用 Transfer 内部的逻辑能力，实现高度自定义样式结构的`Transfer`组件 `renderSourcePanel: (sourcePanelProps: SourcePanelProps) => ReactNode`  
`SourcePanelProps`包含以下参数，你可以从中获取数据来渲染出你的 Panel 结构

```ts
interface SourcePanelProps {
  value: Array<string|number>; // 所有选中项的key
  loading: boolean;  // 是否加载中
  noMatch: boolean;  // 是否没有符合当前搜索值匹配的项
  filterData: Array<Item> // 匹配当前搜索值的项
  sourceData: Array<Item>; // 所有项
  allChecked: boolean; // 是否全部选中
  showNumber: number; // 筛选结果数量
  inputValue: string; // input搜索框的值
  onSearch: (searchString: string) => any; // 搜索框变化时应调用的函数，入参为搜索值
  onAllClick: () => void; // 左侧全部按钮点击时应调用的函数
  onSelectOrRemove: (item: Item) => any; //选择、删除单个选项时应调用的函数，入参应为当前操作item
  onSelect: (value:Array<string|number>)=>void; // 受控批量选中key
  selectedItem: Map, // 所有已选项的集合
}
```

`renderSelectedPanel: (selectedPanelProps: SelectedPanelProps) => ReactNode`  
`SelectedPanelProps`包含以下参数

```ts 
interface SelectedPanelProps {
  length: number; // 已选项的数量
  onClear: () => void; // 点击清空时应调用的回调函数
  onRemove: (item: Item) => void; // 删除单个选项时应调用的函数
  onSortEnd: ({ oldIndex, newIndex}) => void; // 对结果重新排序时应调用的函数
  selectedData: Array<Item>; // 所有已选项集合
}
```

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Input, Spin, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

class CustomRenderDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dataSource: Array.from({ length: 100 }, (v, i) => ({
                label: `海底捞门店 ${i}`,
                value: i,
                disabled: false,
                key: `key-${i}`,
            })),
        };
        this.renderSourcePanel = this.renderSourcePanel.bind(this);
        this.renderSelectedPanel = this.renderSelectedPanel.bind(this);
        this.renderItem = this.renderItem.bind(this);
    }

    renderItem(type, item, onItemAction, selectedItems) {
        let buttonText = '删除';
        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? '删除' : '添加';
        }
        return (
            <div className="semi-transfer-item panel-item" key={item.label}>
                <p>{item.label}</p>
                <Button
                    theme="borderless"
                    type="primary"
                    onClick={() => onItemAction(item)}
                    className="panel-item-remove"
                    size="small"
                >
                    {buttonText}
                </Button>
            </div>
        );
    }

    renderSourcePanel(props) {
        const {
            loading,
            noMatch,
            filterData,
            selectedItems,
            allChecked,
            onAllClick,
            inputValue,
            onSearch,
            onSelectOrRemove,
        } = props;
        let content;
        switch (true) {
            case loading:
                content = <Spin loading />;
                break;
            case noMatch:
                content = <div className="empty sp-font">{inputValue ? '无搜索结果' : '暂无内容'}</div>;
                break;
            case !noMatch:
                content = filterData.map(item => this.renderItem('source', item, onSelectOrRemove, selectedItems));
                break;
            default:
                content = null;
                break;
        }
        return (
            <section className="source-panel">
                <div className="panel-header sp-font">门店列表</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>待选门店: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? '取消全选' : '全选'}
                        </Button>
                    </div>
                    <div className="panel-list">{content}</div>
                </div>
            </section>
        );
    }

    renderSelectedPanel(props) {
        const { selectedData, onClear, clearText, onRemove } = props;

        let mainContent = selectedData.map(item => this.renderItem('selected', item, onRemove));

        if (!selectedData.length) {
            mainContent = <div className="empty sp-font">暂无数据，请从左侧筛选</div>;
        }

        return (
            <section className="selected-panel">
                <div className="panel-header sp-font">
                    <div>已选同步门店: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || '清空 '}
                    </Button>
                </div>
                <div className="panel-main">{mainContent}</div>
            </section>
        );
    }

    render() {
        const { dataSource } = this.state;
        return (
            <Transfer
                onChange={values => console.log(values)}
                className="component-transfer-demo-custom-panel"
                renderSourcePanel={this.renderSourcePanel}
                renderSelectedPanel={this.renderSelectedPanel}
                dataSource={dataSource}
            />
        );
    }
}
```

```scss
.component-transfer-demo-custom-panel {

    .sp-font {
        color: rgba(var(--semi-grey-9), 1);
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
    }

    .empty {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .panel-item {
        flex-shrink: 0;
        height: 56px;
        border-radius: 4px;
        padding: 8px 12px;
        flex-wrap: wrap;
        background-color: rgba(22, 24, 35, .03);

        &-main {
            flex-grow: 1;
        }

        p {
            margin: 0 12px;
            flex-basis: 100%;
        }

        .panel-item-remove {
            cursor: pointer;
            color: var(--semi-color-primary);
        }
    }

    .panel-header {
        padding: 10px 12px;
        border: 1px solid rgba(22, 24, 35, .16);
        border-radius: 4px 4px 0 0;
        height: 38px;
        box-sizing: border-box;
        background-color: var(--semi-color-tertiary-light-default);
        display: flex;
        align-items: center;
        justify-content: space-between;

        .clear {
            cursor: pointer;
            color: var(--semi-color-primary);
        }
    }

    .source-panel {
        display: flex;
        flex-direction: column;
        width: 482px;
        height: 353px;

        .panel-main {
            border: 1px solid var(--semi-color-border);
            border-top: none;

            .panel-list {
                display: flex;
                flex-wrap: wrap;
                row-gap: 8px;
                column-gap: 8px;
                overflow-y: auto;
                height: 214px;
                margin-left: 12px;
                margin-right: 12px;
                padding-bottom: 8px;
            }
        }

        .panel-controls {
            margin: 10px 12px;
            font-size: 12px;
            line-height: 20px;

            .semi-button {
                margin-left: 8px;
                font-size: 12px;
            }
        }

        .panel-item {
            width: 176px;
        }

        margin-right: 16px;
    }

    .selected-panel {
        width: 200px;
        height: 353px;

        .panel-main {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 12px;
            border: 1px solid var(--semi-color-border);
            border-top: none;
            height: 323px;
            box-sizing: border-box;
            row-gap: 8px;
        }
    }
}
```

### 完全自定义渲染 、 拖拽排序

在完全自定义渲染的场景下，由于拖拽区的渲染也已由你完全接管，因此你不声明 draggable 亦可。
但你需要自行实现拖拽逻辑，你可以借助社区中拖拽类工具库 [dnd-kit](https://github.com/clauderic/dnd-kit) 或者 [react-sortable-hoc](https://github.com/clauderic/react-sortable-hoc)，快速实现功能。关于两者选型，这是我们的一些建议

- 两者均由同一作者维护， dnd-kit 是 react-sortable-hoc 的接任产品
- react-sortable-hoc 的 API 设计更加高内聚，在简单场景上代码更加简洁。但它强依赖了 findDOMNode API，在未来的 React 版本中会被废弃。同时该库最近两年已经处于不维护的状态。
- dnd-kit 相对而言，有一定上手门槛，但它的自由度更高，扩展性更强，并且仍处于维护状态。我们更推荐使用

更多 DIff 信息可查阅 [react-sortable-hoc](https://github.com/clauderic/react-sortable-hoc) 的 Github 主页

另外，要支持拖拽排序，你需要在拖拽排序结束后，将 oldIndex、newIndex 作为入参，调用 onSortEnd

使用 react-sortable-hoc 的示例：

```jsx live=true dir="column"
import React from 'react';
import { SortableContainer, SortableElement, sortableHandle } from 'react-sortable-hoc';
import { Transfer, Button, Spin, Input } from '@douyinfe/semi-ui';
import { IconHandle, IconSearch } from '@douyinfe/semi-icons';

class CustomRenderDragDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dataSource: Array.from({ length: 100 }, (v, i) => ({
                label: `海底捞门店 ${i}`,
                value: i,
                disabled: false,
                key: `key-${i}`,
            })),
        };
        this.renderSourcePanel = this.renderSourcePanel.bind(this);
        this.renderSelectedPanel = this.renderSelectedPanel.bind(this);
        this.renderItem = this.renderItem.bind(this);
    }

    renderItem(type, item, onItemAction, selectedItems) {
        let buttonText = '删除';
        let newItem = item;

        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? '删除' : '添加';
        } else {
            // delete newItem._optionKey;
            newItem = { ...item, key: item._optionKey };
            delete newItem._optionKey;
        }

        const DragHandle = sortableHandle(() => <IconHandle className="pane-item-drag-handler" />);

        return (
            <div className="semi-transfer-item panel-item" key={item.label}>
                {type === 'source' ? null : <DragHandle />}
                <div className="panel-item-main" style={{ flexGrow: 1 }}>
                    <p>{item.label}</p>
                    <Button
                        theme="borderless"
                        type="primary"
                        onClick={() => onItemAction(newItem)}
                        className="panel-item-remove"
                        size="small"
                    >
                        {buttonText}
                    </Button>
                </div>
            </div>
        );
    }

    renderSourcePanel(props) {
        const {
            loading,
            noMatch,
            filterData,
            selectedItems,
            allChecked,
            onAllClick,
            inputValue,
            onSearch,
            onSelectOrRemove,
        } = props;
        let content;
        switch (true) {
            case loading:
                content = <Spin loading />;
                break;
            case noMatch:
                content = <div className="empty sp-font">{inputValue ? '无搜索结果' : '暂无内容'}</div>;
                break;
            case !noMatch:
                content = filterData.map(item => this.renderItem('source', item, onSelectOrRemove, selectedItems));
                break;
            default:
                content = null;
                break;
        }
        return (
            <section className="source-panel">
                <div className="panel-header sp-font">门店列表</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>待选门店: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? '取消全选' : '全选'}
                        </Button>
                    </div>
                    <div className="panel-list">{content}</div>
                </div>
            </section>
        );
    }

    renderSelectedPanel(props) {
        const { selectedData, onClear, clearText, onRemove, onSortEnd } = props;

        let mainContent = null;

        if (!selectedData.length) {
            mainContent = <div className="empty sp-font">暂无数据，请从左侧筛选</div>;
        }

        const SortableItem = SortableElement(item => this.renderItem('selected', item, onRemove));
        const SortableList = SortableContainer(
            ({ items }) => {
                return (
                    <div className="panel-main">
                        {items.map((item, index) => (
                            // sortableElement will take over the property 'key', so use another '_optionKey' to pass
                            // otherwise you can't get `key` property in this.renderItem
                            <SortableItem key={item.label} index={index} {...item} _optionKey={item.key}></SortableItem>
                        ))}
                    </div>
                );
            },
            { distance: 10 }
        );

        mainContent = <SortableList useDragHandle onSortEnd={onSortEnd} items={selectedData}></SortableList>;

        return (
            <section className="selected-panel">
                <div className="panel-header sp-font">
                    <div>已选同步门店: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || '清空 '}
                    </Button>
                </div>
                {mainContent}
            </section>
        );
    }

    render() {
        const { dataSource } = this.state;
        return (
            <Transfer
                defaultValue={[2, 4]}
                onChange={values => console.log(values)}
                className="component-transfer-demo-custom-panel"
                renderSourcePanel={this.renderSourcePanel}
                renderSelectedPanel={this.renderSelectedPanel}
                dataSource={dataSource}
            />
        );
    }
}
```

使用 dnd-kit 的示例如下，需要用到的核心依赖有 @dnd-kit/sortable， @dnd-kit/core，其中核心 hooks 为 useSortable，使用说明如下

```
1. 作用：通过唯一标志 id 获取拖拽过程中必要信息
2. 核心输入参数：
    - id: 唯一标识, 以为数字或者字符串，但是不能为数字 0
3. 核心返回值说明:
	- setNodeRef: 关联 dom 节点，使其成为一个可拖拽的项
	- listeners: 包含 onKeyDown，onPointerDown 等方法，主要让节点可以进行拖拽
	- transform：该节点被拖动时候的移动变化值
	- transition：过渡效果
    - active: 被拖拽节点的相关信息，包括 id
```

```jsx live=true dir="column" noInline=true
import React from 'react';
import ReactDOM from 'react-dom';
import { Transfer, Input, Spin, Button } from '@douyinfe/semi-ui';
import { IconSearch, IconHandle } from '@douyinfe/semi-icons';
import { useSortable, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS as cssDndKit } from '@dnd-kit/utilities';
import { closestCenter, DragOverlay, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, KeyboardSensor, TraversalOrder } from '@dnd-kit/core';

function SortableList({
    items,
    onSortEnd,
    renderItem,
}) {
    const [activeId, setActiveId] = useState(null);
    // sensors 确定拖拽操作受哪些外部输入影响（如鼠标，键盘，触摸板）
    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const getIndex = useCallback((id) => items.indexOf(id), [items]);
    const activeIndex = useMemo(() => activeId ? getIndex(activeId) : -1, [getIndex, activeId]);

    const onDragStart = useCallback(({ active }) => {
        if (!active) { return; }
        setActiveId(active.id);
    }, []);

    // 拖拽结束回调
    const onDragEnd = useCallback(({ over }) => {
        setActiveId(null);
        if (over) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
                onSortEnd({ oldIndex: activeIndex, newIndex: overIndex });
            }
        }
    }, [activeIndex, getIndex, onSortEnd]);

    const onDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            // 设置拖拽时候滚动从最靠近被拖拽元素的祖先元素开始
            autoScroll={{ order: TraversalOrder.ReversedTreeOrder }}
        >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', rowGap: '8px' }}>
                    {items.map((value, index) => (
                        <SortableItem
                            key={value}
                            id={value}
                            index={index}
                            renderItem={renderItem}
                        />
                    ))}
                </div>
                {ReactDOM.createPortal(
                    <DragOverlay>
                        {activeId ? (
                            renderItem({
                                id: activeId,
                                sortableHandle: (WrapperComponent) => WrapperComponent
                            })
                        ) : null}
                    </DragOverlay>,
                    document.body
                )}
            </SortableContext>
        </DndContext>
    );
}

function SortableItem({ id, renderItem }) {
    const {
        listeners,
        setNodeRef,
        transform,
        transition,
        active,
    } = useSortable({
        id,
    });

    const sortableHandle = useCallback((WrapperComponent) => {
        return () => <span {...listeners} style={{ lineHeight: 0 }}><WrapperComponent /></span>;
    }, [listeners]);

    const wrapperStyle = {
        transform: cssDndKit.Transform.toString({
            ...transform,
            scaleX: 1,
            scaleY: 1,
        }),
        transition: transition,
        opacity: active && active.id === id ? 0 : undefined,
    };

    return <div 
        ref={setNodeRef}
        style={wrapperStyle}
    >
        {renderItem({ id, sortableHandle })}
    </div>;
}

class CustomRenderDragDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dataSource: Array.from({ length: 100 }, (v, i) => ({
                label: `海底捞门店 ${i}`,
                value: i,
                disabled: false,
                key: `key-${i}`,
            })),
        };
        this.renderSourcePanel = this.renderSourcePanel.bind(this);
        this.renderSelectedPanel = this.renderSelectedPanel.bind(this);
        this.renderItem = this.renderItem.bind(this);
    }

    renderItem(type, item, onItemAction, selectedItems, sortableHandle) {
        let buttonText = '删除';

        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? '删除' : '添加';
        }

        const DragHandle = (sortableHandle && sortableHandle(() => <IconHandle className="pane-item-drag-handler" />));

        return (
            <div className="semi-transfer-item panel-item" key={item.label}>
                {type === 'source' ? null : ( DragHandle ? <DragHandle /> : null) }
                <div className="panel-item-main" style={{ flexGrow: 1 }}>
                    <p style={{ margin: '0 12px' }}>{item.label}</p>
                    <Button
                        theme="borderless"
                        type="primary"
                        onClick={() => onItemAction(item)}
                        className="panel-item-remove"
                        size="small"
                    >
                        {buttonText}
                    </Button>
                </div>
            </div>
        );
    }

    renderSourcePanel(props) {
        const {
            loading,
            noMatch,
            filterData,
            selectedItems,
            allChecked,
            onAllClick,
            inputValue,
            onSearch,
            onSelectOrRemove,
        } = props;
        let content;
        switch (true) {
            case loading:
                content = <Spin loading />;
                break;
            case noMatch:
                content = <div className="empty sp-font">{inputValue ? '无搜索结果' : '暂无内容'}</div>;
                break;
            case !noMatch:
                content = filterData.map(item => this.renderItem('source', item, onSelectOrRemove, selectedItems));
                break;
            default:
                content = null;
                break;
        }
        return (
            <section className="source-panel">
                <div className="panel-header sp-font">门店列表</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>待选门店: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? '取消全选' : '全选'}
                        </Button>
                    </div>
                    <div className="panel-list">{content}</div>
                </div>
            </section>
        );
    }

    renderSelectedPanel(props) {
        const { selectedData, onClear, clearText, onRemove, onSortEnd } = props;
        let mainContent = null;

        if (!selectedData.length) {
            mainContent = <div className="empty sp-font">暂无数据，请从左侧筛选</div>;
        }

        const renderSelectItem = ({ id, sortableHandle }) => {
            const item = selectedData.find(item => id === item.key);
            return this.renderItem('selected', item, onRemove, null, sortableHandle);
        };

        const sortData = selectedData.map(item => item.key);

        mainContent = <div className="panel-main" style={{ display: 'block' }}>
            <SortableList onSortEnd={onSortEnd} items={sortData} renderItem={renderSelectItem}></SortableList>
        </div>;

        return (
            <section className="selected-panel">
                <div className="panel-header sp-font">
                    <div>已选同步门店: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || '清空 '}
                    </Button>
                </div>
                {mainContent}
            </section>
        );
    }

    render() {
        const { dataSource } = this.state;
        return (
            <Transfer
                defaultValue={[2, 4]}
                onChange={values => console.log(values)}
                className="component-transfer-demo-custom-panel"
                renderSourcePanel={this.renderSourcePanel}
                renderSelectedPanel={this.renderSelectedPanel}
                dataSource={dataSource}
            />
        );
    }
}

render(CustomRenderDragDemo);
```

### 树穿梭框

传入 type 为`treeList`，使用[`Tree`](/zh-CN/navigation/tree)组件作为自定义渲染列表。**v1.20.0 提供**

可通过treeProps([TreeProps](/zh-CN/navigation/tree#Tree))来覆盖默认树的属性，左侧树默认属性为

```
{
    multiple:true,
    disableStrictly:true,
    leafOnly:true,
    filterTreeNode:true,
    searchRender:flase,

}
```

```jsx live=true dir="column"
import React, { useState } from 'react';
import { Transfer } from '@douyinfe/semi-ui';

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
                {
                    label: 'Mexico',
                    value: 'Mexico',
                    disabled: true,
                    key: '1-2',
                },
                {
                    label: 'Cuba',
                    value: 'Cuba',
                    key: '1-3',
                },
            ],
        },
    ];

    const [v, $v] = useState(['Shanghai']);

    return (
        <div style={{ margin: 10, padding: 10, width: 600 }}>
            <Transfer dataSource={treeData} type="treeList" value={v} onChange={$v}></Transfer>
        </div>
    );
};
```

## Accessibility

### ARIA

- 搜索框添加 `role` `search`
- 右侧选中列表添加 `role` `list`，选中项添加 `role` `listitem`

## API 参考

### Transfer Props

| 属性 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| className | 样式类名 | string |  |  |
| dataSource | 数据源 | Array<Item\>\|Array<GroupItem\>\|Array<TreeItem\> | [] |  |
| defaultValue | 默认已选中值 | Array<string\|number> | |  |
| disabled | 是否禁用 | boolean | false |  |
| draggable | 是否开启拖拽排序 | boolean | false |  |
| emptyContent | 自定义空状态的提示文本，search 为无搜索结果时展示的文本，left 为左侧无源数据时的文本，right 为无勾选数据时的提示文本 | {left: ReactNode; right: ReactNode; search: ReactNode;} |  |  |
| filter | 自定义筛选逻辑, 当为 false 时，不展示搜索框，传入函数可自定义搜素逻辑。当 type 为 `treeList`时，如需要自定义搜索逻辑，需设置 `filter` 为 true，并通过 `treeProps` 的 `filterTreeNode` 设置自定义的搜索函数。 | boolean \| (input:string, item: Item) => boolean | true |  |
| inputProps | 可用于自定义搜索框 Input，可配置属性参考 Input 组件，其中 value 和 onChange 参数在 Transfer 内部会被使用，用户请勿使用，如需通过外部数据进行搜索，可调用 Transfer 的 search 方法 | [InputProps](/zh-CN/input/input#API%20%E5%8F%82%E8%80%83) |  |  |
| loading | 是否正在加载左侧选项 | boolean | - |  |
| onChange | 选中值发生变化时触发的回调, 拖拽排序变化后也会触发该回调 | (values: Array<string\|number>, items: Array<Item\>) => void |  |  |
| onDeselect | 取消勾选时的回调 | (item: Item) => void | |  |
| onSearch | 搜索框输入内容变化时调用 | (inputValue: string) => void | |  |
| onSelect | 勾选时的回调 | (item: Item) => void | |  |
| renderSelectedHeader | 自定义右侧面板头部信息的渲染 | (props: SelectedHeaderProps) => ReactNode |  | 2.29.0 |
| renderSelectedItem | 自定义右侧单个已选项的渲染 | (item: { onRemove, sortableHandle } & Item) => ReactNode |  |  |
| renderSelectedPanel | 自定义右侧已选面板的渲染 | (selectedPanelProps) => ReactNode |  | 1.11.0 |
| renderSourceHeader | 自定义左侧面板头部信息的渲染 | (props: SourceHeaderProps) => ReactNode |  | 2.29.0 |
| renderSourceItem | 自定义左侧单个候选项的渲染 | (item: { onChange, checked } & Item) => ReactNode |  |  |
| renderSourcePanel | 自定义左侧候选面板的渲染 | (sourcePanelProps) => ReactNode |  | 1.11.0 |
| showPath | 当 type 为`treeList`时，控制右侧选中项是否显示选择路径 | boolean | false | 1.20.0 |
| style | 内联样式 | CSSProperties |  |  |
| treeProps | 当 type 为`treeList`时，可作为 TreeProps 传入左侧的 Tree 组件 | [TreeProps](/zh-CN/navigation/tree#Tree) | | 1.20.0 |
| type | Transfer 类型，可选`list`，`groupList`，`treeList` | string | 'list' | 1.20.0 |
| value | 已选中值，传入该项时，将作为受控组件使用 | Array<string\|number> |  |  |

### Item Interface

| 属性      | 说明                                 | 类型             | 默认值 |
| --------- | ------------------------------------ | ---------------- | ------ |
| className | 样式类名                             | string           |        |
| disabled  | 是否禁用                             | boolean          | false  |
| key       | 必填，每个选项的唯一标识，不允许重复 | string \| number          |        |
| label     | 选项展示内容                         | ReactNode        |        |
| style     | 内联样式                             | CSSProperties           |        |
| value     | 选项代表的值                         | string \| number |        |

### GroupItem Interface

GroupItem继承Item的所有属性

| 属性     | 说明         | 类型                              | 默认值 |
| -------- | ------------ | --------------------------------- | ------ |
| children | 该分组的元素 | Array<Item\> |        |
| title    | 分组名称     | string                            |        |

### TreeItem Interface

TreeItem 继承 Item 的所有属性

| 属性     | 说明   | 类型             | 默认值 |
| -------- | ------ | ---------------- | ------ |
| children | 子元素 | Array<TreeItem\> |        |

## Methods
绑定在组件实例上的方法，可以通过 ref 调用实现某些特殊交互

| Name    | Description   |
| ------- | ------------- |
| search(value: string)  |  可通过 ref 调用该方法进行搜索，该搜索值会被置给 Input。  |

## 设计变量
<DesignToken/>

<!-- ## 相关物料

```material
52
``` -->