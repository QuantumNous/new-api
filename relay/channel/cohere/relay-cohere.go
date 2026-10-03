package cohere

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/responsescompat"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func requestOpenAI2Cohere(textRequest dto.GeneralOpenAIRequest) (*CohereChatRequest, error) {
	messages := make([]CohereChatMessage, 0, len(textRequest.Messages))
	for _, msg := range textRequest.Messages {
		cohereMsg, err := convertOpenAIMessageToCohere(msg)
		if err != nil {
			return nil, err
		}
		messages = append(messages, cohereMsg)
	}

	cohereReq := &CohereChatRequest{
		Model:            textRequest.Model,
		Messages:         messages,
		Stream:           lo.FromPtrOr(textRequest.Stream, false),
		MaxTokens:        getCohereMaxTokens(textRequest),
		Temperature:      textRequest.Temperature,
		P:                textRequest.TopP,
		K:                textRequest.TopK,
		FrequencyPenalty: textRequest.FrequencyPenalty,
		PresencePenalty:  textRequest.PresencePenalty,
		ResponseFormat:   textRequest.ResponseFormat,
		Tools:            textRequest.Tools,
	}
	if common.CohereSafetySetting != "NONE" {
		cohereReq.SafetyMode = common.CohereSafetySetting
	}
	switch textRequest.ReasoningEffort {
	case "":
	case "none":
		cohereReq.Thinking = &CohereThinking{Type: "disabled"}
	case "high":
		cohereReq.Thinking = &CohereThinking{Type: "enabled"}
	default:
		return nil, fmt.Errorf("unsupported reasoning_effort %q: use none or high", textRequest.ReasoningEffort)
	}
	if textRequest.Seed != nil {
		maxSeed := ^uint64(0)
		if *textRequest.Seed < 0 || *textRequest.Seed > float64(maxSeed) {
			return nil, fmt.Errorf("cohere seed must be between 0 and %d", maxSeed)
		}
		seed := uint64(*textRequest.Seed)
		cohereReq.Seed = &seed
	}
	if textRequest.Stop != nil {
		stopSequences, err := convertStopSequences(textRequest.Stop)
		if err != nil {
			return nil, err
		}
		cohereReq.StopSequences = stopSequences
	}
	if textRequest.ToolChoice != nil {
		toolChoice, err := convertToolChoice(textRequest.ToolChoice)
		if err != nil {
			return nil, err
		}
		cohereReq.ToolChoice = toolChoice
	}

	return cohereReq, nil
}

func getCohereMaxTokens(request dto.GeneralOpenAIRequest) *uint {
	if request.MaxCompletionTokens != nil {
		return request.MaxCompletionTokens
	}
	return request.MaxTokens
}

func convertOpenAIMessageToCohere(message dto.Message) (CohereChatMessage, error) {
	role := message.Role
	if role == "developer" {
		role = "system"
	}
	if role == "function" {
		role = "tool"
	}
	if role != "user" && role != "assistant" && role != "system" && role != "tool" {
		return CohereChatMessage{}, fmt.Errorf("unsupported cohere message role: %s", message.Role)
	}

	cohereMsg := CohereChatMessage{
		Role:       role,
		ToolCallId: message.ToolCallId,
	}

	if role == "tool" {
		cohereMsg.Content = convertToolMessageContent(message)
		return cohereMsg, nil
	}

	content, err := convertMessageContent(message)
	if err != nil {
		return CohereChatMessage{}, err
	}
	cohereMsg.Content = content

	if role == "assistant" && message.ToolCalls != nil {
		cohereMsg.ToolCalls = convertOpenAIToolCallsToCohere(message.ParseToolCalls())
		if len(cohereMsg.ToolCalls) > 0 && cohereMsg.Content == nil {
			cohereMsg.Content = nil
		}
	}

	return cohereMsg, nil
}

func convertMessageContent(message dto.Message) (any, error) {
	if message.Content == nil {
		return nil, nil
	}
	if message.IsStringContent() {
		return message.StringContent(), nil
	}
	contents := message.ParseContent()
	blocks := make([]CohereContentBlock, 0, len(contents))
	for _, content := range contents {
		switch content.Type {
		case dto.ContentTypeText:
			blocks = append(blocks, CohereContentBlock{
				Type: "text",
				Text: content.Text,
			})
		case dto.ContentTypeImageURL:
			image := content.GetImageMedia()
			if image == nil || image.Url == "" {
				return nil, errors.New("cohere image_url content requires image_url.url")
			}
			blocks = append(blocks, CohereContentBlock{
				Type: "image_url",
				ImageURL: &CohereImageURL{
					URL:    image.Url,
					Detail: image.Detail,
				},
			})
		default:
			return nil, fmt.Errorf("cohere only supports text and image_url content blocks, got %s", content.Type)
		}
	}
	return blocks, nil
}

func convertToolMessageContent(message dto.Message) []CohereContentBlock {
	content := message.StringContent()
	if content == "" && message.Content != nil {
		content = fmt.Sprintf("%v", message.Content)
	}
	return []CohereContentBlock{
		{
			Type: "document",
			Document: &CohereDocumentContent{
				Data: content,
			},
		},
	}
}

func convertOpenAIToolCallsToCohere(toolCalls []dto.ToolCallRequest) []CohereToolCall {
	result := make([]CohereToolCall, 0, len(toolCalls))
	for _, toolCall := range toolCalls {
		toolType := toolCall.Type
		if toolType == "" {
			toolType = "function"
		}
		result = append(result, CohereToolCall{
			ID:   toolCall.ID,
			Type: toolType,
			Function: dto.FunctionResponse{
				Name:      toolCall.Function.Name,
				Arguments: toolCall.Function.Arguments,
			},
		})
	}
	return result
}

func convertStopSequences(stop any) ([]string, error) {
	switch v := stop.(type) {
	case string:
		if v == "" {
			return nil, nil
		}
		return []string{v}, nil
	case []string:
		return v, nil
	case []any:
		values := make([]string, 0, len(v))
		for _, item := range v {
			str, ok := item.(string)
			if !ok {
				return nil, errors.New("cohere stop sequences must be strings")
			}
			values = append(values, str)
		}
		return values, nil
	default:
		return nil, fmt.Errorf("unsupported cohere stop type %T", stop)
	}
}

func convertToolChoice(toolChoice any) (string, error) {
	switch v := toolChoice.(type) {
	case string:
		switch strings.ToLower(v) {
		case "", "auto":
			return "", nil
		case "none":
			return "NONE", nil
		case "required":
			return "REQUIRED", nil
		default:
			return "", fmt.Errorf("unsupported cohere tool_choice: %s", v)
		}
	case map[string]any:
		choiceType := strings.ToLower(common.Interface2String(v["type"]))
		if choiceType == "function" {
			return "REQUIRED", nil
		}
		if choiceType == "none" {
			return "NONE", nil
		}
		return "", fmt.Errorf("unsupported cohere tool_choice type: %s", choiceType)
	default:
		return "", fmt.Errorf("unsupported cohere tool_choice type %T", toolChoice)
	}
}

func requestConvertRerank2Cohere(rerankRequest dto.RerankRequest) *CohereRerankRequest {
	topN := lo.FromPtrOr(rerankRequest.TopN, 0)
	if topN < 0 {
		topN = 0
	}
	return &CohereRerankRequest{
		Query:     rerankRequest.Query,
		Documents: rerankRequest.Documents,
		Model:     rerankRequest.Model,
		TopN:      topN,
	}
}

func requestConvertEmbedding2Cohere(embeddingRequest dto.EmbeddingRequest) (*CohereEmbeddingRequest, error) {
	inputType := strings.TrimSpace(embeddingRequest.InputType)
	if inputType == "" {
		inputType = "search_document"
	}
	inputs := parseCohereEmbeddingInput(embeddingRequest.Input)
	if len(inputs) == 0 {
		return nil, types.NewErrorWithStatusCode(
			errors.New("cohere embeddings require string input"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	embeddingTypes := embeddingRequest.EmbeddingTypes
	if len(embeddingTypes) == 0 {
		embeddingTypes = []string{"float"}
	}
	return &CohereEmbeddingRequest{
		Model:           embeddingRequest.Model,
		Texts:           inputs,
		InputType:       inputType,
		EmbeddingTypes:  embeddingTypes,
		OutputDimension: embeddingRequest.Dimensions,
		Truncate:        embeddingRequest.Truncate,
	}, nil
}

func parseCohereEmbeddingInput(input any) []string {
	switch v := input.(type) {
	case string:
		return []string{v}
	case []string:
		return v
	case []any:
		inputs := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok {
				inputs = append(inputs, str)
			}
		}
		return inputs
	default:
		return nil
	}
}

func stopReasonCohere2OpenAI(reason string) string {
	switch strings.ToUpper(reason) {
	case "", "COMPLETE", "STOP_SEQUENCE":
		return "stop"
	case "MAX_TOKENS":
		return "length"
	case "TOOL_CALL":
		return "tool_calls"
	default:
		return strings.ToLower(reason)
	}
}

func cohereUsageToOpenAI(usage CohereUsage, estimatedPromptTokens int) dto.Usage {
	promptTokens := usage.Tokens.InputTokens
	completionTokens := usage.Tokens.OutputTokens
	if promptTokens == 0 && completionTokens == 0 {
		promptTokens = usage.BilledUnits.InputTokens
		completionTokens = usage.BilledUnits.OutputTokens
	}
	if promptTokens == 0 && completionTokens == 0 && estimatedPromptTokens > 0 {
		promptTokens = estimatedPromptTokens
	}
	openAIUsage := dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
		InputTokens:      promptTokens,
		OutputTokens:     completionTokens,
	}
	return openAIUsage
}

func cohereMetaToOpenAI(meta CohereMeta, estimatedPromptTokens int) dto.Usage {
	return cohereUsageToOpenAI(CohereUsage{
		BilledUnits: meta.BilledUnits,
		Tokens:      meta.Tokens,
	}, estimatedPromptTokens)
}

func cohereStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseId := helper.GetResponseID(c)
	createdTime := common.GetTimestamp()
	usage := &dto.Usage{}
	responseText := strings.Builder{}
	sentFinish := false

	defer service.CloseResponseBodyGracefully(resp)

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	dataChan := make(chan string)
	stopChan := make(chan bool)
	go func() {
		for scanner.Scan() {
			dataChan <- scanner.Text()
		}
		if err := scanner.Err(); err != nil {
			common.SysLog("error reading stream: " + err.Error())
		}
		stopChan <- true
	}()

	helper.SetEventStreamHeaders(c)
	isFirst := true
	c.Stream(func(w io.Writer) bool {
		select {
		case line := <-dataChan:
			data, ok := extractSSEData(line)
			if !ok {
				return true
			}
			if data == "[DONE]" {
				return true
			}
			if isFirst {
				isFirst = false
				info.FirstResponseTime = time.Now()
			}

			var event CohereStreamEvent
			if err := common.Unmarshal(common.StringToByteSlice(data), &event); err != nil {
				common.SysLog("error unmarshalling cohere stream response: " + err.Error())
				return true
			}
			if event.ID != "" {
				responseId = event.ID
			}

			openAIResp, emit, eventUsage := cohereStreamEvent2OpenAI(event, responseId, createdTime, info.UpstreamModelName)
			if eventUsage != nil {
				*usage = *eventUsage
			}
			if event.Type == "content-delta" {
				responseText.WriteString(event.Delta.Message.Content.Text)
			}
			if openAIResp.IsFinished() {
				sentFinish = true
			}
			if !emit {
				return true
			}
			if err := renderStreamResponse(c, openAIResp); err != nil {
				common.SysLog("error marshalling cohere stream response: " + err.Error())
			}
			if event.Type == "message-end" && info.ShouldIncludeUsage && usage.TotalTokens > 0 {
				finalUsageResp := helper.GenerateFinalUsageResponse(responseId, createdTime, info.UpstreamModelName, *usage)
				if err := renderStreamResponse(c, finalUsageResp); err != nil {
					common.SysLog("error marshalling cohere stream usage response: " + err.Error())
				}
			}
			return true
		case <-stopChan:
			if !sentFinish {
				finishReason := "stop"
				stopResp := helper.GenerateStopResponse(responseId, createdTime, info.UpstreamModelName, finishReason)
				_ = renderStreamResponse(c, stopResp)
			}
			c.Render(-1, common.CustomEvent{Data: "data: [DONE]"})
			return false
		}
	})
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	return usage, nil
}

func cohereResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	dataChan := make(chan string)
	stopChan := make(chan bool)
	go func() {
		for scanner.Scan() {
			dataChan <- scanner.Text()
		}
		stopChan <- true
	}()

	helper.SetEventStreamHeaders(c)
	isFirst := true
	emitter := responsescompat.NewStreamEmitter(c, info)
	c.Stream(func(w io.Writer) bool {
		select {
		case line := <-dataChan:
			data, ok := extractSSEData(line)
			if !ok || data == "[DONE]" {
				return true
			}
			if isFirst && info != nil {
				isFirst = false
				info.FirstResponseTime = time.Now()
			}

			var event CohereStreamEvent
			if err := common.Unmarshal(common.StringToByteSlice(data), &event); err != nil {
				common.SysLog("error unmarshalling cohere responses stream response: " + err.Error())
				return true
			}
			if event.Type == "content-delta" {
				if !emitter.SendTextDelta(event.Delta.Message.Content.Text) {
					return false
				}
			}
			if event.Type == "message-end" {
				estimatedPromptTokens := 0
				if info != nil {
					estimatedPromptTokens = info.GetEstimatePromptTokens()
				}
				usage := cohereUsageToOpenAI(event.Delta.Usage, estimatedPromptTokens)
				if usage.PromptTokens != 0 || usage.CompletionTokens != 0 || usage.TotalTokens != 0 {
					emitter.SetUsage(&usage)
				}
				return emitter.Complete()
			}
			return true
		case <-stopChan:
			return !emitter.Complete()
		}
	})
	if emitter.Err() != nil {
		return nil, emitter.Err()
	}
	return emitter.Usage(), nil
}

func extractSSEData(line string) (string, bool) {
	line = strings.TrimSpace(strings.TrimSuffix(line, "\r"))
	if !strings.HasPrefix(line, "data:") {
		return "", false
	}
	return strings.TrimSpace(strings.TrimPrefix(line, "data:")), true
}

func cohereStreamEvent2OpenAI(event CohereStreamEvent, responseId string, createdTime int64, model string) (*dto.ChatCompletionsStreamResponse, bool, *dto.Usage) {
	openAIResp := &dto.ChatCompletionsStreamResponse{
		Id:      responseId,
		Created: createdTime,
		Object:  "chat.completion.chunk",
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
			},
		},
	}

	switch event.Type {
	case "message-start":
		role := event.Delta.Message.Role
		if role == "" {
			role = "assistant"
		}
		openAIResp.Choices[0].Delta.Role = role
		return openAIResp, true, nil
	case "content-delta":
		text := event.Delta.Message.Content.Text
		openAIResp.Choices[0].Delta.Content = &text
		return openAIResp, true, nil
	case "tool-call-start", "tool-call-delta":
		toolCall, ok := parseStreamToolCall(event.Delta.Message.ToolCalls)
		if !ok {
			return openAIResp, false, nil
		}
		index := 0
		if event.Index != nil {
			index = *event.Index
		}
		toolCall.SetIndex(index)
		openAIResp.Choices[0].Delta.ToolCalls = []dto.ToolCallResponse{*toolCall}
		return openAIResp, true, nil
	case "message-end":
		finishReason := stopReasonCohere2OpenAI(event.Delta.FinishReason)
		openAIResp.Choices[0].FinishReason = &finishReason
		usage := cohereUsageToOpenAI(event.Delta.Usage, 0)
		return openAIResp, true, &usage
	default:
		return openAIResp, false, nil
	}
}

func parseStreamToolCall(raw json.RawMessage) (*dto.ToolCallResponse, bool) {
	if len(raw) == 0 {
		return nil, false
	}
	var toolCall CohereToolCall
	if common.GetJsonType(raw) == "array" {
		var toolCalls []CohereToolCall
		if err := common.Unmarshal(raw, &toolCalls); err != nil || len(toolCalls) == 0 {
			return nil, false
		}
		toolCall = toolCalls[0]
	} else {
		if err := common.Unmarshal(raw, &toolCall); err != nil {
			return nil, false
		}
	}
	toolType := toolCall.Type
	if toolType == "" {
		toolType = "function"
	}
	return &dto.ToolCallResponse{
		ID:   toolCall.ID,
		Type: toolType,
		Function: dto.FunctionResponse{
			Name:      toolCall.Function.Name,
			Arguments: toolCall.Function.Arguments,
		},
	}, true
}

func renderStreamResponse(c *gin.Context, response *dto.ChatCompletionsStreamResponse) error {
	jsonStr, err := common.Marshal(response)
	if err != nil {
		return err
	}
	c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonStr)})
	return nil
}

func cohereHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	createdTime := common.GetTimestamp()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.CloseResponseBodyGracefully(resp)

	var cohereResp CohereChatResponse
	if err = common.Unmarshal(responseBody, &cohereResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	responseText := cohereResponseText(cohereResp.Message.Content)
	usage := cohereUsageToOpenAI(cohereResp.Usage, info.GetEstimatePromptTokens())
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		usage = *service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	openaiResp := dto.TextResponse{
		Id:      cohereResp.ID,
		Created: createdTime,
		Object:  "chat.completion",
		Model:   info.UpstreamModelName,
		Usage:   usage,
	}
	if openaiResp.Id == "" {
		openaiResp.Id = helper.GetResponseID(c)
	}

	message := dto.Message{
		Content: responseText,
		Role:    "assistant",
	}
	if thinking := cohereResponseThinking(cohereResp.Message.Content); thinking != "" {
		message.ReasoningContent = &thinking
	}
	toolCalls := convertCohereToolCallsToOpenAI(cohereResp.Message.ToolCalls)
	if len(toolCalls) > 0 {
		message.SetNullContent()
		message.SetToolCalls(toolCalls)
	}

	openaiResp.Choices = []dto.OpenAITextResponseChoice{
		{
			Index:        0,
			Message:      message,
			FinishReason: stopReasonCohere2OpenAI(cohereResp.FinishReason),
		},
	}

	jsonResponse, err := common.Marshal(openaiResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)
	return &usage, nil
}

func cohereResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	createdTime := common.GetTimestamp()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.CloseResponseBodyGracefully(resp)

	var cohereResp CohereChatResponse
	if err = common.Unmarshal(responseBody, &cohereResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	responseText := cohereResponseText(cohereResp.Message.Content)
	usage := cohereUsageToOpenAI(cohereResp.Usage, info.GetEstimatePromptTokens())
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		usage = *service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	message := dto.Message{
		Content: responseText,
		Role:    "assistant",
	}
	if thinking := cohereResponseThinking(cohereResp.Message.Content); thinking != "" {
		message.ReasoningContent = &thinking
	}
	toolCalls := convertCohereToolCallsToOpenAI(cohereResp.Message.ToolCalls)
	if len(toolCalls) > 0 {
		message.SetNullContent()
		message.SetToolCalls(toolCalls)
	}

	openaiResp := &dto.OpenAITextResponse{
		Id:      cohereResp.ID,
		Created: createdTime,
		Object:  "chat.completion",
		Model:   info.UpstreamModelName,
		Usage:   usage,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      message,
				FinishReason: stopReasonCohere2OpenAI(cohereResp.FinishReason),
			},
		},
	}
	if openaiResp.Id == "" {
		openaiResp.Id = helper.GetResponseID(c)
	}

	responsesResp, responsesUsage := responsescompat.ChatCompletionToResponse(c, info, openaiResp)
	jsonResponse, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return responsesUsage, nil
}

func cohereResponseText(contents []CohereContentBlock) string {
	builder := strings.Builder{}
	for _, content := range contents {
		if content.Type == "text" {
			builder.WriteString(content.Text)
		}
	}
	return builder.String()
}

func cohereResponseThinking(contents []CohereContentBlock) string {
	var thinking strings.Builder
	for _, content := range contents {
		if content.Type == "thinking" {
			thinking.WriteString(content.Thinking)
		}
	}
	return thinking.String()
}

func convertCohereToolCallsToOpenAI(toolCalls []CohereToolCall) []dto.ToolCallResponse {
	result := make([]dto.ToolCallResponse, 0, len(toolCalls))
	for _, toolCall := range toolCalls {
		toolType := toolCall.Type
		if toolType == "" {
			toolType = "function"
		}
		result = append(result, dto.ToolCallResponse{
			ID:   toolCall.ID,
			Type: toolType,
			Function: dto.FunctionResponse{
				Name:      toolCall.Function.Name,
				Arguments: toolCall.Function.Arguments,
			},
		})
	}
	return result
}

func cohereRerankHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.CloseResponseBodyGracefully(resp)
	var cohereResp CohereRerankResponseResult
	if err = common.Unmarshal(responseBody, &cohereResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	usage := cohereMetaToOpenAI(cohereResp.Meta, info.GetEstimatePromptTokens())
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
		usage.TotalTokens = info.GetEstimatePromptTokens()
		usage.InputTokens = usage.PromptTokens
	}

	rerankResp := dto.RerankResponse{
		Results: cohereResp.Results,
		Usage:   usage,
	}
	if info.RerankerInfo != nil && info.RerankerInfo.ReturnDocuments {
		for i := range rerankResp.Results {
			idx := rerankResp.Results[i].Index
			if idx >= 0 && idx < len(info.RerankerInfo.Documents) {
				rerankResp.Results[i].Document = info.RerankerInfo.Documents[idx]
			}
		}
	}

	jsonResponse, err := common.Marshal(rerankResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return &usage, nil
}

func cohereEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.CloseResponseBodyGracefully(resp)
	var cohereResp CohereEmbeddingResponse
	if err = common.Unmarshal(responseBody, &cohereResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	usage := cohereMetaToOpenAI(cohereResp.Meta, info.GetEstimatePromptTokens())
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
		usage.TotalTokens = info.GetEstimatePromptTokens()
		usage.InputTokens = usage.PromptTokens
	}

	openAIResp := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   make([]dto.OpenAIEmbeddingResponseItem, 0, len(cohereResp.Embeddings.Float)),
		Model:  info.UpstreamModelName,
		Usage:  usage,
	}
	for index, embedding := range cohereResp.Embeddings.Float {
		openAIResp.Data = append(openAIResp.Data, dto.OpenAIEmbeddingResponseItem{
			Object:    "embedding",
			Index:     index,
			Embedding: embedding,
		})
	}

	jsonResponse, err := common.Marshal(openAIResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return &usage, nil
}
