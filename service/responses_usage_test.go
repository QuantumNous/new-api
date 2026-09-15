package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponsesUsageAccumulatorTerminalAccounting(t *testing.T) {
	operation_setting.SetToolPriceForTest("responses_priced_fn", 5)
	t.Cleanup(func() { operation_setting.DeleteToolPriceForTest("responses_priced_fn") })
	for _, tc := range []struct {
		eventType  string
		wantImages int
	}{
		{eventType: "response.completed", wantImages: 1},
		{eventType: "response.done", wantImages: 1},
		{eventType: "response.incomplete"},
		{eventType: "response.failed"},
		{eventType: "response.cancelled"},
		{eventType: "response.canceled"},
	} {
		t.Run(tc.eventType, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: "gpt-5.1"}
			accumulator := NewResponsesUsageAccumulator(info)
			for _, item := range []dto.ResponsesOutput{
				{Type: dto.BuildInCallWebSearchCall},
				{Type: dto.BuildInCallFileSearchCall},
				{Type: dto.BuildInCallFunctionCall, Name: "responses_priced_fn"},
				{Type: dto.BuildInCallFunctionCall, Name: "responses_unpriced_fn"},
			} {
				accumulator.Observe(&dto.ResponsesStreamResponse{Type: dto.ResponsesOutputTypeItemDone, Item: &item})
			}
			image := dto.ResponsesOutput{ID: "image-1", Type: dto.ResponsesOutputTypeImageGenerationCall, Status: "completed", Result: "image-data"}
			accumulator.Observe(&dto.ResponsesStreamResponse{Type: dto.ResponsesOutputTypeItemDone, Item: &image})
			upstream := &dto.Usage{InputTokens: 20, OutputTokens: 5, TotalTokens: 25, InputTokensDetails: &dto.InputTokenDetails{CachedTokens: 4}}
			upstream.BillingUsage = dto.NewOpenAIResponsesBillingUsage(upstream)
			terminal := &dto.ResponsesStreamResponse{
				Type: tc.eventType,
				Response: &dto.OpenAIResponsesResponse{
					Usage: upstream, Output: []dto.ResponsesOutput{image},
				},
			}
			accumulator.Observe(terminal)
			accumulator.Observe(terminal)
			usage := accumulator.Finish()

			assert.Equal(t, 20, usage.PromptTokens)
			assert.Equal(t, 5, usage.CompletionTokens)
			assert.Equal(t, 25, usage.TotalTokens)
			assert.Equal(t, 4, usage.PromptTokensDetails.CachedTokens)
			require.NotNil(t, usage.BillingUsage)
			assert.Equal(t, upstream.BillingUsage, usage.BillingUsage)
			assert.NotSame(t, upstream.BillingUsage, usage.BillingUsage)
			tools := info.ResponsesUsageInfo.BuiltInTools
			for _, name := range []string{dto.BuildInToolWebSearchPreview, dto.BuildInToolFileSearch, "responses_priced_fn"} {
				require.Contains(t, tools, name)
				assert.Equal(t, 1, tools[name].CallCount)
			}
			assert.NotContains(t, tools, "responses_unpriced_fn")
			require.Contains(t, tools, dto.BuildInToolImageGeneration)
			assert.Equal(t, tc.wantImages, tools[dto.BuildInToolImageGeneration].CallCount)
		})
	}
}

func TestResponsesUsageAccumulatorInterruptedTextFallback(t *testing.T) {
	for _, withUsage := range []bool{false, true} {
		name := "disconnect without terminal usage"
		if withUsage {
			name = "failed response preserves native billing usage"
		}
		t.Run(name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"}}
			info.SetEstimatePromptTokens(100)
			accumulator := NewResponsesUsageAccumulator(info)
			accumulator.Observe(&dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: "hello"})
			if withUsage {
				upstream := &dto.Usage{InputTokens: 20, InputTokensDetails: &dto.InputTokenDetails{CachedTokens: 4}}
				upstream.BillingUsage = dto.NewOpenAIResponsesBillingUsage(upstream)
				accumulator.Observe(&dto.ResponsesStreamResponse{Type: "response.failed", Response: &dto.OpenAIResponsesResponse{Usage: upstream}})
			}
			usage := accumulator.Finish()
			assert.Equal(t, 1, usage.CompletionTokens)
			if withUsage {
				assert.Equal(t, 20, usage.PromptTokens)
				assert.Equal(t, 21, usage.TotalTokens)
				require.NotNil(t, usage.BillingUsage)
				assert.Equal(t, dto.BillingUsageSourceOAIResponses, usage.BillingUsage.Source)
				assert.True(t, usage.BillingUsage.Estimated)
				canonical, ok := usage.BillingUsage.CanonicalUsage()
				require.True(t, ok)
				assert.Equal(t, 4, canonical.PromptTokensDetails.CachedTokens)
				assert.Equal(t, 1, canonical.CompletionTokens)
			} else {
				assert.Equal(t, 100, usage.PromptTokens)
				assert.Equal(t, 101, usage.TotalTokens)
			}
			accumulator.Observe(&dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: " late output"})
			assert.Equal(t, usage, accumulator.Finish())
			assert.Equal(t, 1, usage.CompletionTokens)
		})
	}
}

func TestResponsesUsageAccumulatorDisconnectBillsCompletedImage(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "gpt-5.1"}
	accumulator := NewResponsesUsageAccumulator(info)
	accumulator.Observe(&dto.ResponsesStreamResponse{
		Type: dto.ResponsesOutputTypeItemDone,
		Item: &dto.ResponsesOutput{ID: "complete-image", Type: dto.ResponsesOutputTypeImageGenerationCall, Status: "completed", Result: "final-image-data"},
	})
	accumulator.Observe(&dto.ResponsesStreamResponse{
		Type: dto.ResponsesOutputTypeItemDone,
		Item: &dto.ResponsesOutput{ID: "partial-image", Type: dto.ResponsesOutputTypeImageGenerationCall, Status: "partial", Result: "partial-image-data"},
	})
	usage := accumulator.Finish()
	assert.Zero(t, usage.TotalTokens)
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, dto.BuildInToolImageGeneration)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
	accumulator.Finish()
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
}

func TestApplyResponsesUsageCopiesTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		InputTokens:  11,
		OutputTokens: 7,
		TotalTokens:  18,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:         3,
			CachedCreationTokens: 2,
			TextTokens:           6,
			AudioTokens:          4,
			ImageTokens:          5,
		},
		OutputTokensDetails: &dto.OutputTokenDetails{
			TextTokens:      1,
			AudioTokens:     2,
			ImageTokens:     3,
			ReasoningTokens: 4,
		},
		PromptCacheHitTokens: 3,
		UsageSemantic:        "openai",
		UsageSource:          "upstream",
	}

	ApplyResponsesUsage(dst, src)

	assert.Equal(t, 11, dst.PromptTokens)
	assert.Equal(t, 7, dst.CompletionTokens)
	assert.Equal(t, 18, dst.TotalTokens)
	require.NotNil(t, dst.InputTokensDetails)
	assert.Equal(t, *src.InputTokensDetails, dst.PromptTokensDetails)
	assert.Equal(t, src.InputTokensDetails, dst.InputTokensDetails)
	assert.NotSame(t, src.InputTokensDetails, dst.InputTokensDetails)
	assert.Equal(t, *src.OutputTokensDetails, dst.CompletionTokenDetails)
	require.NotNil(t, dst.OutputTokensDetails)
	assert.Equal(t, *src.OutputTokensDetails, *dst.OutputTokensDetails)
	assert.NotSame(t, src.OutputTokensDetails, dst.OutputTokensDetails)
	assert.Equal(t, 3, dst.PromptCacheHitTokens)
	assert.Equal(t, "openai", dst.UsageSemantic)
	assert.Equal(t, "upstream", dst.UsageSource)
}

func TestApplyResponsesUsageFallsBackToCompletionTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: 9,
		},
	}

	ApplyResponsesUsage(dst, src)

	assert.Equal(t, 9, dst.CompletionTokenDetails.ReasoningTokens)
	require.NotNil(t, dst.OutputTokensDetails)
	assert.Equal(t, 9, dst.OutputTokensDetails.ReasoningTokens)
}

func TestApplyResponsesUsagePreservesBillingSnapshotAcrossPartialUpdates(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		InputTokens:  20,
		OutputTokens: 10,
		TotalTokens:  30,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens: 3,
			AudioTokens:  2,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{AudioTokens: 4},
		UsageSemantic:          "openai",
		UsageSource:            "upstream",
	}
	src.BillingUsage = dto.NewOpenAIResponsesBillingUsage(src)
	ApplyResponsesUsage(dst, src)
	ApplyResponsesUsage(dst, &dto.Usage{
		OutputTokens:        12,
		InputTokensDetails:  &dto.InputTokenDetails{},
		OutputTokensDetails: &dto.OutputTokenDetails{ReasoningTokens: 5},
	})

	assert.Equal(t, 20, dst.PromptTokens)
	assert.Equal(t, 12, dst.CompletionTokens)
	assert.Equal(t, 32, dst.TotalTokens)
	assert.Equal(t, 3, dst.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 2, dst.PromptTokensDetails.AudioTokens)
	assert.Equal(t, 4, dst.CompletionTokenDetails.AudioTokens)
	assert.Equal(t, 5, dst.CompletionTokenDetails.ReasoningTokens)
	require.NotNil(t, dst.OutputTokensDetails)
	assert.Equal(t, dst.CompletionTokenDetails, *dst.OutputTokensDetails)
	assert.Equal(t, "openai", dst.UsageSemantic)
	assert.Equal(t, "upstream", dst.UsageSource)
	require.NotNil(t, dst.BillingUsage)
	assert.Equal(t, src.BillingUsage, dst.BillingUsage)
	assert.NotSame(t, src.BillingUsage, dst.BillingUsage)
}
