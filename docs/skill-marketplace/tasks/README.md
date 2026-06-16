# Skill Marketplace Tasks Directory

本目录用于工程师、设计师和产品实现团队，按模块拆分全过程工作内容。该目录针对具体功能、数据、UI、分析和实现细节，保证企业级交付的清晰度。

## 目录结构

- `00_Overview.md`：项目范围、文档使用说明、交付关系
- `01_Functional_Requirements.md`：功能需求、角色、用户旅程、生命周期、RBAC
- `02_UX_Design.md`：信息架构、页面职责、UI 组件、交互状态、可访问性
- `03_Data_Model_and_API_Spec.md`：数据库设计、表结构、索引、API 合约、请求/响应规范
- `04_Analytics_and_Operations.md`：事件字典、指标定义、Dashboard、推荐与增长闭环
- `05_Security_and_NFR.md`：安全要求、Kids Gate、Relay 逻辑、性能/可靠性/NFR
- `06_Module_Breakdown_WBS.md`：Agent-based 模块拆分、依赖关系、Epic 映射、Sprint 计划、P0 最小上线闭环
- `07_CTO_PRD_Review_Action_Items.md`：CTO 级 PRD 一致性控制台、Sprint 0 决策门槛、跨 PRD 对齐状态、Go/No-Go

## 使用说明

1. 先阅读 `00_Overview.md`，确认 `tasks/01-07` 是当前实现级 Source of Truth；根目录 PRD 只作为战略背景。
2. 依据角色选择对应模块：
   - 工程师：`03_Data_Model_and_API_Spec.md`、`05_Security_and_NFR.md`
   - 设计师：`02_UX_Design.md`
   - Ops / Analytics：`04_Analytics_and_Operations.md`
   - 产品经理：`01_Functional_Requirements.md`
   - 项目拆分 / Agent WBS / Sprint Planning：`06_Module_Breakdown_WBS.md`
   - CTO Review / 一致性治理 / Go-No-Go：`07_CTO_PRD_Review_Action_Items.md`
3. 所有模块相互补充，不要依赖单一文档完成实现。

## 交付关系

- `tasks/01-07`：可执行实现级模块 PRD Source of Truth。
- `Skill_Marketplace_PRD_Main.md`：战略、目标、概念、成功标准；不得覆盖 `tasks/01-07` 的实现合约。
- `compliance/*`：上线前合规检查与独立风险节点。
