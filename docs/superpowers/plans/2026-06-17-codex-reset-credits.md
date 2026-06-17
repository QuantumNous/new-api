# Codex 限流重置券（查询 + 消费）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员在「Codex 账户和用量」弹窗内查看 Codex 账号剩余限流重置券数量，并二次确认后手动消费一张券立即重置限流窗口。

**Architecture:** 复用现有 codex usage 链路。展示侧零后端改动（`available_count` 已随 `/codex/usage` 透传）；消费侧新增 `service.ConsumeCodexResetCredit`（调上游 `POST /backend-api/wham/rate-limit-reset-credits/consume`）+ 一个 AdminAuth 路由 + 一个 controller handler（复用现有 401/403 刷 token 骨架）。前端在弹窗内加「剩余次数 badge + 消费按钮 + 二次确认」，两个挂载点同步接线，新增 i18n key。

**Tech Stack:** Go 1.22 / Gin / GORM；React 19 / TypeScript / Rsbuild / Base UI / Tailwind；i18next（8 语言）；`github.com/google/uuid v1.6.0`。

## Global Constraints

- JSON 序列化只用 `common.Marshal` / `common.Unmarshal`（CLAUDE.md Rule 1），禁止直接 `encoding/json`。
- 上游 consume body 形状（已从 sub2api 源码核实，不可臆改）：`{"redeem_request_id": "<uuid-v4>"}`，UUID 用 `common.GetUUID()`。
- 上游 consume URL：`POST {baseURL}/backend-api/wham/rate-limit-reset-credits/consume`。
- 上游 consume headers：`Authorization: Bearer <access_token>`、`chatgpt-account-id: <account_id>`、`content-type: application/json`、`originator: Codex Desktop`、`oai-language: zh-CN`、`accept: application/json`、`sec-fetch-site: none`、`sec-fetch-mode: no-cors`、`sec-fetch-dest: empty`、`priority: u=4, i`。
- 剩余次数字段路径：`data.rate_limit_reset_credits.available_count`（int，缺失视为 0）。
- 消费按钮**仅 `available_count > 0` 时可点**；点击必须经**二次确认弹窗**才调接口。
- 新 i18n key 必须写入 `web/default/src/i18n/locales/` 全部 8 个文件并真实翻译（禁止英文占位）；改完跑 `bun run i18n:sync`。
- 不在日志/响应泄露 access_token、上游 host、真实模型名（whitelabel）。
- 所有 git 操作用 `git -C <worktree>`，分支 `worktree-codex-reset-credits`，禁止落 main。

---

### Task 1: 后端 service `ConsumeCodexResetCredit`

**Files:**
- Create: `service/codex_reset_credit.go`
- Test: `service/codex_reset_credit_test.go`

**Interfaces:**
- Consumes: 无（纯函数，依赖注入 `*http.Client` 与 `baseURL`）。
- Produces: `func ConsumeCodexResetCredit(ctx context.Context, client *http.Client, baseURL, accessToken, accountID string) (statusCode int, body []byte, err error)`（供 Task 2 的 controller 调用）。

- [ ] **Step 1: 写失败测试**

`service/codex_reset_credit_test.go`：

```go
package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestConsumeCodexResetCreditSendsExpectedRequest(t *testing.T) {
	var (
		gotMethod    string
		gotPath      string
		gotAuth      string
		gotAccount   string
		gotOrigin    string
		gotContent   string
		gotBodyKeys  map[string]string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotAccount = r.Header.Get("chatgpt-account-id")
		gotOrigin = r.Header.Get("originator")
		gotContent = r.Header.Get("content-type")
		raw, _ := io.ReadAll(r.Body)
		_ = common.Unmarshal(raw, &gotBodyKeys)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":"ok","windows_reset":1}`))
	}))
	defer srv.Close()

	status, body, err := ConsumeCodexResetCredit(
		context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("method = %s, want POST", gotMethod)
	}
	if gotPath != "/backend-api/wham/rate-limit-reset-credits/consume" {
		t.Fatalf("path = %s", gotPath)
	}
	if gotAuth != "Bearer tok-abc" {
		t.Fatalf("authorization = %q", gotAuth)
	}
	if gotAccount != "acct-123" {
		t.Fatalf("chatgpt-account-id = %q", gotAccount)
	}
	if gotOrigin != "Codex Desktop" {
		t.Fatalf("originator = %q, want Codex Desktop", gotOrigin)
	}
	if !strings.HasPrefix(gotContent, "application/json") {
		t.Fatalf("content-type = %q", gotContent)
	}
	if id := strings.TrimSpace(gotBodyKeys["redeem_request_id"]); id == "" {
		t.Fatalf("redeem_request_id missing in body: %#v", gotBodyKeys)
	}
	if !strings.Contains(string(body), "windows_reset") {
		t.Fatalf("body not passed through: %s", body)
	}
}

func TestConsumeCodexResetCreditValidatesArgs(t *testing.T) {
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "", "tok", "acct"); err == nil {
		t.Fatal("expected error for empty baseURL")
	}
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "https://x", "", "acct"); err == nil {
		t.Fatal("expected error for empty accessToken")
	}
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "https://x", "tok", ""); err == nil {
		t.Fatal("expected error for empty accountID")
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./service/ -run TestConsumeCodexResetCredit -v`
Expected: FAIL（`undefined: ConsumeCodexResetCredit`）

- [ ] **Step 3: 写最小实现**

`service/codex_reset_credit.go`：

```go
package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ConsumeCodexResetCredit redeems one rate-limit reset credit for a Codex
// account by calling the upstream consume endpoint. The caller owns token
// refresh on 401/403; this function performs a single request.
func ConsumeCodexResetCredit(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	accessToken string,
	accountID string,
) (statusCode int, body []byte, err error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	bu := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if bu == "" {
		return 0, nil, fmt.Errorf("empty baseURL")
	}
	at := strings.TrimSpace(accessToken)
	aid := strings.TrimSpace(accountID)
	if at == "" {
		return 0, nil, fmt.Errorf("empty accessToken")
	}
	if aid == "" {
		return 0, nil, fmt.Errorf("empty accountID")
	}

	payload, err := common.Marshal(map[string]string{"redeem_request_id": common.GetUUID()})
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		bu+"/backend-api/wham/rate-limit-reset-credits/consume",
		bytes.NewReader(payload),
	)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+at)
	req.Header.Set("chatgpt-account-id", aid)
	req.Header.Set("content-type", "application/json")
	req.Header.Set("originator", "Codex Desktop")
	req.Header.Set("oai-language", "zh-CN")
	req.Header.Set("accept", "application/json")
	req.Header.Set("sec-fetch-site", "none")
	req.Header.Set("sec-fetch-mode", "no-cors")
	req.Header.Set("sec-fetch-dest", "empty")
	req.Header.Set("priority", "u=4, i")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, body, nil
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./service/ -run TestConsumeCodexResetCredit -v`
Expected: PASS（两个用例）

- [ ] **Step 5: 提交**

```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" add service/codex_reset_credit.go service/codex_reset_credit_test.go
git -C "$WT" commit -m "feat(codex): add ConsumeCodexResetCredit upstream service"
```

---

### Task 2: 后端 controller handler + 路由（复用刷 token 骨架）

**Files:**
- Modify: `controller/codex_usage.go`（抽 helper + 新 handler）
- Modify: `router/api-router.go:276`（+1 路由）

**Interfaces:**
- Consumes: `service.ConsumeCodexResetCredit`（Task 1）；现有 `fetchCodexChannelUsageRefresh` / `rebuildCodexChannelCache`。
- Produces: `func ConsumeCodexResetCredit(c *gin.Context)`（供路由注册）；内部 helper `func codexChannelUpstreamWithRefresh(ctx context.Context, ch *model.Channel, do func(client *http.Client, accessToken, accountID string) (int, []byte, error)) (int, []byte, bool, error)`。

- [ ] **Step 1: 抽出共用刷 token helper**

在 `controller/codex_usage.go` 中新增内部 helper，把 `fetchCodexChannelUsageRefresh` 里「解析 OAuthKey → proxy client → 调用 → 401/403 刷 token + 持久化 + 重试」骨架参数化为可注入上游调用：

```go
// codexChannelUpstreamWithRefresh runs an authenticated upstream call for a
// Codex channel, retrying once with a refreshed OAuth token on 401/403. It
// returns refreshed=true when the channel key was rotated and persisted (the
// caller is responsible for rebuilding the channel cache).
func codexChannelUpstreamWithRefresh(
	ctx context.Context,
	ch *model.Channel,
	do func(client *http.Client, accessToken, accountID string) (int, []byte, error),
) (int, []byte, bool, error) {
	if ch == nil {
		return 0, nil, false, errors.New("channel not found")
	}
	if ch.Type != constant.ChannelTypeCodex {
		return 0, nil, false, errors.New("channel type is not Codex")
	}
	if ch.ChannelInfo.IsMultiKey {
		return 0, nil, false, errors.New("multi-key channel is not supported")
	}

	oauthKey, err := codex.ParseOAuthKey(strings.TrimSpace(ch.Key))
	if err != nil {
		return 0, nil, false, err
	}
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	if accessToken == "" {
		return 0, nil, false, errors.New("codex channel: access_token is required")
	}
	if accountID == "" {
		return 0, nil, false, errors.New("codex channel: account_id is required")
	}

	client, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		return 0, nil, false, err
	}

	statusCode, body, err := do(client, accessToken, accountID)
	if err != nil {
		return statusCode, nil, false, err
	}

	refreshed := false
	if (statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden) && strings.TrimSpace(oauthKey.RefreshToken) != "" {
		refreshCtx, refreshCancel := context.WithTimeout(ctx, 10*time.Second)
		defer refreshCancel()

		res, refreshErr := service.RefreshCodexOAuthTokenWithProxy(refreshCtx, oauthKey.RefreshToken, ch.GetSetting().Proxy)
		if refreshErr == nil {
			oauthKey.AccessToken = res.AccessToken
			oauthKey.RefreshToken = res.RefreshToken
			oauthKey.LastRefresh = time.Now().Format(time.RFC3339)
			oauthKey.Expired = res.ExpiresAt.Format(time.RFC3339)
			if strings.TrimSpace(oauthKey.Type) == "" {
				oauthKey.Type = "codex"
			}
			encoded, encErr := common.Marshal(oauthKey)
			if encErr == nil {
				if updateErr := model.UpdateChannelKey(ch.Id, string(encoded)); updateErr == nil {
					refreshed = true
				}
			}
			statusCode, body, err = do(client, oauthKey.AccessToken, accountID)
			if err != nil {
				return statusCode, nil, refreshed, err
			}
		}
	}

	return statusCode, body, refreshed, nil
}
```

然后把现有 `fetchCodexChannelUsageRefresh` 改写为基于该 helper（保持其对外签名 `(int, []byte, bool, error)` 不变，`runCodexLimitReport` 等调用方无需改动）：

```go
func fetchCodexChannelUsageRefresh(ctx context.Context, ch *model.Channel) (int, []byte, bool, error) {
	return codexChannelUpstreamWithRefresh(ctx, ch, func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
		reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		return service.FetchCodexWhamUsage(reqCtx, client, ch.GetBaseURL(), accessToken, accountID)
	})
}
```

- [ ] **Step 2: 运行既有测试确认重构未破坏**

Run: `go test ./controller/ -run Codex -v`
Expected: PASS（`TestRunCodexLimitReport...` 等既有用例仍通过）

- [ ] **Step 3: 新增 consume handler**

在 `controller/codex_usage.go` 追加：

```go
func ConsumeCodexResetCredit(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}

	ch, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ch == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel not found"})
		return
	}

	statusCode, body, refreshed, err := codexChannelUpstreamWithRefresh(
		c.Request.Context(), ch,
		func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
			reqCtx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
			defer cancel()
			return service.ConsumeCodexResetCredit(reqCtx, client, ch.GetBaseURL(), accessToken, accountID)
		},
	)
	if refreshed {
		rebuildCodexChannelCache()
	}
	if err != nil {
		common.SysError("failed to consume codex reset credit: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	var payload any
	if common.Unmarshal(body, &payload) != nil {
		payload = string(body)
	}
	ok := statusCode >= 200 && statusCode < 300
	resp := gin.H{
		"success":         ok,
		"message":         "",
		"upstream_status": statusCode,
		"data":            payload,
	}
	if !ok {
		resp["message"] = fmt.Sprintf("upstream status: %d", statusCode)
	}
	c.JSON(http.StatusOK, resp)
}
```

- [ ] **Step 4: 注册路由**

在 `router/api-router.go` 第 276 行（`channelRoute.GET("/:id/codex/usage", ...)`）后新增一行：

```go
			channelRoute.POST("/:id/codex/reset-credit", controller.ConsumeCodexResetCredit)
```

- [ ] **Step 5: 构建 + vet + 全 codex 测试**

Run:
```
go build ./controller/ ./service/ ./router/
go vet ./controller/ ./service/
go test ./controller/ ./service/ -run Codex
```
Expected: 全部成功，0 失败。

- [ ] **Step 6: 提交**

```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" add controller/codex_usage.go router/api-router.go
git -C "$WT" commit -m "feat(codex): admin endpoint to consume rate-limit reset credit"
```

---

### Task 3: 前端 API 客户端 + 弹窗 UI + 二次确认

**Files:**
- Modify: `web/default/src/features/channels/api.ts`
- Modify: `web/default/src/features/channels/components/dialogs/codex-usage-dialog.tsx`

**Interfaces:**
- Consumes: 后端 `POST /api/channel/:id/codex/reset-credit`（Task 2）。
- Produces: `consumeCodexReset(channelId: number): Promise<CodexUsageResponse>`；`CodexUsageDialog` 新增可选 props `onConsume?: () => void`、`isConsuming?: boolean`、`resetCredits?: number`（由父组件从 payload 读出或由弹窗自读，见实现）。

- [ ] **Step 1: 新增 api 客户端函数**

在 `web/default/src/features/channels/api.ts` 的 `getCodexUsage` 之后追加（复用 `CodexUsageResponse` 类型与 `channelActionConfig`）：

```ts
export async function consumeCodexReset(
  channelId: number
): Promise<CodexUsageResponse> {
  const res = await api.post(
    `/api/channel/${channelId}/codex/reset-credit`,
    {},
    channelActionConfig({ disableDuplicate: true })
  )
  return res.data
}
```

- [ ] **Step 2: 弹窗类型增字段 + props**

在 `codex-usage-dialog.tsx`：

`CodexUsagePayload`（第 63–70 行）增字段：

```ts
type CodexUsagePayload = {
  plan_type?: string
  user_id?: string
  email?: string
  account_id?: string
  rate_limit?: CodexRateLimit
  additional_rate_limits?: CodexAdditionalRateLimit[]
  rate_limit_reset_credits?: { available_count?: number }
}
```

`CodexUsageDialogProps`（第 79–87 行）增 props：

```ts
type CodexUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  channelId?: number
  response: CodexUsageDialogData | null
  onRefresh?: () => void
  isRefreshing?: boolean
  onConsume?: () => void
  isConsuming?: boolean
}
```

- [ ] **Step 3: 弹窗内读出剩余次数并渲染 badge + 消费按钮 + 二次确认**

在 `CodexUsageDialog` 组件体内（`additionalRateLimits` 定义之后）加：

```tsx
  const resetCredits = Number(
    payload?.rate_limit_reset_credits?.available_count ?? 0
  )
  const canConsume = Number.isFinite(resetCredits) && resetCredits > 0
  const [confirmOpen, setConfirmOpen] = useState(false)
```

在账户摘要卡片的「刷新」按钮（约 462–473 行）所在的 `flex` 容器内，紧跟刷新按钮后插入剩余次数 badge 与消费按钮：

```tsx
            {onConsume && (
              <>
                <StatusBadge
                  label={`${t('Remaining Resets')}: ${resetCredits}`}
                  variant={canConsume ? 'info' : 'danger'}
                  copyable={false}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canConsume || Boolean(isConsuming)}
                >
                  <Zap className='mr-1.5 h-3.5 w-3.5' />
                  {t('Consume one reset')}
                </Button>
              </>
            )}
```

在组件返回的 `<Dialog>` 之后（同级，函数 return 的 fragment 里）加二次确认 Dialog：

```tsx
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Reset rate limit now?')}
        contentHeight='auto'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setConfirmOpen(false)}
              disabled={Boolean(isConsuming)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              onClick={() => {
                setConfirmOpen(false)
                onConsume?.()
              }}
              disabled={!canConsume || Boolean(isConsuming)}
            >
              {t('Consume one reset')}
            </Button>
          </>
        }
      >
        <div className='space-y-2 text-sm'>
          <p>
            {t(
              'This will consume 1 reset credit and immediately reset the rate limit window.'
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t('Email')}: {payload?.email || '-'} · {t('Remaining Resets')}:{' '}
            {resetCredits}
          </p>
        </div>
      </Dialog>
```

注意：现有 `return (<Dialog ...>...</Dialog>)` 需改为 `return (<>{<Dialog .../>}{确认 Dialog}</>)` 以容纳两个 Dialog。

在文件顶部 lucide 导入（第 20–29 行）补 `Zap`：

```ts
import {
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Hash,
  Zap,
} from 'lucide-react'
```

- [ ] **Step 4: typecheck**

Run（在 `web/default/`）：`bun run typecheck`
Expected: 0 error。

- [ ] **Step 5: 提交**

```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" add web/default/src/features/channels/api.ts web/default/src/features/channels/components/dialogs/codex-usage-dialog.tsx
git -C "$WT" commit -m "feat(codex): reset-credit badge, consume button and confirm in usage dialog"
```

---

### Task 4: 两个挂载点接线（channels-columns + balance-query-dialog）

**Files:**
- Modify: `web/default/src/features/channels/components/channels-columns.tsx`（约 301–303 行 state、413–435 行 `<CodexUsageDialog>`）
- Modify: `web/default/src/features/channels/components/dialogs/balance-query-dialog.tsx`（约 53–54 行 state、63 行 fetch、142–149 行 render）

**Interfaces:**
- Consumes: `consumeCodexReset`（Task 3）、`CodexUsageDialog` 的 `onConsume/isConsuming`（Task 3）。
- Produces: 无（终端接线）。

- [ ] **Step 1: channels-columns.tsx 接线**

import 处加入 `consumeCodexReset`（与现有 `getCodexUsage` 同一 import 行/同文件）。在现有 `codexUsageOpen`/`codexUsageResponse` state（约 301–303 行）旁加：

```tsx
  const [codexConsuming, setCodexConsuming] = useState(false)
```

新增 handler（紧邻现有打开弹窗的 `handleClickUpdate` 之后）：

```tsx
  const handleConsumeCodexReset = async (channelId: number) => {
    setCodexConsuming(true)
    try {
      const res = await consumeCodexReset(channelId)
      if (res?.success) {
        const windows = Number(
          (res.data as { windows_reset?: number })?.windows_reset ?? 0
        )
        showSuccess(t('Reset {{count}} windows', { count: windows }))
        const refreshed = await getCodexUsage(channelId)
        setCodexUsageResponse(refreshed)
      } else {
        showError(res?.message || t('Failed to consume reset credit'))
      }
    } catch (e) {
      showError(t('Failed to consume reset credit'))
    } finally {
      setCodexConsuming(false)
    }
  }
```

> 说明：`showSuccess` / `showError` / `t` 在本文件已有使用（沿用现有同名 import；若缺失则从现有 helper 模块按本文件既有方式引入）。

在 `<CodexUsageDialog ... />`（约 413–435 行）补两个 props：

```tsx
            onConsume={() =>
              codexUsageChannelId != null &&
              handleConsumeCodexReset(codexUsageChannelId)
            }
            isConsuming={codexConsuming}
```

> 说明：`codexUsageChannelId` 为当前打开弹窗对应的 channel id——若本文件用的是 `codexUsageResponse` 内的 id 或单独 state，按现有方式取当前 channel id 传入（与传给 `onRefresh` 的 id 一致）。

- [ ] **Step 2: balance-query-dialog.tsx 接线**

同样 import `consumeCodexReset`，加 `codexConsuming` state 与等价 `handleConsumeCodexReset`，在其 `<CodexUsageDialog ... />`（约 142–149 行）补 `onConsume` / `isConsuming`，与现有 `onRefresh` 用同一 channel id。逻辑与 Step 1 完全一致（成功后调本文件已用的 usage 拉取函数刷新 response）。

- [ ] **Step 3: typecheck + build**

Run（在 `web/default/`）：
```
bun run typecheck
bun run build
```
Expected: typecheck 0 error；build 成功产物。

- [ ] **Step 4: 提交**

```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" add web/default/src/features/channels/components/channels-columns.tsx web/default/src/features/channels/components/dialogs/balance-query-dialog.tsx
git -C "$WT" commit -m "feat(codex): wire consume reset credit into both usage-dialog mount points"
```

---

### Task 5: i18n（8 语言）+ sync 校验

**Files:**
- Modify: `web/default/src/i18n/locales/{en,zh,ja,fr,ru,vi,es,pt}.json`

**Interfaces:**
- Consumes: Task 3/4 中用到的所有 `t(...)` key。
- Produces: 无。

- [ ] **Step 1: 在 8 个 locale 文件加入新 key 的真实翻译**

新 key（英文源串即 key）：`Remaining Resets`、`Consume one reset`、`Reset rate limit now?`、`This will consume 1 reset credit and immediately reset the rate limit window.`、`Reset {{count}} windows`、`Failed to consume reset credit`。`Cancel`/`Email`/`Refresh` 等若已存在则复用，勿重复添加。

各语言参考译文（按现有文件风格插入，保持 `{{count}}` 占位不翻译）：

- en（`en.json`，值=key 原文）：
  - `"Remaining Resets": "Remaining Resets"`
  - `"Consume one reset": "Consume one reset"`
  - `"Reset rate limit now?": "Reset rate limit now?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "This will consume 1 reset credit and immediately reset the rate limit window."`
  - `"Reset {{count}} windows": "Reset {{count}} windows"`
  - `"Failed to consume reset credit": "Failed to consume reset credit"`
- zh（`zh.json`）：
  - `"Remaining Resets": "剩余重置次数"`
  - `"Consume one reset": "消费一次重置"`
  - `"Reset rate limit now?": "立即重置限流？"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "将消费 1 次重置券，并立即重置限流窗口。"`
  - `"Reset {{count}} windows": "已重置 {{count}} 个窗口"`
  - `"Failed to consume reset credit": "消费重置券失败"`
- ja（`ja.json`）：
  - `"Remaining Resets": "残りリセット回数"`
  - `"Consume one reset": "リセットを1回消費"`
  - `"Reset rate limit now?": "今すぐレート制限をリセットしますか？"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "リセットクレジットを1回消費し、レート制限ウィンドウを即座にリセットします。"`
  - `"Reset {{count}} windows": "{{count}} 個のウィンドウをリセットしました"`
  - `"Failed to consume reset credit": "リセットクレジットの消費に失敗しました"`
- fr（`fr.json`）：
  - `"Remaining Resets": "Réinitialisations restantes"`
  - `"Consume one reset": "Consommer une réinitialisation"`
  - `"Reset rate limit now?": "Réinitialiser la limite maintenant ?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "Cela consommera 1 crédit de réinitialisation et réinitialisera immédiatement la fenêtre de limite de débit."`
  - `"Reset {{count}} windows": "{{count}} fenêtres réinitialisées"`
  - `"Failed to consume reset credit": "Échec de la consommation du crédit de réinitialisation"`
- ru（`ru.json`）：
  - `"Remaining Resets": "Осталось сбросов"`
  - `"Consume one reset": "Использовать один сброс"`
  - `"Reset rate limit now?": "Сбросить лимит сейчас?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "Будет использован 1 кредит сброса и немедленно сброшено окно ограничения скорости."`
  - `"Reset {{count}} windows": "Сброшено окон: {{count}}"`
  - `"Failed to consume reset credit": "Не удалось использовать кредит сброса"`
- vi（`vi.json`）：
  - `"Remaining Resets": "Số lần đặt lại còn lại"`
  - `"Consume one reset": "Dùng một lần đặt lại"`
  - `"Reset rate limit now?": "Đặt lại giới hạn ngay bây giờ?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "Thao tác này sẽ dùng 1 tín dụng đặt lại và đặt lại ngay cửa sổ giới hạn tốc độ."`
  - `"Reset {{count}} windows": "Đã đặt lại {{count}} cửa sổ"`
  - `"Failed to consume reset credit": "Không thể dùng tín dụng đặt lại"`
- es（`es.json`）：
  - `"Remaining Resets": "Reinicios restantes"`
  - `"Consume one reset": "Consumir un reinicio"`
  - `"Reset rate limit now?": "¿Restablecer el límite ahora?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "Esto consumirá 1 crédito de reinicio y restablecerá de inmediato la ventana de límite de tasa."`
  - `"Reset {{count}} windows": "{{count}} ventanas restablecidas"`
  - `"Failed to consume reset credit": "No se pudo consumir el crédito de reinicio"`
- pt（`pt.json`）：
  - `"Remaining Resets": "Reinícios restantes"`
  - `"Consume one reset": "Consumir um reinício"`
  - `"Reset rate limit now?": "Redefinir o limite agora?"`
  - `"This will consume 1 reset credit and immediately reset the rate limit window.": "Isto consumirá 1 crédito de reinício e redefinirá imediatamente a janela de limite de taxa."`
  - `"Reset {{count}} windows": "{{count}} janelas redefinidas"`
  - `"Failed to consume reset credit": "Falha ao consumir o crédito de reinício"`

- [ ] **Step 2: 运行 i18n:sync 并核对未翻译报告**

Run（在 `web/default/`）：`bun run i18n:sync`
然后检查 `web/default/src/i18n/locales/_reports/{lang}.untranslated.json` **不含**本次新增的 6 个 key。
Expected: 报告中无本次 key（若有，回 Step 1 补译）。

- [ ] **Step 3: 提交**

```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" add web/default/src/i18n/locales/
git -C "$WT" commit -m "i18n(codex): add reset-credit strings for 8 locales"
```

---

### Task 6: 端到端验证与收尾

**Files:** 无新增改动（验证 + 可能的修复）。

- [ ] **Step 1: 全量后端构建与测试**

Run:
```
go build ./...
go vet ./controller/ ./service/ ./router/
go test ./controller/ ./service/
```
Expected: 全部成功。

- [ ] **Step 2: 前端构建**

Run（在 `web/default/`）：`bun run lint && bun run typecheck && bun run build`
Expected: 全部成功。

- [ ] **Step 3: 手动验证（需一个有重置券的 Codex 渠道）**

- 渠道页筛选 Codex → 点某行「账户信息」→ 弹窗显示「剩余重置次数: N」。
- N=0 时消费按钮 disabled；N>0 时可点。
- 点消费 → 二次确认弹窗 → 确认 → toast「已重置 N 个窗口」→ 弹窗用量自动刷新，`available_count` 减 1、限流窗口 used_percent 归零。
- 上游报错时 toast 错误、用量不变。

> 注：你的 #17 账号 `available_count=0`，仅能验证「禁用态」；验证消费成功路径需选一个有券的账号。

- [ ] **Step 4: detect_changes（GitNexus）确认改动范围**

Run `gitnexus_detect_changes()`，确认仅影响预期符号（codex usage / 新 service / 路由）。HIGH/CRITICAL 风险需复核。

- [ ] **Step 5: 收尾**

确认所有 commit 在 `worktree-codex-reset-credits` 分支、未落 main：
```bash
WT=/Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/codex-reset-credits
git -C "$WT" log --oneline origin/main..HEAD
git -C "$WT" rev-list --left-right --count origin/main...main
```
Expected: 本功能 commit 全在分支；`main` 侧计数为 0。
```

## Self-Review

**Spec coverage（逐节核对）：**
- §2.1 查询字段透传 → Task 3 Step 2/3（前端读 `rate_limit_reset_credits.available_count`），后端无需改 ✅
- §2.2 consume 接口（URL/headers/body/uuid）→ Task 1（service）+ Global Constraints ✅
- §4.1 service 文件 → Task 1 ✅
- §4.2 controller 抽 helper + handler → Task 2 ✅
- §4.3 路由 → Task 2 Step 4 ✅
- §5.1 弹窗 UI/二次确认/onConsume props → Task 3 ✅
- §5.2 api.ts → Task 3 Step 1 ✅
- §5.3 两挂载点 → Task 4 ✅
- §5.4 i18n 8 语言 + sync → Task 5 ✅
- §6 错误处理/边界（available_count=0 禁用、缺失视为 0、401 刷新、multi-key 拦截）→ Task 2 helper + Task 3 `canConsume` ✅
- §7 安全/whitelabel（AdminAuth 路由组、二次确认、透传不泄露）→ Task 2 + Task 3 ✅
- §8 测试 → Task 1（service httptest）、Task 2（既有 codex 测试回归）、Task 6（前端 build + 手动）✅
  - 偏差说明：前端无 testing-library / 组件测试框架，故前端以 typecheck/build/lint + 手动验证替代组件单测（遵循仓库现状，不臆造测试框架）。

**Placeholder scan：** 无 TBD/TODO；所有代码步骤给出完整代码。两处「说明」注释（`codexUsageChannelId`、`showSuccess/showError` 来源）是因这两个标识符在父组件已存在、需按现有命名取用——执行者应读当前文件确认精确名称，不是占位逻辑。

**Type consistency：** `ConsumeCodexResetCredit(ctx, client, baseURL, accessToken, accountID)`（Task 1 定义）↔ Task 2 调用一致；`codexChannelUpstreamWithRefresh` 签名 Task 2 内自洽；前端 `consumeCodexReset(channelId)`、`onConsume/isConsuming/rate_limit_reset_credits` 在 Task 3/4 一致。
