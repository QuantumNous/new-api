# Fork 改动记录

本文档记录本 fork 自 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 之后，由本 fork 自己维护的非上游改动。

说明：
- 只记录本 fork 自己的非 merge commit。
- 不把同步上游 `main` 带来的 merge 内容算作自定义改动。
- 当前工作区口径基于 `main` 分支。
- 本文档的主要用途：后续更新/覆盖上游源代码后，可以按这里的记录重新应用本 fork 的自定义修改。

---

## 改动概览

| 类别 | 文件 | 说明 |
|------|------|------|
| Docker CI | `.github/workflows/docker-build.yml` | Release 镜像发布流程简化，推送到 `guygubaby/new-api` |
| Docker CI | `.github/workflows/docker-image-alpha.yml` | 已删除 alpha 独立发布流程 |
| Docker CI | `.github/workflows/docker-image-nightly.yml` | 已删除 nightly 独立发布流程 |
| Docker CI | `.github/workflows/electron-build.yml` | 已删除 Electron 构建流程 |
| Docker CI | `.github/workflows/pr-check.yml` | 已删除 PR 检查流程 |
| Docker CI | `.github/workflows/release.yml` | 已删除 release 自动发布流程 |
| Docker CI | `.github/workflows/sync-to-gitee.yml` | 已删除 Gitee 同步流程 |
| Docker Context | `.dockerignore` | 许可证文件例外规则已被上游包含，同步后只需确认仍存在 |
| GitHub Metadata | `.github/CODE_OF_CONDUCT.md` | 已删除废弃社区模板 |
| GitHub Metadata | `.github/FUNDING.yml` | 已删除 funding 配置 |
| GitHub Metadata | `.github/ISSUE_TEMPLATE/config.yml` | 已删除 issue template 配置 |
| GitHub Metadata | `.github/ISSUE_TEMPLATE/{bug_report,feature_request}*.md` | 已由上游恢复；包含受保护项目链接，不再删除 |
| GitHub Metadata | `.github/PULL_REQUEST_TEMPLATE.md` | 已由上游恢复；包含受保护项目链接，不再删除 |
| GitHub Metadata | `.github/SECURITY.md` | 已由上游恢复；包含受保护项目链接，不再删除 |
| Bug Fix | `relay/channel/claude/relay-claude.go` | Claude `required: null` 字段修复 |
| Bug Fix | `relay/channel/gemini/relay-gemini.go` | Gemini `required: null` 字段修复 |
| Test | `relay/channel/gemini/relay_gemini_usage_test.go` | 新增 Gemini required 字段测试 |
| Docs | `FORK_CHANGES.md` | 记录 fork 自定义改动 |

---

## Commit 历史

| Commit | 说明 |
|--------|------|
| `4f329bb2` | fix: normalize required null to empty array for Gemini/Claude, simplify Docker CI workflows |
| `b81a435b` | simplify: remove per-arch tags, only push multi-arch version and latest |
| `35e3f189` | docs: add fork changes documentation |
| `cdd94481` | fix: include third-party licenses in docker context（当前已被上游包含，通常无需重新应用） |
| `6d36a339` | chore: remove unused github workflows |
| `0407cfa3` | chore: remove deprecated issue templates and security policy files（重新应用时不删除包含受保护项目链接的文件） |

---

## 重新应用方式

### 推荐方式：按 commit 重新 cherry-pick

如果这些 commit 仍在当前 fork 仓库历史里，更新到新的上游代码后，按顺序重新应用：

```bash
git cherry-pick 4f329bb2
git cherry-pick b81a435b
git cherry-pick 6d36a339
git cherry-pick 0407cfa3
```

说明：
- `35e3f189` 只新增/更新本文档，通常不需要作为业务 patch 重新应用。
- `cdd94481` 的 `.dockerignore` 改动当前已被上游包含，只有在新上游缺少 `!THIRD-PARTY-LICENSES.md` 时才需要重新应用。
- 如果新上游已经包含类似改动，cherry-pick 可能为空或冲突，需要按本文档逐项确认。
- 如果使用“直接覆盖上游源码”的方式更新，建议先保留本文件，更新后再按下面的手工恢复清单操作。

### 手工恢复清单

如果不能 cherry-pick，按以下顺序手动恢复：

1. 恢复 Docker 发布 workflow：只保留 `.github/workflows/docker-build.yml`，推送 `guygubaby/new-api:<tag>` 和 `guygubaby/new-api:latest`
2. 删除不需要的 workflow：`docker-image-alpha.yml`、`docker-image-nightly.yml`、`electron-build.yml`、`pr-check.yml`、`release.yml`、`sync-to-gitee.yml`
3. 检查 `.dockerignore`：确保存在 `!THIRD-PARTY-LICENSES.md`
4. 删除不适用的 GitHub 元数据：`CODE_OF_CONDUCT.md`、`FUNDING.yml`、`ISSUE_TEMPLATE/config.yml`
5. 保留包含受保护项目链接的上游文件：issue 模板、`PULL_REQUEST_TEMPLATE.md`、`SECURITY.md`
6. 恢复 Claude `required: null` 到 `required: []` 的处理
7. 恢复 Gemini `normalizeRequiredArray` 递归处理和对应测试
8. 检查 `FORK_CHANGES.md` 是否仍存在并更新为最新实际改动

---

## 1. Docker 镜像发布流程

### 当前保留的 Workflow

只保留 `.github/workflows/docker-build.yml` 作为 Docker Hub 发布流程。

触发方式：
- 推送任意 tag：`push.tags: ['*']`
- 手动触发：`workflow_dispatch`，需要填写 `tag`

发布镜像：
- `guygubaby/new-api:<tag>`
- `guygubaby/new-api:latest`

平台：
- `linux/amd64`
- `linux/arm64`

### 改动内容

将 Docker Hub 镜像名从上游的 `calciumion/new-api` 改为自己的 `guygubaby/new-api`。

```yaml
tags: |
  guygubaby/new-api:${{ env.TAG }}
  guygubaby/new-api:latest
```

### 流程简化

移除的内容：
- 分平台单独构建 job
- 手动创建 multi-arch manifest job
- 分平台标签：`-amd64`、`-arm64`
- GHCR 发布权限
- cosign 镜像签名
- SBOM 生成
- provenance 来源证明
- Docker metadata labels
- Job summary 输出

当前结构：
- 单个 `build` job
- Docker Buildx 直接构建并推送 multi-arch 镜像
- 只依赖 Docker Hub 登录凭据：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`

### 已删除的 Workflow

以下 workflow 已由本 fork 删除：
- `.github/workflows/docker-image-alpha.yml`
- `.github/workflows/docker-image-nightly.yml`
- `.github/workflows/electron-build.yml`
- `.github/workflows/pr-check.yml`
- `.github/workflows/release.yml`
- `.github/workflows/sync-to-gitee.yml`

维护注意：
- `docker-image-alpha.yml` 已不存在，不再有独立 alpha 自动发布流程。
- `.github/workflows/docker-build.yml` 当前不再排除 `nightly*` tag。

---

## 2. Docker Context 许可证文件

### 当前状态

上游当前已经包含 `!THIRD-PARTY-LICENSES.md` 例外规则。这个改动不再需要作为 fork patch 主动重新应用。

同步上游后仍需要确认该规则没有丢失。

### 原始问题

`.dockerignore` 默认忽略 `*.md`，如果没有例外规则，会导致 `THIRD-PARTY-LICENSES.md` 无法进入 Docker build context。

### 需要保留的规则

`.dockerignore` 中需要存在：

```dockerignore
*.md
!THIRD-PARTY-LICENSES.md
```

这样 Docker 构建时可以包含第三方许可证文件。

---

## 3. GitHub 模板与元数据清理

### 改动内容

删除 fork 中不再维护或不适用的 GitHub 社区/流程文件：

- `.github/CODE_OF_CONDUCT.md`
- `.github/FUNDING.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

以下文件曾在旧 fork 改动中删除，但上游恢复后包含 `QuantumNous/new-api` 等受保护项目链接，后续不再重新删除：

- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/bug_report_en.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/feature_request_en.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/SECURITY.md`

### 目的

减少 fork 维护负担，同时避免删除受保护的项目链接、归属信息和安全披露入口。

---

## 4. Gemini/Claude Required 字段修复

### 问题背景

部分上游 API 不接受 JSON Schema 中的 `required: null`。

本 fork 将 `required: null` 规范化为 `required: []`，避免请求被拒绝。

### Claude 适配

文件：`relay/channel/claude/relay-claude.go`

位置：`RequestOpenAI2ClaudeMessage`

```go
if params["required"] == nil {
    claudeTool.InputSchema["required"] = []any{}
} else {
    claudeTool.InputSchema["required"] = params["required"]
}
```

### Gemini 适配

文件：`relay/channel/gemini/relay-gemini.go`

新增 `normalizeRequiredArray`，递归处理 schema 中的 `required` 字段：

```go
func normalizeRequiredArray(schema map[string]interface{}) {
    if schema == nil {
        return
    }

    if required, exists := schema["required"]; exists && required == nil {
        schema["required"] = []interface{}{}
    }

    for _, value := range schema {
        switch v := value.(type) {
        case map[string]interface{}:
            normalizeRequiredArray(v)
        case []interface{}:
            for _, item := range v {
                if itemMap, ok := item.(map[string]interface{}); ok {
                    normalizeRequiredArray(itemMap)
                }
            }
        }
    }
}
```

调用位置：
- `cleanFunctionParametersWithDepth`
- `cleanFunctionParametersShallow`

调用顺序：在 `normalizeGeminiSchemaTypeAndNullable(cleanedMap)` 之后执行 `normalizeRequiredArray(cleanedMap)`。

### 测试覆盖

文件：`relay/channel/gemini/relay_gemini_usage_test.go`

新增测试：`TestNormalizeRequiredArray`

覆盖场景：
- nil schema
- 顶层 `required: null`
- 顶层 `required` 已是数组
- 无 `required` 字段
- nested schema 中的 `required: null`

---

## 同步上游更新

当上游有新更新时，建议使用：

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

如果本地没有 upstream remote：

```bash
git remote add upstream https://github.com/QuantumNous/new-api.git
```

同步后需要重点检查：

1. `.github/workflows/docker-build.yml` 是否仍只推送 `guygubaby/new-api`
2. 被删除的 workflow 是否被上游重新带回
3. `.dockerignore` 是否仍保留 `!THIRD-PARTY-LICENSES.md`
4. Gemini/Claude 参数清理逻辑是否仍会执行 `required: null` 规范化
5. `CODE_OF_CONDUCT.md`、`FUNDING.yml`、`ISSUE_TEMPLATE/config.yml` 是否被上游重新带回
6. issue 模板、PR 模板和 `SECURITY.md` 中的受保护项目链接是否仍保留
