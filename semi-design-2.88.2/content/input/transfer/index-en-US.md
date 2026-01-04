---
localeCode: en-US
order: 50
category: Input
title: Transfer
icon: doc-transfer
width: 60%
dir: column
brief: A more intuitive and efficient multiple-selection selector, which can reveal more information about options, and supports search functions. The disadvantage is that it takes up more space
---

## Demos

### How to import

```jsx import
import { Transfer } from '@douyinfe/semi-ui';
```

### Basic Usage

dataSource should have value、label、key.

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const data = Array.from({ length: 100 }, (v, i) => {
        return {
            label: `Item ${i}`,
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

### Grouped

Set type to `groupList`

For grouped dataSource, the first-level child elements must have title and children attributes, structure reference <GroupItem\>

Does not support multi-level nesting

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const dataWithGroup = [
        {
            title: 'GroupA',
            children: [
                { label: 'A-1', value: 1, disabled: false, key: 1 },
                { label: 'A-2', value: 2, disabled: false, key: 2 },
                { label: 'A-3', value: 3, disabled: false, key: 3 },
            ],
        },
        {
            title: 'GroupB',
            children: [
                { label: 'B-1', value: 4, disabled: false, key: 4 },
                { label: 'B-2', value: 5, disabled: false, key: 5 },
                { label: 'B-3（disabled）', value: 6, disabled: true, key: 6 },
            ],
        },
        {
            title: 'GroupC',
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

### Custom filtering logic, custom option data rendering

Use `filter` to customize the search logic. When it returns true, it means that the current item meets the filter rules and keeps the display of the current item in the list. If it returns false, it means it does not match, and the current item will be hidden.  
When type is `treeList`, if you need to customize search logic, you need to set `filter` to true and set a custom search function through `filterTreeNode` of `treeProps`.  
Using `renderSourceItem`, you can customize the rendering structure of each source data on the left.  
Using `renderSelectedItem` you can customize the rendering structure of each selected item on the right.

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Avatar, Checkbox, Highlight } from '@douyinfe/semi-ui';
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
        { label: 'Xiakeman', value: 'xiakeman@example.com', abbr: 'Xia', color: 'amber', area: 'US', key: 1 },
        { label: 'Shenyue', value: 'shenyue@example.com', abbr: 'Shen', color: 'indigo', area: 'UK', key: 2 },
        { label: 'Wenjiamao', value: 'wenjiamao@example.com', abbr: 'Wen', color: 'cyan', area: 'HK', key: 3 },
        { label: 'Quchenyi', value: 'quchenyi@example.com', abbr: 'Qu', color: 'blue', area: 'India', key: 4 },
        { label: 'Quchener', value: 'quchener@example.com', abbr: 'Qu', color: 'blue', area: 'India', key: 5 },
        { label: 'Quchensan', value: 'quchensan@example.com', abbr: 'Qu', color: 'blue', area: 'India', key: 6 },
    ];

    return (
        <Transfer
            style={{ width: 568 }}
            dataSource={data}
            filter={customFilter}
            defaultValue={['xiakeman@example.com', 'shenyue@example.com']}
            renderSelectedItem={renderSelectedItem}
            renderSourceItem={renderSourceItem}
            inputProps={{ placeholder: 'Search for a name or email' }}
            onChange={(values, items) => console.log(values, items)}
            onSearch={searchText => setSearchText(searchText)}
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

### Disabled

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const data = Array.from({ length: 20 }, (v, i) => {
        return {
            label: `Item ${i}`,
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

### Drag and drop sort

Set `draggable` to true to enable the drag sort function. Support after v1.11.0

```jsx live=true dir="column"
import React from 'react';
import { Transfer } from '@douyinfe/semi-ui';
() => {
    const data = Array.from({ length: 30 }, (v, i) => {
        return {
            label: `Item ${i}`,
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

### Drag and drop + custom selected rendering

Set `draggable` to true to enable the drag and drop sorting function; use `renderSelectedItem` to customize the rendering of the selected items on the right;
You can define the trigger as any ReactNode you want and add styles. Drag the trigger and use `sortableHandle` to wrap it (sortableHandle is provided after v 1.22.0)

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
        { label: 'Xiakeman', value: 'xiakeman@example.com', abbr: 'Xia', color: 'amber', area: 'US', key: 1 },
        { label: 'Shenyue', value: 'shenyue@example.com', abbr: 'Shen', color: 'indigo', area: 'UK', key: 2 },
        { label: 'Wenjiamao', value: 'wenjiamao@example.com', abbr: 'Wen', color: 'cyan', area: 'HK', key: 3 },
        { label: 'Quchenyi', value: 'quchenyi@example.com', abbr: 'Qu', color: 'blue', area: 'India', key: 4 },
        { label: 'Quchener', value: 'quchener@example.com', abbr: 'Er', color: 'blue', area: 'India', key: 5 },
        { label: 'Quchensan', value: 'quchensan@example.com', abbr: 'San', color: 'blue', area: 'India', key: 6 },
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
            inputProps={{ placeholder: 'Search for a name or email' }}
            onChange={(values, items) => console.log(values, items)}
        />
    );
};
```

### Custom rendering header information in panel

Semi has provided `renderSourceHeader` and `renderSelectedHeader` parameter allows users to customize the header information of the left and right panels since version 2.29.0.   
`renderSourceHeader: (props: SourceHeaderProps) => ReactNode`   
`renderSelectedHeader: (props: SelectedHeaderProps) => ReactNode`   
The parameter types are as follows:

```ts
type SourceHeaderProps = {
    num: number; // The total number of data or the number of filtered results
    showButton: boolean; // Whether to show select all/unselect all buttons
    allChecked: boolean; // Whether the current data has been selected
    onAllClick: () => void // Function that should be called after clicking the select/unselect all button
}

type SelectedHeaderProps = {
    num: number; // The total number of selected data
    showButton: boolean; // Whether to show the clear button
    onClear: () => void // Function that should be called after clicking the clear button
}
```

The example is as follows:

```jsx live=true dir="column"
import React from 'react';
import { Transfer, Button } from '@douyinfe/semi-ui';

() => {
    const data = Array.from({ length: 30 }, (v, i) => {
        return {
            label: `Item ${i}`,
            value: i,
            disabled: false,
            key: `key-${i}`,
        };
    });

    const renderSourceHeader = (props) => {
        const { num, showButton, allChecked, onAllClick } = props;
        return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
            <span>Total {num} items</span>
            {showButton && <Button
                theme="borderless"
                type="tertiary"
                size="small" 
                onClick={onAllClick}>{ allChecked ? 'Unselect all' : 'Select all' }</Button>}
        </div>;
    };

    const renderSelectedHeader = (props) => {
        const { num, showButton, onClear } = props;
        return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
            <span>{num} items selected</span>
            {showButton && <Button
                theme="borderless"
                type="tertiary"
                size="small"
                onClick={onClear}>Clear</Button>}
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

### Fully custom rendering

Semi provides `renderSourcePanel` and `renderSelectedPanel` input parameters, allowing you to completely customize the rendering structure of the left and right panels
With this function, you can directly reuse the logic capabilities inside the Transfer to implement the `Transfer` component with a highly customized style structure `renderSourcePanel: (sourcePanelProps: SourcePanelProps) => ReactNode`
`SourcePanelProps` contains the following parameters, from which you can get data to render your Panel structure

```ts
interface SourcePanelProps {
   value: Array<string|number>; // key of all selected items
   loading: boolean; // Whether loading
   noMatch: boolean; // Whether there is no matching item that matches the current search value
   filterData: Array<Item> // items that match the current search value
   sourceData: Array<Item>; // All items
   allChecked: boolean; // Whether to select all
   showNumber: number; // Filter the number of results
   inputValue: string; // the value of the input search box
   onSearch: (searchString: string) => any; // The function that should be called when the search box changes, the input parameter is the search value
   onAllClick: () => void; // The function that should be called when all the buttons on the left are clicked
   onSelectOrRemove: (item: Item) => any; //The function that should be called when selecting or deleting a single option, the input should be the current operation item
   onSelect: (value:Array<string|number>)=>void; // controlled batch selection key
   selectedItem: Map, // collection of all selected items
}
```

`renderSelectedPanel: (selectedPanelProps: SelectedPanelProps) => ReactNode`
`SelectedPanelProps` contains the following parameters

```ts
interface SelectedPanelProps {
   length: number; // number of selected options
   onClear: () => void; // The callback function that should be called when clicking to clear
   onRemove: (item: Item) => void; // The function that should be called when deleting a single option
   onSortEnd: (( oldIndex, newIndex)) => void; // The function that should be called when reordering the results
   selectedData: Array<Item>; // All selected items collection
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
                label: `Hdl Store ${i}`,
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
        let buttonText = 'delete';
        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? 'delete' : 'add';
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
                content = <div className="empty sp-font">{inputValue ? 'No search results' : 'No content yet'}</div>;
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
                <div className="panel-header sp-font">Store list</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>Store to be selected: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? 'Unselect all' : 'Select all'}
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
            mainContent = <div className="empty sp-font">No data, please filter from the left</div>;
        }

        return (
            <section className="selected-panel">
                <div className="panel-header sp-font">
                    <div>Selected: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || 'Clear '}
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

### Fully custom rendering, drag and drop sorting

In a completely custom rendering scene, since the rendering of the drag area has also been completely taken over by you, you do not need to declare draggable.
But you need to implement the drag and drop logic yourself, You can use the drag-and-drop tool library [dnd-kit](https://github.com/clauderic/dnd-kit) or [react-sortable-hoc](https://github.com/clauderic/react-sortable-hoc), quickly realize the function. Regarding the selection of the two, here are some of our suggestions.

- Both are maintained by the same author, dnd-kit is the successor of react-sortable-hoc
- The API design of react-sortable-hoc is more cohesive, and the code is more concise in simple scenarios. But it strongly relies on the findDOMNode API, which will be deprecated in future React versions. At the same time, the library has not been maintained for the past two years.
- Relatively speaking, dnd-kit has a certain threshold for getting started, but it has a higher degree of freedom, stronger scalability, and is still under maintenance. we recommend it.

Besides, To support drag sorting, you need to call onSortEnd with oldIndex and newIndex as the input parameters after the drag sorting is over

Example using react-sortable-hoc:

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
                label: `Hdl Store ${i}`,
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
        let buttonText = 'delete';
        let newItem = item;

        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? 'delete' : 'add';
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
                content = <div className="empty sp-font">{inputValue ? 'No search results' : 'No content yet'}</div>;
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
                <div className="panel-header sp-font">Store list</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>Store to be selected: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? 'Unselect all' : 'Select all'}
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
            mainContent = <div className="empty sp-font">No data, please filter from the left</div>;
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
                    <div>Selected: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || 'Clear '}
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

Example using dnd-kit，The core dependencies that need to be used are @dnd-kit/sortable, @dnd-kit/core. The core hooks are useSortable, and the usage instructions of useSortable are as follows

```
1. Function: Obtain the necessary information during the drag and drop process through the unique id
2. Core input parameters:
    - id: unique identifier, which can be a number or a string, but cannot be a number 0
3. Core return value description:
    - setNodeRef: Associate the dom node to make it a draggable item
    - listeners: Contains onKeyDown, onPointerDown and other methods, mainly to allow nodes to be dragged
    - transform: the movement change value when the node is dragged
    - transition: transition effect
    - active: information about the dragged node, including id
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
    // sensors determine which external input is affected by the drag operation (such as mouse, keyboard, touchpad)
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

    // Drag end callback
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
            // Set the scrolling when dragging to start from the ancestor element closest to the dragged element
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
                label: `Hdl Store ${i}`,
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
        let buttonText = 'delete';

        if (type === 'source') {
            let checked = selectedItems.has(item.key);
            buttonText = checked ? 'delete' : 'add';
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
                content = <div className="empty sp-font">{inputValue ? 'No search results' : 'No content yet'}</div>;
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
                <div className="panel-header sp-font">Store list</div>
                <div className="panel-main">
                    <Input
                        style={{ width: 454, margin: '12px 14px' }}
                        prefix={<IconSearch />}
                        onChange={onSearch}
                        showClear
                    />
                    <div className="panel-controls sp-font">
                        <span>Store to be selected: {filterData.length}</span>
                        <Button onClick={onAllClick} theme="borderless" size="small">
                            {allChecked ? 'Unselect all' : 'Select all'}
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
            mainContent = <div className="empty sp-font">No data, please filter from the left</div>;
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
                    <div>Selected: {selectedData.length}</div>
                    <Button theme="borderless" type="primary" onClick={onClear} size="small">
                        {clearText || 'Clear '}
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

### Tree Transfer

The input type is `treeList`, and the [`Tree`](/en-US/navigation/tree) component is used as a custom rendering list. **v1.20.0 available**

The properties of the default tree can be overridden by treeProps([TreeProps](/en-US/navigation/tree)). The default properties of the tree on the left are

```ts
interface Default TreeProps {
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

- Add `role` `search` to the search box
- Add `role` `list` to the selected list on the right, add `role` `listitem` to the selected item

## API Reference

### Transfer Props

| props | description | data type | default | version |
| --- | --- | --- | --- | --- |
| className | Style class name | string | | |
| dataSource | Data Source | Array<Item\>\|Array<GroupItem\>\|Array<TreeItem\> | [] | |
| defaultValue | Default selected value | Array<string\|number> | | |
| disabled | Whether to disable | boolean | false | |
| draggable | Whether to enable drag sorting | boolean | false | |
| emptyContent | Custom empty state prompt text, search is the text displayed when there are no search results, left is the text when there is no source data on the left, and right is the prompt text when no data is checked | {left: ReactNode; right: ReactNode; search: ReactNode;} | | |
| filter | Custom filter logic, when false, the search box is not displayed. When type is `treeList`, if you need to customize search logic, you need to set `filter` to true and set a custom search function through `filterTreeNode` of `treeProps`. | boolean \| (input:string, item: Item) => boolean | true | |
| inputProps | Can be used to customize the search box Input, the configurable properties refer to the Input component, the value and onChange parameters will be used inside Transfer, users should not use them. If you want to search through external data, you can call the search method of Transfer | [InputProps](/en-US/input/input#Input) | | |
| loading | Whether the left option is being loaded | boolean |-| |
| onChange | The callback that is triggered when the selected value changes, and the callback is also triggered after the drag sort changes | (values: Array<string\|number>, items: Array<Item\>) => void | | |
| onDeselect | Callback when unchecking | (item: Item) => void | | |
| onSearch | Called when the input content of the search box changes | (inputValue: string) => void | | |
| onSelect | Callback when checked | (item: Item) => void | | |
| renderSelectedHeader | Customize the rendering of the header information on the right panel | (props: SelectedHeaderProps) => ReactNode |  | 2.29.0 |
| renderSelectedItem | Customize the rendering of a single selected item on the right | (item: {onRemove, sortableHandle} & Item) => ReactNode | | |
| renderSelectedPanel | Customize the rendering of the selected panel on the right | (selectedPanelProps) => ReactNode | | 1.11.0 |
| renderSourceHeader | Customize the rendering of the header information on the left panel | (props: SourceHeaderProps) => ReactNode |  | 2.29.0 |
| renderSourceItem | Customize the rendering of a single candidate item on the left | (item: {onChange, checked} & Item) => ReactNode | | |
| renderSourcePanel | Customize the rendering of the left candidate panel | (sourcePanelProps) => ReactNode | | 1.11.0 |
| showPath | When the type is `treeList`, control whether the selected item on the right shows the selection path | boolean | false | 1.20.0 |
| style | Inline style | CSSProperties | | |
| treeProps | When the type is `treeList`, it can be passed as TreeProps to the Tree component on the left | [TreeProps](/en-US/navigation/tree#Tree) | | 1.20.0 |
| type | Transfer type, optional `list`, `groupList`, `treeList` | string |'list' | 1.20.0 |
| value | The selected value, when the item is passed in, it will be used as a controlled component | Array<string\|number> | | |

### Item Interface

| props | description | data type | default | version |
| --- | --- | --- | --- | --- |
| className | Style class name | string | |
| disabled | Whether to disable | boolean | false |
| key | Required, unique identification of each option, no repetition is allowed | string \| number | |
| label | Options display content | ReactNode | |
| style | Inline style | CSSProperties | |
| value | The value represented by the option | string \| number | |

### GroupItem Interface

GroupItem inherits all the properties of Item

| props    | description           | data type                         | default | version |
| -------- | --------------------- | --------------------------------- | ------- | ------- |
| children | Elements of the group | array<Item\> |         |         |
| title    | Group Name            | string                            |         |         |

### TreeItem Interface

TreeItem inherits all the properties of Item

| props    | description    | data type        | default |
| -------- | -------------- | ---------------- | ------- |
| children | Children Items | array<TreeItem\> |         |

## Methods
Some internal methods provided by Transfer can be accessed through ref:

| Name    | Description   |
| ------- | ------------- |
| search(value: string)  |  You can call this method through ref to search, and the search value will be set to Input.  |

## Design Tokens
<DesignToken/>

## Related materials

```material
52
```
