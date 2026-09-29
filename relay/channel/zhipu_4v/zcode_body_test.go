package zhipu_4v

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func zcodeTestInfo(tokenId int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		TokenId:     tokenId,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "glm-coding-plan",
			ApiKey:         "coding-plan-key",
			ChannelSetting: dto.ChannelSettings{ZcodeModeEnabled: true},
		},
	}
}

func TestApplyZCodeBodyFingerprintOfficialShape(t *testing.T) {
	t.Parallel()

	maxTokens := uint(4096)
	req := &dto.ClaudeRequest{
		Model:    "glm-5.3-flash",
		System:   "you are helpful",
		Messages: []dto.ClaudeMessage{{Role: "user", Content: "hello"}},
		// 客户端自带非官方 metadata 与字段，应被替换/剥离
		Metadata:          []byte(`{"user_id":"user_abc_account__session_xyz"}`),
		Speed:             []byte(`"fast"`),
		InferenceGeo:      "us",
		ServiceTier:       "standard",
		OutputConfig:      []byte(`{"effort":"high"}`),
		Prompt:            "legacy",
		MaxTokensToSample: &maxTokens,
	}

	applyZCodeBodyFingerprint(zcodeTestInfo(5675), req)

	// metadata 替换为官方 user_id
	var metadata map[string]string
	if err := common.Unmarshal(req.Metadata, &metadata); err != nil {
		t.Fatalf("metadata unmarshal: %v", err)
	}
	var userID map[string]string
	if err := common.Unmarshal([]byte(metadata["user_id"]), &userID); err != nil {
		t.Fatalf("user_id 应为 JSON 字符串: %v", err)
	}
	if userID["device_id"] == "" || userID["session_id"] == "" {
		t.Fatalf("user_id 缺 device_id/session_id: %v", userID)
	}
	if userID["account_uuid"] != "" {
		t.Fatalf("account_uuid 应为空串: %q", userID["account_uuid"])
	}
	if strings.Contains(metadata["user_id"], "user_abc") {
		t.Fatalf("客户端自带 user_id 未被替换: %s", metadata["user_id"])
	}

	// system 字符串转块数组且带 ephemeral 断点
	sysBlocks, ok := req.System.([]dto.ClaudeMediaMessage)
	if !ok || len(sysBlocks) != 1 {
		t.Fatalf("system 应转为单块数组: %#v", req.System)
	}
	if string(sysBlocks[0].CacheControl) != `{"type":"ephemeral"}` {
		t.Fatalf("system 块缺 cache_control: %s", sysBlocks[0].CacheControl)
	}

	// 末尾消息字符串转块数组且带 ephemeral 断点
	msgBlocks, ok := req.Messages[0].Content.([]dto.ClaudeMediaMessage)
	if !ok || len(msgBlocks) != 1 {
		t.Fatalf("消息 content 应转为单块数组: %#v", req.Messages[0].Content)
	}
	if string(msgBlocks[0].CacheControl) != `{"type":"ephemeral"}` {
		t.Fatalf("消息块缺 cache_control: %s", msgBlocks[0].CacheControl)
	}

	// 非官方字段剥离
	if req.Speed != nil || req.InferenceGeo != "" || req.ServiceTier != "" || req.OutputConfig != nil || req.Prompt != "" || req.MaxTokensToSample != nil {
		t.Fatalf("非官方字段未剥离: %#v", req)
	}
}

func TestApplyZCodeBodyFingerprintPreservesBlockFormAndSkipsNonZCode(t *testing.T) {
	t.Parallel()

	text := "sys"
	msgText := "hi"
	existingCC := []byte(`{"type":"ephemeral","ttl":"1h"}`)
	req := &dto.ClaudeRequest{
		Model:  "glm-5.3-flash",
		System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: &text}, {Type: dto.ContentTypeText, Text: &text}},
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: []dto.ClaudeMediaMessage{
				{Type: dto.ContentTypeText, Text: &msgText, CacheControl: existingCC},
				{Type: dto.ContentTypeText, Text: &msgText},
			}},
		},
	}

	// ZCode 关闭：完全不动
	offInfo := zcodeTestInfo(1)
	offInfo.ChannelSetting = dto.ChannelSettings{}
	snapshot := req
	applyZCodeBodyFingerprint(offInfo, req)
	if req != snapshot {
		t.Fatalf("ZCode 关闭时不应修改请求")
	}

	applyZCodeBodyFingerprint(zcodeTestInfo(1), req)

	sysBlocks := req.System.([]dto.ClaudeMediaMessage)
	if string(sysBlocks[0].CacheControl) != "" {
		t.Fatalf("仅末尾 system 块打断点，首块不应有: %s", sysBlocks[0].CacheControl)
	}
	if string(sysBlocks[1].CacheControl) != `{"type":"ephemeral"}` {
		t.Fatalf("末尾 system 块断点缺失: %s", sysBlocks[1].CacheControl)
	}
	msgBlocks := req.Messages[0].Content.([]dto.ClaudeMediaMessage)
	if string(msgBlocks[0].CacheControl) != string(existingCC) {
		t.Fatalf("已有断点不应被覆盖: %s", msgBlocks[0].CacheControl)
	}
	if string(msgBlocks[1].CacheControl) != `{"type":"ephemeral"}` {
		t.Fatalf("末尾消息块断点缺失: %s", msgBlocks[1].CacheControl)
	}
}

func TestZCodeHeadersOfficialShape(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader("{}"))
	c.Request.Header.Set("anthropic-beta", "claude-code-20250219,interleaved-thinking-2025-05-14")
	c.Request.Header.Set("Accept", "text/event-stream")

	headers := make(http.Header)
	info := zcodeTestInfo(5675)
	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}

	if got := headers.Get("anthropic-beta"); got != "" {
		t.Fatalf("anthropic-beta 应被剥离, got %q", got)
	}
	if got := headers.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
	if got := headers.Get("Accept"); got != "application/json" {
		t.Fatalf("Accept = %q, want application/json（官方 AI SDK 形态）", got)
	}
	if got := headers.Get("X-Os-Version"); got != zcodeOsVersion {
		t.Fatalf("X-Os-Version = %q, want %q", got, zcodeOsVersion)
	}
	if got := headers.Get("X-Device-Mid"); got == "" {
		t.Fatalf("X-Device-Mid 为空")
	}

	// 默认形态仍带 x-session-id：V4 签名的签名串依赖它，缺失就拿不到套餐权益。
	// 旧版追踪头才是默认关闭的。
	if headers.Get("x-session-id") == "" {
		t.Fatalf("x-session-id 不能为空：V4 签名依赖它")
	}

	// metadata 里的会话标识必须稳定：同渠道同令牌两次一致，不同令牌不同值。
	sessionIDOf := func(info *relaycommon.RelayInfo) string {
		req := &dto.ClaudeRequest{Model: "glm-5.3-flash", Messages: []dto.ClaudeMessage{{Role: "user", Content: "hi"}}}
		applyZCodeBodyFingerprint(info, req)
		var metadata map[string]string
		_ = common.Unmarshal(req.Metadata, &metadata)
		var userID map[string]string
		_ = common.Unmarshal([]byte(metadata["user_id"]), &userID)
		return userID["session_id"]
	}
	s1 := sessionIDOf(zcodeTestInfo(5675))
	if s1 == "" {
		t.Fatalf("metadata session_id 为空")
	}
	if s2 := sessionIDOf(zcodeTestInfo(5675)); s2 != s1 {
		t.Fatalf("metadata session_id 应稳定: %q vs %q", s1, s2)
	}
	if s3 := sessionIDOf(zcodeTestInfo(9999)); s3 == s1 {
		t.Fatalf("不同令牌的 metadata session_id 应不同")
	}

	// 旧版追踪形态：头与 metadata 共用同一个会话标识。
	legacyInfo := zcodeTestInfo(5675)
	enabled := true
	legacyInfo.ChannelSetting.ZcodeLegacyTraceHeaders = &enabled
	legacyHeaders := make(http.Header)
	if err := (&Adaptor{}).SetupRequestHeader(c, &legacyHeaders, legacyInfo); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if got := legacyHeaders.Get("x-session-id"); got != s1 {
		t.Fatalf("legacy x-session-id = %q, want the same session id as metadata %q", got, s1)
	}
}

func TestZCodeDeviceMidFormat(t *testing.T) {
	t.Parallel()

	mid := zcodeDeviceMid()
	parts := strings.Split(mid, "-")
	if len(parts) != 5 {
		t.Fatalf("device mid 应为 UUID 形态: %q", mid)
	}
	if mid != zcodeDeviceMid() {
		t.Fatalf("device mid 应稳定")
	}
}
