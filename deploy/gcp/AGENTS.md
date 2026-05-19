<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# deploy/gcp

## Purpose

GCP（Google Cloud Platform）基础设施的 Terraform IaC 代码，部署项目 `vocai-gemini-prod`。基础设施包括：Cloud Run（应用服务）、Cloud SQL（PostgreSQL 数据库）、Memorystore（Redis 缓存）、Artifact Registry（容器镜像仓库）、Cloud Load Balancing（HTTPS 负载均衡）、Cloud Monitoring（监控告警）、GitHub WIF（Workload Identity Federation，CI/CD 无密钥认证）。

> **在执行任何 terraform 或 gcloud 命令前，必须先阅读 `docs/OPERATIONS.md`（CLAUDE.md Rule 8）。**

## Key Files

| File | Description |
|------|-------------|
| `docs/OPERATIONS.md` | **首要阅读文档**：Terraform state 位置、双套认证系统（ADC vs 用户 CLI）、CI/CD 管理字段的 lifecycle.ignore_changes、env-var 更新冲突解决方案、HTTPS 托管证书轮换停机窗口、Cloudflare DNS 约束、whitelabel 渠道注册表 |
| `docs/INFRASTRUCTURE.md` | 资源清单：所有 GCP 资源的详细说明、命名规范、配置参数 |
| `docs/DEPLOYMENT.md` | 部署与回滚操作流程 |
| `README.md` | 快速入门和目录结构说明 |
| `bootstrap.sh` | 首次初始化脚本（Terraform state bucket、基础 IAM） |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `modules/` | 可复用 Terraform 模块：`apis/`、`artifact-registry/`、`cloud-lb/`、`cloud-run/`、`cloud-sql/`、`github-wif/`、`memorystore/`、`monitoring/`、`network/`、`secrets/`、`service-accounts/` |
| `envs/prod/` | prod 环境实例：引用 `modules/` 中的模块，定义 prod 环境的具体参数值（`main.tf`、`variables.tf`、`terraform.tfvars`、`backend.tf`） |

**modules/ 与 envs/ 的关系**：`modules/` 中的每个子目录是独立的、无状态的可复用 Terraform 模块；`envs/prod/` 是"组合层"，通过 `source = "../../modules/<name>"` 引用这些模块并传入 prod 环境的具体变量值。若需新建 staging 环境，可新增 `envs/staging/` 引用相同的 modules。

## For AI Agents

### Working In This Directory

1. **必须先读** `docs/OPERATIONS.md`，了解以下关键约束：
   - Terraform state 存储在远端 GCS bucket（`backend.tf` 中配置），本地 `tfplan` 文件不代表当前 state
   - 两套认证系统：Terraform 使用 ADC（`gcloud auth application-default login`），gcloud CLI 使用用户账号（`gcloud auth login`）
   - Cloud Run 服务的部分字段由 CI/CD 管理，在 `lifecycle.ignore_changes` 中列出，手动 apply 时不会覆盖
   - 更新环境变量时存在 revision 冲突风险，按 `OPERATIONS.md` 中的 workaround 操作
   - 修改 `lb_domains` 会触发 HTTPS 证书轮换，存在停机窗口，必须提前告知用户
2. 所有变更先 `terraform plan` 审查再 `terraform apply`。
3. 不要直接编辑 `envs/prod/.terraform/` 目录下的文件（provider 缓存，由 `terraform init` 管理）。
4. `terraform.tfvars` 包含敏感变量（project_id、region 等），不要提交新的密钥值到版本控制。

### Testing Requirements

- `terraform validate` 验证 HCL 语法
- `terraform plan` 审查变更影响范围
- 涉及 Cloud Run 或数据库的变更，在 staging 环境（如存在）先验证

### Common Patterns

```bash
# 初始化（首次或 provider 版本变更后）
cd deploy/gcp/envs/prod
terraform init

# 预览变更
terraform plan -out=tfplan

# 应用变更
terraform apply tfplan
```

## Dependencies

### Internal

无（基础设施层，不依赖 Go 代码）

### External

- Terraform >= 1.x
- `hashicorp/google` provider 6.50.x
- `hashicorp/google-beta` provider 6.50.x
- Google Cloud SDK（gcloud CLI）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
