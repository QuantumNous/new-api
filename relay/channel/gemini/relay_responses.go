package gemini

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
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
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func GeminiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "Gemini responses response body: %s", responseBody)

	var geminiResponse dto.GeminiChatResponse
	if err := common.Unmarshal(responseBody, &geminiResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	info.ObserveResponseModel(gjson.GetBytes(responseBody, "modelVersion").Str)
	var grounding geminiGroundingCounter
	grounding.observe(&geminiResponse)
	grounding.commit(info)
	countGeminiBillableFunctionCalls(info, &geminiResponse)
	if len(geminiResponse.Candidates) == 0 {
		usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)
		if geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
			info.PerformanceBusinessRejection = true
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
			return &usage, types.NewOpenAIError(
				errors.New("request blocked by Gemini API: "+*geminiResponse.PromptFeedback.BlockReason),
				types.ErrorCodePromptBlocked,
				http.StatusBadRequest,
			)
		}
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_empty_candidates")
		return &usage, types.NewOpenAIError(
			errors.New("empty response from Gemini API"),
			types.ErrorCodeEmptyResponse,
			http.StatusInternalServerError,
		)
	}

	usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)

	convertResult, err := service.ConvertResponse(c, info, types.RelayFormatOpenAIResponses, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	responsesResp, ok := convertResult.Value.(*dto.OpenAIResponsesResponse)
	if !ok {
		return nil, types.NewOpenAIError(fmt.Errorf("expected OpenAI responses response, got %T", convertResult.Value), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if responseID := helper.GetResponseID(c); responseID != "" {
		responsesResp.ID = responseID
	}
	responsesResp.Model = info.UpstreamModelName
	responsesResp.Usage = relayconvert.UsageFromChatUsage(&usage)
	responsesResp.Output = geminiImagesToResponsesOutput(responsesResp.ID, responsesResp.Output)

	responseBody, err = common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, responseBody)
	return &usage, nil
}

var geminiResponseImagePattern = regexp.MustCompile(`!\[image\]\(data:([^;]+);base64,([A-Za-z0-9+/=]+)\)`)

// geminiImagesToResponsesOutput preserves generated images as Responses image
// generation items instead of embedding their base64 payload in output_text.
func geminiImagesToResponsesOutput(responseID string, output []dto.ResponsesOutput) []dto.ResponsesOutput {
	converted := make([]dto.ResponsesOutput, 0, len(output))
	imageIndex := 0
	for _, item := range output {
		if item.Type != "message" {
			converted = append(converted, item)
			continue
		}
		var replacement []dto.ResponsesOutput
		textIndex := 0
		appendText := func(text string, content dto.ResponsesOutputContent) {
			text = strings.TrimSpace(text)
			if text == "" {
				return
			}
			textIndex++
			id := item.ID
			if textIndex > 1 {
				id = fmt.Sprintf("%s_part_%d", item.ID, textIndex)
			}
			replacement = append(replacement, dto.ResponsesOutput{
				Type: item.Type, ID: id, Status: item.Status, Role: item.Role,
				Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: text, Annotations: content.Annotations}},
			})
		}
		for _, content := range item.Content {
			matches := geminiResponseImagePattern.FindAllStringSubmatchIndex(content.Text, -1)
			if len(matches) == 0 {
				appendText(content.Text, content)
				continue
			}
			last := 0
			for _, match := range matches {
				appendText(content.Text[last:match[0]], content)
				imageIndex++
				replacement = append(replacement, dto.ResponsesOutput{
					Type:   dto.ResponsesOutputTypeImageGenerationCall,
					ID:     fmt.Sprintf("%s_image_%d", responseID, imageIndex),
					Status: "completed",
					Result: content.Text[match[4]:match[5]],
				})
				last = match[1]
			}
			appendText(content.Text[last:], content)
		}
		converted = append(converted, replacement...)
	}
	return converted
}

func GeminiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseID := helper.GetResponseID(c)
	created := common.GetTimestamp()
	state, err := relayconvert.NewResponseStreamState(types.RelayFormatGemini, types.RelayFormatOpenAIResponses, relayconvert.ResponseStreamOptions{
		ID:                 responseID,
		Model:              info.UpstreamModelName,
		Created:            created,
		EmitSequenceNumber: true,
	})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	hostedBridge := relayconvert.NewGeminiHostedStreamBridge()
	var streamErr *types.NewAPIError

	sendEvent := func(event relayconvert.ChatToResponsesStreamEvent) bool {
		data, err := common.Marshal(event.Payload)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		if err := helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: event.Type}, string(data)); err != nil {
			if info.StreamStatus != nil {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, err)
			}
			return false
		}
		return true
	}
	failResponsesStream := func(err error) bool {
		failureResults, handled := state.FailResponsesStream("server_error", err.Error(), "")
		if !handled {
			return false
		}
		for _, result := range failureResults {
			event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
			if !ok {
				streamErr = types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return true
			}
			if !sendEvent(event) {
				return true
			}
		}
		return true
	}
	sendChunk := func(chunk *dto.GeminiChatResponse) bool {
		results, err := service.ConvertStreamResponseChunk(c, info, state, chunk)
		if err != nil {
			if failResponsesStream(err) {
				return false
			}
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		for _, result := range results {
			event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
			if !ok {
				streamErr = types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return false
			}
			if !sendEvent(event) {
				return false
			}
		}
		return true
	}

	usage, streamAPIError := geminiStreamHandler(c, info, resp, func(_ string, geminiResponse *dto.GeminiChatResponse) bool {
		hostedBridge.Observe(geminiResponse)
		return sendChunk(geminiResponse)
	})
	if streamAPIError != nil {
		if failResponsesStream(streamAPIError) && streamErr == nil {
			return usage, nil
		}
		return usage, streamAPIError
	}
	if info.StreamStatus != nil && !info.StreamStatus.IsNormalEnd() {
		if info.StreamStatus.EndReason != relaycommon.StreamEndReasonClientGone {
			failResponsesStream(fmt.Errorf("gemini stream ended unexpectedly: %s", info.StreamStatus.Summary()))
		}
		return usage, nil
	}
	if streamErr != nil {
		return nil, streamErr
	}
	hostedEvents, err := hostedBridge.Finalize(state)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	for _, event := range hostedEvents {
		if !sendEvent(event) {
			if streamErr != nil {
				return usage, streamErr
			}
			return usage, nil
		}
	}

	if usage != nil {
		state.SetUsage(usage)
	}
	finalResults, err := service.FinalizeStreamResponse(c, info, state)
	if err != nil {
		if failResponsesStream(err) {
			return usage, streamErr
		}
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	for _, result := range finalResults {
		event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
		if !ok {
			return nil, types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		if !sendEvent(event) {
			if streamErr != nil {
				return usage, streamErr
			}
			return usage, nil
		}
	}
	return usage, nil
}
