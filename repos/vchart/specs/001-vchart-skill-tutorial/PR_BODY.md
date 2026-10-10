<!--
First of all, thank you for your contribution! 😄
For requesting to pull a new feature or bugfix, please send it from a feature/bugfix branch based on the `main` branch.
Before submitting your pull request, please make sure the checklist below is confirmed.
Your pull requests will be merged after one of the collaborators approve.
Thank you!
-->

[[中文版模板 / Chinese template](https://github.com/VisActor/VChart/blob/main/.github/PULL_REQUEST_TEMPLATE/pr_cn.md?plain=1)]

### 🤔 This is a ...

- [x] New feature
- [ ] Bug fix
- [ ] TypeScript definition update
- [ ] Bundle size optimization
- [ ] Performance optimization
- [ ] Enhancement feature
- [ ] Refactoring
- [ ] Update dependency
- [ ] Code style optimization
- [ ] Test Case
- [ ] Branch merge
- [ ] Release
- [ ] Site / documentation update
- [ ] Demo update
- [ ] Workflow
- [ ] Other (about what?)

### 🔗 Related issue link

<!--
1. Put the related issue or discussion links here.
2. close #xxxx or fix #xxxx for instance.
-->

### 🔗 Related PR link

<!-- Put the related PR links here. -->

### 🐞 Bugserver case id

<!-- paste the `fileid` field in the bugserver case url -->

### 💡 Background and solution

在 VChart 文档站新增一篇“VChart Skill 使用”教程，并将其挂载到与“快速上手”同级的导航层级。教程以用户提供的参考正文为语义来源，覆盖技能简介、安装方式、编辑器适配（Cursor/Trae）以及三个可执行场景（生成简单图表、调整图表样式、修复配置问题），同时保持与现有文档规范一致。

**Language/Version**: Markdown + JSON（文档内容与菜单配置）
**Primary Dependencies**: `@internal/docs` 文档构建体系、`docs/assets/guide/menu.json` 导航配置、现有教程目录结构
**Storage**: N/A
**Testing**: 文档构建与链接可达性检查（本地 docs 预览 + 静态路径校验）
**Target Platform**: VChart 官方文档站（zh 主路径，en 路径不新增正文）
**Project Type**: Rush Monorepo（文档子系统变更）
**Performance Goals**: 不引入额外运行时成本；页面加载复杂度与现有教程同级
**Constraints**: 必须与“快速上手”同级；教程内容与参考正文一致但需可验证；不得破坏现有导航结构
**Scale/Scope**: 1 篇新增教程 + 1 处导航配置调整 + 文档内链与示例片段
### 📝 Changelog

<!--
Describe changes from the user side, and list all potential break changes or other risks.
--->

| Language   | Changelog |
| ---------- | --------- |
| 🇺🇸 English | Add a VChart Skill tutorial and place it at the same navigation level as Quick Start, with installation, editor references, and guided demo scenarios. |
| 🇨🇳 Chinese |           |

### ☑️ Self-Check before Merge

⚠️ Please check all items below before requesting a reviewing. ⚠️

- [ ] Doc is updated/provided or not needed
- [ ] Demo is updated/provided or not needed
- [ ] TypeScript definition is updated/provided or not needed
- [ ] Changelog is provided or not needed

---

<!--
Below are template for copilot to generate CR message.
Please DO NOT modify it.
-->

### 🚀 Summary

copilot:summary

### 🔍 Walkthrough

copilot:walkthrough