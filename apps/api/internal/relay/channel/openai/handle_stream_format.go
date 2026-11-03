package openai

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/logger"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"

	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// 辅助函数
func HandleStreamFormat(c contract.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
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

func handleClaudeFormat(c contract.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		return err
	}

	if streamResponse.Usage != nil {
		info.ClaudeConvertInfo.Usage = streamResponse.Usage
	}
	result, err := relayconvert.ConvertStreamResponse(c.Context(), info, types.RelayFormatClaude, &streamResponse)
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

func handleGeminiFormat(c contract.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		logger.LogError(c.Context(), "failed to unmarshal stream response: "+err.Error())
		return err
	}

	result, err := relayconvert.ConvertStreamResponse(c.Context(), info, types.RelayFormatGemini, &streamResponse)
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
		logger.LogError(c.Context(), "failed to marshal gemini response: "+err.Error())
		return err
	}

	// send gemini format response
	helper.SSERender(c, "data: "+string(geminiResponseStr))
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

// processTokenData accumulates billable text/tool data and reports whether this
// chunk carried a non-empty finish_reason, i.e. the upstream declared the
// completion terminated. The caller needs that signal to tell a complete stream
// apart from an upstream that died mid-answer (#394).
func processTokenData(relayMode int, data string, responseTextBuilder *strings.Builder, toolCount *int) (bool, error) {
	switch relayMode {
	case relayconstant.RelayModeChatCompletions:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return false, err
		}
		return streamResponse.IsFinished(), ProcessStreamResponse(streamResponse, responseTextBuilder, toolCount)
	case relayconstant.RelayModeCompletions:
		var streamResponse dto.CompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return false, err
		}
		processCompletionsStreamResponse(streamResponse, responseTextBuilder)
		for _, choice := range streamResponse.Choices {
			if choice.FinishReason != "" {
				return true, nil
			}
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
	containStreamUsage *bool) error {

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &lastStreamResponse); err != nil {
		return err
	}

	*responseId = lastStreamResponse.Id
	*createAt = lastStreamResponse.Created
	*systemFingerprint = lastStreamResponse.GetSystemFingerprint()
	*model = lastStreamResponse.Model

	if relaycommon.ValidUsage(lastStreamResponse.Usage) {
		*containStreamUsage = true
		*usage = lastStreamResponse.Usage
	}

	return nil
}

func HandleFinalResponse(c contract.Context, info *relaycommon.RelayInfo, lastStreamData string,
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

		result, err := relayconvert.ConvertStreamResponse(c.Context(), info, types.RelayFormatClaude, &streamResponse)
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

		result, err := relayconvert.ConvertStreamResponse(c.Context(), info, types.RelayFormatGemini, &streamResponse)
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
		helper.SSERender(c, "data: "+string(geminiResponseStr))
		_ = helper.FlushWriter(c)
	}
}

func sendResponsesStreamData(c contract.Context, streamResponse dto.ResponsesStreamResponse, data string) {
	if data == "" {
		return
	}
	_ = helper.ResponseChunkData(c, streamResponse, data)
}

// chunkHasVisibleDelta reports whether an SSE data line carries user-visible
// content (text, reasoning, or tool-call deltas). Non-visible chunks (usage,
// role-only, finish-reason-only) are holdable to batch flushes.
func chunkHasVisibleDelta(data string) bool {
	root := gjson.Parse(data)
	var visible bool
	root.Get("choices").ForEach(func(_, choice gjson.Result) bool {
		if choice.Get("text").String() != "" || choice.Get("delta").Get("content").String() != "" {
			visible = true
			return false
		}
		delta := choice.Get("delta")
		if deltaReasoning(delta) != "" {
			visible = true
			return false
		}
		if tc := delta.Get("tool_calls"); tc.IsArray() && len(tc.Array()) > 0 {
			visible = true
			return false
		}
		return true
	})
	return visible
}

// chunkHasTextDelta reports whether an SSE chunk carries non-empty visible
// text. Unlike chunkHasVisibleDelta, reasoning and tool-call deltas do not
// count: billing treats a reasoning-only response as undelivered text.
func chunkHasTextDelta(data string) bool {
	root := gjson.Parse(data)
	var text bool
	root.Get("choices").ForEach(func(_, choice gjson.Result) bool {
		if strings.TrimSpace(choice.Get("text").String()) != "" ||
			strings.TrimSpace(choice.Get("delta").Get("content").String()) != "" {
			text = true
			return false
		}
		return true
	})
	return text
}

// firstFinishReason returns the first non-empty finish_reason in an SSE chunk.
func firstFinishReason(data string) string {
	var reason string
	gjson.Get(data, "choices").ForEach(func(_, choice gjson.Result) bool {
		if value := choice.Get("finish_reason").String(); value != "" {
			reason = value
			return false
		}
		return true
	})
	return reason
}

// streamErrorPayload returns the upstream error carried by an SSE data line, or
// an empty string. Some resellers answer 200 and then stream an error object
// instead of failing the HTTP request; without this check those streams look
// like a successful empty completion.
func streamErrorPayload(data string) string {
	root := gjson.Parse(data)
	if errField := root.Get("error"); errField.Exists() && errField.Type != gjson.Null {
		if errField.IsObject() {
			if message := errField.Get("message").String(); message != "" {
				return message
			}
			return errField.Raw
		}
		if errField.Type == gjson.String {
			return errField.String()
		}
		return ""
	}
	if root.Get("type").String() == "error" {
		return data
	}
	return ""
}
