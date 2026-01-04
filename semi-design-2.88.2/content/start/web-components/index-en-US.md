---
category: Getting Started
title: Web Components
icon: doc-webcomponents
localeCode: en-US
order: 13
brief: Semi UI 在 web components 中使用的最佳实践
---

[Web components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) is a set of techniques for creating reusable custom elements that are compatible across browsers and frameworks , has good encapsulation and reusability, and is widely used in developing browser plug-ins and cross-frame components.

More efficient custom element development can be achieved with the help of component libraries, but the [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) technology in web components has <strong>style isolation</strong> and <strong>DOM encapsulation</strong> features can cause some problems when using component library components. Most component libraries cannot work properly in the shadow DOM without additional adaptations. Generally speaking, there will be the following problems:

## Problems

** 1. Component style does not take effect **

In the ordinary compilation process, the component style information of the component library will appear in the style tag of the head part after compilation, or in the file specified by the link tag href. Due to the style isolation mechanism, styles cannot cross the shadow DOM boundary and therefore cannot take effect inside the shadow DOM.

** 2. Css variable does not take effect **

In order to achieve theme customization, most modern UI component libraries use css variables to declare design tokens. In order to take effect globally and avoid repeated declarations, these css tokens are often appended under the root node, such as html or body. Semi also adopts this method to achieve theme customization. <br/>
Inserting style information into the shadow DOM can solve problem 1 and make the component's style class name effective. However, since there is no body or html in the shadow DOM, the css variable cannot take effect, and the component style still does not meet expectations.

** 3. Abnormal behavior when closing the pop-up layer component **

For pop-up layer components (such as Tooltip, Select, Dropdown, etc.), a common scenario in the front-end component library is to trigger the opening and closing of the pop-up layer by clicking. A common solution used by front-end component libraries is to delegate the click event to the document after the pop-up layer is opened to monitor whether the user clicks on other page elements outside the pop-up layer component to close the pop-up layer. <br/>
When an event triggered in the shadow DOM is passed outside the shadow DOM, due to DOM isolation, the correct event triggering object cannot be obtained through the target API of the event. <br/>
When the click behavior occurs in the shadow DOM, the target obtained by the event Event on the document is the shadow host (the node where the shadow DOM is appended), not the actual triggering element of the event, which often leads to abnormal closing behavior of the pop-up layer component.

## Recommended usage

### Semi version requirements

In response to the above common problems, Semi UI has been adapted and transformed without additional development costs. If you need shadow DOM to use with Semi UI. We recommend that you upgrade to <strong>v2.59.0 and above</strong>, and refer to the [Use Plugins to Complete Style Insertion](#use-plugins-to-complete-style-insertion) section below to enable compilation configuration as needed.


### Use Plugins to Complete Style Insertion

#### Usage
<Notice>
  It is recommended to manage dependent packages through npm. If you use yarn/pnpm to manage dependent packages, you need to specify the actual path of @douyinfe/semi-ui, @douyinfe/semi-icons,  and @douyinfe/semi-foundation through resolve.alias
</Notice>

** 1. Enable Semi plugin (>= 2.59.0); **

(For ByteDance users, if you are using the company’s internal engineering solutions, please refer to the Lark documentation for configuration: <a href="https://bytedance.larkoffice.com/docx/PqMwd7lFko6ECTxmmcFcnWIQnmg" target="_blank">Plugin configuration</a>)

For webpack project：

```bash
yarn add -D @douyinfe/semi-webpack-plugin
```

For rspack project：

```bash
yarn add -D @douyinfe/semi-rspack-plugin
```

** 2. Introduce the Semi webpack plugin into the project configuration file (webpack.config.js, etc.) and configure the webComponentPath parameter; ** 

```js
// webComponentPath: Specify the path of the shadow DOM where the style needs to be inserted.
// 1. Support Boolean type, pass in true, which is the default path src/*
// 2. Supports RegExp regular expressions, matching paths through regular expressions
webComponentPath: Boolean | RegExp
```

For example, if the shadow DOM is under the path src/components, configure the following:

For webpack project:
```js
// Configuration file: such as webpack.config.js
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    /*...other settings */
    plugin: [
        /*...other plugins */
        new SemiPlugin({
            webComponentPath: /\(src\/components\)/
        }),
    ]
}
```

For rspack project:
```js
// Rspack project configuration file: such as rsbuild.config.mjs
import { defineConfig } from '@rsbuild/core';
const RspackPlugin = require('@douyinfe/semi-rspack-plugin').SemiRspackPlugin;

export default defineConfig({
  /*...other settings */
  tools: {
    rspack: (config, { addRules }) => {
      config.module?.rules?.forEach((rule) => {
        if ((rule?.test)?.toString() === '/\\.s(?:a|c)ss$/' ) {
          rule['exclude'] = /@douyinfe\/semi-(ui|icons|foundation)\/lib\/.+\.scss$/;
        }
      });

      config.plugins.push(new SemiPlugin({
        webComponentPath: true,
      }));
    }
  } 
  /*...other settings */
});
```


** 3. In the code of the shadow DOM where the style needs to be inserted, call the `importSemiComponentStyle` function ** 

```js
function importSemiComponentStyle(
    // Component string that needs to be inserted into the style, fixed format
    // Starts with SEMI_INSERT_STYLE_BEGIN
    // End with SEMI_INSERT_STYLE_END
    // The middle is the component array,
    insertComponentStr: string,
    // The shadow root where the style is inserted
    root: ShadowRoot,
    // Callback
    cb?: function,
)
```

For example, if Button and Select components are used in shadow DOM, configure them as follows

```js
// src/components/index.js
class TestShadowDom extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    const root = this.shadowRoot;
       
    /* You need to use @ts-ignore in ts projects to ignore importSemiComponentStyle errors.
    The Semi plugin will parse the following statement during the compilation phase and 
    insert the specific implementation of the importSemiComponentStyle function into the file.
    */
    importSemiComponentStyle(
          'SEMI_INSERT_STYLE_BEGIN["Button", "Select"]SEMI_INSERT_STYLE_END',
          this.shadowRoot，
          () => {}
    );
    const container = document.createElement('div');
    this.shadowRoot?.appendChild(container);

    ReactDOM.render(<SemiComponent />, container);
  }
}

customElements.define("test-shadow-dom", TestShadowDom);
```

#### Principle

The plugin operates as follows:

1. During the code compilation phase, the plugin determines whether `importSemiComponentStyle` is called under the code under the path based on the path configured in `webComponentPath`; if not, no operation is performed. If so, the following steps are performed.
2. The plugin gets the component that needs to be inserted into the style based on the function parameters. The plugin parses all style files that these components depend on (base styles, component styles, sub-component styles that components depend on, etc.)
3. The plugin completes the implementation of the `importSemiComponentStyle` function, which contains all style file insertion logic
4. The plugin inserts the function implementation into the file called by `importSemiComponentStyle`

For example. In the file src/components/index.js, call importSemiComponentStyle to specify the style insertion of the Button component.

```js
// src/components/index.js
class TestShadowDom extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    const root = this.shadowRoot;

    importSemiComponentStyle(
          'SEMI_INSERT_STYLE_BEGIN["Button"]SEMI_INSERT_STYLE_END',
          this.shadowRoot，
          () => {}
    );
    const container = document.createElement('div');
    this.shadowRoot?.appendChild(container);

    ReactDOM.render(<SemiComponent />, container);
  }
}


customElements.define("test-shadow-dom", TestShadowDom);
```

The importSemiComponentStyle function generated by the plugin based on the above definition is as follows:

```js

async function importSemiComponentStyle(componentsStr, root, cb){
  const modules = await Promise.all([
    // Basic style
    import("@douyinfe/semi-ui/lib/es/_base/base.scss"),
    // Dependent component styles
    import("@douyinfe/semi-icons/lib/es/styles/icons.scss"),
    // Component style
    import("@douyinfe/semi-foundation/lib/es/button/button.scss")
  ]);
  const styleStr = modules.map(module => {
    const cssContent = module.default;
    return cssContent;
  });
  styleStr.forEach(css => {
    const style = document.createElement('style');
    style.innerHTML = css;
    root.prepend(style);
  });
  if(typeof cb === 'function') {
    cb();
  }
}
```

The plugin inserts the `importSemiComponentStyle` function into the `src/components/index.js` file.

If you want to know more details, you can refer to [How Semi component library adapts to web components](https://bytedance.larkoffice.com/docx/NtqrdoSrIoXruwxlst3cDzlZn6g)