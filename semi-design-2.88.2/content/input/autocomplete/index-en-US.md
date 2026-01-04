---
localeCode: en-US
order: 34
category: Input
title: AutoComplete
icon: doc-autocomplete
brief: The input box is automatically filled.
---

## When to use

Used to provide input suggestions to the input box and perform automatic completion operations

The difference with the searchable Select component:
- AutoComplete is essentially an enhanced Input component that provides input suggestions, while Select is a selector
- When you click to expand, Select will clear all the values in the input box, and AutoComplete will keep the last selected value
- Select's selected item rendering (renderSelectedItem) can be more customized and can be any type of ReactNode, while AutoComplete only allows strings

## Demos

### How to import

```jsx import
import { AutoComplete } from '@douyinfe/semi-ui';
```

### Basic usage

Monitor user input through onSearch, pass input suggestions through data, and maintain control through onChange. OnChange is triggered when the input box changes/selects an input item

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

() => {
    const [stringData, setStringData] = useState([]);
    const [value, setValue] = useState('');
    const handleStringSearch = (value) => {
        let result;
        if (value) {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        } else {
            result = [];
        }
        setStringData(result);
    };

    const handleChange = (value) => {
        console.log('onChange', value);
        setValue(value);
    };
    return (
        <AutoComplete
            data={stringData}
            value={value}
            showClear
            prefix={<IconSearch />}
            placeholder="Search... "
            onSearch={handleStringSearch}
            onChange={handleChange}
            style={{ width: 200 }}
        />
    );
};
```

### Custom option rendering

When you need to customize the rendering of candidates, data can be passed in an array of objects (each Object must contain two keys, label and value, value is the value selected by the candidate, and label is the content displayed by the candidate)
The rendering of candidates can be customized through renderItem

```jsx live=true
import React from 'react';
import { AutoComplete, Avatar } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

class CustomOptionDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [],
            color: ['amber', 'indigo', 'cyan'],
            list: [
                { name: 'Xia', email: 'xiakeman@example.com', abbr: 'XK', color: 'amber' },
                { name: 'Shen', email: 'shenyue@example.com', abbr: 'SY', color: 'indigo' },
                { name: 'Qu', email: 'quchenyi@example.com', abbr: 'CY', color: 'blue' },
                { name: 'Wen', email: 'wenjiamao@example.com', abbr: 'JM', color: 'cyan' },
            ],
        };
    }

    search(value) {
        let result;
        if (value) {
            result = this.state.list.map(item => {
                return { ...item, value: item.name, label: item.email };
            });
        } else {
            result = [];
        }
        this.setState({ data: result });
    }

    renderOption(item) {
        let optionStyle = {
            display: 'flex',
        };
        return (
            <>
                <Avatar color={item.color} size="small">
                    {item.abbr}
                </Avatar>
                <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 14, marginLeft: 4 }}>{item.name}</div>
                    <div style={{ marginLeft: 4 }}>{item.email}</div>
                </div>
            </>
        );
    }

    render() {
        return (
            <AutoComplete
                data={this.state.data}
                prefix={<IconSearch />}
                style={{ width: '250px' }}
                renderSelectedItem={option => option.email}
                renderItem={this.renderOption}
                onSearch={this.search.bind(this)}
                onSelect={v => console.log(v)}
            ></AutoComplete>
        );
    }
}
```

### Remote search

Get user input value from onSearch, update data value dynamically, update loading

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

class ObjectDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            list: [
                { value: 'abc', label: 'douyin', email: '1@gmail.com', type: 2 },
                { value: 'hotsoon', label: 'huoshan', email: '2@gmail.com', type: 3 },
                { value: 'pipixia', label: 'pip', email: '3@gmail.com' },
            ],
            loading: false,
        };
        this.onSearch = this.onSearch.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.renderItem = this.renderItem.bind(this);
        this.renderSelectedItem = this.renderSelectedItem.bind(this);
        this.search = debounce(this.search.bind(this), 200);
    }

    onSearch(inputValue) {
        this.setState({ loading: true });
        this.search(inputValue);
    }

    search(inputValue) {
        let { list } = this.state;
        const newList = list.map(item => {
            let num = Math.random()
                .toString()
                .slice(2, 5);
            let option = inputValue + '-' + num;
            return { ...item, label: 'Name:' + option, value: option };
        });
        this.setState({ list: newList, loading: false });
    }

    handleSelect(value) {
        console.log(value);
    }

    renderItem(item) {
        return (
            <div>
                <div>{item.label}</div>
                <div>email: {item.email}</div>
                <div style={{ color: 'pink' }}>value: {item.value}</div>
            </div>
        );
    }

    renderSelectedItem(item) {
        // Note: Unlike Select, only String type values can be returned here, ReactNode cannot be returned
        return item.value;
    }

    render() {
        const { loading } = this.state;
        return (
            <div>
                <AutoComplete
                    data={this.state.list}
                    style={{ width: 250 }}
                    prefix={<IconSearch />}
                    onSearch={this.onSearch}
                    loading={loading}
                    onChangeWithObject
                    renderItem={this.renderItem}
                    renderSelectedItem={this.renderSelectedItem}
                    onSelect={this.handleSelect}
                ></AutoComplete>
            </div>
        );
    }
}
```

### Size

The size of the input box can be set by setting size, optional `small`, `default` (default), `large`

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';

() => (
    <div>
        <AutoComplete
            data={[1, 2, 3, 4]}
            size="small"
            placeholder={'small'}
            style={{ width: 200 }}
        ></AutoComplete>
        <br />
        <br />
        <AutoComplete
            data={[1, 2, 3, 4]}
            size="default"
            placeholder={'default'}
            style={{ width: 200 }}
        ></AutoComplete>
        <br />
        <br />
        <AutoComplete
            data={[1, 2, 3, 4]}
            size="large"
            placeholder={'large'}
            style={{ width: 200 }}
        ></AutoComplete>
    </div>
);
```

### The position of the drop-down menu

The position of the drop-down menu can be set by setting position, and the optional values refer to Tooltip position

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';

() => (
    <div>
        <AutoComplete
            data={[1, 2, 3, 4]}
            position="top"
            placeholder="The options menu is shown at the top"
            style={{ width: 200, margin: 10 }}
        ></AutoComplete>
        <AutoComplete
            data={[1, 2, 3, 4]}
            position="rightTop"
            placeholder="The options menu is shown on the right"
            style={{ width: 200, margin: 10 }}
        ></AutoComplete>
    </div>
);
```

### Disabled

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';

() => (
    <AutoComplete data={[1, 2, 3, 4]} placeholder={'Disable drop-down menu'} disabled style={{ width: 200 }}></AutoComplete>
);
```

### Validate status

Different verification states can be set to show different styles

```jsx live=true
import React from 'react';
import { AutoComplete } from '@douyinfe/semi-ui';

() => (
    <>
        <AutoComplete defaultValue="ies" validateStatus="warning"></AutoComplete>
        <br />
        <br />
        <AutoComplete defaultValue="ies" validateStatus="error"></AutoComplete>
        <br />
        <br />
        <AutoComplete defaultValue="ies"></AutoComplete>
    </>
);
```

### Custom empty content

Can set up custom display empty content

```jsx live=true
import React from 'react';
import { AutoComplete, Empty } from '@douyinfe/semi-ui';
import { IllustrationNoContent } from '@douyinfe/semi-illustrations';

() => {
    let [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = v => {
        setLoading(true);
        setTimeout(() => {
            if (!v) {
                setData([]);
                setLoading(false);
                return;
            }
            setData(() => {
                const res = Array.from(Array(5)).map(c => Math.random());
                return res;
            });
            setLoading(false);
        }, 1000);
    };

    return (
        <AutoComplete
            loading={loading}
            data={data}
            emptyContent={<Empty style={{ padding: 12, width: 300 }} image={<IllustrationNoContent style={{ width: 150, height: 150 }}/>} description={'no content yet'} />}
            onSearch={fetchData}
        />
    );
};
```

## API reference

| Properties | Instructions                                                                                                                                                                                                                            | Type | Default | Version|
| --- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| --- | --- | -- |
| autoFocus | Whether to auto focus                                                                                                                                                                                                                   | bool | false | 1.16.0|
| autoAdjustOverflow | Whether to automatically adjust the direction when the floating layer is blocked<br/>                                                                                                                                                   | bool | true | 0.27.0|
| className | Style class name                                                                                                                                                                                                                        | string | |
| clearIcon | Can be used to customize the clear button, valid when showClear is true                                                                                                                                                                 | ReactNode | |  2.25.0|
| data | The data source of the candidates, which can be a string array or an object array                                                                                                                                                       | array | [] |
| defaultActiveFirstOption | Whether to highlight the first option by default (press enter to select directly)                                                                                                                                                       | bool | false |
| defaultOpen | Whether to expand the drop-down menu by default                                                                                                                                                                                         | boolean | false |
| defaultValue | Defaults                                                                                                                                                                                                                                | string | |
| disabled | Whether to disable                                                                                                                                                                                                                      | boolean | false |
| dropdownClassName | Css class name of the drop-down list                                                                                                                                                                                                    | string |  |
| dropdownStyle | Inline style of the drop-down list                                                                                                                                                                                                      | object |  |
| emptyContent | Customize the drop-down content when data is empty                                                                                                                                                                                      | ReactNode | null | 1.16.0|
| getPopupContainer | Specify the parent DOM, the floating layer of the drop-down list will be rendered into the DOM, and the customization needs to set `position: relative`  This will change the DOM tree position, but not the view's rendering position.                                                                                 | () => HTMLElement | () => document.body |
| loading | Whether the drop-down list shows loading animation                                                                                                                                                                                      | boolean | false |
| maxHeight | The maximum height of the drop-down list                                                                                                                                                                                                | number\|string | 300 |
| motion | Is there an animation when the drop-down list appears/hidden                                                                                                                                                                            | boolean | true |
| onSelectWithObject | When clicking on the candidate, whether to add other attributes of the selected item option as callback parameters. When set to true, the input parameter type of onSelect will change from `string` to object: {value, label, ...rest} | boolean | false | 1.23.0|
| placeholder | Input box prompt                                                                                                                                                                                                                        | string | |
| position | The display position of the drop-down menu, the optional values are the same as the tooltip component                                                                                                                                   | string | 'bottomLeft' |
| prefix | The prefix tag of the select box                                                                                                                                                                                                        | ReactNode |  | 0.23.0|
| renderItem | Control the rendering of drop-down list candidates                                                                                                                                                                                      | (option: string\|Item)=> React.Node |  |
| renderSelectedItem | Customize the drop-down list through renderSelectedItem after the candidate is clicked and selected, the content rendered in the select box<br/>** only supports the return value of String type **                                     | (option: string\|Item) => string |  | 0.23.0|
| showClear | Whether to show the clear button                                                                                                                                                                                                        | boolean | false |
| size | Size, optional `small`, `default`, `large`                                                                                                                                                                                              | string | `default` |
| style | style                                                                                                                                                                                                                                   | object |  |
| suffix | The prefix tag of the select box                                                                                                                                                                                                        | ReactNode |  | 0.23.0|
| value | The current value                                                                                                                                                                                                                       | string\|number |  |
| validateStatus | Validation status, optional values are `default`, `error`, `warning`, and the default is default. Only affect the display style                                                                                                         | string | 'default' | 1.14.0|
| zIndex | ZIndex of the drop-down menu                                                                                                                                                                                                            | number |  |
| onBlur | Callback when the focus is lost                                                                                                                                                                                                         | Function(event) | |
| onChange | Input box change / change when the candidate is selected                                                                                                                                                                                | Function(value:string\|number) | | 1.23.0|
| onFocus | The callback when the focus is obtained                                                                                                                                                                                                 | Function(event) | |
| onKeyDown | keydown callback                                                                                                                                                                                                                        | (e: React.KeyboardEvent) => void | | 2.21.0 |
| onSearch | Callback when input changes                                                                                                                                                                                                             | Function(value: string) | |
| onSelect | Callback when the drop-down menu candidate is selected                                                                                                                                                                                  | Function(item: string\|number\|Item) | |

## Accessibility
### Keyboard and Focus
- AutoComplete's input box can be focused, and once focused, keyboard users can use `Up Arrow` or `Down Arrow` to open the options panel (if there is a panel)
- AutoComplete also supports opening and closing panels via `Enter` key
- If the user sets the defaultActiveFirstOption property to true, the first option is highlighted by default when the options panel is opened
- If the drop-down menu is open:
   - Use `Esc` to close the menu
   - Use `Up Arrow` or `Down Arrow` to toggle options
   - The focused option can be selected with the `Enter` key and the panel will be collapsed

## Content Guidelines
- Content needs to be presented clearly so that users can clearly perceive the options available
- Limit the number of options displayed at one time

## Design Token
<DesignToken/>