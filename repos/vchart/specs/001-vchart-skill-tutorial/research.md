# Research: 新增 vchart-skill 教程文档

## 决策与依据

### Decision 1: 教程主文仅新增中文版本
- **Decision**: 本期仅在 `zh` 文档路径新增完整教程，不新增英文正文。
- **Rationale**: 需求明确目标为“新增教程并与快速上手同级”，且输入内容为中文；可在最小范围内快速交付。
- **Alternatives considered**: 同步新增中英文双语教程（成本更高，超出当前需求范围）。

### Decision 2: 导航“同级”按 menu 节点层级定义
- **Decision**: “与快速上手同级”解释为 `menu.json` 中节点深度同级，而非文档标题层级。
- **Rationale**: 这是文档站信息架构层面的可验证标准，且已在 spec 假设中明确。
- **Alternatives considered**: 仅在正文中增加“快速上手”跳转（无法满足导航同级要求）。

### Decision 3: 教程内容以“可执行闭环”组织
- **Decision**: 教程采用“简介 → 安装 → 三个 Demo 场景 → 注意事项”结构。
- **Rationale**: 与用户提供参考正文一致，并满足首次用户可直接复现的核心目标。
- **Alternatives considered**: 纯概念说明（无法满足 FR-006/FR-012 的可执行要求）。

### Decision 4: 安装指令采用双命令并列展示
- **Decision**: 明确保留两种安装命令：`npx skills add VisActor/VChart` 与 `--skill vchart-development-assistant` 形式。
- **Rationale**: 两种方式都在用户提供正文中出现，可覆盖不同用户偏好。
- **Alternatives considered**: 只保留一种命令（降低兼容性与参考一致性）。

### Decision 5: 编辑器适配最小范围覆盖 Cursor 与 Trae
- **Decision**: 教程明确支持 Cursor、Trae 两类编辑器，并给出参考文档入口。
- **Rationale**: 这是参考正文的主要外部依赖信息，可显著降低首次配置失败率。
- **Alternatives considered**: 广泛扩展到更多编辑器（超出当前输入范围，维护成本更高）。

## 未解决问题

无 `NEEDS CLARIFICATION` 项，研究阶段完成。
