package relay

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestNormalizeImageUsageForBillingOnlyFallbacksPerCall(t *testing.T) {
	t.Run("token-priced usage keeps zero prompt tokens", func(t *testing.T) {
		usage := &dto.Usage{CompletionTokens: 196}
		normalizeImageUsageForBilling(usage, false)
		if usage.PromptTokens != 0 || usage.TotalTokens != 0 {
			t.Fatalf("token usage was synthesized: %+v", usage)
		}
	})

	t.Run("per-call empty usage still gets a billable marker", func(t *testing.T) {
		usage := &dto.Usage{}
		normalizeImageUsageForBilling(usage, true)
		if usage.PromptTokens != 1 || usage.TotalTokens != 1 {
			t.Fatalf("per-call fallback missing: %+v", usage)
		}
	})
}

func TestLogImageRequestBodyForDebugRedactsGrokImageData(t *testing.T) {
	const secretMarker = "SECRET_BASE64_MARKER"
	oldDebug := common.DebugEnabled
	common.DebugEnabled = true
	defer func() { common.DebugEnabled = oldDebug }()

	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logs
	common.LogWriterMu.Unlock()
	defer func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	}()

	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesEdits,
		RelayFormat: types.RelayFormatOpenAIImage,
		ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeGrokSubscription},
	}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	logImageRequestBodyForDebug(c, info, []byte(`{"model":"grok-imagine-image-2.0","image":{"image_url":{"url":"data:image/png;base64,`+secretMarker+`"}},"images":[{"image_url":{"url":"https://example.com/a.png"}}]}`))

	got := logs.String()
	if got == "" {
		t.Fatalf("expected a debug log entry")
	}
	if bytes.Contains([]byte(got), []byte(secretMarker)) ||
		bytes.Contains([]byte(got), []byte("data:image")) ||
		bytes.Contains([]byte(got), []byte("example.com")) {
		t.Fatalf("debug log leaked image payload: %s", got)
	}
}

func TestImageHelperGrokPassThroughStillRunsConversionValidation(t *testing.T) {
	cases := []struct {
		name               string
		globalPassThrough  bool
		channelPassThrough bool
	}{
		{name: "global", globalPassThrough: true},
		{name: "channel", channelPassThrough: true},
	}

	originalPassThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	defer func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = originalPassThrough
	}()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			model_setting.GetGlobalSettings().PassThroughRequestEnabled = tc.globalPassThrough

			body := `{"model":"` + groksubscription.GrokImageModel + `","prompt":"cat","response_format":"json"}`
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set(string(constant.ContextKeyChannelType), constant.ChannelTypeGrokSubscription)
			c.Set(string(constant.ContextKeyChannelSetting), dto.ChannelSettings{PassThroughBodyEnabled: tc.channelPassThrough})
			c.Set(string(constant.ContextKeyOriginalModel), groksubscription.GrokImageModel)

			info := relaycommon.GenRelayInfoImage(c, &dto.ImageRequest{
				Model:          groksubscription.GrokImageModel,
				Prompt:         "cat",
				ResponseFormat: "json",
			})

			err := ImageHelper(c, info)
			if err == nil {
				t.Fatalf("expected conversion validation error")
			}
			if err.StatusCode != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", err.StatusCode)
			}
			if !strings.Contains(err.Error(), "response_format must be url or b64_json") {
				t.Fatalf("error = %q, want Grok conversion validation", err.Error())
			}
			if !types.IsSkipRetryError(err) {
				t.Fatalf("Grok conversion validation must skip retry")
			}
		})
	}
}

func TestImageHelperGrokRetryDecisionUsesDefinitePreSendMarker(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeGrokSubscription}}
	if shouldSkipRetryForGrokImagePostError(info, relaychannel.MarkDefinitelyNotSent(errors.New("header failed"))) {
		t.Fatal("definite pre-send Grok image failure must remain retryable")
	}
	if !shouldSkipRetryForGrokImagePostError(info, errors.New("connection reset after post began")) {
		t.Fatal("possible-send Grok image transport failure must skip retry")
	}
	other := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeOpenAI}}
	if shouldSkipRetryForGrokImagePostError(other, errors.New("ordinary image channel transport failure")) {
		t.Fatal("unrelated image channels must keep existing retry behavior")
	}
}

func TestImageHelperGrokStatusRetryDecisionSkipsPossibleSentResponses(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeGrokSubscription}}
	for _, status := range []int{http.StatusUnauthorized, http.StatusTooManyRequests, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable} {
		if !shouldSkipRetryForGrokImagePostStatus(info, status) {
			t.Fatalf("Grok image status %d after POST response must skip retry", status)
		}
	}
	if shouldSkipRetryForGrokImagePostStatus(info, http.StatusBadRequest) {
		t.Fatal("Grok image 400 must keep existing error handling")
	}
}

func TestImageHelperGrokRetryDecisionSkipsMalformedDoResponse(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeGrokSubscription}}
	upstreamErr := types.WithOpenAIError(types.OpenAIError{
		Message:  `grok image response missing data: https://api.x.ai/user/private-image.png`,
		Type:     "bad_response_body",
		Param:    "https://api.x.ai/user/private-image.png",
		Code:     "bad_response_body",
		Metadata: []byte(`{"url":"https://api.x.ai/user/private-image.png"}`),
	}, http.StatusInternalServerError)

	got := sanitizeGrokImageDoResponseError(info, upstreamErr)

	if !types.IsSkipRetryError(got) {
		t.Fatal("malformed Grok image HTTP 200 response must skip retry")
	}
	if strings.Contains(got.SanitizationSurface(), "api.x.ai") {
		t.Fatalf("sanitized error leaked upstream response data: %s", got.SanitizationSurface())
	}
	if got.ToOpenAIError().Message != "upstream image response was invalid" {
		t.Fatalf("client message = %q, want sanitized DoResponse error", got.ToOpenAIError().Message)
	}

	other := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ApiType: constant.APITypeOpenAI}}
	if types.IsSkipRetryError(sanitizeGrokImageDoResponseError(other, upstreamErr)) {
		t.Fatal("unrelated image channels must keep existing malformed-response retry behavior")
	}
}
