package gemini

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

type geminiInteractionUsage struct {
	TotalInputTokens        int                               `json:"total_input_tokens"`
	TotalCachedTokens       int                               `json:"total_cached_tokens"`
	TotalOutputTokens       int                               `json:"total_output_tokens"`
	TotalThoughtTokens      int                               `json:"total_thought_tokens"`
	TotalTokens             int                               `json:"total_tokens"`
	TotalToolUseTokens      int                               `json:"total_tool_use_tokens"`
	InputTokensByModality   []geminiInteractionModalityTokens `json:"input_tokens_by_modality"`
	OutputTokensByModality  []geminiInteractionModalityTokens `json:"output_tokens_by_modality"`
	ToolUseTokensByModality []geminiInteractionModalityTokens `json:"tool_use_tokens_by_modality"`
}

type geminiInteractionModalityTokens struct {
	Modality string `json:"modality"`
	Tokens   int    `json:"tokens"`
}

func GeminiInteractionHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "Gemini interactions response body: %s", body)

	info.ObserveResponseModel(gjson.GetBytes(body, "model").Str)
	if model := gjson.GetBytes(body, "interaction.model").Str; model != "" {
		info.ObserveResponseModel(model)
	}
	responseText, imageCount := interactionOutputText(body)
	observeInteractionGrounding(info, body)
	observeInteractionFunctionCalls(info, body)
	usage := interactionUsage(c, info, body, responseText, imageCount)
	service.IOCopyBytesGracefully(c, resp, body)
	return usage, nil
}

func GeminiInteractionStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	helper.SetEventStreamHeaders(c)

	usage := &dto.Usage{}
	responseText := strings.Builder{}
	imageCount := 0
	hasUsage := false
	var streamErr error

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if !gjson.Valid(data) {
			streamErr = fmt.Errorf("unmarshal Gemini interactions stream response: invalid JSON")
			sr.Stop(streamErr)
			return
		}

		eventType := gjson.Get(data, "event_type").Str
		if eventType == "error" {
			message := gjson.Get(data, "error.message").Str
			if message == "" {
				message = "Gemini interactions stream returned an error"
			}
			streamErr = errors.New(message)
		}
		if model := gjson.Get(data, "interaction.model").Str; model != "" {
			info.ObserveResponseModel(model)
		}
		if model := gjson.Get(data, "model").Str; model != "" {
			info.ObserveResponseModel(model)
		}
		observeInteractionEvent(info, data)

		if eventType == "step.start" && gjson.Get(data, "step.type").Str == "function_call" {
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, gjson.Get(data, "step.name").Str)
		}
		if eventType == "step.delta" {
			delta := gjson.Get(data, "delta")
			switch delta.Get("type").Str {
			case "text":
				responseText.WriteString(delta.Get("text").Str)
			case "thought_summary":
				responseText.WriteString(delta.Get("content.text").Str)
			case "image":
				imageCount++
			}
		}
		if eventType == "interaction.completed" {
			interaction := gjson.Get(data, "interaction")
			if interaction.Exists() {
				hasUsage = updateInteractionUsage(c, info, usage, interaction.Get("usage"), responseText.String(), imageCount)
			}
		}

		if err := writeGeminiInteractionEvent(c, eventType, data); err != nil {
			streamErr = err
			sr.Stop(err)
			return
		}
		info.SendResponseCount++
		if streamErr != nil {
			sr.Stop(streamErr)
		}
	})

	info.StreamStatus.RequireTerminal()
	if info.StreamStatus != nil && info.StreamStatus.EndReason == relaycommon.StreamEndReasonDone {
		if err := writeGeminiInteractionEvent(c, "done", "[DONE]"); err != nil {
			streamErr = err
		}
	}
	if !hasUsage {
		if info.ReceivedResponseCount > 0 {
			usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		} else {
			usage = &dto.Usage{}
		}
		if imageCount > 0 && usage.CompletionTokens == 0 {
			usage.CompletionTokens = imageCount * 1400
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
		attachEstimatedGeminiBillingUsage(usage)
	} else {
		patchGeminiZeroCompletionUsage(c, info, usage, responseText.String(), imageCount)
	}

	if streamErr != nil {
		return usage, types.NewOpenAIError(streamErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	return usage, nil
}

func writeGeminiInteractionEvent(c *gin.Context, eventType, data string) error {
	if eventType == "" {
		return helper.StringData(c, data)
	}
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, data)})
	return helper.FlushWriter(c)
}

func interactionUsage(c *gin.Context, info *relaycommon.RelayInfo, body []byte, responseText string, imageCount int) *dto.Usage {
	usage := &dto.Usage{}
	if updateInteractionUsage(c, info, usage, gjson.GetBytes(body, "usage"), responseText, imageCount) {
		patchGeminiZeroCompletionUsage(c, info, usage, responseText, imageCount)
		return usage
	}
	if gjson.GetBytes(body, "interaction.usage").Exists() {
		if updateInteractionUsage(c, info, usage, gjson.GetBytes(body, "interaction.usage"), responseText, imageCount) {
			patchGeminiZeroCompletionUsage(c, info, usage, responseText, imageCount)
			return usage
		}
	}
	usage = service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	attachEstimatedGeminiBillingUsage(usage)
	return usage
}

func updateInteractionUsage(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage, raw gjson.Result, responseText string, imageCount int) bool {
	if !raw.Exists() || raw.Type != gjson.JSON {
		return false
	}
	var interactionUsage geminiInteractionUsage
	if err := common.Unmarshal([]byte(raw.Raw), &interactionUsage); err != nil {
		return false
	}
	metadata := geminiInteractionMetadata(interactionUsage)
	if !dto.HasGeminiUsageMetadataTokens(&metadata) {
		return false
	}
	*usage = buildUsageFromGeminiMetadata(&metadata, info.GetEstimatePromptTokens())
	observeInteractionGroundingUsage(info, raw)
	patchGeminiZeroCompletionUsage(c, info, usage, responseText, imageCount)
	return true
}

func geminiInteractionMetadata(src geminiInteractionUsage) dto.GeminiUsageMetadata {
	metadata := dto.GeminiUsageMetadata{
		PromptTokenCount:        src.TotalInputTokens,
		ToolUsePromptTokenCount: src.TotalToolUseTokens,
		CandidatesTokenCount:    src.TotalOutputTokens,
		ThoughtsTokenCount:      src.TotalThoughtTokens,
		TotalTokenCount:         src.TotalTokens,
		CachedContentTokenCount: src.TotalCachedTokens,
	}
	for _, detail := range src.InputTokensByModality {
		metadata.PromptTokensDetails = append(metadata.PromptTokensDetails, dto.GeminiPromptTokensDetails{Modality: strings.ToUpper(detail.Modality), TokenCount: detail.Tokens})
	}
	for _, detail := range src.ToolUseTokensByModality {
		metadata.ToolUsePromptTokensDetails = append(metadata.ToolUsePromptTokensDetails, dto.GeminiPromptTokensDetails{Modality: strings.ToUpper(detail.Modality), TokenCount: detail.Tokens})
	}
	for _, detail := range src.OutputTokensByModality {
		metadata.CandidatesTokensDetails = append(metadata.CandidatesTokensDetails, dto.GeminiPromptTokensDetails{Modality: strings.ToUpper(detail.Modality), TokenCount: detail.Tokens})
	}
	if metadata.TotalTokenCount <= 0 {
		metadata.TotalTokenCount = metadata.PromptTokenCount + metadata.ToolUsePromptTokenCount + metadata.CandidatesTokenCount + metadata.ThoughtsTokenCount
	}
	return metadata
}

func interactionOutputText(body []byte) (string, int) {
	var text strings.Builder
	imageCount := 0
	steps := gjson.GetBytes(body, "steps")
	for _, step := range steps.Array() {
		for _, content := range step.Get("content").Array() {
			text.WriteString(content.Get("text").Str)
			switch content.Get("type").Str {
			case "image":
				imageCount++
			}
		}
	}
	return text.String(), imageCount
}

func observeInteractionEvent(info *relaycommon.RelayInfo, data string) {
	if gjson.Get(data, "event_type").Str == "step.delta" && gjson.Get(data, "delta.type").Str == "google_search_call" {
		observeInteractionGroundingQueries(info, gjson.Get(data, "delta.arguments.queries"))
	}
}

func observeInteractionGrounding(info *relaycommon.RelayInfo, body []byte) {
	for _, step := range gjson.GetBytes(body, "steps").Array() {
		if step.Get("type").Str == "google_search_call" {
			observeInteractionGroundingQueries(info, step.Get("arguments.queries"))
		}
	}
	observeInteractionGroundingUsage(info, gjson.GetBytes(body, "usage"))
}

func observeInteractionFunctionCalls(info *relaycommon.RelayInfo, body []byte) {
	for _, step := range gjson.GetBytes(body, "steps").Array() {
		if step.Get("type").Str != "function_call" {
			continue
		}
		info.CountBillableToolCall(dto.BuildInCallFunctionCall, step.Get("name").Str)
	}
}

func observeInteractionGroundingUsage(info *relaycommon.RelayInfo, usage gjson.Result) {
	if !usage.Exists() {
		return
	}
	for _, item := range usage.Get("grounding_tool_count").Array() {
		if item.Get("type").Str != "google_search" {
			continue
		}
		count := item.Get("count").Int()
		if count > 0 {
			info.SetBillableToolCount(dto.BuildInToolGoogleSearch, int(count))
			info.SetBillableToolCount(relaycommon.GoogleSearchGroundedPromptTool, 1)
		}
	}
}

func observeInteractionGroundingQueries(info *relaycommon.RelayInfo, queries gjson.Result) {
	if !queries.Exists() {
		return
	}
	count := int64(len(queries.Array()))
	if count > 0 {
		info.SetBillableToolCount(dto.BuildInToolGoogleSearch, int(count))
		info.SetBillableToolCount(relaycommon.GoogleSearchGroundedPromptTool, 1)
	}
}
