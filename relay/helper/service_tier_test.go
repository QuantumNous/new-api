package helper

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestResolveChannelServiceTierPricingMatchesOpenAIRequest(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o-mini",
		Messages:    []dto.Message{{Role: "user", Content: "hello"}},
		ServiceTier: json.RawMessage(`"FAST"`),
	}
	body := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"service_tier":"FAST"}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  true,
		ServiceTierRatios: map[string]any{"fast": 2.5},
	})

	serviceTier, ratio, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if !matched {
		t.Fatalf("expected service_tier ratio to match")
	}
	if serviceTier != "fast" {
		t.Fatalf("expected normalized service_tier fast, got %q", serviceTier)
	}
	if ratio != 2.5 {
		t.Fatalf("expected ratio 2.5, got %v", ratio)
	}
}

func TestResolveChannelServiceTierPricingMatchesResponsesRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:       "gpt-4o-mini",
		Input:       json.RawMessage(`"hello"`),
		ServiceTier: "fast",
	}
	body := `{"model":"gpt-4o-mini","input":"hello","service_tier":"fast"}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAIResponses)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  true,
		ServiceTierRatios: map[string]any{"fast": 1.8},
	})

	serviceTier, ratio, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if !matched {
		t.Fatalf("expected responses service_tier ratio to match")
	}
	if serviceTier != "fast" || ratio != 1.8 {
		t.Fatalf("expected fast/1.8, got %q/%v", serviceTier, ratio)
	}
}

func TestResolveChannelServiceTierPricingSkipsFilteredServiceTier(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o-mini",
		Messages:    []dto.Message{{Role: "user", Content: "hello"}},
		ServiceTier: json.RawMessage(`"fast"`),
	}
	body := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"service_tier":"fast"}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  false,
		ServiceTierRatios: map[string]any{"fast": 2},
	})

	_, _, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if matched {
		t.Fatalf("expected filtered service_tier to skip pricing")
	}
}

func TestResolveChannelServiceTierPricingUsesRawBodyWhenPassThroughEnabled(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o-mini",
		Messages:    []dto.Message{{Role: "user", Content: "hello"}},
		ServiceTier: json.RawMessage(`"flex"`),
	}
	body := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"service_tier":"fast"}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, dto.ChannelSettings{
		PassThroughBodyEnabled: true,
	})
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  false,
		ServiceTierRatios: map[string]any{"fast": 3},
	})

	serviceTier, ratio, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if !matched {
		t.Fatalf("expected pass-through request body service_tier to match")
	}
	if serviceTier != "fast" || ratio != 3 {
		t.Fatalf("expected fast/3, got %q/%v", serviceTier, ratio)
	}
}

func TestResolveChannelServiceTierPricingAppliesOverrideAfterModelNormalization(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "alias-model",
		Messages: []dto.Message{{Role: "user", Content: "hello"}},
	}
	body := `{"model":"alias-model","messages":[{"role":"user","content":"hello"}]}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAI)
	ctx.Set("model_mapping", `{"alias-model":"gpt-5-high"}`)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  true,
		ServiceTierRatios: map[string]any{"fast": 2.2},
	})
	common.SetContextKey(ctx, constant.ContextKeyChannelParamOverride, map[string]any{
		"operations": []any{
			map[string]any{
				"path":  "service_tier",
				"mode":  "set",
				"value": "fast",
				"conditions": []any{
					map[string]any{
						"path":  "model",
						"mode":  "full",
						"value": "gpt-5",
					},
				},
			},
		},
	})

	serviceTier, ratio, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if !matched {
		t.Fatalf("expected param override to set service_tier after model normalization")
	}
	if serviceTier != "fast" || ratio != 2.2 {
		t.Fatalf("expected fast/2.2, got %q/%v", serviceTier, ratio)
	}
}

func TestResolveChannelServiceTierPricingSkipsChatResponsesCompatibilityMode(t *testing.T) {
	originalPolicy := model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy
	model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{"gpt-4o-mini"},
	}
	t.Cleanup(func() {
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy = originalPolicy
	})

	req := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o-mini",
		Messages:    []dto.Message{{Role: "user", Content: "hello"}},
		ServiceTier: json.RawMessage(`"fast"`),
	}
	body := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"service_tier":"fast"}`
	ctx, info := newServiceTierTestContext(t, body, req, types.RelayFormatOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{
		AllowServiceTier:  true,
		ServiceTierRatios: map[string]any{"fast": 2},
	})

	_, _, matched, err := resolveChannelServiceTierPricing(ctx, info)
	if err != nil {
		t.Fatalf("resolveChannelServiceTierPricing returned error: %v", err)
	}
	if matched {
		t.Fatalf("expected chat->responses compatibility mode to drop service_tier pricing")
	}
}

func newServiceTierTestContext(t *testing.T, body string, request dto.Request, format types.RelayFormat) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	requestPath := "/v1/chat/completions"
	modelName := "gpt-4o-mini"
	switch req := request.(type) {
	case *dto.GeneralOpenAIRequest:
		modelName = req.Model
	case *dto.OpenAIResponsesRequest:
		requestPath = "/v1/responses"
		modelName = req.Model
	}
	ctx.Request = httptest.NewRequest(http.MethodPost, requestPath, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 11)
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, modelName)
	common.SetContextKey(ctx, constant.ContextKeyChannelBaseUrl, "https://api.openai.com")
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})
	common.SetContextKey(ctx, constant.ContextKeyChannelParamOverride, map[string]any{})

	info, err := relaycommon.GenRelayInfo(ctx, format, request, nil)
	if err != nil {
		t.Fatalf("GenRelayInfo returned error: %v", err)
	}
	return ctx, info
}
