package zhipu_4v

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestGetRequestURLUsesClaudeCompatibleEndpointForClaudeModel(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-7-sonnet",
			ChannelBaseUrl:    "https://open.bigmodel.cn",
			ChannelType:       constant.ChannelTypeZhipu_v4,
		},
	}

	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://open.bigmodel.cn/api/anthropic/v1/messages"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}
}

func TestGetRequestURLUsesClaudeCompatibleEndpointForCodingPlan(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	for _, testCase := range []struct {
		baseURL string
		want    string
	}{
		{baseURL: "glm-coding-plan", want: "https://open.bigmodel.cn/api/anthropic/v1/messages"},
		{baseURL: "glm-coding-plan/", want: "https://open.bigmodel.cn/api/anthropic/v1/messages"},
		{baseURL: "https://open.bigmodel.cn/api/coding/paas/v4", want: "https://open.bigmodel.cn/api/anthropic/v1/messages"},
		{baseURL: "glm-coding-plan-international", want: "https://api.z.ai/api/anthropic/v1/messages"},
		{baseURL: "https://api.z.ai/api/coding/paas/v4", want: "https://api.z.ai/api/anthropic/v1/messages"},
	} {
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatOpenAI,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl:    testCase.baseURL,
				UpstreamModelName: "glm-4.6",
			},
		}

		got, err := adaptor.GetRequestURL(info)
		if err != nil {
			t.Fatalf("GetRequestURL(%q) returned error: %v", testCase.baseURL, err)
		}
		if got != testCase.want {
			t.Fatalf("GetRequestURL(%q) = %q, want %q", testCase.baseURL, got, testCase.want)
		}
	}
}

func TestSetupRequestHeaderUsesClaudeCompatibleHeadersForClaudeModel(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	adaptor := &Adaptor{}
	headers := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-7-sonnet",
			ApiKey:            "zhipu-v4-key",
			ChannelType:       constant.ChannelTypeZhipu_v4,
		},
	}

	if err := adaptor.SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}

	if headers.Get("x-api-key") != "zhipu-v4-key" {
		t.Fatalf("x-api-key = %q, want %q", headers.Get("x-api-key"), "zhipu-v4-key")
	}
	if headers.Get("anthropic-version") != "2023-06-01" {
		t.Fatalf("anthropic-version = %q, want %q", headers.Get("anthropic-version"), "2023-06-01")
	}
	if headers.Get("Authorization") != "" {
		t.Fatalf("Authorization = %q, want empty for Claude-compatible requests", headers.Get("Authorization"))
	}
}

func TestIsZCodeModeChannel(t *testing.T) {
	t.Parallel()

	zcodeOn := dto.ChannelSettings{ZcodeModeEnabled: true}
	tests := []struct {
		name        string
		channelType int
		baseURL     string
		setting     dto.ChannelSettings
		want        bool
	}{
		{"coding plan alias + zcode on", constant.ChannelTypeZhipu_v4, "glm-coding-plan", zcodeOn, true},
		{"international alias + zcode on", constant.ChannelTypeZhipu_v4, "glm-coding-plan-international", zcodeOn, true},
		{"start plan alias + zcode on", constant.ChannelTypeZhipu_v4, zcodeStartPlanBaseURL, zcodeOn, true},
		{"coding plan claude URL + zcode on", constant.ChannelTypeZhipu_v4, constant.ChannelSpecialBases["glm-coding-plan"].ClaudeBaseURL, zcodeOn, true},
		{"trailing slash tolerated", constant.ChannelTypeZhipu_v4, "glm-coding-plan/", zcodeOn, true},
		{"coding plan alias + zcode off", constant.ChannelTypeZhipu_v4, "glm-coding-plan", dto.ChannelSettings{}, false},
		{"default zhipu base + zcode on", constant.ChannelTypeZhipu_v4, "https://open.bigmodel.cn", zcodeOn, false},
		{"wrong channel type", constant.ChannelTypeOpenAI, "glm-coding-plan", zcodeOn, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := IsZCodeModeChannel(tt.channelType, tt.baseURL, tt.setting); got != tt.want {
				t.Fatalf("IsZCodeModeChannel(%d, %q, %+v) = %v, want %v", tt.channelType, tt.baseURL, tt.setting, got, tt.want)
			}
		})
	}

}

func TestSetupRequestHeaderAddsZCodeFingerprintForCodingPlan(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	headers := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "glm-4.6",
			ChannelSetting:    dto.ChannelSettings{ZcodeModeEnabled: true},
		},
	}

	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("Authorization") != "" {
		t.Fatalf("Authorization = %q, want empty for Claude-compatible requests", headers.Get("Authorization"))
	}
	if headers.Get("x-api-key") != "coding-plan-key" {
		t.Fatalf("x-api-key = %q, want coding-plan-key", headers.Get("x-api-key"))
	}
	zcodeFingerprint := map[string]string{
		"User-Agent":          "ZCode/" + zcodeClientVersion,
		"HTTP-Referer":        "https://zcode.z.ai",
		"X-Title":             "Z Code@electron",
		"X-ZCode-App-Version": zcodeClientVersion,
		"X-Platform":          "win32-x64",
		"X-Release-Channel":   "production",
		"X-Client-Language":   "zh-CN",
		"X-Client-Timezone":   "Asia/Shanghai",
		"X-Os-Category":       "windows",
	}
	for name, want := range zcodeFingerprint {
		if value := headers.Get(name); value != want {
			t.Fatalf("%s = %q, want %q", name, value, want)
		}
	}
	if headers.Get("x-request-id") == "" {
		t.Fatalf("x-request-id is empty")
	}
	// 旧版追踪头默认不带：官方 3.14.3 只保留 x-request-id。
	for _, name := range []string{"x-zcode-session-type", "x-zcode-trace-id", "x-query-id"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want empty unless legacy trace mode is enabled", name, value)
		}
	}
	// x-session-id 仍要带：它是 V4 签名串的一环，缺失会让签名静默跳过、套餐权益失效。
	// 它不属于旧版追踪头集合。
	if headers.Get("x-session-id") == "" {
		t.Fatalf("x-session-id is required for V4 signing")
	}
	// 指纹版本跟随官方解包版本，不得停留在 3.12.x。
	if zcodeClientVersion != "3.14.3" {
		t.Fatalf("zcodeClientVersion = %q, want the officially shipped 3.14.3", zcodeClientVersion)
	}
	for _, name := range []string{"X-Stainless-Runtime", "X-Stainless-Package-Version", "x-app", "X-Claude-Code-Session-Id", "x-client-request-id", "anthropic-client-platform", "anthropic-client-version", "anthropic-dangerous-direct-browser-access"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want cleared from Claude fingerprint", name, value)
		}
	}
	if _, err := uuid.Parse(headers.Get("x-request-id")); err != nil {
		t.Fatalf("x-request-id = %q is not a UUID: %v", headers.Get("x-request-id"), err)
	}
}

func TestSetupZCodeCompatibilityHeadersLegacyTraceMode(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	enabled := true
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "glm-4.6",
			ChannelSetting: dto.ChannelSettings{
				ZcodeModeEnabled:        true,
				ZcodeLegacyTraceHeaders: &enabled,
			},
		},
	}
	headers := make(http.Header)
	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("x-zcode-session-type") != "main" {
		t.Fatalf("x-zcode-session-type = %q, want main in legacy mode", headers.Get("x-zcode-session-type"))
	}
	for _, name := range []string{"x-zcode-trace-id", "x-query-id", "x-session-id"} {
		if headers.Get(name) == "" {
			t.Fatalf("%s is empty in legacy mode", name)
		}
	}
}

func TestSetupZCodeCompatibilityHeadersVersionOverride(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "glm-4.6",
			ChannelSetting: dto.ChannelSettings{
				ZcodeModeEnabled:        true,
				ZcodeFingerprintVersion: "3.12.3",
			},
		},
	}
	headers := make(http.Header)
	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("X-ZCode-App-Version") != "3.12.3" {
		t.Fatalf("X-ZCode-App-Version = %q, want the channel override", headers.Get("X-ZCode-App-Version"))
	}
	if headers.Get("User-Agent") != "ZCode/3.12.3" {
		t.Fatalf("User-Agent = %q, want ZCode/3.12.3", headers.Get("User-Agent"))
	}
}

func TestConvertOpenAIRequestReturnsClaudeRequestForClaudeModel(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-7-sonnet",
			ChannelType:       constant.ChannelTypeZhipu_v4,
		},
	}
	request := &dto.GeneralOpenAIRequest{
		Model: "claude-3-7-sonnet",
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hi",
			},
		},
	}

	converted, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIRequest returned error: %v", err)
	}

	if _, ok := converted.(*dto.ClaudeRequest); !ok {
		t.Fatalf("ConvertOpenAIRequest returned %T, want *dto.ClaudeRequest", converted)
	}
}

func TestConvertOpenAIResponsesRequestUsesClaudeRequestForCodingPlan(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	stream := true
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAIResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			UpstreamModelName: "glm-4.6",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model:  "glm-4.6",
		Input:  []byte(`"hello"`),
		Stream: &stream,
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}
	claudeReq, ok := converted.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("ConvertOpenAIResponsesRequest returned %T, want *dto.ClaudeRequest", converted)
	}
	if info.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat = %q, want %q", info.FinalRequestRelayFormat, types.RelayFormatClaude)
	}
	if claudeReq.Stream == nil || !*claudeReq.Stream {
		t.Fatalf("stream = %#v, want true", claudeReq.Stream)
	}
}

func TestConvertInternalChatResponsesRequestKeepsOpenAIFormat(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			UpstreamModelName: "glm-4.6",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model: "glm-4.6",
		Input: []byte(`"hello"`),
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}
	if _, ok := converted.(*dto.GeneralOpenAIRequest); !ok {
		t.Fatalf("ConvertOpenAIResponsesRequest returned %T, want *dto.GeneralOpenAIRequest", converted)
	}
	if info.FinalRequestRelayFormat != types.RelayFormatOpenAI {
		t.Fatalf("FinalRequestRelayFormat = %q, want %q", info.FinalRequestRelayFormat, types.RelayFormatOpenAI)
	}
}

func TestSetupRequestHeaderPassthroughForResponsesOpenAIPathWhenZcodeModeOff(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	headers := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "glm-5.3-flash",
		},
	}

	// ZCode 模式关闭时 Responses→OpenAI chat 直连保持透传，不注入任何 ZCode 头。
	info.RelayMode = relayconstant.RelayModeResponses
	info.FinalRequestRelayFormat = types.RelayFormatOpenAI

	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("Authorization") != "Bearer coding-plan-key" {
		t.Fatalf("Authorization = %q, want Bearer coding-plan-key", headers.Get("Authorization"))
	}
	for _, name := range []string{"User-Agent", "HTTP-Referer", "X-ZCode-App-Version", "X-Release-Channel", "x-zcode-session-type", "x-request-id"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want empty for passthrough when ZCode mode is off", name, value)
		}
	}
}

func TestSetupRequestHeaderSkipsZCodeFingerprintForEmbeddings(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/embeddings", nil)

	headers := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "embedding-3",
		},
	}
	info.RelayMode = relayconstant.RelayModeEmbeddings

	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("Authorization") != "Bearer coding-plan-key" {
		t.Fatalf("Authorization = %q, want Bearer coding-plan-key", headers.Get("Authorization"))
	}
	for _, name := range []string{"User-Agent", "X-ZCode-App-Version", "X-Release-Channel", "x-zcode-session-type"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want empty for non-LLM coding plan requests", name, value)
		}
	}
}

func TestSetupRequestHeaderTraceOnlyForCodingPlanWhenZcodeModeOff(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	headers := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			ApiKey:            "coding-plan-key",
			UpstreamModelName: "glm-4.6",
		},
	}

	if err := (&Adaptor{}).SetupRequestHeader(c, &headers, info); err != nil {
		t.Fatalf("SetupRequestHeader returned error: %v", err)
	}
	if headers.Get("x-api-key") != "coding-plan-key" {
		t.Fatalf("x-api-key = %q, want coding-plan-key", headers.Get("x-api-key"))
	}
	// 请求级追踪头保留（原有透传逻辑），ZCode 设备指纹不注入。
	if headers.Get("x-request-id") == "" {
		t.Fatalf("x-request-id is empty")
	}
	if _, err := uuid.Parse(headers.Get("x-request-id")); err != nil {
		t.Fatalf("x-request-id = %q is not a UUID: %v", headers.Get("x-request-id"), err)
	}
	for _, name := range []string{"x-zcode-session-type", "x-zcode-trace-id", "x-query-id", "x-session-id"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want empty unless legacy trace mode is enabled", name, value)
		}
	}
	for _, name := range []string{"User-Agent", "HTTP-Referer", "X-ZCode-App-Version", "X-Release-Channel", "X-Platform", "X-Os-Category"} {
		if value := headers.Get(name); value != "" {
			t.Fatalf("%s = %q, want empty when ZCode mode is off", name, value)
		}
	}
}

func TestConvertOpenAIResponsesRequestForcesClaudeWhenZcodeModeOn(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "glm-coding-plan",
			UpstreamModelName: "glm-5.3-flash",
			ChannelSetting:    dto.ChannelSettings{ZcodeModeEnabled: true},
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model: "glm-5.3-flash",
		Input: []byte(`"hello"`),
	})
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}
	if info.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat = %q, want %q", info.FinalRequestRelayFormat, types.RelayFormatClaude)
	}
	if _, ok := converted.(*dto.ClaudeRequest); !ok {
		t.Fatalf("ConvertOpenAIResponsesRequest returned %T, want *dto.ClaudeRequest", converted)
	}
}
