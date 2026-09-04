package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

func isResponsesContentArrayErrorMessage(msg string) bool {
	msg = strings.ToLower(msg)
	return strings.Contains(msg, "invalid 'input[") &&
		strings.Contains(msg, ".content'") &&
		strings.Contains(msg, "array too long")
}

func isResponsesReasoningSummaryErrorMessage(msg string) bool {
	msg = strings.ToLower(msg)
	return strings.Contains(msg, "missing required parameter") &&
		strings.Contains(msg, "input[") &&
		strings.Contains(msg, ".summary'")
}

func isResponsesEncryptedContentErrorMessage(msg string) bool {
	msg = strings.ToLower(msg)
	return strings.Contains(msg, "encrypted content") &&
		(strings.Contains(msg, "could not be verified") ||
			strings.Contains(msg, "could not be decrypted") ||
			strings.Contains(msg, "could not be parsed"))
}

var responsesContextOverflowPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)maximum context length is (\d+) tokens`),
	regexp.MustCompile(`(?i)configured limit of (\d+) tokens`),
	regexp.MustCompile(`(?i)model token limit: (\d+)`),
}

var responsesImageUnsupportedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)not support.{0,40}(?:image|vision)`),
	regexp.MustCompile(`(?i)(?:image|vision).{0,40}(?:not support|unsupported)`),
	regexp.MustCompile(`(?i)unsupported.{0,40}(?:image|vision)`),
	regexp.MustCompile(`(?i)unknown variant\s+` + "`" + `image`),
	regexp.MustCompile(`(?i)unknown variant\s+"image`),
}

const responsesImageRemovedPlaceholder = "[图片已移除：当前模型不支持图片输入]"

func parseResponsesContextOverflowMaxTokens(msg string) (int, bool) {
	for _, pattern := range responsesContextOverflowPatterns {
		m := pattern.FindStringSubmatch(msg)
		if m == nil {
			continue
		}
		maxTokens, err := strconv.Atoi(m[1])
		if err != nil || maxTokens <= 0 {
			return 0, false
		}
		return maxTokens, true
	}
	return 0, false
}

func isResponsesImageUnsupportedError(msg string) bool {
	for _, pattern := range responsesImageUnsupportedPatterns {
		if pattern.MatchString(msg) {
			return true
		}
	}
	return false
}

func flattenResponsesContentArraysForRetry(body []byte) ([]byte, bool) {
	return rewriteResponsesInputForRetry(body, false, false)
}

func summarizeResponsesReasoningItemsForRetry(body []byte) ([]byte, bool) {
	return rewriteResponsesInputForRetry(body, false, true)
}

func stripResponsesReasoningItemsForRetry(body []byte) ([]byte, bool) {
	return rewriteResponsesInputForRetry(body, true, false)
}

func hasResponsesReasoningItems(body []byte) bool {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return false
	}
	input, ok := reqMap["input"].([]any)
	if !ok {
		return false
	}
	for _, item := range input {
		if mm, ok := item.(map[string]any); ok {
			if itemType, _ := mm["type"].(string); itemType == "reasoning" {
				return true
			}
		}
	}
	return false
}

func summarizeResponsesInputTypes(body []byte) string {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return "unmarshal_failed"
	}
	input, ok := reqMap["input"].([]any)
	if !ok {
		return "no_input_array"
	}
	typesSeen := make([]string, 0, len(input))
	for _, item := range input {
		if mm, ok := item.(map[string]any); ok {
			itemType, _ := mm["type"].(string)
			if itemType == "" {
				if role, _ := mm["role"].(string); role != "" {
					itemType = "role:" + role
				} else {
					itemType = "unknown"
				}
			}
			typesSeen = append(typesSeen, itemType)
		}
	}
	return strings.Join(typesSeen, ",")
}

func responsesIsImagePart(pm map[string]any) bool {
	partType, _ := pm["type"].(string)
	switch partType {
	case "image_url", "input_image", "image":
		return true
	}
	return false
}

func stripAllResponsesImageParts(items []any, fields []string, textPartType string) (int, bool) {
	removed := 0
	changed := false
	for _, item := range items {
		mm, ok := item.(map[string]any)
		if !ok {
			continue
		}
		for _, field := range fields {
			parts, ok := mm[field].([]any)
			if !ok {
				continue
			}
			itemRemoved := 0
			newParts := make([]any, 0, len(parts))
			for _, p := range parts {
				pm, ok := p.(map[string]any)
				if !ok || !responsesIsImagePart(pm) {
					newParts = append(newParts, p)
					continue
				}
				newParts = append(newParts, map[string]any{"type": textPartType, "text": responsesImageRemovedPlaceholder})
				itemRemoved++
			}
			if itemRemoved > 0 {
				mm[field] = newParts
				removed += itemRemoved
				changed = true
			}
		}
	}
	return removed, changed
}

func stripResponsesImagesForUnsupportedRetry(body []byte) ([]byte, int, bool) {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return body, 0, false
	}
	removed := 0
	if input, ok := reqMap["input"].([]any); ok && len(input) > 0 {
		if n, ch := stripAllResponsesImageParts(input, []string{"content", "output"}, "input_text"); ch {
			reqMap["input"] = input
			removed += n
		}
	}
	if removed == 0 {
		return body, 0, false
	}
	out, err := common.Marshal(reqMap)
	if err != nil {
		return body, 0, false
	}
	return out, removed, true
}

func truncateResponsesMessageString(input []any, maxTokens int, model string) bool {
	if len(input) == 0 || maxTokens <= 0 {
		return false
	}
	targetChars := maxTokens * 3
	changed := false
	for i := 0; i < len(input)-1; i++ {
		item, ok := input[i].(map[string]any)
		if !ok {
			continue
		}
		if item["type"] != "message" {
			continue
		}
		content, ok := item["content"].(string)
		if !ok || len(content) <= targetChars || targetChars <= 64 {
			continue
		}
		keep := targetChars / 2
		item["content"] = content[:keep] + "\n...[历史内容已截断]...\n" + content[len(content)-keep:]
		changed = true
	}
	return changed
}

func truncateResponsesInputForContextRetry(body []byte, maxTokens int, model string) ([]byte, bool) {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return body, false
	}
	input, ok := reqMap["input"].([]any)
	if !ok || len(input) == 0 {
		return body, false
	}
	changed := false
	if truncateResponsesMessageString(input, maxTokens, model) {
		changed = true
	}
	targetItems := int(float64(maxTokens) * 0.7)
	for len(input) > 1 && len(input)*12000 > targetItems {
		input = input[1:]
		changed = true
	}
	if !changed {
		return body, false
	}
	reqMap["input"] = input
	out, err := common.Marshal(reqMap)
	if err != nil {
		return body, false
	}
	return out, true
}

const responsesOmittedToolOutputPlaceholder = "[工具调用结果已省略]"

// isResponsesToolPairingError 匹配上游 function_call / function_call_output
// 配对缺失类错误，例如：
// cooai/deepseek: "No tool output found for tool call call_02_..."
// openai:         "No function call found for function_call_output item with call_id ..."
func isResponsesToolPairingError(msg string) bool {
	lower := strings.ToLower(msg)
	return strings.Contains(lower, "no tool output found for tool call") ||
		strings.Contains(lower, "no output found for function call") ||
		strings.Contains(lower, "no function call found") ||
		(strings.Contains(lower, "tool output") && strings.Contains(lower, "missing"))
}

// sanitizeResponsesToolCallPairing 修复 responses input 中 function_call /
// function_call_output 配对问题：
//  1. dropOrphanOutputs 为 true 时，删除孤儿 function_call_output
//     （前面没有携带对应 call_id 的 function_call）
//  2. 为缺失响应的 function_call 补充占位 function_call_output，避免
//     "No tool output found for tool call ..." 错误
//
// 与 chat 侧 sanitizeToolCallPairing 语义一致，但允许连续的 function_call
// 同时挂起（responses 中并行工具调用是多个独立 item）。
// dropOrphanOutputs 为 false 时（请求携带 previous_response_id），
// 未匹配的 function_call_output 会被保留：其 function_call 可能位于
// 上游服务端会话中，删除会破坏正常工具调用续跑流程。
func sanitizeResponsesToolCallPairing(input []any, dropOrphanOutputs bool) ([]any, int) {
	changed := 0
	out := make([]any, 0, len(input)+2)
	answerable := map[string]bool{}
	var unanswered []string

	fabricateMissing := func() {
		for _, id := range unanswered {
			out = append(out, map[string]any{
				"type":    "function_call_output",
				"call_id": id,
				"output":  responsesOmittedToolOutputPlaceholder,
			})
			changed++
		}
		unanswered = nil
	}

	for _, item := range input {
		mm, ok := item.(map[string]any)
		if !ok {
			out = append(out, item)
			continue
		}
		itemType, _ := mm["type"].(string)
		switch itemType {
		case "function_call":
			out = append(out, item)
			if id, _ := mm["call_id"].(string); id != "" && !answerable[id] {
				answerable[id] = true
				unanswered = append(unanswered, id)
			}
		case "function_call_output":
			id, _ := mm["call_id"].(string)
			pending := false
			for i, u := range unanswered {
				if u == id {
					pending = true
					unanswered = append(unanswered[:i], unanswered[i+1:]...)
					break
				}
			}
			if id != "" && pending {
				out = append(out, item)
			} else if dropOrphanOutputs {
				// 孤儿/重复 function_call_output（其 function_call 已被压缩/剥离或已响应），删除
				changed++
			} else {
				// previous_response_id 场景：保留可能与服务端会话配对的输出
				out = append(out, item)
			}
		case "message":
			// 边界消息：function_call 响应无法跨消息，先补齐再追加
			fabricateMissing()
			answerable = map[string]bool{}
			out = append(out, item)
		default:
			// reasoning / item_reference 等不打断配对
			out = append(out, item)
		}
	}
	// 末尾仍有未响应的 function_call，补占位
	fabricateMissing()
	return out, changed
}

// sanitizeResponsesToolPairingForRetry 在请求体上执行 function_call 配对清洗，
// 返回清洗后的请求体与是否有修改。
func sanitizeResponsesToolPairingForRetry(body []byte) ([]byte, bool) {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return body, false
	}
	input, ok := reqMap["input"].([]any)
	if !ok || len(input) == 0 {
		return body, false
	}
	// previous_response_id 时，input 中可能只包含 function_call_output，
	// 其 function_call 位于上游服务端会话中，不能按孤儿输出删除
	previousID, _ := reqMap["previous_response_id"].(string)
	sanitized, changed := sanitizeResponsesToolCallPairing(input, previousID == "")
	if changed == 0 {
		return body, false
	}
	reqMap["input"] = sanitized
	out, err := common.Marshal(reqMap)
	if err != nil {
		return body, false
	}
	return out, true
}

// tryResponsesToolPairingRecovery 修复 responses input 中 function_call /
// function_call_output 配对问题后用同一渠道重试一次，返回重试结果；
// 无需修改时不重试（返回 nil, nil）。
func tryResponsesToolPairingRecovery(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, body []byte, logMessage string) (*http.Response, *types.NewAPIError) {
	if !appconstant.ContextOverflowAutoRecovery {
		return nil, nil
	}
	newBody, changed := sanitizeResponsesToolPairingForRetry(body)
	if !changed {
		return nil, nil
	}
	return retryResponsesRequest(c, info, adaptor, newBody, logMessage)
}

func extractReasoningSummaryText(summary any) string {
	summaryParts, ok := summary.([]any)
	if !ok {
		return ""
	}
	texts := make([]string, 0, len(summaryParts))
	for _, partAny := range summaryParts {
		part, ok := partAny.(map[string]any)
		if !ok {
			continue
		}
		partType, _ := part["type"].(string)
		if partType != "summary_text" && partType != "text" {
			continue
		}
		text, _ := part["text"].(string)
		if strings.TrimSpace(text) == "" {
			continue
		}
		texts = append(texts, text)
	}
	return strings.TrimSpace(strings.Join(texts, "\n\n"))
}

func rewriteResponsesInputForRetry(body []byte, dropReasoning bool, summarizeReasoning bool) ([]byte, bool) {
	var reqMap map[string]any
	if err := common.Unmarshal(body, &reqMap); err != nil {
		return body, false
	}
	inputVal, ok := reqMap["input"]
	if !ok {
		return body, false
	}
	inputBytes, err := common.Marshal(inputVal)
	if err != nil {
		return body, false
	}
	var input []map[string]any
	if err := common.Unmarshal(inputBytes, &input); err != nil {
		return body, false
	}
	changed := false
	filtered := make([]map[string]any, 0, len(input))
	for _, item := range input {
		itemType, _ := item["type"].(string)
		if itemType == "reasoning" {
			if dropReasoning {
				changed = true
				continue
			}
			_, hasEncrypted := item["encrypted_content"]
			if hasEncrypted {
				delete(item, "encrypted_content")
				changed = true
			}
			if summarizeReasoning {
				summaryText := extractReasoningSummaryText(item["summary"])
				if summaryText != "" {
					filtered = append(filtered, map[string]any{
						"type":    "message",
						"role":    "assistant",
						"content": "[Context Summary]\n" + summaryText,
					})
					changed = true
					continue
				}
				// 带 encrypted_content 但无法提炼摘要的 reasoning 条目：
				// 上游无法解密该内容，直接剥离整个条目，避免恢复链被卡住。
				if hasEncrypted {
					changed = true
					continue
				}
			}
			if _, exists := item["content"]; exists {
				delete(item, "content")
				changed = true
			}
			if _, exists := item["summary"]; !exists {
				item["summary"] = []any{}
				changed = true
			}
			filtered = append(filtered, item)
			continue
		}
		if itemType == "message" {
			content, ok := item["content"].([]any)
			if ok {
				texts := make([]string, 0, len(content))
				convertible := true
				for _, partAny := range content {
					part, ok := partAny.(map[string]any)
					if !ok {
						convertible = false
						break
					}
					partType, _ := part["type"].(string)
					switch partType {
					case "input_text", "output_text", "text":
						if s, _ := part["text"].(string); s != "" {
							texts = append(texts, s)
						}
					default:
						convertible = false
					}
				}
				if convertible {
					item["content"] = strings.Join(texts, "\n")
					changed = true
				}
			}
		}
		filtered = append(filtered, item)
	}
	if !changed {
		return body, false
	}
	reqMap["input"] = filtered
	out, err := common.Marshal(reqMap)
	if err != nil {
		return body, false
	}
	return out, true
}

func retryResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, body []byte, logMessage string) (*http.Response, *types.NewAPIError) {
	storage, createErr := common.CreateBodyStorage(body)
	if createErr != nil {
		return nil, nil
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Request.Body = io.NopCloser(storage)
	if info.Request != nil {
		_ = common.Unmarshal(body, info.Request)
	}
	logger.LogWarn(c, logMessage)
	requestBody := bytes.NewBuffer(body)
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil || resp == nil {
		return nil, nil
	}
	httpResp := resp.(*http.Response)
	if httpResp.StatusCode == http.StatusOK {
		return httpResp, nil
	}
	return httpResp, service.RelayErrorHandler(c.Request.Context(), httpResp, false)
}

// tryResponsesReasoningDowngrade 处理 responses 输入中历史 reasoning 条目
// 无法被上游消费（encrypted_content 解密失败、summary 缺失等）的场景：
// 先尝试 summarize 转成带摘要的 assistant 消息，无改动或重试失败时再整体
// 剥离 reasoning 条目，每次改动后原地重试一次。返回重试响应；
// 无 reasoning 条目或无需改动时返回 nil。
func tryResponsesReasoningDowngrade(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, body []byte) (*http.Response, *types.NewAPIError) {
	if !hasResponsesReasoningItems(body) {
		return nil, nil
	}
	logger.LogWarn(c, "responses handler detected reasoning items; attempting proactive reasoning downgrade")
	if newBody, changed := summarizeResponsesReasoningItemsForRetry(body); changed {
		retryResp, retryErr := retryResponsesRequest(c, info, adaptor, newBody, "responses handler auto-recovery: proactively summarized reasoning items and retried upstream once")
		if retryResp != nil && retryErr == nil {
			return retryResp, nil
		}
		if retryErr != nil {
			if newBody2, changed2 := stripResponsesReasoningItemsForRetry(newBody); changed2 {
				retryResp2, retryErr2 := retryResponsesRequest(c, info, adaptor, newBody2, "responses handler auto-recovery: proactively stripped reasoning items and retried upstream once")
				if retryResp2 != nil && retryErr2 == nil {
					return retryResp2, nil
				}
				if retryErr2 != nil {
					return nil, retryErr2
				}
			}
			return nil, retryErr
		}
	}
	// summarize 无改动（如 reasoning 条目只有 encrypted_content 且无摘要）时，
	// 兜底整体剥离 reasoning 条目后再重试一次，避免恢复链被 changed=false 卡住。
	if newBody2, changed2 := stripResponsesReasoningItemsForRetry(body); changed2 {
		retryResp2, retryErr2 := retryResponsesRequest(c, info, adaptor, newBody2, "responses handler auto-recovery: proactively stripped reasoning items and retried upstream once")
		if retryResp2 != nil && retryErr2 == nil {
			return retryResp2, nil
		}
		if retryErr2 != nil {
			return nil, retryErr2
		}
	}
	return nil, nil
}

func ResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact &&
		!common.SupportsResponsesCompact(info.ChannelType, info.ApiType) {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("unsupported endpoint %q for api type %d", "/v1/responses/compact", info.ApiType),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	var responsesReq *dto.OpenAIResponsesRequest
	switch req := info.Request.(type) {
	case *dto.OpenAIResponsesRequest:
		responsesReq = req
	case *dto.OpenAIResponsesCompactionRequest:
		responsesReq = &dto.OpenAIResponsesRequest{
			Model:                req.Model,
			Input:                req.Input,
			Instructions:         req.Instructions,
			PreviousResponseID:   req.PreviousResponseID,
			ParallelToolCalls:    req.ParallelToolCalls,
			ServiceTier:          req.ServiceTier,
			PromptCacheKey:       req.PromptCacheKey,
			PromptCacheOptions:   req.PromptCacheOptions,
			PromptCacheRetention: req.PromptCacheRetention,
		}
	default:
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected dto.OpenAIResponsesRequest or dto.OpenAIResponsesCompactionRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	request, err := common.DeepCopy(responsesReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeneralOpenAIRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	if err := helper.ApplyReasoningModelSuffix(c, info, request); err != nil {
		return newConvertRequestFailedError(c, info, err)
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	var requestBody io.Reader
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.NewReplayableBodyReader(storage)
	} else {
		convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *request)
		if err != nil {
			return newConvertRequestFailedError(c, info, err)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		jsonData, err := common.Marshal(convertedRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		if len(info.ParamOverride) > 0 {
			jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
			if err != nil {
				return newAPIErrorFromParamOverride(err)
			}
		}
		logger.LogDebug(c, "requestBody: %s", jsonData)
		body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		jsonData = nil
		requestBody = body
	}

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			storage, storageErr := common.GetBodyStorage(c)
			if storageErr == nil {
				rawBody, readErr := storage.Bytes()
				if readErr == nil {
					if isResponsesEncryptedContentErrorMessage(newAPIError.Error()) {
						if retryResp, retryErr := tryResponsesReasoningDowngrade(c, info, adaptor, rawBody); retryResp != nil && retryErr == nil {
							httpResp = retryResp
							goto RESPONSE_OK
						} else if retryErr != nil {
							newAPIError = retryErr
						}
					}
					if isResponsesContentArrayErrorMessage(newAPIError.Error()) {
						if newBody, changed := flattenResponsesContentArraysForRetry(rawBody); changed {
							logger.LogWarn(c, "responses handler flatten input types: "+summarizeResponsesInputTypes(newBody))
							retryResp, retryErr := retryResponsesRequest(c, info, adaptor, newBody, "responses handler auto-recovery: flattened input content arrays and retrying upstream once")
							if retryResp != nil && retryErr == nil {
								httpResp = retryResp
								goto RESPONSE_OK
							}
							if retryErr != nil {
								newAPIError = retryErr
								// flatten 后即使上游先返回其他 400，也可能在下一步被旧
								// reasoning.encrypted_content 卡住；只要输入里仍含 reasoning item，
								// 主动尝试 summary/strip，避免依赖特定错误文案才能进入恢复链。
								reasoningDowngradeTried := false
								if hasResponsesReasoningItems(newBody) {
									reasoningDowngradeTried = true
									logger.LogWarn(c, "responses handler detected reasoning items after flatten; attempting proactive reasoning downgrade")
									if retryResp2, retryErr2 := tryResponsesReasoningDowngrade(c, info, adaptor, newBody); retryResp2 != nil && retryErr2 == nil {
										httpResp = retryResp2
										goto RESPONSE_OK
									} else if retryErr2 != nil {
										newAPIError = retryErr2
									}
								}
								if !reasoningDowngradeTried && isResponsesEncryptedContentErrorMessage(newAPIError.Error()) {
									if newBody2, changed2 := summarizeResponsesReasoningItemsForRetry(newBody); changed2 {
										retryResp2, retryErr2 := retryResponsesRequest(c, info, adaptor, newBody2, "responses handler auto-recovery: flattened input, then summarized unverifiable encrypted reasoning items and retried upstream once")
										if retryResp2 != nil && retryErr2 == nil {
											httpResp = retryResp2
											goto RESPONSE_OK
										}
										if retryErr2 != nil {
											newAPIError = retryErr2
											if isResponsesEncryptedContentErrorMessage(newAPIError.Error()) || isResponsesReasoningSummaryErrorMessage(newAPIError.Error()) {
												if newBody3, changed3 := stripResponsesReasoningItemsForRetry(newBody2); changed3 {
													retryResp3, retryErr3 := retryResponsesRequest(c, info, adaptor, newBody3, "responses handler auto-recovery: flattened input, then stripped unverifiable reasoning items and retried upstream once")
													if retryResp3 != nil && retryErr3 == nil {
														httpResp = retryResp3
														goto RESPONSE_OK
													}
													if retryErr3 != nil {
														newAPIError = retryErr3
													}
												}
											}
										}
									}
								}
								if !reasoningDowngradeTried && isResponsesReasoningSummaryErrorMessage(newAPIError.Error()) {
									if newBody2, changed2 := summarizeResponsesReasoningItemsForRetry(newBody); changed2 {
										retryResp2, retryErr2 := retryResponsesRequest(c, info, adaptor, newBody2, "responses handler auto-recovery: summarized incompatible reasoning items and retrying upstream once")
										if retryResp2 != nil && retryErr2 == nil {
											httpResp = retryResp2
											goto RESPONSE_OK
										}
										if retryErr2 != nil {
											newAPIError = retryErr2
											if isResponsesReasoningSummaryErrorMessage(newAPIError.Error()) {
												if newBody3, changed3 := stripResponsesReasoningItemsForRetry(newBody2); changed3 {
													retryResp3, retryErr3 := retryResponsesRequest(c, info, adaptor, newBody3, "responses handler auto-recovery: stripped incompatible reasoning items and retrying upstream once")
													if retryResp3 != nil && retryErr3 == nil {
														httpResp = retryResp3
														goto RESPONSE_OK
													}
													if retryErr3 != nil {
														newAPIError = retryErr3
													}
												}
											}
										}
									}
								}
							}
						}
					}
					// function_call/function_call_output 配对缺失自动恢复：
					// 删除孤儿输出、为缺失响应的调用补占位后原地重试一次。
					// 注意需在图片剥离前先处理：若清洗后重试仍报图片不支持，
					// 会落到下方的图片剥离分支继续恢复。
					if isResponsesToolPairingError(newAPIError.Error()) {
						retryResp, retryErr := tryResponsesToolPairingRecovery(c, info, adaptor, rawBody, "responses handler auto-recovery: sanitized function_call/function_call_output pairing and retrying upstream once")
						if retryResp != nil && retryErr == nil {
							httpResp = retryResp
							goto RESPONSE_OK
						}
						if retryErr != nil {
							newAPIError = retryErr
						}
					}
					if isResponsesImageUnsupportedError(newAPIError.Error()) {
						if newBody, removed, changed := stripResponsesImagesForUnsupportedRetry(rawBody); changed {
							c.Header("X-Images-Removed", strconv.Itoa(removed))
							retryResp, retryErr := retryResponsesRequest(c, info, adaptor, newBody, fmt.Sprintf("responses handler auto-recovery: removed %d unsupported images and retrying upstream once", removed))
							if retryResp != nil && retryErr == nil {
								httpResp = retryResp
								goto RESPONSE_OK
							}
							if retryErr != nil {
								newAPIError = retryErr
								model := info.UpstreamModelName
								if model == "" {
									model = info.OriginModelName
								}
								if maxTokens, ok := parseResponsesContextOverflowMaxTokens(newAPIError.Error()); ok {
									if newBody2, changed2 := truncateResponsesInputForContextRetry(newBody, maxTokens, model); changed2 {
										c.Header("X-Context-Truncated", "responses")
										retryResp2, retryErr2 := retryResponsesRequest(c, info, adaptor, newBody2, "responses handler auto-recovery: removed unsupported images, then truncated input context and retried upstream once")
										if retryResp2 != nil && retryErr2 == nil {
											httpResp = retryResp2
											goto RESPONSE_OK
										}
										if retryErr2 != nil {
											newAPIError = retryErr2
										}
									}
								}
								// 图片剥离后重试仍可能报 tool 配对缺失，
								// 再清洗一次 function_call/function_call_output 配对
								if isResponsesToolPairingError(newAPIError.Error()) {
									retryResp3, retryErr3 := tryResponsesToolPairingRecovery(c, info, adaptor, newBody, "responses handler auto-recovery: removed unsupported images, then sanitized tool pairing and retried upstream once")
									if retryResp3 != nil && retryErr3 == nil {
										httpResp = retryResp3
										goto RESPONSE_OK
									}
									if retryErr3 != nil {
										newAPIError = retryErr3
									}
								}
							}
						}
					}
				}
			}
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

RESPONSE_OK:
	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	usageDto := usage.(*dto.Usage)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		originModelName := info.OriginModelName
		originPriceData := info.PriceData
		_, err := helper.ModelPriceHelper(c, info, info.GetEstimatePromptTokens(), &types.TokenCountMeta{})
		if err != nil {
			info.OriginModelName = originModelName
			info.PriceData = originPriceData
			return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry(), types.ErrOptionWithStatusCode(http.StatusBadRequest))
		}
		service.PostTextConsumeQuota(c, info, usageDto, nil)
		info.OriginModelName = originModelName
		info.PriceData = originPriceData
		return nil
	}

	if strings.HasPrefix(info.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, info, usageDto, "")
	} else {
		service.PostTextConsumeQuota(c, info, usageDto, nil)
	}
	return nil
}
