<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# deploy

## Purpose

存放部署相关的基础设施配置，当前包含 GCP（Google Cloud Platform）的 Terraform IaC 代码。未来可扩展其他云平台或部署方式的配置目录。

## Key Files

无根目录文件，所有内容位于子目录。

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `gcp/` | GCP 基础设施 Terraform 代码（Cloud Run、Cloud SQL、Memorystore、负载均衡、监控等），包含 `modules/`（可复用模块）和 `envs/prod/`（prod 环境实例）|

## For AI Agents

### Working In This Directory

- 在对 `deploy/gcp/` 执行任何 `terraform`、`gcloud` 命令前，**必须先阅读** `deploy/gcp/docs/OPERATIONS.md`（CLAUDE.md Rule 7）。
- 目录结构遵循 Terraform 模块化约定：`modules/` 定义可复用组件，`envs/prod/` 组合各模块形成完整的 prod 环境。

### Testing Requirements

- 基础设施变更须先运行 `terraform plan` 审查，确认无意外资源变更后再 `terraform apply`。
- 参见 `deploy/gcp/docs/OPERATIONS.md` 获取完整的操作规范。

### Common Patterns

参见子目录 `gcp/AGENTS.md`。

## Dependencies

### Internal

无

### External

- Terraform >= 1.x
- Google Cloud SDK（gcloud CLI）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
