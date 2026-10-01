# Data Model: vchart-skill 教程文档

## Entities

### TutorialDoc（教程文档）
- Fields:
  - id: String（唯一标识）
  - title: String（文档标题，如“VChart Skill 使用”）
  - locale: Enum(`zh`, `en`)（本期主要为 `zh`）
  - path: String（文档相对路径）
  - sections: Section[]（章节集合）
  - updatedAt: Date（更新时间）

### Section（章节）
- Fields:
  - key: String（章节标识，如 `intro`, `install`, `demo`）
  - heading: String（章节标题）
  - order: Number（章节顺序）
  - contentBlocks: ContentBlock[]（段落/代码/图片等）

### ContentBlock（内容块）
- Fields:
  - type: Enum(`paragraph`, `code`, `image`, `link`, `list`)
  - value: String/Object（内容本体）
  - required: Boolean（是否必填）

### MenuItem（导航节点）
- Fields:
  - key: String（菜单项唯一 key）
  - zh: String（中文名称）
  - en: String（英文名称，允许占位）
  - menu: String（关联文档路径）
  - category: String（所属目录）
  - order: Number（排序）
  - level: Number（层级）

## Relationships

- 一个 `TutorialDoc` 包含多个 `Section`（1:N）。
- 一个 `Section` 包含多个 `ContentBlock`（1:N）。
- 一个 `MenuItem` 关联一个 `TutorialDoc.path`（1:1）。

## Validation Rules

- 教程必须包含 `intro` 与 `install-demo` 两个一级章节（对应 FR-004）。
- 教程必须包含两条安装命令内容块（对应 FR-006）。
- 教程必须包含三类 Demo 场景内容块（对应 FR-012）。
- `MenuItem.level` 必须与“快速上手”所在节点同级（对应 FR-002）。
- `MenuItem.menu` 与 `TutorialDoc.path` 必须可解析且构建后无死链（对应 FR-008）。
