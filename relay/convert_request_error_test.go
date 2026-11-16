package relay

import (
	"cmp"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/MoeForge/moego/ojson"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	kitreasoning "github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type imageReservation struct {
	held, limit int
	settled     []int
	refunded    bool
}

func (s *imageReservation) Reserve(quota int) error {
	if quota > s.limit {
		return errors.New("insufficient image quota")
	}
	s.held = max(s.held, quota)
	return nil
}
func (s *imageReservation) GetPreConsumedQuota() int { return s.held }
func (s *imageReservation) Settle(quota int) error {
	s.settled = append(s.settled, quota)
	return nil
}
func (s *imageReservation) Refund(*gin.Context) {
	if s.NeedsRefund() {
		s.refunded = true
	}
}
func (s *imageReservation) NeedsRefund() bool { return len(s.settled) == 0 && !s.refunded }

func (s *imageReservation) ReserveBeforeSubmit(quota int) error { return s.Reserve(quota) }

func TestImageURLProxySettlesGeneratedImagesOnRewriteFailure(t *testing.T) {
	service.InitHttpClient()
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	batch, logConsume := common.BatchUpdateEnabled, common.LogConsumeEnabled
	address, publicAddress := system_setting.ServerAddress, system_setting.TaskPublicAddress
	common.BatchUpdateEnabled, common.LogConsumeEnabled = true, false
	system_setting.ServerAddress, system_setting.TaskPublicAddress = "https://gateway.example", ""
	t.Cleanup(func() {
		common.BatchUpdateEnabled, common.LogConsumeEnabled = batch, logConsume
		system_setting.ServerAddress, system_setting.TaskPublicAddress = address, publicAddress
	})
	const invalidURL = "ftp://upstream.example/image.png?secret=upstream"
	const validURL = "https://upstream.example/image.png?secret=upstream"
	const usage = `,"usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}`
	for _, tc := range []struct {
		name, response                      string
		channelType, count                  int
		edit, disabled, invalidBase, failed bool
	}{
		{name: "generation rewrite fails", response: `{"data":[{"url":"` + invalidURL + `"},{"url":"` + validURL + `"}]` + usage + `}`, count: 2},
		{name: "edit object rewrite fails", response: `{"data":{"url":"` + invalidURL + `"}` + usage + `}`, count: 1, edit: true},
		{name: "invalid public address", response: `{"data":[{"url":"` + validURL + `"}]` + usage + `}`, count: 1, invalidBase: true},
		{name: "disabled keeps response", response: `{"data":[{"url":"` + invalidURL + `"}]` + usage + `}`, count: 1, disabled: true},
		{name: "upstream failure refunds", response: `{"error":{"type":"upstream_error","message":"generation failed"}}`, failed: true},
		{name: "minimax rewrite fails", channelType: constant.ChannelTypeMiniMax, response: `{"data":{"image_urls":["` + invalidURL + `"]},"base_resp":{"status_code":0}}`, count: 3},
		{name: "jimeng rewrite fails", channelType: constant.ChannelTypeJimeng, response: `{"code":10000,"data":{"image_urls":["` + invalidURL + `"]}}`, count: 3},
		{name: "replicate rewrite fails", channelType: constant.ChannelTypeReplicate, response: `{"status":"succeeded","output":["` + invalidURL + `"]}`, count: 3},
	} {
		for _, pricing := range []string{"fixed", "image expression", "token expression"} {
			if pricing == "token expression" && tc.channelType != 0 {
				continue
			}
			t.Run(tc.name+"/"+pricing, func(t *testing.T) {
				var calls atomic.Int32
				upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					calls.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, tc.response)
				}))
				t.Cleanup(upstream.Close)
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				t.Cleanup(func() { common.CleanupBodyStorage(c) })
				path, mode := "/v1/images/generations", relayconstant.RelayModeImagesGenerations
				if tc.edit {
					path, mode = "/v1/images/edits", relayconstant.RelayModeImagesEdits
				}
				const body = `{"model":"gpt-image-2","prompt":"a cat","n":3}`
				c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
				c.Request.Header.Set("Content-Type", "application/json")
				common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-image-2")
				common.SetContextKey(c, constant.ContextKeyChannelType, cmp.Or(tc.channelType, constant.ChannelTypeOpenAI))
				common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
				common.SetContextKey(c, constant.ContextKeyChannelKey, "fixture-ak|fixture-sk")
				common.SetContextKey(c, constant.ContextKeyChannelId, 42)
				common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{ImageURLProxy: !tc.disabled})
				request, err := helper.GetAndValidOpenAIImageRequest(c, mode)
				require.NoError(t, err)
				info := relaycommon.GenRelayInfoImage(c, request)
				info.RelayMode = mode
				reservation := &imageReservation{held: 60000, limit: 500000}
				info.Billing = reservation
				info.UserQuota = 1000000
				info.PriceData = hosttypes.PriceData{UsePrice: true, ModelPrice: 0.04, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}
				wantQuota := tc.count * 20000
				if pricing != "fixed" {
					expr := `tier("image", fixed(0.04)) * image_count`
					estimatedCount := common.GetPointer(3)
					if pricing == "token expression" {
						expr, estimatedCount, wantQuota = `tier("tokens", p * 2 + c * 3)`, nil, 40
					}
					info.PriceData.UsePrice = false
					info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{BillingMode: "tiered_expr", ExprString: expr, ExprHash: billingexpr.ExprHashString(expr), GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit, EstimatedImageCount: estimatedCount}
					info.BillingRequestInput = &billingexpr.RequestInput{Body: []byte(body), ImageCount: common.GetPointer(3)}
				}
				if tc.invalidBase {
					system_setting.ServerAddress = "invalid"
					defer func() { system_setting.ServerAddress = "https://gateway.example" }()
				}

				apiErr := ImageHelper(c, info)
				if tc.disabled {
					require.Nil(t, apiErr)
					assert.Equal(t, tc.response, recorder.Body.String())
				} else {
					require.NotNil(t, apiErr)
					assert.False(t, c.Writer.Written(), "the relay must still return the error to the client")
					assert.NotContains(t, apiErr.Error(), "upstream.example")
					if !tc.failed {
						assert.True(t, types.IsSkipRetryError(apiErr))
						assert.Equal(t, types.ErrorCodeBadResponseBody, apiErr.GetErrorCode())
					}
				}
				assert.EqualValues(t, 1, calls.Load())
				assert.Same(t, apiErr, RefundFailedRequestBilling(c, info, apiErr))
				if tc.failed {
					assert.Empty(t, reservation.settled)
					assert.True(t, reservation.refunded)
					return
				}
				assert.Equal(t, []int{wantQuota}, reservation.settled)
				assert.False(t, reservation.refunded)
				consume, ok := common.GetContextKeyType[*model.RecordConsumeLogParams](c, constant.ContextKeyConsumeLog)
				require.True(t, ok)
				assert.Equal(t, wantQuota, consume.Quota)
				if tc.channelType == 0 {
					assert.Equal(t, 10, consume.PromptTokens)
					assert.Equal(t, 20, consume.CompletionTokens)
				}
			})
		}
	}
}

func TestImageRequestReservesFinalQuantityBeforeUpstream(t *testing.T) {
	service.InitHttpClient()
	previous := common.GetDiskCacheConfig()
	common.SetDiskCacheConfig(common.DiskCacheConfig{Enabled: true, ThresholdMB: 0, MaxSizeMB: 16, Path: t.TempDir()})
	t.Cleanup(func() { common.SetDiskCacheConfig(previous) })
	for _, tc := range []struct {
		name, body, storedBody                        string
		tiered, passThrough, insufficient, retryReset bool
		// deleted makes the channel override delete the count member.
		deleted       bool
		override      any
		count, status int
		// channelType, model and member are the channel's, the model the
		// request names and the upstream member that carries the count;
		// OpenAI, gpt-image-2 and n when empty.
		channelType   int
		model, member string
	}{
		{name: "top-level count", body: `{"model":"gpt-image-2","n":2,"parameters":{}}`, count: 2},
		{name: "vendor count from the client body", body: `{"model":"flux","prompt":"cat","batch_size":4}`, count: 4,
			channelType: constant.ChannelTypeSiliconFlow, model: "flux", member: "batch_size"},
		{name: "vendor count channel override", body: `{"model":"flux","prompt":"cat","n":1}`, override: 3, count: 3,
			channelType: constant.ChannelTypeSiliconFlow, model: "flux", member: "batch_size"},
		{name: "nested vendor count channel override", body: `{"model":"imagen-4.0-generate-001","prompt":"cat","n":1}`, override: 3, count: 3,
			channelType: constant.ChannelTypeGemini, model: "imagen-4.0-generate-001", member: "parameters.sampleCount"},
		{name: "vendor default when the count member is deleted", body: `{"model":"imagen-4.0-generate-001","prompt":"cat","n":1}`, deleted: true, count: 4,
			channelType: constant.ChannelTypeGemini, model: "imagen-4.0-generate-001", member: "parameters.sampleCount"},
		{name: "vendor count in a nested client member", body: `{"model":"flux","prompt":"cat","input":{"num_outputs":3}}`, count: 3,
			channelType: constant.ChannelTypeReplicate, model: "flux", member: "input.num_outputs"},
		{name: "oversized vendor count rejected", body: `{"model":"flux","prompt":"cat","batch_size":129}`, status: http.StatusBadRequest,
			channelType: constant.ChannelTypeSiliconFlow, model: "flux", member: "batch_size"},
		{name: "legacy channel quantity override", body: `{"model":"gpt-image-2","n":1}`, override: 4, count: 4},
		{name: "expression channel quantity override", body: `{"model":"gpt-image-2","n":1}`, override: 4, count: 4, tiered: true},
		{name: "pass-through quantity", body: `{"model":"gpt-image-2","n":2,"parameters":{}}`, count: 2, passThrough: true},
		{name: "large pass-through file", body: `{"model":"gpt-image-2","image":"` + strings.Repeat("A", 1<<20) + `","n":2}`, count: 2, passThrough: true},
		{name: "pass-through duplicate quantity uses last value", body: `{"model":"gpt-image-2","n":1,"n":2}`, count: 2, passThrough: true},
		{name: "pass-through zero quantity", body: `{"model":"gpt-image-2","n":0}`, count: 1, passThrough: true},
		{name: "pass-through file quantity revalidated", body: `{"model":"gpt-image-2","n":1}`, storedBody: `{"model":"gpt-image-2","n":129}`, passThrough: true, status: http.StatusBadRequest},
		{name: "pass-through vendor count", body: `{"model":"flux","prompt":"cat","batch_size":3}`, count: 3, passThrough: true,
			channelType: constant.ChannelTypeSiliconFlow, model: "flux", member: "batch_size"},
		{name: "pass-through file vendor count revalidated", body: `{"model":"flux","prompt":"cat","batch_size":1}`, storedBody: `{"model":"flux","prompt":"cat","batch_size":129}`, passThrough: true, status: http.StatusBadRequest,
			channelType: constant.ChannelTypeSiliconFlow, model: "flux", member: "batch_size"},
		{name: "oversized override rejected", body: `{"model":"gpt-image-2","n":1}`, override: 129, status: http.StatusBadRequest},
		{name: "insufficient reservation blocks upstream", body: `{"model":"gpt-image-2","n":1}`, override: 4, count: 4, insufficient: true, status: http.StatusForbidden},
		{name: "retry drops the previous attempt's quantity", body: `{"model":"gpt-image-2","n":1}`, count: 1, retryReset: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			received := make(chan []byte, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				if err == nil {
					received <- body
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadGateway)
				_, _ = io.WriteString(w, `{"error":{"message":"fixture upstream failure","type":"upstream_error"}}`)
			}))
			t.Cleanup(upstream.Close)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			t.Cleanup(func() { common.CleanupBodyStorage(c) })
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			channelType, model, member := cmp.Or(tc.channelType, constant.ChannelTypeOpenAI), cmp.Or(tc.model, "gpt-image-2"), cmp.Or(tc.member, "n")
			common.SetContextKey(c, constant.ContextKeyChannelType, channelType)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "fixture-key")
			common.SetContextKey(c, constant.ContextKeyOriginalModel, model)
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: tc.passThrough})
			if tc.override != nil {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"operations": []any{map[string]any{"path": member, "mode": "set", "value": tc.override}}})
			}
			if tc.deleted {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"operations": []any{map[string]any{"path": member, "mode": "delete"}}})
			}
			request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			if tc.storedBody != "" {
				common.CleanupBodyStorage(c)
				storage, err := common.CreateBodyStorage([]byte(tc.storedBody))
				require.NoError(t, err)
				c.Set(common.KeyBodyStorage, storage)
			}
			reservation := &imageReservation{held: 20000, limit: 500000}
			if tc.insufficient {
				reservation.limit = reservation.held
			}
			info := &relaycommon.RelayInfo{Request: request, OriginModelName: model, RelayMode: relayconstant.RelayModeImagesGenerations,
				RequestURLPath: c.Request.URL.Path, Billing: reservation,
				PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 0.04, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}},
			}
			if tc.tiered {
				expr := `tier("image", fixed(0.04)) * image_count`
				info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{BillingMode: "tiered_expr", ExprString: expr, ExprHash: billingexpr.ExprHashString(expr), GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit, EstimatedImageCount: common.GetPointer(1)}
				info.BillingRequestInput = &billingexpr.RequestInput{Body: []byte(tc.body), ImageCount: common.GetPointer(1)}
				info.PriceData.UsePrice = false
			}
			if tc.retryReset {
				reservation.held = 80000
				info.PriceData.AddOtherRatio("n", 4)
				info.BillingImageCount = common.GetPointer(3)
			}
			apiErr := ImageHelper(c, info)
			require.NotNil(t, apiErr)
			if tc.status != 0 {
				assert.Equal(t, tc.status, apiErr.StatusCode)
				assert.Empty(t, received, "no upstream submission before quantity validation and reservation")
				return
			}
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			require.Len(t, received, 1)
			body := <-received
			switch {
			case tc.deleted:
				assert.False(t, ojson.GetBytes(body, member).Exists(), string(body))
			case tc.passThrough:
				assert.Equal(t, tc.body, string(body))
			default:
				assert.Equal(t, int64(tc.count), ojson.GetBytes(body, member).Int())
			}
			assert.Equal(t, tc.count*20000, info.PriceData.QuotaToPreConsume)
			assert.GreaterOrEqual(t, reservation.held, info.PriceData.QuotaToPreConsume)
			assert.Nil(t, info.BillingImageCount)
			if tc.tiered {
				assert.Equal(t, tc.body, string(info.BillingRequestInput.Body))
				assert.Equal(t, 1, *info.BillingRequestInput.ImageCount)
			}
		})
	}
}

func TestOptInSafeToolLossRejectedAsBadRequestWithAdminDiagnostics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				ToolLossPolicy: string(types.ConversionLossPolicySafe),
			},
		},
	}

	tools, err := common.Marshal([]map[string]any{{"codeExecution": map[string]any{}}})
	require.NoError(t, err)
	req := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "run this"}}},
		},
		Tools: tools,
	}

	result, convErr := service.ConvertRequest(c, info, types.RelayFormatOpenAI, req)
	require.Error(t, convErr)
	var loss *types.ConversionLossError
	require.ErrorAs(t, convErr, &loss)
	require.NotEmpty(t, loss.Diagnostics)
	require.NotNil(t, result)

	apiErr := newConvertRequestFailedError(c, info, convErr)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeConvertRequestFailed, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))

	diagnostics := info.ConversionDiagnostics()
	require.NotEmpty(t, diagnostics)
	assert.True(t, hasHostDiagnosticCode(diagnostics, "unsupported_hosted_tool"))

	other := service.GenerateTextOtherInfo(c, info, 1, 1, 1, 0, 0, 0, 1)
	adminInfo, ok := other.Snapshot()["admin_info"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, adminInfo, "conversion_diagnostics")
}

func TestUnknownModelModifierIsBadRequestWithoutRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "m@thinkin:on",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "m@thinkin:on",
		},
	}
	err := helper.ApplyReasoningModelSuffix(c, info)
	require.Error(t, err)
	require.True(t, kitreasoning.IsClientError(err))
	assert.Contains(t, err.Error(), `unsupported model modifier "thinkin"`)
	assert.Contains(t, err.Error(), "re:")

	apiErr := newConvertRequestFailedError(c, info, err)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeConvertRequestFailed, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
}

func hasHostDiagnosticCode(diagnostics []types.ConversionDiagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}

func TestGeminiThinkingControlsConvertBestEffort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settings := model_setting.GetGeminiSettings()
	originalAdapter := settings.ThinkingAdapterEnabled
	t.Cleanup(func() { settings.ThinkingAdapterEnabled = originalAdapter })

	t.Run("openai thinking_budget on gemini 3 becomes thinkingLevel", func(t *testing.T) {
		settings.ThinkingAdapterEnabled = false
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		req := &dto.GeneralOpenAIRequest{
			Model:     "gemini-3.1-pro-preview-thinking",
			Messages:  []dto.Message{{Role: "user", Content: "hello"}},
			ExtraBody: []byte(`{"google":{"thinking_config":{"thinking_budget":8192}}}`),
		}
		info := &relaycommon.RelayInfo{
			RelayFormat:     types.RelayFormatOpenAI,
			OriginModelName: "gemini-3.1-pro-preview-thinking",
			Request:         req,
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3.1-pro-preview"},
		}
		require.NoError(t, helper.ApplyReasoningModelSuffix(c, info, req))

		result, err := service.ConvertRequest(c, info, types.RelayFormatGemini, req)
		require.NoError(t, err)
		converted, ok := result.Value.(*dto.GeminiChatRequest)
		require.True(t, ok)
		require.NotNil(t, converted.GenerationConfig.ThinkingConfig)
		assert.Equal(t, "medium", converted.GenerationConfig.ThinkingConfig.ThinkingLevel)
		assert.Nil(t, converted.GenerationConfig.ThinkingConfig.ThinkingBudget)
		assert.True(t, hasHostDiagnosticCode(info.ConversionDiagnostics(), "gemini_budget_to_level"))
	})

	t.Run("thinking alias with native thinking_level keeps the level", func(t *testing.T) {
		settings.ThinkingAdapterEnabled = true
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		req := &dto.GeneralOpenAIRequest{
			Model:     "gemini-3.1-pro-preview-thinking",
			Messages:  []dto.Message{{Role: "user", Content: "hello"}},
			ExtraBody: []byte(`{"google":{"thinking_config":{"thinking_level":"low"}}}`),
		}
		info := &relaycommon.RelayInfo{
			RelayFormat:     types.RelayFormatOpenAI,
			OriginModelName: "gemini-3.1-pro-preview-thinking",
			Request:         req,
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3.1-pro-preview-thinking"},
		}
		require.NoError(t, helper.ApplyReasoningModelSuffix(c, info, req))
		assert.Equal(t, "gemini-3.1-pro-preview", info.UpstreamModelName)

		result, err := service.ConvertRequest(c, info, types.RelayFormatGemini, req)
		require.NoError(t, err)
		converted, ok := result.Value.(*dto.GeminiChatRequest)
		require.True(t, ok)
		require.NotNil(t, converted.GenerationConfig.ThinkingConfig)
		assert.Equal(t, "low", converted.GenerationConfig.ThinkingConfig.ThinkingLevel)
		assert.Nil(t, converted.GenerationConfig.ThinkingConfig.ThinkingBudget)
	})

	t.Run("gemini thinkingBudget converts to openai reasoning_effort", func(t *testing.T) {
		settings.ThinkingAdapterEnabled = false
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3.1-pro-preview:generateContent", nil)
		budget := 8192
		req := &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "hello"}}}},
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ThinkingConfig: &dto.GeminiThinkingConfig{ThinkingBudget: &budget},
			},
		}
		info := &relaycommon.RelayInfo{
			RelayFormat:     types.RelayFormatGemini,
			OriginModelName: "gemini-3.1-pro-preview",
			Request:         req,
			ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
		}

		result, err := service.ConvertRequest(c, info, types.RelayFormatOpenAI, req)
		require.NoError(t, err)
		converted, ok := result.Value.(*dto.GeneralOpenAIRequest)
		require.True(t, ok)
		assert.Equal(t, "medium", converted.ReasoningEffort)
		assert.True(t, hasHostDiagnosticCode(info.ConversionDiagnostics(), "gemini_budget_to_level"))
	})
}

// An Ali image model the alibaba task plugin does not claim is rejected by the
// adaptor with a classified 400 that skips retries. ImageHelper must surface
// that classification unchanged instead of wrapping it into a retryable
// conversion failure that other channels would then be asked to serve.
func TestImageHelperKeepsAdaptorClassifiedConvertError(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"wanx-style-repaint-v1","prompt":"a cat"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeAli)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://dashscope.invalid")
	request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{Request: request, OriginModelName: "wanx-style-repaint-v1", RelayMode: relayconstant.RelayModeImagesGenerations,
		RequestURLPath: c.Request.URL.Path, Billing: &imageReservation{limit: 500000},
		PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 0.04, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}},
	}

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr), "other channels must not be asked to serve the same name")
	assert.Contains(t, apiErr.Error(), "not served by the alibaba task plugin")
}

// Image request failures the gateway raises before contacting the upstream are
// request errors: a conversion the adaptor rejects, and a channel override
// condition that meets a request value of another type. Neither may be retried
// on other channels nor count as a channel error that could disable the
// channel.
func TestImageHelperLocalFailuresAreRequestErrors(t *testing.T) {
	for _, tc := range []struct {
		name        string
		channelType int
		override    map[string]any
		code        types.ErrorCode
		status      int
	}{
		{name: "adaptor conversion failure", channelType: constant.ChannelTypeAnthropic, code: types.ErrorCodeConvertRequestFailed, status: http.StatusInternalServerError},
		{
			name:        "override condition meets a request value of another type",
			channelType: constant.ChannelTypeOpenAI,
			override: map[string]any{"operations": []any{map[string]any{
				"path": "size", "mode": "set", "value": "1024x1024",
				"conditions": []any{map[string]any{"path": "quality", "mode": "gt", "value": 1}},
			}}},
			code:   types.ErrorCodeInvalidRequest,
			status: http.StatusBadRequest,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"gpt-image-2","prompt":"a cat","quality":"high"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyChannelType, tc.channelType)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://upstream.invalid")
			common.SetContextKey(c, constant.ContextKeyChannelKey, "fixture-key")
			common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-image-2")
			if tc.override != nil {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, tc.override)
			}
			request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{Request: request, OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeImagesGenerations,
				RequestURLPath: c.Request.URL.Path, Billing: &imageReservation{limit: 500000},
				PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 0.04, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}},
			}

			apiErr := ImageHelper(c, info)

			require.NotNil(t, apiErr)
			assert.Equal(t, tc.code, apiErr.GetErrorCode())
			assert.Equal(t, tc.status, apiErr.StatusCode)
			assert.False(t, types.IsChannelError(apiErr))
			assert.True(t, types.IsSkipRetryError(apiErr), "the same request fails the same way on every channel")
			assert.Equal(t, "local", service.RelayErrorSource(apiErr))
		})
	}
}
