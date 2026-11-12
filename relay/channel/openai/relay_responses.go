package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/MoeForge/moego/ojson"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func OaiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = common.Unmarshal(responseBody, &responsesResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := responsesResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	info.ObserveResponseModel(responsesResponse.Model)
	responseBody = rewriteSGLangResponsesCreatedAt(info, responseBody, "created_at", responsesResponse.CreatedAt)

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// Normalize the upstream usage before it enters the billing layer. Some
	// OpenAI-compatible gateways return prompt/completion fields, some return
	// input/output fields, and a few only return total_tokens. Keeping this
	// normalization in one place prevents a valid response from becoming a
	// zero-charge request merely because its field spelling differs.
	estimatedPromptTokens := 0
	upstreamModelName := ""
	if info != nil {
		estimatedPromptTokens = info.GetEstimatePromptTokens()
		upstreamModelName = info.GetUpstreamModelName()
	}
	usage := normalizeResponsesUsage(responsesResponse.Usage, estimatedPromptTokens)
	imageToolCount := mergeResponsesToolUsage(usage, responsesResponse.ToolUsage)
	if usage.TotalTokens < addResponsesUsageTokens(usage.PromptTokens, usage.CompletionTokens) {
		usage.TotalTokens = addResponsesUsageTokens(usage.PromptTokens, usage.CompletionTokens)
	}
	// Count actual tool invocations from Output (not tool declarations). The
	// shared counter keeps this path consistent with streaming Responses, where
	// the same output may be observed in both item-done and terminal events.
	toolCounter := &relaycommon.ResponsesToolCallCounter{}
	for i := range responsesResponse.Output {
		toolCounter.Count(info, &responsesResponse.Output[i], intPtr(i))
	}
	info.ApplyVendorToolUsage(responseBody)

	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	// Images that completed are billable whatever the response status; Observe
	// skips unfinished image items. A provider image count proves delivery only
	// on a completed response.
	for i := range responsesResponse.Output {
		imageCounter.Observe(&responsesResponse.Output[i], intPtr(i))
	}
	if !relaycommon.IsUnfinishedResponsesStatus(responsesResponse.Status) {
		imageCounter.EnsureAtLeast(imageToolCount)
	}
	imageCounter.Commit(info)
	// Some Responses-compatible gateways report only input_tokens. That is a
	// valid partial snapshot, but it must not suppress output billing when the
	// response contains generated text. Complete the missing side from the
	// response text before handing usage to PostTextConsumeQuota.
	ensureOpenAIUsageCompletion(
		c,
		usage,
		service.ExtractOutputTextFromResponses(&responsesResponse),
		upstreamModelName,
		estimatedPromptTokens,
	)

	return usage, nil
}

func OaiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, common.LogText("invalid response or response body"))
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var usage = &dto.Usage{}
	var responseTextBuilder strings.Builder
	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	toolCounter := &relaycommon.ResponsesToolCallCounter{}
	imageCommitted := false
	toolUsageImageCount := 0
	responseTextObserved := false
	seenCompletedText := make(map[string]struct{})
	seenCompletedArguments := make(map[string]struct{})

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, common.LogText("failed to unmarshal stream response: %s", err.Error()))
			sr.Error(err)
			return
		}
		if streamResponse.Type == "" {
			streamResponse.Type = sr.EventType()
		}
		if streamResponse.Response != nil {
			data = string(rewriteSGLangResponsesCreatedAt(info, []byte(data), "response.created_at", streamResponse.Response.CreatedAt))
		}
		if streamResponse.Response != nil {
			info.ObserveResponseModel(streamResponse.Response.Model)
		}
		service.ObserveResponsesOutcome(info, &streamResponse)
		// Responses-compatible gateways can wrap usage several levels deep
		// inside data/response envelopes. Use relaykit's bounded recursive
		// extractor in addition to the typed fields above.
		if nestedUsage := relayconvert.UsageFromResponsesStreamResponse(&streamResponse); nestedUsage != nil {
			mergeResponsesUsage(usage, nestedUsage)
		}
		mergeResponsesUsage(usage, streamResponse.Usage)
		toolUsageImageCount = maxResponsesInt(toolUsageImageCount, mergeResponsesToolUsage(usage, streamResponse.ToolUsage))
		if streamResponse.Response != nil {
			mergeResponsesUsage(usage, streamResponse.Response.Usage)
			toolUsageImageCount = maxResponsesInt(toolUsageImageCount, mergeResponsesToolUsage(usage, streamResponse.Response.ToolUsage))
		}
		var wrappedResponse *dto.OpenAIResponsesResponse
		if streamResponse.Data != nil {
			var dataResponse struct {
				Usage     *dto.Usage                   `json:"usage"`
				Response  *dto.OpenAIResponsesResponse `json:"response"`
				ToolUsage *dto.ResponsesToolUsage      `json:"tool_usage"`
			}
			if err := common.Unmarshal(streamResponse.Data, &dataResponse); err == nil {
				mergeResponsesUsage(usage, dataResponse.Usage)
				toolUsageImageCount = maxResponsesInt(toolUsageImageCount, mergeResponsesToolUsage(usage, dataResponse.ToolUsage))
				wrappedResponse = dataResponse.Response
				if wrappedResponse != nil {
					mergeResponsesUsage(usage, wrappedResponse.Usage)
					toolUsageImageCount = maxResponsesInt(toolUsageImageCount, mergeResponsesToolUsage(usage, wrappedResponse.ToolUsage))
				}
			}
		}
		response := streamResponse.Response
		if response == nil {
			response = wrappedResponse
		}
		switch streamResponse.Type {
		case "response.completed", "response.done":
			if response != nil {
				// A terminal event can repeat the output items already observed in
				// response.output_item.done. Count tools independently of image
				// commitment so a later, more complete terminal response cannot
				// lose a tool charge.
				for i := range response.Output {
					toolCounter.Count(info, &response.Output[i], intPtr(i))
				}
				if !responseTextObserved {
					responseTextObserved = appendResponsesOutputText(&responseTextBuilder, response)
				}
				if !imageCommitted {
					for i := range response.Output {
						imageCounter.Observe(&response.Output[i], intPtr(i))
					}
					if !relaycommon.IsUnfinishedResponsesStatus(response.Status) {
						imageCounter.EnsureAtLeast(toolUsageImageCount)
					}
					// Keep an empty terminal response retryable. Some
					// sub2api-compatible gateways emit response.done first and
					// attach response.output in a following terminal event.
					if imageCounter.Count() > 0 {
						imageCounter.Commit(info)
						imageCommitted = true
					}
				}
			}
			// Vendor counts are cumulative on the terminal event and replace the
			// web_search_call items counted from output_item.done.
			info.ApplyVendorToolUsage(common.StringToByteSlice(data))
		case "response.failed", "response.incomplete", "response.cancelled", "response.canceled":
			// Responses providers can include authoritative usage on any terminal
			// event, not only response.completed/response.done; it was merged above.
			// Images that completed before this terminal were delivered and stay
			// billable.
			info.ApplyVendorToolUsage(common.StringToByteSlice(data))
			if !imageCommitted {
				if response != nil {
					for i := range response.Output {
						imageCounter.Observe(&response.Output[i], intPtr(i))
					}
				}
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.output_text.delta":
			// 处理输出文本
			responseTextBuilder.WriteString(streamResponse.Delta)
			responseTextObserved = true
			seenCompletedText[responsesStreamPartKey("text:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.ContentIndex)] = struct{}{}
		case "response.output_text.done":
			key := responsesStreamPartKey("text:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.ContentIndex)
			if _, seen := seenCompletedText[key]; !seen {
				seenCompletedText[key] = struct{}{}
				if lo.FromPtr(streamResponse.Text) != "" {
					responseTextBuilder.WriteString(lo.FromPtr(streamResponse.Text))
					responseTextObserved = true
				}
			}
		case "response.reasoning_summary_text.delta":
			responseTextBuilder.WriteString(streamResponse.Delta)
			responseTextObserved = true
			seenCompletedText[responsesStreamPartKey("reasoning:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.SummaryIndex)] = struct{}{}
		case "response.reasoning_summary_text.done":
			key := responsesStreamPartKey("reasoning:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.SummaryIndex)
			if _, seen := seenCompletedText[key]; !seen {
				seenCompletedText[key] = struct{}{}
				if lo.FromPtr(streamResponse.Text) != "" {
					responseTextBuilder.WriteString(lo.FromPtr(streamResponse.Text))
					responseTextObserved = true
				}
			}
		case "response.reasoning_text.delta", "response.refusal.delta":
			// Generated output that upstream bills as output tokens; it feeds the
			// missing-usage estimate like the shared accumulator does.
			responseTextBuilder.WriteString(streamResponse.Delta)
			responseTextObserved = true
		case "response.function_call_arguments.delta":
			responseTextBuilder.WriteString(streamResponse.Delta)
			responseTextObserved = true
			seenCompletedArguments[responsesStreamPartKey("arguments:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.ContentIndex)] = struct{}{}
		case "response.function_call_arguments.done":
			key := responsesStreamPartKey("arguments:"+streamResponse.ItemID, streamResponse.OutputIndex, streamResponse.ContentIndex)
			if _, seen := seenCompletedArguments[key]; !seen {
				seenCompletedArguments[key] = struct{}{}
				if lo.FromPtr(streamResponse.Arguments) != "" {
					responseTextBuilder.WriteString(lo.FromPtr(streamResponse.Arguments))
					responseTextObserved = true
				}
			}
		case dto.ResponsesOutputTypeItemDone:
			if streamResponse.Item != nil {
				toolCounter.Count(info, streamResponse.Item, streamResponse.OutputIndex)
				if streamResponse.Item.Type == dto.ResponsesOutputTypeImageGenerationCall && !imageCommitted {
					imageCounter.Observe(streamResponse.Item, streamResponse.OutputIndex)
				}
			}
		}
		if err := helper.ResponseChunkData(c, streamResponse, data); err != nil {
			sr.Stop(err)
			return
		}
		// An empty terminal response stays open: some sub2api-compatible
		// gateways attach the output in a following terminal event.
		if (streamResponse.Type == "response.completed" || streamResponse.Type == "response.done") &&
			response != nil && len(response.Output) > 0 &&
			info.StreamStatus.ResponseOutcome() == string(relaycommon.ResponseOutcomeCompleted) {
			sr.Done()
		}
	})

	// A provider may end with [DONE] or EOF, and a client may disconnect, after
	// completed image items reached the client without a terminal event. Those
	// images were delivered and stay billable; unfinished items never count. A
	// provider image count is trusted only when upstream ended the stream.
	if !imageCommitted {
		if info.StreamStatus != nil &&
			(info.StreamStatus.EndReason == relaycommon.StreamEndReasonDone || info.StreamStatus.EndReason == relaycommon.StreamEndReasonEOF) {
			imageCounter.EnsureAtLeast(toolUsageImageCount)
		}
		imageCounter.Commit(info)
		imageCommitted = true
	}

	// Normalize any total-only or one-sided usage before using local output
	// counting. Keep provider values when present and fill only missing sides.
	estimatedPromptTokens := 0
	upstreamModelName := ""
	if info != nil {
		estimatedPromptTokens = info.GetEstimatePromptTokens()
		upstreamModelName = info.GetUpstreamModelName()
	}
	usage = normalizeResponsesUsage(usage, estimatedPromptTokens)
	ensureOpenAIUsageCompletion(c, usage, responseTextBuilder.String(), upstreamModelName, estimatedPromptTokens)

	common.SetContextKey(c, constant.ContextKeyResponseStreamStatus, info.StreamStatus)
	info.StreamStatus.RequireTerminal()
	return usage, nil
}

func rewriteSGLangResponsesCreatedAt(info *relaycommon.RelayInfo, payload []byte, path string, createdAt dto.IntValue) []byte {
	if info.GetChannelType() != constant.ChannelTypeSGLang {
		return payload
	}
	if !ojson.GetBytes(payload, path).Exists() {
		return payload
	}
	patched, err := ojson.SetBytes(payload, path, int(createdAt))
	if err != nil {
		return payload
	}
	return patched
}

func maxResponsesInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func addResponsesUsageTokens(a, b int) int {
	if a < 0 {
		a = 0
	}
	if b < 0 {
		b = 0
	}
	maxInt := int(^uint(0) >> 1)
	if a > maxInt-b {
		return maxInt
	}
	return a + b
}

func intPtr(v int) *int {
	return &v
}

func responsesStreamPartKey(itemID string, outputIndex, contentIndex *int) string {
	output := -1
	if outputIndex != nil {
		output = *outputIndex
	}
	content := -1
	if contentIndex != nil {
		content = *contentIndex
	}
	return fmt.Sprintf("%s/%d/%d", itemID, output, content)
}

func mergeResponsesToolUsage(dst *dto.Usage, toolUsage *dto.ResponsesToolUsage) int {
	if dst == nil || toolUsage == nil || toolUsage.ImageGen == nil {
		return 0
	}
	imageGen := toolUsage.ImageGen
	inputTokens := maxResponsesUsageInt(dst.PromptTokens, dst.InputTokens, imageGen.InputTokens)
	outputTokens := maxResponsesUsageInt(dst.CompletionTokens, dst.OutputTokens, imageGen.OutputTokens)
	dst.PromptTokens = inputTokens
	dst.InputTokens = inputTokens
	dst.CompletionTokens = outputTokens
	dst.OutputTokens = outputTokens
	if imageGen.InputTokensDetails != nil {
		mergeResponsesInputTokenDetailsMax(&dst.PromptTokensDetails, *imageGen.InputTokensDetails)
	}
	if imageGen.OutputTokensDetails != nil {
		mergeResponsesOutputTokenDetailsMax(&dst.CompletionTokenDetails, *imageGen.OutputTokensDetails)
		if dst.OutputTokensDetails == nil {
			dst.OutputTokensDetails = &dto.OutputTokenDetails{}
		}
		mergeResponsesOutputTokenDetailsMax(dst.OutputTokensDetails, *imageGen.OutputTokensDetails)
	}
	dst.TotalTokens = maxResponsesUsageInt(dst.TotalTokens, addResponsesUsageTokens(dst.PromptTokens, dst.CompletionTokens))
	return maxResponsesInt(imageGen.Images, 0)
}

func appendResponsesOutputText(builder *strings.Builder, response *dto.OpenAIResponsesResponse) bool {
	if builder == nil || response == nil {
		return false
	}
	appended := false
	for i := range response.Output {
		output := &response.Output[i]
		for _, content := range output.Content {
			if content.Text != "" {
				builder.WriteString(content.Text)
				appended = true
			}
		}
		if output.Arguments != nil {
			if args := output.ArgumentsString(); args != "" {
				builder.WriteString(args)
				appended = true
			}
		}
	}
	return appended
}

func maxResponsesUsageInt(values ...int) int {
	maxValue := 0
	for _, value := range values {
		if value > maxValue {
			maxValue = value
		}
	}
	return maxValue
}

func mergeResponsesInputTokenDetailsMax(dst *dto.InputTokenDetails, src dto.InputTokenDetails) {
	if dst == nil {
		return
	}
	dst.CachedTokens = maxResponsesUsageInt(dst.CachedTokens, src.CachedTokens)
	dst.CachedCreationTokens = maxResponsesUsageInt(dst.CachedCreationTokens, src.CachedCreationTokens)
	dst.CacheCreationTokens = maxResponsesUsageInt(dst.CacheCreationTokens, src.CacheCreationTokens)
	dst.CacheWriteTokens = maxResponsesUsageInt(dst.CacheWriteTokens, src.CacheWriteTokens)
	mergeCacheWriteTokenDetailsMax(dst, src.CacheWriteTokensDetails)
	dst.TextTokens = maxResponsesUsageInt(dst.TextTokens, src.TextTokens)
	dst.AudioTokens = maxResponsesUsageInt(dst.AudioTokens, src.AudioTokens)
	dst.ImageTokens = maxResponsesUsageInt(dst.ImageTokens, src.ImageTokens)
}

// mergeCacheWriteTokenDetailsMax keeps the cache-write lifetime split, which
// bills 12-hour writes at their own price, into a detached copy on dst.
func mergeCacheWriteTokenDetailsMax(dst *dto.InputTokenDetails, src *dto.CacheWriteTokenDetails) {
	if src == nil {
		return
	}
	var merged dto.CacheWriteTokenDetails
	if dst.CacheWriteTokensDetails != nil {
		merged = *dst.CacheWriteTokensDetails
	}
	merged.TTL30mTokens = maxResponsesUsageInt(merged.TTL30mTokens, src.TTL30mTokens)
	merged.TTL12hTokens = maxResponsesUsageInt(merged.TTL12hTokens, src.TTL12hTokens)
	dst.CacheWriteTokensDetails = &merged
}

func mergeResponsesOutputTokenDetailsMax(dst *dto.OutputTokenDetails, src dto.OutputTokenDetails) {
	if dst == nil {
		return
	}
	dst.TextTokens = maxResponsesUsageInt(dst.TextTokens, src.TextTokens)
	dst.AudioTokens = maxResponsesUsageInt(dst.AudioTokens, src.AudioTokens)
	dst.ImageTokens = maxResponsesUsageInt(dst.ImageTokens, src.ImageTokens)
	dst.ReasoningTokens = maxResponsesUsageInt(dst.ReasoningTokens, src.ReasoningTokens)
}

func mergeResponsesBillingUsage(dst, src *dto.BillingUsage) *dto.BillingUsage {
	if src == nil {
		return dst
	}
	if dst == nil {
		return dto.CloneBillingUsage(src)
	}
	if src.Source != "" {
		dst.Source = src.Source
	}
	if src.Semantic != "" {
		dst.Semantic = src.Semantic
	}
	if src.Estimated {
		dst.Estimated = true
	}
	if src.OpenAIUsage != nil {
		if dst.OpenAIUsage == nil {
			dst.OpenAIUsage = dto.CloneBillingUsage(src).OpenAIUsage
		} else {
			snapshot := *src.OpenAIUsage
			snapshot.BillingUsage = nil
			mergeResponsesUsage(dst.OpenAIUsage, &snapshot)
		}
	}
	return dst
}

func mergeResponsesUsage(dst *dto.Usage, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	// Some OpenAI-compatible gateways put the only authoritative snapshot in
	// billing_usage.openai_usage. Pull that snapshot into the canonical fields
	// before considering the top-level aliases so downstream fallback logic
	// cannot mistake a real response for a zero-usage response.
	if src.BillingUsage != nil && src.BillingUsage.OpenAIUsage != nil {
		nested := src.BillingUsage.OpenAIUsage
		mergeResponsesUsageFieldsWithoutBilling(dst, nested)
	}

	inputTokens := maxResponsesUsageInt(dst.InputTokens, dst.PromptTokens, src.InputTokens, src.PromptTokens)
	outputTokens := maxResponsesUsageInt(dst.OutputTokens, dst.CompletionTokens, src.OutputTokens, src.CompletionTokens)
	dst.PromptTokens = inputTokens
	dst.InputTokens = inputTokens
	dst.CompletionTokens = outputTokens
	dst.OutputTokens = outputTokens
	srcCalculatedTotal := addResponsesUsageTokens(inputTokens, outputTokens)
	dst.TotalTokens = maxResponsesUsageInt(dst.TotalTokens, src.TotalTokens, srcCalculatedTotal)
	if src.UsageSemantic != "" {
		dst.UsageSemantic = src.UsageSemantic
	}
	if src.UsageSource != "" {
		dst.UsageSource = src.UsageSource
	}
	if src.BillingUsage != nil {
		dst.BillingUsage = mergeResponsesBillingUsage(dst.BillingUsage, src.BillingUsage)
	}
	if src.Cost != nil {
		dst.Cost = src.Cost
	}
	mergeResponsesInputTokenDetailsMax(&dst.PromptTokensDetails, src.PromptTokensDetails)
	if src.InputTokensDetails != nil {
		mergeResponsesInputTokenDetailsMax(&dst.PromptTokensDetails, *src.InputTokensDetails)
	}
	mergeResponsesOutputTokenDetailsMax(&dst.CompletionTokenDetails, src.CompletionTokenDetails)
	if src.OutputTokensDetails != nil {
		if dst.OutputTokensDetails == nil {
			dst.OutputTokensDetails = &dto.OutputTokenDetails{}
		}
		mergeResponsesOutputTokenDetailsMax(dst.OutputTokensDetails, *src.OutputTokensDetails)
		mergeResponsesOutputTokenDetailsMax(&dst.CompletionTokenDetails, *src.OutputTokensDetails)
	}

	// Preserve each upstream spelling independently, then expose the largest
	// cache snapshot through the canonical detail fields used for billing.
	dst.PromptCacheHitTokens = maxResponsesUsageInt(dst.PromptCacheHitTokens, src.PromptCacheHitTokens)
	dst.CacheReadInputTokens = maxResponsesUsageInt(dst.CacheReadInputTokens, src.CacheReadInputTokens)
	dst.CacheReadTokens = maxResponsesUsageInt(dst.CacheReadTokens, src.CacheReadTokens)
	dst.CacheCreationInputTokens = maxResponsesUsageInt(dst.CacheCreationInputTokens, src.CacheCreationInputTokens)
	dst.CacheWriteTokens = maxResponsesUsageInt(dst.CacheWriteTokens, src.CacheWriteTokens)
	dst.CacheCreationTokens = maxResponsesUsageInt(dst.CacheCreationTokens, src.CacheCreationTokens)
	inputDetails := dto.InputTokenDetails{}
	if src.InputTokensDetails != nil {
		inputDetails = *src.InputTokensDetails
	}
	dst.PromptTokensDetails.CachedTokens = maxResponsesUsageInt(
		dst.PromptTokensDetails.CachedTokens,
		src.PromptTokensDetails.CachedTokens,
		inputDetails.CachedTokens,
		src.PromptCacheHitTokens,
		src.CacheReadInputTokens,
		src.CacheReadTokens,
	)
	dst.PromptTokensDetails.CachedCreationTokens = maxResponsesUsageInt(
		dst.PromptTokensDetails.CachedCreationTokens,
		src.PromptTokensDetails.CachedCreationTokens,
		inputDetails.CachedCreationTokens,
		src.CacheCreationInputTokens,
		src.CacheCreationTokens,
	)
	dst.PromptTokensDetails.CacheCreationTokens = maxResponsesUsageInt(
		dst.PromptTokensDetails.CacheCreationTokens,
		src.PromptTokensDetails.CacheCreationTokens,
		inputDetails.CacheCreationTokens,
		src.CacheCreationTokens,
	)
	dst.PromptTokensDetails.CacheWriteTokens = maxResponsesUsageInt(
		dst.PromptTokensDetails.CacheWriteTokens,
		src.PromptTokensDetails.CacheWriteTokens,
		inputDetails.CacheWriteTokens,
		src.CacheWriteTokens,
	)

	// A stream can carry a richer top-level snapshot after an earlier nested
	// billing snapshot. Keep the nested OpenAI usage monotonic and synchronized.
	if dst.BillingUsage != nil && dst.BillingUsage.OpenAIUsage != nil {
		nested := dst.BillingUsage.OpenAIUsage
		snapshot := *dst
		snapshot.BillingUsage = nil
		mergeResponsesUsageFieldsWithoutBilling(nested, &snapshot)
	}
}
func mergeResponsesUsageFieldsWithoutBilling(dst, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	inputTokens := maxResponsesUsageInt(dst.InputTokens, dst.PromptTokens, src.InputTokens, src.PromptTokens)
	outputTokens := maxResponsesUsageInt(dst.OutputTokens, dst.CompletionTokens, src.OutputTokens, src.CompletionTokens)
	dst.PromptTokens = inputTokens
	dst.InputTokens = inputTokens
	dst.CompletionTokens = outputTokens
	dst.OutputTokens = outputTokens
	dst.TotalTokens = maxResponsesUsageInt(dst.TotalTokens, src.TotalTokens, addResponsesUsageTokens(inputTokens, outputTokens))
	mergeResponsesInputTokenDetailsMax(&dst.PromptTokensDetails, src.PromptTokensDetails)
	if src.InputTokensDetails != nil {
		mergeResponsesInputTokenDetailsMax(&dst.PromptTokensDetails, *src.InputTokensDetails)
	}
	mergeResponsesOutputTokenDetailsMax(&dst.CompletionTokenDetails, src.CompletionTokenDetails)
	if src.OutputTokensDetails != nil {
		if dst.OutputTokensDetails == nil {
			dst.OutputTokensDetails = &dto.OutputTokenDetails{}
		}
		mergeResponsesOutputTokenDetailsMax(dst.OutputTokensDetails, *src.OutputTokensDetails)
		mergeResponsesOutputTokenDetailsMax(&dst.CompletionTokenDetails, *src.OutputTokensDetails)
	}
	inputDetails := dto.InputTokenDetails{}
	if src.InputTokensDetails != nil {
		inputDetails = *src.InputTokensDetails
	}
	dst.PromptCacheHitTokens = maxResponsesUsageInt(dst.PromptCacheHitTokens, src.PromptCacheHitTokens)
	dst.CacheReadInputTokens = maxResponsesUsageInt(dst.CacheReadInputTokens, src.CacheReadInputTokens)
	dst.CacheReadTokens = maxResponsesUsageInt(dst.CacheReadTokens, src.CacheReadTokens)
	dst.CacheCreationInputTokens = maxResponsesUsageInt(dst.CacheCreationInputTokens, src.CacheCreationInputTokens)
	dst.CacheWriteTokens = maxResponsesUsageInt(dst.CacheWriteTokens, src.CacheWriteTokens)
	dst.CacheCreationTokens = maxResponsesUsageInt(dst.CacheCreationTokens, src.CacheCreationTokens)
	dst.PromptTokensDetails.CachedTokens = maxResponsesUsageInt(dst.PromptTokensDetails.CachedTokens, src.PromptTokensDetails.CachedTokens, inputDetails.CachedTokens, src.PromptCacheHitTokens, src.CacheReadInputTokens, src.CacheReadTokens)
	dst.PromptTokensDetails.CachedCreationTokens = maxResponsesUsageInt(dst.PromptTokensDetails.CachedCreationTokens, src.PromptTokensDetails.CachedCreationTokens, inputDetails.CachedCreationTokens, src.CacheCreationInputTokens, src.CacheCreationTokens)
	dst.PromptTokensDetails.CacheCreationTokens = maxResponsesUsageInt(dst.PromptTokensDetails.CacheCreationTokens, src.PromptTokensDetails.CacheCreationTokens, inputDetails.CacheCreationTokens, src.CacheCreationTokens)
	dst.PromptTokensDetails.CacheWriteTokens = maxResponsesUsageInt(dst.PromptTokensDetails.CacheWriteTokens, src.PromptTokensDetails.CacheWriteTokens, inputDetails.CacheWriteTokens, src.CacheWriteTokens)
}

// normalizeResponsesUsage converts all supported Responses usage spellings
// into the canonical prompt/completion fields consumed by the billing layer.
// A total-only payload uses the request estimate for the input side when it is
// available; this preserves the total charge while retaining a useful split.
func normalizeResponsesUsage(src *dto.Usage, estimatedPromptTokens int) *dto.Usage {
	usage := &dto.Usage{}
	mergeResponsesUsage(usage, src)
	// Some Responses-compatible gateways put the authoritative snapshot only
	// under billing_usage.openai_usage. Settlement prefers that nested record,
	// so promote it before the total-only fallback below; otherwise a zero
	// top-level total would replace real upstream usage with a text estimate.
	if usage.BillingUsage != nil && usage.BillingUsage.OpenAIUsage != nil {
		nested := usage.BillingUsage.OpenAIUsage
		mergeResponsesUsageFieldsWithoutBilling(usage, nested)
		mergeResponsesUsageFieldsWithoutBilling(nested, usage)
	}
	if usage.PromptTokens < 0 {
		usage.PromptTokens = 0
	}
	if usage.CompletionTokens < 0 {
		usage.CompletionTokens = 0
	}
	if usage.TotalTokens < 0 {
		usage.TotalTokens = 0
	}

	total := usage.TotalTokens
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 && total > 0 {
		if estimatedPromptTokens < 0 {
			estimatedPromptTokens = 0
		}
		if estimatedPromptTokens > total {
			estimatedPromptTokens = total
		}
		usage.PromptTokens = estimatedPromptTokens
		usage.CompletionTokens = total - estimatedPromptTokens
	} else if usage.PromptTokens == 0 && total > usage.CompletionTokens {
		usage.PromptTokens = total - usage.CompletionTokens
	} else if usage.CompletionTokens == 0 && total > usage.PromptTokens {
		usage.CompletionTokens = total - usage.PromptTokens
	}

	if usage.TotalTokens < addResponsesUsageTokens(usage.PromptTokens, usage.CompletionTokens) {
		usage.TotalTokens = addResponsesUsageTokens(usage.PromptTokens, usage.CompletionTokens)
	}
	if usage.InputTokens == 0 {
		usage.InputTokens = usage.PromptTokens
	}
	if usage.OutputTokens == 0 {
		usage.OutputTokens = usage.CompletionTokens
	}
	return usage
}
