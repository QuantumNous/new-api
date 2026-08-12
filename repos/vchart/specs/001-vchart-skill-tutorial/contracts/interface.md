# Documentation Contract: vchart-skill Tutorial

## 1. Navigation Contract

- **Contract ID**: DOC-NAV-001
- **Input**: 新增教程菜单配置
- **Rules**:
  - 菜单节点必须位于与“快速上手”同级层级。
  - 菜单节点必须指向有效教程路径。
  - 菜单文案需清晰表达主题（vchart-skill 使用）。
- **Output**: 文档站可见教程入口且可访问。

## 2. Content Contract

- **Contract ID**: DOC-CONTENT-001
- **Input**: 教程 markdown 正文
- **Rules**:
  - 必须包含“简介”“安装与简单 Demo”一级章节。
  - 必须包含两条安装命令：
    - `npx skills add VisActor/VChart`
    - `npx skills add VisActor/VChart --skill vchart-development-assistant`
  - 必须包含三类示例：
    - 生成简单图表
    - 调整图表样式
    - 修复配置问题
  - 必须包含编辑器适配信息（Cursor、Trae）与参考链接。
- **Output**: 教程内容完整且可执行。

## 3. Link Integrity Contract

- **Contract ID**: DOC-LINK-001
- **Input**: 菜单路径、文内链接、外部参考链接
- **Rules**:
  - 站内链接不得产生 404。
  - 文内外部链接需具备可识别描述文本。
  - 构建后教程页面可正常加载，无关键资源缺失。
- **Output**: 文档站链接健康，满足可用性要求。
