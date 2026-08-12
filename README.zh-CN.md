<picture>
  <img alt="Rsbuild Banner" src="https://assets.rspack.rs/rsbuild/rsbuild-banner.png">
</picture>

# Rsbuild

<p>
  <a href="https://discord.gg/XsaKEEk4mW"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat-square&logo=discord&colorA=564341&colorB=EDED91" alt="discord channel" /></a>
  <a href="https://npmjs.com/package/@rsbuild/core"><img src="https://img.shields.io/npm/v/@rsbuild/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>
  <a href="https://npmcharts.com/compare/@rsbuild/core"><img src="https://img.shields.io/npm/dm/@rsbuild/core.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="downloads" /></a>
  <a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/node/v/@rsbuild/core.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="node version"></a>
  <a href="https://github.com/web-infra-dev/rsbuild/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="license" /></a>
  <a href="https://deepwiki.com/web-infra-dev/rsbuild"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</p>

[English](./README.md) | [Portuguese](./README.pt-BR.md) | 简体中文

Rsbuild 是一个由 [Rspack](https://rspack.rs/zh/) 驱动的现代 Web 应用构建工具。

它提供快速的构建体验和高度优化的构建产物，同时保持配置简单一致，并支持通过插件进行扩展。

## 🔥 特性

Rsbuild 具备以下特性：

- **易于配置**：Rsbuild 的目标之一，是为 Rspack 用户提供开箱即用的构建能力，使开发者能够在零配置的情况下开发 web 项目。同时，Rsbuild 提供一套语义化的构建配置，以降低 Rspack 配置的学习成本。

- **性能优先**：Rsbuild 集成了社区中基于 Rust 的高性能工具，包括 [Rspack](https://rspack.rs)，[SWC](https://swc.rs/) 和 [Lightning CSS](https://lightningcss.dev/)，以提供一流的构建速度和开发体验。

- **插件生态**：Rsbuild 内置一个轻量级的插件系统，提供一系列高质量的官方插件。此外，Rsbuild 兼容大部分的 webpack 插件和所有的 Rspack 插件，这意味着你可以在 Rsbuild 中使用社区或公司内沉淀的现有插件，而无须重写相关代码。

- **产物稳定**：Rsbuild 设计时充分考虑了构建产物的稳定性，它的开发和生产构建产物具备较强的一致性，并自动完成语法降级和 polyfill 注入。Rsbuild 也提供插件来进行 TypeScript 类型检查和产物语法检查，以避免线上代码的质量问题和兼容性问题。

- **框架无关**：Rsbuild 不与前端 UI 框架耦合，并通过插件来支持 React、Vue、Svelte、Solid、Preact 等框架，未来也计划支持社区中更多的 UI 框架。

## 📚 文档

- [Rsbuild v2 文档](https://rsbuild.rs/zh/)
- [Rsbuild v1 文档](https://v1.rsbuild.rs/zh/)

## 🦀 Rstack

Rstack 是一个以 Rspack 为核心的 JavaScript 统一工具链，具有优秀的性能和一致的架构。

| 名称                                                  | 描述           | 版本                                                                                                                                                                             |
| ----------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Rspack](https://github.com/web-infra-dev/rspack)     | 打包工具       | <a href="https://npmjs.com/package/@rspack/core"><img src="https://img.shields.io/npm/v/@rspack/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>     |
| [Rsbuild](https://github.com/web-infra-dev/rsbuild)   | 构建工具       | <a href="https://npmjs.com/package/@rsbuild/core"><img src="https://img.shields.io/npm/v/@rsbuild/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>   |
| [Rslib](https://github.com/web-infra-dev/rslib)       | 库开发工具     | <a href="https://npmjs.com/package/@rslib/core"><img src="https://img.shields.io/npm/v/@rslib/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>       |
| [Rspress](https://github.com/web-infra-dev/rspress)   | 静态站点生成器 | <a href="https://npmjs.com/package/@rspress/core"><img src="https://img.shields.io/npm/v/@rspress/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>   |
| [Rsdoctor](https://github.com/web-infra-dev/rsdoctor) | 构建分析工具   | <a href="https://npmjs.com/package/@rsdoctor/core"><img src="https://img.shields.io/npm/v/@rsdoctor/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a> |
| [Rstest](https://github.com/web-infra-dev/rstest)     | 测试框架       | <a href="https://npmjs.com/package/@rstest/core"><img src="https://img.shields.io/npm/v/@rstest/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>     |
| [Rslint](https://github.com/web-infra-dev/rslint)     | 代码检查工具   | <a href="https://npmjs.com/package/@rslint/core"><img src="https://img.shields.io/npm/v/@rslint/core?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>     |

## 🔗 链接

- [awesome-rstack](https://github.com/rstackjs/awesome-rstack)：与 Rstack 相关的精彩内容列表。
- [agent-skills](https://github.com/rstackjs/agent-skills)：Rstack 的 Agent Skills 合集。
- [rstack-examples](https://github.com/rstackjs/rstack-examples)：Rstack 的示例项目。
- [storybook-rsbuild](https://github.com/rstackjs/storybook-rsbuild)：基于 Rsbuild 构建的 Storybook。
- [rsbuild-plugin-template](https://github.com/rstackjs/rsbuild-plugin-template)：使用此模板创建你的 Rsbuild 插件。
- [rstack-design-resources](https://github.com/rstackjs/rstack-design-resources)：Rstack 的设计资源。

## 🤝 参与贡献

> [!NOTE]
> 我们非常欢迎任何对 Rsbuild 的贡献！

请阅读 [贡献指南](https://github.com/web-infra-dev/rsbuild/blob/main/CONTRIBUTING.md) 来共同参与 Rsbuild 的建设。

### 贡献者

<a href="https://github.com/web-infra-dev/rsbuild/graphs/contributors" target="_blank">
  <img src="https://contrib.rocks/image?repo=web-infra-dev/rsbuild&columns=24">
</a>

### 行为准则

本仓库采纳了字节跳动的开源项目行为准则。请点击 [行为准则](./CODE_OF_CONDUCT.md) 查看更多的信息。

## 🧑‍💻 社区

欢迎加入我们的 [Discord](https://discord.gg/XsaKEEk4mW) 交流频道！Rstack 团队和用户都在那里活跃，并且我们一直期待着各种贡献。

你也可以加入 [飞书群](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=3c3vca77-bfc0-4ef5-b62b-9c5c9c92f1b4) 与大家一起交流。

## 🙏 致谢

Rsbuild 的部分实现和 API 设计参考或改编自社区中的优秀开源项目。我们真诚感谢这些项目为开源社区沉淀的经验、思路与实现：

- [create-react-app](https://github.com/react/create-react-app)
- [Vite](https://github.com/vitejs/vite)
- [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin)
- [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware)
- [connect-history-api-fallback](https://github.com/bripkens/connect-history-api-fallback)
- [preload-webpack-plugin](https://github.com/vuejs/preload-webpack-plugin)
- [dotenv](https://github.com/motdotla/dotenv)

## 📖 License

Rsbuild 项目基于 [MIT 协议](https://github.com/web-infra-dev/rsbuild/blob/main/LICENSE)，请自由地享受和参与开源。
