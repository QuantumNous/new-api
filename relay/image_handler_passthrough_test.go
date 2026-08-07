package relay

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type recordingImageBillingSettler struct {
	preConsumed int
	settledWith []int
}

func (s *recordingImageBillingSettler) Settle(actualQuota int) error {
	s.settledWith = append(s.settledWith, actualQuota)
	return nil
}

func (s *recordingImageBillingSettler) Refund(*gin.Context) {}

func (s *recordingImageBillingSettler) NeedsRefund() bool { return len(s.settledWith) == 0 }

func (s *recordingImageBillingSettler) GetPreConsumedQuota() int { return s.preConsumed }

func (s *recordingImageBillingSettler) Reserve(targetQuota int) error {
	if targetQuota > s.preConsumed {
		s.preConsumed = targetQuota
	}
	return nil
}

func newImageAutoPassthroughTestContext(
	t *testing.T,
	upstreamURL string,
	requestBody string,
	relayMode int,
	channelPassthrough bool,
) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()

	path := "/v1/images/generations"
	if relayMode == relayconstant.RelayModeImagesEdits {
		path = "/v1/images/edits"
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(requestBody))
	c.Request.Header.Set("Content-Type", "application/json")

	common.SetContextKey(c, constant.ContextKeyOriginalModel, "image-auto")
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstreamURL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "test-key")
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, `{"image-auto":"route-alias","route-alias":"gpt-image-2"}`)
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{
		"model":   "param-override-must-not-win",
		"quality": "high",
		"n":       4,
		"size":    "1792x1024",
	})
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{
		PassThroughBodyEnabled: channelPassthrough,
	})

	n := uint(2)
	plan, err := (types.ImageRoutingConfig{
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []types.ImageRoutingRoute{{
			ID:                 "openai",
			ChannelID:          36,
			Priority:           1,
			Enabled:            true,
			BillingMode:        types.ImageRoutingBillingFixed,
			UpstreamModel:      "gpt-image-2",
			FixedQuotaPerImage: 100000,
		}},
	}).BuildPlan("low", n)
	require.NoError(t, err)
	routing := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, routing.ActivateRoute(0))

	info := &relaycommon.RelayInfo{
		RelayMode:       relayMode,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "image-auto",
		RequestURLPath:  path,
		Request: &dto.ImageRequest{
			Model:   "image-auto",
			Prompt:  "draw a lighthouse",
			N:       &n,
			Quality: "low",
			Size:    "1024x1024",
		},
		ImageRouting: routing,
	}
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	return c, info
}

func TestImageAutoGenerationSendsNormalizedFinalModel(t *testing.T) {
	originalGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(originalGinMode) })
	service.InitHttpClient()

	globalSettings := model_setting.GetGlobalSettings()
	originalGlobalPassthrough := globalSettings.PassThroughRequestEnabled
	t.Cleanup(func() { globalSettings.PassThroughRequestEnabled = originalGlobalPassthrough })

	tests := []struct {
		name               string
		globalPassthrough  bool
		channelPassthrough bool
	}{
		{name: "global passthrough", globalPassthrough: true},
		{name: "channel passthrough", channelPassthrough: true},
		{name: "model param override"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			globalSettings.PassThroughRequestEnabled = test.globalPassthrough
			var captureMutex sync.Mutex
			var upstreamBody []byte
			var upstreamBodyErr error
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				captureMutex.Lock()
				upstreamBody, upstreamBodyErr = io.ReadAll(r.Body)
				captureMutex.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadGateway)
				_, _ = w.Write([]byte(`{"error":{"message":"capture complete","type":"upstream_error","code":"capture_complete"}}`))
			}))
			defer upstream.Close()

			rawBody := `{"model":"image-auto","prompt":"draw a lighthouse","n":4,"quality":"standard","raw_only":"must-not-forward"}`
			c, info := newImageAutoPassthroughTestContext(
				t,
				upstream.URL,
				rawBody,
				relayconstant.RelayModeImagesGenerations,
				test.channelPassthrough,
			)

			apiErr := ImageHelper(c, info)

			require.NotNil(t, apiErr)
			captureMutex.Lock()
			capturedBody := append([]byte(nil), upstreamBody...)
			capturedErr := upstreamBodyErr
			captureMutex.Unlock()
			require.NoError(t, capturedErr)
			var actual map[string]any
			require.NoError(t, common.Unmarshal(capturedBody, &actual))
			require.Equal(t, "gpt-image-2", actual["model"])
			require.Equal(t, "draw a lighthouse", actual["prompt"])
			require.Equal(t, float64(2), actual["n"])
			require.Equal(t, "low", actual["quality"])
			require.Equal(t, "1024x1024", actual["size"])
			require.NotContains(t, actual, "raw_only")
		})
	}
}

func TestImageAutoEnterpriseCompatibilityDoesNotMutateRetryRequest(t *testing.T) {
	originalGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(originalGinMode) })
	service.InitHttpClient()

	var upstreamBody []byte
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		upstreamBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":{"message":"capture complete","type":"upstream_error","code":"capture_complete"}}`))
	}))
	defer upstream.Close()

	c, info := newImageAutoPassthroughTestContext(
		t,
		upstream.URL,
		`{"model":"image-auto","prompt":"draw a lighthouse","response_format":"b64_json"}`,
		relayconstant.RelayModeImagesGenerations,
		false,
	)
	request := info.Request.(*dto.ImageRequest)
	request.ResponseFormat = "b64_json"
	info.ImageRouting.Plan.Routes[0].BillingMode = types.ImageRoutingBillingMetered
	info.ImageRouting.Plan.Routes[0].BillingModel = "gpt-image-2"
	info.ImageRouting.Plan.Routes[0].BillingGroup = "GPT企业旗舰"

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	require.Equal(t, "b64_json", request.ResponseFormat)
	var actual map[string]any
	require.NoError(t, common.Unmarshal(upstreamBody, &actual))
	require.NotContains(t, actual, "response_format")
}

func TestImageAutoForwardsMultipartImageEdits(t *testing.T) {
	originalGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(originalGinMode) })
	service.InitHttpClient()
	globalSettings := model_setting.GetGlobalSettings()
	originalGlobalPassthrough := globalSettings.PassThroughRequestEnabled
	globalSettings.PassThroughRequestEnabled = false
	t.Cleanup(func() { globalSettings.PassThroughRequestEnabled = originalGlobalPassthrough })

	var upstreamCalls atomic.Int32
	var upstreamModel string
	var upstreamImage []byte
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		require.NoError(t, r.ParseMultipartForm(32<<20))
		upstreamModel = r.PostForm.Get("model")
		file, _, err := r.FormFile("image")
		require.NoError(t, err)
		defer file.Close()
		upstreamImage, err = io.ReadAll(file)
		require.NoError(t, err)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer upstream.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "image-auto"))
	require.NoError(t, writer.WriteField("prompt", "edit this"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("test-image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, info := newImageAutoPassthroughTestContext(
		t,
		upstream.URL,
		body.String(),
		relayconstant.RelayModeImagesEdits,
		false,
	)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	info.Request.(*dto.ImageRequest).Prompt = "edit this"

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.EqualValues(t, 1, upstreamCalls.Load())
	require.Equal(t, "gpt-image-2", upstreamModel)
	require.Equal(t, []byte("test-image"), upstreamImage)
}

func TestImageAutoPartialStreamErrorSettlesOnlyCompletedImages(t *testing.T) {
	originalGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(originalGinMode) })
	service.InitHttpClient()
	originalStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = originalStreamingTimeout })

	globalSettings := model_setting.GetGlobalSettings()
	originalGlobalPassthrough := globalSettings.PassThroughRequestEnabled
	globalSettings.PassThroughRequestEnabled = false
	t.Cleanup(func() { globalSettings.PassThroughRequestEnabled = originalGlobalPassthrough })
	originalLogConsumeEnabled := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = originalLogConsumeEnabled })

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(strings.Join([]string{
			`data: {"type":"image_generation.partial_image","b64_json":"partial"}`,
			``,
			`data: {"type":"upstream_error","error":{"message":"stream ID 77; balance 0"}}`,
			``,
		}, "\n")))
	}))
	defer upstream.Close()

	c, info := newImageAutoPassthroughTestContext(
		t,
		upstream.URL,
		`{"model":"image-auto","prompt":"draw a lighthouse","n":2,"stream":true}`,
		relayconstant.RelayModeImagesGenerations,
		false,
	)
	info.IsStream = true
	settler := &recordingImageBillingSettler{preConsumed: 200000}
	info.Billing = settler
	info.FinalPreConsumedQuota = settler.preConsumed
	info.PriceData.UsePrice = true
	info.PriceData.AddOtherRatio("n", 2)

	apiErr := ImageHelper(c, info)

	require.NotNil(t, apiErr)
	require.True(t, c.Writer.Written())
	require.Empty(t, settler.settledWith)
	require.False(t, info.ImageRouting.ReturnedImagesKnown)
}

func TestImageAutoJSONErrorsExposeOnlyGenericMessage(t *testing.T) {
	originalGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(originalGinMode) })
	service.InitHttpClient()

	globalSettings := model_setting.GetGlobalSettings()
	originalGlobalPassthrough := globalSettings.PassThroughRequestEnabled
	globalSettings.PassThroughRequestEnabled = false
	t.Cleanup(func() { globalSettings.PassThroughRequestEnabled = originalGlobalPassthrough })

	tests := []struct {
		name                string
		statusCode          int
		definitiveRejection bool
	}{
		{name: "ambiguous non 2xx JSON error", statusCode: http.StatusBadGateway},
		{name: "definitive rate limit", statusCode: http.StatusTooManyRequests, definitiveRejection: true},
		{name: "2xx error object", statusCode: http.StatusOK},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(test.statusCode)
				_, _ = w.Write([]byte(`{"error":{"message":"stream ID 77 from upstream.example; key sk-secret; balance 0","type":"upstream_error","code":"route_failure"}}`))
			}))
			defer upstream.Close()

			c, info := newImageAutoPassthroughTestContext(
				t,
				upstream.URL,
				`{"model":"image-auto","prompt":"draw a lighthouse"}`,
				relayconstant.RelayModeImagesGenerations,
				false,
			)

			apiErr := ImageHelper(c, info)

			require.NotNil(t, apiErr)
			require.Equal(t, test.statusCode, apiErr.StatusCode)
			require.Equal(t, types.ErrorCode("route_failure"), apiErr.GetErrorCode())
			require.Equal(t, "Image generation failed.", apiErr.ToOpenAIError().Message)
			require.NotContains(t, apiErr.ToOpenAIError().Message, "stream ID 77")
			require.NotContains(t, apiErr.ToOpenAIError().Message, "upstream.example")
			require.NotContains(t, apiErr.ToOpenAIError().Message, "sk-secret")
			require.NotContains(t, apiErr.ToOpenAIError().Message, "balance 0")
			require.Equal(t, test.definitiveRejection, types.IsImageRoutingUpstreamRejected(apiErr))
			require.False(t, c.Writer.Written())
		})
	}
}
