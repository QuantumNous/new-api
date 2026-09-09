# 官方主线定制能力缺口修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在集成分支 `codex/official-mainline-custom-integration` 上补齐 2026-09-09 审计发现的全部未完整迁移项，使 Agent/CXM/排行榜/真实地址四项定制能力与 `custom` 分支语义一致，并在此基础上吸收 `upstream/main` 最新 9 个提交后通过全部门禁。

**Architecture:** 保持"官方主线骨架 + 定制能力分层回迁"不变。修复按风险排序分五个阶段：先堵真实地址泄露与出站错误（P0），再恢复 Agent/套餐/订阅的业务不变量并迁回原回归测试（P0/P1），然后以 `web/default/src` 原实现为基准整体迁移前端（P1），最后补基础设施与文档，合并上游并重跑门禁。每个任务独立可测、独立提交；凡是原 `custom` 分支已有的测试一律迁回作为验收标准，不再另写。

**Tech Stack:** Go 1.22+ / Gin / GORM v2（SQLite、MySQL、PostgreSQL 三库）；React 19 / TypeScript / TanStack Router & Query / Vitest / Bun；`github.com/stretchr/testify`。

**Spec:** `docs/superpowers/specs/2026-09-09-official-mainline-custom-integration-design.md`（本计划是该设计"必须保留"与"冲突处理规则"章节的补全执行方案）。

**审计依据：** 2026-09-09 对 `custom`（`12f241347`，共同基线 `8739c05c`）与集成分支（`7f7b70fa9`）的逐文件对照。原始参考实现全部以 `git show custom:<path>` 从主 worktree 取得。

## Global Constraints

- 工作目录：`/Users/luodashuaige/Documents/new-api/.worktrees/official-mainline-custom-integration`；主 worktree 的 `custom` 分支只读，用作 `git show custom:<path>` 的参考源。
- 所有 JSON 编解码走 `common.Marshal/Unmarshal/UnmarshalJsonStr/DecodeJson`，不直接调用 `encoding/json`。
- 所有数据库代码必须同时兼容 SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6；保留字列用 `commonGroupCol`/`commonKeyCol`；不用 `gorm:"default:true"`。
- 新增或重写的 Go 测试用 `require`（致命）+ `assert`（非致命）；只保护真实契约，不写覆盖率测试。
- 前端用户可见文案一律 `t('English key')`，键值补齐 `en/zh/fr/ja/ru/vi/zh-TW` 七个 locale。
- 定制代码只通过官方现有 model/service/controller/router 与前端 feature 边界接入；不复制官方旧文件形成第二套实现。
- 官方安全、计费、数据库兼容、协议修复默认保留官方实现；定制业务语义默认保留但改接官方新接口（spec 冲突处理规则 1、2）。
- 不修改任何 nеw-аρi / QuаntumΝоuѕ 品牌标识。
- 每个任务结束前：Go 侧 `gofmt -l` 为空且相关包 `go test` 通过；前端侧 `bun run typecheck` 0 错误、`bunx oxlint -c .oxlintrc.json <changed files>` 0 error。
- 提交信息用 Conventional Commits，一任务一提交。

---

## 阶段 0：基线冻结

### Task 0: 记录修复前基线

**Files:**
- Create: `docs/superpowers/evidence/2026-09-09-gap-remediation-baseline.md`

- [ ] **Step 1: 确认 worktree 与提交**

Run:
```bash
cd /Users/luodashuaige/Documents/new-api/.worktrees/official-mainline-custom-integration
git status --short && git rev-parse --short HEAD && git rev-parse --short upstream/main
```
Expected: 工作区干净；HEAD 为 `7f7b70fa9`；`upstream/main` 为 `bdef11750`。

- [ ] **Step 2: 跑一遍现状测试并留存失败集**

Run:
```bash
go build ./... && go test ./controller/... ./service/... ./model/... ./router/... ./setting/... ./tools/... ./dto/... ./tests/... -count=1 2>&1 | rg '^(ok|FAIL|--- FAIL)' > /tmp/baseline-go.txt
cd web && bunx vitest run 2>&1 | tail -20 > /tmp/baseline-web.txt; cd ..
```
Expected: Go 侧仅 `service` 包 2 个失败（`TestRedeemCodeQuotaZeroResultIncludesQuotaField`、`TestRedeemCodeSubscriptionUsesSoldSnapshotAfterPlanChanges`）；前端 8 个文件因 `node:test` 无法加载。

- [ ] **Step 3: 写入基线文档**

将两份输出与上一步的 commit 号写入 `docs/superpowers/evidence/2026-09-09-gap-remediation-baseline.md`，格式：

```markdown
# 缺口修复前基线（2026-09-09）

- 集成分支 HEAD: 7f7b70fa9
- upstream/main: bdef11750（9 个提交未吸收）
- 参考源: custom @ 12f241347

## go test 现状
<粘贴 /tmp/baseline-go.txt>

## vitest 现状
<粘贴 /tmp/baseline-web.txt>
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/evidence/2026-09-09-gap-remediation-baseline.md
git commit -m "docs: record gap remediation baseline"
```

---

## 阶段 1：真实地址脱敏与出站修复（P0）

### Task 1: 打通展示地址的上下文与 RelayInfo

**Files:**
- Modify: `constant/context_key.go:29`
- Modify: `relay/common/relay_info.go:59-70`（`ChannelMeta` 结构体）、`:218-232`（`channelMeta` 字面量）
- Modify: `middleware/distributor.go:683`
- Modify: `relay/relay_task.go:105-108`
- Create: `controller/relay_error_sanitize.go`
- Test: `controller/relay_error_sanitize_test.go`

**Interfaces:**
- Produces: `constant.ContextKeyChannelDisplayBaseUrl`；`relaycommon.ChannelMeta.ChannelDisplayBaseUrl string`；`controller.redactUpstreamURLForClient(info *relaycommon.RelayInfo, msg string) string`。Task 2 依赖这三者。

- [ ] **Step 1: 写失败测试**

`controller/relay_error_sanitize_test.go`:
```go
package controller

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestRedactUpstreamURLForClientReplacesActualWithDisplay(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl:        "https://real.internal.example",
		ChannelDisplayBaseUrl: "https://api.public.example",
	}}
	got := redactUpstreamURLForClient(info, `Post "https://real.internal.example/v1/chat": dial tcp: timeout`)
	assert.Equal(t, `Post "https://api.public.example/v1/chat": dial tcp: timeout`, got)
}

func TestRedactUpstreamURLForClientNoopWithoutChannelMeta(t *testing.T) {
	assert.Equal(t, "boom", redactUpstreamURLForClient(nil, "boom"))
	assert.Equal(t, "boom", redactUpstreamURLForClient(&relaycommon.RelayInfo{}, "boom"))
}

func TestRedactUpstreamURLForClientNoopWhenNoActualURL(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl:        "https://api.public.example",
		ChannelDisplayBaseUrl: "https://api.public.example",
	}}
	assert.Equal(t, "x https://api.public.example y", redactUpstreamURLForClient(info, "x https://api.public.example y"))
}
```

- [ ] **Step 2: 运行确认编译失败**

Run: `go test ./controller/ -run 'TestRedactUpstreamURLForClient' -count=1`
Expected: FAIL，`undefined: redactUpstreamURLForClient` 与 `unknown field ChannelDisplayBaseUrl`。

- [ ] **Step 3: 加 context key**

`constant/context_key.go` 在第 29 行 `ContextKeyChannelBaseUrl` 之后加：
```go
	ContextKeyChannelDisplayBaseUrl    ContextKey = "display_base_url"
```

- [ ] **Step 4: 给 ChannelMeta 加字段并从 context 读取**

`relay/common/relay_info.go` 在 `ChannelBaseUrl string` 之后加：
```go
	ChannelDisplayBaseUrl string
```
在 `channelMeta := &ChannelMeta{` 字面量中 `ChannelBaseUrl:` 之后加：
```go
		ChannelDisplayBaseUrl: common.GetContextKeyString(c, constant.ContextKeyChannelDisplayBaseUrl),
```
运行 `gofmt -w relay/common/relay_info.go` 对齐。

- [ ] **Step 5: 分发器与任务路径写入展示地址**

`middleware/distributor.go:683` 之后加：
```go
	common.SetContextKey(c, constant.ContextKeyChannelDisplayBaseUrl, channel.GetDisplayBaseURL())
```
`relay/relay_task.go:105` 之后加：
```go
		common.SetContextKey(c, constant.ContextKeyChannelDisplayBaseUrl, ch.GetDisplayBaseURL())
```
`relay/relay_task.go:108` `info.ChannelBaseUrl = ch.GetRuntimeBaseURL()` 之后加：
```go
		info.ChannelDisplayBaseUrl = ch.GetDisplayBaseURL()
```

- [ ] **Step 6: 新建脱敏函数**

`controller/relay_error_sanitize.go`:
```go
package controller

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
)

// redactUpstreamURLForClient replaces the channel's real upstream address with
// its display address before an error message leaves the server. Server logs
// keep the raw message so super admins can still troubleshoot.
func redactUpstreamURLForClient(info *relaycommon.RelayInfo, msg string) string {
	if info == nil || info.ChannelMeta == nil {
		return msg
	}
	return service.SanitizeWithPair(info.ChannelBaseUrl, info.ChannelDisplayBaseUrl, msg)
}
```

- [ ] **Step 7: 运行测试通过**

Run: `go build ./... && go test ./controller/ -run 'TestRedactUpstreamURLForClient' -count=1`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add constant/context_key.go relay/common/relay_info.go middleware/distributor.go relay/relay_task.go controller/relay_error_sanitize.go controller/relay_error_sanitize_test.go
git commit -m "feat(relay): carry channel display url through relay info"
```

### Task 2: 中继与任务错误响应脱敏

**Files:**
- Modify: `controller/relay.go:73-110`（`Relay` 的 defer 块）、`:532-545`（`RelayTaskFetch`）、`:553-582`（`RelayTask`）

**Interfaces:**
- Consumes: `redactUpstreamURLForClient`（Task 1）。

- [ ] **Step 1: `Relay()` 让 relayInfo 在 defer 中可见**

在 `Relay` 的 `var (` 块中加 `relayInfo *relaycommon.RelayInfo`；把后面的 `relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, request, ws)` 改为 `relayInfo, err = relaycommon.GenRelayInfo(c, relayFormat, request, ws)`（如该处用了 `:=` 声明了 `err`，改为在 `var` 块同时声明 `err error`）。

- [ ] **Step 2: defer 块里先脱敏再附 request id**

将
```go
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
```
改为
```go
			// Sanitize upstream URL before exposing to client. The server log
			// above keeps the raw URL for super-admin troubleshooting.
			newAPIError.SetMessage(common.MessageWithRequestId(
				redactUpstreamURLForClient(relayInfo, newAPIError.Error()), requestId))
```

- [ ] **Step 3: 任务路径四处错误返回前脱敏**

`RelayTaskFetch` 中：
```go
	if taskErr := relay.RelayTaskFetch(c, relayInfo.RelayMode); taskErr != nil {
		taskErr.Message = redactUpstreamURLForClient(relayInfo, taskErr.Message)
		respondTaskError(c, taskErr)
	}
```
`RelayTask` 中 `ResolveOriginTask`、`ApplyOriginTaskAffinity`、`executeTaskSubmission` 三处 `if taskErr != nil {` 块内，在 `respondTaskSubmissionError(c, taskErr)` 之前各加一行：
```go
		taskErr.Message = redactUpstreamURLForClient(relayInfo, taskErr.Message)
```

- [ ] **Step 4: 编译与既有测试**

Run: `go build ./... && go test ./controller/... -count=1`
Expected: PASS。

- [ ] **Step 5: 手工验收（可选，有 Docker 环境时）**

创建一个 `base_url=https://display.example`、`actual_base_url=http://127.0.0.1:1`（必然拒绝连接）的渠道，用普通用户令牌请求 `/v1/chat/completions`，确认错误 JSON 中出现的是 `display.example` 而不是 `127.0.0.1:1`。

- [ ] **Step 6: Commit**

```bash
git add controller/relay.go
git commit -m "fix(relay): redact channel actual url in relay and task errors"
```

### Task 3: 渠道测试使用运行时地址并脱敏错误

**Files:**
- Modify: `controller/channel-test.go:167`、`TestChannel` 内两处错误返回
- Test: `tests/controller/channel_test_runtime_url_test.go`

- [ ] **Step 1: 写失败测试**

`tests/controller/channel_test_runtime_url_test.go`（复用 `channel_perm_test.go` 的 `setupChannelPermDB` 模式，同包 `controller_test`；若该 setup 未导出则在本文件内复制其 SQLite 内存库初始化）：
```go
package controller_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The channel test must hit the real upstream (actual_base_url), never the
// display address.
func TestChannelTestUsesRuntimeBaseURL(t *testing.T) {
	setupChannelPermDB(t)

	displayHits := 0
	display := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		displayHits++
		w.WriteHeader(http.StatusTeapot)
	}))
	defer display.Close()
	actual := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"x","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	defer actual.Close()

	displayURL, actualURL := display.URL, actual.URL
	channel := &model.Channel{Type: 1, Key: "sk-test", BaseURL: &displayURL, ActualBaseURL: &actualURL, Models: "gpt-4o-mini", Status: 1}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "root", Role: 100, Group: "default", Status: 1}).Error)

	result := controller.TestChannelForTest(context.Background(), channel, 1, "gpt-4o-mini")
	assert.NoError(t, result.LocalErr())
	assert.Nil(t, result.NewAPIError())
	assert.Equal(t, 0, displayHits, "display base url must not receive channel test traffic")
}
```
（import 需增加 `context` 与 `github.com/QuantumNous/new-api/controller`。）`testChannel` 与 `testResult` 的字段 `localErr`/`newAPIError` 均未导出，因此在 `controller/export_test.go`（`package controller`，仅测试构建可见）中新增导出桥：
```go
package controller

import (
	"context"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

type TestChannelResult struct{ inner testResult }

func (r TestChannelResult) LocalErr() error                 { return r.inner.localErr }
func (r TestChannelResult) NewAPIError() *types.NewAPIError { return r.inner.newAPIError }

func TestChannelForTest(ctx context.Context, channel *model.Channel, userID int, modelName string) TestChannelResult {
	return TestChannelResult{inner: testChannel(ctx, channel, userID, modelName, "", false)}
}
```
（`testChannel` 的真实签名为 `(ctx context.Context, channel *model.Channel, testUserID int, testModel string, endpointType string, isStream bool) testResult`。）

- [ ] **Step 2: 运行确认失败**

Run: `go test ./tests/controller/ -run TestChannelTestUsesRuntimeBaseURL -count=1 -v`
Expected: FAIL，`displayHits` 为 1（当前测试打到了展示地址）。

- [ ] **Step 3: 改为运行时地址**

`controller/channel-test.go:167`：
```go
	c.Set("base_url", channel.GetRuntimeBaseURL())
```

- [ ] **Step 4: 两处错误返回脱敏**

`TestChannel` 中 `if result.localErr != nil {` 块改为：
```go
	if result.localErr != nil {
		errMsg := result.localErr.Error()
		if !isRoot(c) {
			errMsg = service.SanitizeWithPair(channel.GetActualBaseURL(), channel.GetDisplayBaseURL(), errMsg)
		}
		resp := gin.H{
			"success": false,
			"message": errMsg,
			"time":    0.0,
		}
```
`if result.newAPIError != nil {` 块改为：
```go
	if result.newAPIError != nil {
		errMsg := result.newAPIError.Error()
		if !isRoot(c) {
			errMsg = service.SanitizeWithPair(channel.GetActualBaseURL(), channel.GetDisplayBaseURL(), errMsg)
		}
		c.JSON(http.StatusOK, gin.H{
			"success":    false,
			"message":    errMsg,
			"time":       consumedTime,
			"error_code": result.newAPIError.GetErrorCode(),
		})
```
确认文件 import 了 `github.com/QuantumNous/new-api/service`。

- [ ] **Step 5: 运行测试通过**

Run: `go test ./tests/controller/ ./controller/ -count=1`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add controller/channel-test.go controller/export_test.go tests/controller/channel_test_runtime_url_test.go
git commit -m "fix(channel): test channels against runtime url and redact errors"
```

### Task 4: 管理端错误消息脱敏补全

**Files:**
- Modify: `controller/channel.go`（`FetchUpstreamModels` 约 `:247` 起的错误返回）
- Modify: `controller/channel_upstream_update.go`（原 `custom` 在 `:783` 处的错误返回；集成分支中定位 `fetchChannelUpstreamModelIDs`/上游更新失败时把 `err.Error()` 写入响应的位置）
- Modify: `controller/channel-billing.go`（余额更新失败把 `err.Error()` 返回给客户端的位置）
- Modify: `controller/ratio_sync.go:580-590`（`for r := range ch { if r.Err != "" {` 块）

- [ ] **Step 1: FetchUpstreamModels**

在把 `err.Error()` 放进响应前：
```go
		errMsg := err.Error()
		if !isRoot(c) && channel != nil {
			errMsg = service.SanitizeWithPair(channel.GetActualBaseURL(), channel.GetDisplayBaseURL(), errMsg)
		}
```
并把响应里的 `err.Error()` 替换为 `errMsg`。

- [ ] **Step 2: channel_upstream_update.go 与 channel-billing.go**

对每个把上游请求错误原文返回给客户端的位置套用同一模式（有 `channel` 变量时用 `SanitizeWithPair(channel.GetActualBaseURL(), channel.GetDisplayBaseURL(), msg)`；只有 `channelId` 时用 `service.SanitizeForChannel(channelId, msg)`）。用 `rg -n 'err\.Error\(\)' controller/channel_upstream_update.go controller/channel-billing.go` 逐条核对，凡是最终进入 `c.JSON`/`common.ApiError` 的都要处理；仅进 `common.SysLog`/`logger.Log*` 的不处理。

- [ ] **Step 3: ratio_sync.go**

```go
	for r := range ch {
		if r.Err != "" {
			msg := r.Err
			if r.ID > 0 && !isRoot(c) {
				msg = service.SanitizeForChannel(r.ID, msg)
			}
			testResults = append(testResults, dto.TestResult{
				Name:   r.Name,
				Status: "error",
				Error:  msg,
			})
```
（按集成分支该结构体的实际字段名填写；核心是 `Error: msg` 替换 `Error: r.Err`。若 `upstreamResult` 没有 `ID` 字段，参照 `custom` 的 `controller/ratio_sync.go:495-515` 补上 `ID int` 并在两处 `ch <- upstreamResult{...}` 里带上 `channel.Id`。）

- [ ] **Step 4: 编译与既有测试**

Run: `gofmt -l controller/ && go build ./... && go test ./controller/... ./tests/... -count=1`
Expected: `gofmt -l` 无输出；PASS。

- [ ] **Step 5: Commit**

```bash
git add controller/channel.go controller/channel_upstream_update.go controller/channel-billing.go controller/ratio_sync.go
git commit -m "fix(channel): redact actual upstream url in admin error responses"
```

### Task 5: 日志内容脱敏

**Files:**
- Modify: `controller/log.go`（`GetAllLogs`、`GetUserLogs`、`GetLogByKey`）
- Modify: `controller/agent_customer.go:53`（`GetAgentCustomerLogs`）
- Test: `controller/log_sanitize_test.go`

- [ ] **Step 1: 写失败测试**

`controller/log_sanitize_test.go`:
```go
package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupLogSanitizeDB(t *testing.T) *model.Channel {
	t.Helper()
	common.RedisEnabled = false
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Log{}))
	display, actual := "https://api.public.example", "https://real.internal.example"
	ch := &model.Channel{Type: 1, Key: "k", BaseURL: &display, ActualBaseURL: &actual, Status: 1}
	require.NoError(t, db.Create(ch).Error)
	return ch
}

func TestSanitizeLogsForRequesterRedactsForNonRoot(t *testing.T) {
	ch := setupLogSanitizeDB(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("role", common.RoleCommonUser)
	logs := []*model.Log{{ChannelId: ch.Id, Content: "upstream https://real.internal.example/v1 failed", Other: `{"url":"https://real.internal.example/x"}`}}
	sanitizeLogsForRequester(c, logs)
	assert.Equal(t, "upstream https://api.public.example/v1 failed", logs[0].Content)
	assert.Equal(t, `{"url":"https://api.public.example/x"}`, logs[0].Other)
}

func TestSanitizeLogsForRequesterKeepsRawForRoot(t *testing.T) {
	ch := setupLogSanitizeDB(t)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("role", common.RoleRootUser)
	logs := []*model.Log{{ChannelId: ch.Id, Content: "https://real.internal.example"}}
	sanitizeLogsForRequester(c, logs)
	assert.Equal(t, "https://real.internal.example", logs[0].Content)
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./controller/ -run TestSanitizeLogsForRequester -count=1`
Expected: FAIL，`undefined: sanitizeLogsForRequester`。

- [ ] **Step 3: 实现并接入**

`controller/log.go` 顶部（import 增加 `github.com/QuantumNous/new-api/service`）新增：
```go
// sanitizeLogsForRequester replaces the channel's actual upstream URL with
// its display URL inside log.Content and log.Other for every log in the
// slice. Skips work for super admin requesters.
func sanitizeLogsForRequester(c *gin.Context, logs []*model.Log) {
	if isRoot(c) {
		return
	}
	for i := range logs {
		if logs[i] == nil || logs[i].ChannelId <= 0 {
			continue
		}
		if logs[i].Content != "" {
			logs[i].Content = service.SanitizeForChannel(logs[i].ChannelId, logs[i].Content)
		}
		if logs[i].Other != "" {
			logs[i].Other = service.SanitizeForChannel(logs[i].ChannelId, logs[i].Other)
		}
	}
}
```
在 `GetAllLogs`、`GetUserLogs`、`GetLogByKey` 中，拿到 `logs` 切片、返回响应之前各加一行 `sanitizeLogsForRequester(c, logs)`。`controller/agent_customer.go` 的 `GetAgentCustomerLogs` 在 `FormatUserLogsForRequester` 之前同样加一行。若上游把返回类型改成了 `[]model.Log`（非指针），把函数签名改为 `logs []model.Log` 并去掉 `nil` 判断。

- [ ] **Step 4: 运行测试通过**

Run: `go test ./controller/ -count=1`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add controller/log.go controller/agent_customer.go controller/log_sanitize_test.go
git commit -m "fix(log): redact channel actual url in log content for non-root"
```

### Task 6: `LogGroupColumn` 使用日志库方言

**Files:**
- Modify: `model/log.go:152`
- Test: `model/log_group_column_test.go`

- [ ] **Step 1: 写失败测试**

```go
package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLogGroupColumnPrefersInitializedLogDialect(t *testing.T) {
	old := logGroupCol
	t.Cleanup(func() { logGroupCol = old })
	logGroupCol = `"group"`
	assert.Equal(t, `"group"`, LogGroupColumn())
	logGroupCol = ""
	assert.Contains(t, []string{"`group`", `"group"`}, LogGroupColumn())
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./model/ -run TestLogGroupColumn -count=1`
Expected: FAIL（当前返回 `commonGroupCol`，与 `logGroupCol` 无关）。若 `logGroupCol` 变量在集成分支不存在，先在 `model/main.go` 的 `initCol()` 中按 `commonGroupCol` 同样方式基于 `common.UsingLogDatabase(...)` 初始化一个 `logGroupCol`。

- [ ] **Step 3: 实现**

```go
// LogGroupColumn returns the dialect-safe quoted group column used by log
// queries. Callers may run before InitDB selected a database, so it also
// derives a safe fallback from the configured log dialect.
func LogGroupColumn() string {
	if logGroupCol != "" {
		return logGroupCol
	}
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		return `"group"`
	}
	return "`group`"
}
```

- [ ] **Step 4: 运行通过并提交**

Run: `go test ./model/ ./service/ -run 'TestLogGroupColumn|TestAgentCustomer' -count=1`
```bash
git add model/log.go model/main.go model/log_group_column_test.go
git commit -m "fix(model): resolve log group column from log database dialect"
```

### Task 7: 前端允许清空 `actual_base_url`

**Files:**
- Modify: `web/src/features/channels/lib/channel-form.ts:891-900`
- Test: `web/src/features/channels/lib/__tests__/channel-form-actual-base-url.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, test } from 'vitest'

import { transformFormDataToUpdatePayload } from '../channel-form'

describe('actual_base_url update payload', () => {
  test('sends empty string so the backend can clear the stored value', () => {
    const payload = transformFormDataToUpdatePayload(
      { actual_base_url: '' } as never,
      1
    )
    expect(payload.actual_base_url).toBe('')
  })
})
```
（按 `transformFormDataToUpdatePayload` 在集成分支的真实签名传参：先读 `channel-form.ts:840-900` 确认参数列表；只需构造能走到尾部清空块的最小表单对象。）

- [ ] **Step 2: 运行确认失败**

Run: `cd web && bunx vitest run src/features/channels/lib/__tests__/channel-form-actual-base-url.test.ts`
Expected: FAIL，`actual_base_url` 为 `null`/`undefined`。

- [ ] **Step 3: 实现**

在 `channel-form.ts:891-900` 那组 `payload.xxx = ... || ''` 之后加：
```ts
  payload.actual_base_url = normalizeBaseUrl(formData.actual_base_url) || ''
```
（`normalizeBaseUrl` 是该文件既有函数；若尾部块用的是别的规范化函数名，保持与 `base_url` 那行一致。）

- [ ] **Step 4: 运行通过并提交**

Run: `cd web && bunx vitest run src/features/channels && bun run typecheck`
```bash
git add web/src/features/channels/lib/channel-form.ts web/src/features/channels/lib/__tests__/channel-form-actual-base-url.test.ts
git commit -m "fix(web): allow super admin to clear channel actual_base_url"
```

---

## 阶段 2：Agent / 套餐码 / 订阅业务不变量（P0/P1）

### Task 8: `/api/status` 暴露 `agent_enabled` 并补审计文案

**Files:**
- Modify: `controller/misc.go`（`/api/status` data map，`checkin_enabled` 之后）
- Modify: `controller/audit.go:29-31`（`auditContentTemplates`）
- Create（迁回）: `controller/agent_admin_test.go`

- [ ] **Step 1: 迁回原测试**

```bash
git show custom:controller/agent_admin_test.go > controller/agent_admin_test.go
go vet ./controller/ 2>&1 | head
```
该文件含 `TestAgentStatusIncludesFeatureSwitch`（断言 `agent_enabled`）与 `TestAgentAuditActionsHaveStableContent`（断言 7 个 `agent.*` 模板）。按 `go vet` 报错修正与上游签名不一致处（例如 `GetStatus` 的注册方式），不改断言。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./controller/ -run 'TestAgentStatusIncludesFeatureSwitch|TestAgentAuditActionsHaveStableContent' -count=1`
Expected: FAIL。

- [ ] **Step 3: 实现**

`controller/misc.go` 的 status data map 中加：
```go
		"agent_enabled":               operation_setting.GetAgentSetting().Enabled,
```
`controller/audit.go` 的 `auditContentTemplates` 中 `"option.update"` 之后加：
```go
	"agent.enable":       "Enabled agent account for user ${agent_user_id}",
	"agent.disable":      "Disabled agent account for user ${agent_user_id}",
	"agent.limit_update": "Updated agent ${agent_user_id} daily code limit to ${daily_code_limit}",
	"agent.credit":       "Credited agent ${agent_user_id} by ${amount} points",
	"agent.debit":        "Debited agent ${agent_user_id} by ${amount} points",
	"agent.offer_update": "Updated agent offer for plan ${plan_id}: enabled=${enabled}, price=${unit_price}, validity=${code_valid_days} days, refund fee=${refund_fee_bps} bps",
	"agent.refund":       "Refunded agent ${agent_user_id} package codes; fee=${fee}, refunded=${refunded}, balance=${balance_after}",
```
运行 `gofmt -w controller/audit.go controller/misc.go`。

- [ ] **Step 4: 运行通过并提交**

Run: `go test ./controller/ -count=1`
```bash
git add controller/misc.go controller/audit.go controller/agent_admin_test.go
git commit -m "fix(agent): expose agent_enabled status and restore audit templates"
```

### Task 9: 启动时执行代理客户回填

**Files:**
- Modify: `model/main.go`（`migrateDB` 末尾 `return nil` 之前；import 增加 `context`）

- [ ] **Step 1: 实现**

`migrateDB()` 中最后一个 `return nil` 前加 `startAgentCustomerBackfill()`，并在文件内新增：
```go
func startAgentCustomerBackfill() {
	go func() {
		report, err := BackfillAgentCustomerBindings(context.Background(), 500)
		if err != nil {
			common.SysLog("failed to backfill agent customer bindings: " + err.Error())
			return
		}
		if report.Bound > 0 || report.Unresolved > 0 {
			common.SysLog(fmt.Sprintf(
				"agent customer binding backfill completed: bound=%d preserved=%d unresolved=%d",
				report.Bound, report.Preserved, report.Unresolved,
			))
		}
	}()
}
```

- [ ] **Step 2: 验证**

Run: `go build ./... && go test ./model/ -run 'TestBackfillAgentCustomerBindings' -count=1`
Expected: PASS；用 SQLite 空库启动一次二进制（`SQL_DSN` 留空），日志不出现 `failed to backfill`。

- [ ] **Step 3: Commit**

```bash
git add model/main.go
git commit -m "fix(agent): run customer binding backfill after migration"
```

### Task 10: 恢复兑换码类型隔离

**Files:**
- Modify: `model/redemption.go`（`GetAllRedemptions`、`SearchRedemptions`、`GetRedemptionById`、`RedeemWithAgent`、`Insert`、`SelectUpdate`、`Update`、`Delete`、`DeleteRedemptionById`、`DeleteInvalidRedemptions`、`BatchDeleteRedemptions`）
- Modify（迁回测试）: `model/redemption_test.go`

**Interfaces:**
- Produces: 上述函数只作用于 `type = common.RedemptionCodeTypeQuota` 的行；`Insert()` 对非 quota 类型返回错误。`service/agent_*` 与 `service/redemption.go` 的套餐码路径不受影响。

- [ ] **Step 1: 迁回两个原回归测试**

从 `git show custom:model/redemption_test.go` 中复制 `TestQuotaRedemptionAdminPathsExcludePackageCodes` 与 `TestQuotaRedemptionNoOpUpdatesRemainAllowed` 两个函数（含它们依赖的 fixture）追加到集成分支的 `model/redemption_test.go` 末尾。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./model/ -run 'TestQuotaRedemption' -count=1`
Expected: FAIL（套餐码出现在列表 / 可被删除）。

- [ ] **Step 3: 逐函数加过滤**

- `GetAllRedemptions`：`Count` 与 `Find` 都加 `.Where("type = ?", common.RedemptionCodeTypeQuota)`。
- `SearchRedemptions`：`query := tx.Model(&Redemption{}).Where("type = ?", common.RedemptionCodeTypeQuota)` 作为起点。
- `GetRedemptionById`：`DB.Where("id = ? AND type = ?", id, common.RedemptionCodeTypeQuota).First(&redemption)`。
- `RedeemWithAgent`：锁查询改为 `lockForUpdate(tx).Where(keyCol+" = ? AND type = ?", key, common.RedemptionCodeTypeQuota).First(redemption)`。
- `Insert`：函数开头加
  ```go
  	if redemption.Type != common.RedemptionCodeTypeQuota {
  		return errors.New("legacy redemption insert only supports quota codes")
  	}
  ```
  （保留上游已有的 `Quota <= 0` 校验。）
- `SelectUpdate` / `Update`：`Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota)`，并在 `RowsAffected == 0` 时用同样条件 `Select("id").First(&existing)` 区分"不存在"与"无变化"：
  ```go
  	if result.RowsAffected == 0 {
  		var existing Redemption
  		return DB.Select("id").Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).First(&existing).Error
  	}
  	return nil
  ```
- `Delete` / `DeleteRedemptionById`：`Where("id = ? AND type = ?", ..., common.RedemptionCodeTypeQuota)`。
- `DeleteInvalidRedemptions`：在原 `status IN ? OR (...)` 条件前加 `type = ? AND (` … `)`，参数首位传 `common.RedemptionCodeTypeQuota`。
- `BatchDeleteRedemptions`：删除语句加 `.Where("type = ?", common.RedemptionCodeTypeQuota)`。

- [ ] **Step 4: 运行通过**

Run: `go test ./model/ ./service/ ./controller/ -count=1 2>&1 | rg '^(ok|FAIL|--- FAIL)'`
Expected: `TestQuotaRedemption*` PASS；`service` 仍只剩 Task 11/12 的两个已知失败。

- [ ] **Step 5: Commit**

```bash
git add model/redemption.go model/redemption_test.go
git commit -m "fix(redemption): scope legacy quota code admin paths away from package codes"
```

### Task 11: 零额度兑换码不触发充值校验

**Files:**
- Modify: `model/redemption.go`（`RedeemWithAgent` 事务尾部）

- [ ] **Step 1: 确认失败**

Run: `go test ./service/ -run TestRedeemCodeQuotaZeroResultIncludesQuotaField -count=1`
Expected: FAIL，`invalid top-up quota`。

- [ ] **Step 2: 实现**

事务闭包最后的 `return creditTopUpQuota(tx, userId, redemption.Quota, nil)` 改为：
```go
		if redemption.Quota == 0 {
			// Zero-value legacy codes are still consumed, but there is
			// nothing to credit; upstream's wallet guard rejects <= 0.
			return nil
		}
		return creditTopUpQuota(tx, userId, redemption.Quota, nil)
```
事务之后的 `syncCreditUserQuotaCache(...)` 与 `RecordLog(...)` 同样包一层 `if redemption.Quota > 0 {}`。上游对正数额度的钱包上限保护保持不变。

- [ ] **Step 3: 运行通过并提交**

Run: `go test ./service/ ./model/ -run 'Redeem' -count=1`
```bash
git add model/redemption.go
git commit -m "fix(redemption): consume zero-quota legacy codes without crediting"
```

### Task 12: 恢复"售出即绑定"的代理归属语义

> 决策点：集成提交 `35aa1c546` 把绑定条件收紧为 `status = active`，与 `custom` 的原语义（客户绑定到售出该码的代理，无论其当前状态）冲突，也与 spec"不重写 Agent/CXM 产品语义"相悖。本任务恢复原语义；若产品方明确要求保留收紧，则改为修改 `service/redemption_test.go:193-228` 的期望并跳过本任务。

**Files:**
- Modify: `service/agent_bind.go:21`

- [ ] **Step 1: 确认失败**

Run: `go test ./service/ -run TestRedeemCodeSubscriptionUsesSoldSnapshotAfterPlanChanges -count=1`
Expected: FAIL，`expected: 8001 actual: 0`。

- [ ] **Step 2: 实现**

```go
	if err := model.DB.Select("user_id").Where("user_id = ?", agentID).First(&account).Error; err != nil {
```
（去掉 `AND status = ?` 与对应参数。）

- [ ] **Step 3: 全量 service 测试通过并提交**

Run: `go test ./service/ -count=1`
Expected: PASS（`TestRedeemCodeBindsUnboundCustomerAndKeepsFirstAgent` 仍通过，因为首绑不可覆盖）。
```bash
git add service/agent_bind.go
git commit -m "fix(agent): bind customers to the selling agent regardless of status"
```

### Task 13: 订阅用户级锁序与事务内时间戳

**Files:**
- Modify: `model/db_time.go`
- Modify: `model/subscription.go`（`CreateUserSubscriptionFromPlanTx`、`AdminInvalidateUserSubscription`、`AdminDeleteUserSubscription`、`ExpireDueSubscriptions`）
- Create（迁回）: `model/subscription_lock_order_test.go`、`model/subscription_entitlement_test.go`

**Interfaces:**
- Produces: `serializeSubscriptionUserTx(tx *gorm.DB, userId int) (*User, error)`；`getDBTimestamp(db *gorm.DB) int64`。

- [ ] **Step 1: 迁回测试**

```bash
git show custom:model/subscription_lock_order_test.go > model/subscription_lock_order_test.go
git show custom:model/subscription_entitlement_test.go > model/subscription_entitlement_test.go
go vet ./model/
```
按 `go vet` 修正与上游不一致的 fixture 调用；不改断言。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./model/ -run 'TestSubscription' -count=1 2>&1 | rg -- '--- FAIL'`
Expected: 至少 `TestSubscriptionEntitlementLocksExistingUserBeforePurchaseLimitRead`、`TestSubscriptionEntitlementRejectsMissingUserBeforeCreatingSubscription` 与锁序测试失败。

- [ ] **Step 3: `db_time.go` 加事务版**

```go
// GetDBTimestamp returns a UNIX timestamp from database time.
// Falls back to application time on error.
func GetDBTimestamp() int64 {
	return getDBTimestamp(DB)
}

func getDBTimestamp(db *gorm.DB) int64 {
	if db == nil {
		return common.GetTimestamp()
	}
	var ts int64
	var err error
	switch {
	case common.UsingMainDatabase(common.DatabaseTypePostgreSQL):
		err = db.Raw("SELECT EXTRACT(EPOCH FROM NOW())::bigint").Scan(&ts).Error
	case common.UsingMainDatabase(common.DatabaseTypeSQLite):
		err = db.Raw("SELECT strftime('%s','now')").Scan(&ts).Error
	default:
		err = db.Raw("SELECT UNIX_TIMESTAMP()").Scan(&ts).Error
	}
	if err != nil || ts <= 0 {
		return common.GetTimestamp()
	}
	return ts
}
```

- [ ] **Step 4: 加用户串行化函数**

`model/subscription.go` 新增：
```go
// serializeSubscriptionUserTx takes the user row lock before any
// user_subscriptions rows are touched so every writer orders locks as
// user -> subscription. The no-op UpdateColumn forces a row lock even on
// SQLite, and the FOR UPDATE read then returns the authoritative row.
func serializeSubscriptionUserTx(tx *gorm.DB, userId int) (*User, error) {
	if tx == nil || userId <= 0 {
		return nil, errors.New("invalid subscription user serialization args")
	}
	if err := tx.Model(&User{}).Where("id = ?", userId).
		UpdateColumn("id", gorm.Expr("id")).Error; err != nil {
		return nil, err
	}
	var user User
	if err := lockForUpdate(tx).First(&user, userId).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
```

- [ ] **Step 5: 创建路径接入**

`CreateUserSubscriptionFromPlanTx` 在 `if userId <= 0 {...}` 之后、购买上限检查之前加：
```go
	entitlementUser, err := serializeSubscriptionUserTx(tx, userId)
	if err != nil {
		return nil, err
	}
```
购买上限检查改为锁定读取：
```go
	if plan.MaxPurchasePerUser > 0 {
		var existingSubscriptions []UserSubscription
		if err := lockForUpdate(tx).Model(&UserSubscription{}).
			Select("id").
			Where("user_id = ? AND plan_id = ?", userId, plan.Id).
			Limit(plan.MaxPurchasePerUser).
			Find(&existingSubscriptions).Error; err != nil {
			return nil, err
		}
		if len(existingSubscriptions) >= plan.MaxPurchasePerUser {
			return nil, errors.New("已达到该套餐购买上限")
		}
	}
```
`nowUnix := GetDBTimestamp()` 改为 `nowUnix := getDBTimestamp(tx)`。用户分组读取改为直接用锁定行：把 `currentGroup, err := getUserGroupByIdTx(tx, userId)` 一段替换为 `currentGroup := entitlementUser.Group`（去掉对应 `err` 处理）。

- [ ] **Step 6: 管理员失效/删除与到期扫描接入**

`AdminInvalidateUserSubscription` 与 `AdminDeleteUserSubscription` 的事务体开头改为"先查归属、再锁用户、再锁订阅、再校验归属未变"：
```go
		var owner struct{ UserId int }
		if err := tx.Model(&UserSubscription{}).Select("user_id").Where("id = ?", subscriptionId).Take(&owner).Error; err != nil {
			return err
		}
		if _, err := serializeSubscriptionUserTx(tx, owner.UserId); err != nil {
			return err
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).First(&sub, subscriptionId).Error; err != nil {
			return err
		}
		if sub.UserId != owner.UserId {
			return errors.New("subscription owner changed concurrently")
		}
```
（把原来直接 `lockForUpdate(tx).First(&sub, ...)` 的那几行替换为以上块，其余逻辑不动。）

`ExpireDueSubscriptions` 中对 `map[int]...` 的迭代改为先收集 key 并 `sort.Ints(userIds)`，然后按序对每个用户在事务内先 `serializeSubscriptionUserTx(tx, userId)` 再处理其订阅；import 增加 `sort`。

- [ ] **Step 7: 运行通过**

Run: `gofmt -l model/ && go test ./model/ ./service/ -count=1`
Expected: 全部 PASS（含 `service/agent_purchase_test.go`、`agent_refund_test.go`、`redemption_test.go`）。

- [ ] **Step 8: Commit**

```bash
git add model/db_time.go model/subscription.go model/subscription_lock_order_test.go model/subscription_entitlement_test.go
git commit -m "fix(subscription): restore user-first lock ordering and tx timestamps"
```

### Task 14: 订阅时长溢出保护与分组 UTF-8 校验

**Files:**
- Modify: `model/subscription.go`（`ValidateSubscriptionEntitlementSnapshot`、`calcPlanEndTime`、`SubscriptionPlan` 校验入口）

- [ ] **Step 1: 确认 Task 13 迁回的 entitlement 测试中溢出用例仍失败**

Run: `go test ./model/ -run 'TestValidateSubscriptionEntitlementSnapshot' -count=1 -v 2>&1 | rg -- '--- FAIL'`
Expected: "overflowing day duration"（`DurationValue = math.MaxInt`）用例失败。

- [ ] **Step 2: 加校验函数**

```go
func validateSubscriptionDuration(unit string, value int, customSeconds int64) error {
	switch unit {
	case SubscriptionDurationYear:
		if value <= 0 || int64(value) > maxSubscriptionEntitlementSpanSeconds/(366*24*60*60) {
			return errors.New("invalid subscription duration years")
		}
	case SubscriptionDurationMonth:
		if value <= 0 || int64(value) > maxSubscriptionEntitlementSpanSeconds/(31*24*60*60) {
			return errors.New("invalid subscription duration months")
		}
	case SubscriptionDurationDay:
		if value <= 0 || int64(value) > maxSubscriptionEntitlementSpanSeconds/(24*60*60) {
			return errors.New("invalid subscription duration days")
		}
	case SubscriptionDurationHour:
		if value <= 0 || int64(value) > maxSubscriptionEntitlementSpanSeconds/(60*60) {
			return errors.New("invalid subscription duration hours")
		}
	case SubscriptionDurationCustom:
		if customSeconds <= 0 || customSeconds > maxSubscriptionEntitlementSpanSeconds {
			return errors.New("invalid custom subscription duration")
		}
	default:
		return errors.New("invalid subscription duration unit")
	}
	return nil
}
```

- [ ] **Step 3: 接入三处**

- `ValidateSubscriptionEntitlementSnapshot`：把现有对 `year/month/day/hour/custom` 的分散 `<= 0` 判断替换为一次 `validateSubscriptionDuration(snapshot.DurationUnit, snapshot.DurationValue, snapshot.CustomSeconds)`；并在标题 UTF-8 校验旁加
  ```go
  	if !utf8.ValidString(snapshot.UpgradeGroup) || !utf8.ValidString(snapshot.DowngradeGroup) {
  		return errors.New("invalid subscription group encoding")
  	}
  ```
- `calcPlanEndTime`：函数开头调用 `validateSubscriptionDuration(plan.DurationUnit, plan.DurationValue, plan.CustomSeconds)` 并返回其错误，替代原 `<= 0` 判断。
- 套餐创建/更新入口（`custom` 在 `model/subscription.go:474` 的位置，集成分支为 `SubscriptionPlan` 的 `Insert`/`Update` 或其校验函数）加同样调用。

- [ ] **Step 4: 运行通过并提交**

Run: `go test ./model/ ./service/ ./controller/ -count=1`
```bash
git add model/subscription.go
git commit -m "fix(subscription): bound duration values and validate group encoding"
```

### Task 15: 恢复 `POST /api/user/redeem` 类型化兑换接口

**Files:**
- Modify: `controller/user.go`（新增 `Redeem`；`TopUp` 失败日志去掉兑换码原文）
- Modify: `router/api-router.go:122`
- Create（迁回）: `controller/user_redemption_test.go`、`router/user_redemption_route_test.go`

**Interfaces:**
- Produces: `POST /api/user/redeem`，请求体 `{"key": string}`，成功返回 `{"success":true,"data": service.RedemptionResult}`（`type` 为 `quota` 或 `subscription`）。Task 24 的钱包前端依赖此契约。`POST /api/user/topup` 保持集成分支现状（额度码返回数字），供旧客户端兼容。

- [ ] **Step 1: 迁回测试**

```bash
git show custom:controller/user_redemption_test.go > controller/user_redemption_test.go
git show custom:router/user_redemption_route_test.go > router/user_redemption_route_test.go
go vet ./controller/ ./router/
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./controller/ ./router/ -run 'Redeem' -count=1`
Expected: FAIL，`undefined: controller.Redeem` / 404。

- [ ] **Step 3: 实现**

`controller/user.go` 在 `TopUp` 之后新增：
```go
// Redeem redeems a quota or agent package code and returns the typed result.
func Redeem(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
		return
	}

	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		common.ApiErrorI18n(c, i18n.MsgUserTopUpProcessing)
		return
	}
	defer lock.Unlock()
	var req topUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	result, err := service.RedeemCode(id, req.Key)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
		logger.LogError(c, fmt.Sprintf("failed to redeem code for user %d: %s", id, err.Error()))
		return
	}
	common.ApiSuccess(c, result)
}
```
`TopUp` 中失败日志改为不含 `req.Key`：
```go
		logger.LogError(c, fmt.Sprintf("failed to redeem quota code for user %d: %s", id, err.Error()))
```
`router/api-router.go:122` 之后加：
```go
				selfRoute.POST("/redeem", middleware.CriticalRateLimit(), controller.Redeem)
```

- [ ] **Step 4: 运行通过并提交**

Run: `gofmt -l controller router && go test ./controller/ ./router/ -count=1`
```bash
git add controller/user.go router/api-router.go controller/user_redemption_test.go router/user_redemption_route_test.go
git commit -m "feat(user): restore typed redeem endpoint and stop logging code keys"
```

### Task 16: 迁回其余 Agent 后端回归测试

**Files:**
- Create（迁回）: `router/agent_routes_test.go`、`router/agent_admin_routes_test.go`、`router/agent_customer_routes_test.go`、`router/agent_query_routes_test.go`、`router/agent_refund_routes_test.go`、`controller/agent_customer_binding_test.go`、`setting/operation_setting/agent_setting_test.go`

- [ ] **Step 1: 迁回**

```bash
for f in router/agent_routes_test.go router/agent_admin_routes_test.go router/agent_customer_routes_test.go router/agent_query_routes_test.go router/agent_refund_routes_test.go controller/agent_customer_binding_test.go setting/operation_setting/agent_setting_test.go; do git show custom:$f > $f; done
go vet ./router/ ./controller/ ./setting/operation_setting/
```

- [ ] **Step 2: 修编译，不改断言**

常见差异：上游中间件构造函数签名、`SetApiRouter` 的参数、`common.RoleXxx` 常量名。逐条按 `go vet` 输出修正。若某测试断言的行为确与上游安全修复冲突（例如上游把某路由改为更严格的中间件），保留上游行为并把该测试的期望改为上游行为，并在提交信息中写明。

- [ ] **Step 3: 运行通过并提交**

Run: `go test ./router/ ./controller/ ./setting/... -count=1`
```bash
git add router/*_test.go controller/agent_customer_binding_test.go setting/operation_setting/agent_setting_test.go
git commit -m "test: restore agent route, binding, and setting regression tests"
```

### Task 17: 后端阶段门禁

- [ ] **Step 1: 全量后端检查**

Run:
```bash
gofmt -l . | rg -v '^web/' ; go vet ./... && go test ./... -count=1 2>&1 | rg '^(FAIL|--- FAIL|panic)' || echo "ALL GREEN"
```
Expected: `gofmt -l` 无输出；打印 `ALL GREEN`。

- [ ] **Step 2: 格式化 `router/api-router.go` 与压行的测试文件**

Run: `gofmt -w router/api-router.go service/agent_query_test.go service/agent_refund_test.go && go test ./router/ ./service/ -count=1`
把 `router/api-router.go:61-67` 每条路由拆成独立行（`gofmt` 不会自动拆分分号语句，需手工按上游其他路由组的写法整理）。

- [ ] **Step 3: Commit**

```bash
git add router/api-router.go service/agent_query_test.go service/agent_refund_test.go
git commit -m "style: format agent routes and tests"
```

---

## 阶段 3：前端整体迁移（P1）

> 原则：以 `git show custom:web/default/src/<path>` 为基准迁入 `web/src/<path>`，只做三类适配：(1) `/agent` 路由改 `/agents`；(2) `node:test` 改 vitest；(3) 上游 hook/组件签名变化。禁止在集成分支现有的简化版上打补丁。

### Task 18: 让 Agent 前端测试在 vitest 下运行

**Files:**
- Modify: `web/src/features/agents/api.test.ts`、`types.test.ts`、`hooks/use-agent-access.test.ts`、`lib/money.test.ts`、`lib/mutation-sync.test.ts`、`lib/workspace.test.ts`、`web/src/features/agent-admin/api.test.ts`、`lib/admin.test.ts`

- [ ] **Step 1: 确认失败**

Run: `cd web && bunx vitest run src/features/agents src/features/agent-admin`
Expected: 8 files failed to load，`Cannot bundle Node.js built-in "node:test"`。

- [ ] **Step 2: 机械替换**

每个文件：
```ts
// 删除
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
// 改为
import { describe, expect, test } from 'vitest'
```
断言映射：`assert.equal(a, b)` → `expect(a).toBe(b)`；`assert.strictEqual` → `toBe`；`assert.deepEqual`/`deepStrictEqual` → `expect(a).toEqual(b)`；`assert.ok(x)` → `expect(x).toBeTruthy()`；`assert.throws(fn)` → `expect(fn).toThrow()`；`await assert.rejects(p)` → `await expect(p).rejects.toThrow()`；`assert.match(s, re)` → `expect(s).toMatch(re)`。

- [ ] **Step 3: 运行通过**

Run: `cd web && bunx vitest run src/features/agents src/features/agent-admin`
Expected: 8 files, 49 tests passed（与 `bun test` 基线一致）。

- [ ] **Step 4: Commit**

```bash
git add web/src/features/agents web/src/features/agent-admin
git commit -m "test(web): run agent suites under vitest"
```

### Task 19: 状态 hook、选项刷新与代理管理页联动

**Files:**
- Modify: `web/src/hooks/use-status.ts:77-83`
- Modify: `web/src/features/auth/types.ts:128-138`、`:171-185`（两个 `SystemStatus` 块）
- Modify: `web/src/features/system-settings/hooks/use-update-option.ts:27-40`、`:52`
- Modify: `web/src/features/agent-admin/index.tsx:58-66`、`:87-96`、`:140`、`:155`
- Modify: `web/src/features/agents/hooks/use-agent-access.ts:80-87`、`:102`
- Create（迁回）: `web/src/features/system-settings/hooks/use-update-option.test.ts`

- [ ] **Step 1: 迁回测试并确认失败**

```bash
git show custom:web/default/src/features/system-settings/hooks/use-update-option.test.ts > web/src/features/system-settings/hooks/use-update-option.test.ts
cd web && bunx vitest run src/features/system-settings/hooks/use-update-option.test.ts
```
Expected: FAIL，`isStatusRelatedOption` 未导出 / `agent_setting.enabled` 不在集合。

- [ ] **Step 2: `use-status.ts` 返回完整字段**

```ts
  return {
    status: query.data ?? null,
    hasAuthoritativeData:
      query.data !== undefined &&
      query.data !== null &&
      !query.isPlaceholderData,
    loading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
```
（把 `const { data, isLoading, error, isPlaceholderData } = useQuery({...})` 改成 `const query = useQuery({...})`。）

- [ ] **Step 3: `auth/types.ts` 两个 `SystemStatus` 块各加**

```ts
  agent_enabled?: boolean
```

- [ ] **Step 4: `use-update-option.ts`**

`STATUS_RELATED_KEYS` 集合末尾加 `'agent_setting.enabled',`；集合之后加：
```ts
export function isStatusRelatedOption(key: string): boolean {
  return STATUS_RELATED_KEYS.has(key)
}
```
`onSuccess` 中 `if (STATUS_RELATED_KEYS.has(variables.key))` 改为 `if (isStatusRelatedOption(variables.key))`。

- [ ] **Step 5: `agent-admin/index.tsx` 恢复真实刷新**

- `:64` `hasAuthoritativeStatus: Boolean(status.status)` → `hasAuthoritativeStatus: status.hasAuthoritativeData`
- `:94` `await Promise.resolve()` → `await status.refetch()`
- `:140` `onClick={() => Promise.resolve()}` → `onClick={() => void status.refetch()}`
- `:155` `disabled={updateOption.isPending || status.loading}` → `disabled={updateOption.isPending || status.isFetching}`

- [ ] **Step 6: `use-agent-access.ts`**

`getAgentStatusAccessState` 入参改回：
```ts
    isFetching: statusQuery.isFetching,
    isError: statusQuery.isError,
```
`isChecking` 改为：
```ts
    isChecking:
      (statusQuery.status === null && statusQuery.loading) ||
      statusQuery.isPlaceholderData ||
      (shouldCheck && query.isPending),
```

- [ ] **Step 7: 运行通过并提交**

Run: `cd web && bunx vitest run src/features/system-settings src/features/agents src/features/agent-admin && bun run typecheck`
```bash
git add web/src/hooks/use-status.ts web/src/features/auth/types.ts web/src/features/system-settings/hooks web/src/features/agent-admin/index.tsx web/src/features/agents/hooks/use-agent-access.ts
git commit -m "fix(web): restore status refetch and agent_enabled plumbing"
```

### Task 20: `/agents` 路由门禁与侧边栏条件显示

**Files:**
- Modify: `web/src/routes/_authenticated/agents.tsx`（整体重写）
- Modify: `web/src/routes/_authenticated/agent-admin.tsx`（格式化，保持逻辑）
- Modify: `web/src/hooks/use-sidebar-data.ts:101-117`
- Verify: `web/src/features/agents/lib/workspace.ts:133`（`getAgentRouteGateState` 已存在）；若 `retryAgentRouteGate` 不存在则从 `custom` 的 `web/default/src/features/agents/lib/workspace.ts` 迁入。

- [ ] **Step 1: 重写路由文件**

`web/src/routes/_authenticated/agents.tsx`：以 `git show custom:web/default/src/routes/_authenticated/agent/index.tsx` 为基准，做两处改动：`createFileRoute('/_authenticated/agent/')` → `createFileRoute('/_authenticated/agents')`；`useStatus()` 字段名对齐 Task 19（`hasAuthoritativeData`、`isFetching`、`isError`、`refetch` 均已存在）。文件保留原来的 license 头、`beforeLoad` 未登录跳 `/sign-in`、`AgentRouteGate` 组件（`useEffect` 中 `navigate({ to: '/403', replace: true })`，绝不在渲染期 `throw redirect`）、loading Spinner、错误重试 Empty 状态。

- [ ] **Step 2: 侧边栏条目按原分组与门控放置**

`use-sidebar-data.ts`：删除 `:101-117` 控制台组里的 "Usage ranking"、"Agent workspace"、"Agent management" 三条；在 `personal` 组 `Wallet` 之后加：
```ts
          ...(agentAccess.globallyEnabled && agentAccess.hasAccess
            ? [
                {
                  title: t('Agent workspace'),
                  url: '/agents',
                  icon: Users,
                },
              ]
            : []),
```
在 `admin` 组 `System Info` 之前加：
```ts
          {
            title: t('Agent management'),
            url: '/agent-admin',
            icon: ServerCog,
            requiredRole: ROLE.ADMIN,
          },
```
文件顶部 `const agentAccess = useAgentAccess()`（import `@/features/agents/hooks/use-agent-access`）。排行榜条目不再单独出现（Task 23 恢复到日志页 Tab）。

- [ ] **Step 3: 格式化路由文件**

Run: `cd web && bun run format`（项目脚本只支持全树 `--write`；提交时只 `git add` 本任务涉及的文件，其它被格式化的文件用 `git checkout --` 还原，避免混入无关改动）。

- [ ] **Step 4: 验证**

Run: `cd web && bun run typecheck && bunx vitest run src/features/agents && bunx oxlint -c .oxlintrc.json src/routes/_authenticated/agents.tsx src/routes/_authenticated/agent-admin.tsx src/hooks/use-sidebar-data.ts`
手工：以非代理超管登录点击不到「Agent workspace」；直接访问 `/agents` 落到 `/403` 而不是 500。

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/_authenticated/agents.tsx web/src/routes/_authenticated/agent-admin.tsx web/src/hooks/use-sidebar-data.ts web/src/features/agents/lib/workspace.ts
git commit -m "fix(web): gate agent workspace route and sidebar on real access"
```

### Task 21: 侧边栏模块可配置

**Files:**
- Modify: `web/src/hooks/use-sidebar-config.ts`（`DEFAULT_SIDEBAR_MODULES.personal`、`.admin`、`URL_TO_CONFIG_MAP`）
- Modify: `web/src/features/system-settings/maintenance/config.ts`（`SIDEBAR_MODULES_DEFAULT`）
- Modify: `web/src/features/system-settings/maintenance/sidebar-modules-section.tsx`（两个 label map）
- Create（迁回）: `web/src/features/system-settings/maintenance/config.test.ts`

- [ ] **Step 1: 迁回测试，改 `/agent` → `/agents`，确认失败**

```bash
git show custom:web/default/src/features/system-settings/maintenance/config.test.ts > web/src/features/system-settings/maintenance/config.test.ts
sed -i '' "s#'/agent'#'/agents'#g" web/src/features/system-settings/maintenance/config.test.ts
cd web && bunx vitest run src/features/system-settings/maintenance/config.test.ts
```

- [ ] **Step 2: 实现**

`use-sidebar-config.ts`：`DEFAULT_SIDEBAR_MODULES.personal` 加 `agent: true,`；`.admin` 加 `agent_management: true,`；`URL_TO_CONFIG_MAP` 加
```ts
  '/agents': { section: 'personal', module: 'agent' },
  '/agent-admin': { section: 'admin', module: 'agent_management' },
```
`config.ts` 的 `SIDEBAR_MODULES_DEFAULT` 同步加两个 `true`。
`sidebar-modules-section.tsx` personal 的 label map 加：
```ts
      agent: {
        title: t('Agent workspace'),
        description: t('Purchase and manage package redemption codes.'),
      },
```
admin 的 label map 加：
```ts
      agent_management: {
        title: t('Agent management'),
        description: t('Manage agents, point balances, offers, and codes.'),
      },
```

- [ ] **Step 3: 验证并提交**

Run: `cd web && bunx vitest run src/features/system-settings && bun run typecheck`
```bash
git add web/src/hooks/use-sidebar-config.ts web/src/features/system-settings/maintenance
git commit -m "feat(web): make agent sidebar entries admin-configurable"
```

### Task 22: 登录后重定向策略

**Files:**
- Create（迁回）: `web/src/features/auth/lib/post-login-redirect.ts`、`post-login-redirect.test.ts`
- Modify: `web/src/features/auth/hooks/use-auth-redirect.ts:66-68`、`web/src/routes/(auth)/sign-in.tsx:43-46`

- [ ] **Step 1: 迁回并适配路由名**

```bash
git show custom:web/default/src/features/auth/lib/post-login-redirect.ts > web/src/features/auth/lib/post-login-redirect.ts
git show custom:web/default/src/features/auth/lib/post-login-redirect.test.ts > web/src/features/auth/lib/post-login-redirect.test.ts
```
两个文件中所有 `'/agent'` 前缀判断改为 `'/agents'`；测试文件的 `node:test` 按 Task 18 映射改为 vitest。若原实现内部调用了 `normalizePostLoginPath`，改为调用上游已有的 `sanitizeAuthRedirect`（`web/src/features/auth/lib/auth-redirect.ts`）并删除重复的开放重定向校验。

- [ ] **Step 2: 确认测试失败后接线**

`use-auth-redirect.ts:66-68` 与 `sign-in.tsx:43-46` 中 `sanitizeAuthRedirect(redirect) ?? '/dashboard'` 替换为 `await resolvePostLoginTarget({ redirect, role: user.role, probeAgentAccess: resolveAgentAccess })`（参数名以迁入文件的导出签名为准）。

- [ ] **Step 3: 验证并提交**

Run: `cd web && bunx vitest run src/features/auth && bun run typecheck`
```bash
git add web/src/features/auth
git commit -m "feat(web): restore role and agent aware post-login redirect"
```

### Task 23: 排行榜回到通用日志页

**Files:**
- Create（迁回）: `web/src/features/usage-logs/components/ranking/{usage-ranking-view,usage-ranking-table,usage-ranking-columns,usage-ranking-filter-bar,usage-ranking-summary,usage-ranking-mobile-list}.tsx`
- Modify: `web/src/features/usage-logs/api.ts`、`types.ts`（迁入 `getUsageRanking` 与 `UsageRanking*` 类型）
- Modify: `web/src/features/usage-logs/index.tsx`（恢复 Tab 切换）
- Delete: `web/src/features/usage-ranking/index.tsx`、`web/src/routes/_authenticated/usage-ranking.tsx`
- Regenerate: `web/src/routeTree.gen.ts`

- [ ] **Step 1: 迁入组件与 API**

```bash
mkdir -p web/src/features/usage-logs/components/ranking
for f in usage-ranking-view usage-ranking-table usage-ranking-columns usage-ranking-filter-bar usage-ranking-summary usage-ranking-mobile-list; do git show custom:web/default/src/features/usage-logs/components/ranking/$f.tsx > web/src/features/usage-logs/components/ranking/$f.tsx; done
git show custom:web/default/src/features/usage-logs/api.ts > /tmp/orig-usage-logs-api.ts
git show custom:web/default/src/features/usage-logs/types.ts > /tmp/orig-usage-logs-types.ts
```
从两份 `/tmp` 文件中把 `getUsageRanking`、`UsageRankingParams`、`UsageRankingItem`、`UsageRankingGroupStat`、`UsageRankingModelStat`、`UsageRankingChannelStat`、`GetUsageRankingResponse`（以原文件实际导出为准）追加到集成分支的 `api.ts`/`types.ts`。字段以后端 `model/log_ranking.go` 为准：`quota, request_count, prompt_tokens, completion_tokens, total_tokens, avg_use_time, stream_count, stream_ratio, error_count, error_rate, model_count, token_count, channel_count, last_used_at, model_stats[], channel_stats[]`，响应包 `items/total/page/page_size/summary`。

- [ ] **Step 2: 恢复 `usage-logs/index.tsx` 的 Tab**

以 `git show custom:web/default/src/features/usage-logs/index.tsx` 为基准合并：保留集成分支已有的 `useLogsViewScope`（All / Only Mine）；加回 `isRoot`、`commonView` 状态、`UsageRankingView` 的 `lazy` 导入、`showCommonSwitcher = activeCategory === 'common' && isRoot`、`Log Details / Ranking` 的 `Tabs`、`Suspense` 骨架屏，以及 `showRanking ? <UsageRankingView /> : <UsageLogsTable .../>` 分支。

- [ ] **Step 3: 删除独立页面并重生路由树**

```bash
git rm web/src/features/usage-ranking/index.tsx web/src/routes/_authenticated/usage-ranking.tsx
cd web && bun run dev -- --help >/dev/null 2>&1; bunx @tanstack/router-cli generate 2>/dev/null || bun run build --dry-run 2>/dev/null || true
```
（路由树由 rsbuild 的 TanStack Router 插件在 `bun run build`/`bun run dev` 时生成；直接跑 Step 4 的 `bun run build` 即可刷新 `routeTree.gen.ts`。）

- [ ] **Step 4: 验证**

Run: `cd web && bun run typecheck && bunx vitest run src/features/usage-logs && bun run build && bunx oxlint -c .oxlintrc.json src/features/usage-logs`
手工：超管进入「使用日志 → 通用日志」看到 `Log Details / Ranking` Tab；普通管理员看不到 Tab；侧边栏没有独立「Usage ranking」。

- [ ] **Step 5: Commit**

```bash
git add -A web/src/features/usage-logs web/src/features/usage-ranking web/src/routes/_authenticated/usage-ranking.tsx web/src/routeTree.gen.ts
git commit -m "feat(web): restore usage ranking as a common logs tab"
```

### Task 24: 钱包类型化兑换与订阅刷新

**Files:**
- Create（迁回）: `web/src/features/wallet/lib/redemption.ts`、`redemption.test.ts`、`lib/latest-request.ts`、`latest-request.test.ts`、`api.test.ts`
- Modify: `web/src/features/wallet/api.ts`、`types.ts`、`hooks/use-redemption.ts`、`components/subscription-plans-card.tsx`、`index.tsx`
- Modify: `web/src/features/agents/api.ts:415-424`（`redeemTypedCode` 若与钱包重复则删除，统一由 wallet/api.ts 提供）

**Interfaces:**
- Consumes: `POST /api/user/redeem`（Task 15）。

- [ ] **Step 1: 迁回 lib 与测试并按 Task 18 改 vitest**

```bash
for f in lib/redemption.ts lib/redemption.test.ts lib/latest-request.ts lib/latest-request.test.ts api.test.ts; do git show custom:web/default/src/features/wallet/$f > web/src/features/wallet/$f; done
```

- [ ] **Step 2: 合并 api/types/hook/组件/页面**

对 `api.ts`、`types.ts`、`hooks/use-redemption.ts`、`components/subscription-plans-card.tsx`、`index.tsx` 逐个 `git diff --no-index <(git show custom:web/default/src/features/wallet/<f>) web/src/features/wallet/<f>`，把 `custom` 侧的这些改动落到集成文件：`redeemCode` 委托 `redeemTypedCode` 调 `/api/user/redeem`；`RedemptionResponse` 改为 `ApiResponse<RedemptionResult>`（`{ type: 'quota'; quota: number } | { type: 'subscription'; plan_title: string; end_time: number; subscription_id: number }`）；`useRedemption({ refreshUser, refreshSubscriptions })`；`SubscriptionPlansCard` 用 `forwardRef` 暴露 `refreshSubscriptions`；`index.tsx` 持有 ref 并在兑换成功后同时刷新；请求用 `createLatestRequestGuard` 包裹。保留上游对钱包页的新改动（表格、样式、`/topup` 支付流程），只叠加兑换相关逻辑。

- [ ] **Step 3: 验证并提交**

Run: `cd web && bunx vitest run src/features/wallet && bun run typecheck && bunx oxlint -c .oxlintrc.json src/features/wallet`
手工：兑换一个代理套餐码，toast 显示套餐名与到期时间，订阅卡片立即出现新订阅。
```bash
git add web/src/features/wallet web/src/features/agents/api.ts
git commit -m "feat(web): restore typed redemption with subscription refresh in wallet"
```

### Task 25: 补齐 i18n 键值

**Files:**
- Modify: `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`

- [ ] **Step 1: 读取并遵循 skill**

Read `/Users/luodashuaige/Documents/new-api/.agents/skills/i18n-translate/SKILL.md` 并按其流程执行。

- [ ] **Step 2: 从原分支搬迁已有翻译**

```bash
cd web && for l in en zh zh-TW fr ja ru vi; do git show custom:web/default/src/i18n/locales/$l.json > /tmp/orig-$l.json; done
```
用脚本把当前 `src` 里所有 `t('...')` 字面量中在 `src/i18n/locales/zh.json` 缺失的键，从 `/tmp/orig-<lang>.json` 取值写入对应 locale；原分支也没有的键（Task 20/21/22/23/24 新增文案）由 `bun run i18n:sync` 生成后人工补译。

- [ ] **Step 3: 验证**

Run:
```bash
cd web && bun run i18n:sync && rg -oN --no-filename "\bt\('([^']+)'" src/features/agents src/features/agent-admin src/features/usage-logs/components/ranking src/features/wallet src/hooks/use-sidebar-data.ts src/features/system-settings/maintenance | sed -E "s/^t\('//; s/'$//" | sort -u > /tmp/keys.txt; missing=0; while IFS= read -r k; do rg -qF "\"$k\":" src/i18n/locales/zh.json || { echo "MISSING: $k"; missing=$((missing+1)); }; done < /tmp/keys.txt; echo "missing=$missing"
```
Expected: `missing=0`；`zh.json` 中无与 `en` 键值完全相同的未译条目（skill 中的检测脚本）。

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n
git commit -m "i18n(web): add agent, ranking, and wallet translations"
```

### Task 26: 前端阶段门禁

- [ ] **Step 1: 全量检查**

Run: `cd web && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test && bun run build`
Expected: 全部 0 error；vitest 全绿。

- [ ] **Step 2: 处理 lint warning 与格式**

Run: `cd web && bun run format && bunx oxlint -c .oxlintrc.json src/routes/_authenticated src/features/agents src/features/agent-admin src/features/usage-logs src/features/wallet`
确认 Task 20 涉及的路由文件不再报 `import/newline-after-import`；`bun run format` 若改动了本计划未触及的上游文件，用 `git checkout -- <file>` 还原，只保留定制文件的格式化结果。

- [ ] **Step 3: Commit（如有剩余格式改动）**

```bash
git add web/src/routes/_authenticated web/src/features/agents web/src/features/agent-admin web/src/features/usage-logs web/src/features/wallet
git commit -m "style(web): format agent and ranking routes"
```

---

## 阶段 4：基础设施与文档

### Task 27: CI、开发环境与文档回迁

**Files:**
- Create: `.github/workflows/build-ghcr.yml`
- Modify: `.github/workflows/docker-build.yml`、`.github/workflows/release.yml`、`.gitignore`
- Create: `dev/.air.toml`、`dev/Dockerfile.air`、`dev/docker-compose.custom-dev.yml`、`dev/docker-compose.production-staging.yml`
- Create: `.claude/CLAUDE.md`
- Create: `docs/superpowers/specs/2026-06-21-channel-actual-base-url-design.md` 等 12 份历史文档

- [ ] **Step 1: 原样迁入不需适配的文件**

```bash
for f in .github/workflows/build-ghcr.yml dev/Dockerfile.air dev/docker-compose.production-staging.yml; do mkdir -p $(dirname $f); git show custom:$f > $f; done
for f in $(git diff --name-status 8739c05c custom -- docs | awk '$1=="A"{print $2}' | rg -v '2026-09-09'); do git show custom:$f > $f; done
```

- [ ] **Step 2: 需要适配的文件**

- `.gitignore` 加一行 `.worktrees/`。
- `docker-build.yml` 与 `release.yml` 的 `tags:` 列表各加一行 `- '!custom-v*'`。
- `dev/.air.toml`：`git show custom:dev/.air.toml` 后把 `cmd` 改为
  ```toml
  cmd = "mkdir -p web/dist && [ -f web/dist/index.html ] || echo '<!doctype html><title>dev</title>use frontend dev server' > web/dist/index.html; go build -o ./tmp/new-api-dev ."
  ```
- `dev/docker-compose.custom-dev.yml`：`git show` 后把注释里的 `cd web/default && VITE_REACT_APP_SERVER_URL=...` 改为 `cd web && ...`。
- `.claude/CLAUDE.md`：`git show` 后把提到 `web/default` 的地方改为 `web/`。

- [ ] **Step 3: 验证**

Run: `docker compose -f dev/docker-compose.custom-dev.yml config >/dev/null && echo OK`；`git diff --check`。

- [ ] **Step 4: Commit**

```bash
git add .github .gitignore dev .claude docs
git commit -m "chore: restore custom build workflow, dev stack, and design docs"
```

---

## 阶段 5：吸收上游并通过门禁

### Task 28: 合并 `upstream/main` 并重跑全部门禁

- [ ] **Step 1: 合并**

```bash
git fetch upstream && git merge --no-ff upstream/main
```
冲突按 spec 冲突处理规则：官方安全/计费/数据库修复保留官方；定制语义保留并改接。重点核对 `4fc9d1f1f`（options 表主键重建）不影响 `agent_setting` 选项读写，`c79b74b68`（`/api/status` 去重）与 Task 19 的 `use-status.ts` 改动合并后 `refetch/isFetching` 仍导出。

- [ ] **Step 2: 后端门禁**

Run: `gofmt -l . | rg -v '^web/'; go vet ./... && go test ./... -count=1 2>&1 | rg '^(FAIL|--- FAIL|panic)' || echo "GO GREEN"`

- [ ] **Step 3: 前端门禁**

Run: `cd web && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test && bun run build`

- [ ] **Step 4: 三库迁移冒烟**

用 `dev/docker-compose.custom-dev.yml` 起 PostgreSQL 栈启动一次；再分别以 `SQL_DSN` 为空（SQLite）和指向本地 MySQL 8 各启动一次；三次日志均无 `AutoMigrate`/`ALTER TABLE` 错误，且启动后 `curl /api/status | jq .data.agent_enabled` 返回布尔值。

- [ ] **Step 5: 定制功能手工回归**

以超管：渠道设置 `actual_base_url` 后测试渠道成功、错误消息含展示地址；日志页 Tab 切换到排行榜；管理端兑换码列表不显示代理码。以代理账号：登录后跳转到 `/agents`，购买套餐码、导出、退款。以普通用户：兑换代理套餐码后订阅卡片刷新；访问 `/agents` 得到 403。

- [ ] **Step 6: 记录证据并提交**

写入 `docs/superpowers/evidence/2026-09-09-gap-remediation-validation.md`（命令、输出摘要、手工回归清单勾选），然后：
```bash
git add docs/superpowers/evidence/2026-09-09-gap-remediation-validation.md
git commit -m "docs: record gap remediation validation evidence"
```

---

## 自检

**覆盖对照（审计 30 项 → 任务）：** 1→Task 1/2；2→Task 3；3→Task 4；4→Task 5；5→Task 7；6→Task 8；7→Task 9；8→Task 10；9→Task 13；10→Task 14；11→Task 15/24；12→Task 11/12；13→Task 8；14→Task 6；15→Task 8/13/15/16；16→Task 23；17→Task 25；18→Task 20；19→Task 22；20→Task 19；21→Task 19；22→Task 21；23→Task 24；24→Task 18；25、26、27、28、29→Task 27；30→Task 17/20/26；上游 9 提交→Task 28。

**类型一致性：** `redactUpstreamURLForClient(info *relaycommon.RelayInfo, msg string) string`（Task 1 定义，Task 2 使用）；`ChannelMeta.ChannelDisplayBaseUrl`（Task 1 定义，Task 1 的 relay_task 与 Task 2 使用）；`serializeSubscriptionUserTx(tx, userId) (*User, error)` 与 `getDBTimestamp(db)`（Task 13 定义并使用）；`validateSubscriptionDuration(unit string, value int, customSeconds int64) error`（Task 14）；`isStatusRelatedOption(key string): boolean`、`useStatus()` 返回的 `hasAuthoritativeData/isFetching/isError/refetch`（Task 19 定义，Task 20/22 使用）；`POST /api/user/redeem` 返回 `RedemptionResult`（Task 15 定义，Task 24 使用）。

**未决决策：** Task 12（禁用代理是否仍可被绑定）默认恢复 `custom` 语义，执行前请产品方确认。
