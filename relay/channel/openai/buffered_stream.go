package openai

import (
	"bufio"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// OaiBufferedStreamHandler reads an upstream SSE stream of chat.completion.chunk
// events, aggregates them into a single chat.completion JSON, and writes it to
// the client. Used when ForceUpstreamStream is enabled and the client requested
// non-streaming.
func OaiBufferedStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	var (
		accumulatedContent   = make(map[int]string) // per choice index
		accumulatedReasoning = make(map[int]string) // per choice index
		accumulatedToolCalls = make(map[int]map[int]*dto.ToolCallResponse) // choiceIdx -> tcIdx -> tc
		finishReason         = make(map[int]string) // per choice index
		model                = info.UpstreamModelName
		responseId           = helper.GetResponseID(c)
		created              = time.Now().Unix()
		usage                *dto.Usage
	)

	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 6 || line[:5] != "data:" {
			continue
		}
		data := strings.TrimSpace(line[5:])
		if data == "[DONE]" {
			break
		}
		if data == "" {
			continue // heartbeat / keep-alive
		}

		// Check for upstream error event before parsing as stream response.
		var simpleResp dto.SimpleResponse
		if err := common.UnmarshalJsonStr(data, &simpleResp); err == nil && simpleResp.Error != nil {
			apiErr := simpleResp.GetOpenAIError()
			if apiErr != nil {
				return nil, types.NewOpenAIError(fmt.Errorf("upstream error: %s", apiErr.Message), types.ErrorCodeBadResponse, http.StatusBadGateway)
			}
			return nil, types.NewOpenAIError(fmt.Errorf("upstream returned error event"), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}

		var streamResp dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResp); err != nil {
			logger.LogError(c, "failed to unmarshal buffered stream chunk: "+err.Error())
			continue
		}

		if streamResp.Usage != nil {
			usage = streamResp.Usage
		}
		if model == "" && streamResp.Model != "" {
			model = streamResp.Model
		}
		if len(streamResp.Choices) > 0 {
			for _, choice := range streamResp.Choices {
				idx := choice.Index
				if choice.Delta.GetContentString() != "" {
					accumulatedContent[idx] += choice.Delta.GetContentString()
				}
				if choice.Delta.GetReasoningContent() != "" {
					accumulatedReasoning[idx] += choice.Delta.GetReasoningContent()
				}
				if len(choice.Delta.ToolCalls) > 0 {
					if accumulatedToolCalls[idx] == nil {
						accumulatedToolCalls[idx] = make(map[int]*dto.ToolCallResponse)
					}
					for _, tc := range choice.Delta.ToolCalls {
						tcIdx := 0
						if tc.Index != nil {
							tcIdx = *tc.Index
						}
						if existing, ok := accumulatedToolCalls[idx][tcIdx]; !ok {
							tcCopy := tc
							accumulatedToolCalls[idx][tcIdx] = &tcCopy
						} else {
							existing.Function.Arguments += tc.Function.Arguments
							if tc.Function.Name != "" {
								existing.Function.Name = tc.Function.Name
							}
							if tc.ID != "" {
								existing.ID = tc.ID
							}
						}
					}
				}
				if choice.FinishReason != nil && *choice.FinishReason != "" {
					finishReason[idx] = *choice.FinishReason
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	// Determine all choice indices that received content
	allIndices := make(map[int]bool)
	for idx := range accumulatedContent {
		allIndices[idx] = true
	}
	for idx := range accumulatedReasoning {
		allIndices[idx] = true
	}
	for idx := range finishReason {
		allIndices[idx] = true
	}

	// Build choices for all indices (sorted for deterministic output)
	var sortedIndices []int
	for idx := range allIndices {
		sortedIndices = append(sortedIndices, idx)
	}
	if len(sortedIndices) == 0 {
		sortedIndices = []int{0}
	}
	sort.Ints(sortedIndices)

	var choices []dto.OpenAITextResponseChoice
	for _, idx := range sortedIndices {
		fr := finishReason[idx]
		if fr == "" {
			fr = constant.FinishReasonStop
		}
		choice := dto.OpenAITextResponseChoice{
			Index:        idx,
			FinishReason: fr,
		}
		choice.Message.Role = "assistant"
		choice.Message.Content = accumulatedContent[idx]
		if accumulatedReasoning[idx] != "" {
			rc := accumulatedReasoning[idx]
			choice.Message.ReasoningContent = &rc
		}
		if tcMap, ok := accumulatedToolCalls[idx]; ok && len(tcMap) > 0 {
			var tcs []dto.ToolCallResponse
			var tcKeys []int
			for k := range tcMap {
				tcKeys = append(tcKeys, k)
			}
			sort.Ints(tcKeys)
			for _, k := range tcKeys {
				tcs = append(tcs, *tcMap[k])
			}
			choice.Message.SetToolCalls(tcs)
		}
		choices = append(choices, choice)
	}

	// Usage fallback: aggregate all content across choices for estimation.
	// Include reasoning content and tool-call arguments so the estimate
	// matches what ProcessStreamResponse would compute for the same stream.
	if usage == nil || usage.TotalTokens == 0 {
		totalContent := ""
		for _, c := range accumulatedContent {
			totalContent += c
		}
		for _, r := range accumulatedReasoning {
			totalContent += r
		}
		for _, tcMap := range accumulatedToolCalls {
			for _, tc := range tcMap {
				totalContent += tc.Function.Name + tc.Function.Arguments
			}
		}
		usage = service.ResponseText2Usage(c, totalContent, info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	textResponse := dto.OpenAITextResponse{
		Id:      responseId,
		Object:  "chat.completion",
		Created: created,
		Model:   model,
		Choices: choices,
		Usage:   *usage,
	}

	responseBody, err := common.Marshal(textResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	// Apply channel-specific usage post-processing (e.g. DeepSeek cache-hit
	// token migration) and re-marshal if usage changed. Matches the pattern
	// in OpenaiHandler (P2-3).
	applyUsagePostProcessing(info, &textResponse.Usage, responseBody)
	if textResponse.Usage.PromptTokensDetails.CachedTokens != usage.PromptTokensDetails.CachedTokens {
		responseBody, err = common.Marshal(textResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
		}
		usage = &textResponse.Usage
	}

	// Count billable tool calls for special tool pricing, matching
	// OaiStreamHandler and OpenaiHandler (P2-3). Iterate per choice.
	for _, tcMap := range accumulatedToolCalls {
		for _, tc := range tcMap {
			if tc.Function.Name != "" {
				info.CountBillableToolCall(dto.BuildInCallFunctionCall, tc.Function.Name)
			}
		}
	}

	// The buffered handler has fully parsed and rebuilt the response as a
	// single JSON object. Write it directly with the correct Content-Type
	// instead of using IOCopyBytesGracefully, which would copy the upstream's
	// text/event-stream header and mislead strict clients (P0-1).
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(responseBody)))
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(responseBody)
	c.Writer.Flush()

	return usage, nil
}
