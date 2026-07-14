package palm

import (
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// https://developers.generativeai.google/api/rest/generativelanguage/models/generateMessage#request-body
// https://developers.generativeai.google/api/rest/generativelanguage/models/generateMessage#response-body

func responsePaLM2OpenAI(response *PaLMChatResponse) *dto.OpenAITextResponse {
	fullTextResponse := dto.OpenAITextResponse{
		Choices: make([]dto.OpenAITextResponseChoice, 0, len(response.Candidates)),
	}
	for i, candidate := range response.Candidates {
		choice := dto.OpenAITextResponseChoice{
			Index: i,
			Message: dto.Message{
				Role:    "assistant",
				Content: candidate.Content,
			},
			FinishReason: "stop",
		}
		fullTextResponse.Choices = append(fullTextResponse.Choices, choice)
	}
	return &fullTextResponse
}

func streamResponsePaLM2OpenAI(palmResponse *PaLMChatResponse) *dto.ChatCompletionsStreamResponse {
	var choice dto.ChatCompletionsStreamResponseChoice
	if len(palmResponse.Candidates) > 0 {
		choice.Delta.SetContentString(palmResponse.Candidates[0].Content)
	}
	choice.FinishReason = &constant.FinishReasonStop
	var response dto.ChatCompletionsStreamResponse
	response.Object = "chat.completion.chunk"
	response.Model = "palm2"
	response.Choices = []dto.ChatCompletionsStreamResponseChoice{choice}
	return &response
}

// palmStreamHandler preserves genuine upstream HTTP failures and normalizes
// business-error envelopes carried by HTTP 200 responses to 502.
func palmStreamHandler(c *gin.Context, resp *http.Response) (*types.NewAPIError, string) {
	defer service.CloseResponseBodyGracefully(resp)
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway), ""
	}
	var palmResponse PaLMChatResponse
	if err := common.Unmarshal(responseBody, &palmResponse); err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway), ""
	}
	if palmResponse.Error.Code != 0 || len(palmResponse.Candidates) == 0 {
		message := palmResponse.Error.Message
		if message == "" {
			message = "palm stream returned no candidates"
		}
		return types.WithOpenAIError(types.OpenAIError{
			Message: message,
			Type:    palmResponse.Error.Status,
			Code:    palmResponse.Error.Code,
		}, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode)), ""
	}
	fullTextResponse := streamResponsePaLM2OpenAI(&palmResponse)
	fullTextResponse.Id = helper.GetResponseID(c)
	fullTextResponse.Created = common.GetTimestamp()
	helper.SetEventStreamHeaders(c)
	if err := helper.ObjectData(c, fullTextResponse); err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway), ""
	}
	helper.Done(c)
	return nil, palmResponse.Candidates[0].Content
}

// palmHandler converts a complete PaLM response and refuses empty candidate
// lists as upstream failures instead of emitting empty success payloads.
func palmHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	var palmResponse PaLMChatResponse
	err = common.Unmarshal(responseBody, &palmResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if palmResponse.Error.Code != 0 || len(palmResponse.Candidates) == 0 {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: palmResponse.Error.Message,
			Type:    palmResponse.Error.Status,
			Param:   "",
			Code:    palmResponse.Error.Code,
		}, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
	}
	fullTextResponse := responsePaLM2OpenAI(&palmResponse)
	usage := service.ResponseText2Usage(c, palmResponse.Candidates[0].Content, info.UpstreamModelName, info.GetEstimatePromptTokens())
	fullTextResponse.Usage = *usage
	jsonResponse, err := common.Marshal(fullTextResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return usage, nil
}
