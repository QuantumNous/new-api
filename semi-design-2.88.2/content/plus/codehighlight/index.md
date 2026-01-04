---
localeCode: zh-CN
order: 28
category: Plus
title:  CodeHighlight 代码高亮
icon: doc-codehighlight
dir: column
brief: 根据语法高亮页面中的代码块
---

## 使用场景
Semi 代码高亮组件基于 prismjs 封装，支持297 种编程语言的高亮（已自动配置 `JavaScript` `CSS` `类 C` `html` `svg` 等，其他语言需要手动引入），同时具有高扩展性和丰富的插件生态。  
需要展示代码片段时推荐使用 CodeHighlight 组件

## 代码演示

### 如何引入

CodeHighlight 从 v2.62.0 开始支持

```jsx
import { CodeHighlight } from '@douyinfe/semi-ui';
```

### 基本用法
向 `code` props 传入代码纯文本，并在 `language` 传入编程语言名称。支持的编程语言和对应名称在 [Prismjs 官网](https://prismjs.com/#supported-languages) 查看

```jsx live=true dir=column
import { CodeHighlight } from '@douyinfe/semi-ui';

function Demo() {

    return <CodeHighlight
        language={"javascript"} 
        code={
            `
import * as React from 'react"
const Test = ()=>{
    const handleClick = ()=>{
        alert("Click")
    }
    return <div onClick={handleClick}>test</div>
}`
    }/>;
}

```

**CSS**

```jsx live=true dir=column
import { CodeHighlight } from '@douyinfe/semi-ui';

function Demo() {

    return <CodeHighlight
        language={"css"} 
        code={
            `.grid {
    .semi-row,
    .semi-row-flex {
        text-align: center;
        .semi-col {
            min-height: 30px;
            line-height: 30px;
            background: var(--semi-color-primary-light-default);
            outline: 1px solid var(--semi-color-primary-light-active);
        }
    }
}
`
    }/>;
}

```


### 支持其他语言

支持 297 种语言，除去 `JavaScript` `CSS` `类 C` `html` `svg` 外，支持其他语言需要手动引入配置。 


例如，高亮用于编写 GTK 程序前端 UI 的 Vala 语言，需要引入 `prism-vala.js` 

```javascript
import "prismjs/components/prism-vala.js"
```

```jsx live=true dir="column"
import { CodeHighlight } from '@douyinfe/semi-ui';
import "prismjs/components/prism-vala.js";

function Demo() {
    return <CodeHighlight
        language={"vala"} 
        code={
            `public class ExampleApp : Gtk.Application {
    public ExampleApp () {
        Object (application_id: "com.example.App");
    }

    public override void activate () {
        var win = new Gtk.ApplicationWindow (this);

        var btn = new Gtk.Button.with_label ("Hello World");
        btn.clicked.connect (win.close);

        win.child = btn;
        win.present ();
    }

    public static int main (string[] args) {
        var app = new ExampleApp ();
        return app.run (args);
    }
}
`
    }/>;
}

```


### 自定义主题

设置 `defaultTheme={false}` 关闭默认主题，然后手动将需要的主题的 css 文件拷贝并放入项目中引入即可。
一些主题可在 node_modules 内 prismjs/themes 下找到，你也可以在网上搜索其他中意的主题。



### API

| 属性        | 说明                        | 类型     | 默认值  |
|-----------|---------------------------|--------|------|
| className | 类名                        | string | -    |
| code      | 代码纯文本                     | string | -    |
| defaultTheme | 是否使用默认主题，添加自己的主题时设置 false | bool | true |
| language  | 语言类型                      | string | -    |
|lineNumber | 是否开启行数显示                  | boolean | true |
| style | 样式                        | CSSProperties | -    |

## 设计变量

<DesignToken/>


