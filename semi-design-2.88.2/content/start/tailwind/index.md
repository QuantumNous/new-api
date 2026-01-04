---
category: 开始
title: Tailwind 搭配使用
icon: doc-tailwind
localeCode: zh-CN
order: 12
brief: 更优雅地使用 TailwindCSS 与 Semi
---


# 注意

<br/>

本页将提供 TailwindCSS (只支持 v3，tailwind V4 暂未支持) 等原子类样式库与 Semi 共同使用时遇到的一些问题的最佳实践。

这些问题在其他组件库与 Tailwind 共同使用时候也会经常遇到，但 Semi 提供了官方解决方案，建议按照本文说明，正确配置项目。

<Notice title="注意">
Semi 不依赖任何第三方样式库，没有安装 Tailwind 一样可以运行，如果你没有使用 Tailwind 等原子类库，请直接关闭此页即可。
</Notice>



### 1. 解决样式覆盖优先级问题

#### 问题表现

在组件中使用部分原子类时没有效果 或 组件库样式异常。

#### 原因分析
使用 Tailwind 时，Tailwind 通过 className 对 dom 进行样式修改，同样作用于 Semi 组件库。同时 Tailwind 默认开启了 [Preflight](https://tailwindcss.com/docs/preflight) 来重置浏览器默认样式。

此时根据你项目的配置和入口的 import，有两种可能：

1. Tailwind 比 Semi 的样式先引入，Semi 优先级更高
2. Semi 样式 比 Tailwind 先引入，Tailwind 优先级更高

如果是 1，则会出现 Tailwind 在添加某些原子类时，如果组件样式已经定义了某个 css 属性，原子类的优先级比 Semi 优先级低，此时原子类失效。
例如在 1 的前提下，对 Button 组件设置 padding，会出现失效的情况。

如果是 2，因为 Tailwind 优先级较高，其对浏览器默认样式覆盖的 Preflight 会同时覆盖掉 Semi 的样式。
例如在 2 的前提下，light 的 Button 的背景色会被覆盖为 transparent，导致样式表现异常。


#### 解决方案
无论 Tailwind 和 组件库哪一方优先级高，都会出现问题，因此解决方式在于正确处理 Tailwind 样式中 Preflight 和用户需要的原子类的优先级相对于组件库优先级的关系。

** 1. 开启 Semi 插件 (>= 2.59.0) **
```shell
yarn add -D @douyinfe/semi-webpack-plugin
```
** 2. 在项目中的配置文件中 **

- webpack 用户：在 webpack.config.js 引入 Semi webpack 插件并开启 cssLayer

```js
const SemiPlugin = require('@douyinfe/semi-webpack-plugin').default;

module.exports = {
    // ...
    plugins: [
        new SemiPlugin({
            cssLayer:true,
            /* ...options */
        })
    ]
    // ...
};

```
- rspack 用户：在 rspack.config.js  引入 Semi webpack 插件并开启 cssLayer

```js
const {SemiRspackPlugin} = require('@douyinfe/semi-rspack-plugin');

module.exports = {
    // ...
    plugins: [
        new SemiRspackPlugin({
            cssLayer:true
        })
    ]
};
```

使用非 webpack rspack 构建的用户请参照原理自行对 semi 的 css 进行 layer 包裹


** 3. 修改 Tailwind 入口配置**

Tailwind 入口的 CSS 通常是包含了下面三行的文件
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

将其修改为（直接复制）
```css
@layer tailwind-base,semi,tailwind-components,tailwind-utils;
@layer tailwind-base{
    @tailwind base;
}
@layer tailwind-components{
    @tailwind components;
}
@layer tailwind-utils {
    @tailwind utilities;
}
```

并在项目的 JS 入口文件（即 App.tsx 或 index.js）处**最上方** import 上面修改的文件。（通常一个 Tailwind 项目对于上面文件的 import 已经处理好，只要将该 import 语句提到所有 import 语句前即可）


<Notice title="兼容低版本浏览器">
CSS Layer 要求浏览器版本高于 Chromium 99 <a target="_blank" href="https://caniuse.com/?search=CSS%20Cascade%20Layers">(兼容性表格)</a>，如果你的网站需要低版本浏览器访问，需要添加 CSS Layer 的 Polyfill，请参考此 Polyfill 的 <a target="_blank" href="https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-cascade-layers">PostCSS 插件文档</a>
</Notice>


#### 原理
通过 CSS Layer 特性，实现不同来源的样式的优先级设置。

开启插件后，所有的 Semi 样式都会被 `@layer {xxxx}` 包裹。另外，我们也手动设置了项目中的 Tailwind 的各种类型的样式的 Layer。

另外，我们配置了各种 Layer 的优先级顺序：
```css
@layer tailwind-base,semi,tailwind-components,tailwind-utils;
```
上述 CSS 的含义为，base（含 Preflight）优先级最低，Semi 次之，用户设置的原子类样式（padding-[xxx] 等）优先级最高，这样即可解决上面遇到的问题。


### 2.解决在 Tailwind 原子类中使用 Semi Token 的问题 (可选)

Tailwind 支持用户配置自己的 Token 来实现主题。同时 Semi 也提供了自己的主题方案与对应 Token
如果想在项目中直接使用 Semi Token，例如将一个 span 的文字颜色设置为 `--semi-color-text-0` 来实现亮暗色的颜色自动切换与主题保持一致，需要单独设置 css `color: var(--semi-color-text-0)`，很不方便。

Semi 提供了 Tailwind 的主题配置文件，用于将 Semi 的 Token 映射为原子类 Token，上述需求可以直接给 span 设置 `text-semi-color-text-0` 即可。

在 Tailwind 配置中 (即 `tainwind.config.js`) 配置以下内容即可：

```js
module.export = {
    theme:{
        colors:{
            "semi-color-white": "var(--semi-color-white)",
            "semi-color-black": "var(--semi-color-black)",
            "semi-color-primary": "var(--semi-color-primary)",
            "semi-color-primary-hover": "var(--semi-color-primary-hover)",
            "semi-color-primary-active": "var(--semi-color-primary-active)",
            "semi-color-primary-disabled": "var(--semi-color-primary-disabled)",
            "semi-color-primary-light-default": "var(--semi-color-primary-light-default)",
            "semi-color-primary-light-hover": "var(--semi-color-primary-light-hover)",
            "semi-color-primary-light-active": "var(--semi-color-primary-light-active)",
            "semi-color-secondary": "var(--semi-color-secondary)",
            "semi-color-secondary-hover": "var(--semi-color-secondary-hover)",
            "semi-color-secondary-active": "var(--semi-color-secondary-active)",
            "semi-color-secondary-disabled": "var(--semi-color-secondary-disabled)",
            "semi-color-secondary-light-default": "var(--semi-color-secondary-light-default)",
            "semi-color-secondary-light-hover": "var(--semi-color-secondary-light-hover)",
            "semi-color-secondary-light-active": "var(--semi-color-secondary-light-active)",
            "semi-color-tertiary": "var(--semi-color-tertiary)",
            "semi-color-tertiary-hover": "var(--semi-color-tertiary-hover)",
            "semi-color-tertiary-active": "var(--semi-color-tertiary-active)",
            "semi-color-tertiary-light-default": "var(--semi-color-tertiary-light-default)",
            "semi-color-tertiary-light-hover": "var(--semi-color-tertiary-light-hover)",
            "semi-color-tertiary-light-active": "var(--semi-color-tertiary-light-active)",
            "semi-color-default": "var(--semi-color-default)",
            "semi-color-default-hover": "var(--semi-color-default-hover)",
            "semi-color-default-active": "var(--semi-color-default-active)",
            "semi-color-info": "var(--semi-color-info)",
            "semi-color-info-hover": "var(--semi-color-info-hover)",
            "semi-color-info-active": "var(--semi-color-info-active)",
            "semi-color-info-disabled": "var(--semi-color-info-disabled)",
            "semi-color-info-light-default": "var(--semi-color-info-light-default)",
            "semi-color-info-light-hover": "var(--semi-color-info-light-hover)",
            "semi-color-info-light-active": "var(--semi-color-info-light-active)",
            "semi-color-success": "var(--semi-color-success)",
            "semi-color-success-hover": "var(--semi-color-success-hover)",
            "semi-color-success-active": "var(--semi-color-success-active)",
            "semi-color-success-disabled": "var(--semi-color-success-disabled)",
            "semi-color-success-light-default": "var(--semi-color-success-light-default)",
            "semi-color-success-light-hover": "var(--semi-color-success-light-hover)",
            "semi-color-success-light-active": "var(--semi-color-success-light-active)",
            "semi-color-danger": "var(--semi-color-danger)",
            "semi-color-danger-hover": "var(--semi-color-danger-hover)",
            "semi-color-danger-active": "var(--semi-color-danger-active)",
            "semi-color-danger-light-default": "var(--semi-color-danger-light-default)",
            "semi-color-danger-light-hover": "var(--semi-color-danger-light-hover)",
            "semi-color-danger-light-active": "var(--semi-color-danger-light-active)",
            "semi-color-warning": "var(--semi-color-warning)",
            "semi-color-warning-hover": "var(--semi-color-warning-hover)",
            "semi-color-warning-active": "var(--semi-color-warning-active)",
            "semi-color-warning-light-default": "var(--semi-color-warning-light-default)",
            "semi-color-warning-light-hover": "var(--semi-color-warning-light-hover)",
            "semi-color-warning-light-active": "var(--semi-color-warning-light-active)",
            "semi-color-focus-border": "var(--semi-color-focus-border)",
            "semi-color-disabled-text": "var(--semi-color-disabled-text)",
            "semi-color-disabled-border": "var(--semi-color-disabled-border)",
            "semi-color-disabled-bg": "var(--semi-color-disabled-bg)",
            "semi-color-disabled-fill": "var(--semi-color-disabled-fill)",
            "semi-color-shadow": "var(--semi-color-shadow)",
            "semi-color-link": "var(--semi-color-link)",
            "semi-color-link-hover": "var(--semi-color-link-hover)",
            "semi-color-link-active": "var(--semi-color-link-active)",
            "semi-color-link-visited": "var(--semi-color-link-visited)",
            "semi-color-border": "var(--semi-color-border)",
            "semi-color-nav-bg": "var(--semi-color-nav-bg)",
            "semi-color-overlay-bg": "var(--semi-color-overlay-bg)",
            "semi-color-fill-0": "var(--semi-color-fill-0)",
            "semi-color-fill-1": "var(--semi-color-fill-1)",
            "semi-color-fill-2": "var(--semi-color-fill-2)",
            "semi-color-bg-0": "var(--semi-color-bg-0)",
            "semi-color-bg-1": "var(--semi-color-bg-1)",
            "semi-color-bg-2": "var(--semi-color-bg-2)",
            "semi-color-bg-3": "var(--semi-color-bg-3)",
            "semi-color-bg-4": "var(--semi-color-bg-4)",
            "semi-color-text-0": "var(--semi-color-text-0)",
            "semi-color-text-1": "var(--semi-color-text-1)",
            "semi-color-text-2": "var(--semi-color-text-2)",
            "semi-color-text-3": "var(--semi-color-text-3)",
            "semi-color-highlight-bg": "var(--semi-color-highlight-bg)",
            "semi-color-highlight": "var(--semi-color-highlight)",
            "semi-color-data-0": "var(--semi-color-data-0)",
            "semi-color-data-1": "var(--semi-color-data-1)",
            "semi-color-data-2": "var(--semi-color-data-2)",
            "semi-color-data-3": "var(--semi-color-data-3)",
            "semi-color-data-4": "var(--semi-color-data-4)",
            "semi-color-data-5": "var(--semi-color-data-5)",
            "semi-color-data-6": "var(--semi-color-data-6)",
            "semi-color-data-7": "var(--semi-color-data-7)",
            "semi-color-data-8": "var(--semi-color-data-8)",
            "semi-color-data-9": "var(--semi-color-data-9)",
            "semi-color-data-10": "var(--semi-color-data-10)",
            "semi-color-data-11": "var(--semi-color-data-11)",
            "semi-color-data-12": "var(--semi-color-data-12)",
            "semi-color-data-13": "var(--semi-color-data-13)",
            "semi-color-data-14": "var(--semi-color-data-14)",
            "semi-color-data-15": "var(--semi-color-data-15)",
            "semi-color-data-16": "var(--semi-color-data-16)",
            "semi-color-data-17": "var(--semi-color-data-17)",
            "semi-color-data-18": "var(--semi-color-data-18)",
            "semi-color-data-19": "var(--semi-color-data-19)"
        },
        extend:{
            borderRadius:{
                "semi-border-radius-extra-small": "var(--semi-border-radius-extra-small)",
                "semi-border-radius-small": "var(--semi-border-radius-small)",
                "semi-border-radius-medium": "var(--semi-border-radius-medium)",
                "semi-border-radius-large": "var(--semi-border-radius-large)",
                "semi-border-radius-circle": "var(--semi-border-radius-circle)",
                "semi-border-radius-full": "var(--semi-border-radius-full)",
            }
        }
    }
}
```
