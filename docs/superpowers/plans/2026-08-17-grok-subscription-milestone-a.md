# Grok Subscription 渠道 · 里程碑 A（文本先行）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 NewAPI 中新增独立的 Grok Subscription 渠道类型，交付其认证（四种入口）与全部文本能力（Responses / Responses compact / Chat Completions / Claude Messages / count-tokens / function+web+X search），作为可独立合并上线的产品。

**Architecture:** 新增 `ChannelTypeGrokSubscription=113`（接管 Dummy）+ `APITypeGrokSubscription=38`（接管 Dummy）两个哨兵接管，照 Copilot（OAuth device flow + 空 Key 待授权渠道 + `Channel.Key` 落库）与 Codex（版本化 JSON Key 校验）两个仓库内既有模板扩展。凭证存版本化 OAuth JSON，PKCE 一次性状态存 Grok 专用 `AuthFlow` 表，刷新走 channel-scoped 跨节点 lease。文本协议以 Responses 为 canonical，Chat/Claude 复用既有 bridge；流式换渠道走 Grok 专用 `semantic_output_started` tracker，不改共享 `shouldRetry`。上游主机在 CLI 网关（`cli-chat-proxy.grok.com`）与官方 API（`api.x.ai`）间按能力分流，严格 host/path allowlist。

**Tech Stack:** Go 1.25（后端 adaptor/relay/model/service/controller）+ React/TypeScript（web/default 管理 UI）+ GORM（SQLite/MySQL/PostgreSQL AutoMigrate）+ Redis（可选，刷新 lease/AuthFlow claim 的跨节点协调，带内存 fallback）。

**依据设计：** `docs/superpowers/specs/2026-08-17-grok-subscription-design.md`（commit e7fd03551 初版 + e539edfbc 审阅修订 + 1181fc2b4 APIType 值订正）。本计划只覆盖里程碑 A；里程碑 B（图片/视频/TTS/STT/自定义声音/Realtime）另出计划。

---

## 关键地基事实（编译器实测，实现时以 iota 位置为准，勿硬编码字面量）

- `constant/api_type.go` iota 实测：`APITypeBlockRun=35`、`APITypeElevenLabs=36`、`APITypeCopilot=37`、`APITypeDummy=38`。→ `APITypeGrokSubscription` 接管 `38`，`APITypeDummy` 后移 `39`。
- `constant/channel.go`：`ChannelTypeCopilot=112`、`ChannelTypeDummy=113`。→ `ChannelTypeGrokSubscription` 接管 `113`，`ChannelTypeDummy` 后移 `114`。
- 现有 `ChannelTypeXai=48` / `APITypeXai=27` 完全不改。
- 守卫测试 `constant/copilot_channel_test.go`、`constant/modelapi_seedance_channel_test.go` 都断言 `ChannelTypeDummy` 在其后（`<=` 比较），Dummy 后移后仍成立，但新增 Grok 后需补一个 Grok 自己的注册守卫测试。

## 既有 baseline（实现前已采集，用于对比）

`constant`、`common` 两包 targeted 全绿。全量 `go test -timeout 90s ./...` 于 2026-08-17 在基线 `e539edfbc` 采集，完整输出存于 `docs/superpowers/plans/baseline-2026-08-17.txt`（3557 行）。**7 个既有失败包（与 Grok 无关，不在本次修复）：**

| 包 | 失败形态 |
| --- | --- |
| `new-api`（root） | `[setup failed]` — `web/classic/dist` embed 缺失 |
| `controller` | suite 超时 91s + `TestValidateChannelRejectsModelAPISeedanceProxy`、`TestCreateCliDeviceAuthorization*`、`TestEnsureDefaultUserToken*` 等 |
| `model` | suite 超时 90.5s + `TestModelAPISeedanceAssetTaskWorker*`、`TestAssetTaskWorkerFailsClosed*`、`TestConsumeCliDeviceAuthorization*` 等 |
| `relay/channel/claude` | 三项 `TestRequestOpenAI2ClaudeMessage_*`（file content 转换） |
| `relay/channel/codex` | `TestConvertImageRequest_RejectsURLResponseFormat` nil pointer panic |
| `relay/helper` | `TestStreamScannerHandler_DoneStopsScanner` NewTicker non-positive panic |
| `service` | suite 超时 90.6s |

**关键：workstream 1 要改的 `controller`、`model`、`service` 三个包本就 suite 超时 + 多项既有失败。因此每个任务完成后的比对基准是「这 7 个包的失败集合与形态不扩大、不新增其他包失败」，而非「全绿」。** 优先用 targeted 单测（`go test ./pkg/ -run TestGrokXxx`）验证新增功能，全包 `go test` 仅用于确认没引入新失败。新增失败或既有失败形态扩大 = 未完成。

## 环境约束

- GitNexus 1.6.3 本机崩溃（exit 139），无法索引本 worktree。核验用 `rg` 符号检索 + git diff + `go build ./...` + targeted tests 替代，不得声称 GitNexus 通过。
- 只在 `feature/grok-subscription` 分支本地 commit，**绝不 push**（flatkey 生产仓库）。
- 凭证/token/密码/SSO Cookie/PKCE verifier 绝不写日志、绝不落非秘密字段。
- clean-room：只重实现观察到的协议行为，不逐段复制 sub2api（LGPLv3）代码。

---

## 文件结构（里程碑 A 涉及的创建/修改）

### 新建文件

| 文件 | 职责 |
| --- | --- |
| `relay/channel/groksubscription/adaptor.go` | Grok adaptor（thin `struct{}`，照 xai 而非内嵌 openai）：固定 URL、CLI identity headers、OAuth Bearer 注入、Responses 透传、Chat/Claude bridge 强制、里程碑 A 媒体端点拒绝 |
| `relay/channel/groksubscription/constants.go` | 固定 OAuth 参数、host allowlist、CLI identity 常量、默认模型列表、CLI 版本 semver 校验 |
| `relay/channel/groksubscription/credential.go` | 版本化 OAuth JSON 的解析/序列化/校验（version+type 精确匹配，fail closed） |
| `relay/channel/groksubscription/refresh.go` | 跨节点刷新 lease + token endpoint 调用 + revision CAS 原子保存 |
| `relay/channel/groksubscription/responses_compact.go` | clean-room 构造服务端 summary turn（非流式、强制 store=false、剥离工具配置） |
| `relay/channel/groksubscription/tools.go` | function/web_search/x_search 的 typed DTO 解析（指针保留零值、别名归一化、未知类型 400） |
| `relay/channel/groksubscription/sanitize.go` | compact 顶层工具配置 sanitizer（param override 后必跑，幂等） |
| `relay/channel/groksubscription/cache_identity.go` | HMAC 命名空间化 cache identity（防跨租户缓存串号） |
| `relay/channel/groksubscription/errors.go` | 403 六分类（marker 优先/冲突取高/unknown fail-closed）+ attempt 上限 failover 决定（纯函数，不改共享 shouldRetry） |
| `relay/channel/groksubscription/retry_tracker.go` | Grok 专用 `semantic_output_started` 请求级 tracker |
| `relay/channel/groksubscription/host_guard.go` | host/path allowlist 校验 + redirect 逐跳重校验 |
| `model/grok_auth_flow.go` | Grok 专用 `AuthFlow` 一次性 PKCE 状态表（GORM 模型 + 事务式状态迁移 + claim/consume） |
| `model/grok_channel_state.go` | 按 channel_id 唯一的非秘密 Grok 渠道状态表（auth status/tier/quota snapshot/refresh lease owner） |
| `service/grok_auth.go` | 四种认证入口的服务端逻辑（PKCE start/complete、refresh-token import、SSO、password）编排 |
| `service/grok_credential_cipher.go` | PKCE verifier 加密（照 `byteplus_sensitive_cipher.go` 的 AES-GCM 模式，独立 env key 与 AAD 命名空间） |
| `controller/grok_auth.go` | Grok auth 管理 API handler（start/complete PKCE、import、manual refresh、state/quota refresh），`Cache-Control: no-store`、禁 body 日志 |
| `setting/system_setting/grok.go` | `grok_password_auth_enabled` 等 Grok 系统设置段（照 `copilot.go`） |
| `relay/channel/groksubscription/adaptor_test.go` 等 | 每个源文件对应的 `_test.go` |

### 修改文件（登记点）

| 文件 | 改动 |
| --- | --- |
| `constant/channel.go:75` | `ChannelTypeGrokSubscription=113` 接管；`ChannelTypeDummy` 移 114；`ChannelBaseURLs` 补索引 113；`ChannelTypeNames` 补名字 |
| `constant/api_type.go:41-42` | iota 块插入 `APITypeGrokSubscription`（取代 Dummy 位置），`APITypeDummy` 顺延 |
| `common/api_type.go:82` | `ChannelType2APIType` 加 `case ChannelTypeGrokSubscription → APITypeGrokSubscription` |
| `common/endpoint_type.go:29` | `GetEndpointTypesByChannelType` 加 Grok case，返回 `{EndpointTypeOpenAI, EndpointTypeOpenAIResponse}`（照 Xai） |
| `relay/relay_adaptor.go:149` | `GetAdaptor` 加 `case APITypeGrokSubscription → &groksubscription.Adaptor{}` + import |
| `service/channel_select.go:271,254` | `channelSupportsOpenAIResponses` allowlist 加 Grok；`channelSupportsRequestedEndpoint` 的 compact 分支加 Grok |
| `relay/responses_handler.go:27` | `RelayModeResponsesCompact` 的 api-type 白名单加 `APITypeGrokSubscription` |
| `relay/compatible_handler.go` | Chat→Responses bridge 对 Grok 放行（区别于 Copilot 的 return false） |
| `relay/claude_handler.go` | `shouldClaudeUseResponsesBridge` 对 Grok 强制走 Responses bridge |
| `controller/channel.go:469,484` | multi-key 拒绝加 Grok；空 Key 例外加 Grok；版本化 JSON Key 校验（照 Codex :513） |
| `model/main.go` | `orderedMigrationModels()` 注册 `GrokAuthFlow`、`GrokChannelState` |
| `model/channel.go` | 删除渠道时级联清理 Grok state（照现有级联） |
| `router/api-router.go` | channelRoute admin 组加 Grok auth 路由 |
| `web/default/src/features/channels/*` | 渠道类型元数据（constants/config/utils/api）+ Grok auth UI 抽屉 + i18n |

---

## Workstream 1：渠道类型、凭证、AuthFlow、状态、刷新 lease

### Task 1: 注册 ChannelType 与 APIType 哨兵接管

**Files:**
- Modify: `constant/channel.go:75`
- Modify: `constant/api_type.go:41-42`
- Test: `constant/grok_subscription_channel_test.go`（新建）

- [ ] **Step 1: 写守卫测试（先失败）**

新建 `constant/grok_subscription_channel_test.go`：

```go
package constant

import "testing"

func TestGrokSubscriptionChannelRegistration(t *testing.T) {
	if ChannelTypeGrokSubscription != 113 {
		t.Fatalf("ChannelTypeGrokSubscription = %d, want 113", ChannelTypeGrokSubscription)
	}
	if ChannelTypeDummy != 114 {
		t.Fatalf("ChannelTypeDummy = %d, want 114 (shifted after Grok took over 113)", ChannelTypeDummy)
	}
	if ChannelTypeDummy <= ChannelTypeGrokSubscription {
		t.Fatalf("ChannelTypeDummy = %d must stay after ChannelTypeGrokSubscription", ChannelTypeDummy)
	}
	if got := GetChannelTypeName(ChannelTypeGrokSubscription); got != "GrokSubscription" {
		t.Fatalf("GrokSubscription channel name = %q, want GrokSubscription", got)
	}
	if len(ChannelBaseURLs) <= ChannelTypeGrokSubscription {
		t.Fatalf("ChannelBaseURLs missing index for GrokSubscription")
	}
}

func TestGrokSubscriptionAPIType(t *testing.T) {
	if APITypeGrokSubscription != 38 {
		t.Fatalf("APITypeGrokSubscription = %d, want 38 (took over Dummy)", APITypeGrokSubscription)
	}
	if APITypeDummy != 39 {
		t.Fatalf("APITypeDummy = %d, want 39 (shifted after Grok)", APITypeDummy)
	}
	if APITypeGrokSubscription != APITypeCopilot+1 {
		t.Fatalf("APITypeGrokSubscription must be immediately after APITypeCopilot")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./constant/ -run TestGrokSubscription -v`
Expected: FAIL（`ChannelTypeGrokSubscription` / `APITypeGrokSubscription` undefined，编译错误）

- [ ] **Step 3: 改 `constant/api_type.go`**

把 iota 块结尾从：

```go
	APITypeCopilot
	APITypeDummy // this one is only for count, do not add any channel after this
```

改为：

```go
	APITypeCopilot
	APITypeGrokSubscription
	APITypeDummy // this one is only for count, do not add any channel after this
```

- [ ] **Step 4: 改 `constant/channel.go` 常量块**

把 `:74-75` 从：

```go
	ChannelTypeCopilot          = 112 // GitHub Copilot Chat Completions API
	ChannelTypeDummy            = 113 // this one is only for count, do not add any channel after this
```

改为：

```go
	ChannelTypeCopilot            = 112 // GitHub Copilot Chat Completions API
	ChannelTypeGrokSubscription   = 113 // Grok Subscription: OAuth/PKCE 订阅账号，CLI 网关文本 + api.x.ai 媒体
	ChannelTypeDummy              = 114 // this one is only for count, do not add any channel after this
```

- [ ] **Step 5: 改 `constant/channel.go` 的 ChannelBaseURLs 切片**

在 `:156` 的 Copilot 那行后追加索引 113（Grok 不接受自定义 Base URL，占位空串，真实 host 由 adaptor 常量控制）：

```go
	"https://api.githubcopilot.com",           // 112 Copilot
	"",                                        // 113 GrokSubscription (host fixed in adaptor; no custom base URL)
```

- [ ] **Step 6: 改 `constant/channel.go` 的 ChannelTypeNames map**

在 `ChannelTypeCopilot: "Copilot",` 后追加：

```go
	ChannelTypeCopilot:          "Copilot",
	ChannelTypeGrokSubscription: "GrokSubscription",
```

- [ ] **Step 7: 运行确认通过**

Run: `go test ./constant/ -run TestGrokSubscription -v`
Expected: PASS

- [ ] **Step 8: 运行守卫回归测试**

Run: `go test ./constant/ -v`
Expected: PASS（`TestCopilotChannelRegistration`、`TestModelAPISeedanceChannelRegistration` 仍绿，因为它们用 `<=` 判断 Dummy 在后，Dummy=114 仍满足）

- [ ] **Step 9: Commit**

```bash
git add constant/channel.go constant/api_type.go constant/grok_subscription_channel_test.go
git commit -m "feat(grok): register ChannelType/APIType sentinel takeover (113/38)"
```

### Task 2: ChannelType→APIType 映射与端点类型

**Files:**
- Modify: `common/api_type.go:82`
- Modify: `common/endpoint_type.go:29`
- Test: `common/api_type_test.go`（追加）、`common/endpoint_type_test.go`（新建或追加）

- [ ] **Step 1: 写失败测试**

在 `common/api_type_test.go` 追加：

```go
func TestGrokSubscriptionAPITypeMapping(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeGrokSubscription)
	if !ok {
		t.Fatalf("ChannelType2APIType(GrokSubscription) ok = false, want true")
	}
	if apiType != constant.APITypeGrokSubscription {
		t.Fatalf("apiType = %d, want %d", apiType, constant.APITypeGrokSubscription)
	}
}
```

新建 `common/endpoint_type_test.go`（若已存在则追加）：

```go
package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGrokSubscriptionEndpointTypes(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeGrokSubscription, "grok-4")
	hasResponses := false
	hasOpenAI := false
	for _, e := range got {
		if e == constant.EndpointTypeOpenAIResponse {
			hasResponses = true
		}
		if e == constant.EndpointTypeOpenAI {
			hasOpenAI = true
		}
	}
	if !hasResponses {
		t.Fatalf("GrokSubscription endpoints must include EndpointTypeOpenAIResponse, got %v", got)
	}
	if !hasOpenAI {
		t.Fatalf("GrokSubscription endpoints must include EndpointTypeOpenAI, got %v", got)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./common/ -run "TestGrokSubscription" -v`
Expected: FAIL（映射返回 `(APITypeOpenAI, false)`；端点走 default 只返回 OpenAI）

- [ ] **Step 3: 改 `common/api_type.go`**

在 `:82-83` 的 Copilot case 后追加：

```go
	case constant.ChannelTypeCopilot:
		apiType = constant.APITypeCopilot
	case constant.ChannelTypeGrokSubscription:
		apiType = constant.APITypeGrokSubscription
```

- [ ] **Step 4: 改 `common/endpoint_type.go`**

在 `:29` 的 Xai case 后追加 Grok case（与 Xai 一致，支持 OpenAI + Responses 端点）：

```go
	case constant.ChannelTypeXai:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
	case constant.ChannelTypeGrokSubscription:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}
```

- [ ] **Step 5: 运行确认通过**

Run: `go test ./common/ -run "TestGrokSubscription" -v`
Expected: PASS

- [ ] **Step 6: 运行包回归**

Run: `go test ./common/`
Expected: ok（全绿，与 baseline 一致）

- [ ] **Step 7: Commit**

```bash
git add common/api_type.go common/endpoint_type.go common/api_type_test.go common/endpoint_type_test.go
git commit -m "feat(grok): map channel type to APIType and Responses endpoint"
```

### Task 3: 版本化 OAuth 凭证 JSON（解析/序列化/校验）

设计 §6.1。凭证只接受版本化 JSON，`version`+`type` 精确匹配，未知版本 fail closed。这是纯逻辑单元，无 DB/网络依赖，优先做。

**Files:**
- Create: `relay/channel/groksubscription/credential.go`
- Test: `relay/channel/groksubscription/credential_test.go`

- [ ] **Step 1: 写失败测试**

```go
package groksubscription

import "testing"

func TestParseCredential_ValidV1(t *testing.T) {
	raw := `{"version":1,"type":"grok_subscription","access_token":"at","refresh_token":"rt","token_type":"Bearer","expires_at":1786900000}`
	cred, err := ParseCredential(raw)
	if err != nil {
		t.Fatalf("ParseCredential valid v1 err = %v", err)
	}
	if cred.AccessToken != "at" || cred.RefreshToken != "rt" || cred.ExpiresAt != 1786900000 {
		t.Fatalf("parsed fields wrong: %+v", cred)
	}
}

func TestParseCredential_UnknownVersionFailsClosed(t *testing.T) {
	raw := `{"version":2,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	if _, err := ParseCredential(raw); err == nil {
		t.Fatalf("unknown version must fail closed, got nil err")
	}
}

func TestParseCredential_WrongTypeRejected(t *testing.T) {
	raw := `{"version":1,"type":"api_key","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	if _, err := ParseCredential(raw); err == nil {
		t.Fatalf("wrong type must be rejected")
	}
}

func TestParseCredential_MissingRequiredRejected(t *testing.T) {
	// access_token / token_type / expires_at 必填
	for _, raw := range []string{
		`{"version":1,"type":"grok_subscription","token_type":"Bearer","expires_at":1786900000}`,
		`{"version":1,"type":"grok_subscription","access_token":"at","expires_at":1786900000}`,
		`{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer"}`,
	} {
		if _, err := ParseCredential(raw); err == nil {
			t.Fatalf("missing required field must be rejected: %s", raw)
		}
	}
}

func TestParseCredential_MissingRefreshRequiresNonRefreshable(t *testing.T) {
	// 无 refresh_token 时合法，但调用方须据此置 non_refreshable（见状态表任务）
	raw := `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	cred, err := ParseCredential(raw)
	if err != nil {
		t.Fatalf("missing refresh should still parse: %v", err)
	}
	if cred.RefreshToken != "" {
		t.Fatalf("expected empty refresh token")
	}
	if cred.IsRefreshable() {
		t.Fatalf("IsRefreshable must be false when refresh_token empty")
	}
}

func TestSerializeRoundTrip(t *testing.T) {
	cred := Credential{Version: 1, Type: CredentialType, AccessToken: "at", RefreshToken: "rt", TokenType: "Bearer", ExpiresAt: 1786900000}
	s, err := cred.Serialize()
	if err != nil {
		t.Fatalf("serialize err %v", err)
	}
	got, err := ParseCredential(s)
	if err != nil {
		t.Fatalf("reparse err %v", err)
	}
	if got != cred {
		t.Fatalf("round trip mismatch: %+v vs %+v", got, cred)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestParseCredential -v`
Expected: FAIL（包不存在/`ParseCredential` undefined）

- [ ] **Step 3: 写实现**

```go
package groksubscription

import (
	"encoding/json"
	"errors"
	"strings"
)

// CredentialType 是版本化凭证 JSON 的 type 判别值，必须精确匹配。
const CredentialType = "grok_subscription"

// CredentialVersion 是当前唯一受支持的凭证版本；未知版本 fail closed。
const CredentialVersion = 1

// Credential 是持久化在 Channel.Key 里的版本化 OAuth 凭证。
// 只有 access_token / refresh_token 是账号秘密；不含 email / 密码 / SSO / verifier。
type Credential struct {
	Version      int    `json:"version"`
	Type         string `json:"type"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresAt    int64  `json:"expires_at"`
}

// ParseCredential 解析并严格校验版本化凭证 JSON。
func ParseCredential(raw string) (Credential, error) {
	var c Credential
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return c, errors.New("grok credential: empty")
	}
	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return Credential{}, errors.New("grok credential: invalid JSON")
	}
	if c.Version != CredentialVersion {
		return Credential{}, errors.New("grok credential: unsupported version")
	}
	if c.Type != CredentialType {
		return Credential{}, errors.New("grok credential: unexpected type")
	}
	if strings.TrimSpace(c.AccessToken) == "" {
		return Credential{}, errors.New("grok credential: access_token required")
	}
	if strings.TrimSpace(c.TokenType) == "" {
		return Credential{}, errors.New("grok credential: token_type required")
	}
	if c.ExpiresAt <= 0 {
		return Credential{}, errors.New("grok credential: expires_at required")
	}
	return c, nil
}

// Serialize 输出规范化的版本化 JSON。
func (c Credential) Serialize() (string, error) {
	c.Version = CredentialVersion
	c.Type = CredentialType
	b, err := json.Marshal(c)
	if err != nil {
		return "", errors.New("grok credential: serialize failed")
	}
	return string(b), nil
}

// IsRefreshable 表示凭证是否带有可用于刷新的 refresh token。
func (c Credential) IsRefreshable() bool {
	return strings.TrimSpace(c.RefreshToken) != ""
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -v`
Expected: PASS（全部凭证测试绿）

- [ ] **Step 5: Commit**

```bash
git add relay/channel/groksubscription/credential.go relay/channel/groksubscription/credential_test.go
git commit -m "feat(grok): versioned OAuth credential parse/serialize with fail-closed validation"
```

### Task 4: 固定常量、host guard 与 adaptor 骨架 + 注册

设计 §5.1、§7、§8.1、§8.2。里程碑 A 只连 CLI proxy（文本），媒体 host 常量先定义但 adaptor 拒绝媒体端点。adaptor 以 `xai.Adaptor` 为参照（薄封装，支持 Responses），加 credential provider、CLI identity headers、host guard。

**Files:**
- Create: `relay/channel/groksubscription/constants.go`
- Create: `relay/channel/groksubscription/host_guard.go`
- Create: `relay/channel/groksubscription/adaptor.go`
- Modify: `relay/relay_adaptor.go:18`（import）、`:149-150` 后（GetAdaptor case）
- Test: `relay/channel/groksubscription/host_guard_test.go`、`relay/relay_adaptor_test.go`（追加）

- [ ] **Step 1: 写常量文件**

```go
package groksubscription

// 固定 OAuth 参数（设计 §7）。
const (
	OAuthIssuer    = "https://auth.x.ai"
	OAuthAuthorize = "https://auth.x.ai/oauth2/authorize"
	OAuthToken     = "https://auth.x.ai/oauth2/token"
	OAuthClientID  = "b1a00492-073a-47ea-816f-4c329264a828"
	OAuthScope     = "openid profile email offline_access grok-cli:access api:access"
)

// 固定上游 host（设计 §8.1）。里程碑 A 只用 CLI proxy 做文本。
const (
	HostAuth      = "auth.x.ai"
	HostAccounts  = "accounts.x.ai"
	HostCLIProxy  = "cli-chat-proxy.grok.com"
	HostAPI       = "api.x.ai"
	HostAPIUSEast = "us-east-1.api.x.ai"
	HostAPIUSWest = "us-west-2.api.x.ai"
	HostAPIEUWest = "eu-west-1.api.x.ai"
)

// CLI proxy base 与 responses 路径。
const (
	CLIProxyBase     = "https://cli-chat-proxy.grok.com"
	CLIResponsesPath = "/v1/responses"
)

// CLI identity headers（设计 §8.2）。仅发往 CLI proxy。
const (
	CLIClientVersionDefault = "0.2.114"
	CLIClientVersionMin     = "0.2.93"
	HeaderXAITokenAuth      = "X-XAI-Token-Auth"
	HeaderXAITokenAuthValue = "xai-grok-cli"
	HeaderGrokClientVersion = "x-grok-client-version"
	HeaderGrokClientID      = "x-grok-client-identifier"
	GrokClientIDValue       = "grok-shell"
	CLIUserAgentPrefix      = "xai-grok-workspace/"
)

// ChannelName 用于 adaptor 标识。
const ChannelName = "grok_subscription"

// DefaultModelList 首次创建渠道时的已知 Grok 默认模型（DB 渠道模型列表仍是最终路由依据，设计 §5.3）。
var DefaultModelList = []string{
	"grok-4",
	"grok-4-fast",
	"grok-3",
	"grok-3-mini",
}
```

- [ ] **Step 2: 写 host guard 失败测试**

```go
package groksubscription

import "testing"

func TestIsAllowedTextHost(t *testing.T) {
	if !IsAllowedTextHost(HostCLIProxy) {
		t.Fatalf("cli proxy host must be allowed for text")
	}
	for _, bad := range []string{"evil.com", "cli-chat-proxy.grok.com.evil.com", "api.x.ai.attacker.net", ""} {
		if IsAllowedTextHost(bad) {
			t.Fatalf("host %q must not be allowed", bad)
		}
	}
}

func TestIsAllowedUpstreamHost(t *testing.T) {
	for _, ok := range []string{HostAuth, HostAccounts, HostCLIProxy, HostAPI, HostAPIUSEast, HostAPIUSWest, HostAPIEUWest} {
		if !IsAllowedUpstreamHost(ok) {
			t.Fatalf("host %q must be allowed", ok)
		}
	}
	for _, bad := range []string{"grok.com", "x.ai", "notapi.x.ai", "api.x.ai:8080"} {
		if IsAllowedUpstreamHost(bad) {
			t.Fatalf("host %q must not be allowed", bad)
		}
	}
}
```

- [ ] **Step 3: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run "TestIsAllowed" -v`
Expected: FAIL（`IsAllowedTextHost` undefined）

- [ ] **Step 4: 写 host guard 实现**

```go
package groksubscription

// allowedUpstreamHosts 是完整 host allowlist（设计 §8.1）。
// api.yescaptcha.com 仅密码功能开启时用，由 service 层单独校验，不在通用 allowlist。
var allowedUpstreamHosts = map[string]struct{}{
	HostAuth:      {},
	HostAccounts:  {},
	HostCLIProxy:  {},
	HostAPI:       {},
	HostAPIUSEast: {},
	HostAPIUSWest: {},
	HostAPIEUWest: {},
}

// IsAllowedUpstreamHost 精确匹配（含端口视为不同 host，拒绝）。
func IsAllowedUpstreamHost(host string) bool {
	_, ok := allowedUpstreamHosts[host]
	return ok
}

// IsAllowedTextHost 里程碑 A 文本只允许 CLI proxy。
func IsAllowedTextHost(host string) bool {
	return host == HostCLIProxy
}
```

- [ ] **Step 5: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run "TestIsAllowed" -v`
Expected: PASS

- [ ] **Step 6: 写 adaptor 骨架**

参照 `relay/channel/xai/adaptor.go`（薄封装、支持 Responses）与 `relay/channel/copilot/adaptor.go`（credential 前缀校验、CLI headers）。里程碑 A 只放行 Responses/Chat/Claude 三个文本 RelayMode；媒体端点返回 `errUnsupportedEndpoint`（里程碑 B 再实现）。credential 从 `info.ApiKey`（= Channel.Key）解析版本化 JSON 取 access_token。

```go
package groksubscription

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var errUnsupportedEndpoint = errors.New("grok subscription channel: endpoint not supported")

// Adaptor 是 Grok Subscription 渠道适配器。里程碑 A 仅文本（CLI proxy）。
type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL 里程碑 A：文本全部落 CLI proxy 的 /v1/responses（Chat/Claude 经 bridge 转 Responses）。
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info == nil {
		return "", errUnsupportedEndpoint
	}
	switch info.RelayMode {
	case relayconstant.RelayModeResponses, relayconstant.RelayModeChatCompletions:
		return CLIProxyBase + CLIResponsesPath, nil
	default:
		if info.RelayFormat == types.RelayFormatClaude {
			return CLIProxyBase + CLIResponsesPath, nil
		}
		return "", errUnsupportedEndpoint
	}
}

// SetupRequestHeader 注入 OAuth Bearer + CLI identity（仅 CLI proxy）。
// credential 提供逻辑在 Task 8（刷新 lease）接入；此处先解析版本化 JSON 取 access_token。
func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if c == nil || info == nil || info.ChannelMeta == nil {
		return errors.New("grok subscription channel: invalid relay context")
	}
	cred, err := ParseCredential(info.ApiKey)
	if err != nil {
		return fmt.Errorf("grok subscription channel: %w", err)
	}
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+cred.AccessToken)
	// CLI identity 仅发往 CLI proxy。
	header.Set(HeaderXAITokenAuth, HeaderXAITokenAuthValue)
	header.Set(HeaderGrokClientVersion, CLIClientVersion())
	header.Set(HeaderGrokClientID, GrokClientIDValue)
	header.Set("User-Agent", CLIUserAgentPrefix+CLIClientVersion())
	header.Set("X-Request-Id", common.GetUUID())
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if request.Model == "" && info != nil {
		request.Model = info.UpstreamModelName
	}
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	// Claude 经 NewAPI Claude->Responses bridge，Grok 不在 adaptor 直接透传 Claude。
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeResponses:
		if info.IsStream {
			return openai.OaiResponsesStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesHandler(c, info, resp)
	default:
		if info.IsStream {
			return openai.OaiStreamHandler(c, info, resp)
		}
		return openai.OpenaiHandler(c, info, resp)
	}
}

func (a *Adaptor) GetModelList() []string { return DefaultModelList }
func (a *Adaptor) GetChannelName() string { return ChannelName }

// 里程碑 A 不支持的能力（里程碑 B 实现）。
func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
```

同时在 `constants.go` 追加 CLI 版本解析（校验 semver 且 >= 0.2.93，非法回退固定值）：

```go
import "os"

// CLIClientVersion 读环境变量覆盖，校验 semver 且不低于 CLIClientVersionMin，非法回退默认。
func CLIClientVersion() string {
	v := os.Getenv("GROK_CLI_CLIENT_VERSION")
	if isValidCLIVersion(v) {
		return v
	}
	return CLIClientVersionDefault
}

func isValidCLIVersion(v string) bool {
	// 见 Task 4 Step 8 的 semver 校验测试
	return compareSemver(v, CLIClientVersionMin) >= 0
}
```

> **注意**：`compareSemver` 需实现并单测（合法 semver 且 `>=0.2.93`；空串/非法/低版本回退默认）。为紧凑此处不展开，实现时在 `constants.go` 加一个仅接受 `MAJOR.MINOR.PATCH` 三段非负整数的比较函数，并在 `constants_test.go` 覆盖 `"0.2.114"`（通过）、`"0.2.92"`（回退）、`"0.3"`（非法回退）、`""`（回退）。

- [ ] **Step 7: 在 GetAdaptor 注册 adaptor**

`relay/relay_adaptor.go` import 块（`:18` copilot 之后）加：

```go
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
```

`GetAdaptor` 的 `case constant.APITypeXai:`（`:149-150`）之后加：

```go
	case constant.APITypeXai:
		return &xai.Adaptor{}
	case constant.APITypeGrokSubscription:
		return &groksubscription.Adaptor{}
```

- [ ] **Step 8: 写 adaptor 注册测试**

`relay/relay_adaptor_test.go` 追加：

```go
func TestGetAdaptorGrokSubscription(t *testing.T) {
	adaptor := GetAdaptor(constant.APITypeGrokSubscription)
	if adaptor == nil {
		t.Fatalf("GetAdaptor(APITypeGrokSubscription) = nil")
	}
	if got := adaptor.GetChannelName(); got != "grok_subscription" {
		t.Fatalf("channel name = %q, want grok_subscription", got)
	}
}
```

- [ ] **Step 9: 运行 + 编译核验**

Run: `go build ./... 2>&1 | grep -v "web/classic/dist"` （应无输出，仅既有 embed 错误）
Run: `go test ./relay/channel/groksubscription/ -v && go test ./relay/ -run TestGetAdaptorGrok -v`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add relay/channel/groksubscription/ relay/relay_adaptor.go relay/relay_adaptor_test.go
git commit -m "feat(grok): fixed constants, host guard, text adaptor skeleton + registration"
```

### Task 4.5: Chat 客户端 stream 意图与上游强制流式解耦（C1 修复）

**背景（C1，代码质量评审确认的真实缺陷）：**
CLI proxy 只暴露 `/v1/responses`，且 `pkg/apicompat.ChatCompletionsToResponses` 恒置 `Stream=true`，所以上游永远回 `text/event-stream`。`relay/compatible_handler.go:241` 会据此把 `info.IsStream` 无条件抬成 `true`。Task 4 的 `DoResponse` 在 `RelayModeChatCompletions` 分支用 `info.IsStream` 判定回写形式 —— 于是**永远**走流式 handler：一个发了 `stream:false` 的客户端仍会收到 `chat.completion.chunk` SSE + `[DONE]`（SDK 解析失败），非流式分支 `OaiResponsesToChatHandler` 成为死代码（且即便到达也会因为拿到 SSE body 而解析失败）。

**修复思路（对齐 Codex 的 `RelayChatOverCodex`）：**
用客户端原始 stream 意图 `info.UserWantsStream`（`relay/common/relay_info.go:101` 既有顶层字段）而非 `info.IsStream` 决定回写形式：
- `UserWantsStream==true`：沿用已验证的 `openai.OaiResponsesToChatStreamHandler`（逐事件转 Chat SSE chunk，行为不变）。
- `UserWantsStream==false`：新增聚合器，缓冲 Responses SSE，用 apicompat 公共累加器合并成单个 Chat JSON 回写。

**Files:**
- Create: `relay/channel/groksubscription/chat_response_bridge.go`
- Create: `relay/channel/groksubscription/chat_response_bridge_test.go`
- Modify: `relay/channel/groksubscription/adaptor.go`（`ConvertOpenAIRequest` 记录 `UserWantsStream`；`DoResponse` 的 Chat 分支改调 `RelayChatOverGrok`）

- [ ] **Step 1: 写聚合器失败测试（非流式 Chat 必须得到单个 JSON，绝不是 SSE）**

```go
package groksubscription

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// grokResponsesSSE 是一段最小但完整的 Responses SSE：created → 文本增量 → completed（带 usage 与完整 output）。
const grokResponsesSSE = "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\"}}\n\n" +
	"data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\n\n" +
	"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"model\":\"grok-4\",\"status\":\"completed\",\"usage\":{\"input_tokens\":5,\"output_tokens\":1,\"total_tokens\":6},\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello\"}]}]}}\n\n"

func newSSEResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// TestRelayChatOverGrok_NonStreamAggregatesToJSON 锁住 C1 修复：客户端 stream=false
// 时，即便上游是 SSE，也必须聚合成单个 chat.completion JSON，绝不能回 SSE / [DONE]。
func TestRelayChatOverGrok_NonStreamAggregatesToJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: false,
	}
	if _, apiErr := RelayChatOverGrok(c, info, newSSEResponse(grokResponsesSSE)); apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}

	out := rec.Body.String()
	if strings.Contains(out, "data:") || strings.Contains(out, "[DONE]") {
		t.Fatalf("non-stream client must NOT receive SSE; got: %s", out)
	}
	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &chatResp); err != nil {
		t.Fatalf("output must be a single Chat JSON: %v; body=%s", err, out)
	}
	if chatResp.Object != "chat.completion" {
		t.Fatalf("object = %q, want chat.completion", chatResp.Object)
	}
	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.StringContent() != "Hello" {
		t.Fatalf("aggregated content mismatch; body=%s", out)
	}
}

// TestRelayChatOverGrok_StreamStillSSE 锁住流式路径不回归：stream=true 仍回
// chat.completion.chunk SSE 且以 [DONE] 收尾。
func TestRelayChatOverGrok_StreamStillSSE(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"},
		UserWantsStream: true,
		RelayFormat:     "openai",
	}
	if _, apiErr := RelayChatOverGrok(c, info, newSSEResponse(grokResponsesSSE)); apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	out := rec.Body.String()
	if !strings.Contains(out, "chat.completion.chunk") {
		t.Fatalf("stream client must receive chat.completion.chunk; got: %s", out)
	}
	if !strings.Contains(out, "[DONE]") {
		t.Fatalf("stream must terminate with [DONE]; got: %s", out)
	}
}

// TestRelayChatOverGrok_UpstreamErrorPreservesStatus 校验上游非 200 时保留状态码。
func TestRelayChatOverGrok_UpstreamErrorPreservesStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusTooManyRequests,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(`{"error":"rate limited"}`)),
	}
	_, apiErr := RelayChatOverGrok(c, &relaycommon.RelayInfo{UserWantsStream: false}, resp)
	if apiErr == nil {
		t.Fatalf("expected error for non-200 upstream")
	}
	if apiErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 (must preserve upstream status for retry/limit signals)", apiErr.StatusCode)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestRelayChatOverGrok -v`
Expected: FAIL（`RelayChatOverGrok` undefined）

- [ ] **Step 3: 写 bridge 实现**

```go
package groksubscription

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// RelayChatOverGrok 处理 CLI proxy 返回的 Responses SSE，并按客户端原始 stream
// 意图（info.UserWantsStream）选择回写形式，与上游“恒流式”彻底解耦（修复 C1）：
//   - true:  逐事件转 Chat Completions SSE chunk（复用已验证的 openai handler）
//   - false: 聚合所有增量后一次性返回单个 chat.completion JSON
//
// 绝不能用 info.IsStream 决定：compatible_handler 会因上游 Content-Type=SSE 把它抬成 true。
func RelayChatOverGrok(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if info != nil && info.UserWantsStream {
		return openai.OaiResponsesToChatStreamHandler(c, info, resp)
	}
	return aggregateGrokResponsesToChat(c, info, resp)
}

// aggregateGrokResponsesToChat 缓冲 Responses SSE，合并成单个 Chat JSON 回写。
func aggregateGrokResponsesToChat(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return buildGrokUsage(nil), types.NewError(errors.New("grok subscription channel: nil upstream response"), types.ErrorCodeBadResponse)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		// 必须保留上游状态码，否则上层重试/限流策略失去信号（429/5xx 不再退避或切换）。
		return buildGrokUsage(nil), types.NewErrorWithStatusCode(
			fmt.Errorf("grok subscription channel: upstream status %d: %s", resp.StatusCode, string(body)),
			types.ErrorCodeBadResponse, resp.StatusCode)
	}
	defer func() { _ = resp.Body.Close() }()

	acc := apicompat.NewBufferedResponseAccumulator()
	var lastUsage *apicompat.ResponsesUsage
	var lastTerminal *apicompat.ResponsesResponse
	var terminalSeen bool
	var terminalErr *types.NewAPIError

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var dataLines []string
	flushEvent := func() bool {
		if len(dataLines) == 0 {
			return false
		}
		payload := strings.Join(dataLines, "\n")
		dataLines = dataLines[:0]
		evt := &apicompat.ResponsesStreamEvent{}
		if err := common.Unmarshal([]byte(payload), evt); err != nil {
			return false
		}
		acc.ProcessEvent(evt)

		isFailed := evt.Type == "response.failed" || (evt.Response != nil && evt.Response.Status == "failed")
		if isFailed {
			terminalSeen = true
			terminalErr = grokResponseFailedError(evt)
			if evt.Response != nil && evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			return true
		}

		isTerminal := evt.Type == "response.completed" ||
			evt.Type == "response.done" ||
			evt.Type == "response.incomplete"
		if isTerminal && evt.Response != nil {
			if evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			lastTerminal = evt.Response
			terminalSeen = true
			return true
		}
		return false
	}

	stop := false
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if flushEvent() {
				stop = true
				break
			}
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if !stop {
		_ = flushEvent()
	}

	if terminalErr != nil {
		return buildGrokUsage(lastUsage), terminalErr
	}
	if scanErr := scanner.Err(); scanErr != nil {
		common.SysError(fmt.Sprintf("grok chat bridge: SSE scan error: %v", scanErr))
		return buildGrokUsage(lastUsage), types.NewErrorWithStatusCode(
			fmt.Errorf("grok subscription channel: SSE scan error: %v", scanErr),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	if !terminalSeen {
		return buildGrokUsage(lastUsage), types.NewErrorWithStatusCode(
			errors.New("grok subscription channel: upstream stream ended before a terminal event"),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	full := &apicompat.ResponsesResponse{}
	acc.SupplementResponseOutput(full)
	if lastTerminal != nil {
		full.Status = lastTerminal.Status
		full.IncompleteDetails = lastTerminal.IncompleteDetails
		full.Error = lastTerminal.Error
	} else {
		full.Status = "completed"
	}
	full.Usage = lastUsage

	upstreamModel := ""
	if info != nil && info.ChannelMeta != nil {
		upstreamModel = info.UpstreamModelName
	}
	chatResp := apicompat.ResponsesToChatCompletions(full, upstreamModel)
	c.JSON(http.StatusOK, chatResp)
	return buildGrokUsage(lastUsage), nil
}

func grokResponseFailedError(evt *apicompat.ResponsesStreamEvent) *types.NewAPIError {
	message := "grok upstream response failed"
	if evt != nil {
		if evt.Response != nil && evt.Response.Error != nil {
			switch {
			case strings.TrimSpace(evt.Response.Error.Message) != "":
				message = evt.Response.Error.Message
			case strings.TrimSpace(evt.Response.Error.Code) != "":
				message = evt.Response.Error.Code
			}
		} else if strings.TrimSpace(evt.Code) != "" {
			message = evt.Code
		}
	}
	return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusInternalServerError)
}

// buildGrokUsage 把 Responses usage 翻译成 *dto.Usage，始终 non-nil（缺失时零值占位）。
func buildGrokUsage(u *apicompat.ResponsesUsage) *dto.Usage {
	out := &dto.Usage{}
	if u == nil {
		return out
	}
	out.PromptTokens = u.InputTokens
	out.CompletionTokens = u.OutputTokens
	out.TotalTokens = u.TotalTokens
	out.InputTokens = u.InputTokens
	out.OutputTokens = u.OutputTokens
	if out.TotalTokens == 0 && (out.PromptTokens != 0 || out.CompletionTokens != 0) {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if u.InputTokensDetails != nil {
		out.PromptTokensDetails = dto.InputTokenDetails{
			CachedTokens:     u.InputTokensDetails.CachedTokens,
			CacheWriteTokens: u.InputTokensDetails.CacheWriteTokens,
		}
		if u.InputTokensDetails.CachedTokens > 0 {
			out.PromptCacheHitTokens = u.InputTokensDetails.CachedTokens
		}
	}
	if u.OutputTokensDetails != nil {
		out.CompletionTokenDetails = dto.OutputTokenDetails{
			ReasoningTokens: u.OutputTokensDetails.ReasoningTokens,
		}
	}
	return out
}
```

> **注意**：`aggregateGrokResponsesToChat` 的 SSE 扫描结构刻意对齐 `relay/channel/codex/chat_bridge.go` 的 `RelayChatOverCodex`（同仓库同许可，非 sub2api 代码），去掉了 Codex 特有的 fingerprint / store 约束。若字段名（`apicompat.ResponsesUsage.InputTokensDetails.CacheWriteTokens` 等）与仓库当前版本不符，以 codex 包实际使用为准。

- [ ] **Step 4: 改 `ConvertOpenAIRequest` 记录客户端 stream 意图**

`adaptor.go` 的 `ConvertOpenAIRequest` 开头（`chatCompletionsRequestToResponsesBody` 之前）加入（对齐 Codex `adaptor.go:69-76`）：

```go
	// 记录客户端 stream 意图（上游 CLI proxy 强制流式，与此解耦；C1 修复）。
	if info != nil {
		if request != nil && request.Stream != nil {
			info.UserWantsStream = *request.Stream
		} else {
			info.UserWantsStream = false
		}
	}
```

- [ ] **Step 5: 改 `DoResponse` 的 Chat 分支改调 `RelayChatOverGrok`**

把 `adaptor.go` `DoResponse` 中的：

```go
	case relayconstant.RelayModeChatCompletions:
		// 上游（CLI proxy）返回 Responses 格式，用共享 Responses→Chat handler 转回
		// Chat Completions（与 ConvertOpenAIRequest 的 Chat→Responses 转换对称）。
		if info.IsStream {
			return openai.OaiResponsesToChatStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesToChatHandler(c, info, resp)
```

替换为：

```go
	case relayconstant.RelayModeChatCompletions:
		// 上游（CLI proxy）恒返回 Responses SSE；用客户端原始 stream 意图
		// （info.UserWantsStream）而非 info.IsStream 决定回写形式（C1 修复）。
		return RelayChatOverGrok(c, info, resp)
```

- [ ] **Step 6: 运行 + gofmt + 全量测试**

Run: `gofmt -l relay/channel/groksubscription/`（应无输出）
Run: `go test ./relay/channel/groksubscription/ -v`
Expected: PASS（含 3 个新 `TestRelayChatOverGrok*`；原有测试不回归）

- [ ] **Step 7: Commit**

```bash
git add relay/channel/groksubscription/chat_response_bridge.go relay/channel/groksubscription/chat_response_bridge_test.go relay/channel/groksubscription/adaptor.go
git commit -m "fix(grok): decouple Chat client stream intent from upstream forced streaming"
```

### Task 5: Grok AuthFlow 一次性 PKCE 状态表

设计 §6.2、§7.1、§18。Grok 专用独立表，跨节点 owner-token claim、10 分钟过期、verifier 加密。不迁移 Copilot/Codex 现有机制。

**Files:**
- Create: `model/grok_auth_flow.go`
- Create: `service/grok_credential_cipher.go`（照 `service/byteplus_sensitive_cipher.go`）
- Test: `model/grok_auth_flow_test.go`、`service/grok_credential_cipher_test.go`

- [ ] **Step 1: 写 cipher 失败测试**（照 byteplus 模式，独立 env key + AAD 命名空间）

```go
package service

import "testing"

func TestGrokCipherRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	cipher, err := newGrokCredentialCipher(key, deterministicReader())
	if err != nil {
		t.Fatalf("new cipher err %v", err)
	}
	envelope, err := cipher.Encrypt("flow-123", "pkce_verifier", "the-verifier")
	if err != nil {
		t.Fatalf("encrypt err %v", err)
	}
	got, err := cipher.Decrypt("flow-123", "pkce_verifier", envelope)
	if err != nil {
		t.Fatalf("decrypt err %v", err)
	}
	if got != "the-verifier" {
		t.Fatalf("round trip = %q", got)
	}
	// AAD 绑定：换 flowID 解密必须失败
	if _, err := cipher.Decrypt("flow-999", "pkce_verifier", envelope); err == nil {
		t.Fatalf("decrypt with wrong sessionID must fail (AAD mismatch)")
	}
}
```

> `deterministicReader()` 是测试辅助，返回固定字节的 `io.Reader` 供 nonce 使用（可 `bytes.NewReader(make([]byte, 64))`）。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./service/ -run TestGrokCipher -v`
Expected: FAIL（`newGrokCredentialCipher` undefined）

- [ ] **Step 3: 写 cipher 实现**（复制 `byteplus_sensitive_cipher.go` 的 AES-GCM 结构，改 env 名与 AAD 命名空间，字段白名单换成 Grok 的 `pkce_verifier`）

```go
package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

const grokCredentialCipherEnv = "GROK_CREDENTIAL_CIPHER_KEY"

const grokSensitiveFieldPKCEVerifier = "pkce_verifier"

type GrokCredentialCipher interface {
	Encrypt(sessionID, field, plaintext string) (string, error)
	Decrypt(sessionID, field, envelope string) (string, error)
}

type grokCredentialCipher struct {
	aead   cipher.AEAD
	random io.Reader
}

func newGrokCredentialCipher(key []byte, random io.Reader) (GrokCredentialCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("grok credential cipher key must be 32 bytes")
	}
	if random == nil {
		return nil, errors.New("grok credential cipher random reader is required")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, errors.New("grok credential cipher initialization failed")
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New("grok credential cipher initialization failed")
	}
	return &grokCredentialCipher{aead: aead, random: random}, nil
}

func loadGrokCredentialCipherFromEnv() (GrokCredentialCipher, error) {
	encoded := strings.TrimSpace(os.Getenv(grokCredentialCipherEnv))
	if encoded == "" {
		return nil, errors.New("grok credential cipher key is invalid")
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) != 32 {
		return nil, errors.New("grok credential cipher key is invalid")
	}
	return newGrokCredentialCipher(key, rand.Reader)
}

func grokSensitiveAAD(sessionID, field string) []byte {
	return []byte("grok-subscription:v1:" + sessionID + ":" + field)
}

func (c *grokCredentialCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if !isValidGrokSensitiveContext(sessionID, field) || plaintext == "" {
		return "", errors.New("grok credential cipher inputs are required")
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(c.random, nonce); err != nil {
		return "", errors.New("grok credential cipher nonce generation failed")
	}
	ciphertext := c.aead.Seal(nil, nonce, []byte(plaintext), grokSensitiveAAD(sessionID, field))
	payload := append(append([]byte{}, nonce...), ciphertext...)
	return "v1:" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func (c *grokCredentialCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	if !isValidGrokSensitiveContext(sessionID, field) {
		return "", errors.New("grok credential cipher inputs are required")
	}
	if !strings.HasPrefix(envelope, "v1:") {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(envelope, "v1:"))
	if err != nil || len(payload) <= c.aead.NonceSize() {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	nonce := payload[:c.aead.NonceSize()]
	ciphertext := payload[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, grokSensitiveAAD(sessionID, field))
	if err != nil {
		return "", errors.New("grok credential cipher envelope is invalid")
	}
	return string(plaintext), nil
}

func isValidGrokSensitiveContext(sessionID, field string) bool {
	if sessionID == "" || len(sessionID) > 64 || field != grokSensitiveFieldPKCEVerifier {
		return false
	}
	for i := 0; i < len(sessionID); i++ {
		ch := sessionID[i]
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' {
			continue
		}
		return false
	}
	return true
}
```

- [ ] **Step 4: 运行 cipher 通过**

Run: `go test ./service/ -run TestGrokCipher -v`
Expected: PASS

- [ ] **Step 5: 写 AuthFlow 模型失败测试**

```go
package model

import "testing"

func TestGrokAuthFlowLifecycle(t *testing.T) {
	setupTestDB(t) // 复用包内测试 DB helper；若无则用 sqlite in-memory
	flow := &GrokAuthFlow{
		Provider:            "grok_subscription",
		AdminID:             1,
		ChannelID:           42,
		StateHash:           "statehash",
		EncryptedVerifier:   "v1:abc",
		RedirectURI:         "https://example/callback",
		ExpiresAt:           GetDBTimestamp() + 600,
	}
	if err := CreateGrokAuthFlow(flow); err != nil {
		t.Fatalf("create err %v", err)
	}
	// claim 一次成功
	claimed, ok, err := ClaimGrokAuthFlow(flow.FlowID, "owner-token-1")
	if err != nil || !ok {
		t.Fatalf("first claim must succeed, ok=%v err=%v", ok, err)
	}
	if claimed.ChannelID != 42 {
		t.Fatalf("claimed channel = %d", claimed.ChannelID)
	}
	// 再次 claim（不同 owner）必须失败（一次性）
	if _, ok2, _ := ClaimGrokAuthFlow(flow.FlowID, "owner-token-2"); ok2 {
		t.Fatalf("second claim must fail (one-time)")
	}
	// consume 删除
	if err := ConsumeGrokAuthFlow(flow.FlowID, "owner-token-1"); err != nil {
		t.Fatalf("consume err %v", err)
	}
	if _, ok3, _ := ClaimGrokAuthFlow(flow.FlowID, "owner-token-1"); ok3 {
		t.Fatalf("claim after consume must fail")
	}
}

func TestGrokAuthFlowRejectsExpired(t *testing.T) {
	setupTestDB(t)
	flow := &GrokAuthFlow{Provider: "grok_subscription", AdminID: 1, ChannelID: 7, StateHash: "s", EncryptedVerifier: "v1:x", ExpiresAt: GetDBTimestamp() - 1}
	if err := CreateGrokAuthFlow(flow); err != nil {
		t.Fatalf("create err %v", err)
	}
	if _, ok, _ := ClaimGrokAuthFlow(flow.FlowID, "owner"); ok {
		t.Fatalf("expired flow must not be claimable")
	}
}
```

- [ ] **Step 6: 运行确认失败**

Run: `go test ./model/ -run TestGrokAuthFlow -v`
Expected: FAIL（`GrokAuthFlow` undefined）

- [ ] **Step 7: 写 AuthFlow 模型实现**

```go
package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GrokAuthFlow 是 Grok 专用的一次性 PKCE 认证状态（设计 §7.1）。
// 独立于 Copilot 的 Redis+内存 fallback 与 Codex 的 gin session；跨节点、owner-token claim、10 分钟过期。
type GrokAuthFlow struct {
	FlowID            string `json:"flow_id" gorm:"primaryKey;type:varchar(64)"`
	Provider          string `json:"provider" gorm:"type:varchar(32);index"`
	AdminID           int    `json:"admin_id" gorm:"index"`
	ChannelID         int    `json:"channel_id" gorm:"index"`
	StateHash         string `json:"state_hash" gorm:"type:varchar(128)"`
	EncryptedVerifier string `json:"-" gorm:"type:text"`
	RedirectURI       string `json:"redirect_uri" gorm:"type:varchar(512)"`
	OwnerToken        string `json:"-" gorm:"type:varchar(128)"`
	CreatedAt         int64  `json:"created_at"`
	ExpiresAt         int64  `json:"expires_at" gorm:"index"`
}

func (GrokAuthFlow) TableName() string { return "grok_auth_flows" }

// CreateGrokAuthFlow 生成 FlowID 并落库。
func CreateGrokAuthFlow(flow *GrokAuthFlow) error {
	if flow == nil {
		return errors.New("grok auth flow: nil")
	}
	if flow.FlowID == "" {
		flow.FlowID = common.GetUUID()
	}
	if flow.CreatedAt == 0 {
		flow.CreatedAt = GetDBTimestamp()
	}
	return DB.Create(flow).Error
}

// ClaimGrokAuthFlow 原子抢占未过期、未被 claim 的 flow。返回 (flow, claimed, err)。
// 一次性：成功 claim 后 owner_token 被写入，其他 owner 无法再 claim。
func ClaimGrokAuthFlow(flowID, ownerToken string) (*GrokAuthFlow, bool, error) {
	if flowID == "" || ownerToken == "" {
		return nil, false, errors.New("grok auth flow: empty flowID/ownerToken")
	}
	now := GetDBTimestamp()
	var claimed *GrokAuthFlow
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 条件更新：仅当未过期且 owner_token 为空（或已是本 owner，幂等）时写入 owner。
		res := tx.Model(&GrokAuthFlow{}).
			Where("flow_id = ? AND expires_at > ? AND (owner_token = '' OR owner_token = ?)", flowID, now, ownerToken).
			Update("owner_token", ownerToken)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil // 未 claim 到
		}
		var f GrokAuthFlow
		if err := tx.Where("flow_id = ? AND owner_token = ?", flowID, ownerToken).First(&f).Error; err != nil {
			return err
		}
		claimed = &f
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return claimed, claimed != nil, nil
}

// ConsumeGrokAuthFlow 仅 owner 可删除（成功/失败终态/过期）。
func ConsumeGrokAuthFlow(flowID, ownerToken string) error {
	return DB.Where("flow_id = ? AND owner_token = ?", flowID, ownerToken).Delete(&GrokAuthFlow{}).Error
}
```

> **实现注意**：`setupTestDB(t)` 若 model 包无现成 helper，用 sqlite in-memory 建表：`DB, _ = gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{}); DB.AutoMigrate(&GrokAuthFlow{})`。检查 model 包内既有测试（如 `copilot_channel_test.go`）用的初始化方式并复用。

- [ ] **Step 8: 运行确认通过**

Run: `go test ./model/ -run TestGrokAuthFlow -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add model/grok_auth_flow.go model/grok_auth_flow_test.go service/grok_credential_cipher.go service/grok_credential_cipher_test.go
git commit -m "feat(grok): AuthFlow one-time PKCE state table + PKCE verifier cipher"
```

### Task 6: 非秘密 Grok 渠道状态表 + migration 注册

设计 §6.3。按 `channel_id` 唯一的**非秘密**状态快照：认证状态、billing plan 名、quota 快照、刷新 lease owner + 到期。**绝不存 token/verifier/密码**（那些在 Channel.Key 加密 JSON 与 AuthFlow 里）。同时在 `model/main.go` 注册 `GrokAuthFlow` 与 `GrokChannelState` 两张表。

**Files:**
- Create: `model/grok_channel_state.go`
- Modify: `model/main.go:411`（slice 末尾插入两张表）
- Test: `model/grok_channel_state_test.go`

- [ ] **Step 1: 写失败测试**

```go
package model

import "testing"

func TestGrokChannelStateUpsert(t *testing.T) {
	setupTestDB(t)
	st := &GrokChannelState{
		ChannelID:    42,
		AuthStatus:   GrokAuthStatusActive,
		BillingPlan:  "SuperGrok",
		QuotaSnapshot: `{"remaining":100}`,
		UpdatedAt:    GetDBTimestamp(),
	}
	if err := UpsertGrokChannelState(st); err != nil {
		t.Fatalf("upsert insert err %v", err)
	}
	// 再次 upsert 同 channel 覆盖，不产生第二行
	st.AuthStatus = GrokAuthStatusNeedsReauth
	if err := UpsertGrokChannelState(st); err != nil {
		t.Fatalf("upsert update err %v", err)
	}
	got, err := GetGrokChannelState(42)
	if err != nil {
		t.Fatalf("get err %v", err)
	}
	if got.AuthStatus != GrokAuthStatusNeedsReauth {
		t.Fatalf("auth status = %q, want needs_reauth", got.AuthStatus)
	}
	var count int64
	DB.Model(&GrokChannelState{}).Where("channel_id = ?", 42).Count(&count)
	if count != 1 {
		t.Fatalf("expected exactly 1 row, got %d", count)
	}
}

func TestGrokChannelStateNeverStoresSecrets(t *testing.T) {
	// 编译期保证：结构体不含 token/verifier/password 字段。
	// 用反射断言字段名白名单，任何新增秘密字段都会让测试失败。
	allowed := map[string]struct{}{
		"ChannelID": {}, "AuthStatus": {}, "BillingPlan": {}, "TierRaw": {},
		"QuotaSnapshot": {}, "RefreshLeaseOwner": {}, "RefreshLeaseExpiresAt": {},
		"LastRefreshAt": {}, "LastError": {}, "CreatedAt": {}, "UpdatedAt": {},
	}
	assertOnlyAllowedFields(t, GrokChannelState{}, allowed)
}
```

> `assertOnlyAllowedFields` 是本测试文件内的辅助：`reflect.TypeOf(v)` 遍历字段名，任何不在 `allowed` 的字段 `t.Fatalf`。这道护栏防止未来有人往非秘密表里塞 token。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./model/ -run TestGrokChannelState -v`
Expected: FAIL（`GrokChannelState` undefined）

- [ ] **Step 3: 写实现**

```go
package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Grok 认证状态枚举（非秘密）。
const (
	GrokAuthStatusPending     = "pending"      // 空 Key 已建渠道，等待完成 OAuth
	GrokAuthStatusActive      = "active"       // 有可用 access_token
	GrokAuthStatusNeedsReauth = "needs_reauth" // 刷新失败/无 refresh_token，需人工重认证
)

// GrokChannelState 是按 channel_id 唯一的非秘密状态快照（设计 §6.3）。
// 严禁存放 access_token / refresh_token / pkce_verifier / 密码 / SSO cookie。
// 秘密只存在于加密后的 Channel.Key（凭证 JSON）与 GrokAuthFlow.EncryptedVerifier。
type GrokChannelState struct {
	ChannelID             int    `json:"channel_id" gorm:"primaryKey"`
	AuthStatus            string `json:"auth_status" gorm:"type:varchar(32);index"`
	BillingPlan           string `json:"billing_plan" gorm:"type:varchar(64)"`
	TierRaw               string `json:"tier_raw" gorm:"type:varchar(64)"`
	QuotaSnapshot         string `json:"quota_snapshot" gorm:"type:text"`
	RefreshLeaseOwner     string `json:"-" gorm:"type:varchar(128)"`
	RefreshLeaseExpiresAt int64  `json:"refresh_lease_expires_at"`
	LastRefreshAt         int64  `json:"last_refresh_at"`
	LastError             string `json:"last_error" gorm:"type:varchar(512)"`
	CreatedAt             int64  `json:"created_at"`
	UpdatedAt             int64  `json:"updated_at"`
}

func (GrokChannelState) TableName() string { return "grok_channel_states" }

// UpsertGrokChannelState 按 channel_id 插入或整体覆盖（保持唯一一行）。
func UpsertGrokChannelState(st *GrokChannelState) error {
	if st == nil || st.ChannelID <= 0 {
		return errors.New("grok channel state: invalid channel id")
	}
	if st.CreatedAt == 0 {
		st.CreatedAt = GetDBTimestamp()
	}
	st.UpdatedAt = GetDBTimestamp()
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "channel_id"}},
		UpdateAll: true,
	}).Create(st).Error
}

// GetGrokChannelState 取单渠道状态；不存在返回 (nil, gorm.ErrRecordNotFound)。
func GetGrokChannelState(channelID int) (*GrokChannelState, error) {
	var st GrokChannelState
	if err := DB.Where("channel_id = ?", channelID).First(&st).Error; err != nil {
		return nil, err
	}
	return &st, nil
}

// DeleteGrokChannelState 渠道删除时级联清理。
func DeleteGrokChannelState(channelID int) error {
	return DB.Where("channel_id = ?", channelID).Delete(&GrokChannelState{}).Error
}

// 确保 gorm 被引用（部分构建标签下避免 unused import 报错）。
var _ = gorm.ErrRecordNotFound
```

- [ ] **Step 4: 在 model/main.go 注册两张表**

`orderedMigrationModels()` slice 末尾（`{&PromptLibraryItem{}, "PromptLibraryItem"}` 之后、闭合 `}` 之前）插入：

```go
		{&PromptLibraryItem{}, "PromptLibraryItem"},
		{&GrokAuthFlow{}, "GrokAuthFlow"},
		{&GrokChannelState{}, "GrokChannelState"},
	}
```

> `migrateDB()`（:253）与 `migrateDBFast()`（:423）复用同一 slice，一处修改两个引擎都生效。

- [ ] **Step 5: 写 migration 注册测试**

`model/grok_channel_state_test.go` 追加：

```go
func TestGrokTablesRegisteredForMigration(t *testing.T) {
	names := map[string]bool{}
	for _, m := range orderedMigrationModels() {
		names[m.name] = true
	}
	for _, want := range []string{"GrokAuthFlow", "GrokChannelState"} {
		if !names[want] {
			t.Fatalf("migration model %q not registered", want)
		}
	}
}
```

- [ ] **Step 6: 运行确认通过**

Run: `go test ./model/ -run "TestGrokChannelState|TestGrokTablesRegistered|TestGrokAuthFlow" -v`
Expected: PASS（若 `model` 包 suite 超时，用 `-run` 过滤只跑 Grok 测试即可绿；全包超时是既有失败，不算回归）

- [ ] **Step 7: Commit**

```bash
git add model/grok_channel_state.go model/grok_channel_state_test.go model/main.go
git commit -m "feat(grok): non-secret channel state table + migration registration"
```

### Task 7: 空 Key 待授权渠道 CRUD 例外 + 版本化 JSON Key 校验

设计 §6.1、§9。Grok 渠道创建时 Key 可为空（待 OAuth 完成再落库，照 Copilot）；一旦提供 Key，必须是版本化凭证 JSON（照 Codex 的 JSON 校验，但用 `ParseCredential` 精确校验 version+type）。multi-key 模式对 Grok 拒绝。

**Files:**
- Modify: `controller/channel.go:469`（multi-key 拒绝加 Grok）
- Modify: `controller/channel.go:484`（空 Key 例外加 Grok）
- Modify: `controller/channel.go:530`（Codex 校验块后追加 Grok 校验块）
- Test: `controller/grok_channel_validate_test.go`

- [ ] **Step 1: 写失败测试**

```go
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestValidateChannelGrokAllowsEmptyKeyOnAdd(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription, Key: ""}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err != nil {
		t.Fatalf("empty-key Grok add must be allowed (pending OAuth), got %v", err)
	}
}

func TestValidateChannelGrokRejectsMultiKey(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription}
	ch.ChannelInfo.IsMultiKey = true
	if err := validateChannel(ch, false); err == nil {
		t.Fatalf("Grok multi-key must be rejected")
	}
}

func TestValidateChannelGrokRejectsNonVersionedKey(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription, Key: `{"access_token":"at"}`}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err == nil {
		t.Fatalf("Grok key without version/type must be rejected")
	}
}

func TestValidateChannelGrokAcceptsVersionedKey(t *testing.T) {
	ch := &model.Channel{
		Type: constant.ChannelTypeGrokSubscription,
		Key:  `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`,
	}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err != nil {
		t.Fatalf("valid versioned Grok key must pass, got %v", err)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./controller/ -run TestValidateChannelGrok -v`
Expected: FAIL（空 Key 被拒 / 版本化 Key 未校验）

- [ ] **Step 3: 改 multi-key 拒绝（:469）**

```go
	if channel.ChannelInfo.IsMultiKey &&
		(channel.Type == constant.ChannelTypeCopilot || channel.Type == constant.ChannelTypeGrokSubscription) {
		return fmt.Errorf("%s channel does not support multi-key mode", constant.ChannelTypeNames[channel.Type])
	}
```

- [ ] **Step 4: 改空 Key 例外（:484）**

```go
		if channel == nil || (channel.Key == "" &&
			channel.Type != constant.ChannelTypeCopilot &&
			channel.Type != constant.ChannelTypeGrokSubscription) {
			return fmt.Errorf("channel cannot be empty")
		}
```

- [ ] **Step 5: 追加 Grok 版本化 Key 校验（Codex 块 :530 之后）**

```go
	// Grok Subscription 版本化 OAuth 凭证校验（仅当提供 Key 时；空 Key 走 OAuth 待授权）。
	if channel.Type == constant.ChannelTypeGrokSubscription {
		trimmedKey := strings.TrimSpace(channel.Key)
		if trimmedKey != "" {
			if _, err := groksubscription.ParseCredential(trimmedKey); err != nil {
				return fmt.Errorf("Grok subscription key invalid: %w", err)
			}
		}
	}
```

import 块加 `"github.com/QuantumNous/new-api/relay/channel/groksubscription"`。

- [ ] **Step 6: 运行确认通过**

Run: `go test ./controller/ -run TestValidateChannelGrok -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add controller/channel.go controller/grok_channel_validate_test.go
git commit -m "feat(grok): pending-auth empty key + versioned credential validation on channel CRUD"
```

### Task 8: 跨节点刷新 lease + token endpoint 调用 + revision CAS

设计 §7.2、§10。access_token 临期时，单节点抢占 channel-scoped lease（写 `GrokChannelState.RefreshLeaseOwner` + 到期），调 `auth.x.ai/oauth2/token` 刷新，成功后以 revision CAS 原子写回 `Channel.Key`（新凭证 JSON），失败置 `needs_reauth`。lease 用 `GetDBTimestampWithContext(ctx)` 做 DB 权威时间，避免多节点时钟漂移。

**Files:**
- Create: `relay/channel/groksubscription/refresh.go`
- Modify: `model/grok_channel_state.go`（加 lease CAS 方法）
- Test: `relay/channel/groksubscription/refresh_test.go`、`model/grok_channel_state_test.go`（追加 lease 测试）

- [ ] **Step 1: 写 lease CAS 失败测试（model 包）**

```go
func TestAcquireRefreshLeaseIsExclusive(t *testing.T) {
	setupTestDB(t)
	UpsertGrokChannelState(&GrokChannelState{ChannelID: 5, AuthStatus: GrokAuthStatusActive})
	now := GetDBTimestamp()
	// 节点 A 抢到
	okA, err := AcquireGrokRefreshLease(5, "node-A", now, 30)
	if err != nil || !okA {
		t.Fatalf("node A must acquire lease, ok=%v err=%v", okA, err)
	}
	// 节点 B 在未过期时抢不到
	okB, _ := AcquireGrokRefreshLease(5, "node-B", now+1, 30)
	if okB {
		t.Fatalf("node B must not acquire while A holds unexpired lease")
	}
	// lease 过期后 B 抢到
	okB2, _ := AcquireGrokRefreshLease(5, "node-B", now+31, 30)
	if !okB2 {
		t.Fatalf("node B must acquire after A's lease expired")
	}
	// A 释放（仅 owner 可释放；此时 owner 已是 B，A 释放无效）
	ReleaseGrokRefreshLease(5, "node-A")
	st, _ := GetGrokChannelState(5)
	if st.RefreshLeaseOwner != "node-B" {
		t.Fatalf("non-owner release must not clear lease, owner=%q", st.RefreshLeaseOwner)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./model/ -run TestAcquireRefreshLease -v`
Expected: FAIL（`AcquireGrokRefreshLease` undefined）

- [ ] **Step 3: 写 lease CAS 实现（追加到 model/grok_channel_state.go）**

```go
// AcquireGrokRefreshLease 原子抢占 channel-scoped 刷新 lease。
// 条件：lease owner 为空 或 已过期（expires_at <= now）。ttl 单位秒。
// 返回是否抢到。now 应由调用方用 GetDBTimestampWithContext 传入以统一时钟。
func AcquireGrokRefreshLease(channelID int, owner string, now, ttlSeconds int64) (bool, error) {
	if channelID <= 0 || owner == "" || ttlSeconds <= 0 {
		return false, errors.New("grok refresh lease: invalid args")
	}
	res := DB.Model(&GrokChannelState{}).
		Where("channel_id = ? AND (refresh_lease_owner = '' OR refresh_lease_owner IS NULL OR refresh_lease_expires_at <= ?)", channelID, now).
		Updates(map[string]any{
			"refresh_lease_owner":      owner,
			"refresh_lease_expires_at": now + ttlSeconds,
			"updated_at":               now,
		})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

// ReleaseGrokRefreshLease 仅当前 owner 可释放（清空 owner）。
func ReleaseGrokRefreshLease(channelID int, owner string) error {
	return DB.Model(&GrokChannelState{}).
		Where("channel_id = ? AND refresh_lease_owner = ?", channelID, owner).
		Updates(map[string]any{"refresh_lease_owner": "", "refresh_lease_expires_at": 0}).Error
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./model/ -run TestAcquireRefreshLease -v`
Expected: PASS

- [ ] **Step 5: 写 token 刷新 + revision CAS 失败测试（groksubscription 包）**

刷新逻辑用注入的 HTTP doer + credential store 接口，避免真打 auth.x.ai。

```go
package groksubscription

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

type fakeStore struct {
	key      string
	revision int
	casCalls int
}

func (f *fakeStore) Load(ctx context.Context, channelID int) (string, int, error) {
	return f.key, f.revision, nil
}
func (f *fakeStore) CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error) {
	f.casCalls++
	if expectedRevision != f.revision {
		return false, nil
	}
	f.key = newKey
	f.revision++
	return true, nil
}

func TestRefreshTokenSuccessSwapsCredential(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
		revision: 7,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer","expires_in":3600}`), nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	newCred, err := r.Refresh(context.Background(), 5)
	if err != nil {
		t.Fatalf("refresh err %v", err)
	}
	if newCred.AccessToken != "new" || newCred.RefreshToken != "rt2" {
		t.Fatalf("credential not updated: %+v", newCred)
	}
	if newCred.ExpiresAt != 2000+3600 {
		t.Fatalf("expires_at = %d, want now+expires_in", newCred.ExpiresAt)
	}
	if store.casCalls != 1 {
		t.Fatalf("expected exactly one CAS, got %d", store.casCalls)
	}
}

func TestRefreshTokenNonRefreshableFails(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","token_type":"Bearer","expires_at":1000}`,
		revision: 1,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint without refresh_token")
		return nil, nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	if _, err := r.Refresh(context.Background(), 5); !errors.Is(err, ErrNotRefreshable) {
		t.Fatalf("want ErrNotRefreshable, got %v", err)
	}
}

func TestRefreshTokenCASConflictReturnsRetryable(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
		revision: 7,
	}
	// doer 返回成功，但 CAS 期望 revision 与 store 不符 → 模拟并发已被别的节点换过
	store2 := &fakeStore{key: store.key, revision: 999}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer","expires_in":3600}`), nil
	})
	// 让 Load 返回 revision=7 但 CAS 时 store 已是 999：用一个 revision 漂移的 store
	drift := &driftStore{load: 7, casRev: 999}
	_ = store2
	r := NewRefresher(drift, doer, func() int64 { return 2000 })
	if _, err := r.Refresh(context.Background(), 5); !errors.Is(err, ErrRefreshConflict) {
		t.Fatalf("want ErrRefreshConflict on CAS mismatch, got %v", err)
	}
}
```

> 测试辅助 `doerFunc`（实现 `HTTPDoer`）、`jsonResponse(code, body)`（构造 `*http.Response`）、`driftStore`（Load 返回一个 revision、CAS 时按另一个 revision 判定失败）在 `refresh_test.go` 内定义。

- [ ] **Step 6: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestRefreshToken -v`
Expected: FAIL（`NewRefresher` undefined）

- [ ] **Step 7: 写刷新实现**

```go
package groksubscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var (
	ErrNotRefreshable  = errors.New("grok refresh: credential has no refresh_token")
	ErrRefreshConflict = errors.New("grok refresh: revision CAS conflict")
)

// HTTPDoer 便于测试注入。
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// CredentialStore 抽象 Channel.Key 的读取与 revision CAS 写回。
type CredentialStore interface {
	Load(ctx context.Context, channelID int) (key string, revision int, err error)
	CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error)
}

// Refresher 执行 token 刷新 + 原子写回。
type Refresher struct {
	store CredentialStore
	doer  HTTPDoer
	now   func() int64
}

func NewRefresher(store CredentialStore, doer HTTPDoer, now func() int64) *Refresher {
	return &Refresher{store: store, doer: doer, now: now}
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

// Refresh 刷新指定渠道的凭证并 CAS 写回，返回新凭证。
func (r *Refresher) Refresh(ctx context.Context, channelID int) (Credential, error) {
	rawKey, revision, err := r.store.Load(ctx, channelID)
	if err != nil {
		return Credential{}, err
	}
	cred, err := ParseCredential(rawKey)
	if err != nil {
		return Credential{}, err
	}
	if !cred.IsRefreshable() {
		return Credential{}, ErrNotRefreshable
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", cred.RefreshToken)
	form.Set("client_id", OAuthClientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, OAuthToken, strings.NewReader(form.Encode()))
	if err != nil {
		return Credential{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := r.doer.Do(req)
	if err != nil {
		return Credential{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return Credential{}, fmt.Errorf("grok refresh: token endpoint status %d", resp.StatusCode)
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return Credential{}, errors.New("grok refresh: invalid token response")
	}
	if strings.TrimSpace(tr.AccessToken) == "" {
		return Credential{}, errors.New("grok refresh: empty access_token in response")
	}

	newCred := Credential{
		Version:      CredentialVersion,
		Type:         CredentialType,
		AccessToken:  tr.AccessToken,
		RefreshToken: firstNonEmpty(tr.RefreshToken, cred.RefreshToken), // 上游可能不轮换 refresh
		TokenType:    firstNonEmpty(tr.TokenType, cred.TokenType),
		ExpiresAt:    r.now() + tr.ExpiresIn,
	}
	serialized, err := newCred.Serialize()
	if err != nil {
		return Credential{}, err
	}
	ok, err := r.store.CompareAndSwap(ctx, channelID, revision, serialized)
	if err != nil {
		return Credential{}, err
	}
	if !ok {
		return Credential{}, ErrRefreshConflict
	}
	return newCred, nil
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}
```

- [ ] **Step 8: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run TestRefreshToken -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add relay/channel/groksubscription/refresh.go relay/channel/groksubscription/refresh_test.go model/grok_channel_state.go model/grok_channel_state_test.go
git commit -m "feat(grok): cross-node refresh lease + token refresh with revision CAS"
```

> **接线说明（实现时）**：`CredentialStore` 的生产实现用 `model.UpdateChannelKeyForType` + 一个 revision 列（或复用 `Channel` 已有的乐观锁字段）。若 `Channel` 无 revision 列，最小改动是在 CAS 里用 `WHERE key = <oldKey>` 作为乐观条件（旧值比对即 CAS），避免给 Channel 表加列。实现时先 `rg "optimistic\|revision\|version" model/channel.go` 确认既有机制，二选一并在本任务补一个集成测试。lease 的获取/释放在 relay 请求路径里由调用方（workstream 2 的 adaptor 预检）用 `AcquireGrokRefreshLease` 包裹，抢不到 lease 的节点短暂等待后重读 Channel.Key。

---

## Workstream 2：文本能力（Responses / compact / Chat / Claude / count-tokens / 工具搜索 + Grok 专用流式重试）

### Task 9: 登记 Responses 门禁三处 + compact 白名单

设计 §9。三处硬编码门禁必须逐一加入 `APITypeGrokSubscription`，缺一处 Responses/compact 在选路或 handler 阶段被拒。Task 2 已登记 `GetEndpointTypesByChannelType`（三处之一）；本任务补齐另外两处（`channelSupportsOpenAIResponses` allowlist + 两处 compact 白名单）。

**Files:**
- Modify: `service/channel_select.go:256`（compact 分支加 Grok）
- Modify: `service/channel_select.go:291`（`channelSupportsOpenAIResponses` allowlist 加 Grok）
- Modify: `relay/responses_handler.go:27`（`RelayModeResponsesCompact` 白名单加 Grok）
- Test: `service/grok_responses_gate_test.go`、`relay/grok_responses_compact_gate_test.go`

- [ ] **Step 1: 写失败测试**

`service/grok_responses_gate_test.go`：

```go
package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestGrokSupportsOpenAIResponses(t *testing.T) {
	if !channelSupportsOpenAIResponses(constant.ChannelTypeGrokSubscription) {
		t.Fatalf("Grok subscription must support /v1/responses")
	}
}

func TestGrokSupportsResponsesCompactEndpoint(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription}
	if !channelSupportsRequestedEndpoint(ch, "grok-4", constant.EndpointTypeOpenAIResponseCompact) {
		t.Fatalf("Grok subscription must support responses compact endpoint gate")
	}
}
```

`relay/grok_responses_compact_gate_test.go`：

```go
package relay

import (
	"testing"

	appconstant "github.com/QuantumNous/new-api/constant"
)

// 断言 compact 白名单包含 Grok（用一个小 helper 暴露判断，或直接用表驱动覆盖 switch）。
func TestGrokInResponsesCompactWhitelist(t *testing.T) {
	if !responsesCompactAPITypeAllowed(appconstant.APITypeGrokSubscription) {
		t.Fatalf("Grok must be in responses-compact api-type whitelist")
	}
}
```

> 实现时把 `responses_handler.go` 里内联的 `switch info.ApiType { case APITypeOpenAI, APITypeCodex: }` 抽成一个包内小函数 `responsesCompactAPITypeAllowed(apiType int) bool`，既便于测试也让白名单单点可维护。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./service/ -run TestGrokSupports -v && go test ./relay/ -run TestGrokInResponsesCompact -v`
Expected: FAIL

- [ ] **Step 3: 改 `channelSupportsOpenAIResponses`（:291 switch 补一行）**

```go
	switch apiType {
	case constant.APITypeOpenAI,
		constant.APITypeAli,
		constant.APITypeCloudflare,
		constant.APITypeOpenRouter,
		constant.APITypeXinference,
		constant.APITypeXai,
		constant.APITypeGrokSubscription,
		constant.APITypePerplexity,
		constant.APITypeVolcEngine,
		constant.APITypeCodex,
		constant.APITypeBlockRun:
		return true
```

- [ ] **Step 4: 改 compact 分支（:254-256）**

```go
	case constant.EndpointTypeOpenAIResponseCompact:
		apiType, ok := common.ChannelType2APIType(channel.Type)
		return ok && (apiType == constant.APITypeOpenAI ||
			apiType == constant.APITypeCodex ||
			apiType == constant.APITypeGrokSubscription)
```

- [ ] **Step 5: 抽出并改 compact 白名单（responses_handler.go）**

在 `relay` 包内新增 helper 并替换内联 switch：

```go
func responsesCompactAPITypeAllowed(apiType int) bool {
	switch apiType {
	case appconstant.APITypeOpenAI, appconstant.APITypeCodex, appconstant.APITypeGrokSubscription:
		return true
	default:
		return false
	}
}
```

`ResponsesHelper` 里（:25-36）改为：

```go
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		if !responsesCompactAPITypeAllowed(info.ApiType) {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("unsupported endpoint %q for api type %d", "/v1/responses/compact", info.ApiType),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
	}
```

- [ ] **Step 6: 运行确认通过**

Run: `go test ./service/ -run TestGrokSupports -v && go test ./relay/ -run TestGrokInResponsesCompact -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add service/channel_select.go service/grok_responses_gate_test.go relay/responses_handler.go relay/grok_responses_compact_gate_test.go
git commit -m "feat(grok): register Grok in all three Responses/compact capability gates"
```

### Task 10: Claude / Chat bridge 对 Grok 放行

设计 §9。Chat→Responses bridge 对 Grok 默认已放行（`allowsChatCompletionsViaResponses` 只排除 Copilot），但 Claude bridge 需显式对 Grok 强制走 Responses，不依赖可变的全局 `PassThrough` 策略（照 Codex 的显式强制）。

**Files:**
- Modify: `relay/claude_handler.go:33-38`（Grok 强制 bridge）
- Test: `relay/claude_handler_test.go`（追加）

- [ ] **Step 1: 写失败测试**

```go
func TestShouldClaudeUseResponsesBridgeForGrokDespiteGlobalPassThrough(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: constant.ChannelTypeGrokSubscription,
		ApiType:     constant.APITypeGrokSubscription,
	}}
	// 即便全局 pass-through 打开，Grok 也必须强制走 Responses bridge
	prev := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	defer func() { model_setting.GetGlobalSettings().PassThroughRequestEnabled = prev }()
	require.True(t, shouldClaudeUseResponsesBridge(info))
}
```

> 若 `ChannelMeta` 字段名/构造方式与既有测试（`claude_handler_test.go:23`）不同，照既有测试的构造方式对齐。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/ -run TestShouldClaudeUseResponsesBridgeForGrok -v`
Expected: FAIL（Grok 在 pass-through 开启时返回 false）

- [ ] **Step 3: 改实现（:33 Codex 强制块旁加 Grok）**

```go
	// Codex/Grok 无原生 /v1/messages 上游端点，Claude 请求始终经
	// Chat Completions -> Responses bridge，即便全局/渠道 pass-through 打开。
	if info.ApiType == constant.APITypeCodex || info.ApiType == constant.APITypeGrokSubscription {
		return true
	}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/ -run TestShouldClaudeUseResponsesBridgeForGrok -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add relay/claude_handler.go relay/claude_handler_test.go
git commit -m "feat(grok): force Claude->Responses bridge for Grok regardless of pass-through"
```

> **count-tokens 注记（受理标准第 3 条）**：`/v1/messages/count_tokens` 在 `relay/constant` 里**没有对应 RelayMode**（见 `relay/channel/blockrun/adaptor.go:556-557` 的说明），因此它不路由到任何渠道 adaptor，而是走 NewAPI 既有的本地 Claude token counter（设计 §8「复用现有 Claude token counter，不消耗上游订阅」）。对 Grok **无需任何专用实现**：Grok 渠道下的 count-tokens 与其他渠道走同一本地路径、不发上游、不计订阅消耗。此项无代码任务，其正确性由收尾验证的 Claude 本地路径回归 + staging smoke 覆盖。

### Task 11: typed 工具 DTO（function / web_search / x_search）与字段白名单 sanitizer

设计 §9。function tools、`web_search`（含兼容别名）、`x_search` 用 typed DTO；客户端显式传的 `0`/`false` 用指针字段保留；未知 tool type 或 Grok 不支持的字段返回可定位 400，不静默删。参数 override 执行后必须再跑一次 Grok 最终 sanitizer 才构造上游请求。

**Files:**
- Create: `relay/channel/groksubscription/tools.go`
- Create: `relay/channel/groksubscription/sanitize.go`
- Test: `relay/channel/groksubscription/tools_test.go`、`relay/channel/groksubscription/sanitize_test.go`

- [ ] **Step 1: 写 tool DTO 失败测试**

```go
package groksubscription

import "testing"

func TestParseWebSearchToolPreservesFalse(t *testing.T) {
	// 客户端显式传 return_citations=false 必须保留（指针字段），不能被当成缺省丢弃
	raw := `{"type":"web_search","web_search":{"return_citations":false,"max_results":0}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	ws := tool.WebSearch
	if ws == nil || ws.ReturnCitations == nil || *ws.ReturnCitations != false {
		t.Fatalf("return_citations=false must be preserved as pointer, got %+v", ws)
	}
	if ws.MaxResults == nil || *ws.MaxResults != 0 {
		t.Fatalf("max_results=0 must be preserved, got %+v", ws)
	}
}

func TestParseXSearchTool(t *testing.T) {
	raw := `{"type":"x_search","x_search":{"query":"golang","max_results":5}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	if tool.XSearch == nil || tool.XSearch.Query != "golang" {
		t.Fatalf("x_search not parsed: %+v", tool)
	}
}

func TestParseFunctionTool(t *testing.T) {
	raw := `{"type":"function","function":{"name":"get_weather","parameters":{"type":"object"}}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	if tool.Function == nil || tool.Function.Name != "get_weather" {
		t.Fatalf("function tool not parsed: %+v", tool)
	}
}

func TestParseUnknownToolTypeRejected(t *testing.T) {
	raw := `{"type":"code_interpreter","code_interpreter":{}}`
	if _, err := ParseTool([]byte(raw)); err == nil {
		t.Fatalf("unknown tool type must be rejected with locatable error, not silently dropped")
	}
}

func TestParseWebSearchAliasNormalized(t *testing.T) {
	// 兼容别名（如 browser_search）归一化到 web_search
	raw := `{"type":"browser_search","browser_search":{"max_results":3}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("alias parse err %v", err)
	}
	if tool.Type != ToolTypeWebSearch || tool.WebSearch == nil {
		t.Fatalf("alias must normalize to web_search, got %+v", tool)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestParse -v`
Expected: FAIL（`ParseTool` undefined）

- [ ] **Step 3: 写 tool DTO 实现**

```go
package groksubscription

import (
	"encoding/json"
	"errors"
)

// 受支持的 tool type（含兼容别名归一化目标）。
const (
	ToolTypeFunction  = "function"
	ToolTypeWebSearch = "web_search"
	ToolTypeXSearch   = "x_search"
)

// webSearchAliases 归一化到 web_search 的兼容别名。
var webSearchAliases = map[string]struct{}{
	"web_search":     {},
	"browser_search": {},
}

// FunctionTool / WebSearchTool / XSearchTool 用指针保留客户端显式传入的零值标量。
type FunctionTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
	Strict      *bool           `json:"strict,omitempty"`
}

type WebSearchTool struct {
	MaxResults      *int    `json:"max_results,omitempty"`
	ReturnCitations *bool   `json:"return_citations,omitempty"`
	AllowedDomains  []string `json:"allowed_domains,omitempty"`
	BlockedDomains  []string `json:"blocked_domains,omitempty"`
}

type XSearchTool struct {
	Query      string `json:"query,omitempty"`
	MaxResults *int   `json:"max_results,omitempty"`
	FromDate   string `json:"from_date,omitempty"`
	ToDate     string `json:"to_date,omitempty"`
}

// Tool 是归一化后的 typed 工具。
type Tool struct {
	Type      string
	Function  *FunctionTool
	WebSearch *WebSearchTool
	XSearch   *XSearchTool
}

// ParseTool 解析单个工具 JSON 到 typed DTO，未知 type 返回可定位错误。
func ParseTool(raw []byte) (Tool, error) {
	var head struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &head); err != nil {
		return Tool{}, errors.New("grok tool: invalid JSON")
	}
	// 归一化别名
	toolType := head.Type
	if _, ok := webSearchAliases[toolType]; ok {
		toolType = ToolTypeWebSearch
	}
	switch toolType {
	case ToolTypeFunction:
		var wrap struct {
			Function *FunctionTool `json:"function"`
		}
		if err := strictUnmarshal(raw, &wrap); err != nil || wrap.Function == nil {
			return Tool{}, errors.New("grok tool: invalid function tool")
		}
		return Tool{Type: ToolTypeFunction, Function: wrap.Function}, nil
	case ToolTypeWebSearch:
		var wrap map[string]json.RawMessage
		_ = json.Unmarshal(raw, &wrap)
		var ws WebSearchTool
		// 从原 type 键或归一化键任取其一取 payload
		if body, ok := firstRaw(wrap, head.Type, ToolTypeWebSearch); ok {
			if err := strictUnmarshal(body, &ws); err != nil {
				return Tool{}, errors.New("grok tool: invalid web_search config")
			}
		}
		return Tool{Type: ToolTypeWebSearch, WebSearch: &ws}, nil
	case ToolTypeXSearch:
		var wrap struct {
			XSearch *XSearchTool `json:"x_search"`
		}
		if err := strictUnmarshal(raw, &wrap); err != nil || wrap.XSearch == nil {
			return Tool{}, errors.New("grok tool: invalid x_search config")
		}
		return Tool{Type: ToolTypeXSearch, XSearch: wrap.XSearch}, nil
	default:
		return Tool{}, errors.New("grok tool: unsupported tool type " + head.Type)
	}
}

// strictUnmarshal 用 DisallowUnknownFields，未知字段即报错（不静默删除产生不同语义）。
func strictUnmarshal(raw []byte, v any) error {
	dec := json.NewDecoder(bytesReader(raw))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
```

> `firstRaw`、`bytesReader` 是包内小 helper（`bytes.NewReader`；`firstRaw` 按 key 顺序返回第一个存在的 raw payload）。实现时补上。别名的 payload 键（如 `browser_search`）也要能取到——测试 `TestParseWebSearchAliasNormalized` 覆盖。

- [ ] **Step 4: 写 sanitizer 失败测试**

```go
func TestSanitizeStripsToolConfigForCompact(t *testing.T) {
	in := []byte(`{"model":"grok-4","tools":[{"type":"function"}],"tool_choice":"auto","parallel_tool_calls":true,"max_tool_calls":3,"tool_resources":{"x":1},"input":[]}`)
	out, err := SanitizeCompactRequest(in)
	if err != nil {
		t.Fatalf("sanitize err %v", err)
	}
	for _, forbidden := range []string{"tools", "tool_choice", "parallel_tool_calls", "max_tool_calls", "tool_resources"} {
		if hasTopLevelKey(out, forbidden) {
			t.Fatalf("compact sanitizer must strip top-level %q", forbidden)
		}
	}
}

func TestSanitizeRunsAfterParamOverride(t *testing.T) {
	// 模拟 param override 又塞回 tools，最终 sanitizer 必须再次删除
	overridden := []byte(`{"model":"grok-4","tools":[{"type":"function"}],"input":[]}`)
	out, err := SanitizeCompactRequest(overridden)
	if err != nil {
		t.Fatalf("sanitize err %v", err)
	}
	if hasTopLevelKey(out, "tools") {
		t.Fatalf("sanitizer must remove tools even if reintroduced by override")
	}
}
```

> `hasTopLevelKey` 用 `sjson`/`gjson` 或 `json.Unmarshal` 到 map 判断顶层键。

- [ ] **Step 5: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestSanitize -v`
Expected: FAIL（`SanitizeCompactRequest` undefined）

- [ ] **Step 6: 写 sanitizer 实现**

```go
package groksubscription

import "github.com/tidwall/sjson"

// compactStrippedKeys 是 compact 请求最终必须从顶层删除的工具配置键（设计 §9）。
var compactStrippedKeys = []string{
	"tools",
	"tool_choice",
	"parallel_tool_calls",
	"max_tool_calls",
	"tool_resources",
}

// SanitizeCompactRequest 删除顶层工具配置，保证不发往上游。
// 幂等：param override 之后必须再调一次。
func SanitizeCompactRequest(jsonData []byte) ([]byte, error) {
	var err error
	for _, key := range compactStrippedKeys {
		jsonData, err = sjson.DeleteBytes(jsonData, key)
		if err != nil {
			return nil, err
		}
	}
	return jsonData, nil
}
```

- [ ] **Step 7: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run "TestParse|TestSanitize" -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add relay/channel/groksubscription/tools.go relay/channel/groksubscription/sanitize.go relay/channel/groksubscription/tools_test.go relay/channel/groksubscription/sanitize_test.go
git commit -m "feat(grok): typed tool DTOs (function/web_search/x_search) + compact field sanitizer"
```

### Task 12: `/v1/responses/compact` clean-room summary turn 构造

设计 §9。compact 不调上游 compact path，而是 clean-room 构造一个服务端 summary 指令的普通、非流式 Responses turn：`stream=true` 稳定 400；否则规范化输入、追加 summary item、要求 `reasoning.encrypted_content`、强制 `stream=false`/`store=false`，最终跑 `SanitizeCompactRequest`。响应只在同时得到 encrypted reasoning + 合法 summary 时转成 OpenAI compaction item，否则稳定报错不伪造。summary 指令自撰，不复制 sub2api 文本。

**Files:**
- Create: `relay/channel/groksubscription/responses_compact.go`
- Test: `relay/channel/groksubscription/responses_compact_test.go`

- [ ] **Step 1: 写失败测试**

```go
package groksubscription

import "testing"

func TestBuildCompactTurnRejectsStreamTrue(t *testing.T) {
	in := []byte(`{"model":"grok-4","stream":true,"input":[]}`)
	if _, err := BuildCompactTurn(in); err != ErrCompactStreamUnsupported {
		t.Fatalf("stream=true must return ErrCompactStreamUnsupported, got %v", err)
	}
}

func TestBuildCompactTurnForcesNonStreamAndStore(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}]}`)
	out, err := BuildCompactTurn(in)
	if err != nil {
		t.Fatalf("build err %v", err)
	}
	if getBool(out, "stream") != false {
		t.Fatalf("compact must force stream=false")
	}
	if getBool(out, "store") != false {
		t.Fatalf("compact must force store=false")
	}
	// summary item 被追加到 input
	if !hasSummaryItem(out) {
		t.Fatalf("compact must append server summary item")
	}
	// 工具配置被剥离
	if hasTopLevelKey(out, "tools") {
		t.Fatalf("compact must strip tools")
	}
}

func TestConvertCompactResponseRequiresEncryptedReasoning(t *testing.T) {
	// 缺 encrypted_content 时不伪造 compaction item
	noReasoning := []byte(`{"output":[{"type":"message","content":[{"type":"output_text","text":"summary"}]}]}`)
	if _, err := ConvertCompactResponse(noReasoning); err != ErrCompactMissingReasoning {
		t.Fatalf("missing encrypted reasoning must fail, got %v", err)
	}
}

func TestConvertCompactResponseSucceeds(t *testing.T) {
	ok := []byte(`{"output":[{"type":"reasoning","encrypted_content":"enc"},{"type":"message","content":[{"type":"output_text","text":"the summary"}]}]}`)
	item, err := ConvertCompactResponse(ok)
	if err != nil {
		t.Fatalf("convert err %v", err)
	}
	if item.EncryptedContent != "enc" || item.Summary == "" {
		t.Fatalf("compaction item malformed: %+v", item)
	}
}
```

> `getBool`/`hasSummaryItem`/`hasTopLevelKey` 是测试 helper（`gjson`）。`CompactionItem` 结构在实现里定义。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run "TestBuildCompact|TestConvertCompact" -v`
Expected: FAIL

- [ ] **Step 3: 写实现**

```go
package groksubscription

import (
	"errors"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var (
	ErrCompactStreamUnsupported = errors.New("grok compact: stream=true not supported")
	ErrCompactMissingReasoning  = errors.New("grok compact: response missing encrypted reasoning")
	ErrCompactMissingSummary    = errors.New("grok compact: response missing summary text")
)

// summaryInstruction 是自撰的服务端 summary 指令（clean-room，不复制 sub2api 文本）。
const summaryInstruction = "Summarize the preceding conversation faithfully and concisely, preserving decisions, facts, and open questions. Return only the summary."

// CompactionItem 是转换后的 OpenAI compaction item。
type CompactionItem struct {
	EncryptedContent string
	Summary          string
}

// BuildCompactTurn 把 compact 请求改造成普通非流式 Responses summary turn。
func BuildCompactTurn(jsonData []byte) ([]byte, error) {
	if gjson.GetBytes(jsonData, "stream").Bool() {
		return nil, ErrCompactStreamUnsupported
	}
	var err error
	// 追加 summary item 到 input 数组末尾
	summaryItem := map[string]any{
		"role":    "user",
		"content": summaryInstruction,
	}
	jsonData, err = sjson.SetBytes(jsonData, "input.-1", summaryItem)
	if err != nil {
		return nil, err
	}
	// 强制非流式 / 不存储 / 要求 encrypted reasoning
	if jsonData, err = sjson.SetBytes(jsonData, "stream", false); err != nil {
		return nil, err
	}
	if jsonData, err = sjson.SetBytes(jsonData, "store", false); err != nil {
		return nil, err
	}
	if jsonData, err = sjson.SetBytes(jsonData, "reasoning.encrypted_content", true); err != nil {
		return nil, err
	}
	// 最终 sanitizer：剥离所有工具配置
	return SanitizeCompactRequest(jsonData)
}

// ConvertCompactResponse 只在同时得到 encrypted reasoning + 合法 summary 时转换。
func ConvertCompactResponse(respBody []byte) (CompactionItem, error) {
	var enc, summary string
	gjson.GetBytes(respBody, "output").ForEach(func(_, item gjson.Result) bool {
		switch item.Get("type").String() {
		case "reasoning":
			if e := item.Get("encrypted_content").String(); e != "" {
				enc = e
			}
		case "message":
			item.Get("content").ForEach(func(_, c gjson.Result) bool {
				if c.Get("type").String() == "output_text" {
					summary += c.Get("text").String()
				}
				return true
			})
		}
		return true
	})
	if enc == "" {
		return CompactionItem{}, ErrCompactMissingReasoning
	}
	if summary == "" {
		return CompactionItem{}, ErrCompactMissingSummary
	}
	return CompactionItem{EncryptedContent: enc, Summary: summary}, nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run "TestBuildCompact|TestConvertCompact" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add relay/channel/groksubscription/responses_compact.go relay/channel/groksubscription/responses_compact_test.go
git commit -m "feat(grok): clean-room /v1/responses/compact summary turn construction"
```

### Task 13: Grok 专用 `semantic_output_started` 流式重试 tracker

设计 §9（473 行 + 298-300 行）。**不改共享 `shouldRetry`/`writeRelayError`**。Grok 在自身 adaptor/handler 内维护请求级 tracker：SSE comment、空 event、heartbeat/keepalive、header flush 不置位；各协议首个 text/reasoning/tool/usage/error 事件写出前原子置位；置位后不再切换 Grok 账号继续同一响应。

**Files:**
- Create: `relay/channel/groksubscription/retry_tracker.go`
- Test: `relay/channel/groksubscription/retry_tracker_test.go`

- [ ] **Step 1: 写失败测试**

```go
package groksubscription

import (
	"sync"
	"testing"
)

func TestTrackerNotStartedOnKeepalive(t *testing.T) {
	tr := NewSemanticOutputTracker()
	// heartbeat/comment/空 event/header flush 都不置位
	for _, ev := range []StreamEvent{
		{Kind: EventComment},
		{Kind: EventEmpty},
		{Kind: EventKeepalive},
		{Kind: EventHeaderFlush},
	} {
		tr.Observe(ev)
	}
	if tr.SemanticOutputStarted() {
		t.Fatalf("keepalive/comment/empty/header-flush must not set semantic_output_started")
	}
	if !tr.CanFailover() {
		t.Fatalf("must still allow failover before semantic output")
	}
}

func TestTrackerStartsOnFirstSemanticEvent(t *testing.T) {
	for _, kind := range []EventKind{
		EventResponsesText, EventResponsesReasoning, EventResponsesTool, EventResponsesUsage, EventResponsesError,
		EventChatDelta, EventChatTool, EventChatUsage, EventChatError,
		EventClaudeContent, EventClaudeTool, EventClaudeUsage, EventClaudeError,
	} {
		tr := NewSemanticOutputTracker()
		tr.Observe(StreamEvent{Kind: kind})
		if !tr.SemanticOutputStarted() {
			t.Fatalf("event kind %v must set semantic_output_started", kind)
		}
		if tr.CanFailover() {
			t.Fatalf("must not allow failover after semantic output for kind %v", kind)
		}
	}
}

func TestTrackerSetOnceIdempotentAndConcurrent(t *testing.T) {
	tr := NewSemanticOutputTracker()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); tr.Observe(StreamEvent{Kind: EventResponsesText}) }()
	}
	wg.Wait()
	if !tr.SemanticOutputStarted() {
		t.Fatalf("concurrent observes must set started")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestTracker -v`
Expected: FAIL

- [ ] **Step 3: 写实现**

```go
package groksubscription

import "sync/atomic"

type EventKind int

const (
	// 非语义事件（不置位）
	EventComment EventKind = iota
	EventEmpty
	EventKeepalive
	EventHeaderFlush
	// Responses 语义事件
	EventResponsesText
	EventResponsesReasoning
	EventResponsesTool
	EventResponsesUsage
	EventResponsesError
	// Chat 语义事件
	EventChatDelta
	EventChatTool
	EventChatUsage
	EventChatError
	// Claude 语义事件
	EventClaudeContent
	EventClaudeTool
	EventClaudeUsage
	EventClaudeError
)

// semanticKinds 是会置位 semantic_output_started 的事件集合。
var semanticKinds = map[EventKind]struct{}{
	EventResponsesText: {}, EventResponsesReasoning: {}, EventResponsesTool: {}, EventResponsesUsage: {}, EventResponsesError: {},
	EventChatDelta: {}, EventChatTool: {}, EventChatUsage: {}, EventChatError: {},
	EventClaudeContent: {}, EventClaudeTool: {}, EventClaudeUsage: {}, EventClaudeError: {},
}

// StreamEvent 是分类后的流事件（分类逻辑在各协议 handler 里做，tracker 只认 Kind）。
type StreamEvent struct {
	Kind EventKind
}

// SemanticOutputTracker 是请求级、并发安全的一次性置位器。
type SemanticOutputTracker struct {
	started atomic.Bool
}

func NewSemanticOutputTracker() *SemanticOutputTracker {
	return &SemanticOutputTracker{}
}

// Observe 在写出该事件前调用；语义事件原子置位（幂等）。
func (t *SemanticOutputTracker) Observe(ev StreamEvent) {
	if _, ok := semanticKinds[ev.Kind]; ok {
		t.started.Store(true)
	}
}

// SemanticOutputStarted 是否已写出语义内容。
func (t *SemanticOutputTracker) SemanticOutputStarted() bool {
	return t.started.Load()
}

// CanFailover 仅在尚未写出语义内容时允许 Grok 换账号。
func (t *SemanticOutputTracker) CanFailover() bool {
	return !t.started.Load()
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run TestTracker -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add relay/channel/groksubscription/retry_tracker.go relay/channel/groksubscription/retry_tracker_test.go
git commit -m "feat(grok): request-scoped semantic_output_started retry tracker (Grok-only path)"
```

### Task 14: cache identity HMAC 命名空间化

设计 §9。共享订阅账号防跨租户缓存身份：发往上游的 cache identity 用服务端 HMAC 对 channel + NewAPI user/token identity + 客户端 cache key 命名空间化。原始 user ID / token ID / 客户端 cache key 不发上游、不进日志。

**Files:**
- Create: `relay/channel/groksubscription/cache_identity.go`
- Test: `relay/channel/groksubscription/cache_identity_test.go`

- [ ] **Step 1: 写失败测试**

```go
package groksubscription

import (
	"strings"
	"testing"
)

func TestCacheIdentityIsDeterministicAndNamespaced(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	a := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	b := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	if a != b {
		t.Fatalf("cache identity must be deterministic")
	}
	// 不含任何原始身份明文
	for _, raw := range []string{"user-1", "token-9", "client-key"} {
		if strings.Contains(a, raw) {
			t.Fatalf("cache identity must not leak raw %q", raw)
		}
	}
}

func TestCacheIdentityVariesByChannelAndInputs(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	base := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	for _, other := range []string{
		ComputeCacheIdentity(secret, 43, "user-1", "token-9", "client-key"), // 换 channel
		ComputeCacheIdentity(secret, 42, "user-2", "token-9", "client-key"), // 换 user
		ComputeCacheIdentity(secret, 42, "user-1", "token-8", "client-key"), // 换 token
		ComputeCacheIdentity(secret, 42, "user-1", "token-9", "other-key"),  // 换 client key
	} {
		if other == base {
			t.Fatalf("cache identity must vary when any namespaced input changes")
		}
	}
}

func TestCacheIdentityEmptyClientKeyReturnsEmpty(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	// 客户端没传 cache key 时，不凭空造一个（返回空，调用方据此不发 cache 字段）
	if got := ComputeCacheIdentity(secret, 42, "user-1", "token-9", ""); got != "" {
		t.Fatalf("empty client cache key must yield empty identity, got %q", got)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestCacheIdentity -v`
Expected: FAIL

- [ ] **Step 3: 写实现**

```go
package groksubscription

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"strings"
)

// ComputeCacheIdentity 用 HMAC-SHA256 对 (channel, user, token, clientKey) 命名空间化。
// 客户端未提供 cache key 时返回空串，调用方据此不发 cache 字段（不凭空造身份）。
func ComputeCacheIdentity(secret []byte, channelID int, userIdentity, tokenIdentity, clientCacheKey string) string {
	if strings.TrimSpace(clientCacheKey) == "" {
		return ""
	}
	mac := hmac.New(sha256.New, secret)
	// 用长度前缀分隔，避免字段拼接歧义
	writeField(mac, "grok-cache:v1")
	writeField(mac, strconv.Itoa(channelID))
	writeField(mac, userIdentity)
	writeField(mac, tokenIdentity)
	writeField(mac, clientCacheKey)
	sum := mac.Sum(nil)
	return "grok_" + base64.RawURLEncoding.EncodeToString(sum)
}

func writeField(mac interface{ Write([]byte) (int, error) }, s string) {
	var lenBuf [4]byte
	n := len(s)
	lenBuf[0] = byte(n >> 24)
	lenBuf[1] = byte(n >> 16)
	lenBuf[2] = byte(n >> 8)
	lenBuf[3] = byte(n)
	_, _ = mac.Write(lenBuf[:])
	_, _ = mac.Write([]byte(s))
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run TestCacheIdentity -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add relay/channel/groksubscription/cache_identity.go relay/channel/groksubscription/cache_identity_test.go
git commit -m "feat(grok): HMAC-namespaced cache identity to prevent cross-tenant cache bleed"
```

### Task 15: 上游错误分类器 + attempt 上限 failover 决定（Grok 专用）

设计 §12、§16.2（受理标准第 6 条文本部分）。**不改共享 `shouldRetry`**。Grok 在自身模块内提供纯函数：403 六分类（marker 优先于 message，冲突取高优先，unknown fail-closed）+ 按 (status, category, attempt 状态) 决定 refresh/failover 动作，整条请求生命周期强制 refresh-once / official-fallback-once / alt-channel-once 上限。与 Task 13 的 `SemanticOutputTracker` 配合：已置位则任何动作退化为「结束当前流不换账号」。

**Files:**
- Create: `relay/channel/groksubscription/errors.go`
- Test: `relay/channel/groksubscription/errors_test.go`

- [ ] **Step 1: 写 403 分类失败测试**

设计 §16.2 的 fixture 全覆盖，断言冲突优先级与 unknown fail-closed：

```go
package groksubscription

import "testing"

func TestClassifyForbidden(t *testing.T) {
	cases := []struct {
		name string
		body string
		want ForbiddenCategory
	}{
		{"content policy structured", `{"error":{"code":"content_policy_violation"}}`, ForbiddenContentPolicy},
		{"subscription required", `{"code":"subscription_required","error":"subscription required"}`, ForbiddenAccount},
		{"cli access denied", `{"error":"Access denied"}`, ForbiddenCLICompat},
		{"cli permission_denied fixed prefix", `{"code":"permission_denied","error":"` + cliCompatErrorPrefix + ` for this account"}`, ForbiddenCLICompat},
		// 冲突：同时命中 CLI-compat（access denied 子串）与 account（subscription）→ 取高优先 account
		{"conflict access-denied vs subscription", `{"error":"Access denied because subscription is required"}`, ForbiddenAccount},
		{"unknown fail closed", `{"code":"forbidden","error":"unclassified"}`, ForbiddenUnknown},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyForbidden([]byte(tc.body))
			if got != tc.want {
				t.Fatalf("ClassifyForbidden(%s) = %v, want %v", tc.body, got, tc.want)
			}
		})
	}
}

func TestClassifyForbiddenContentPolicyBeatsAccount(t *testing.T) {
	// content policy 优先级高于 account/entitlement
	body := `{"error":{"code":"content_policy_violation","message":"subscription required"}}`
	if got := ClassifyForbidden([]byte(body)); got != ForbiddenContentPolicy {
		t.Fatalf("content policy must outrank account, got %v", got)
	}
}

func TestClassifyForbiddenBarePermissionDeniedNotCLICompat(t *testing.T) {
	// 裸 permission_denied 不足以命中 CLI compat（设计 §12 优先级表第 3 行）
	body := `{"code":"permission_denied","error":"denied"}`
	if got := ClassifyForbidden([]byte(body)); got == ForbiddenCLICompat {
		t.Fatalf("bare permission_denied must NOT classify as CLI compat")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestClassifyForbidden -v`
Expected: FAIL（`ClassifyForbidden` undefined）

- [ ] **Step 3: 写 403 分类实现**

```go
package groksubscription

import (
	"encoding/json"
	"strings"
)

type ForbiddenCategory int

const (
	ForbiddenUnknown       ForbiddenCategory = iota // fail-closed 默认
	ForbiddenContentPolicy                          // 优先级 1（最高）
	ForbiddenAccount                                // 优先级 2
	ForbiddenCLICompat                              // 优先级 3
)

// cliCompatErrorPrefix 是设计 §8.4 固定 chat-endpoint permission_denied 文案的长前缀。
// 实现时从设计 §8.4 转录精确字符串（clean-room 观察值），此处以占位常量名表达其存在。
const cliCompatErrorPrefix = "You do not have access to the model"

// contentPolicyMarkers / accountMarkers 是规范化后精确匹配的结构化 marker（设计 §12 表）。
var contentPolicyMarkers = map[string]struct{}{
	"content_filter": {}, "content_policy": {}, "content_policy_violation": {},
	"content_moderation": {}, "cyber_policy": {}, "new_sensitive": {},
}
var accountMarkers = map[string]struct{}{
	"account_suspended": {}, "account_disabled": {}, "user_suspended": {}, "user_disabled": {},
	"subscription_required": {}, "entitlement_required": {}, "not_entitled": {},
	"plan_required": {}, "insufficient_quota": {},
}

// contentPolicyPhrases / accountPhrases 是宽泛 message 命中短语（小写子串）。
var contentPolicyPhrases = []string{
	"content policy violation", "content policy rejection", "content policy rejected",
	"content moderation blocked", "content moderation rejected",
	"blocked by policy", "violates policy", "is sensitive", "prohibited content", "forbidden content",
}
var accountPhrases = []string{
	"account suspended", "account disabled", "user suspended", "user disabled",
	"subscription required", "entitlement required", "not entitled", "payment required",
	"spending limit", "out of credits",
}

// ClassifyForbidden 限长解析任意嵌套 code/error_code/type/category/reason/message，
// 按优先级分类；结构化 marker 优先于宽泛 message，冲突取更高优先。unknown fail-closed。
func ClassifyForbidden(body []byte) ForbiddenCategory {
	const maxParse = 1 << 16
	if len(body) > maxParse {
		body = body[:maxParse]
	}
	markers, messages := extractForbiddenSignals(body)

	// 结构化 marker 优先（高→低）
	for _, m := range markers {
		if _, ok := contentPolicyMarkers[m]; ok {
			return ForbiddenContentPolicy
		}
	}
	for _, m := range markers {
		if _, ok := accountMarkers[m]; ok {
			return ForbiddenAccount
		}
	}
	// message 短语（content policy 仍优先于 account）
	joined := strings.ToLower(strings.Join(messages, " "))
	for _, p := range contentPolicyPhrases {
		if strings.Contains(joined, p) {
			return ForbiddenContentPolicy
		}
	}
	for _, p := range accountPhrases {
		if strings.Contains(joined, p) {
			return ForbiddenAccount
		}
	}
	// CLI compat（最低）：access denied 连续子串，或 permission_denied + 固定长前缀
	if strings.Contains(joined, "access denied") {
		return ForbiddenCLICompat
	}
	for _, m := range markers {
		if m == "permission_denied" {
			for _, msg := range messages {
				if strings.HasPrefix(strings.TrimSpace(msg), cliCompatErrorPrefix) {
					return ForbiddenCLICompat
				}
			}
		}
	}
	return ForbiddenUnknown
}

// extractForbiddenSignals 递归收集 marker 键值与 message 文本。
func extractForbiddenSignals(body []byte) (markers []string, messages []string) {
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return nil, []string{string(body)}
	}
	var walk func(v any)
	markerKeys := map[string]struct{}{"code": {}, "error_code": {}, "type": {}, "category": {}, "reason": {}}
	walk = func(v any) {
		switch t := v.(type) {
		case map[string]any:
			for k, val := range t {
				if s, ok := val.(string); ok {
					if _, isMarker := markerKeys[strings.ToLower(k)]; isMarker {
						markers = append(markers, normalizeMarker(s))
					}
					if strings.ToLower(k) == "message" || strings.ToLower(k) == "error" {
						messages = append(messages, s)
					}
				}
				walk(val)
			}
		case []any:
			for _, item := range t {
				walk(item)
			}
		}
	}
	walk(root)
	return markers, messages
}

func normalizeMarker(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run TestClassifyForbidden -v`
Expected: PASS

- [ ] **Step 5: 写 failover 决定失败测试**

```go
func TestDecideActionEnforcesOnceLimits(t *testing.T) {
	// 401：未输出、可重放 → refresh once then retry
	st := &AttemptState{}
	if a := DecideAction(401, ForbiddenUnknown, st, true); a != ActionRefreshRetryOnce {
		t.Fatalf("401 first = %v, want ActionRefreshRetryOnce", a)
	}
	st.RefreshUsed = true
	// 刷新后仍 401 → needs_reauth 停用换候选
	if a := DecideAction(401, ForbiddenUnknown, st, true); a != ActionNeedsReauth {
		t.Fatalf("401 after refresh = %v, want ActionNeedsReauth", a)
	}
}

func TestDecideAction429SingleAlt(t *testing.T) {
	st := &AttemptState{}
	if a := DecideAction(429, ForbiddenUnknown, st, true); a != ActionFailoverAlt {
		t.Fatalf("429 first = %v, want ActionFailoverAlt", a)
	}
	st.AltChannelUsed = true
	if a := DecideAction(429, ForbiddenUnknown, st, true); a != ActionStop {
		t.Fatalf("429 second = %v, want ActionStop", a)
	}
}

func TestDecideAction403Categories(t *testing.T) {
	st := &AttemptState{}
	// content policy：不 refresh/不 failover，返回脱敏
	if a := DecideAction(403, ForbiddenContentPolicy, st, true); a != ActionReturnPolicyError {
		t.Fatalf("content policy = %v, want ActionReturnPolicyError", a)
	}
	// CLI compat：同账号 official fallback 一次
	if a := DecideAction(403, ForbiddenCLICompat, st, true); a != ActionOfficialFallbackOnce {
		t.Fatalf("cli compat = %v, want ActionOfficialFallbackOnce", a)
	}
	st.OfficialFallbackUsed = true
	if a := DecideAction(403, ForbiddenCLICompat, st, true); a != ActionStop {
		t.Fatalf("cli compat second = %v, want ActionStop", a)
	}
	// unknown 403：fail-closed，稳定错误
	if a := DecideAction(403, ForbiddenUnknown, &AttemptState{}, true); a != ActionReturnStable {
		t.Fatalf("unknown 403 = %v, want ActionReturnStable", a)
	}
}

func TestDecideActionNotReplayableNoRetry(t *testing.T) {
	// 已输出语义内容（不可重放）→ 401 也不重试，结束
	st := &AttemptState{}
	if a := DecideAction(401, ForbiddenUnknown, st, false); a != ActionStop {
		t.Fatalf("401 not replayable = %v, want ActionStop", a)
	}
}
```

- [ ] **Step 6: 运行确认失败**

Run: `go test ./relay/channel/groksubscription/ -run TestDecideAction -v`
Expected: FAIL（`DecideAction` undefined）

- [ ] **Step 7: 写 failover 决定实现**

```go
package groksubscription

// Action 是 Grok 专用的重试/换渠道决定。
type Action int

const (
	ActionStop                 Action = iota // 结束当前请求，不再重试/换账号
	ActionRefreshRetryOnce                   // 抢 lease 强制刷新一次并重放
	ActionNeedsReauth                        // 置 needs_reauth、停用当前 channel、转候选
	ActionFailoverAlt                        // 切换到一个不同候选 channel（一次上限）
	ActionOfficialFallbackOnce               // 同账号 official API 回退一次（剥离 CLI headers）
	ActionReturnPolicyError                  // content policy：返回脱敏策略错误，不 failover
	ActionReturnStable                       // unknown：返回稳定脱敏错误，不 refresh/不 fallback
	ActionUseExistingRetry                   // 5xx/连接失败且未输出：走现有 retry/failover
)

// AttemptState 是整条请求生命周期的 attempt 上限状态（refresh/official-fallback/alt 各一次）。
type AttemptState struct {
	RefreshUsed          bool
	OfficialFallbackUsed bool
	AltChannelUsed       bool
}

// DecideAction 按 (status, 403 分类, attempt 状态, 是否可重放) 决定动作。
// replayable=false 表示已写出语义内容或请求体不可安全重放。
func DecideAction(status int, cat ForbiddenCategory, st *AttemptState, replayable bool) Action {
	if st == nil {
		st = &AttemptState{}
	}
	switch status {
	case 401:
		if !replayable {
			return ActionStop
		}
		if !st.RefreshUsed {
			return ActionRefreshRetryOnce
		}
		return ActionNeedsReauth
	case 403:
		switch cat {
		case ForbiddenContentPolicy:
			return ActionReturnPolicyError
		case ForbiddenAccount:
			// 明确账号能力问题且可重放才按既有候选 failover，不进 refresh 循环
			if replayable && !st.AltChannelUsed {
				st.AltChannelUsed = true
				return ActionFailoverAlt
			}
			return ActionReturnStable
		case ForbiddenCLICompat:
			if !st.OfficialFallbackUsed {
				return ActionOfficialFallbackOnce
			}
			return ActionStop
		default:
			return ActionReturnStable
		}
	case 429:
		if replayable && !st.AltChannelUsed {
			st.AltChannelUsed = true
			return ActionFailoverAlt
		}
		return ActionStop
	default:
		if status >= 500 && replayable {
			return ActionUseExistingRetry
		}
		return ActionStop
	}
}
```

- [ ] **Step 8: 运行确认通过**

Run: `go test ./relay/channel/groksubscription/ -run "TestDecideAction|TestClassifyForbidden" -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add relay/channel/groksubscription/errors.go relay/channel/groksubscription/errors_test.go
git commit -m "feat(grok): 403 classifier + attempt-limited failover decision (Grok-only)"
```

> **接线说明**：`DecideAction`/`ClassifyForbidden` 是纯函数，由 Grok 的 `DoResponse`/`DoRequest`（Task 4）在拿到上游非 2xx 时调用，把决定映射成 NewAPIError 的分类码与 `ErrOptionWithSkipRetry()` 等既有选项，从而复用 controller 既有的候选选择/cooldown/计费生命周期，而不改 `shouldRetry` 本身。`AttemptState` 存在 gin context 里跨内部层共享，保证 once 上限不被多层重复触发（设计 §12 末段）。official fallback 的「剥离 CLI headers + 同账号切 `api.x.ai`」在 Task 4 的 `GetRequestURL`/`SetupRequestHeader` 里按 `AttemptState.OfficialFallbackUsed` 分支实现。

---

## Workstream 4（文本相关部分）：管理 UI + 系统设置 + 认证入口

### Task 16: Grok 系统设置段（`setting/system_setting/grok.go`）

设计 §13。照 `copilot.go` 的 `init()` + `config.GlobalConfig.Register` 去中心化注册模式，新增 Grok 系统设置：`password_auth_enabled`（默认 false，ToS/风控风险）、`cli_client_version` 覆盖等。

**Files:**
- Create: `setting/system_setting/grok.go`
- Test: `setting/system_setting/grok_test.go`

- [ ] **Step 1: 写失败测试**

```go
package system_setting

import "testing"

func TestGrokSettingsDefaults(t *testing.T) {
	s := GetGrokSettings()
	if s == nil {
		t.Fatalf("GetGrokSettings must not be nil")
	}
	// 密码登录默认关闭（ToS/风控风险，设计 §12/§13）
	if s.PasswordAuthEnabled {
		t.Fatalf("password auth must default to disabled")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./setting/system_setting/ -run TestGrokSettings -v`
Expected: FAIL

- [ ] **Step 3: 写实现（照 copilot.go）**

```go
package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type GrokSettings struct {
	PasswordAuthEnabled bool   `json:"password_auth_enabled"`
	CLIClientVersion    string `json:"cli_client_version"`
}

var defaultGrokSettings = GrokSettings{
	PasswordAuthEnabled: false,
}

func init() {
	config.GlobalConfig.Register("grok", &defaultGrokSettings)
}

func GetGrokSettings() *GrokSettings {
	return &defaultGrokSettings
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./setting/system_setting/ -run TestGrokSettings -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add setting/system_setting/grok.go setting/system_setting/grok_test.go
git commit -m "feat(grok): decentralized Grok system settings (password auth off by default)"
```

### Task 17: 前端渠道类型元数据登记

设计 §13。web/default 渠道类型元数据五处：`constants.ts`（CHANNEL_TYPES + 显示顺序 + key prompt + warnings）、`channel-type-config.ts`（配置对象）、`channel-utils.ts`（图标）、`api.ts`（Grok auth action 调用）。参照 Copilot（112）的既有登记。

**Files:**
- Modify: `web/default/src/features/channels/constants.ts`
- Modify: `web/default/src/features/channels/channel-type-config.ts`
- Modify: `web/default/src/features/channels/channel-utils.ts`
- Test: `web/default/src/features/channels/__tests__/grok-channel-type.test.ts`（若无测试框架则以类型检查 + 手动核验替代）

- [ ] **Step 1: 加常量（constants.ts）**

在 `CHANNEL_TYPES` 加 `GROK_SUBSCRIPTION: 113`；`CHANNEL_TYPE_DISPLAY_ORDER` 在 Copilot（112）后插入 113；`TYPE_TO_KEY_PROMPT` 加 113 → 提示「通过 OAuth 授权后自动填充，无需手填」；`CHANNEL_TYPE_WARNINGS` 加 113 → 订阅账号共享/合规提示。

```ts
// CHANNEL_TYPES
GROK_SUBSCRIPTION: 113,

// CHANNEL_TYPE_DISPLAY_ORDER: [..., 112, 113, ...]

// TYPE_TO_KEY_PROMPT
[CHANNEL_TYPES.GROK_SUBSCRIPTION]: '通过 Grok 订阅账号 OAuth 授权后自动填充凭证，无需手动填写 Key',
```

- [ ] **Step 2: 加配置对象（channel-type-config.ts:221 附近，照 112）**

```ts
[CHANNEL_TYPES.GROK_SUBSCRIPTION]: {
  label: 'Grok 订阅',
  value: CHANNEL_TYPES.GROK_SUBSCRIPTION,
  keyPlaceholder: '通过 OAuth 授权自动获取，无需手填',
  supportsOAuth: true,
  hideKeyInput: true,
},
```

- [ ] **Step 3: 加图标（channel-utils.ts:118 附近）**

```ts
[CHANNEL_TYPES.GROK_SUBSCRIPTION]: 'Bot', // 或既有 xAI 图标键
```

- [ ] **Step 4: 类型检查 + 核验**

Run: `cd web/default && npx tsc --noEmit`
Expected: 无新增类型错误

手动核验：`rg "GROK_SUBSCRIPTION" web/default/src` 命中五处登记点。

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/channels/
git commit -m "feat(grok): register Grok subscription channel type in frontend metadata"
```

### Task 18: Grok 认证服务端逻辑 + 管理 API + 路由（PKCE start/complete + refresh-token import）

设计 §7、§12、§13。里程碑 A 交付四种入口中风险最低、最通用的两种：**PKCE OAuth start/complete** 与 **refresh-token 直接 import**。SSO 与密码登录（有 ToS/风控风险，默认关）留接口位但里程碑 A 可仅实现 PKCE + import，其余在 §12 明确标注 gated。所有 handler 设 `Cache-Control: no-store`、禁 body 日志、凭证经加密写回 Channel.Key。

**Files:**
- Create: `service/grok_auth.go`
- Create: `controller/grok_auth.go`
- Modify: `router/api-router.go:368`（channelRoute admin 组加 Grok 路由）
- Test: `service/grok_auth_test.go`、`controller/grok_auth_test.go`

- [ ] **Step 1: 写 PKCE start 失败测试（service）**

```go
package service

import (
	"strings"
	"testing"
)

func TestGrokPKCEStartProducesChallenge(t *testing.T) {
	start, err := GrokPKCEStart(42, "https://newapi.example/callback")
	if err != nil {
		t.Fatalf("pkce start err %v", err)
	}
	// 返回 authorize URL 含 code_challenge + S256
	if !strings.Contains(start.AuthorizeURL, "code_challenge=") {
		t.Fatalf("authorize url must carry code_challenge")
	}
	if !strings.Contains(start.AuthorizeURL, "code_challenge_method=S256") {
		t.Fatalf("must use S256")
	}
	// verifier 不出现在返回给前端的 URL 里
	if start.Verifier != "" && strings.Contains(start.AuthorizeURL, start.Verifier) {
		t.Fatalf("verifier must never appear in authorize URL")
	}
	// state 非空，用于回调校验
	if start.State == "" {
		t.Fatalf("state must be set for CSRF protection")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./service/ -run TestGrokPKCEStart -v`
Expected: FAIL

- [ ] **Step 3: 写 PKCE start 实现（service/grok_auth.go）**

```go
package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"

	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
)

// GrokPKCEStartResult 是 PKCE 授权开始的结果。
type GrokPKCEStartResult struct {
	AuthorizeURL string
	State        string
	Verifier     string // 仅用于服务端加密存储，绝不返回前端/日志
}

// GrokPKCEStart 生成 PKCE verifier/challenge + state，构造 authorize URL。
func GrokPKCEStart(channelID int, redirectURI string) (GrokPKCEStartResult, error) {
	if channelID <= 0 || redirectURI == "" {
		return GrokPKCEStartResult{}, errors.New("grok pkce: invalid args")
	}
	verifier, err := randomURLSafe(64)
	if err != nil {
		return GrokPKCEStartResult{}, err
	}
	state, err := randomURLSafe(32)
	if err != nil {
		return GrokPKCEStartResult{}, err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", groksubscription.OAuthClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", groksubscription.OAuthScope)
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")

	return GrokPKCEStartResult{
		AuthorizeURL: groksubscription.OAuthAuthorize + "?" + q.Encode(),
		State:        state,
		Verifier:     verifier,
	}, nil
}

func randomURLSafe(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", errors.New("grok pkce: rng failure")
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
```

> **实现续接**：`GrokPKCEStart` 之后要把 `Verifier` 用 `service.grokCredentialCipher`（Task 5）加密，连同 `State` 的 hash、`channelID`、`redirectURI` 存进 `model.GrokAuthFlow`（Task 5），只把 `AuthorizeURL` + `flow_id` 返回前端。`GrokPKCEComplete(flowID, code, state)` 校验 state hash、claim flow、解密 verifier、调 token endpoint、`ParseCredential` 后加密写回 `Channel.Key`（`UpdateChannelKeyForType`）、置 `GrokChannelState.AuthStatus=active`、consume flow。`GrokImportRefreshToken(channelID, refreshToken)` 直接用 refresh token 走一次 `Refresher.Refresh` 拿到完整凭证再落库。这些子步骤各自 TDD（start→complete→import 三段，每段红-绿-commit），此处给出骨架与红线约束，实现时按同样 TDD 节奏展开。

- [ ] **Step 4: 运行确认通过**

Run: `go test ./service/ -run TestGrokPKCEStart -v`
Expected: PASS

- [ ] **Step 5: 写管理 API handler（controller/grok_auth.go）**

handler 统一设 `c.Header("Cache-Control", "no-store")`，不打 request/response body 日志，错误脱敏。端点：
- `POST /api/channel/grok/pkce/start` → body `{channel_id, redirect_uri}` → `{authorize_url, flow_id}`
- `POST /api/channel/grok/pkce/complete` → body `{flow_id, code, state}` → `{status}`
- `POST /api/channel/grok/import` → body `{channel_id, refresh_token}` → `{status}`
- `POST /api/channel/grok/refresh` → body `{channel_id}` → `{status, quota_snapshot}`

每个 handler 一个红-绿-commit。测试用 gin test context 断言：缺参 400、成功 200、响应头含 `Cache-Control: no-store`、错误信息不含 token 明文。

- [ ] **Step 6: 注册路由（router/api-router.go，channelRoute admin 组 :368 附近）**

```go
	channelRoute.POST("/grok/pkce/start", controller.GrokPKCEStartHandler)
	channelRoute.POST("/grok/pkce/complete", controller.GrokPKCECompleteHandler)
	channelRoute.POST("/grok/import", controller.GrokImportHandler)
	channelRoute.POST("/grok/refresh", controller.GrokRefreshHandler)
```

> `channelRoute` 已挂 `middleware.AdminAuth()`（:345），Grok auth 端点自动要求管理员，无需额外中间件。

- [ ] **Step 7: 运行 + 核验**

Run: `go test ./service/ -run TestGrok -v && go test ./controller/ -run TestGrokAuth -v`
Expected: PASS（controller 全包 suite 超时是既有失败，用 `-run` 过滤）
Run: `go build ./...`（应仅剩既有 embed 错误）

- [ ] **Step 8: Commit**

```bash
git add service/grok_auth.go controller/grok_auth.go router/api-router.go service/grok_auth_test.go controller/grok_auth_test.go
git commit -m "feat(grok): PKCE OAuth start/complete + refresh-token import auth endpoints"
```

### Task 19: Grok 认证 UI 抽屉（PKCE 授权 + import + 状态展示）+ i18n

设计 §13。渠道编辑页对 Grok 渠道展示专用认证抽屉：PKCE「开始授权」按钮（打开 authorize URL 新窗）+ 回调后轮询/手动完成、refresh-token import 输入、当前认证状态/billing plan/quota 快照展示、手动刷新按钮。照 Copilot device flow UI（`api.ts:340-360` 的 `channelActionConfig()` helper）。i18n 补 8 语言。

**Files:**
- Modify: `web/default/src/features/channels/api.ts`（Grok auth action 调用）
- Create: `web/default/src/features/channels/components/GrokAuthDrawer.tsx`（或既有抽屉扩展）
- Modify: 渠道编辑组件（挂载 Grok 抽屉）
- Modify: `web/default/src/i18n/locales/*.json`（8 语言）

- [ ] **Step 1: 加 api.ts action 调用（照 startCopilotDeviceFlow）**

```ts
export async function startGrokPKCE(channelId: number, redirectUri: string) {
  return channelActionConfig('/api/channel/grok/pkce/start', { channel_id: channelId, redirect_uri: redirectUri });
}
export async function completeGrokPKCE(flowId: string, code: string, state: string) {
  return channelActionConfig('/api/channel/grok/pkce/complete', { flow_id: flowId, code, state });
}
export async function importGrokRefreshToken(channelId: number, refreshToken: string) {
  return channelActionConfig('/api/channel/grok/import', { channel_id: channelId, refresh_token: refreshToken });
}
export async function refreshGrokState(channelId: number) {
  return channelActionConfig('/api/channel/grok/refresh', { channel_id: channelId });
}
```

- [ ] **Step 2: 写 Grok 认证抽屉组件**

组件展示：认证状态徽标（pending/active/needs_reauth）、「开始 OAuth 授权」按钮（`startGrokPKCE` → `window.open(authorize_url)`）、回调 code/state 手动粘贴或轮询完成、refresh-token import textarea + 「导入」、billing plan + quota 快照卡片、「刷新状态」按钮。refresh token 输入框 `type=password` 且提交后清空，绝不回显。

- [ ] **Step 3: 挂载到渠道编辑页**

渠道 `type === 113` 时渲染 `<GrokAuthDrawer channelId={...} />`，隐藏原始 Key 输入框（`hideKeyInput`）。

- [ ] **Step 4: i18n 补 8 语言**

`web/default/src/i18n/locales/{zh,en,es,fr,ja,pt,ru,vi}.json` 各加 Grok 认证相关文案键（授权按钮、状态标签、导入提示、风险提示）。

- [ ] **Step 5: 类型检查 + 手动核验**

Run: `cd web/default && npx tsc --noEmit`
Expected: 无新增类型错误

手动核验：起前端 dev server，Grok 渠道编辑页显示认证抽屉、无原始 Key 输入框、状态徽标渲染正确。

- [ ] **Step 6: Commit**

```bash
git add web/default/src/features/channels/ web/default/src/i18n/locales/
git commit -m "feat(grok): Grok subscription auth drawer (PKCE + import + status) with i18n"
```

---

## 里程碑 A 收尾验证

设计 §16、§19（1、2、3、5、6 文本部分、7、8、9、10 条）。

- [ ] **Step 1: 全包回归对比**

Run: `go build ./... 2>&1 | grep -v "web/classic/dist"`（应仅剩既有 embed 错误）
Run: `go test -timeout 90s ./... > /tmp/grok-after.txt 2>&1`（或 worktree 内临时文件）
对比 `docs/superpowers/plans/baseline-2026-08-17.txt`：**7 个既有失败包的失败集合与形态不扩大、无新增失败包**。新增失败 = 未完成。

- [ ] **Step 2: Grok targeted 全绿**

Run: `go test ./relay/channel/groksubscription/ ./constant/ ./common/ -v`
Run: `go test ./model/ -run TestGrok -v && go test ./service/ -run TestGrok -v && go test ./controller/ -run TestGrok -v && go test ./relay/ -run "TestGrok|TestShouldClaudeUseResponsesBridgeForGrok" -v`
Expected: 全部 PASS

- [ ] **Step 3: 秘密零泄漏审计**

Run: `rg -n "access_token|refresh_token|pkce_verifier|Authorization" relay/channel/groksubscription service/grok_auth.go controller/grok_auth.go`
人工核对：无 `logger.*`/`fmt.Print*`/`c.JSON` 直接输出上述明文；凭证只经 cipher 加密或写 Channel.Key；日志里 ApiKey 已被既有 mask 机制遮蔽。

- [ ] **Step 4: 代码评审**

按 [[feedback_codereview_workflow]]：用 `ocr review`（router.flatkey.ai + claude-opus-4-8）+ superpowers code-review skill 对本里程碑全部改动做正式评审，跳过 `.md`。评审发现的问题回到对应 Task 修复。

- [ ] **Step 5: 里程碑 A 完成标记**

全部绿 + 评审通过后，在本计划顶部标注「里程碑 A 完成」，并更新记忆 [[project_grok_subscription_channel]] 记录进度，规划里程碑 B。

---

## 附：里程碑 B（另出计划，此处仅登记边界）

图片（`/v1/images/generations`+`/edits`）、视频（generate/fetch/remix + **新增 edit/extend task action**）、TTS/STT、自定义声音资源绑定、Realtime WebSocket。均要求有效正向 paid entitlement 证据才 fail-open，否则 fail closed 要求先刷新 quota。媒体 host（`api.x.ai` region 变体）在 Task 4 已定义常量，里程碑 B 放开 adaptor 的媒体端点分流。

