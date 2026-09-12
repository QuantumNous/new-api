# Data Model: React-VChart 文档示例补充

## Entity: 示例条目

- **描述**: 文档示例菜单中的一个可访问入口
- **字段**: path, title, group, order, cover, keywords, option
- **关系**: 归属 `examples-react` 目录与 `component` 分组

## Entity: 示例文档

- **描述**: 示例条目的 Markdown 内容
- **字段**: front matter 元信息、示例说明、livedemo 代码块
- **关系**: 与示例条目一一对应

## Entity: 示例代码

- **描述**: React 组合图示例的代码内容
- **字段**: 数据集、图表 spec、组件渲染与卸载逻辑
- **关系**: 嵌入示例文档的 livedemo 代码块
