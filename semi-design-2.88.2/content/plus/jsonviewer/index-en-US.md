---
localeCode: en-US
order: 31
category: Plus
title: JsonViewer
icon: doc-jsonviewer
dir: column
noInline: true
brief: Used for displaying and editing JSON data
---

## When to use

The JsonViewer component can be used for the display and editing of JSON data.

Semi mainly referred to the design concept of the `text-buffer` data structure of [VS Code](https://github.com/microsoft/vscode), reused some utilities and data type definitions (Token parsing, language services, etc.), and implemented the JsonViewer component in combination with our functional/style customization requirements. Visually, it will be more coordinated with other components within the Semi Design system, and it will be more convenient for customized rendering and customization of specific data types.

Compared with directly using MonacoEditor, Semi JsonViewer has additional processing in engineering construction, is simpler to use, and there is no need to pay attention to complex configurations such as Webpack plugins and worker loaders. At the same time, since we only focus on the JSON data format, it is more lightweight. While being ready to use out of the box, it has a smaller size **(📦-96%)**, a more extreme loading speed **(🚀 -53.5%)**, and less memory occupation **(⬇️71.6% reduction)**. For data with five million lines and below, data loading and parsing can be completed within 1 second.

Detailed comparison data can be referred to in the [Performance](#Performance) section.

-   If you only need to preview/edit JSON and don't need to modify other more complex programming languages, we recommend that you choose `JsonViewer`.
-   If you also need to handle data/code files in other formats and the full capabilities of a code editor (syntax highlighting, code completion, error prompts, complex editing, etc.) are essential and the build product size is not a key concern, we recommend that you choose `Monaco Editor`.

## Demos

### How to import

JsonViewer supported from v2.71.0

```jsx import
import { JsonViewer } from '@douyinfe/semi-ui';
```

### Basic Usage

Basic usage of JsonViewer. Pass in the `height` and `width` parameters to set the height, width and initial value of the component. Pass in the JSON string through the `value`.
Note: JsonViewer is an uncontrolled component. If the value prop is passed as a controlled property (i.e., React State), it is not recommended to modify the value prop (setState) in onChange. If you need to get the component's value, you can get it through ref, please refer to [Methods](#Methods) for details.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { JsonViewer } from '@douyinfe/semi-ui';
const data = `{
    "name": "Semi",
    "version": "0.0.0"
}`;
class SimpleJsonViewer extends React.Component {
    render() {
        return (
            <div style={{ marginBottom: 16 }}>
                <JsonViewer height={100} width={700} value={data} />
            </div>
        );
    }
}

render(SimpleJsonViewer);
```

### Differrent lineHeight

Configure the `lineHeight` parameter of `options` to set a fixed line height (unit: px, default 18).

```jsx live=true dir="column" noInline=true
import React from 'react';
import { JsonViewer, Space } from '@douyinfe/semi-ui';
const data = `{
    "name": "Semi",
    "version": "0.0.0"
}`;
class SimpleJsonViewerWithLineHeight extends React.Component {
    render() {
        return (
            <div>
                <div style={{ marginBottom: 20 }}>
                    <JsonViewer height={100} width={700} value={data} options={{ lineHeight: 20 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <JsonViewer height={120} width={700} value={data} options={{ lineHeight: 24 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <JsonViewer height={120} width={700} value={data} options={{ lineHeight: 26 }} />
                </div>
            </div>
        );
    }
}

render(SimpleJsonViewerWithLineHeight);
```

### Autowrap

Configure the `autoWrap` parameter of `options`. When it is set to `true`, the component will automatically wrap lines according to the length of the content.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { JsonViewer } from '@douyinfe/semi-ui';
const data = `{
    "name": "Semi",
    "version": "0.0.0",
    "description": "Semi Design is a design system that defines a set of mid_back design and front_end basic components."
}`;
class SimpleJsonViewerWithAutoWrap extends React.Component {
    render() {
        return (
            <div style={{ marginBottom: 16 }}>
                <JsonViewer height={120} width={700} value={data} options={{ autoWrap: true }} />
            </div>
        );
    }
}

render(SimpleJsonViewerWithAutoWrap);
```

### Format options

Configure `options.formatOptions` to set the formatting configuration of the component.

-   tabSize: number，set the indent size to 4, which means each level of indentation is 4 spaces.
-   insertSpaces: boolean，when it is true, it means using spaces for indentation, and when it is false, it means using tabs.
-   eol: string，set the line break character, which can be `\n`，`\r\n`，

```jsx live=true dir="column" noInline=true
import React, { useRef } from 'react';
import { JsonViewer, Button } from '@douyinfe/semi-ui';
const data = `{
  "name": "Semi",
  "version": "0.0.0"
}`;
function FormatJsonComponent() {
    const jsonviewerRef = useRef();
    return (
        <div>
            <Button onClick={() => console.log(jsonviewerRef.current.format())}>Manual Format</Button>
            <div style={{ marginBottom: 16, marginTop: 16 }}>
                <JsonViewer
                    ref={jsonviewerRef}
                    height={100}
                    width={700}
                    value={data}
                    options={{ formatOptions: { tabSize: 4, insertSpaces: true, eol: '\n' } }}
                />
            </div>
        </div>
    );
}

render(FormatJsonComponent);
```

### Custom Render Rules

By configuring the `options.customRenderRule` parameter, you can customize how JSON content is rendered (Note: only works in read-only mode).

`customRenderRule` is an array of rules, where each rule contains two properties:
- `match`: Matching condition, can be one of three types:
  - String: Exact match
  - Regular expression: Match by regex
  - Function: Custom matching logic, with signature `(value: string, pathChain: string) => boolean`
    - `value`: Value to match (key or value from JSON key-value pairs, as strings since internal processing only filters quotes)
    - `path`: Current matching path, format is `root.key1.key2.key3[0].key4`
- `render`: Custom render function, with signature `(content: string) => React.ReactNode`
  - `content`: Matched content. For string values, includes double quotes (e.g., `"name"`, `"Semi"`)

```jsx live=true dir="column" noInline=true
import React, { useRef } from 'react';
import { JsonViewer, Button, Rating, Popover, Tag, Image } from '@douyinfe/semi-ui';
const data = `{
  "name": "Semi",
  "version": "2.7.4",
  "rating": 5,
  "tags": ["design", "react", "ui"],
  "image": "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
}`;
function CustomRenderJsonComponent() {
    const jsonviewerRef = useRef();
    const customRenderRule = [
        {
            match: 'Semi',
            render: (content) => {
                return <Popover showArrow content={'I am a custom render'} trigger='hover'><span>{content}</span></Popover>;
            }
        },
        {
            match: (value)=> value == 5,
            render: (content) => {
                return <Rating defaultValue={content} size={10} disabled/>;
            }
        },
        {
            match: (value, path)=> path === 'root.tags[0]' || path === 'root.tags[1]' || path === 'root.tags[2]',
            render: (content) => {
                return <Tag size='small' shape='circle'>{content}</Tag>;
            }
        },
        {
            match: new RegExp('^http'),
            render: (content) => {
                // content is original string with quotes, need to remove quotes for valid URL
                return <Popover showArrow content={<Image width={100} height={100} src={content.replace(/^"|"$/g, '')} />} trigger='hover'><span>{content}</span></Popover>;
            }
        }
    ];
    return (
        <div>
            <div style={{ marginBottom: 16, marginTop: 16 }}>
                <JsonViewer
                    ref={jsonviewerRef}
                    height={200}
                    width={600}
                    value={data}
                    showSearch={false}
                    options={{ formatOptions: { tabSize: 4, insertSpaces: true, eol: '\n' }, customRenderRule, readOnly: true, autoWrap: true }}
                />
            </div>
        </div>
    );
}

render(CustomRenderJsonComponent);
```

## API Reference

### JsonViewer

| Attribute | Description | Type | Default |
| --- | --- | --- | --- |
| value | Display content | string | - |
| height | Height of wrapper DOM | number | - |
| width | Width of wrapper DOM | number | - |
| className | className of wrapper DOM | string | - |
| style | InlineStyle of wrapper DOM | object | - |
| showSearch | Whether to show search icon | boolean | true |
| options | Formatting configuration | JsonViewerOptions | - |
| onChange | Callback for content change | (value: string) => void | - |

### JsonViewerOptions

| Attribute     | Description                             | Type              | Default | Version |
| ------------- | --------------------------------------- | ----------------- | ------- | ------- |
| lineHeight    | Height of each line of content, unit:px | number            | 20      | -       |
| autoWrap      | Whether to wrap lines automatically.    | boolean           | true    | -       |
| readOnly      | Whether to be read-only.    | boolean           | false    | -       |
| customRenderRule | Custom render rules | CustomRenderRule[] | -       | 2.74.0  |
| formatOptions | Content format setting                  | FormattingOptions | -       | -       |

### FormattingOptions

| Attribute    | Description                           | Type    | Default |
| ------------ | ------------------------------------- | ------- | ------- |
| tabSize      | Indent size. Unit: px                 | number  | 4       |
| insertSpaces | Whether to use spaces for indentation | boolean | true    |
| eol          | Line break character                  | string  | '\n'    |

### CustomRenderRule

| Attribute | Description | Type | Default |
| --- | --- | --- | --- |
| match | Matching rule | string \| RegExp \| (value: string, path: string) => boolean | - |
| render | Render function | (content: string) => React.ReactNode | - |

## Methods

Methods bound to the component instance can be called via `ref` to achieve certain special interactions.

| Method     | Description            |
| ---------- | ---------------------- |
| getValue() | Get current value      |
| format()   | Format current content |
| search(searchText: string, caseSensitive?: boolean, wholeWord?: boolean, regex?: boolean) | Search for text with optional parameters |
| getSearchResults() | Get current search results |
| prevSearch(step?: number) | Navigate to previous search result, with optional step size |
| nextSearch(step?: number) | Navigate to next search result, with optional step size |
| replace(replaceText: string) | Replace current search match |
| replaceAll(replaceText: string) | Replace all search matches |

### Performance

#### Bundle Size

| Libs Name    | Size      | Size (Gzip) |
| ------------ | --------- | ----------- |
| JsonViewer   | 203.14kb  | 51.23kb     |
| MonacoEditor | 5102.0 KB | 1322.7 KB   |

#### Time for rendering data of different magnitudes.

> For details on the generation method of the test data, please refer to [URL](https://github.com/DouyinFE/semi-design/blob/main/packages/semi-ui/jsonViewer/_story/jsonViewer.stories.jsx)  
> When the data volume exceeds 500,000 lines, ReactMonacoEditor turns off highlighting and other behaviors by default, and the data comparison does not follow the principle of a single variable.

| Libs Name | 1k lines | 5k lines | 10 thousand lines | 100 thousand lines | 500 thousand lines | 1 million lines | 3 million lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JsonViewer | 30.42ms | 30.66ms | 36.87ms | 52.73ms | 111.02ms | 178.81ms | 506.25ms |
| ReactMonacoEditor | 72.01ms | 73.76ms | 76.64ms | 97.89ms | 133.31ms | 202.79ms | 495.53ms |
| Performance improvement | 57.70% | 58.41% | 51.87% | 46.11% | - | - | - |
