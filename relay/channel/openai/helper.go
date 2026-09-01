package openai

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

// 辅助函数
func HandleStreamFormat(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	info.SendResponseCount++

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		return sendStreamData(c, info, data, forceFormat, thinkToContent)
	case types.RelayFormatClaude:
		return handleClaudeFormat(c, data, info)
	case types.RelayFormatGemini:
		return handleGeminiFormat(c, data, info)
	}
	return nil
}

func handleClaudeFormat(c *gin.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		return err
	}

	if streamResponse.Usage != nil {
		info.ClaudeConvertInfo.Usage = streamResponse.Usage
	}
	result, err := relayconvert.ConvertStreamResponse(c, info, types.RelayFormatClaude, &streamResponse)
	if err != nil {
		return err
	}
	claudeResponses, ok := result.Value.([]*dto.ClaudeResponse)
	if !ok {
		return fmt.Errorf("expected Claude stream responses, got %T", result.Value)
	}
	for _, resp := range claudeResponses {
		helper.ClaudeData(c, *resp)
	}
	return nil
}

func handleGeminiFormat(c *gin.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
		return err
	}

	result, err := relayconvert.ConvertStreamResponse(c, info, types.RelayFormatGemini, &streamResponse)
	if err != nil {
		return err
	}
	geminiResponse, ok := result.Value.(*dto.GeminiChatResponse)
	if !ok {
		return fmt.Errorf("expected Gemini stream response, got %T", result.Value)
	}

	// 如果返回 nil，表示没有实际内容，跳过发送
	if geminiResponse == nil {
		return nil
	}

	geminiResponseStr, err := common.Marshal(geminiResponse)
	if err != nil {
		logger.LogError(c, "failed to marshal gemini response: "+err.Error())
		return err
	}

	// send gemini format response
	c.Render(-1, common.CustomEvent{Data: "data: " + string(geminiResponseStr)})
	_ = helper.FlushWriter(c)
	return nil
}

func ProcessStreamResponse(streamResponse dto.ChatCompletionsStreamResponse, responseTextBuilder *strings.Builder, toolCount *int) error {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Delta.GetContentString())
		responseTextBuilder.WriteString(choice.Delta.GetReasoningContent())
		if choice.Delta.ToolCalls != nil {
			if len(choice.Delta.ToolCalls) > *toolCount {
				*toolCount = len(choice.Delta.ToolCalls)
			}
			for _, tool := range choice.Delta.ToolCalls {
				responseTextBuilder.WriteString(tool.Function.Name)
				responseTextBuilder.WriteString(tool.Function.Arguments)
			}
		}
	}
	return nil
}

// processTokenData accumulates text/tool tokens from one SSE frame and reports
// whether the direct-forward path must hold the frame for the end-of-stream
// usage verdict. Only a usage-only candidate is held: the frame carries a
// usage object (present, non-null) and its choices are empty — the one shape
// handleLastResponse may swallow before the client sees it. Any frame with
// choices (role/content/reasoning/tool_calls/finish_reason, with or without a
// piggybacked usage) streams through immediately; the verdict's
// content/reasoning check is constant-false on empty choices, so hold and
// swallow stay decided by the same predicate. Note this treats an absent
// choices key the same as an explicit empty array — the closed DTO cannot
// tell them apart, and both only occur on usage/keep-alive shaped frames.
func processTokenData(relayMode int, data string, responseTextBuilder *strings.Builder, toolCount *int) (bool, error) {
	switch relayMode {
	case relayconstant.RelayModeChatCompletions:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return false, err
		}
		holdForUsageVerdict := streamResponse.Usage != nil && len(streamResponse.Choices) == 0
		return holdForUsageVerdict, ProcessStreamResponse(streamResponse, responseTextBuilder, toolCount)
	case relayconstant.RelayModeCompletions:
		var streamResponse dto.CompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return false, err
		}
		processCompletionsStreamResponse(streamResponse, responseTextBuilder)
		// CompletionsStreamResponse carries no usage field, but
		// handleLastResponse parses the terminal frame as a chat stream
		// response and can still find one; probe the same way so the
		// hold/swallow verdict matches.
		var usageProbe struct {
			Usage *dto.Usage `json:"usage"`
		}
		if err := common.UnmarshalJsonStr(data, &usageProbe); err == nil && usageProbe.Usage != nil && len(streamResponse.Choices) == 0 {
			return true, nil
		}
	}
	return false, nil
}

func processCompletionsStreamResponse(streamResponse dto.CompletionsStreamResponse, responseTextBuilder *strings.Builder) {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Text)
	}
}

func handleLastResponse(lastStreamData string, responseId *string, createAt *int64,
	systemFingerprint *string, model *string, usage **dto.Usage,
	containStreamUsage *bool, info *relaycommon.RelayInfo,
	shouldSendLastResp *bool) error {

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &lastStreamResponse); err != nil {
		return err
	}

	*responseId = lastStreamResponse.Id
	*createAt = lastStreamResponse.Created
	*systemFingerprint = lastStreamResponse.GetSystemFingerprint()
	*model = lastStreamResponse.Model

	if service.ValidUsage(lastStreamResponse.Usage) {
		*containStreamUsage = true
		*usage = lastStreamResponse.Usage
		if !info.ShouldIncludeUsage {
			*shouldSendLastResp = lo.SomeBy(lastStreamResponse.Choices, func(choice dto.ChatCompletionsStreamResponseChoice) bool {
				return choice.Delta.GetContentString() != "" || choice.Delta.GetReasoningContent() != ""
			})
		}
	}

	return nil
}

func HandleFinalResponse(c *gin.Context, info *relaycommon.RelayInfo, lastStreamData string,
	responseId string, createAt int64, model string, systemFingerprint string,
	usage *dto.Usage, containStreamUsage bool) {

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		if info.ShouldIncludeUsage && !containStreamUsage {
			response := helper.GenerateFinalUsageResponse(responseId, createAt, model, *usage)
			response.SetSystemFingerprint(systemFingerprint)
			helper.ObjectData(c, response)
		}
		helper.Done(c)

	case types.RelayFormatClaude:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &streamResponse); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			return
		}

		info.ClaudeConvertInfo.Usage = usage

		result, err := relayconvert.ConvertStreamResponse(c, info, types.RelayFormatClaude, &streamResponse)
		if err != nil {
			common.SysLog("error converting Claude stream response: " + err.Error())
			return
		}
		claudeResponses, ok := result.Value.([]*dto.ClaudeResponse)
		if !ok {
			common.SysLog(fmt.Sprintf("expected Claude stream responses, got %T", result.Value))
			return
		}
		for _, resp := range claudeResponses {
			_ = helper.ClaudeData(c, *resp)
		}
		info.ClaudeConvertInfo.Done = true

	case types.RelayFormatGemini:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &streamResponse); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			return
		}

		// 这里处理的是 openai 最后一个流响应，其 delta 为空，有 finish_reason 字段
		// 因此相比较于 google 官方的流响应，由 openai 转换而来会多一个 parts 为空，finishReason 为 STOP 的响应
		// 而包含最后一段文本输出的响应（倒数第二个）的 finishReason 为 null
		// 暂不知是否有程序会不兼容。

		result, err := relayconvert.ConvertStreamResponse(c, info, types.RelayFormatGemini, &streamResponse)
		if err != nil {
			common.SysLog("error converting Gemini stream response: " + err.Error())
			return
		}
		geminiResponse, ok := result.Value.(*dto.GeminiChatResponse)
		if !ok {
			common.SysLog(fmt.Sprintf("expected Gemini stream response, got %T", result.Value))
			return
		}

		// openai 流响应开头的空数据
		if geminiResponse == nil {
			return
		}

		geminiResponseStr, err := common.Marshal(geminiResponse)
		if err != nil {
			common.SysLog("error marshalling gemini response: " + err.Error())
			return
		}

		// 发送最终的 Gemini 响应
		c.Render(-1, common.CustomEvent{Data: "data: " + string(geminiResponseStr)})
		_ = helper.FlushWriter(c)
	}
}

func sendResponsesStreamData(c *gin.Context, streamResponse dto.ResponsesStreamResponse, data string) {
	if data == "" {
		return
	}
	_ = helper.ResponseChunkData(c, streamResponse, data)
}
