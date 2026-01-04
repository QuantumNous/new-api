---
category: Getting Started
title: Quick Start
subTitle: Quick Start
icon: doc-gettingstarted
localeCode: en-US
order: 2
---

Semi Design is maintained by the Douyin front-end team and provides 70+ ready-to-use React components and the Figam Variant UI Kit. You can import and use it in any React project (new projects are recommended to be created via Rsbuild, CreateReactApp, or Vite). Currently, it supports React v16, v17, v18, and v19 ([React v19 adaptation](/en-US/start/react19)).

If you need to use compile-time customization capabilities such as prefixCls, themes, and CSS Layers, we recommend using Webpack or Rspack/Rsbuild as your engineering build solution. (For ByteDance users, if you are using your company's internal engineering solution, please refer to the Lark documentation for configuration: <a href="https://bytedance.larkoffice.com/wiki/FaRwweDLmigrD0k8wLgcDaQtnbb" target="_blank">Semi Engineering FAQ</a>)

<Notice title='Important Notes'> The component package @douyinfe/semi-ui is suitable for React versions lower than v19. If using React v19, please use @douyinfe/semi-ui-19. In all examples below, @douyinfe/semi-ui can be replaced with @douyinfe/semi-ui-19.
</Notice>

## 1. Install Library

```bash
# with npm
npm i @douyinfe/semi-ui

# with yarn
yarn add @douyinfe/semi-ui

# with pnpm
pnpm add @douyinfe/semi-ui
```
## 2. Use components in a modular way 💫

`Semi` provides esm format dist, and the css of the component is only imported by the corresponding js.  
When used in `Webpack`, `Rspack`, `create-react-app` or `Vite` projects, there is no need to configure any compilation items.   
All related resources are packaged on-demand at build process. Tree shaking will work without additional configuration.

```jsx
import React, { Component } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return <Button onClick={() => Toast.warning({ content: 'welcome' })}>Hello Semi</Button>;
    }
}
```

> It is recommended to import [reset.css](https://www.npmjs.com/package/reset-css) into the project, which can avoid introducing the default style of the browser.

## 3. Use in Next.js
- If you only use the default theme, you can add Semi-related packages to `transpilePackages` (Next.js version requires >= v13.1) . 
```diff
// next.config.js
const nextConfig = {
+ transpilePackages: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-illustrations'],
};

module.exports = nextConfig;
```

- If you need to use a custom theme package or the version of Next.js is lower than v13.1, you need to use the compiling plugin `@douyinfe/semi-next` provided by Semi
  - First install the plugin `npm i @douyinfe/semi-next` (if you use yarn or pnpm, please replace it with the equivalent command)
  - Configured in `next.config.js`, the plugin will remove the default import CSS statement of the component. More configurations can be found `@douyinfe/semi-next`[Detail Config](https://www.npmjs.com/package/@douyinfe/semi-next) 
  - import semi css in `global.css` (using this method in Next.js does not support on-demand import)
```js
// next.config.js
const semi = require('@douyinfe/semi-next').default({
    /* the extension options */
});
module.exports = semi({
    // your custom Next.js configuration
});
```

```css
/* styles/globals.css */
@import '~@douyinfe/semi-ui/dist/css/semi.min.css';
```

**How to use theme packages with Next.js**  
You need to change the path of the import statement in globals.css, and replace the default theme CSS product with the CSS product in your customized theme package.  
For example, when you want to use the theme package of the Douyin creation service platform `@semi-bot/semi-theme-doucreator` 
```css
/* styles/globals.css */
@import '~@semi-bot/semi-theme-doucreator/semi.min.css';
```

## 4. Use in Remix
- @remix related package version requirements > 1.11.0, and install `@remix-run/css-bundle`

- Configure `remix.config.js`, refer to [Remix Css Side-Effect Imports](https://remix.run/docs/en/v1/guides/styling#css-side-effect-imports). Turn on `unstable_cssSideEffectImports`, and configure Semi related packages in `serverDependenciesToBundle`.
```diff
// remix.config.js
module.exports = {
  future: {
+    unstable_cssSideEffectImports: true,
  },
  serverDependenciesToBundle: [
+    /^@douyinfe\/semi-ui/,
+    /^@douyinfe\/semi-icons/,
+    /^@douyinfe\/semi-illustrations/,
  ],
};

```

- Configure in `root.tsx`，refer to [Remix CSS Bundling](https://remix.run/docs/en/v1/guides/styling#css-bundling). Import `cssBundleHref` and configure `links`

```diff
// root.tsx
+ import { cssBundleHref } from "@remix-run/css-bundle";

 export const links = () => {
   return [
+     ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
   ];
 };
```

- After completing the configuration, you can use Semi components normally

**How to use theme packages with Remix**  
You can directly replace the `cssBundleHref` step with importing the built full css product in the theme package to replace the default theme css).  
For example, when you want to apply the theme package `@semi-bot/semi-theme-doucreator` of the Douyin creation service platform Time

```diff
// root.tsx
+ import ThemeStyle from "@semi-bot/semi-theme-doucreator/semi.min.css";

 export const links = () => {
   return [
-    ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),     
+    { rel: "stylesheet", href: ThemeStyle },
   ];
 };
```


## 5. Use UMD import in browser

[![BUILD-JS][build-js-badge]][build-js-url] [![BUILD-CSS][build-css-badge]][build-css-url]

[build-js-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/umd/semi-ui.min.js?label=semi.min.js&compression=gzip
[build-js-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/umd/semi-ui.min.js
[build-css-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/css/semi.min.css?label=semi.min.css&compression=gzip
[build-css-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/css/semi.min.css

> We do not recommend using the built file directly, as this will introduce all components in full and cannot be loaded on demand. But if there is indeed a need for non-construction scenarios, you can quote in the following ways

Use script and link tags to import files directly in the browser, and use the global variable `SemiUI`、`SemiIcons`、`SemiIllustrations`

1. Please make sure you have import `react` and `react-dom` in advance
2. Import the JS file, the following example URL 2.27.0 is the version identifier, if you want to use a different version of Semi, just replace the corresponding value in version

| Resource | URL |
| --- | --- |
| semi-ui (min) | https://unpkg.com/@douyinfe/semi-ui@2.27.0/dist/umd/semi-ui.min.js |
| semi-icons (min) | https://unpkg.com/@douyinfe/semi-icons@latest/dist/umd/semi-icons.min.js |
| semi-illustrations (min) | https://unpkg.com/@douyinfe/semi-illustrations@latest/dist/umd/semi-illustrations.min.js |
| semi-ui (normal) | https://unpkg.com/@douyinfe/semi-ui@2.27.0/dist/umd/semi-ui.js |
| semi-icons (normal) | https://unpkg.com/@douyinfe/semi-icons@latest/dist/umd/semi-icons.js |
| semi-illustrations (normal) | https://unpkg.com/@douyinfe/semi-illustrations@latest/dist/umd/semi-illustrations.js |

3. Import the CSS style file of the Semi default theme

| Resource | URL |
| --- | --- |
| semi.css | https://unpkg.com/@douyinfe/semi-ui@2.27.0/dist/css/semi.css |
| semi-icons.css | https://unpkg.com/@douyinfe/semi-icons@latest/dist/css/semi-icons.css |

```diff
<!DOCTYPE html>
    <html lang="zh-cn">
    <head>
        <script src="https://unpkg.com/babel-standalone@6.15.0/babel.min.js"></script>
+       <script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>
+       <script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>

+       <script src="https://unpkg.com/@douyinfe/semi-ui@2.27.0/dist/umd/semi-ui-react.min.js"></script>
+       <link rel="stylesheet" href="https://unpkg.com/@douyinfe/semi-ui@2.27.0/dist/css/semi.css">

+       <script src="https://unpkg.com/@douyinfe/semi-icons@latest/dist/umd/semi-icons.min.js"></script>
+       <link rel="stylesheet" href="https://unpkg.com/@douyinfe/semi-icons@latest/dist/css/semi-icons.css">
+       <script src="https://unpkg.com/@douyinfe/semi-illustrations@latest/dist/umd/semi-illustrations.min.js"></script>

    </head>
    <body>
        <div id="root"></div>
    </body>
</html>
```

```html
<script type="text/babel">
    const { Input, Button, Toast, Icon, Form } = SemiUI;
    const { IconHome } = SemiIcons;
    const { IllustrationConstruction } = SemiIllustrations;
    ReactDOM.render(
        <div>
            <Button onClick={() => Toast.warning({ duration: 0, content: 'Semi Design' })}>test</Button>
            <Input defaultValue="semi" onChange={value => Toast.info('hello')}></Input>
            <IconHome size="large" />
            <IllustrationConstruction style={{width: 150, height: 150}} />
        </div>, document.getElementById("root")
    );
</script>
```

