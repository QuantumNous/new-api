package controller

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// 匹配上游 context 超长错误中的上限数字，例如：
// deepseek: "This model's maximum context length is 1048565 tokens. However, you requested 3220751 tokens"
// openai:   "This model's maximum context length is 128000 tokens. However, your messages resulted in 130000 tokens"
// oc:       "Input tokens exceed the configured limit of 922000 tokens. Your messages resulted in 1055751 tokens"
// kimi:     "Invalid request: Your request exceeded model token limit: 262144 (requested: 1055340)"
var contextOverflowMaxPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)maximum context length is (\d+) tokens`),
	regexp.MustCompile(`(?i)configured limit of (\d+) tokens`),
	regexp.MustCompile(`(?i)model token limit: (\d+)`),
}

const contextRecoveredKey = "context_overflow_recovered"
const imageUnsupportedRecoveredKey = "image_unsupported_recovered"

// 裁剪目标比例：上游 tokenizer 与本地估算存在偏差，留足余量避免二次溢出
const contextTruncateTargetRatio = 0.7

// 保留图片的估算 token 数（仅最后一条含图消息的图片会被保留）
const flatImageTokenEstimate = 2000

// 剥离图片后的占位文本
const omittedImagePlaceholder = "[历史图片已省略]"

// 模型不支持图片输入时，图片被移除后的占位文本（模型可见，可据此告知用户）
const imageRemovedPlaceholder = "[图片已移除：当前模型不支持图片输入]"

func parseContextOverflowMaxTokens(msg string) (int, bool) {
	for _, pattern := range contextOverflowMaxPatterns {
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

// 匹配上游"模型不支持图片输入"类错误，例如：
// "This model does not support images in the conversation"
// "Image input is not supported for this model"
// "Unsupported image input"
// "model does not support vision"
// deepseek-v4-flash: "Failed to deserialize the JSON body into the target type: messages[7]: unknown variant `image_url`, expected `text`"
var imageUnsupportedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)not support.{0,40}(?:image|vision)`),
	regexp.MustCompile(`(?i)(?:image|vision).{0,40}(?:not support|unsupported)`),
	regexp.MustCompile(`(?i)unsupported.{0,40}(?:image|vision)`),
	regexp.MustCompile(`(?i)unknown variant\s+` + "`" + `image`),
	regexp.MustCompile(`(?i)unknown variant\s+"image`),
}

func isImageUnsupportedError(msg string) bool {
	for _, pattern := range imageUnsupportedPatterns {
		if pattern.MatchString(msg) {
			return true
		}
	}
	return false
}

// tryContextOverflowRecovery 检测上游 context 超长错误，裁剪请求体中的历史消息
// （先剥离旧消息中的图片，再从最旧开始丢弃对话块），并同步更新 BodyStorage 与
// info.Request，返回 true 表示可以用同一渠道原地重试。
// 每个请求最多恢复一次，避免死循环。
func tryContextOverflowRecovery(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) bool {
	if !constant.ContextOverflowAutoRecovery || apiErr == nil || info == nil {
		return false
	}
	if c.GetBool(contextRecoveredKey) {
		return false
	}
	maxTokens, ok := parseContextOverflowMaxTokens(apiErr.Error())
	if !ok {
		return false
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false
	}
	raw, err := storage.Bytes()
	if err != nil {
		return false
	}

	model := info.UpstreamModelName
	if model == "" {
		model = info.OriginModelName
	}
	newBody, before, after, err := truncateChatMessagesBody(raw, model, maxTokens)
	if err != nil {
		return false
	}

	// 更新 info.Request（非透传模式 relay 使用解析后的 DTO，而非重新读 body）
	if info.Request != nil {
		if err := common.Unmarshal(newBody, info.Request); err != nil {
			return false
		}
	}

	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return false
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, newStorage)
	c.Set(contextRecoveredKey, true)
	info.SetEstimatePromptTokens(after)
	c.Header("X-Context-Truncated", fmt.Sprintf("%d->%d", before, after))
	logger.LogWarn(c, fmt.Sprintf("context 超长（上限 %d tokens），已自动裁剪历史消息（估算 %d -> %d tokens）并重试", maxTokens, before, after))
	return true
}

// truncateChatMessagesBody 裁剪 chat completions 请求体中的 messages，
// 返回新请求体及裁剪前后的估算 token 数。
func truncateChatMessagesBody(raw []byte, model string, maxTokens int) ([]byte, int, int, error) {
	var reqMap map[string]any
	if err := common.Unmarshal(raw, &reqMap); err != nil {
		return nil, 0, 0, err
	}
	messagesAny, ok := reqMap["messages"]
	if !ok {
		return nil, 0, 0, fmt.Errorf("no messages in request body")
	}
	messages, ok := messagesAny.([]any)
	if !ok || len(messages) == 0 {
		return nil, 0, 0, fmt.Errorf("messages is empty or not an array")
	}

	target := int(float64(maxTokens) * contextTruncateTargetRatio)

	// 第一步：剥离旧消息中的图片（只保留最后一条含图消息的图片）
	stripOldImageParts(messages, []string{"content"}, "text")

	// 第二步：截断超长单条消息内容（巨大的 tool 输出/文件内容做中间省略），
	// 避免后续因尾部块不可丢弃导致裁剪失效
	elideOversizedMessageContents(messages)

	counts := perMessageTokenCounts(messages, model)
	total := sumInts(counts)
	before := total

	// 第三步：从最旧的非 system 消息开始按块丢弃
	//（assistant 消息与其后续连续 tool 消息为一块，避免留下孤儿 tool 响应）
	for total > target {
		i := firstNonSystemMessageIndex(messages)
		if i < 0 || i >= len(messages)-1 {
			// 只剩 system 与最后一条消息，无法再丢
			break
		}
		j := i + 1
		for j < len(messages) && messageRole(messages[j]) == "tool" {
			j++
		}
		if j >= len(messages) {
			// 块延伸到最后一条消息：丢弃会留下孤儿 tool 或丢掉最新消息，停止裁剪
			break
		}
		for k := i; k < j; k++ {
			total -= counts[k]
		}
		messages = append(messages[:i], messages[j:]...)
		counts = append(counts[:i], counts[j:]...)
	}

	reqMap["messages"] = messages
	newBody, err := common.Marshal(reqMap)
	if err != nil {
		return nil, 0, 0, err
	}
	return newBody, before, total, nil
}

func messageRole(m any) string {
	mm, ok := m.(map[string]any)
	if !ok {
		return ""
	}
	role, _ := mm["role"].(string)
	return role
}

func firstNonSystemMessageIndex(messages []any) int {
	for i, m := range messages {
		if messageRole(m) != "system" && messageRole(m) != "developer" {
			return i
		}
	}
	return -1
}

func isImagePart(pm map[string]any) bool {
	partType, _ := pm["type"].(string)
	switch partType {
	case "image_url", "input_image", "image":
		return true
	}
	return false
}

// itemHasImagePart 判断 item 指定字段（part 数组）中是否包含图片
func itemHasImagePart(item any, field string) bool {
	mm, ok := item.(map[string]any)
	if !ok {
		return false
	}
	parts, ok := mm[field].([]any)
	if !ok {
		return false
	}
	for _, p := range parts {
		if pm, ok := p.(map[string]any); ok && isImagePart(pm) {
			return true
		}
	}
	return false
}

// stripImageParts 将 item 指定字段中的图片 part 替换为文本占位，返回是否有修改
func stripImageParts(mm map[string]any, field, textPartType string) bool {
	parts, ok := mm[field].([]any)
	if !ok {
		return false
	}
	changed := false
	newParts := make([]any, 0, len(parts))
	for _, p := range parts {
		pm, ok := p.(map[string]any)
		if !ok || !isImagePart(pm) {
			newParts = append(newParts, p)
			continue
		}
		newParts = append(newParts, map[string]any{"type": textPartType, "text": omittedImagePlaceholder})
		changed = true
	}
	if changed {
		mm[field] = newParts
	}
	return changed
}

// stripOldImageParts 剥离 items 中除最后一条含图 item 外的所有图片 part
// （chat messages 用 content 字段；responses input 另含 function_call_output
// 的 output 字段），返回是否有修改
func stripOldImageParts(items []any, fields []string, textPartType string) bool {
	lastImageIdx := -1
	for i, item := range items {
		for _, field := range fields {
			if itemHasImagePart(item, field) {
				lastImageIdx = i
				break
			}
		}
	}
	if lastImageIdx < 0 {
		return false
	}
	changed := false
	for i, item := range items {
		if i == lastImageIdx {
			continue
		}
		mm, ok := item.(map[string]any)
		if !ok {
			continue
		}
		for _, field := range fields {
			if stripImageParts(mm, field, textPartType) {
				changed = true
			}
		}
	}
	return changed
}

// stripAllImageParts 剥离 items 中所有图片 part（模型不支持图片时使用），
// 返回移除的图片数量与是否有修改。
func stripAllImageParts(items []any, fields []string, textPartType string) (int, bool) {
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
				if !ok || !isImagePart(pm) {
					newParts = append(newParts, p)
					continue
				}
				newParts = append(newParts, map[string]any{"type": textPartType, "text": imageRemovedPlaceholder})
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

func messageImageCount(m any) int {
	mm, ok := m.(map[string]any)
	if !ok {
		return 0
	}
	content, ok := mm["content"].([]any)
	if !ok {
		return 0
	}
	count := 0
	for _, p := range content {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		if isImagePart(pm) {
			count++
		}
	}
	return count
}

// perMessageTokenCounts 估算每条消息的 token 数（文本用 tokenizer，图片按固定值）
func perMessageTokenCounts(messages []any, model string) []int {
	counts := make([]int, len(messages))
	for i, m := range messages {
		mm, ok := m.(map[string]any)
		if !ok {
			continue
		}
		var sb strings.Builder
		sb.WriteString(messageRole(m))
		extractMessageText(mm["content"], &sb)
		if tc, ok := mm["tool_calls"].([]any); ok {
			if tcBytes, err := common.Marshal(tc); err == nil {
				sb.Write(tcBytes)
			}
		}
		if tcID, ok := mm["tool_call_id"].(string); ok {
			sb.WriteString(tcID)
		}
		counts[i] = service.CountTextToken(sb.String(), model) + 4
		counts[i] += messageImageCount(m) * flatImageTokenEstimate
	}
	return counts
}

func extractMessageText(content any, sb *strings.Builder) {
	switch v := content.(type) {
	case string:
		sb.WriteString(v)
	case []any:
		for _, p := range v {
			pm, ok := p.(map[string]any)
			if !ok {
				continue
			}
			if text, ok := pm["text"].(string); ok {
				sb.WriteString(text)
			}
		}
	}
}

func sumInts(nums []int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

// 单条消息内容的最大保留长度（rune 数），超过则中间省略
const singleMessageRuneCap = 60000
const singleMessageHeadKeep = 45000
const singleMessageTailKeep = 15000
const elidedContentMarker = "\n...[中间内容已省略]...\n"

// elideOversizedMessageContents 截断超长单条消息内容，保留头尾
func elideOversizedMessageContents(messages []any) {
	for _, m := range messages {
		mm, ok := m.(map[string]any)
		if !ok {
			continue
		}
		switch content := mm["content"].(type) {
		case string:
			mm["content"] = elideLongText(content)
		case []any:
			for _, p := range content {
				pm, ok := p.(map[string]any)
				if !ok {
					continue
				}
				if text, ok := pm["text"].(string); ok {
					pm["text"] = elideLongText(text)
				}
			}
		}
	}
}

func elideLongText(s string) string {
	runes := []rune(s)
	if len(runes) <= singleMessageRuneCap {
		return s
	}
	return string(runes[:singleMessageHeadKeep]) + elidedContentMarker + string(runes[len(runes)-singleMessageTailKeep:])
}

const toolPairingSanitizedKey = "tool_pairing_sanitized"
const toolPairingRecoveredKey = "tool_pairing_recovered"
const omittedToolResponsePlaceholder = "[工具调用结果已省略]"

func isToolPairingError(msg string) bool {
	lower := strings.ToLower(msg)
	return strings.Contains(lower, "must be a response to a preceding message with 'tool_calls'") ||
		strings.Contains(lower, "must be followed by tool messages") ||
		strings.Contains(lower, "no tool output found for tool call") ||
		strings.Contains(lower, "no output found for function call") ||
		(strings.Contains(lower, "tool_calls") && strings.Contains(lower, "preceding"))
}

// sanitizeToolCallPairing 修复 messages 中 tool/tool_calls 配对问题：
//  1. 删除孤儿 tool 消息（前面没有携带对应 tool_call_id 的 assistant 消息），
//     常见于客户端上下文压缩后残留
//  2. 为缺失响应的 tool_calls 补充占位 tool 消息，避免
//     "assistant message with 'tool_calls' must be followed by tool messages" 错误
//
// 返回处理后的消息列表与修改次数（0 表示无需改动）。
func sanitizeToolCallPairing(messages []any) ([]any, int) {
	changed := 0
	out := make([]any, 0, len(messages)+2)
	answerable := map[string]bool{} // 当前可响应的 tool_call_id（来自最近一条 assistant）
	var unanswered []string         // 最近一条 assistant 中尚未收到响应的 tool_call_id

	fabricateMissing := func() {
		for _, id := range unanswered {
			out = append(out, map[string]any{
				"role":         "tool",
				"tool_call_id": id,
				"content":      omittedToolResponsePlaceholder,
			})
			changed++
		}
		unanswered = nil
	}

	for _, m := range messages {
		role := messageRole(m)
		switch role {
		case "assistant":
			// 新 assistant 出现前，补齐上一条 assistant 缺失的响应
			fabricateMissing()
			answerable = map[string]bool{}
			out = append(out, m)
			if mm, ok := m.(map[string]any); ok {
				if tcs, ok := mm["tool_calls"].([]any); ok {
					for _, tc := range tcs {
						if tcm, ok := tc.(map[string]any); ok {
							if id, ok := tcm["id"].(string); ok && id != "" {
								answerable[id] = true
								unanswered = append(unanswered, id)
							}
						}
					}
				}
			}
		case "tool":
			mm, ok := m.(map[string]any)
			if !ok {
				out = append(out, m)
				continue
			}
			id, _ := mm["tool_call_id"].(string)
			if id != "" && answerable[id] {
				out = append(out, m)
				// 从 unanswered 中移除
				for i, u := range unanswered {
					if u == id {
						unanswered = append(unanswered[:i], unanswered[i+1:]...)
						break
					}
				}
			} else {
				// 孤儿 tool 消息，删除
				changed++
			}
		default:
			// user/system 等边界消息：tool 响应无法跨边界，先补齐再追加
			fabricateMissing()
			answerable = map[string]bool{}
			out = append(out, m)
		}
	}
	// 末尾 assistant 的未响应 tool_calls（会话结束于 tool 响应是合法的，
	// 但结束于 assistant(tool_calls) 且无响应会被上游拒绝，补占位）
	fabricateMissing()
	return out, changed
}

// sanitizeChatToolPairing 请求预清洗：修复 chat completions 请求体中的
// tool/tool_calls 配对问题，每个请求最多执行一次，仅在发现问题时改写请求。
func sanitizeChatToolPairing(c *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil || c.GetBool(toolPairingSanitizedKey) {
		return
	}
	c.Set(toolPairingSanitizedKey, true)

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil {
		return
	}

	var reqMap map[string]any
	if err := common.Unmarshal(raw, &reqMap); err != nil {
		return
	}
	messages, ok := reqMap["messages"].([]any)
	if !ok || len(messages) == 0 {
		return
	}

	sanitized, changed := sanitizeToolCallPairing(messages)
	if changed == 0 {
		return
	}
	reqMap["messages"] = sanitized
	newBody, err := common.Marshal(reqMap)
	if err != nil {
		return
	}

	// 同步更新 info.Request（非透传模式 relay 使用解析后的 DTO）
	if info.Request != nil {
		if err := common.Unmarshal(newBody, info.Request); err != nil {
			return
		}
	}
	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, newStorage)
	c.Request.Body = io.NopCloser(newStorage)
	logger.LogWarn(c, fmt.Sprintf("检测到 %d 处 tool/tool_calls 配对问题（客户端上下文压缩残留），已自动修复", changed))
}

// tryToolPairingRecovery 上游仍报 tool 配对错误时的兜底恢复：强制清洗后原地重试一次
func tryToolPairingRecovery(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) bool {
	if !constant.ContextOverflowAutoRecovery || apiErr == nil || info == nil {
		return false
	}
	if c.GetBool(toolPairingRecoveredKey) {
		return false
	}
	if !isToolPairingError(apiErr.Error()) {
		return false
	}
	c.Set(toolPairingRecoveredKey, true)
	// 重置预清洗标记，强制再清洗一次
	c.Set(toolPairingSanitizedKey, false)
	sanitizeChatToolPairing(c, info)
	return true
}

const payloadRecoveredKey = "payload_too_large_recovered"

const payloadCompressRecoveredKey = "payload_too_large_compress_recovered"

// tryPayloadTooLargeRecovery 检测上游 413 Payload Too Large 错误（请求体字节数超限，
// 常见于会话累积大量 base64 图片），剥离历史图片后用同一渠道原地重试一次。
// 与 context 超长恢复互补：413 是字节级超限，与 token 估算无关。
func tryPayloadTooLargeRecovery(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) bool {
	if !constant.ContextOverflowAutoRecovery || apiErr == nil || info == nil {
		return false
	}
	if apiErr.StatusCode != http.StatusRequestEntityTooLarge {
		return false
	}
	if c.GetBool(payloadRecoveredKey) {
		return false
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false
	}
	raw, err := storage.Bytes()
	if err != nil {
		return false
	}

	var reqMap map[string]any
	if err := common.Unmarshal(raw, &reqMap); err != nil {
		return false
	}

	stripped := false
	// chat completions：messages 数组，文本 part 类型为 text
	if messages, ok := reqMap["messages"].([]any); ok && len(messages) > 0 {
		if stripOldImageParts(messages, []string{"content"}, "text") {
			reqMap["messages"] = messages
			stripped = true
		}
	}
	// responses：input 数组，message 的 content 与 function_call_output 的 output
	// 均可能含图片 part，文本 part 类型为 input_text
	if input, ok := reqMap["input"].([]any); ok && len(input) > 0 {
		if stripOldImageParts(input, []string{"content", "output"}, "input_text") {
			reqMap["input"] = input
			stripped = true
		}
	}
	if !stripped {
		return false
	}

	newBody, err := common.Marshal(reqMap)
	if err != nil {
		return false
	}
	// 更新 info.Request（非透传模式 relay 使用解析后的 DTO，而非重读 body）
	if info.Request != nil {
		if err := common.Unmarshal(newBody, info.Request); err != nil {
			return false
		}
	}
	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return false
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, newStorage)
	c.Request.Body = io.NopCloser(newStorage)
	c.Set(payloadRecoveredKey, true)
	c.Header("X-Payload-Truncated", fmt.Sprintf("%d->%d", len(raw), len(newBody)))
	logger.LogWarn(c, fmt.Sprintf("上游 413 Payload Too Large，已剥离历史图片（请求体 %d -> %d 字节）并重试", len(raw), len(newBody)))
	return true
}

// tryPayloadTooLargeCompressRecovery 检测上游 413 且请求中无可剥离的历史图片时
// （如单张超大参考图），压缩请求内的 base64 图片（降采样 + JPEG 重编码）后
// 用同一渠道原地重试一次。与 tryPayloadTooLargeRecovery 互补：
// 先剥离历史图片，仍 413 再压缩剩余图片。
func tryPayloadTooLargeCompressRecovery(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) bool {
	if !constant.ContextOverflowAutoRecovery || apiErr == nil || info == nil {
		return false
	}
	if apiErr.StatusCode != http.StatusRequestEntityTooLarge {
		return false
	}
	if c.GetBool(payloadCompressRecoveredKey) {
		return false
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false
	}
	raw, err := storage.Bytes()
	if err != nil {
		return false
	}

	var reqMap map[string]any
	if err := common.Unmarshal(raw, &reqMap); err != nil {
		return false
	}

	if !compressImagesInBody(reqMap) {
		return false
	}

	newBody, err := common.Marshal(reqMap)
	if err != nil {
		return false
	}
	if len(newBody) >= len(raw) {
		return false
	}

	// 更新 info.Request（非透传模式 relay 使用解析后的 DTO，而非重新读 body）
	if info.Request != nil {
		if err := common.Unmarshal(newBody, info.Request); err != nil {
			return false
		}
	}
	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return false
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, newStorage)
	c.Request.Body = io.NopCloser(newStorage)
	c.Set(payloadCompressRecoveredKey, true)
	c.Header("X-Images-Compressed", fmt.Sprintf("%d->%d", len(raw), len(newBody)))
	logger.LogWarn(c, fmt.Sprintf("上游 413 Payload Too Large，已压缩请求内图片（请求体 %d -> %d 字节）并重试", len(raw), len(newBody)))
	return true
}

// compressImagesInBody 压缩 chat completions / responses 请求体中的 base64 图片 part，
// 返回是否有图片被压缩替换。
func compressImagesInBody(reqMap map[string]any) bool {
	changed := false
	if messages, ok := reqMap["messages"].([]any); ok {
		for _, m := range messages {
			if mm, ok := m.(map[string]any); ok && compressImageParts(mm, "content") {
				changed = true
			}
		}
	}
	if input, ok := reqMap["input"].([]any); ok {
		for _, item := range input {
			if mm, ok := item.(map[string]any); ok {
				if compressImageParts(mm, "content") {
					changed = true
				}
				if compressImageParts(mm, "output") {
					changed = true
				}
			}
		}
	}
	return changed
}

// compressImageParts 压缩 item 指定字段（part 数组）中的图片 part
func compressImageParts(mm map[string]any, field string) bool {
	parts, ok := mm[field].([]any)
	if !ok {
		return false
	}
	changed := false
	for _, p := range parts {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		partType, _ := pm["type"].(string)
		switch partType {
		case "image_url", "input_image", "image":
			if v, ok := pm["image_url"]; ok {
				if nv, ch := compressImageURLValue(v); ch {
					pm["image_url"] = nv
					changed = true
				}
			}
		}
	}
	return changed
}

// compressImageURLValue 压缩单个 image_url 值（字符串或 {url: ...} 对象）
func compressImageURLValue(v any) (any, bool) {
	switch vv := v.(type) {
	case string:
		nv, err := service.CompressImageDataURL(vv)
		if err != nil {
			return v, false
		}
		return nv, true
	case map[string]any:
		url, _ := vv["url"].(string)
		nv, err := service.CompressImageDataURL(url)
		if err != nil {
			return v, false
		}
		vv["url"] = nv
		return vv, true
	default:
		return v, false
	}
}

// tryImageUnsupportedRecovery 检测上游"模型不支持图片输入"错误，剥离请求中
// 所有图片（替换为提示占位文本）后用同一渠道原地重试一次，实现用户无感；
// 通过占位文本与响应头 X-Images-Removed 提示用户图片已被剔除。
func tryImageUnsupportedRecovery(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) bool {
	if !constant.ContextOverflowAutoRecovery || apiErr == nil || info == nil {
		return false
	}
	if c.GetBool(imageUnsupportedRecoveredKey) {
		return false
	}
	if !isImageUnsupportedError(apiErr.Error()) {
		return false
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false
	}
	raw, err := storage.Bytes()
	if err != nil {
		return false
	}

	var reqMap map[string]any
	if err := common.Unmarshal(raw, &reqMap); err != nil {
		return false
	}

	removed := 0
	// chat completions：messages 数组，文本 part 类型为 text
	if messages, ok := reqMap["messages"].([]any); ok && len(messages) > 0 {
		if n, ch := stripAllImageParts(messages, []string{"content"}, "text"); ch {
			reqMap["messages"] = messages
			removed = n
		}
	}
	// responses：input 数组，message 的 content 与 function_call_output 的 output
	// 均可能含图片 part，文本 part 类型为 input_text
	if input, ok := reqMap["input"].([]any); ok && len(input) > 0 {
		if n, ch := stripAllImageParts(input, []string{"content", "output"}, "input_text"); ch {
			reqMap["input"] = input
			removed += n
		}
	}
	if removed == 0 {
		return false
	}

	newBody, err := common.Marshal(reqMap)
	if err != nil {
		return false
	}
	// 更新 info.Request（非透传模式 relay 使用解析后的 DTO，而非重新读 body）
	if info.Request != nil {
		if err := common.Unmarshal(newBody, info.Request); err != nil {
			return false
		}
	}
	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return false
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, newStorage)
	c.Set(imageUnsupportedRecoveredKey, true)
	c.Header("X-Images-Removed", strconv.Itoa(removed))
	logger.LogWarn(c, fmt.Sprintf("上游不支持图片输入，已移除 %d 张图片（占位提示）并重试", removed))
	return true
}
