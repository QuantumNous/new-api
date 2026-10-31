package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestBillingByteReservationAndUsageFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldCountToken := constant.CountToken
	constant.CountToken = true
	t.Cleanup(func() { constant.CountToken = oldCountToken })
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":         `{"gpt-4o":"tiered_expr"}`,
		"billing_setting.billing_expr":         `{"gpt-4o":"tier(\"base\", p * 2)"}`,
		"group_ratio_setting.group_ratio":      `{"default":1}`,
		"quota_setting.pre_consume_multiplier": "1",
	}))

	for _, tc := range []struct {
		name, body string
		request    dto.Request
		format     types.RelayFormat
	}{
		{"chat", `{"model":"gpt-4o","messages":[{"role":"user","content":"你好，count this prompt"}],"tools":[{"type":"function","function":{"name":"lookup","parameters":{"type":"object"}}}]}`, &dto.GeneralOpenAIRequest{}, types.RelayFormatOpenAI},
		{"claude", `{"model":"gpt-4o","max_tokens":100,"messages":[{"role":"user","content":"你好，count this prompt"}]}`, &dto.ClaudeRequest{}, types.RelayFormatClaude},
		{"responses", `{"model":"gpt-4o","input":"你好，count this prompt","instructions":"Be concise"}`, &dto.OpenAIResponsesRequest{}, types.RelayFormatOpenAIResponses},
		{"gemini", `{"contents":[{"role":"user","parts":[{"text":"你好，count this prompt"}]}]}`, &dto.GeminiChatRequest{}, types.RelayFormatGemini},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(tc.body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			// The estimate must use the buffered body, even with chunked input.
			ctx.Request.ContentLength = -1
			t.Cleanup(func() { common.CleanupBodyStorage(ctx) })
			common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gpt-4o")
			require.NoError(t, common.Unmarshal([]byte(tc.body), tc.request))
			reservation := &imageReservation{limit: common.MaxQuota}
			info := &relaycommon.RelayInfo{Request: tc.request, OriginModelName: "gpt-4o", RelayFormat: tc.format,
				UserGroup: "default", UsingGroup: "default", Billing: reservation,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI, UpstreamModelName: "gpt-4o"}}
			require.Nil(t, PrepareRequestBilling(ctx, info))
			assert.Equal(t, len(tc.body)/4, reservation.held)
			require.NotNil(t, info.TieredBillingSnapshot)
			assert.Equal(t, len(tc.body)/4, info.TieredBillingSnapshot.EstimatedPromptTokens)
			want, err := service.CountRequestToken(ctx, tc.request.GetTokenCountMeta(), info)
			require.NoError(t, err)
			assert.Equal(t, want, info.GetEstimatePromptTokens())

			// Valid upstream usage must never invoke the deferred local counter.
			calls := 0
			info.SetPromptTokenCounter(func() int {
				calls++
				count, err := service.CountRequestToken(ctx, tc.request.GetTokenCountMeta(), info)
				require.NoError(t, err)
				return count
			})
			info.RelayFormat = types.RelayFormatOpenAI
			response := &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":123,"completion_tokens":7,"total_tokens":130}}`))}
			usage, apiErr := openai.OpenaiHandler(ctx, info, response)
			require.Nil(t, apiErr)
			assert.Equal(t, 123, usage.PromptTokens)
			assert.Zero(t, calls)
			ok, quota, _ := service.TryTieredSettle(info, service.BuildTieredTokenParams(usage, false, nil))
			require.True(t, ok)
			assert.Equal(t, 123, quota)
			assert.Zero(t, calls)

			// Missing usage keeps the previous local count and is computed once.
			info.RelayFormat = tc.format
			want, err = service.CountRequestToken(ctx, tc.request.GetTokenCountMeta(), info)
			require.NoError(t, err)
			assert.Equal(t, want, info.GetEstimatePromptTokens())
			assert.Equal(t, want, info.GetEstimatePromptTokens())
			if tc.name == "chat" {
				response.Body = io.NopCloser(strings.NewReader(`{"model":"gpt-4o","choices":[{"message":{"role":"assistant","content":"ok"}}]}`))
				usage, apiErr = openai.OpenaiHandler(ctx, info, response)
				require.Nil(t, apiErr)
				assert.Equal(t, want, usage.PromptTokens)
			}
			assert.Equal(t, 1, calls)
			assert.Equal(t, len(tc.body)/4, reservation.held)
			assert.Equal(t, len(tc.body)/4, info.TieredBillingSnapshot.EstimatedPromptTokens)
		})
	}
}

func TestRequestTokenEstimateSpecialCases(t *testing.T) {
	oldCountToken := constant.CountToken
	constant.CountToken = true
	t.Cleanup(func() { constant.CountToken = oldCountToken })
	for _, tc := range []struct {
		name   string
		meta   *types.TokenCountMeta
		mode   int
		format types.RelayFormat
	}{
		{"character priced speech", &types.TokenCountMeta{TokenType: types.TokenTypeTextNumber, CombineText: "你好 world"}, relayconstant.RelayModeAudioSpeech, types.RelayFormatOpenAI},
		{"token priced speech", &types.TokenCountMeta{CombineText: "hello world"}, relayconstant.RelayModeAudioSpeech, types.RelayFormatOpenAI},
		{"media", &types.TokenCountMeta{CombineText: "hello", Files: []*types.FileMeta{{FileType: types.FileTypeAudio}}}, relayconstant.RelayModeChatCompletions, types.RelayFormatOpenAI},
		{"realtime", &types.TokenCountMeta{CombineText: "hello"}, relayconstant.RelayModeRealtime, types.RelayFormatOpenAIRealtime},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"input":"a long body that is not a token count"}`))
			common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gpt-4o")
			info := &relaycommon.RelayInfo{RelayFormat: tc.format, RelayMode: tc.mode}
			want, err := service.CountRequestToken(ctx, tc.meta, info)
			require.NoError(t, err)
			got, err := service.EstimateRequestToken(ctx, tc.meta, info)
			require.NoError(t, err)
			assert.Equal(t, want, got)
		})
	}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{BillingRequestInput: &billingexpr.RequestInput{Body: []byte(`{"input":"你好"}`)}}
	meta := &types.TokenCountMeta{CombineText: "你好"}
	tokens, err := service.EstimateRequestToken(ctx, meta, info)
	require.NoError(t, err)
	assert.Equal(t, len(info.BillingRequestInput.Body)/4, tokens)
	constant.CountToken = false
	tokens, err = service.EstimateRequestToken(ctx, meta, &relaycommon.RelayInfo{})
	require.NoError(t, err)
	assert.Zero(t, tokens)
	// Explicit token-counting endpoints do not use the billing estimate switch.
	tokens, err = service.CountRequestToken(ctx, meta, &relaycommon.RelayInfo{})
	require.NoError(t, err)
	assert.Positive(t, tokens)
}

func TestByteReservationPreservesPromptSensitiveCheck(t *testing.T) {
	oldEnabled, oldPrompt, oldWords := setting.CheckSensitiveEnabled, setting.CheckSensitiveOnPromptEnabled, setting.SensitiveWords
	setting.CheckSensitiveEnabled, setting.CheckSensitiveOnPromptEnabled, setting.SensitiveWords = true, true, []string{"blocked"}
	t.Cleanup(func() {
		setting.CheckSensitiveEnabled, setting.CheckSensitiveOnPromptEnabled, setting.SensitiveWords = oldEnabled, oldPrompt, oldWords
	})
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{Request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "blocked"}}}}
	apiErr := PrepareRequestBilling(ctx, info)
	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeSensitiveWordsDetected, apiErr.GetErrorCode())
}

func BenchmarkRequestTokenEstimation(b *testing.B) {
	oldCountToken := constant.CountToken
	constant.CountToken = true
	b.Cleanup(func() { constant.CountToken = oldCountToken })
	gin.SetMode(gin.TestMode)
	request := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: strings.Repeat("Summarize the API request lifecycle, quota reservation, and upstream usage settlement. 请用中文解释。\n", 512)}}}
	body, err := common.Marshal(request)
	require.NoError(b, err)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set(common.KeyRequestBody, body)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, request.Model)
	_, err = common.GetBodyStorage(ctx)
	require.NoError(b, err)
	b.Cleanup(func() { common.CleanupBodyStorage(ctx) })
	for _, method := range []string{"bytes", "tokenizer"} {
		b.Run(method, func(b *testing.B) {
			info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}
			b.ReportAllocs()
			b.SetBytes(int64(len(body)))
			for b.Loop() {
				meta := request.GetTokenCountMeta()
				if method == "bytes" {
					_, _ = service.EstimateRequestToken(ctx, meta, info)
				} else {
					_, _ = service.CountRequestToken(ctx, meta, info)
				}
			}
		})
	}
}
