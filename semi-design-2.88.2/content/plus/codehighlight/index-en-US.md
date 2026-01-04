---
localeCode: en-US
order: 28
category: Plus
title:  CodeHighlight
icon: doc-codehighlight
dir: column
brief: Highlight code blocks in the page according to syntax
---

## When to use

Semi `CodeHighlight` component uses `prismjs`, which supports highlighting of 297 programming languages ​​(automatically configured `JavaScript` `CSS` `Class C` `html` `svg`, etc., other languages ​​need to be manually introduced), and has high scalability and rich plug-in ecology.

Pass the code plain text to `code` props, and pass the programming language name to `language`. Supported programming languages ​​and corresponding names can be viewed on the [Prismjs official website](https://prismjs.com/#supported-languages)

## Demos

### How to introduce

CodeHighlight supported from v2.62.0 

```jsx
import { CodeHighlight } from '@douyinfe/semi-ui';
```

### Basic usage

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
    }/>
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
    }/>
}

```


### Support other languages

Support 297 languages. Except for `JavaScript` `CSS` `Class C` `html` `svg`, support for other languages ​​needs to be manually imported and configured.

For example, to highlight the Vala language used to write the front-end UI of GTK programs, you need to import `prism-vala.js`

```javascript
import "prismjs/components/prism-vala.js"
```

```jsx live=true dir=column
import { CodeHighlight } from '@douyinfe/semi-ui';
import "prismjs/components/prism-vala.js"

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
    }/>
}

```


### Customize the theme

Set `defaultTheme={false}` to turn off the default theme, then manually copy the css file of the required theme and import it into the project.
Some themes can be found under prismjs/themes in node_modules, and you can also search for other themes you like on the Internet.

### API

| Property | Description | Type | Default value |
|-----------|---------------------------|--------|------|
| className | Class name | string | - |
| code | Code text | string | - |
| defaultTheme | Whether to use the default theme, set when adding your own theme false | bool | true |
| language | Language type | string | - |
|lineNumber | Whether to enable line number display | boolean | true |
| style | Style | CSSProperties | - |

## Design Tokens

<DesignToken/>


