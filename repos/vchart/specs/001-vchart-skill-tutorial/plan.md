# Implementation Plan: 新增 vchart-skill 教程文档

**Branch**: `001-vchart-skill-tutorial` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-vchart-skill-tutorial/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

在 VChart 文档站新增一篇“VChart Skill 使用”教程，并将其挂载到与“快速上手”同级的导航层级。教程以用户提供的参考正文为语义来源，覆盖技能简介、安装方式、编辑器适配（Cursor/Trae）以及三个可执行场景（生成简单图表、调整图表样式、修复配置问题），同时保持与现有文档规范一致。

## Technical Context

**Language/Version**: Markdown + JSON（文档内容与菜单配置）  
**Primary Dependencies**: `@internal/docs` 文档构建体系、`docs/assets/guide/menu.json` 导航配置、现有教程目录结构  
**Storage**: N/A  
**Testing**: 文档构建与链接可达性检查（本地 docs 预览 + 静态路径校验）  
**Target Platform**: VChart 官方文档站（zh 主路径，en 路径不新增正文）  
**Project Type**: Rush Monorepo（文档子系统变更）  
**Performance Goals**: 不引入额外运行时成本；页面加载复杂度与现有教程同级  
**Constraints**: 必须与“快速上手”同级；教程内容与参考正文一致但需可验证；不得破坏现有导航结构  
**Scale/Scope**: 1 篇新增教程 + 1 处导航配置调整 + 文档内链与示例片段

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **质量优先**: 以文档可执行性和链接正确性为验收标准，避免“只有介绍无操作闭环”。
- [x] **用户体验驱动**: 教程明确安装步骤、编辑器适配与常见场景，降低上手成本。
- [x] **规范驱动开发**: 已完成 `spec.md` 与 checklist，本计划仅围绕规范展开。
- [x] **开放协作**: 参考内容来源与假设均在文档中透明记录，便于后续审阅与更新。
- [x] **增量演进**: 仅新增教程与菜单节点，不改变现有核心渲染或 API 行为。
- [x] **文档与示例同步**: 本变更本质为文档功能，产出即为对外可见能力。

## Project Structure

### Documentation (this feature)

```text
specs/001-vchart-skill-tutorial/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
docs/assets/guide/
├── menu.json                                        # 导航结构，新增与“快速上手”同级入口
└── zh/tutorial_docs/
    ├── Getting_Started.md                           # 现有“快速上手”（用于同级定位参考）
    └── Basic/
        └── VChart_Skill_Usage.md                    # 新增教程文档（拟定路径）

docs/assets/guide/en/tutorial_docs/
└── (no new tutorial content in this feature scope)  # 本期不新增英文正文，仅保证导航不产生坏链
```

**Structure Decision**: 采用“中文教程正文 + 导航同级挂载”的最小增量策略；通过 `menu.json` 增加节点并落地到 `zh/tutorial_docs/Basic` 下新文档，避免对现有章节结构造成破坏。

## Complexity Tracking

No constitution violations identified for this feature.
