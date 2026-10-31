# VChart Development Assistant - 用户使用说明

## 这个助手适合什么场景

- 从 0 到 1 生成图表（柱状图、折线图、饼图等）
- 修改已有图表样式（颜色、标签、图例、tooltip、坐标轴）
- 排查图表问题（不显示、报错、交互不生效、数据映射错误）
- 从截图/Figma 还原图表
- 增加交互能力（点击事件、动态更新、联动高亮、导出图片、主题切换）

## 如何提问效果最好

建议一次性提供以下信息：

- 使用环境：原生 JS / React-VChart（`@visactor/react-vchart`）/ 其他框架
- 目标：你想实现什么图表或效果
- 数据：至少给 5~10 条样例数据（或字段结构）
- 当前代码：如果是改造/排错，贴出当前 spec 或关键代码
- 期望与现状：预期效果 + 实际问题（报错信息/截图）

推荐提问模板：

```text
请用 VChart 帮我实现一个[图表类型]。
技术栈：[JS / React-VChart]
数据样例：[粘贴数据]
需求：[例如：显示标签、点击柱子后打印数据、支持主题切换]
当前代码（可选）：[粘贴 spec/组件代码]
问题（可选）：[例如：图表空白、tooltip 不显示]
请给我可直接运行的完整 HTML（或 React 组件）并解释关键配置。
```

## 可直接使用的示例 Prompt

```text
用 VChart 生成一个基础柱状图，包含 xField、yField，并给出最小可运行示例。
```

```text
在我现有柱状图基础上优化颜色、标签样式和图例可读性，保持数据结构不变。
```

```text
帮我检查当前 VChart spec 的配置错误，指出问题位置并给出可直接替换的修复版本。
```

## 你会得到什么输出

- 可直接运行的完整代码（默认包含完整 HTML）
- 关键配置说明（为什么这么配）
- 如果是排错场景：问题定位 + 修复建议 + 修复后代码
- 如果有交互需求：同时给出 API 事件/状态/数据更新代码

## 常见问题建议

- 图表空白时，先检查 `xField` / `yField` 是否与数据字段名完全一致
- 检查数据结构是否符合 VChart 要求（尤其是 `data` 和 `values`）
- 如果是 React 场景，确认依赖版本和组件导入方式正确
- 问题无法复现时，优先提供最小复现代码和报错截图

## 参考文档

- VChart Skill Usage：`https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Skill_Usage`
- VChart Quick Start：`https://www.visactor.io/vchart/guide/tutorial_docs/Getting_Started`
- VChart 配置项文档：`https://www.visactor.io/vchart/option`
- VChart API 文档：`https://www.visactor.io/vchart/api/API/vchart`
