package aws

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDoAwsClientRequest_AppliesRuntimeHeaderOverrideToAnthropicBeta(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName:           "claude-3-5-sonnet-20240620",
		IsStream:                  false,
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]any{
			"anthropic-beta": "computer-use-2025-01-24",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	requestBody := bytes.NewBufferString(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":128}`)
	adaptor := &Adaptor{}

	_, err := doAwsClientRequest(ctx, info, adaptor, requestBody)
	require.NoError(t, err)

	awsReq, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(awsReq.Body, &payload))

	anthropicBeta, exists := payload["anthropic_beta"]
	require.True(t, exists)

	values, ok := anthropicBeta.([]any)
	require.True(t, ok)
	require.Equal(t, []any{"computer-use-2025-01-24"}, values)
}

func TestGetAwsModelID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		input            string
		wantModelID      string
		wantHasRegionPfx bool
	}{
		// Layer 1: region-prefixed full IDs → passthrough, hasRegionPrefix=true
		{"global prefix passthrough", "global.anthropic.claude-opus-4-6-v1", "global.anthropic.claude-opus-4-6-v1", true},
		{"us prefix passthrough", "us.anthropic.claude-sonnet-4-6", "us.anthropic.claude-sonnet-4-6", true},
		{"eu prefix passthrough", "eu.anthropic.claude-opus-4-6-v1", "eu.anthropic.claude-opus-4-6-v1", true},
		{"jp prefix passthrough", "jp.anthropic.claude-sonnet-4-6", "jp.anthropic.claude-sonnet-4-6", true},
		{"apac prefix passthrough", "apac.amazon.nova-micro-v1:0", "apac.amazon.nova-micro-v1:0", true},

		// Layer 1: provider-prefixed full IDs → passthrough, skip cross-region (true)
		{"anthropic provider passthrough", "anthropic.claude-opus-4-6-v1", "anthropic.claude-opus-4-6-v1", true},
		{"amazon provider passthrough", "amazon.nova-micro-v1:0", "amazon.nova-micro-v1:0", true},
		{"meta provider passthrough", "meta.llama3-70b-instruct-v1:0", "meta.llama3-70b-instruct-v1:0", true},

		// Layer 2: exact map lookup (existing behavior)
		{"exact map claude-opus-4-6", "claude-opus-4-6", "anthropic.claude-opus-4-6-v1", false},
		{"exact map nova-micro", "nova-micro-v1:0", "amazon.nova-micro-v1:0", false},
		{"exact map claude-3-sonnet", "claude-3-sonnet-20240229", "anthropic.claude-3-sonnet-20240229-v1:0", false},
		{"exact map claude-haiku-4-5", "claude-haiku-4-5-20251001", "anthropic.claude-haiku-4-5-20251001-v1:0", false},

		// Layer 3: pattern matching (new models auto-resolve)
		{"pattern claude future model", "claude-future-model-2026", "anthropic.claude-future-model-2026", false},
		{"pattern nova future model", "nova-ultra-v2:0", "amazon.nova-ultra-v2:0", false},

		// Fallback: unknown model passthrough
		{"unknown model passthrough", "some-unknown-model", "some-unknown-model", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modelID, hasRegionPfx := getAwsModelID(tt.input)
			require.Equal(t, tt.wantModelID, modelID)
			require.Equal(t, tt.wantHasRegionPfx, hasRegionPfx)
		})
	}
}

func TestEndToEndModelResolution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		input       string
		wantFinalID string
	}{
		// Short names: inference-profile-required models -> global. prefix
		{"short claude-opus-4-6", "claude-opus-4-6", "global.anthropic.claude-opus-4-6-v1"},
		{"short claude-sonnet-4-6", "claude-sonnet-4-6", "global.anthropic.claude-sonnet-4-6"},
		{"short claude-haiku-4-5", "claude-haiku-4-5-20251001", "global.anthropic.claude-haiku-4-5-20251001-v1:0"},
		{"short claude-opus-4-5", "claude-opus-4-5-20251101", "global.anthropic.claude-opus-4-5-20251101-v1:0"},
		// Short names: on-demand models -> NO prefix (base ID)
		{"short nova-micro", "nova-micro-v1:0", "amazon.nova-micro-v1:0"},
		{"short nova-lite", "nova-lite-v1:0", "amazon.nova-lite-v1:0"},
		{"short claude-3-haiku", "claude-3-haiku-20240307", "anthropic.claude-3-haiku-20240307-v1:0"},
		// Short names: inference-profile-required Nova 2
		{"short nova-2-lite", "nova-2-lite-v1:0", "global.amazon.nova-2-lite-v1:0"},
		// Layer 3 pattern match: unknown model -> on-demand (safe default)
		{"pattern future claude", "claude-future-2026", "anthropic.claude-future-2026"},
		{"pattern future nova", "nova-ultra-v2:0", "amazon.nova-ultra-v2:0"},
		// Full provider ID -> passthrough (no prefix)
		{"full anthropic ID", "anthropic.claude-opus-4-6-v1", "anthropic.claude-opus-4-6-v1"},
		{"full amazon ID", "amazon.nova-micro-v1:0", "amazon.nova-micro-v1:0"},
		// Region-prefixed -> passthrough
		{"global prefix", "global.anthropic.claude-opus-4-6-v1", "global.anthropic.claude-opus-4-6-v1"},
		{"us prefix", "us.anthropic.claude-sonnet-4-6", "us.anthropic.claude-sonnet-4-6"},
		{"eu prefix", "eu.anthropic.claude-opus-4-6-v1", "eu.anthropic.claude-opus-4-6-v1"},
		{"jp prefix", "jp.anthropic.claude-sonnet-4-6", "jp.anthropic.claude-sonnet-4-6"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the full resolution flow from doAwsClientRequest
			modelID, skipInferenceResolve := getAwsModelID(tt.input)
			if !skipInferenceResolve {
				if awsModelsRequireInferenceProfile[modelID] {
					modelID = "global." + modelID
				}
			}
			require.Equal(t, tt.wantFinalID, modelID)
		})
	}
}

