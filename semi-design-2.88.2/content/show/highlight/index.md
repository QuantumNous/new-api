---
localeCode: zh-CN
order: 71
category: 展示类
title: Highlight 高亮文本
icon: doc-highlight
dir: column
noInline: true
brief: 高亮特定内容
---

## 代码演示

### 如何引入

Highlight 从 v2.24.0 版本开始支持

```jsx import
import { Highlight } from '@douyinfe/semi-ui';
```

### 基本用法

你可以通过 `searchWords` 指定需要高亮的关键字，通过 `sourceString` 指定源文本

<Notice title='注意事项'>
Highlight 组件会将文本被拆分成多个独立的行内元素，任何分割文本流的 CSS 布局（如 flex 布局）可能会将高亮文本断开，为避免高亮内容被浏览器拆分到不同行或列，请按需使用元素包裹 Highlight 组件。
</Notice>



```jsx live=true dir="column"
import React from 'react';
import { Highlight } from '@douyinfe/semi-ui';

() => {
    const sourceString = '从 Semi Design 到 Any Design  快速定义你的设计系统，并应用在设计稿和代码中';
    const searchWords = ['设计系统', 'Semi Design'];
    
    return (<h2>
        <Highlight sourceString={sourceString} searchWords={searchWords} />
    </h2>);
};
```

### 指定高亮样式

默认情况下，高亮文本会自带文本样式，背景颜色 --semi-yellow-4, 文本颜色为黑色  
暗色模式下，背景颜色为 --semi-yellow-2，文本颜色为白色   
当你需要自定义不同的高亮样式时，你可以通过 `highlightClassName`, `highlightStyle`来指定 

```jsx live=true dir="column"
import React from 'react';
import { Highlight } from '@douyinfe/semi-ui';

() => {
    const sourceString = '从 Semi Design 到 Any Design 快速定义你的设计系统，并应用在设计稿和代码中';
    const searchWords = ['设计系统', 'Semi Design'];
    
    return (
        <>
            <h2>
                <Highlight
                    sourceString={sourceString}
                    searchWords={searchWords}
                    highlightStyle={{
                        borderRadius: 6,
                        marginLeft: 4,
                        marginRight: 4,
                        paddingLeft: 4,
                        paddingRight: 4,
                        backgroundColor: 'rgba(var(--semi-teal-5), 1)',
                        color: 'rgba(var(--semi-white), 1)'
                    }}
                />
            </h2>
            <h2>
                <Highlight
                    sourceString={sourceString}
                    searchWords={searchWords}
                    highlightStyle={{
                        borderRadius: 6,
                        marginLeft: 4,
                        marginRight: 4,
                        paddingLeft: 4,
                        paddingRight: 4,
                        backgroundColor: 'var(--semi-color-primary)',
                        color: 'rgba(var(--semi-white), 1)'
                    }}
                />
            </h2>
        </>
    );
};
```

### 不同文本使用差异化样式
v2.71.0 后，支持针对不同的高亮文本使用不同的高亮样式
searchWords 默认为字符串数组。当传入对象数组时，可以通过 text指定高亮文本，同时单独指定 className、style

```jsx live=true dir="column"
import React from 'react';
import { Highlight } from '@douyinfe/semi-ui';

() => {
    return (
        <h2>
            <Highlight
                component='span'
                sourceString='从 Semi Design 到 Any Design  快速定义你的设计系统，并应用在设计稿和代码中'
                searchWords={[
                    { text: 'Semi', style: { backgroundColor: 'rgba(var(--semi-teal-5), 1)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword1' },
                    { text: '设计系统', style: { backgroundColor: 'var(--semi-color-primary)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword2' },
                    { text: '设计稿和代码', style: { backgroundColor: 'rgba(var(--semi-violet-5), 1)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword3' },
                ]}
                highlightStyle={{ borderRadius: 4 }}
            />
        </h2>
    );
};
```


### 指定高亮标签

Semi 默认会将 sourceString 中与 searchWords 匹配的文本用 mark 标签包裹，你也可以通过 `component` 重新指定标签

```jsx live=true dir="column"
import React from 'react';
import { Highlight } from '@douyinfe/semi-ui';

() => {
    const sourceString = '从 Semi Design 到 Any Design  快速定义你的设计系统，并应用在设计稿和代码中';
    const searchWords = ['设计系统', 'Semi Design'];
    
    return (<h2>
        <Highlight
            sourceString={sourceString}
            searchWords={searchWords}
            component='strong'
        />
    </h2>);
};
```


## API 参考

### Highlight

| 属性         | 说明                                                     | 类型                             | 默认值     |
| ------------ | -------------------------------------------------------- | -------------------------------- | ---------- |
| searchWords  | 期望高亮显示的文本（对象数组在v2.71后支持）                     | string[]\|object[]                          | []   |
| sourceString | 源文本                                      | string                           |           |
| component   | 高亮标签                                              | string                           | `mark`          |
| highlightClassName | 高亮标签的样式类名                                         | string                        | -          |
| highlightStyle   | 高亮标签的内联样式                                           | CSSProperties                        | -          |
| caseSensitive    | 是否大小写敏感                                            | false  | -          |
| autoEscape       | 是否自动转义                                                | true                        | -          |
