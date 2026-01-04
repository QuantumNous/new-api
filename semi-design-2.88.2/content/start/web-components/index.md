---
category: 开始
title: Web components 适配
icon: doc-webcomponents
localeCode: zh-CN
order: 13
brief: Best practices for using Semi UI in web components
---

[Web components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) 是一套用于创建可重用自定义元素的技术，可实现跨浏览器和框架兼容，具备良好的封装性和可重用性，被广泛应用于开发浏览器插件、跨框架的组件中。

借助组件库可实现更高效的自定义元素开发，但是 web components 中的 [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) 技术具备的<strong>样式隔离</strong>和 <strong>DOM 封装</strong>特性会给组件库组件的使用带来一些问题。大多数组件库如果不做额外适配，都无法正常在 shadow DOM 内正常工作，一般来说会存在以下问题：

## 问题

** 1. 组件样式不生效 **

普通的编译流程中，组件库的组件样式信息在编译后会出现在 head 部分 的 style 标签内，或者 link 标签 href 指定的文件中。由于样式隔离的机制，样式无法穿过 shadow DOM 边界，因此无法在 shadow DOM 内部生效。

** 2. Css variable 不生效 **

现代化的 UI 组件库，为实现主题定制，大多都会借助 css variable 做 design token 的声明，为了能全局生效，避免重复声明，这些 css token 往往都是挂载在根节点下的，例如 html 或 body。Semi 也是采取的此方式实现主题定制。<br/>
将样式信息插入到 shadow DOM 可以解决问题1，使得组件上的样式类名生效，但由于 shadow DOM 中无 body 或者 html，css variable 无法生效，组件样式仍不符合预期。

** 3. 弹出层组件关闭行为异常 **

对于弹出层组件（如Tooltip、Select、Dropdown 等），在前端组件库中常用的场景是通过点击触发弹出层的打开和关闭。前端组件库常用的方案是在弹出层打开后，将点击事件委托到 document 上，以用于监听用户是否点击弹出层组件外的其他页面元素来关闭弹出层。<br/>
在 shadow DOM 中触发的事件传递到 shadow DOM 外时，由于 DOM 隔离，无法通过事件 Event 的 target API 拿到正确的事件触发对象。<br/>
当点击行为发生在 shadow DOM 内，在 document 上的事件 Event 拿到的 target 是 shadow host（shadow DOM 所挂载的节点），不是事件实际触发元素，往往会导致弹出层组件关闭行为异常。

## 建议使用方式

### Semi 版本要求

针对上述普遍存在的问题，Semi UI 已经做了适配改造， 无需额外开发成本。如果你需要 shadow DOM 与 Semi UI 搭配使用。我们建议你升级到<strong> v2.59.0 版本及以上</strong>，并且参考下方[使用插件完成样式插入](#使用插件完成样式插入)章节，按需开启编译配置。


### 使用插件完成样式插入

#### 配置详情

<Notice>
  我们建议通过 npm 管理依赖包，如果使用 yarn/pnpm 管理依赖包，需要在通过 resolve.alias 指定 @douyinfe/semi-ui， @douyinfe/semi-icons，@douyinfe/semi-foundation 的实际路径
</Notice>

** 1.开启 Semi 插件（>= 2.59.0) **

（字节跳动用户，若使用的是公司内部相关工程化方案，配置请查阅飞书文档：<a href="https://bytedance.larkoffice.com/docx/PqMwd7lFko6ECTxmmcFcnWIQnmg" target="_blank">插件配置</a>）

webpack 项目：
```bash
yarn add -D @douyinfe/semi-webpack-plugin
```

Rspack 项目：
```bash
yarn add -D @douyinfe/semi-rspack-plugin
```

** 2. 在项目的配置文件（webpack.config.js 等）引入 Semi webpack 插件，配置 webComponentPath 参数；**

```js
// webComponentPath：指定需要插入样式的 shadow DOM 的路径
// 1. 支持 Boolean 类型，传入 true，为默认路径 src/*
// 2. 支持 RegExp 正则表达式，通过正则表达式匹配路径
webComponentPath: Boolean | RegExp;
```

举个 🌰，如果 shadow DOM 在路径 src/components 下，则进行如下配置：

对于 wepack 项目：
```js
//配置文件：如 webpack.config.js
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

对于 rspack 项目
```js
//rspack 项目配置文件：如 rsbuild.config.mjs
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

      config.plugins.push(new RspackPlugin({
        webComponentPath: true,
      }));
    }
  } 
  /*...other settings */
});
```

** 3. 在需要插入样式的 shadow DOM 的代码中，调用 `importSemiComponentStyle` 函数 **

```js
function importSemiComponentStyle(
    // 需要插入样式的组件字符串，固定格式
    // 开头为 SEMI_INSERT_STYLE_BEGIN
    // 结束为 SEMI_INSERT_STYLE_END
    // 中间为组件数组，
    insertComponentStr: string,
    // 样式插入位置的 shadow root
    root: ShadowRoot,
    // 回调函数
    cb?: function,
)
```

举个 🌰，如果在 shadow DOM 中用到了 Button，Select 组件，则按照如下方式进行配置

```js
// src/components/index.js
class TestShadowDom extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    const root = this.shadowRoot;
       
    // ts 项目中需使用 @ts-ignore 忽略 importSemiComponentStyle 报错
    // Semi 插件在编译阶段将解析以下语句，将 importSemiComponentStyle 函数具体实现插入到该文件中
    importSemiComponentStyle(
          'SEMI_INSERT_STYLE_BEGIN["Button", "Select"]SEMI_INSERT_STYLE_END',
          root,
          () => {}
    );
    const container = document.createElement('div');
    root?.appendChild(container);

    ReactDOM.render(<SemiComponent />, container);
  }
}

customElements.define("test-shadow-dom", TestShadowDom);
```

#### 原理

插件运行原理如下：

1. 在代码编译阶段，插件根据 `webComponentPath` 配置的路径，判断该路径下的代码下是否调用 `importSemiComponentStyle`；如无，则不做任何操作，若有，则执行下方步骤
2. 插件根据函数参数拿到需要插入样式的组件。插件解析这些组件所依赖的所有样式文件（基础样式，组件样式，组件依赖的子组件样式等）
3. 插件完成对此 `importSemiComponentStyle` 函数的实现，函数中包含所有样式文件插入逻辑
4. 插件将函数定义插入 `importSemiComponentStyle` 调用的文件中

举个 🌰

在文件 src/components/index.js中， 调用 importSemiComponentStyle， 指定 Button 组件的样式插入

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
          this.shadowRoot,
          () => {}
    );
    const container = document.createElement('div');
    this.shadowRoot?.appendChild(container);

    ReactDOM.render(<SemiComponent />, container);
  }
}


customElements.define("test-shadow-dom", TestShadowDom);
```

插件根据上述定义生成的 importSemiComponentStyle 函数如下：

```js

async function importSemiComponentStyle(componentsStr, root, cb){
  const modules = await Promise.all([
    // 基础样式
    import("@douyinfe/semi-ui/lib/es/_base/base.scss"),
    // 依赖的组件样式
    import("@douyinfe/semi-icons/lib/es/styles/icons.scss"),
    // 组件样式
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

插件会将此 `importSemiComponentStyle` 函数插入到 `src/components/index.js` 文件中。

如果想要了解更多细节，可参考 [Semi 组件库如何适配 web components](https://bytedance.larkoffice.com/docx/NtqrdoSrIoXruwxlst3cDzlZn6g)