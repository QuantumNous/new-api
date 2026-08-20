package groksubscription

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// 说明：DoResponse 的 Responses→Chat 转换（RelayModeChatCompletions 分支）复用
// openai.OaiResponsesToChatHandler / OaiResponsesToChatStreamHandler，其行为由
// openai 包自身的 handler 测试覆盖；此处只锁住 adaptor 自己的 wire-format 不变量：
// GetRequestURL 路由、SetupRequestHeader 注入/不泄漏、ConvertOpenAIRequest 产出
// Responses 体（与 URL=/v1/responses 形成闭环，证明请求方向自洽、不依赖任何全局开关）。

func validGrokCredential(t *testing.T) string {
	t.Helper()
	cred := Credential{
		AccessToken:  "test-access-token",
		RefreshToken: "test-refresh-token",
		TokenType:    "Bearer",
		ExpiresAt:    9999999999,
	}
	raw, err := cred.Serialize()
	if err != nil {
		t.Fatalf("serialize credential: %v", err)
	}
	return raw
}

func newTestGinContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	// SetupApiRequestHeader 会读 c.Request.Header，必须非 nil。
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

// TestGetRequestURL_Routing 锁住里程碑 A 的文本路由矩阵：Chat / Responses /
// Claude-format 全部落 CLI proxy 的 /v1/responses；其它端点 fail closed。
func TestGetRequestURL_Routing(t *testing.T) {
	a := &Adaptor{}
	want := CLIProxyBase + CLIResponsesPath

	cases := []struct {
		name      string
		info      *relaycommon.RelayInfo
		wantURL   string
		wantError bool
	}{
		{
			name:    "chat completions routes to /v1/responses",
			info:    &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions},
			wantURL: want,
		},
		{
			name:    "responses routes to /v1/responses",
			info:    &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses},
			wantURL: want,
		},
		{
			name:    "claude relay format routes to /v1/responses",
			info:    &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude},
			wantURL: want,
		},
		{
			name:      "unsupported endpoint fails closed",
			info:      &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeEmbeddings},
			wantError: true,
		},
		{
			name:      "nil info fails closed",
			info:      nil,
			wantError: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := a.GetRequestURL(tc.info)
			if tc.wantError {
				if err == nil {
					t.Fatalf("expected error, got url=%q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.wantURL {
				t.Fatalf("url = %q, want %q", got, tc.wantURL)
			}
			// 路径必须是 Responses 路径（与 ConvertOpenAIRequest 产出 Responses 体对齐）。
			if !strings.HasSuffix(got, CLIResponsesPath) {
				t.Fatalf("url %q does not target %q", got, CLIResponsesPath)
			}
		})
	}
}

// TestGetRequestURL_CompactRoutesToCLIProxy 锁住 Task 12.5 A 修复：
// RelayModeResponsesCompact 与 Responses/Chat 同落 CLI proxy 的 /v1/responses
// （设计 §8.3——compact 不调不存在的上游 compact path）。修复前 compact 落
// default 分支 → errUnsupportedEndpoint，请求在 DoRequest 前就失败。
func TestGetRequestURL_CompactRoutesToCLIProxy(t *testing.T) {
	a := &Adaptor{}
	want := CLIProxyBase + CLIResponsesPath
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponsesCompact}
	got, err := a.GetRequestURL(info)
	if err != nil {
		t.Fatalf("compact must route to CLI proxy, got error: %v", err)
	}
	if got != want {
		t.Fatalf("compact url = %q, want %q", got, want)
	}
}

// TestSetupRequestHeader_InjectsIdentityAndBearer 校验合法凭证下的 header 注入。
func TestSetupRequestHeader_InjectsIdentityAndBearer(t *testing.T) {
	a := &Adaptor{}
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: validGrokCredential(t)},
		RelayMode:   relayconstant.RelayModeChatCompletions,
	}
	header := http.Header{}

	if err := a.SetupRequestHeader(c, &header, info); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	checks := map[string]string{
		"Authorization":         "Bearer test-access-token",
		HeaderXAITokenAuth:      HeaderXAITokenAuthValue,
		HeaderGrokClientVersion: CLIClientVersion(),
		HeaderGrokClientID:      GrokClientIDValue,
		"User-Agent":            CLIUserAgentPrefix + CLIClientVersion(),
	}
	for k, want := range checks {
		if got := header.Get(k); got != want {
			t.Fatalf("header %q = %q, want %q", k, got, want)
		}
	}
	if header.Get("X-Request-Id") == "" {
		t.Fatalf("X-Request-Id must be set")
	}
}

// TestSetupRequestHeader_CredentialFailureNoLeak 锁住关键安全不变量：凭证解析
// 失败时，返回的 error 绝不能回显 ApiKey（可能含 token）内容，且不得注入
// Authorization。
func TestSetupRequestHeader_CredentialFailureNoLeak(t *testing.T) {
	a := &Adaptor{}
	c := newTestGinContext(t)
	const secret = "sk-super-secret-token-must-not-leak-abc123"
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: secret}, // 非法凭证（非 JSON），模拟解析失败路径
		RelayMode:   relayconstant.RelayModeChatCompletions,
	}
	header := http.Header{}

	err := a.SetupRequestHeader(c, &header, info)
	if err == nil {
		t.Fatalf("expected error for invalid credential")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("error message leaked credential material: %q", err.Error())
	}
	if strings.Contains(err.Error(), "sk-super-secret") {
		t.Fatalf("error message leaked credential prefix: %q", err.Error())
	}
	// 失败路径必须在注入任何 Authorization 之前 return。
	if header.Get("Authorization") != "" {
		t.Fatalf("Authorization must not be set on credential failure")
	}
}

// TestSetupRequestHeader_NilGuards 校验 nil context / nil info / nil ChannelMeta 的防御。
// ChannelMeta 为 nil 尤其重要：info.ApiKey 是 *ChannelMeta 的 promoted field，
// 不做防御会在解引用时 panic。
func TestSetupRequestHeader_NilGuards(t *testing.T) {
	a := &Adaptor{}
	header := http.Header{}
	if err := a.SetupRequestHeader(nil, &header, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}); err == nil {
		t.Fatalf("expected error for nil context")
	}
	if err := a.SetupRequestHeader(newTestGinContext(t), &header, nil); err == nil {
		t.Fatalf("expected error for nil info")
	}
	// ChannelMeta 为 nil：绝不能 panic，必须返回 error。
	if err := a.SetupRequestHeader(newTestGinContext(t), &header, &relaycommon.RelayInfo{}); err == nil {
		t.Fatalf("expected error for nil ChannelMeta")
	}
}

// TestConvertOpenAIRequest_ChatToResponses 锁住 wire-format 自洽的核心不变量：
// adaptor 自行把 Chat Completions 转成 Responses 体（返回 *apicompat.ResponsesRequest，
// 而非把 Chat body 原样透传），因此不依赖任何默认关闭的全局 Chat→Responses 开关。
func TestConvertOpenAIRequest_ChatToResponses(t *testing.T) {
	a := &Adaptor{}
	request := &dto.GeneralOpenAIRequest{}
	if err := common.Unmarshal([]byte(`{"model":"grok-4","messages":[{"role":"user","content":"hi"}]}`), request); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}

	out, err := a.ConvertOpenAIRequest(newTestGinContext(t), &relaycommon.RelayInfo{}, request)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp, ok := out.(*apicompat.ResponsesRequest)
	if !ok {
		t.Fatalf("ConvertOpenAIRequest returned %T, want *apicompat.ResponsesRequest (Chat body must be converted, not passed through)", out)
	}
	if resp.Model != "grok-4" {
		t.Fatalf("model = %q, want grok-4", resp.Model)
	}
	// 上游只流式：转换后必须强制 Stream=true。
	if !resp.Stream {
		t.Fatalf("converted Responses request must force Stream=true")
	}
}

// TestConvertOpenAIRequest_FillsModelFromInfo 校验请求缺 model 时从 info 补齐。
func TestConvertOpenAIRequest_FillsModelFromInfo(t *testing.T) {
	a := &Adaptor{}
	request := &dto.GeneralOpenAIRequest{}
	if err := common.Unmarshal([]byte(`{"messages":[{"role":"user","content":"hi"}]}`), request); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-3-mini"}}
	out, err := a.ConvertOpenAIRequest(newTestGinContext(t), info, request)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp := out.(*apicompat.ResponsesRequest)
	if resp.Model != "grok-3-mini" {
		t.Fatalf("model = %q, want grok-3-mini (filled from info)", resp.Model)
	}
}

// TestConvertOpenAIRequest_NilRequest 校验 nil 请求 fail closed。
func TestConvertOpenAIRequest_NilRequest(t *testing.T) {
	a := &Adaptor{}
	if _, err := a.ConvertOpenAIRequest(newTestGinContext(t), &relaycommon.RelayInfo{}, nil); err == nil {
		t.Fatalf("expected error for nil request")
	}
}

// TestConvertOpenAIResponsesRequest_CompactBuildsSummaryTurn 锁住 Task 12.5 B 修复：
// compact RelayMode 下，ConvertOpenAIResponsesRequest 必须把请求交给 BuildCompactTurn
// 改造成服务端 summary turn（返回 json.RawMessage），而非透传 dto。断言：
//   - 返回 json.RawMessage（非 dto.OpenAIResponsesRequest）
//   - input 末尾追加了 summary item
//   - stream=false、store=false
//   - include 数组含 reasoning.encrypted_content，且不是布尔形态
//   - tools 被剥离
func TestConvertOpenAIResponsesRequest_CompactBuildsSummaryTurn(t *testing.T) {
	a := &Adaptor{}
	req := dto.OpenAIResponsesRequest{}
	if err := common.Unmarshal([]byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}],"tools":[{"type":"function"}]}`), &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponsesCompact}
	out, err := a.ConvertOpenAIResponsesRequest(newTestGinContext(t), info, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	raw, ok := out.(json.RawMessage)
	if !ok {
		t.Fatalf("compact must return json.RawMessage (BuildCompactTurn output), got %T", out)
	}
	if getBool(raw, "stream") != false {
		t.Fatalf("compact must force stream=false")
	}
	if getBool(raw, "store") != false {
		t.Fatalf("compact must force store=false")
	}
	if !hasSummaryItem(raw) {
		t.Fatalf("compact must append server summary item to input")
	}
	if hasTopLevelKey(raw, "tools") {
		t.Fatalf("compact must strip tools")
	}
	inc := gjson.GetBytes(raw, "include")
	if !inc.IsArray() {
		t.Fatalf("include must be array, got %q", inc.Raw)
	}
	found := false
	for _, v := range inc.Array() {
		if v.String() == "reasoning.encrypted_content" {
			found = true
		}
	}
	if !found {
		t.Fatalf("include must contain reasoning.encrypted_content, got %q", inc.Raw)
	}
	if gjson.GetBytes(raw, "reasoning.encrypted_content").Type == gjson.True {
		t.Fatalf("must not set boolean reasoning.encrypted_content")
	}
}

// TestConvertOpenAIResponsesRequest_NonCompactUnchanged 锁住非 compact 路径行为不变：
// 普通 Responses 请求仍返回 dto.OpenAIResponsesRequest（不经 BuildCompactTurn），
// 保证正常 Responses 流量不受 compact 接线影响。
func TestConvertOpenAIResponsesRequest_NonCompactUnchanged(t *testing.T) {
	a := &Adaptor{}
	req := dto.OpenAIResponsesRequest{Model: "grok-4"}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses}
	out, err := a.ConvertOpenAIResponsesRequest(newTestGinContext(t), info, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := out.(dto.OpenAIResponsesRequest); !ok {
		t.Fatalf("non-compact must return dto.OpenAIResponsesRequest unchanged, got %T", out)
	}
}

// TestConvertOpenAIResponsesRequest_NilChannelMeta 锁住 I1 修复：
// info.UpstreamModelName 是 *ChannelMeta 的 promoted field，ChannelMeta 为 nil
// 时不得 panic（与 ConvertOpenAIRequest 一致的防御）。
func TestConvertOpenAIResponsesRequest_NilChannelMeta(t *testing.T) {
	a := &Adaptor{}
	req := dto.OpenAIResponsesRequest{Model: ""}
	// info 无 ChannelMeta：绝不能 panic。
	out, err := a.ConvertOpenAIResponsesRequest(newTestGinContext(t), &relaycommon.RelayInfo{}, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := out.(dto.OpenAIResponsesRequest)
	if got.Model != "" {
		t.Fatalf("model = %q, want empty (no ChannelMeta to fill from)", got.Model)
	}
	// 有 ChannelMeta 时正常补齐。
	out2, err := a.ConvertOpenAIResponsesRequest(newTestGinContext(t), &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4"}}, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out2.(dto.OpenAIResponsesRequest).Model != "grok-4" {
		t.Fatalf("model must be filled from ChannelMeta")
	}
}

// TestConvertOpenAIRequest_GoldenChatBodyWireShape 是 I2 的 golden test：锁住
// adaptor 发往 CLI proxy 的 Chat→Responses 请求体形状。Grok 走 pkg/apicompat
// （非全仓库的 service/openaicompat），二者对 system 消息处理不同——apicompat 把
// system 转成 role:"system" 的 input item（而非提升到顶层 instructions）。这里
// 用 golden 断言把该线格钉死，任何转换器漂移都会让测试失败，提醒复核 CLI proxy
// 是否仍接受该形状。
func TestConvertOpenAIRequest_GoldenChatBodyWireShape(t *testing.T) {
	a := &Adaptor{}
	request := &dto.GeneralOpenAIRequest{}
	if err := common.Unmarshal([]byte(`{"model":"grok-4","messages":[{"role":"system","content":"be terse"},{"role":"user","content":"hi"}]}`), request); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	out, err := a.ConvertOpenAIRequest(newTestGinContext(t), &relaycommon.RelayInfo{}, request)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	resp := out.(*apicompat.ResponsesRequest)

	// 上游只流式 + store=false + 携带 encrypted reasoning（apicompat 固定行为）。
	if !resp.Stream {
		t.Fatalf("Stream must be true (upstream always streams)")
	}
	if resp.Store == nil || *resp.Store {
		t.Fatalf("Store must be explicitly false")
	}
	if len(resp.Include) != 1 || resp.Include[0] != "reasoning.encrypted_content" {
		t.Fatalf("Include = %v, want [reasoning.encrypted_content]", resp.Include)
	}
	// system 消息作为 role:"system" 的 input item 存在（不是顶层 instructions）。
	if resp.Instructions != "" {
		t.Fatalf("apicompat must NOT promote system to instructions; got %q", resp.Instructions)
	}
	var items []apicompat.ResponsesInputItem
	if err := common.Unmarshal(resp.Input, &items); err != nil {
		t.Fatalf("input must be an array of input items: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("want 2 input items (system+user), got %d", len(items))
	}
	if items[0].Role != "system" {
		t.Fatalf("item[0].Role = %q, want system", items[0].Role)
	}
	if items[1].Role != "user" {
		t.Fatalf("item[1].Role = %q, want user", items[1].Role)
	}
}

// TestSetupRequestHeader_HostGuardConsistentWithRoute 锁住 I3 修复的核心不变量：
// SetupRequestHeader 在注入 Bearer/CLI identity 前，会用 IsAllowedTextHost 断言
// 目标 host（取自 GetRequestURL）。里程碑 A 的 GetRequestURL 恒定路由到 CLI proxy，
// 无法经公开 API 令 guard 失败；因此这里锁两条互补不变量：
//  1. GetRequestURL 对全部文本模式产出的 host 必须被 IsAllowedTextHost 放行——
//     否则 guard 会误杀合法流量（配合 host_guard_test 里“非 CLI host 一律拒绝”，
//     形成完整门禁：合法 host 放行 + 非法 host 拒绝）。
//  2. 该合法路由下 SetupRequestHeader 成功注入 Authorization（guard 不阻断正路）。
//
// 一旦里程碑 B 让 URL 动态化，若新 host 未登记进文本 allowlist，本测试会立即失败，
// 提醒复核是否把凭证发到了非 CLI proxy 主机。
func TestSetupRequestHeader_HostGuardConsistentWithRoute(t *testing.T) {
	a := &Adaptor{}
	for _, mode := range []int{relayconstant.RelayModeChatCompletions, relayconstant.RelayModeResponses} {
		info := &relaycommon.RelayInfo{RelayMode: mode}
		routeURL, err := a.GetRequestURL(info)
		if err != nil {
			t.Fatalf("GetRequestURL(mode=%d): %v", mode, err)
		}
		parsed, err := url.Parse(routeURL)
		if err != nil {
			t.Fatalf("parse route url %q: %v", routeURL, err)
		}
		// 不变量 1：路由目标 host 必须被文本 guard 放行。
		if !IsAllowedTextHost(parsed.Hostname()) {
			t.Fatalf("route host %q for mode=%d not allowed for text; guard would kill legit traffic", parsed.Hostname(), mode)
		}
		// 不变量 2：合法路由下 guard 不阻断，正常注入 Authorization。
		info.ChannelMeta = &relaycommon.ChannelMeta{ApiKey: validGrokCredential(t)}
		header := http.Header{}
		if err := a.SetupRequestHeader(newTestGinContext(t), &header, info); err != nil {
			t.Fatalf("SetupRequestHeader(mode=%d) unexpected error: %v", mode, err)
		}
		if header.Get("Authorization") == "" {
			t.Fatalf("Authorization must be injected on allowed route (mode=%d)", mode)
		}
	}
}
