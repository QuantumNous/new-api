---
status: current
owner: Dev Team
last-reviewed: 2026-07-07
---

# 文档入口

## 项目
本项目是 Go 实现的 AI API 网关/代理，统一聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等上游模型服务，并提供用户、计费、限流与管理后台能力。

## 当前阶段
- 当前阶段：文档结构初始化。
- 当前重点：建立 AI 与新成员可快速定位约束、命令、架构和临时开发记录的目录边界。
- 当前禁止：本次不修改 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` 等 AI 辅助入口文件。

## Read First（AI 与新人按此顺序，不得跳读）
1. AGENTS.md
2. docs/00-context/硬约束.md
3. docs/00-context/项目简介.md
4. docs/20-architecture/架构概览.md
5. docs/30-engineering/命令清单.md
6. docs/30-engineering/AI编码指南.md

## Directory Map
见各目录的 README.md（目标说明）。除 README、Taskfile、模板等通用文件外，业务文档文件名使用中文。
