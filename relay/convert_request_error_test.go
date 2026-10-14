package relay

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/relay/channel/volcengine"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	kitreasoning "github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type imageReservation struct {
	held, limit int
}

func (s *imageReservation) Reserve(quota int) error {
	if quota > s.limit {
		return errors.New("insufficient image quota")
	}
	s.held = max(s.held, quota)
	return nil
}
func (s *imageReservation) GetPreConsumedQuota() int { return s.held }
func (*imageReservation) Settle(int) error           { return nil }
func (*imageReservation) Refund(*gin.Context)        {}
func (*imageReservation) NeedsRefund() bool          { return false }

type seedreamSettlementRecorder struct {
	preConsumedQuota int
	reserveCalls     int
	settleCalls      int
	settledQuota     int
}

func (s *seedreamSettlementRecorder) Reserve(quota int) error {
	s.reserveCalls++
	s.preConsumedQuota = max(s.preConsumedQuota, quota)
	return nil
}

func (s *seedreamSettlementRecorder) GetPreConsumedQuota() int {
	return s.preConsumedQuota
}

func (s *seedreamSettlementRecorder) Settle(quota int) error {
	s.settleCalls++
	s.settledQuota = quota
	return nil
}

func (*seedreamSettlementRecorder) Refund(*gin.Context) {}
func (*seedreamSettlementRecorder) NeedsRefund() bool   { return false }

func TestSeedreamLayerDecompositionOutboundMatchesFrozenSettlement(t *testing.T) {
	const (
		modelName = "doubao-seedream-5-0-pro-260628"
		expr      = `tier("per_image", fixed(images_up_to_1_5k * 0.04109589041 + images_above_1_5k * 0.08219178082 + max(input_images - 1, 0) * 0.002739726027))`
	)
	body := `{
		"model":"` + modelName + `",
		"prompt":"a red observatory",
		"size":"1K",
		"image":"https://input.example/reference.png",
		"layer_decomposition":true,
		"vendor_private":{"must":"stay omitted"}
	}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		Request:         request,
		OriginModelName: modelName,
		RelayMode:       relayconstant.RelayModeImagesGenerations,
	}
	input, err := helper.ResolveImageBillingRequestInput(c, info, billingexpr.RequestInput{Body: []byte(body)})
	require.NoError(t, err)
	require.NotNil(t, input.ImagesUpTo1_5K)
	require.NotNil(t, input.ImagesAbove1_5K)
	require.NotNil(t, input.InputImages)
	assert.Equal(t, float64(17), *input.ImagesUpTo1_5K)
	assert.Equal(t, float64(0), *input.ImagesAbove1_5K)
	assert.Equal(t, float64(1), *input.InputImages)
	assert.Empty(t, input.Body)
	frozenJSON, err := common.Marshal(input)
	require.NoError(t, err)
	assert.NotContains(t, string(frozenJSON), "observatory")
	assert.NotContains(t, string(frozenJSON), "reference.png")

	converted, err := (&volcengine.Adaptor{}).ConvertImageRequest(c, info, *request)
	require.NoError(t, err)
	outboundJSON, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.True(t, gjson.GetBytes(outboundJSON, "layer_decomposition").Exists())
	assert.True(t, gjson.GetBytes(outboundJSON, "layer_decomposition").Bool())
	assert.False(t, gjson.GetBytes(outboundJSON, "vendor_private").Exists())

	expectedFixedPrice := 17 * 0.04109589041
	expectedQuota := billingexpr.QuotaRound(expectedFixedPrice * float64(common.QuotaPerUnit))
	settler := &seedreamSettlementRecorder{preConsumedQuota: expectedQuota}
	info.BillingRequestInput = &input
	info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{
		BillingMode:              "tiered_expr",
		ExprString:               expr,
		ExprHash:                 billingexpr.ExprHashString(expr),
		GroupRatio:               1,
		QuotaPerUnit:             float64(common.QuotaPerUnit),
		EstimatedQuotaAfterGroup: expectedQuota,
		EstimatedBillingUnit:     billingexpr.BillingUnitRequest,
		EstimatedFixedPrice:      common.GetPointer(expectedFixedPrice),
	}
	info.FinalPreConsumedQuota = expectedQuota
	info.UserQuota = expectedQuota + common.QuotaRemindThreshold
	info.Billing = settler

	directResult, err := billingexpr.ComputeTieredQuotaWithRequest(info.TieredBillingSnapshot, billingexpr.TokenParams{}, input)
	require.NoError(t, err)
	assert.Equal(t, expectedQuota, directResult.ActualQuotaAfterGroup)
	ok, settledQuota, result := service.TryTieredSettle(info, billingexpr.TokenParams{})
	require.True(t, ok)
	require.NotNil(t, result)
	assert.Equal(t, expectedQuota, settledQuota)
	assert.Equal(t, billingexpr.BillingUnitRequest, result.BillingUnit)
	require.NoError(t, service.SettleBilling(c, info, settledQuota))
	assert.Equal(t, 1, settler.settleCalls)
	assert.Equal(t, expectedQuota, settler.settledQuota)
}

func TestSeedreamFinalOutboundOverridesMatchReservationAndSettlement(t *testing.T) {
	service.InitHttpClient()
	const (
		modelName = "doubao-seedream-5-0-pro-260628"
		expr      = `tier("per_image", fixed(images_up_to_1_5k * 0.04109589041 + images_above_1_5k * 0.08219178082 + max(input_images - 1, 0) * 0.002739726027))`
	)
	tests := []struct {
		name             string
		body             string
		overridePath     string
		overrideValue    any
		wantOutboundJSON string
		wantLower        float64
		wantHigher       float64
		wantInputs       float64
		wantImageCount   int
		wantFixedPrice   float64
	}{
		{
			name:             "n",
			body:             `{"model":"` + modelName + `","prompt":"sensitive prompt","n":1,"size":"1K"}`,
			overridePath:     "n",
			overrideValue:    4,
			wantOutboundJSON: `4`,
			wantLower:        4,
			wantImageCount:   4,
			wantFixedPrice:   4 * 0.04109589041,
		},
		{
			name:             "size",
			body:             `{"model":"` + modelName + `","prompt":"sensitive prompt","n":2,"size":"1K"}`,
			overridePath:     "size",
			overrideValue:    "2K",
			wantOutboundJSON: `"2K"`,
			wantHigher:       2,
			wantImageCount:   2,
			wantFixedPrice:   2 * 0.08219178082,
		},
		{
			name:             "image",
			body:             `{"model":"` + modelName + `","prompt":"sensitive prompt","size":"1K","image":"https://private.invalid/original.png"}`,
			overridePath:     "image",
			overrideValue:    []any{"https://private.invalid/a.png", "data:image/png;base64,cHJpdmF0ZQ==", "https://private.invalid/c.png"},
			wantOutboundJSON: `["https://private.invalid/a.png","data:image/png;base64,cHJpdmF0ZQ==","https://private.invalid/c.png"]`,
			wantLower:        1,
			wantInputs:       3,
			wantImageCount:   1,
			wantFixedPrice:   0.04109589041 + 2*0.002739726027,
		},
		{
			name:             "layer_decomposition",
			body:             `{"model":"` + modelName + `","prompt":"sensitive prompt","size":"2K","image":"https://private.invalid/original.png","layer_decomposition":false}`,
			overridePath:     "layer_decomposition",
			overrideValue:    true,
			wantOutboundJSON: `true`,
			wantHigher:       17,
			wantInputs:       1,
			wantImageCount:   17,
			wantFixedPrice:   17 * 0.08219178082,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			type outboundCapture struct {
				body []byte
				err  error
			}
			received := make(chan outboundCapture, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				body, readErr := io.ReadAll(request.Body)
				received <- outboundCapture{body: body, err: readErr}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadGateway)
				_, _ = io.WriteString(w, `{"error":{"message":"fixture upstream failure","type":"upstream_error"}}`)
			}))
			t.Cleanup(upstream.Close)

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeVolcEngine)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, modelName)
			common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{
				"operations": []any{
					map[string]any{"path": tc.overridePath, "mode": "set", "value": tc.overrideValue},
					map[string]any{"path": "vendor_private", "mode": "set", "value": map[string]any{"secret": "must-not-freeze"}},
				},
			})

			request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{
				Request:         request,
				OriginModelName: modelName,
				RelayMode:       relayconstant.RelayModeImagesGenerations,
				RequestURLPath:  c.Request.URL.Path,
				PriceData: hosttypes.PriceData{
					GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
				},
			}
			input, err := helper.ResolveImageBillingRequestInput(c, info, billingexpr.RequestInput{
				Headers:         map[string]string{"X-Billing-Test": "kept"},
				Body:            []byte(tc.body),
				EvaluatedAtUnix: 1_800_000_000,
			})
			require.NoError(t, err)
			initialCost, initialTrace, err := billingexpr.RunExprWithRequest(expr, billingexpr.TokenParams{}, input)
			require.NoError(t, err)
			initialQuota := billingexpr.QuotaRound(initialCost / 1_000_000 * common.QuotaPerUnit)
			settler := &seedreamSettlementRecorder{preConsumedQuota: initialQuota}
			info.BillingRequestInput = &input
			info.Billing = settler
			info.UserQuota = int(10 * common.QuotaPerUnit)
			info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{
				BillingMode:              "tiered_expr",
				ExprString:               expr,
				ExprHash:                 billingexpr.ExprHashString(expr),
				GroupRatio:               1,
				QuotaPerUnit:             float64(common.QuotaPerUnit),
				EstimatedImageCount:      initialTrace.ImageCount,
				EstimatedQuotaAfterGroup: initialQuota,
				EstimatedBillingUnit:     initialTrace.BillingUnit,
				EstimatedFixedPrice:      initialTrace.FixedPrice,
				PricingTimeUnix:          input.EvaluatedAtUnix,
			}

			apiErr := ImageHelper(c, info)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			require.Len(t, received, 1)
			captured := <-received
			require.NoError(t, captured.err)
			outbound := captured.body
			assert.JSONEq(t, tc.wantOutboundJSON, gjson.GetBytes(outbound, tc.overridePath).Raw)
			assert.Equal(t, "must-not-freeze", gjson.GetBytes(outbound, "vendor_private.secret").String())

			require.NotNil(t, info.BillingRequestInput)
			assert.Empty(t, info.BillingRequestInput.Body)
			assert.Empty(t, info.BillingRequestInput.Usage)
			assert.Equal(t, int64(1_800_000_000), info.BillingRequestInput.EvaluatedAtUnix)
			assert.Equal(t, "kept", info.BillingRequestInput.Headers["X-Billing-Test"])
			require.NotNil(t, info.BillingRequestInput.ImagesUpTo1_5K)
			require.NotNil(t, info.BillingRequestInput.ImagesAbove1_5K)
			require.NotNil(t, info.BillingRequestInput.InputImages)
			assert.Equal(t, tc.wantLower, *info.BillingRequestInput.ImagesUpTo1_5K)
			assert.Equal(t, tc.wantHigher, *info.BillingRequestInput.ImagesAbove1_5K)
			assert.Equal(t, tc.wantInputs, *info.BillingRequestInput.InputImages)
			require.NotNil(t, info.BillingRequestInput.ImageCount)
			assert.Equal(t, tc.wantImageCount, *info.BillingRequestInput.ImageCount)
			frozenJSON, err := common.Marshal(info.BillingRequestInput)
			require.NoError(t, err)
			for _, forbidden := range []string{"sensitive prompt", "private.invalid", "base64", "vendor_private", "must-not-freeze"} {
				assert.NotContains(t, string(frozenJSON), forbidden)
			}

			expectedQuota := billingexpr.QuotaRound(tc.wantFixedPrice * common.QuotaPerUnit)
			assert.Equal(t, expectedQuota, info.PriceData.QuotaToPreConsume)
			assert.Equal(t, expectedQuota, settler.preConsumedQuota)
			assert.Equal(t, 1, settler.reserveCalls)
			assert.Equal(t, expectedQuota, info.FinalPreConsumedQuota)

			ok, settledQuota, result := service.TryTieredSettle(info, billingexpr.TokenParams{})
			require.True(t, ok)
			require.NotNil(t, result)
			assert.Equal(t, expectedQuota, settledQuota)
			require.NoError(t, service.SettleBilling(c, info, settledQuota))
			assert.Equal(t, 1, settler.settleCalls)
			assert.Equal(t, expectedQuota, settler.settledQuota)
		})
	}
}

func TestSeedreamInvalidFinalOverridesFailBeforeDispatch(t *testing.T) {
	service.InitHttpClient()
	const modelName = "doubao-seedream-5-0-pro-260628"
	tests := []struct {
		name          string
		body          string
		overridePath  string
		overrideValue any
		passThrough   bool
	}{
		{name: "converted n zero", body: `{"model":"` + modelName + `","size":"1K","n":1}`, overridePath: "n", overrideValue: 0},
		{name: "pass-through n zero", body: `{"model":"` + modelName + `","size":"1K","n":0}`, passThrough: true},
		{name: "invalid image type", body: `{"model":"` + modelName + `","size":"1K"}`, overridePath: "image", overrideValue: map[string]any{"url": "https://private.invalid/a.png"}},
		{name: "layer requires one image", body: `{"model":"` + modelName + `","size":"1K","image":["a","b"]}`, overridePath: "layer_decomposition", overrideValue: true},
		{name: "layer must be boolean", body: `{"model":"` + modelName + `","size":"1K","image":"a"}`, overridePath: "layer_decomposition", overrideValue: "true"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			dispatched := make(chan struct{}, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				dispatched <- struct{}{}
				w.WriteHeader(http.StatusBadGateway)
			}))
			t.Cleanup(upstream.Close)

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeVolcEngine)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, modelName)
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: tc.passThrough})
			if tc.overridePath != "" {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{
					"operations": []any{map[string]any{"path": tc.overridePath, "mode": "set", "value": tc.overrideValue}},
				})
			}

			request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			reservation := &imageReservation{limit: int(10 * common.QuotaPerUnit)}
			info := &relaycommon.RelayInfo{
				Request:         request,
				OriginModelName: modelName,
				RelayMode:       relayconstant.RelayModeImagesGenerations,
				RequestURLPath:  c.Request.URL.Path,
				Billing:         reservation,
				PriceData: hosttypes.PriceData{
					UsePrice:       true,
					ModelPrice:     0.30 / 7.3,
					GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
				},
			}

			apiErr := ImageHelper(c, info)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			assert.True(t, types.IsSkipRetryError(apiErr))
			assert.Empty(t, dispatched)
			assert.Zero(t, reservation.held)
		})
	}
}

func TestSeedreamLayerDecompositionRequiresBooleanJSON(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		strings.NewReader(`{"model":"doubao-seedream-5-0-pro-260628","image":"https://input.example/reference.png","layer_decomposition":"true"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	_, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	require.ErrorContains(t, err, "cannot unmarshal")
}

func TestImageRequestReservesFinalQuantityBeforeUpstream(t *testing.T) {
	service.InitHttpClient()
	for _, tc := range []struct {
		name, body                                    string
		tiered, passThrough, insufficient, retryReset bool
		override                                      any
		count, status                                 int
	}{
		{name: "top-level count", body: `{"model":"gpt-image-2","n":2,"parameters":{}}`, count: 2},
		{name: "legacy channel quantity override", body: `{"model":"gpt-image-2","n":1}`, override: 4, count: 4},
		{name: "expression channel quantity override", body: `{"model":"gpt-image-2","n":1}`, override: 4, count: 4, tiered: true},
		{name: "pass-through quantity", body: `{"model":"gpt-image-2","n":2,"parameters":{}}`, count: 2, passThrough: true},
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
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: tc.passThrough})
			if tc.override != nil {
				common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{"operations": []any{map[string]any{"path": "n", "mode": "set", "value": tc.override}}})
			}
			request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			reservation := &imageReservation{held: 20000, limit: 500000}
			if tc.insufficient {
				reservation.limit = reservation.held
			}
			info := &relaycommon.RelayInfo{Request: request, OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeImagesGenerations,
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
			assert.Equal(t, int64(tc.count), gjson.GetBytes(body, "n").Int())
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
