---
category: 开始
title: With TailwindCSS 
icon: doc-tailwind
localeCode: en-US
order: 12
brief: Use TailwindCSS and Semi more elegantly
---


# Notice

<br/>

This page will provide best practices for some issues encountered when using atomic style libraries such as TailwindCSS (only v3, Tailwind V4 is not supported yet) with Semi.

These problems are often encountered when other component libraries are used with Tailwind, but Semi provides official solutions. It is recommended to follow the instructions in this article to configure the project correctly.

<Notice title="Note">
Semi does not rely on any third-party style libraries and can run without installing Tailwind. If you do not use atomic libraries such as Tailwind, please close this page directly.
</Notice>

### 1. Solve the problem of style override priority

#### Problem performance

There is no effect or component library style exception when using some atomic classes in components.

#### Cause Analysis
When using Tailwind, Tailwind modifies the dom style through className, which also affects the Semi component library. At the same time, Tailwind enables [Preflight](https://tailwindcss.com/docs/preflight) by default to reset the browser's default style.

At this time, depending on the configuration of your project and the import of the entry, there are two possibilities:

1. Tailwind is introduced before Semi style, and Semi has higher priority
2. Semi style was introduced before Tailwind, and Tailwind has a higher priority.

If it is 1, it will appear that when Tailwind adds certain atomic classes, if the component style has defined a certain css attribute, the priority of the atomic class is lower than that of Semi, and the atomic class becomes invalid.
For example, under the premise of 1, setting padding on the Button component will cause failure.

If it is 2, because Tailwind has a higher priority, its Preflight overwriting the browser's default style will also override Semi's style.
For example, under the premise of 2, the background color of the light Button will be overwritten as transparent, causing the style to behave abnormally.


#### Solution
No matter which side of Tailwind or the component library has higher priority, problems will occur, so the solution lies in correctly handling the relationship between the priority of Preflight and the atomic classes required by users in the Tailwind style relative to the priority of the component library.

** 1. Enable Semi plugin (>= 2.59.0) **
```shell
yarn add -D @douyinfe/semi-webpack-plugin
```
** 2. In the configuration file in the project **

- Webpack user: import Semi webpack plugin and enable cssLayer in the webpack.config.js

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
- Rspack user:  import Semi webpack plugin and enable cssLayer in the rspack.config.js

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

For users who use neither webpack or rspack build, please refer to the principle to layer-wrap semi's css yourself

** 3. Modify Tailwind entry configuration**

The CSS of Tailwind entry is usually a file containing the following three lines
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Modify it to (copy directly):
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

And import the above modified file at the **top** of the project's JS entry file (i.e. App.tsx or index.js). (Usually a Tailwind project has already processed the import of the above files, just put the import statement before all import statements)


<Notice title="Compatible with lower version browsers">
CSS Layer requires a browser version higher than Chromium 99 <a target="_blank" href="https://caniuse.com/?search=CSS%20Cascade%20Layers">(compatibility table)</a>, if you The website requires a lower version browser to access and needs to add CSS Layer Polyfill. Please refer to this Polyfill's <a target="_blank" href="https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-cascade-layers">PostCSS plugin documentation</a>
</Notice>


#### Principle
Through the CSS Layer feature, priority setting of styles from different sources is achieved.

After enabling the plugin, all Semi styles will be wrapped by `@layer {xxxx}`. In addition, we also manually set the layers of various types of Tailwind styles in the project.

In addition, we configured the priority order of various Layers:
```css
@layer tailwind-base,semi,tailwind-components,tailwind-utils;
```
The meaning of the above CSS is that base (including Preflight) has the lowest priority, followed by Semi. The atomic class styles set by the user (padding-[xxx], etc.) have the highest priority, which can solve the above problems.


### 2. Solve the problem of using Semi Token in Tailwind atomic class (optional)

Tailwind supports users to configure their own Token to implement themes. At the same time, Semi also provides its own theme solution and corresponding Token
If you want to use Semi Token directly in the project, for example, set the text color of a span to `--semi-color-text-0` to automatically switch between light and dark colors to be consistent with the theme, you need to set the css `color separately: var(--semi-color-text-0)`, very inconvenient.

Semi provides Tailwind's theme configuration file, which is used to map Semi's Token to atomic Token. For the above requirements, you can directly set `text-semi-color-text-0` for span.

Just configure the following content in the Tailwind configuration (i.e. `tainwind.config.js`):



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
