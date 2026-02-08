package claude

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openrouter"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relay/reasonmap"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const (
	WebSearchMaxUsesLow    = 1
	WebSearchMaxUsesMedium = 5
	WebSearchMaxUsesHigh   = 10
)

func stopReasonClaude2OpenAI(reason string) string {
	return reasonmap.ClaudeStopReasonToOpenAIFinishReason(reason)
}

func maybeMarkClaudeRefusal(c *gin.Context, stopReason string) {
	if c == nil {
		return
	}
	if strings.EqualFold(stopReason, "refusal") {
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "claude_stop_reason=refusal")
	}
}

func RequestOpenAI2ClaudeMessage(c *gin.Context, textRequest dto.GeneralOpenAIRequest) (*dto.ClaudeRequest, error) {
	claudeTools := make([]any, 0, len(textRequest.Tools))

	for _, tool := range textRequest.Tools {
		if params, ok := tool.Function.Parameters.(map[string]any); ok {
			claudeTool := dto.Tool{
				Name:        tool.Function.Name,
				Description: tool.Function.Description,
			}
			claudeTool.InputSchema = make(map[string]interface{})
			if params["type"] != nil {
				claudeTool.InputSchema["type"] = params["type"].(string)
			}
			claudeTool.InputSchema["properties"] = params["properties"]
			claudeTool.InputSchema["required"] = params["required"]
			for s, a := range params {
				if s == "type" || s == "properties" || s == "required" {
					continue
				}
				claudeTool.InputSchema[s] = a
			}
			claudeTools = append(claudeTools, &claudeTool)
		}
	}

	// Web search tool
	// https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool
	if textRequest.WebSearchOptions != nil {
		webSearchTool := dto.ClaudeWebSearchTool{
			Type: "web_search_20250305",
			Name: "web_search",
		}

		// 处理 user_location
		if textRequest.WebSearchOptions.UserLocation != nil {
			anthropicUserLocation := &dto.ClaudeWebSearchUserLocation{
				Type: "approximate", // 固定为 "approximate"
			}

			// 解析 UserLocation JSON
			var userLocationMap map[string]interface{}
			if err := json.Unmarshal(textRequest.WebSearchOptions.UserLocation, &userLocationMap); err == nil {
				// 检查是否有 approximate 字段
				if approximateData, ok := userLocationMap["approximate"].(map[string]interface{}); ok {
					if timezone, ok := approximateData["timezone"].(string); ok && timezone != "" {
						anthropicUserLocation.Timezone = timezone
					}
					if country, ok := approximateData["country"].(string); ok && country != "" {
						anthropicUserLocation.Country = country
					}
					if region, ok := approximateData["region"].(string); ok && region != "" {
						anthropicUserLocation.Region = region
					}
					if city, ok := approximateData["city"].(string); ok && city != "" {
						anthropicUserLocation.City = city
					}
				}
			}

			webSearchTool.UserLocation = anthropicUserLocation
		}

		// 处理 search_context_size 转换为 max_uses
		if textRequest.WebSearchOptions.SearchContextSize != "" {
			switch textRequest.WebSearchOptions.SearchContextSize {
			case "low":
				webSearchTool.MaxUses = WebSearchMaxUsesLow
			case "medium":
				webSearchTool.MaxUses = WebSearchMaxUsesMedium
			case "high":
				webSearchTool.MaxUses = WebSearchMaxUsesHigh
			}
		}

		claudeTools = append(claudeTools, &webSearchTool)
	}

	claudeRequest := dto.ClaudeRequest{
		Model:         textRequest.Model,
		MaxTokens:     textRequest.GetMaxTokens(),
		StopSequences: nil,
		Temperature:   textRequest.Temperature,
		TopP:          textRequest.TopP,
		TopK:          textRequest.TopK,
		Stream:        textRequest.Stream,
		Tools:         claudeTools,
	}

	// 处理 tool_choice 和 parallel_tool_calls
	if textRequest.ToolChoice != nil || textRequest.ParallelTooCalls != nil {
		claudeToolChoice := mapToolChoice(textRequest.ToolChoice, textRequest.ParallelTooCalls)
		if claudeToolChoice != nil {
			claudeRequest.ToolChoice = claudeToolChoice
		}
	}

	if claudeRequest.MaxTokens == 0 {
		claudeRequest.MaxTokens = uint(model_setting.GetClaudeSettings().GetDefaultMaxTokens(textRequest.Model))
	}

	if baseModel, effortLevel, ok := reasoning.TrimEffortSuffix(textRequest.Model); ok && effortLevel != "" &&
		strings.HasPrefix(textRequest.Model, "claude-opus-4-6") {
		claudeRequest.Model = baseModel
		claudeRequest.Thinking = &dto.Thinking{
			Type: "adaptive",
		}
		claudeRequest.OutputConfig = json.RawMessage(fmt.Sprintf(`{"effort":"%s"}`, effortLevel))
		claudeRequest.TopP = 0
		claudeRequest.Temperature = common.GetPointer[float64](1.0)
	} else if model_setting.GetClaudeSettings().ThinkingAdapterEnabled &&
		strings.HasSuffix(textRequest.Model, "-thinking") {

		// 因为BudgetTokens 必须大于1024
		if claudeRequest.MaxTokens < 1280 {
			claudeRequest.MaxTokens = 1280
		}

		// BudgetTokens 为 max_tokens 的 80%
		claudeRequest.Thinking = &dto.Thinking{
			Type:         "enabled",
			BudgetTokens: common.GetPointer[int](int(float64(claudeRequest.MaxTokens) * model_setting.GetClaudeSettings().ThinkingAdapterBudgetTokensPercentage)),
		}
		// TODO: 临时处理
		// https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#important-considerations-when-using-extended-thinking
		claudeRequest.TopP = 0
		claudeRequest.Temperature = common.GetPointer[float64](1.0)
		if !model_setting.ShouldPreserveThinkingSuffix(textRequest.Model) {
			claudeRequest.Model = strings.TrimSuffix(textRequest.Model, "-thinking")
		}
	}

	if textRequest.ReasoningEffort != "" {
		switch textRequest.ReasoningEffort {
		case "low":
			claudeRequest.Thinking = &dto.Thinking{
				Type:         "enabled",
				BudgetTokens: common.GetPointer[int](1280),
			}
		case "medium":
			claudeRequest.Thinking = &dto.Thinking{
				Type:         "enabled",
				BudgetTokens: common.GetPointer[int](2048),
			}
		case "high":
			claudeRequest.Thinking = &dto.Thinking{
				Type:         "enabled",
				BudgetTokens: common.GetPointer[int](4096),
			}
		}
	}

	// 指定了 reasoning 参数,覆盖 budgetTokens
	if textRequest.Reasoning != nil {
		var reasoning openrouter.RequestReasoning
		if err := common.Unmarshal(textRequest.Reasoning, &reasoning); err != nil {
			return nil, err
		}

		budgetTokens := reasoning.MaxTokens
		if budgetTokens > 0 {
			claudeRequest.Thinking = &dto.Thinking{
				Type:         "enabled",
				BudgetTokens: &budgetTokens,
			}
		}
	}

	if textRequest.Stop != nil {
		// stop maybe string/array string, convert to array string
		switch textRequest.Stop.(type) {
		case string:
			claudeRequest.StopSequences = []string{textRequest.Stop.(string)}
		case []interface{}:
			stopSequences := make([]string, 0)
			for _, stop := range textRequest.Stop.([]interface{}) {
				stopSequences = append(stopSequences, stop.(string))
			}
			claudeRequest.StopSequences = stopSequences
		}
	}
	formatMessages := make([]dto.Message, 0)
	lastMessage := dto.Message{
		Role: "tool",
	}
	for i, message := range textRequest.Messages {
		if message.Role == "" {
			textRequest.Messages[i].Role = "user"
		}
		fmtMessage := dto.Message{
			Role:    message.Role,
			Content: message.Content,
		}
		if message.Role == "tool" {
			fmtMessage.ToolCallId = message.ToolCallId
		}
		if message.Role == "assistant" && message.ToolCalls != nil {
			fmtMessage.ToolCalls = message.ToolCalls
		}
		if lastMessage.Role == message.Role && lastMessage.Role != "tool" {
			if lastMessage.IsStringContent() && message.IsStringContent() {
				fmtMessage.SetStringContent(strings.Trim(fmt.Sprintf("%s %s", lastMessage.StringContent(), message.StringContent()), "\""))
				// delete last message
				formatMessages = formatMessages[:len(formatMessages)-1]
			}
		}
		if fmtMessage.Content == nil {
			fmtMessage.SetStringContent("...")
		}
		formatMessages = append(formatMessages, fmtMessage)
		lastMessage = fmtMessage
	}

	claudeMessages := make([]dto.ClaudeMessage, 0)
	isFirstMessage := true
	// 初始化system消息数组，用于累积多个system消息
	var systemMessages []dto.ClaudeMediaMessage

	for _, message := range formatMessages {
		if message.Role == "system" {
			// 根据Claude API规范，system字段使用数组格式更有通用性
			if message.IsStringContent() {
				systemMessages = append(systemMessages, dto.ClaudeMediaMessage{
					Type: "text",
					Text: common.GetPointer[string](message.StringContent()),
				})
			} else {
				// 支持复合内容的system消息（虽然不常见，但需要考虑完整性）
				for _, ctx := range message.ParseContent() {
					if ctx.Type == "text" {
						systemMessages = append(systemMessages, dto.ClaudeMediaMessage{
							Type: "text",
							Text: common.GetPointer[string](ctx.Text),
						})
					}
					// 未来可以在这里扩展对图片等其他类型的支持
				}
			}
		} else {
			if isFirstMessage {
				isFirstMessage = false
				if message.Role != "user" {
					// fix: first message is assistant, add user message
					claudeMessage := dto.ClaudeMessage{
						Role: "user",
						Content: []dto.ClaudeMediaMessage{
							{
								Type: "text",
								Text: common.GetPointer[string]("..."),
							},
						},
					}
					claudeMessages = append(claudeMessages, claudeMessage)
				}
			}
			claudeMessage := dto.ClaudeMessage{
				Role: message.Role,
			}
			if message.Role == "tool" {
				if len(claudeMessages) > 0 && claudeMessages[len(claudeMessages)-1].Role == "user" {
					lastMessage := claudeMessages[len(claudeMessages)-1]
					if content, ok := lastMessage.Content.(string); ok {
						lastMessage.Content = []dto.ClaudeMediaMessage{
							{
								Type: "text",
								Text: common.GetPointer[string](content),
							},
						}
					}
					lastMessage.Content = append(lastMessage.Content.([]dto.ClaudeMediaMessage), dto.ClaudeMediaMessage{
						Type:      "tool_result",
						ToolUseId: message.ToolCallId,
						Content:   message.Content,
					})
					claudeMessages[len(claudeMessages)-1] = lastMessage
					continue
				} else {
					claudeMessage.Role = "user"
					claudeMessage.Content = []dto.ClaudeMediaMessage{
						{
							Type:      "tool_result",
							ToolUseId: message.ToolCallId,
							Content:   message.Content,
						},
					}
				}
			} else if message.IsStringContent() && message.ToolCalls == nil {
				claudeMessage.Content = message.StringContent()
			} else {
				claudeMediaMessages := make([]dto.ClaudeMediaMessage, 0)
				for _, mediaMessage := range message.ParseContent() {
					claudeMediaMessage := dto.ClaudeMediaMessage{
						Type: mediaMessage.Type,
					}
					if mediaMessage.Type == "text" {
						claudeMediaMessage.Text = common.GetPointer[string](mediaMessage.Text)
					} else {
						imageUrl := mediaMessage.GetImageMedia()
						claudeMediaMessage.Type = "image"
						claudeMediaMessage.Source = &dto.ClaudeMessageSource{
							Type: "base64",
						}
						// 使用统一的文件服务获取图片数据
						var source *types.FileSource
						if strings.HasPrefix(imageUrl.Url, "http") {
							source = types.NewURLFileSource(imageUrl.Url)
						} else {
							source = types.NewBase64FileSource(imageUrl.Url, "")
						}
						base64Data, mimeType, err := service.GetBase64Data(c, source, "formatting image for Claude")
						if err != nil {
							return nil, fmt.Errorf("get file data failed: %s", err.Error())
						}
						claudeMediaMessage.Source.MediaType = mimeType
						claudeMediaMessage.Source.Data = base64Data
					}
					claudeMediaMessages = append(claudeMediaMessages, claudeMediaMessage)
				}
				if message.ToolCalls != nil {
					for _, toolCall := range message.ParseToolCalls() {
						inputObj := make(map[string]any)
						if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &inputObj); err != nil {
							common.SysLog("tool call function arguments is not a map[string]any: " + fmt.Sprintf("%v", toolCall.Function.Arguments))
							continue
						}
						claudeMediaMessages = append(claudeMediaMessages, dto.ClaudeMediaMessage{
							Type:  "tool_use",
							Id:    toolCall.ID,
							Name:  toolCall.Function.Name,
							Input: inputObj,
						})
					}
				}
				claudeMessage.Content = claudeMediaMessages
			}
			claudeMessages = append(claudeMessages, claudeMessage)
		}
	}

	// 设置累积的system消息
	if len(systemMessages) > 0 {
		claudeRequest.System = systemMessages
	}

	claudeRequest.Prompt = ""
	claudeRequest.Messages = claudeMessages
	return &claudeRequest, nil
}

func StreamResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.ChatCompletionsStreamResponse {
	var response dto.ChatCompletionsStreamResponse
	response.Object = "chat.completion.chunk"
	response.Model = claudeResponse.Model
	response.Choices = make([]dto.ChatCompletionsStreamResponseChoice, 0)
	tools := make([]dto.ToolCallResponse, 0)
	fcIdx := 0
	if claudeResponse.Index != nil {
		fcIdx = *claudeResponse.Index - 1
		if fcIdx < 0 {
			fcIdx = 0
		}
	}
	var choice dto.ChatCompletionsStreamResponseChoice
	if claudeResponse.Type == "message_start" {
		if claudeResponse.Message != nil {
			response.Id = claudeResponse.Message.Id
			response.Model = claudeResponse.Message.Model
		}
		//claudeUsage = &claudeResponse.Message.Usage
		choice.Delta.SetContentString("")
		choice.Delta.Role = "assistant"
	} else if claudeResponse.Type == "content_block_start" {
		if claudeResponse.ContentBlock != nil {
			// 如果是文本块，尽可能发送首段文本（若存在）
			if claudeResponse.ContentBlock.Type == "text" && claudeResponse.ContentBlock.Text != nil {
				choice.Delta.SetContentString(*claudeResponse.ContentBlock.Text)
			}
			if claudeResponse.ContentBlock.Type == "tool_use" {
				tools = append(tools, dto.ToolCallResponse{
					Index: common.GetPointer(fcIdx),
					ID:    claudeResponse.ContentBlock.Id,
					Type:  "function",
					Function: dto.FunctionResponse{
						Name:      claudeResponse.ContentBlock.Name,
						Arguments: "",
					},
				})
			}
		} else {
			return nil
		}
	} else if claudeResponse.Type == "content_block_delta" {
		if claudeResponse.Delta != nil {
			choice.Delta.Content = claudeResponse.Delta.Text
			switch claudeResponse.Delta.Type {
			case "input_json_delta":
				tools = append(tools, dto.ToolCallResponse{
					Type:  "function",
					Index: common.GetPointer(fcIdx),
					Function: dto.FunctionResponse{
						Arguments: *claudeResponse.Delta.PartialJson,
					},
				})
			case "signature_delta":
				// 加密的不处理
				signatureContent := "\n"
				choice.Delta.ReasoningContent = &signatureContent
			case "thinking_delta":
				choice.Delta.ReasoningContent = claudeResponse.Delta.Thinking
			}
		}
	} else if claudeResponse.Type == "message_delta" {
		if claudeResponse.Delta != nil && claudeResponse.Delta.StopReason != nil {
			finishReason := stopReasonClaude2OpenAI(*claudeResponse.Delta.StopReason)
			if finishReason != "null" {
				choice.FinishReason = &finishReason
			}
		}
		//claudeUsage = &claudeResponse.Usage
	} else if claudeResponse.Type == "message_stop" {
		return nil
	} else {
		return nil
	}
	if len(tools) > 0 {
		choice.Delta.Content = nil // compatible with other OpenAI derivative applications, like LobeOpenAICompatibleFactory ...
		choice.Delta.ToolCalls = tools
	}
	response.Choices = append(response.Choices, choice)

	return &response
}

func ResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.OpenAITextResponse {
	choices := make([]dto.OpenAITextResponseChoice, 0)
	fullTextResponse := dto.OpenAITextResponse{
		Id:      fmt.Sprintf("chatcmpl-%s", common.GetUUID()),
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
	}
	var responseText string
	var responseThinking string
	if len(claudeResponse.Content) > 0 {
		responseText = claudeResponse.Content[0].GetText()
		if claudeResponse.Content[0].Thinking != nil {
			responseThinking = *claudeResponse.Content[0].Thinking
		}
	}
	tools := make([]dto.ToolCallResponse, 0)
	thinkingContent := ""

	fullTextResponse.Id = claudeResponse.Id
	for _, message := range claudeResponse.Content {
		switch message.Type {
		case "tool_use":
			args, _ := json.Marshal(message.Input)
			tools = append(tools, dto.ToolCallResponse{
				ID:   message.Id,
				Type: "function", // compatible with other OpenAI derivative applications
				Function: dto.FunctionResponse{
					Name:      message.Name,
					Arguments: string(args),
				},
			})
		case "thinking":
			// 加密的不管， 只输出明文的推理过程
			if message.Thinking != nil {
				thinkingContent = *message.Thinking
			}
		case "text":
			responseText = message.GetText()
		}
	}
	choice := dto.OpenAITextResponseChoice{
		Index: 0,
		Message: dto.Message{
			Role: "assistant",
		},
		FinishReason: stopReasonClaude2OpenAI(claudeResponse.StopReason),
	}
	choice.SetStringContent(responseText)
	if len(responseThinking) > 0 {
		choice.ReasoningContent = responseThinking
	}
	if len(tools) > 0 {
		choice.Message.SetToolCalls(tools)
	}
	choice.Message.ReasoningContent = thinkingContent
	fullTextResponse.Model = claudeResponse.Model
	choices = append(choices, choice)
	fullTextResponse.Choices = choices
	return &fullTextResponse
}

type ClaudeResponseInfo struct {
	ResponseId   string
	Created      int64
	Model        string
	ResponseText strings.Builder
	Usage        *dto.Usage
	Done         bool
}

func buildMessageDeltaPatchUsage(claudeResponse *dto.ClaudeResponse, claudeInfo *ClaudeResponseInfo) *dto.ClaudeUsage {
	usage := &dto.ClaudeUsage{}
	if claudeResponse != nil && claudeResponse.Usage != nil {
		*usage = *claudeResponse.Usage
	}

	if claudeInfo == nil || claudeInfo.Usage == nil {
		return usage
	}

	if usage.InputTokens == 0 && claudeInfo.Usage.PromptTokens > 0 {
		usage.InputTokens = claudeInfo.Usage.PromptTokens
	}
	if usage.CacheReadInputTokens == 0 && claudeInfo.Usage.PromptTokensDetails.CachedTokens > 0 {
		usage.CacheReadInputTokens = claudeInfo.Usage.PromptTokensDetails.CachedTokens
	}
	if usage.CacheCreationInputTokens == 0 && claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens > 0 {
		usage.CacheCreationInputTokens = claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens
	}
	if usage.CacheCreation == nil && (claudeInfo.Usage.ClaudeCacheCreation5mTokens > 0 || claudeInfo.Usage.ClaudeCacheCreation1hTokens > 0) {
		usage.CacheCreation = &dto.ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: claudeInfo.Usage.ClaudeCacheCreation5mTokens,
			Ephemeral1hInputTokens: claudeInfo.Usage.ClaudeCacheCreation1hTokens,
		}
	}
	return usage
}

func shouldSkipClaudeMessageDeltaUsagePatch(info *relaycommon.RelayInfo) bool {
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled {
		return true
	}
	if info == nil {
		return false
	}
	return info.ChannelSetting.PassThroughBodyEnabled
}

func patchClaudeMessageDeltaUsageData(data string, usage *dto.ClaudeUsage) string {
	if data == "" || usage == nil {
		return data
	}

	data = setMessageDeltaUsageInt(data, "usage.input_tokens", usage.InputTokens)
	data = setMessageDeltaUsageInt(data, "usage.cache_read_input_tokens", usage.CacheReadInputTokens)
	data = setMessageDeltaUsageInt(data, "usage.cache_creation_input_tokens", usage.CacheCreationInputTokens)

	if usage.CacheCreation != nil {
		data = setMessageDeltaUsageInt(data, "usage.cache_creation.ephemeral_5m_input_tokens", usage.CacheCreation.Ephemeral5mInputTokens)
		data = setMessageDeltaUsageInt(data, "usage.cache_creation.ephemeral_1h_input_tokens", usage.CacheCreation.Ephemeral1hInputTokens)
	}

	return data
}

func setMessageDeltaUsageInt(data string, path string, localValue int) string {
	if localValue <= 0 {
		return data
	}

	upstreamValue := gjson.Get(data, path)
	if upstreamValue.Exists() && upstreamValue.Int() > 0 {
		return data
	}

	patchedData, err := sjson.Set(data, path, localValue)
	if err != nil {
		return data
	}
	return patchedData
}

func FormatClaudeResponseInfo(claudeResponse *dto.ClaudeResponse, oaiResponse *dto.ChatCompletionsStreamResponse, claudeInfo *ClaudeResponseInfo) bool {
	if claudeInfo == nil {
		return false
	}
	if claudeInfo.Usage == nil {
		claudeInfo.Usage = &dto.Usage{}
	}
	if claudeResponse.Type == "message_start" {
		if claudeResponse.Message != nil {
			claudeInfo.ResponseId = claudeResponse.Message.Id
			claudeInfo.Model = claudeResponse.Message.Model
		}

		// message_start, 获取usage
		if claudeResponse.Message != nil && claudeResponse.Message.Usage != nil {
			claudeInfo.Usage.PromptTokens = claudeResponse.Message.Usage.InputTokens
			claudeInfo.Usage.PromptTokensDetails.CachedTokens = claudeResponse.Message.Usage.CacheReadInputTokens
			claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Message.Usage.CacheCreationInputTokens
			claudeInfo.Usage.ClaudeCacheCreation5mTokens = claudeResponse.Message.Usage.GetCacheCreation5mTokens()
			claudeInfo.Usage.ClaudeCacheCreation1hTokens = claudeResponse.Message.Usage.GetCacheCreation1hTokens()
			claudeInfo.Usage.CompletionTokens = claudeResponse.Message.Usage.OutputTokens
		}
	} else if claudeResponse.Type == "content_block_delta" {
		if claudeResponse.Delta != nil {
			if claudeResponse.Delta.Text != nil {
				claudeInfo.ResponseText.WriteString(*claudeResponse.Delta.Text)
			}
			if claudeResponse.Delta.Thinking != nil {
				claudeInfo.ResponseText.WriteString(*claudeResponse.Delta.Thinking)
			}
		}
	} else if claudeResponse.Type == "message_delta" {
		// 最终的usage获取
		if claudeResponse.Usage != nil {
			if claudeResponse.Usage.InputTokens > 0 {
				// 不叠加，只取最新的
				claudeInfo.Usage.PromptTokens = claudeResponse.Usage.InputTokens
			}
			if claudeResponse.Usage.CacheReadInputTokens > 0 {
				claudeInfo.Usage.PromptTokensDetails.CachedTokens = claudeResponse.Usage.CacheReadInputTokens
			}
			if claudeResponse.Usage.CacheCreationInputTokens > 0 {
				claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Usage.CacheCreationInputTokens
			}
			if cacheCreation5m := claudeResponse.Usage.GetCacheCreation5mTokens(); cacheCreation5m > 0 {
				claudeInfo.Usage.ClaudeCacheCreation5mTokens = cacheCreation5m
			}
			if cacheCreation1h := claudeResponse.Usage.GetCacheCreation1hTokens(); cacheCreation1h > 0 {
				claudeInfo.Usage.ClaudeCacheCreation1hTokens = cacheCreation1h
			}
			if claudeResponse.Usage.OutputTokens > 0 {
				claudeInfo.Usage.CompletionTokens = claudeResponse.Usage.OutputTokens
			}
			claudeInfo.Usage.TotalTokens = claudeInfo.Usage.PromptTokens + claudeInfo.Usage.CompletionTokens
		}

		// 判断是否完整
		claudeInfo.Done = true
	} else if claudeResponse.Type == "content_block_start" {
	} else {
		return false
	}
	if oaiResponse != nil {
		oaiResponse.Id = claudeInfo.ResponseId
		oaiResponse.Created = claudeInfo.Created
		oaiResponse.Model = claudeInfo.Model
	}
	return true
}

func HandleStreamResponseData(c *gin.Context, info *relaycommon.RelayInfo, claudeInfo *ClaudeResponseInfo, data string) *types.NewAPIError {
	var claudeResponse dto.ClaudeResponse
	err := common.UnmarshalJsonStr(data, &claudeResponse)
	if err != nil {
		common.SysLog("error unmarshalling stream response: " + err.Error())
		return types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
		return types.WithClaudeError(*claudeError, http.StatusInternalServerError)
	}
	if claudeResponse.StopReason != "" {
		maybeMarkClaudeRefusal(c, claudeResponse.StopReason)
	}
	if claudeResponse.Delta != nil && claudeResponse.Delta.StopReason != nil {
		maybeMarkClaudeRefusal(c, *claudeResponse.Delta.StopReason)
	}
	if info.RelayFormat == types.RelayFormatClaude {
		FormatClaudeResponseInfo(&claudeResponse, nil, claudeInfo)

		if claudeResponse.Type == "message_start" {
			// message_start, 获取usage
			if claudeResponse.Message != nil {
				info.UpstreamModelName = claudeResponse.Message.Model
			}
		} else if claudeResponse.Type == "message_delta" {
			// 确保 message_delta 的 usage 包含完整的 input_tokens 和 cache 相关字段
			// 解决 AWS Bedrock 等上游返回的 message_delta 缺少这些字段的问题
			if !shouldSkipClaudeMessageDeltaUsagePatch(info) {
				data = patchClaudeMessageDeltaUsageData(data, buildMessageDeltaPatchUsage(&claudeResponse, claudeInfo))
			}
		}
		helper.ClaudeChunkData(c, claudeResponse, data)
	} else if info.RelayFormat == types.RelayFormatOpenAI {
		response := StreamResponseClaude2OpenAI(&claudeResponse)

		if !FormatClaudeResponseInfo(&claudeResponse, response, claudeInfo) {
			return nil
		}

		err = helper.ObjectData(c, response)
		if err != nil {
			logger.LogError(c, "send_stream_response_failed: "+err.Error())
		}
	}
	return nil
}

func HandleStreamFinalResponse(c *gin.Context, info *relaycommon.RelayInfo, claudeInfo *ClaudeResponseInfo) {
	if claudeInfo.Usage.PromptTokens == 0 {
		//上游出错
	}
	if claudeInfo.Usage.CompletionTokens == 0 || !claudeInfo.Done {
		if common.DebugEnabled {
			common.SysLog("claude response usage is not complete, maybe upstream error")
		}
		claudeInfo.Usage = service.ResponseText2Usage(c, claudeInfo.ResponseText.String(), info.UpstreamModelName, claudeInfo.Usage.PromptTokens)
	}

	if info.RelayFormat == types.RelayFormatClaude {
		//
	} else if info.RelayFormat == types.RelayFormatOpenAI {
		if info.ShouldIncludeUsage {
			response := helper.GenerateFinalUsageResponse(claudeInfo.ResponseId, claudeInfo.Created, info.UpstreamModelName, *claudeInfo.Usage)
			err := helper.ObjectData(c, response)
			if err != nil {
				common.SysLog("send final response failed: " + err.Error())
			}
		}
		helper.Done(c)
	}
}

func ClaudeStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	claudeInfo := &ClaudeResponseInfo{
		ResponseId:   helper.GetResponseID(c),
		Created:      common.GetTimestamp(),
		Model:        info.UpstreamModelName,
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}
	var err *types.NewAPIError
	helper.StreamScannerHandler(c, resp, info, func(data string) bool {
		err = HandleStreamResponseData(c, info, claudeInfo, data)
		if err != nil {
			return false
		}
		return true
	})
	if err != nil {
		return nil, err
	}

	HandleStreamFinalResponse(c, info, claudeInfo)
	return claudeInfo.Usage, nil
}

func HandleClaudeResponseData(c *gin.Context, info *relaycommon.RelayInfo, claudeInfo *ClaudeResponseInfo, httpResp *http.Response, data []byte) *types.NewAPIError {
	var claudeResponse dto.ClaudeResponse
	err := common.Unmarshal(data, &claudeResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
		return types.WithClaudeError(*claudeError, http.StatusInternalServerError)
	}
	maybeMarkClaudeRefusal(c, claudeResponse.StopReason)
	if claudeInfo.Usage == nil {
		claudeInfo.Usage = &dto.Usage{}
	}
	if claudeResponse.Usage != nil {
		claudeInfo.Usage.PromptTokens = claudeResponse.Usage.InputTokens
		claudeInfo.Usage.CompletionTokens = claudeResponse.Usage.OutputTokens
		claudeInfo.Usage.TotalTokens = claudeResponse.Usage.InputTokens + claudeResponse.Usage.OutputTokens
		claudeInfo.Usage.PromptTokensDetails.CachedTokens = claudeResponse.Usage.CacheReadInputTokens
		claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Usage.CacheCreationInputTokens
		claudeInfo.Usage.ClaudeCacheCreation5mTokens = claudeResponse.Usage.GetCacheCreation5mTokens()
		claudeInfo.Usage.ClaudeCacheCreation1hTokens = claudeResponse.Usage.GetCacheCreation1hTokens()
	}
	var responseData []byte
	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		openaiResponse := ResponseClaude2OpenAI(&claudeResponse)
		openaiResponse.Usage = *claudeInfo.Usage
		responseData, err = json.Marshal(openaiResponse)
		if err != nil {
			return types.NewError(err, types.ErrorCodeBadResponseBody)
		}
	case types.RelayFormatClaude:
		responseData = data
	}

	if claudeResponse.Usage != nil && claudeResponse.Usage.ServerToolUse != nil && claudeResponse.Usage.ServerToolUse.WebSearchRequests > 0 {
		c.Set("claude_web_search_requests", claudeResponse.Usage.ServerToolUse.WebSearchRequests)
	}

	service.IOCopyBytesGracefully(c, httpResp, responseData)
	return nil
}

func ClaudeHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	claudeInfo := &ClaudeResponseInfo{
		ResponseId:   helper.GetResponseID(c),
		Created:      common.GetTimestamp(),
		Model:        info.UpstreamModelName,
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if common.DebugEnabled {
		println("responseBody: ", string(responseBody))
	}
	handleErr := HandleClaudeResponseData(c, info, claudeInfo, resp, responseBody)
	if handleErr != nil {
		return nil, handleErr
	}
	return claudeInfo.Usage, nil
}

func mapToolChoice(toolChoice any, parallelToolCalls *bool) *dto.ClaudeToolChoice {
	var claudeToolChoice *dto.ClaudeToolChoice

	// 处理 tool_choice 字符串值
	if toolChoiceStr, ok := toolChoice.(string); ok {
		switch toolChoiceStr {
		case "auto":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "auto",
			}
		case "required":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "any",
			}
		case "none":
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "none",
			}
		}
	} else if toolChoiceMap, ok := toolChoice.(map[string]interface{}); ok {
		// 处理 tool_choice 对象值
		if function, ok := toolChoiceMap["function"].(map[string]interface{}); ok {
			if toolName, ok := function["name"].(string); ok {
				claudeToolChoice = &dto.ClaudeToolChoice{
					Type: "tool",
					Name: toolName,
				}
			}
		}
	}

	// 处理 parallel_tool_calls
	if parallelToolCalls != nil {
		if claudeToolChoice == nil {
			// 如果没有 tool_choice，但有 parallel_tool_calls，创建默认的 auto 类型
			claudeToolChoice = &dto.ClaudeToolChoice{
				Type: "auto",
			}
		}

		// Anthropic schema: tool_choice.type=none does not accept extra fields.
		// When tools are disabled, parallel_tool_calls is irrelevant, so we drop it.
		if claudeToolChoice.Type != "none" {
			// 如果 parallel_tool_calls 为 true，则 disable_parallel_tool_use 为 false
			claudeToolChoice.DisableParallelToolUse = !*parallelToolCalls
		}
	}

	return claudeToolChoice
}

// RequestOpenAIResponses2ClaudeMessage converts an OpenAI Responses API request into a
// Claude Messages API request. It maps model, max tokens, temperature, top-p, streaming,
// reasoning/thinking parameters, tools, system instructions, input messages (including
// function_call and function_call_output items), and tool-choice settings.
func RequestOpenAIResponses2ClaudeMessage(c *gin.Context, responsesReq dto.OpenAIResponsesRequest) (*dto.ClaudeRequest, error) {
	claudeRequest := dto.ClaudeRequest{
		Model: responsesReq.Model,
	}

	// MaxTokens
	if responsesReq.MaxOutputTokens > 0 {
		claudeRequest.MaxTokens = responsesReq.MaxOutputTokens
	} else {
		claudeRequest.MaxTokens = uint(model_setting.GetClaudeSettings().GetDefaultMaxTokens(responsesReq.Model))
	}

	if responsesReq.Temperature != nil {
		claudeRequest.Temperature = responsesReq.Temperature
	}

	if responsesReq.TopP != nil {
		claudeRequest.TopP = *responsesReq.TopP
	}

	if responsesReq.Stream {
		claudeRequest.Stream = true
	}

	// Reasoning / Extended Thinking
	if model_setting.GetClaudeSettings().ThinkingAdapterEnabled &&
		strings.HasSuffix(responsesReq.Model, "-thinking") {
		if claudeRequest.MaxTokens < 1280 {
			claudeRequest.MaxTokens = 1280
		}
		claudeRequest.Thinking = &dto.Thinking{
			Type:         "enabled",
			BudgetTokens: common.GetPointer[int](int(float64(claudeRequest.MaxTokens) * model_setting.GetClaudeSettings().ThinkingAdapterBudgetTokensPercentage)),
		}
		claudeRequest.TopP = 0
		claudeRequest.Temperature = common.GetPointer[float64](1.0)
		if !model_setting.ShouldPreserveThinkingSuffix(responsesReq.Model) {
			claudeRequest.Model = strings.TrimSuffix(responsesReq.Model, "-thinking")
		}
	}

	if responsesReq.Reasoning != nil && responsesReq.Reasoning.Effort != "" {
		if strings.HasPrefix(responsesReq.Model, "claude-opus-4-6") {
			claudeRequest.Thinking = &dto.Thinking{
				Type: "adaptive",
			}
			claudeRequest.OutputConfig = json.RawMessage(fmt.Sprintf(`{"effort":"%s"}`, responsesReq.Reasoning.Effort))
			claudeRequest.TopP = 0
			claudeRequest.Temperature = common.GetPointer[float64](1.0)
		} else {
			switch responsesReq.Reasoning.Effort {
			case "low":
				claudeRequest.Thinking = &dto.Thinking{
					Type:         "enabled",
					BudgetTokens: common.GetPointer[int](1280),
				}
			case "medium":
				claudeRequest.Thinking = &dto.Thinking{
					Type:         "enabled",
					BudgetTokens: common.GetPointer[int](2048),
				}
			case "high":
				claudeRequest.Thinking = &dto.Thinking{
					Type:         "enabled",
					BudgetTokens: common.GetPointer[int](4096),
				}
			}
		}
	}

	// Tools
	if responsesReq.Tools != nil {
		var tools []map[string]any
		if err := common.Unmarshal(responsesReq.Tools, &tools); err == nil {
			claudeTools := make([]any, 0, len(tools))
			for _, tool := range tools {
				if tType, ok := tool["type"].(string); ok && tType == "function" {
					description := ""
					if d, ok := tool["description"]; ok {
						description = common.Interface2String(d)
					}
					
					claudeTool := dto.Tool{
						Name:        common.Interface2String(tool["name"]),
						Description: description,
					}
					if params, ok := tool["parameters"].(map[string]any); ok {
						claudeTool.InputSchema = make(map[string]interface{})
						if pType, ok := params["type"].(string); ok {
							claudeTool.InputSchema["type"] = pType
						}
						
						if props, ok := params["properties"]; ok {
							claudeTool.InputSchema["properties"] = props
						}
						
						if req, ok := params["required"]; ok {
							claudeTool.InputSchema["required"] = req
						}
						
						for s, a := range params {
							if s == "type" || s == "properties" || s == "required" {
								continue
							}
							claudeTool.InputSchema[s] = a
						}
					}
					claudeTools = append(claudeTools, &claudeTool)
				}
			}
			if len(claudeTools) > 0 {
				claudeRequest.Tools = claudeTools
			}
		}
	}

	// System Prompt (Instructions)
	if responsesReq.Instructions != nil {
		var instructions string
		if err := common.Unmarshal(responsesReq.Instructions, &instructions); err == nil && instructions != "" {
			claudeRequest.System = []dto.ClaudeMediaMessage{
				{
					Type: "text",
					Text: &instructions,
				},
			}
		}
	}

	// Messages (Input)
	if responsesReq.Input != nil {
		var inputItems []map[string]any
		if err := common.Unmarshal(responsesReq.Input, &inputItems); err == nil {
			claudeMessages := make([]dto.ClaudeMessage, 0)
			
			for _, item := range inputItems {
				itemType, _ := item["type"].(string)
				
				if itemType == "function_call" {
					callID := common.Interface2String(item["call_id"])
					name := common.Interface2String(item["name"])
					args := common.Interface2String(item["arguments"])
					
					var argsMap map[string]any
					if err := json.Unmarshal([]byte(args), &argsMap); err != nil {
						argsMap = make(map[string]any)
					}

					toolUseBlock := dto.ClaudeMediaMessage{
						Type: "tool_use",
						Id: callID,
						Name: name,
						Input: argsMap,
					}

					if len(claudeMessages) > 0 {
						lastMsg := &claudeMessages[len(claudeMessages)-1]
						if lastMsg.Role == "assistant" {
							if contentList, ok := lastMsg.Content.([]dto.ClaudeMediaMessage); ok {
								lastMsg.Content = append(contentList, toolUseBlock)
							} else if contentStr, ok := lastMsg.Content.(string); ok {
								if contentStr == "" {
									lastMsg.Content = []dto.ClaudeMediaMessage{toolUseBlock}
								} else {
									lastMsg.Content = []dto.ClaudeMediaMessage{
										{Type: "text", Text: &contentStr},
										toolUseBlock,
									}
								}
							}
							claudeMessages[len(claudeMessages)-1] = *lastMsg
						} else {
							claudeMessages = append(claudeMessages, dto.ClaudeMessage{
								Role: "assistant",
								Content: []dto.ClaudeMediaMessage{toolUseBlock},
							})
						}
					} else {
						claudeMessages = append(claudeMessages, dto.ClaudeMessage{
							Role: "assistant",
							Content: []dto.ClaudeMediaMessage{toolUseBlock},
						})
					}
				} else if itemType == "function_call_output" {
					callID := common.Interface2String(item["call_id"])
					output := common.Interface2String(item["output"])

					toolResultBlock := dto.ClaudeMediaMessage{
						Type: "tool_result",
						ToolUseId: callID,
						Content: output,
					}
					
					if len(claudeMessages) > 0 {
						lastMsg := &claudeMessages[len(claudeMessages)-1]
						if lastMsg.Role == "user" {
							if contentList, ok := lastMsg.Content.([]dto.ClaudeMediaMessage); ok {
								lastMsg.Content = append(contentList, toolResultBlock)
							} else if contentStr, ok := lastMsg.Content.(string); ok {
								if contentStr == "" {
									lastMsg.Content = []dto.ClaudeMediaMessage{toolResultBlock}
								} else {
									lastMsg.Content = []dto.ClaudeMediaMessage{
										{Type: "text", Text: &contentStr},
										toolResultBlock,
									}
								}
							}
							claudeMessages[len(claudeMessages)-1] = *lastMsg
						} else {
							claudeMessages = append(claudeMessages, dto.ClaudeMessage{
								Role: "user",
								Content: []dto.ClaudeMediaMessage{toolResultBlock},
							})
						}
					} else {
						claudeMessages = append(claudeMessages, dto.ClaudeMessage{
							Role: "user",
							Content: []dto.ClaudeMediaMessage{toolResultBlock},
						})
					}

				} else {
					role := common.Interface2String(item["role"])
					content := item["content"]

					if role == "" {
						continue
					}

					var contentStr string
					if s, ok := content.(string); ok {
						contentStr = s
					} else {
						contentStr = common.Interface2String(content)
					}

					if role == "system" {
						var systemMsgs []dto.ClaudeMediaMessage
						if claudeRequest.System != nil {
							if msgs, ok := claudeRequest.System.([]dto.ClaudeMediaMessage); ok {
								systemMsgs = msgs
							}
						}
						systemMsgs = append(systemMsgs, dto.ClaudeMediaMessage{
							Type: "text",
							Text: &contentStr,
						})
						claudeRequest.System = systemMsgs
						continue
					}

					newMsg := dto.ClaudeMessage{
						Role:    role,
						Content: contentStr,
					}

					claudeMessages = append(claudeMessages, newMsg)
				}
			}
			if len(claudeMessages) == 0 || claudeMessages[0].Role != "user" {
				claudeMessages = append([]dto.ClaudeMessage{{
					Role:    "user",
					Content: "...",
				}}, claudeMessages...)
			}
			claudeRequest.Messages = claudeMessages
		} else {
			inputStr := common.Interface2String(responsesReq.Input)
			if inputStr != "" {
				claudeRequest.Messages = []dto.ClaudeMessage{
					{
						Role:    "user",
						Content: inputStr,
					},
				}
			}
		}
	}

	// Tool Choice
	if responsesReq.ToolChoice != nil {
		var toolChoice any
		if err := common.Unmarshal(responsesReq.ToolChoice, &toolChoice); err == nil {
			var parallel *bool
			if responsesReq.ParallelToolCalls != nil {
				var p bool
				if err := common.Unmarshal(responsesReq.ParallelToolCalls, &p); err == nil {
					parallel = &p
				}
			}
			claudeRequest.ToolChoice = mapToolChoice(toolChoice, parallel)
		}
	}

	return &claudeRequest, nil
}

// DoResponsesRequest sends the prepared request body to the upstream Claude API and handles
// the response. For SSE (text/event-stream) responses it streams events directly to the
// client; for non-streaming JSON responses it reads the full body, converts it from Claude
// format to OpenAI Responses format via ResponseClaude2OpenAIResponses, and returns the
// rewritten http.Response.
func DoResponsesRequest(a *Adaptor, c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	resp, err := channel.DoApiRequest(a, c, info, requestBody)
	if err != nil {
		return nil, err
	}

	if resp == nil {
		return nil, nil
	}
	
	if resp.StatusCode != http.StatusOK {
		return resp, nil
	}

	// Detect SSE streaming response from Claude
	contentType := resp.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "text/event-stream") {
		// Stream SSE events directly to the client
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.WriteHeaderNow()

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			fmt.Fprintf(c.Writer, "%s\n", line)
			if f, ok := c.Writer.(http.Flusher); ok {
				f.Flush()
			}
			if line == "data: [DONE]" {
				break
			}
		}
		resp.Body.Close()
		return nil, nil
	}

	// Non-streaming: read entire body and convert
	responseBody, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}

	var claudeResponse dto.ClaudeResponse
	if err := json.Unmarshal(responseBody, &claudeResponse); err != nil {
		// If unmarshal fails, restore body and return original response
		resp.Body = io.NopCloser(bytes.NewBuffer(responseBody))
		return resp, nil
	}

	openaiResponsesResp := ResponseClaude2OpenAIResponses(&claudeResponse)

	jsonResp, err := json.Marshal(openaiResponsesResp)
	if err != nil {
		resp.Body = io.NopCloser(bytes.NewBuffer(responseBody))
		return resp, nil
	}

	resp.Body = io.NopCloser(bytes.NewBuffer(jsonResp))
	resp.ContentLength = int64(len(jsonResp))
	resp.Header.Set("Content-Type", "application/json")

	return resp, nil
}

func makeOutputID(baseID string, index int) string {
	return fmt.Sprintf("%s_output_%d", baseID, index)
}

// ResponseClaude2OpenAIResponses converts a non-streaming Claude Messages API response
// into an OpenAI Responses API response. It maps text, thinking, and tool_use content
// blocks into the corresponding ResponsesOutput items, aggregates usage, and sets the
// overall response status to "completed".
func ResponseClaude2OpenAIResponses(claudeResponse *dto.ClaudeResponse) *dto.OpenAIResponsesResponse {
	response := &dto.OpenAIResponsesResponse{
		ID:        claudeResponse.Id,
		Object:    "response", 
		CreatedAt: int(common.GetTimestamp()),
		Model:     claudeResponse.Model,
		Status:    "completed",
	}

	if claudeResponse.Usage != nil {
		response.Usage = &dto.Usage{
			PromptTokens:     claudeResponse.Usage.InputTokens,
			CompletionTokens: claudeResponse.Usage.OutputTokens,
			TotalTokens:      claudeResponse.Usage.InputTokens + claudeResponse.Usage.OutputTokens,
		}
	}

	var outputList []dto.ResponsesOutput
	var currentTextContent []dto.ResponsesOutputContent
	outputIdx := 0

	for _, content := range claudeResponse.Content {
		switch content.Type {
		case "text":
			if text := content.GetText(); text != "" {
				currentTextContent = append(currentTextContent, dto.ResponsesOutputContent{
					Type: "text",
					Text: text,
				})
			}
		case "thinking":
			var thinkingText string
			if content.Thinking != nil {
				thinkingText = *content.Thinking
			}
			if thinkingText == "" {
				thinkingText = content.GetText()
			}
			if thinkingText != "" {
				common.SysLog("Claude thinking block received")
				currentTextContent = append(currentTextContent, dto.ResponsesOutputContent{
					Type: "thinking",
					Text: thinkingText,
				})
			}
		case "tool_use":
			// If we have accumulated text, flush it to a message output
			if len(currentTextContent) > 0 {
				outputList = append(outputList, dto.ResponsesOutput{
					ID:      makeOutputID(claudeResponse.Id, outputIdx),
					Type:    "message",
					Role:    "assistant",
					Content: currentTextContent,
				})
				outputIdx++
				currentTextContent = nil
			}

			arguments := "{}"
			if content.Input != nil {
				if inputJson, err := json.Marshal(content.Input); err == nil && string(inputJson) != "null" {
					arguments = string(inputJson)
				}
			}

			outputList = append(outputList, dto.ResponsesOutput{
				ID:        makeOutputID(claudeResponse.Id, outputIdx),
				Type:      "function_call",
				Status:    "completed",
				CallId:    content.Id,
				Name:      content.Name,
				Arguments: arguments,
			})
			outputIdx++
		}
	}

	// Flush remaining text
	if len(currentTextContent) > 0 {
		outputList = append(outputList, dto.ResponsesOutput{
			ID:      makeOutputID(claudeResponse.Id, outputIdx),
			Type:    "message",
			Role:    "assistant",
			Content: currentTextContent,
		})
		outputIdx++
	}

	if len(outputList) == 0 {
		outputList = append(outputList, dto.ResponsesOutput{
			ID:      makeOutputID(claudeResponse.Id, outputIdx),
			Type:    "message",
			Role:    "assistant",
			Content: []dto.ResponsesOutputContent{},
		})
	}

	response.Output = outputList

	return response
}