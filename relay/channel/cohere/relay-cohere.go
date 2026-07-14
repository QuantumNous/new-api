package cohere

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func cohereUpstreamError(responseBody []byte) *types.OpenAIError {
	var envelope struct {
		Message string `json:"message"`
		Error   any    `json:"error"`
	}
	if err := json.Unmarshal(responseBody, &envelope); err != nil {
		return nil
	}
	if message := strings.TrimSpace(envelope.Message); message != "" {
		return &types.OpenAIError{Message: message, Type: "upstream_error", Code: "cohere_error"}
	}
	upstreamErr := dto.GetOpenAIError(envelope.Error)
	if upstreamErr == nil || (upstreamErr.Message == "" && upstreamErr.Type == "" && upstreamErr.Code == nil) {
		return nil
	}
	return upstreamErr
}

func requestOpenAI2Cohere(textRequest dto.GeneralOpenAIRequest) *CohereRequest {
	cohereReq := CohereRequest{
		Model:       textRequest.Model,
		ChatHistory: []ChatHistory{},
		Message:     "",
		Stream:      lo.FromPtrOr(textRequest.Stream, false),
		MaxTokens:   textRequest.GetMaxTokens(),
	}
	if common.CohereSafetySetting != "NONE" {
		cohereReq.SafetyMode = common.CohereSafetySetting
	}
	if cohereReq.MaxTokens == 0 {
		cohereReq.MaxTokens = 4000
	}
	for _, msg := range textRequest.Messages {
		if msg.Role == "user" {
			cohereReq.Message = msg.StringContent()
		} else {
			var role string
			if msg.Role == "assistant" {
				role = "CHATBOT"
			} else if msg.Role == "system" {
				role = "SYSTEM"
			} else {
				role = "USER"
			}
			cohereReq.ChatHistory = append(cohereReq.ChatHistory, ChatHistory{
				Role:    role,
				Message: msg.StringContent(),
			})
		}
	}

	return &cohereReq
}

func requestConvertRerank2Cohere(rerankRequest dto.RerankRequest) *CohereRerankRequest {
	topN := lo.FromPtrOr(rerankRequest.TopN, 1)
	if topN <= 0 {
		topN = 1
	}
	cohereReq := CohereRerankRequest{
		Query:           rerankRequest.Query,
		Documents:       rerankRequest.Documents,
		Model:           rerankRequest.Model,
		TopN:            topN,
		ReturnDocuments: true,
	}
	return &cohereReq
}

func stopReasonCohere2OpenAI(reason string) string {
	switch reason {
	case "COMPLETE":
		return "stop"
	case "MAX_TOKENS":
		return "max_tokens"
	default:
		return reason
	}
}

func cohereStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	responseId := helper.GetResponseID(c)
	createdTime := common.GetTimestamp()
	usage := &dto.Usage{}
	responseText := ""
	var streamErr *types.NewAPIError
	finished := false
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := strings.Index(string(data), "\n"); i >= 0 {
			return i + 1, data[0:i], nil
		}
		if atEOF {
			return len(data), data, nil
		}
		return 0, nil, nil
	})
	helper.SetEventStreamHeaders(c)
	isFirst := true
	for scanner.Scan() {
		data := strings.TrimSuffix(scanner.Text(), "\r")
		if strings.TrimSpace(data) == "" {
			continue
		}
		if upstreamErr := cohereUpstreamError([]byte(data)); upstreamErr != nil {
			streamErr = types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
			break
		}
		var cohereResp CohereResponse
		if err := json.Unmarshal([]byte(data), &cohereResp); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
		if isFirst {
			isFirst = false
			info.FirstResponseTime = time.Now()
		}
		openaiResp := dto.ChatCompletionsStreamResponse{
			Id:      responseId,
			Created: createdTime,
			Object:  "chat.completion.chunk",
			Model:   info.UpstreamModelName,
		}
		if cohereResp.IsFinished {
			finished = true
			finishReason := stopReasonCohere2OpenAI(cohereResp.FinishReason)
			openaiResp.Choices = []dto.ChatCompletionsStreamResponseChoice{{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{},
				Index:        0,
				FinishReason: &finishReason,
			}}
			if cohereResp.Response != nil {
				usage.PromptTokens = cohereResp.Response.Meta.BilledUnits.InputTokens
				usage.CompletionTokens = cohereResp.Response.Meta.BilledUnits.OutputTokens
				usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
			}
		} else {
			openaiResp.Choices = []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant", Content: &cohereResp.Text},
				Index: 0,
			}}
			responseText += cohereResp.Text
		}
		if err := helper.ObjectData(c, openaiResp); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
		if finished {
			break
		}
	}
	if streamErr == nil {
		if err := scanner.Err(); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		} else if !finished {
			streamErr = types.NewOpenAIError(io.ErrUnexpectedEOF, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
	}
	if streamErr != nil {
		if !helper.HasWrittenUpstreamResponse(c) {
			return nil, streamErr
		}
		_ = helper.ObjectData(c, gin.H{"error": streamErr.ToOpenAIError()})
		return usage, nil
	}
	helper.Done(c)
	if usage.PromptTokens == 0 {
		usage = service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	return usage, nil
}

func cohereHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	createdTime := common.GetTimestamp()
	defer service.CloseResponseBodyGracefully(resp)
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if upstreamErr := cohereUpstreamError(responseBody); upstreamErr != nil {
		return nil, types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
	}
	var cohereResp CohereResponseResult
	err = json.Unmarshal(responseBody, &cohereResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if cohereResp.ResponseId == "" && cohereResp.FinishReason == "" && cohereResp.Text == "" {
		return nil, types.NewOpenAIError(errors.New("cohere upstream returned an empty response"), types.ErrorCodeBadResponse, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
	}
	usage := dto.Usage{}
	usage.PromptTokens = cohereResp.Meta.BilledUnits.InputTokens
	usage.CompletionTokens = cohereResp.Meta.BilledUnits.OutputTokens
	usage.TotalTokens = cohereResp.Meta.BilledUnits.InputTokens + cohereResp.Meta.BilledUnits.OutputTokens

	var openaiResp dto.TextResponse
	openaiResp.Id = cohereResp.ResponseId
	openaiResp.Created = createdTime
	openaiResp.Object = "chat.completion"
	openaiResp.Model = info.UpstreamModelName
	openaiResp.Usage = usage

	openaiResp.Choices = []dto.OpenAITextResponseChoice{
		{
			Index:        0,
			Message:      dto.Message{Content: cohereResp.Text, Role: "assistant"},
			FinishReason: stopReasonCohere2OpenAI(cohereResp.FinishReason),
		},
	}

	jsonResponse, err := json.Marshal(openaiResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)
	return &usage, nil
}

func cohereRerankHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if upstreamErr := cohereUpstreamError(responseBody); upstreamErr != nil {
		return nil, types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
	}
	var cohereResp CohereRerankResponseResult
	err = json.Unmarshal(responseBody, &cohereResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	usage := dto.Usage{}
	if cohereResp.Meta.BilledUnits.InputTokens == 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
		usage.CompletionTokens = 0
		usage.TotalTokens = info.GetEstimatePromptTokens()
	} else {
		usage.PromptTokens = cohereResp.Meta.BilledUnits.InputTokens
		usage.CompletionTokens = cohereResp.Meta.BilledUnits.OutputTokens
		usage.TotalTokens = cohereResp.Meta.BilledUnits.InputTokens + cohereResp.Meta.BilledUnits.OutputTokens
	}

	var rerankResp dto.RerankResponse
	rerankResp.Results = cohereResp.Results
	rerankResp.Usage = usage

	jsonResponse, err := json.Marshal(rerankResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return &usage, nil
}
