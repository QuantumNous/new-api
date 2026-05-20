package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/samber/lo"
)

// ClaudeToResponsesRequest 将 Anthropic-compatible 请求直接转换为 OpenAI Responses 请求。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：绕开 Claude -> Chat -> Responses 中间层，保留更稳定的 system/input 形态并同步注入 prompt_cache_key。
// 参数说明：claudeRequest 为原始 Claude 请求；info 为当前 relay 上下文，预留给后续渠道差异处理。
// 返回值说明：返回转换后的 OpenAIResponsesRequest；输入结构无法转换时返回错误。
func ClaudeToResponsesRequest(claudeRequest dto.ClaudeRequest, info *relaycommon.RelayInfo) (*dto.OpenAIResponsesRequest, error) {
	_ = info
	inputItems, err := buildClaudeResponsesInputItems(claudeRequest)
	if err != nil {
		return nil, err
	}
	inputRaw, err := common.Marshal(inputItems)
	if err != nil {
		return nil, err
	}

	out := &dto.OpenAIResponsesRequest{
		Model:       claudeRequest.Model,
		Input:       inputRaw,
		Stream:      claudeRequest.Stream,
		Temperature: claudeRequest.Temperature,
		ServiceTier: claudeRequest.ServiceTier,
	}
	if claudeRequest.TopP != nil {
		out.TopP = common.GetPointer(lo.FromPtr(claudeRequest.TopP))
	}
	if claudeRequest.MaxTokens != nil {
		out.MaxOutputTokens = common.GetPointer(lo.FromPtr(claudeRequest.MaxTokens))
	} else if claudeRequest.MaxTokensToSample != nil {
		out.MaxOutputTokens = common.GetPointer(lo.FromPtr(claudeRequest.MaxTokensToSample))
	}
	if cacheKey := buildClaudeResponsesPromptCacheKey(&claudeRequest); cacheKey.OK {
		out.PromptCacheKey, _ = common.Marshal(cacheKey.Key)
	}
	if toolsRaw, err := claudeResponsesToolsRaw(claudeRequest.Tools); err != nil {
		return nil, err
	} else if len(toolsRaw) > 0 {
		out.Tools = toolsRaw
	}
	if toolChoiceRaw, err := claudeResponsesToolChoiceRaw(claudeRequest.ToolChoice); err != nil {
		return nil, err
	} else if len(toolChoiceRaw) > 0 {
		out.ToolChoice = toolChoiceRaw
	}
	if effort := mapClaudeResponsesReasoningEffort(claudeRequest.GetEfforts()); effort != "" {
		out.Reasoning = &dto.Reasoning{Effort: effort, Summary: "auto"}
	}
	return out, nil
}

// buildClaudeResponsesPromptCacheKey 构建 Responses 上游实际使用的 prompt_cache_key。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：优先使用 cache_control 稳定前缀派生 key，避免 metadata.user_id 按会话变化时打散上游 prompt cache。
// 参数说明：req 为 Claude 请求，可为空。
// 返回值说明：返回可用于 Responses 的 cache key；没有缓存信号时 OK 为 false。
func buildClaudeResponsesPromptCacheKey(req *dto.ClaudeRequest) ClaudePromptCacheKeyResult {
	if req == nil {
		return ClaudePromptCacheKeyResult{}
	}
	withoutMetadata := *req
	withoutMetadata.Metadata = nil
	if cacheKey := BuildClaudePromptCacheKey(&withoutMetadata); cacheKey.OK {
		return cacheKey
	}
	return BuildClaudePromptCacheKey(req)
}

// buildClaudeResponsesInputItems 构造 Responses input 数组。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：将 Claude system 放入 developer message，并将 Claude messages 直接映射为 Responses input items。
// 参数说明：req 为 Claude 请求。
// 返回值说明：返回可 JSON 序列化的 Responses input items；内容块无法解析时返回错误。
func buildClaudeResponsesInputItems(req dto.ClaudeRequest) ([]map[string]any, error) {
	items := make([]map[string]any, 0, len(req.Messages)+1)
	if systemParts := claudeSystemToResponsesContentParts(req.System); len(systemParts) > 0 {
		items = append(items, map[string]any{
			"type":    "message",
			"role":    "developer",
			"content": systemParts,
		})
	}
	for _, message := range req.Messages {
		messageItems, err := claudeMessageToResponsesInputItems(message)
		if err != nil {
			return nil, err
		}
		items = append(items, messageItems...)
	}
	return items, nil
}

// claudeSystemToResponsesContentParts 将 Claude system 转换为 Responses developer content parts。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：保留稳定 system 前缀，同时过滤 Claude Code 动态 billing header。
// 参数说明：system 为 ClaudeRequest.System，可能是字符串或 text block 数组。
// 返回值说明：返回 Responses content parts；没有有效 system 时返回空切片。
func claudeSystemToResponsesContentParts(system any) []map[string]any {
	if system == nil {
		return nil
	}
	if systemText, ok := system.(string); ok {
		systemText = strings.TrimSpace(systemText)
		if systemText == "" || isClaudeCodeBillingHeaderText(systemText) {
			return nil
		}
		return []map[string]any{{"type": "input_text", "text": systemText}}
	}
	blocks, ok := claudePromptCacheMediaBlocks(system)
	if !ok {
		return nil
	}
	parts := make([]map[string]any, 0, len(blocks))
	for _, block := range blocks {
		if isClaudeCodeBillingHeaderBlock(block) {
			continue
		}
		text := strings.TrimSpace(block.GetText())
		if text == "" {
			continue
		}
		parts = append(parts, map[string]any{"type": "input_text", "text": text})
	}
	return parts
}

// claudeMessageToResponsesInputItems 将单条 Claude message 转换为 Responses input items。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：保留 text/image/tool_use/tool_result 的基础语义，避免经 Chat 结构二次折叠。
// 参数说明：message 为 Claude 消息。
// 返回值说明：返回一个或多个 Responses input item；复杂内容无法解析时返回错误。
func claudeMessageToResponsesInputItems(message dto.ClaudeMessage) ([]map[string]any, error) {
	role := strings.TrimSpace(message.Role)
	if role == "" {
		role = "user"
	}
	if message.IsStringContent() {
		return []map[string]any{claudeResponsesMessageItem(role, []map[string]any{
			claudeResponsesTextPart(role, message.GetStringContent()),
		})}, nil
	}

	blocks, err := message.ParseContent()
	if err != nil {
		return nil, err
	}
	items := make([]map[string]any, 0, len(blocks))
	parts := make([]map[string]any, 0, len(blocks))
	flushParts := func() {
		if len(parts) == 0 {
			return
		}
		items = append(items, claudeResponsesMessageItem(role, parts))
		parts = nil
	}

	for _, block := range blocks {
		switch block.Type {
		case "text", "input_text":
			if text := block.GetText(); text != "" {
				parts = append(parts, claudeResponsesTextPart(role, text))
			}
		case "image":
			if imageURL := claudeImageSourceToResponsesURL(block.Source); imageURL != "" {
				parts = append(parts, map[string]any{"type": "input_image", "image_url": imageURL})
			}
		case "tool_use":
			flushParts()
			if block.Id == "" || strings.TrimSpace(block.Name) == "" {
				continue
			}
			items = append(items, map[string]any{
				"type":      "function_call",
				"call_id":   block.Id,
				"name":      block.Name,
				"arguments": toJSONString(block.Input),
			})
		case "tool_result":
			flushParts()
			if block.ToolUseId == "" {
				continue
			}
			items = append(items, map[string]any{
				"type":    "function_call_output",
				"call_id": block.ToolUseId,
				"output":  claudeToolResultOutput(block),
			})
		}
	}
	flushParts()
	return items, nil
}

// claudeResponsesMessageItem 构造 Responses message input item。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：统一设置 Responses input message 的 type、role 和 content 字段。
// 参数说明：role 为消息角色；parts 为 content parts。
// 返回值说明：返回可 JSON 序列化的 Responses message item。
func claudeResponsesMessageItem(role string, parts []map[string]any) map[string]any {
	return map[string]any{
		"type":    "message",
		"role":    role,
		"content": parts,
	}
}

// claudeResponsesTextPart 构造 Responses 文本 content part。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：按 role 区分用户输入文本和助手输出文本，保留 Responses input 语义。
// 参数说明：role 为消息角色；text 为文本内容。
// 返回值说明：返回可 JSON 序列化的 Responses content part。
func claudeResponsesTextPart(role string, text string) map[string]any {
	partType := "input_text"
	if role == "assistant" {
		partType = "output_text"
	}
	return map[string]any{"type": partType, "text": text}
}

// claudeImageSourceToResponsesURL 将 Claude 图片 source 转换为 Responses image_url。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：兼容 Claude base64 图片和 URL 图片输入。
// 参数说明：source 为 Claude 图片 source。
// 返回值说明：返回 Responses 可接受的 image_url 字符串；无法转换时返回空字符串。
func claudeImageSourceToResponsesURL(source *dto.ClaudeMessageSource) string {
	if source == nil {
		return ""
	}
	if strings.TrimSpace(source.Url) != "" {
		return strings.TrimSpace(source.Url)
	}
	data := strings.TrimSpace(common.Interface2String(source.Data))
	if data == "" {
		return ""
	}
	if strings.HasPrefix(data, "data:") {
		return data
	}
	mediaType := strings.TrimSpace(source.MediaType)
	if mediaType == "" {
		return data
	}
	return fmt.Sprintf("data:%s;base64,%s", mediaType, data)
}

// claudeToolResultOutput 将 Claude tool_result 内容转换为 Responses function_call_output.output。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：Responses function_call_output.output 主要接受字符串，因此复杂内容转为 JSON 字符串。
// 参数说明：block 为 Claude tool_result 内容块。
// 返回值说明：返回字符串形式的工具输出。
func claudeToolResultOutput(block dto.ClaudeMediaMessage) string {
	if block.IsStringContent() {
		return block.GetStringContent()
	}
	if block.Content == nil {
		return ""
	}
	return toJSONString(block.Content)
}

// claudeResponsesToolsRaw 将 Claude tools 转换为 Responses tools JSON。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：复用现有 Claude tool 识别逻辑，并输出 Responses API 的工具字段形态。
// 参数说明：tools 为 ClaudeRequest.Tools 原始值。
// 返回值说明：返回 JSON RawMessage；无工具时返回 nil。
func claudeResponsesToolsRaw(tools any) ([]byte, error) {
	openAITools := convertClaudeToolsToOpenAITools(tools)
	if len(openAITools) == 0 {
		return nil, nil
	}
	responsesTools := make([]map[string]any, 0, len(openAITools))
	for _, tool := range openAITools {
		switch tool.Type {
		case "function":
			responsesTools = append(responsesTools, map[string]any{
				"type":        "function",
				"name":        tool.Function.Name,
				"description": tool.Function.Description,
				"parameters":  tool.Function.Parameters,
			})
		case dto.BuildInToolWebSearch, dto.BuildInToolWebSearchPreview:
			webSearchTool := map[string]any{"type": dto.BuildInToolWebSearch}
			if tool.SearchContextSize != "" {
				webSearchTool["search_context_size"] = tool.SearchContextSize
			}
			responsesTools = append(responsesTools, webSearchTool)
		}
	}
	if len(responsesTools) == 0 {
		return nil, nil
	}
	return common.Marshal(responsesTools)
}

// claudeResponsesToolChoiceRaw 将 Claude tool_choice 转换为 Responses tool_choice JSON。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：保留 auto/any/none/tool 的基础选择语义。
// 参数说明：toolChoice 为 ClaudeRequest.ToolChoice 原始值。
// 返回值说明：返回 JSON RawMessage；未提供 tool_choice 时返回 nil。
func claudeResponsesToolChoiceRaw(toolChoice any) ([]byte, error) {
	if toolChoice == nil {
		return nil, nil
	}
	choiceMap, err := common.Any2Type[map[string]any](toolChoice)
	if err != nil {
		return common.Marshal(toolChoice)
	}
	switch strings.TrimSpace(common.Interface2String(choiceMap["type"])) {
	case "auto":
		return common.Marshal("auto")
	case "any":
		return common.Marshal("required")
	case "none":
		return common.Marshal("none")
	case "tool":
		name := strings.TrimSpace(common.Interface2String(choiceMap["name"]))
		if name == "" {
			return common.Marshal(toolChoice)
		}
		return common.Marshal(map[string]any{"type": "function", "name": name})
	default:
		return common.Marshal(toolChoice)
	}
}

// mapClaudeResponsesReasoningEffort 将 Claude output_config.effort 映射为 Responses reasoning.effort。
//
// 编写时间：2026-05-19
// 作者：苍朮
// 用途：保留 Claude Opus thinking 适配时已经注入的推理力度。
// 参数说明：effort 为 Claude output_config.effort。
// 返回值说明：返回 Responses effort；未知或空值返回空字符串。
func mapClaudeResponsesReasoningEffort(effort string) string {
	switch strings.TrimSpace(effort) {
	case "low", "medium", "high", "xhigh":
		return effort
	case "max":
		return "xhigh"
	default:
		return ""
	}
}
