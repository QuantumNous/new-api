<div align="center">
<article style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <p align="center"><img width="300" src="https://lf1-cdn-tos.bytescm.com/obj/ttfe/ies/semi/SemiLogo/Logo_1576122865926.png" /></p>
    <h1 style="width: 100%; text-align: center;">Semi-UI</h1>
    <p>
        现代、全面、灵活的设计系统和 UI 库。 致力打通 DesignOps & DevOps ，快速搭建美观的 React 应用。
    </p>
</article>
    
<div align="center">

[![LICENSE][license-badge]][license-url] [![NPM][npm-badge]][npm-url] [![FIGMA][figma-badge]][figma-url] ![Design Token][Design Token] 
[![CODECOV][codecov-badge]][codecov-url] [![Chromatic][chromatic-badge]][chromatic-url] [![Cypress][cypress-badge]][cypress-url]
[![Twitter Follow](https://img.shields.io/twitter/follow/SemiDesignUI?style=social)](https://twitter.com/SemiDesignUI)


[npm-badge]: https://img.shields.io/npm/v/@douyinfe/semi-ui.svg
[npm-url]: https://www.npmjs.com/package/@douyinfe/semi-ui
[figma-badge]: https://img.shields.io/badge/Figma-UIKit-%2318a0fb
[figma-url]: https://www.figma.com/@semi
[Design Token]: https://img.shields.io/badge/Design%20Token-2739%2B-brightgreen
[license-badge]: https://img.shields.io/npm/l/@douyinfe/semi-ui
[license-url]: https://github.com/DouyinFE/semi-design/blob/main/LICENSE
[codecov-badge]: https://img.shields.io/codecov/c/gh/DouyinFE/semi-design
[codecov-url]: https://app.codecov.io/gh/DouyinFE/semi-design
[chromatic-badge]: https://img.shields.io/badge/test-chromatic-f52
[chromatic-url]: https://www.chromatic.com/
[cypress-badge]: https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/k83u7j&style=flat&logo=cypress
[cypress-url]: https://dashboard.cypress.io/projects/k83u7j/runs

[build-js-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/umd/semi-ui.min.js?label=semi.min.js&compression=gzip
[build-js-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/umd/semi-ui.min.js
[build-css-badge]: https://img.badgesize.io/https:/unpkg.com/@douyinfe/semi-ui/dist/css/semi.min.css?label=semi.min.css&compression=gzip
[build-css-url]: https://unpkg.com/browse/@douyinfe/semi-ui/dist/css/semi.min.css

</div>

<p>
    <img src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-info-1.gif" />
</p>

简体中文 | [English](./README.md)

</div>

# 🎉 特性

- 💪 70+高质量组件
- 💅 Code2Design，根据不同主题自动生成 Figma UI Kit，保持代码与设计同源
- 🚀 强大的 D2C （Design2Code）支持，Figma 设计稿一键转出真实代码，快速构建应用
- 💕 完善的无障碍支持，为所有组件提供遵循 W3C 标准的键盘交互、焦点管理和语义化
- 🎨 设计系统管理工具 Semi DSM，多达2000+ Design Token，快速定制你的专属设计系统
- 🌍 国际化支持 20+ 语言，提供完备的多语言、多时区、RTL支持
- ⚙️ 稳定的质量保障，覆盖单元测试、E2E测试、视觉回归测试等多种测试手段
- 🥳 支持 SSR
- 👏 使用 TypeScript, 良好的类型定义，基于 Foundation / Adapter 架构，源码易于阅读 / 贡献
- 📦 轻松兼容 web components，提供完整适配方案，更适合用于构建 SDK、浏览器插件等需要 DOM 隔离的场景

# 🔥 安装

```sh
npm install @douyinfe/semi-ui
```

# 👍 组件使用

这是一个快速开始的例子：

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Form } from '@douyinfe/semi-ui';

const App = () => (
    <Form>
        <Form.Input field='name' initValue='semi design'></Form.Input>
        <Button htmlType='submit'>submit</Button>
    </Form>
);

const root = createRoot(document.querySelector('#app'));
root.render(<App />);
```

[Semi UI 官网](https://semi.design) 拥有上千个支持实时调试的例子，欢迎体验使用。

# ⚡️ D2C 设计稿转代码

安装插件 [Semi Figma Plugin](https://www.figma.com/community/plugin/1166339852662786534/Semi-Design-%E8%AE%BE%E8%AE%A1%E8%BD%AC%E4%BB%A3%E7%A0%81). 数秒内将 Figma 转为真实前端代码，支持多种出码格式： JSX + SCSS / Emotion/Tailwind、 JSON Schema DSL

- 支持 Figma Devmode，选中图层后，右侧可直接查看对应的真实代码
  
![design2code](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/github/devmode.gif)

- 或跳转至 Codesandbox 进行二次编辑
  
![codesandboxdemo](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/github/1080p-fps5.gif)


# 🎨 DSM 设计系统管理

基于 Semi UI 定制你的专属设计系统, 提供高达 3000+ Token 允许你定义每一处细节. 并时刻在 Figma 与主题商店间保持同步。

![dsmintro](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/github/dsmintro.png)


# 📰 关注我们的动态
* [Follow on Twitter](https://twitter.com/SemiDesignUI)
* [Follow on Medium](https://medium.com/@semi-design)
* [Follow on Dev.to](https://dev.to/semidesign)

# 📌 文档
* [Semi DSM](https://semi.design/dsm)
* [Semi Design2Code](https://semi.design/code)
* [Semi Figma Plugin](https://www.figma.com/community/plugin/1166339852662786534/Semi-Design-%E8%AE%BE%E8%AE%A1%E8%BD%AC%E4%BB%A3%E7%A0%81)
* [快速开始](https://semi.design/zh-CN/start/getting-started)
* [组件总览](https://semi.design/zh-CN/start/overview)
* [自定义主题](https://semi.design/zh-CN/start/customize-theme)
* [DSM主题商店](https://semi.design/dsm_store)
* [Design Tokens](https://semi.design/zh-CN/basic/tokens)
* [暗色模式](https://semi.design/zh-CN/start/dark-mode)
* [Icons](https://semi.design/zh-CN/basic/icon)
* [全局配置](https://semi.design/zh-CN/other/configprovider)
* [国际化](https://semi.design/zh-CN/other/locale)
* [常见问题](https://semi.design/zh-CN/start/faq)
* [CHANGELOG](https://semi.design/zh-CN/start/changelog)

# 👌 平台支持

Semi UI 支持所有主流浏览器。

|[<img alt="chrome" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/chrome/chrome.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/chrome/chrome.png)<br>chrome|[<img alt="firefox" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/firefox/firefox.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/firefox/firefox.png)<br>firefox|[<img alt="safari" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/safari/safari.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/safari/safari.png)<br>safari|[<img alt="IE/Edge" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/edge/edge.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/edge/edge.png)<br> IE/Edge|[<img alt="electron" height="24px" src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/electron/electron.png" />](https://cdnjs.cloudflare.com/ajax/libs/browser-logos/70.4.0/electron/electron.png)<br>Electron|
|--|--|--|--|--|
| latest 2 versions | latest 2 versions | latest 2 versions | Edge | latest 2 versions |

# 👨‍👨‍👧‍👦 交流群

有任何问题可以进群交流，我们会及时给予解答和反馈。

加入飞书[用户群](https://bytedance.feishu.cn/docs/doccnw93Dujm3UCkHRDTMTm1qwe#).

# 💖 Thanks

<a href="https://www.chromatic.com/"><img src="https://user-images.githubusercontent.com/321738/84662277-e3db4f80-af1b-11ea-88f5-91d67a5e59f6.png" width="153" height="30" alt="Chromatic" /></a>

感谢 [Chromatic](https://www.chromatic.com/) 提供可视化测试平台，帮助我们审查 UI 更改和提供视觉回归测试。

<a href="https://www.cypress.io/"><img src="https://user-images.githubusercontent.com/26477537/147624641-1274a91d-bc4c-463e-af1a-dbf15de54c49.png" width="90" height="30" alt="Cypress" /></a>

感谢 [Cypress](https://www.cypress.io/) 提供 E2E 测试。

<div>
  <a href="https://github.com/VisActor#gh-light-mode-only" target="_blank">
    <img alt="VisActor Logo" height="60" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/visactor/logo_500_200_light.svg"/>
  </a>
  <a href="https://github.com/VisActor#gh-dark-mode-only" target="_blank">
    <img alt="VisActor Logo" height="60" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/visactor/logo_500_200_dark.svg"/>
  </a>
</div>

感谢 [VisActor](https://www.visactor.com/) 提供数据可视化解决方案。

## 👐 参与共建
Semi Design 欢迎社区开发者参与共建，衷心感谢每一位协作者的付出

<a href="https://github.com/DouyinFE/semi-design/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=DouyinFE/semi-design" />
</a>

阅读贡献指南了解我们的开发流程，包括开发规范、测试规范和构建规范等： [CONTRIBUTING](CONTRIBUTING.md)

# 🎈 协议

Semi UI 使用 [MIT 协议](LICENSE)
