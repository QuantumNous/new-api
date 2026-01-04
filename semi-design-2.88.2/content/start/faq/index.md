---
category: 开始
title: FAQ 常见问题
icon: doc-faq
localeCode: zh-CN
order: 11
---

#### Semi 提供了 Figma UI Kit，考虑提供 Sketch 或基于其他设计工具的版本吗？
暂无计划，具体原因请参考 [Issue 74](https://github.com/DouyinFE/semi-design/issues/74)

#### Semi 目前提供了基于 React 版本的 ui library，是否有官方提供其他技术栈 lib 的计划？
暂无计划。具体原因：[Issue 311](https://github.com/DouyinFE/semi-design/issues/311)，更多讨论 [Issue 56](https://github.com/DouyinFE/semi-design/issues/56)

#### Semi 后续会提供移动端组件吗 ？ 
暂无计划，具体原因参考 [discussions 287](https://github.com/DouyinFE/semi-design/discussions/287)

#### Semi 的默认的主题风格跟我们系统的定位不符，可以配置另外的主题吗？

- 具体请参考 [定制主题](/zh-CN/start/customize-theme) 。Semi 提供**多达 3000+ Design Token 允许用户进行深度定制**，无论你是研发还是设计师，在 [Semi DSM](/dsm) 里可以非常方便地进行样式层配置，并在代码、设计稿始终保持双向同步。基于 Semi 你可以**低成本定制属于你自己的 Design System** 将 `Semi Design` 定制为 `Any Design`
- 并且在使用时，你也只需要在 webpack.config.js 里指定使用的主题包名即可完成接入（需接入 Semi 插件）
  
#### 什么情况下推荐使用 Design Token 定制样式，什么情况下推荐通过 css 覆盖方式定制样式？

- Design Token 主要适用于需要做品牌化、样式风格定制的场景，需要通过 [Semi DSM](/dsm) 进行配置，发布产物为 npm 主题包。Design Token的作用范围为全局生效。例如调整了 Button、Table 的组件级Token，那么对于 App 内所有 Semi Button、Semi Table 都会生效，无法仅针对某个特定子模块调整
- 如果你只需要将某个特定模块下的某个组件的样式做调整，不推荐使用 Design Token，推荐直接使用 CSS 选择器覆盖样式

#### Semi 2.x 与 Semi 1.x 有什么不同？

-   Semi v2.0 版本 基于 v1.x 使用 ts 进行了重构，带来了更好的 ts 使用体验、以及更开箱即用的工程化方案，更好的a11y支持，支持局部启用暗色/亮色模式，解决了对微前端场景下多组件库共存的样式冲突问题等。Semi 2.x 为开源版本， Semi 团队后续所有长期工作都将基于 v2.x 版本进行
-   v1.x 已停止迭代维护，不再进行feature添加或复杂变更，仅提供必要的 bug fix 变更。
-   我们建议大家直接使用 2.x [@douyin/semi-ui](https://semi.design) 进行开发。现有旧项目，我们也建议大家尽快进行升级。为减轻升级成本，我们提供了 cli 工具一键迁移（@ies/semi-codemod-v2 ）可帮助大家自动完成高达 90%的迁移修改（受限于 AST 实现原理，仍存在一小部分 case 需人工 review 修改，但不多 😉 ）
-   Semi 1.x 升级至 Semi 2.x 详细操作步骤请查阅 [从 v1 到 v2](https://semi.design/zh-CN/start/update-to-v2)

#### 各版本之间的关系

-   Semi 版本号遵循 Semver 规范（主版本号-次版本号-修订版本号），我们会在 minor 版本新增 feature 或组件，在 patch 版本我们仅会进行 bug 修复，而不会做新功能更新。**但不同 minor 版本之间可能存在样式上的调整**，当你需要升级时，我们推荐你在 changelog 页面使用版本 Diff 功能，检查所有变更并确实是否对你的业务系统有影响。
-   后续所有新 Feature、新组件都会基于 2.x 版本进行开发，我们推荐业务方尽可能地保持使用最新版本
-   2.x 各版本之间，API 会保持**向前兼容**
-   1.x 各版本之间，API 也会保持**向前兼容**。由 1.x 升级到 2.x 时，会包含 breaking change，具体升级注意事项请查阅文档

#### Semi 是否支持 Tree Shaking

Semi 执行发包时，发布的其实是 esModule 源码，因此天然支持 tree shaking，不需要再进行额外的配置; 组件的 Scss 也是由组件的 index.(j|t)sx 负责 import 的，因此样式也会 shaking。简单来说，只有你使用的组件会被打包。

#### 为什么 defaultValue、defaultXXX 不起作用？

Semi 组件中，所有的 defaultValue、defaultXXX 传参只会在组件被 mounted 时进行消费（即仅消费一次）。如果你的 defaultXXX 属性是后期进行异步更新的，组件不会重新进行消费该值。如有需要，你应该使用受控的 value，受控的 xxx。或者直接通过传入一个不一样的`key`值，强制 React 重新挂载该组件。

#### TS 类型检查报错，提示 xxx 上不存在属性 children 或 XXX 不能用作 JSX 组件
这是由于 `@types/react` v18 进行了 breaking change，大部分情况下你的项目里会安装了两个不同版本的 @types/react，导致无法匹配。请参考 [Issue 793](https://github.com/DouyinFE/semi-design/issues/793) 锁定版本确保只有单个版本存在

#### 安装新版本 Semi 后，提示 can't resolve date-fns/esm/\_libs/cloneObject.js 或其他有 date-fns 相关的依赖错误

检查下项目中的 package-lock.json，是否有其他包依赖了 date-fns（大概率是 1.x 的），导致 semi 依赖声明的 date-fns 2.x 没有被安装上。手动 install date-fns，确保是 2.x 版本的即可 `npm install date-fns date-fns-tz`

#### Semi 支持 i18n 吗？

Semi 目前支持 21 种语言，具体使用可以查阅 [Semi·LocaleProvider](/zh-CN/other/locale)

#### Semi 的样式是基于 Scss 还是 Less ？为什么不用 CSS Module？

我们的样式基于 Scss，与此我们还使用了 CSS Variable 作为色盘变量。色盘变量和通用变量挂载在 body 下。不使用 CSS Module 是因为我们希望有固定的 className，为业务方保留修改/覆盖 Semi 样式的能力（虽然不提倡，但有些业务场景下确实需要）

#### 为什么 Tooltip content 配置很长很长的内容时，某些情况下内容会超出显示区域?

在 v2.36.0 版本以前，考虑到不同语言内容（纯英文、中文、中英文混合、其他语种混合）对换行的需求不太一致，所以组件层没有做这个预设。在接收到较多使用反馈后，自 v2.36.0 版本，Tooltip 内部通过设置 <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap" target="_blank" rel="noopener noreferrer">word-wrap</a> 为 break-word 处理文本换行。对于任意版本，如果默认设置不符合预期，使用方都可以通过 style/className API 设置换行相关 CSS 属性进行调整。

#### 有新组件需求、或者现有组件 Feature 不能满足我的业务需求，该找谁？

在Github 提交 Issue，描述你的需求以及业务场景，Label 选择 `Feature Request` / `New Component Request`

#### 对组件的使用有疑惑？不知道有没有能满足你业务需求场景的组件？

欢迎进我们的 [客服飞书 Lark 群](https://bytedance.feishu.cn/docs/doccnw93Dujm3UCkHRDTMTm1qwe) 进行咨询提问。

#### 希望自定义滚动条的样式？

可以使用 `.semi-light-scrollbar` 类名，会对 webkit (chrome/safari) 的浏览器应用 Semi 的滚动条样式。该类名放在最外层的 DOM 元素即可，会对所有子元素生效。注：使用了通配符，可能会对性能有影响。其他浏览器可以参考是否有相关的 css 属性支持滚动条的样式定制。

#### 更多的 FAQ

请查阅 https://bytedance.feishu.cn/docs/doccnMRDbkhde6p3dMokfFpcNug
