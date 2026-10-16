# Implementation Plan: Timeline 图表类型

**Branch**: `001-add-timeline-chart` | **Date**: 2026-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-add-timeline-chart/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

新增 Timeline 图表类型，支持展示事件点与时间点，并具备横向、纵向、径向、S 线等布局类型，支持多系列事件点。技术上在现有 VChart 架构内实现新的 chart 类型与布局模块，遵循跨端一致性与类型约束，提供清晰的 Spec 与示例。

## Technical Context

**Language/Version**: TypeScript (strict)  
**Primary Dependencies**: @visactor/vchart, @visactor/vchart-types, VRender/VGrammar（内部体系）  
**Storage**: N/A  
**Testing**: Jest/Vitest 单元测试 + 视觉回归  
**Target Platform**: Web（桌面/移动）、多端封装一致行为  
**Project Type**: Monorepo（Rush）  
**Performance Goals**: 60fps 交互，Tooltip/Crosshair 响应 <16ms  
**Constraints**: 体积控制，跨端一致性，类型严格，无控制台调试输出  
**Scale/Scope**: 新增一个图表类型及其布局/渲染/交互，不引入外部服务

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- 规范驱动：已有 spec.md，后续设计与实现遵循任务清单
- 类型对齐：新增类型需落位 `@visactor/vchart-types`
- 代码质量：遵循 ESLint/Prettier，严格 TypeScript
- 测试：需新增单元测试与视觉回归用例
- 文档与示例：需在 docs 站点提供示例与 API 文档
- 跨端一致性：Tooltip/Crosshair/Legend 等交互行为需对齐
- 许可证与依赖：不新增不兼容许可证依赖

## Project Structure

### Documentation (this feature)

```text
specs/001-add-timeline-chart/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/vchart/
├── src/chart/timeline/           # Timeline 图表主实现
├── src/component/...             # 复用或新增组件
├── src/theme/...                 # 默认主题扩展（如需）
└── __tests__/...                 # 单元与视觉测试用例

packages/vchart-types/
└── types/chart/timeline.d.ts     # Timeline 的对外类型定义

packages/docs/ (或内部 docs 包)
└── docs/timeline/*               # 文档与示例
```

**Structure Decision**: 在 vchart 核心包内新增 timeline chart 目录；类型定义落位 vchart-types；示例与文档在 docs 包维护；测试用例与视觉回归在 vchart 内。

## Complexity Tracking

No constitution violations identified for this feature.
