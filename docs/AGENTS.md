<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# docs

## Purpose

存放面向人类读者的项目文档，包括渠道配置指南、安装说明、API 规范、翻译词汇表等。

**与 AGENTS.md 的角色区分**：
- `docs/`：面向人类开发者、运维人员、最终用户的叙述性文档（Markdown、OpenAPI JSON、HTML、图片）
- `AGENTS.md`：面向 AI Agent 的代码导航元数据（仅描述代码结构和约定，不是用户文档）

## Key Files

| File | Description |
|------|-------------|
| `translation-glossary.md` | 翻译词汇表（通用） |
| `translation-glossary.fr.md` | 法语翻译词汇表 |
| `translation-glossary.ru.md` | 俄语翻译词汇表 |
| `ionet-client.md` | io.net 客户端集成说明 |
| `Claude code api文档.md` | Claude Code API 使用文档 |
| `Claude code api文档_副本.md` | Claude Code API 文档副本 |
| `ai-dev-deploy-share.html` | AI 开发部署分享页面（HTML 格式） |
| `TODO.md` | 文档待办事项列表 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | 非标准 API 端点的补充文档：`flatkey-video-api.md`、`video-api.md`，以及 `blockrun-seedance-video-api.html`、`seedance-video-api.html`、`seedance-video-test-report.html`、`usage-reconciliation-api.html` 等 HTML 格式 API 文档 |
| `channel/` | 各渠道接入配置说明：`flatkey.md`、`blockrun.md`、`codex.md`、`other_setting.md`，以及 `blockrun-pricing-audit.md`、`blockrun-vip-migration.md`、`claude-error-type-nil-followup.md` 等 |
| `images/` | 文档引用的图片资源（合作伙伴 logo、截图等） |
| `installation/` | 安装部署指南（`BT.md` 宝塔面板安装） |
| `openapi/` | OpenAPI 规范文件（`api.json`、`relay.json`），定义管理 API 和 relay API 的接口契约 |
| `superpowers/` | Superpowers 工作流相关的规划文档和待办事项（`plans/`、`specs/`、`todos.md`） |

## For AI Agents

### Working In This Directory

- 此目录为只读文档，AI Agent 通常无需修改这里的文件，除非明确被要求更新文档。
- `openapi/api.json` 和 `openapi/relay.json` 是 API 接口契约，修改 controller 层接口时，若影响对外接口应同步更新这两个文件。
- `channel/` 下的文档描述渠道配置 UI 的使用方式，不是代码规范，不要将其误认为代码约束。
- `translation-glossary.*.md` 文件记录各语言翻译的标准术语，前端添加新翻译时应参照词汇表保持术语一致性。
- `docs/superpowers/plans/` 是历史规划文档，仅供参考，不代表当前代码状态。
- `api/` 中的 HTML 文件（`blockrun-seedance-video-api.html`、`seedance-video-api.html` 等）是对外 API 文档的渲染版本，不应直接编辑，对应源文档为同目录的 `.md` 文件。

### Testing Requirements

- 文档本身无测试需求。
- 修改 `openapi/*.json` 时，可用 OpenAPI 校验工具（如 `swagger-cli validate`）检查格式合法性。

### Common Patterns

无代码模式，文档目录。

## Dependencies

### Internal

无

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
