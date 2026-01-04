---
category: 开始
title: Introduction 介绍
icon: doc-intro
localeCode: zh-CN
order: 1
brief: Semi Design 是一个设计系统，它定义了一套中后台设计与前端基础组件，帮助我们更容易地创造更加一致的用户体验。
---

## 什么是 Semi

Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。它作为全面、易用、优质的现代应用 UI 解决方案，从字节跳动各业务线的复杂场景提炼而来，支撑近千计平台产品，服务内外部 10 万+ 用户。

## 我们的愿景

Semi 多用于前缀或词组中，表示「一半」 —— 正如同一个完整的企业应用，通常由业务逻辑与前端界面构成，Semi Design 希望成为这不可或缺的一半，为企业应用前端提供坚实且优质的基础。  
我们相信，设计系统的真正价值在于降低前端的搭建成本，同时提供优秀的设计和工程化标准，充分解放设计师与开发者的生产力，从而不断孵化明星产品。

### 设计 —— 不变与多变

近年来，越来越多的 SaaS 产品如 Slack，Notion，Figma，开始依靠优秀的用户体验来推动增长。对产品的评判标准，已从采购方逐渐转移到终端用户；一个产品体验的好与坏，将直接影响用户是否继续使用，B 端产品的体验设计也变得愈发重要。

Semi Design 始终致力于提升企业应用的体验。通过提炼简洁轻量，现代化的设计风格，细致打磨原子组件的交互，并在字节跳动的海量业务场景下进行迭代，沉淀了一套优质的默认基础 —— 它将保证 Semi 打造的企业应用产品，天生拥有连贯一致的「语言」，和明显优于陈旧系统的质量基线。

此外，一个好的设计系统必须是「活的」，它需要能跟随业务的增长而发展、更新。因此，Semi 从未尝试约束用户，固化所谓的「统一规范」，而是在默认基础上，充分进行模块化解耦，并开放自定义能力，方便用户进行二次裁剪与定制，搭建适用于不同形态产品的前端资产。

![基于 Semi Design 的多元化产品与团队组件](https://lf9-static.semi.design/obj/semi-tos/images/introduction-showcase.gif)

**坚守优质且稳定的默认基础(不变)，并在需要时充分开放自定义的灵活度(多变)，这是 Semi Design 独特的，并将一直遵循的设计原则。**

### 主题化 —— 品牌一键定制

Semi 是如何在连贯统一的基础上，做到灵活多变的？答案是强大的主题化方案。

通过对数千个设计变量 (Design Token) 的分层和梳理，设计师和开发者可在全局、乃至组件级别，对 表现层进行深度定制 —— 即使你不了解 CSS，也可以**通过主题编辑器(DSM)，打造符合业务和品牌多样化视觉需求的风格**。开发者则可通过 npm 包一键发布并替换，轻松定制，易于管理。

你可以在[Semi DSM](https://semi.design/dsm_store)，查看 Semi 在抖音、剪映、飞书、火山引擎等不同品牌场景下的官方示例主题。

![全面覆盖的设计变量用例、文档与编辑器](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tech-doc/p3.gif)

DSM还支持 **从线上到设计工具的实时同步** —— Design Token可以同时在工程项目与Figma中进行消费，在提升效率的同时，进一步保证设计和研发的持续对齐，降低产研间的沟通成本。

### 深色模式

为了兼容更多用户群体在不同生产环境下的使用偏好，作为浅色模式的补充，Semi Design 的任意主题均自动支持深色模式，并能在应用运行时动态切换。

不仅如此，Semi 并且允许用户在应用内局部区域开启深色模式，以兼容 SDK 或插件型产品的使用场景。通过进阶设置，用户也可以实现应用和系统主题自动保持一致。

同时，为了进一步提升开发体验，我们也提供了将未规范化的存量旧工程一键兼容到 Semi 暗色模式的 cli 工具，通过自动化的方式规避迁移成本。

![Semi 深色模式在业务系统中的应用](https://lf26-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tech-doc/p4darkmode.gif)

### 国际化 —— 多元兼容

在字节跳动全球化业务实践下，Semi Design 经过 30+ 版本迭代，已具备完善的国际化特性 —— 覆盖简/繁体中文，英语、日语、韩语、葡萄牙语等 20+ 语言，日期时间组件提供全球时区支持，全部组件可自动适配阿拉伯文 RTL 布局。

同时，随业务的拓展，也不断有海外地区的开发者开始使用 Semi 构建应用。为了更好地支持这部分用户的诉求，我们也对站点和文档进行了双语适配，以保证开发无障碍。

![海外运营平台产品 Powered by Semi Design](https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tech-doc/p5global.png)

### 跨框架技术方案

Semi Design 采用了一套跨前端框架技术方案，F/A 分层设计，将每个组件的 JavaScript 拆分为两部分：Foundation 和 Adapter，这使得我们可以通过仅重新实现适配器来跨框架重用 Foundation 代码，例如 React、Vue、Angular、Svelte 或者 WebComponent，快速打造不同平台上的通用组件库。

![F/A架构](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tech-doc/crossFrame.png)

#### Foundation

Foundation 包含最能代表 Semi Design 组件交互的业务逻辑，包括 UI 行为触发后的各种计算、分支判断等逻辑，它并不直接操作或者引用 DOM，任意需要 DOM 操作，驱动组件渲染更新的部分会委派给 Adapter 执行。

#### Adapter

Adapter 是一个接口，具有 Foundation 实现 Semi Design 业务逻辑所需的所有方法，并负责 1. 组件 DOM 结构声明 2.负责所有跟 DOM 操作/更新相关的逻辑，通常会使用框架 API 进行 setState、getState、addEventListener、removeListener 等操作。适配器可以有许多实现，允许与不同框架的互操作性。

目前，我们实现了 Adapter 的 React 版本，你可以直接通过引入 semi-ui 来使用我们的 React 组件。如果你对 Semi 的架构设计感兴趣，可以进一步查阅[这篇文章](https://bytedance.feishu.cn/docs/doccnTgc0iGOVPubHZkwPpxXSNh#)。

## 展望

在未来，Semi Design 团队会持续进行质量提升与优化，并将更多内部落地的工具链与资源，陆续开放给社区用户，包括不限于：

### Design to Code

一直以来，Semi 团队都在尝试通过各类自动化手段，优化日常工作流程，帮助团队设计师和研发提效，甚至重新定义传统的工作方式。其中，「前端页面还原」这一环节存在耗时、沟通成本高等各种低效问题，一直是我们关注的重点。

目前，我们已实现了设计稿转代码功能的建设，并在Landing Page、表单页、表格页等场景下进行了有效验证 —— 事实上，https://semi.design 官网正是借助该方案进行开发与还原的。  

对于设计中的组件级别的识别与转译，我们通过 Code2Design + Design2Code 的方式实现了支持，目前我们已经实现了 80%的基础组件覆盖，你可以通过 [Semi Figma Plugin](https://www.figma.com/community/plugin/1166339852662786534/Semi-Design-%E8%AE%BE%E8%AE%A1%E8%BD%AC%E4%BB%A3%E7%A0%81---%E7%A4%BE%E5%8C%BA%E7%89%88) 进行体验，详细使用教程可查阅 https://semi.design/code 


后续结合 D2C 工具，我们能够将团队从海量业务场景中沉淀的页面设计模板，低成本转换为代码模板，用户将能以极低的成本，快速完成前端页面的克隆和结构还原。

![Semi 页面模板 & 落地页转代码 (内部)](https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tech-doc/semiPro.gif)

### A11y

Semi 重视 Web 可访问性，当前我们从语义化标签，主题色盘算法可对比度、文本感知性等方面实现了组件的无障碍支持。  

各组件文档中的 Accessibility 章节对 WAI-ARIA 支持程度给出了详细的描述以及最佳实践建议，同时，我们对于高频使用的组件也提供了键盘事件支持以及焦点可访问性的无障碍支持。但由于无障碍的改进是一项工作量较大的工程，目前我们尚未在所有组件上提供完备键盘与焦点无障碍功能，更多的进展可查阅 [A11y Issue](https://github.com/DouyinFE/semi-design/issues/205)  

Semi 团队后续仍会持续关注并提升组件的可操作性、可感知性，在持续迭代中，在基于鼠标的操作外提供更便捷的键盘交互以及更完善的无障碍功能。

### 多框架

高度可扩展性作为 Semi 的核心设计原则，贯穿于 Semi 的代码架构设计、API 设计、样式层抽象等各个方面。得益于 Foundation/Adapter 架构设计以及样式文件分层原则，Semi 非常易于迁移到其他前端框架。在 2.0 版本，我们基于 Typescript 对 Semi 进行了重写，期望在多框架迁移适配过程中依然能有良好的开发体验以及质量保障。

Foundation 层同样基于 MIT 协议开源，我们会在未来的迭代中，始终保持其代码实现的框架无关性。如果你期望将 Semi Design 带至更多平台框架，我们非常欢迎你对其进行直接复用。

我们团队当前阶段重点会聚焦于 React 体系内，但 WebComponent 也是我们重点关注的方向之一。未来时机合适，我们会进行更多的尝试，敬请期待。

## 设计资源  

![Figma Logo](https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Figma-logo.svg/64px-Figma-logo.svg.png)

-   设计师可以从 Figma 组件库 [Semi Design System](https://www.figma.com/@semi) 获得色盘、样式库及组件。

## 兼容性

-   现代浏览器（Semi 的暗色模式/样式文件依赖于 CSS variable，最低版本要求为 edge，ie11 及以下均不支持）

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt="Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/> Safari | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/opera/opera_48x48.png" alt="Opera" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/>Opera | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/electron/electron_48x48.png" alt="Electron" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)<br/>Electron |
| --- | --- | --- | --- | --- | --- |
| last 2 versions | last 2 versions | last 2 versions | last 2 versions | last 2 versions | last 2 versions |
