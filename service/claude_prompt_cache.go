package service

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

const claudeCodeBillingHeaderPrefix = "x-anthropic-billing-header:"

// ClaudePromptCacheKeyResult 表示 Anthropic-compatible 请求派生 prompt cache key 的结果。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：承载 OpenAI Responses prompt_cache_key 以及派生来源，供转换链路复用。
// 参数说明：无。
// 返回值说明：无；该类型通过字段表达 Key、Source 和 OK 状态。
type ClaudePromptCacheKeyResult struct {
	Key    string
	Source string
	OK     bool
}

// BuildClaudePromptCacheKey 从 Anthropic-compatible 请求中派生 OpenAI Responses prompt_cache_key。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：优先从 dto.ClaudeRequest.Metadata.user_id 提取稳定 cache key；缺失时根据 Anthropic cache_control 断点派生稳定前缀 hash。
// 参数说明：req 为待转换的 Anthropic-compatible 请求，可为 nil。
// 返回值说明：返回 ClaudePromptCacheKeyResult；OK 为 true 时 Key 可用于 Responses prompt_cache_key，Source 标识来源。
func BuildClaudePromptCacheKey(req *dto.ClaudeRequest) ClaudePromptCacheKeyResult {
	if req == nil {
		return ClaudePromptCacheKeyResult{}
	}

	if userID := extractClaudeMetadataUserID(req); userID != "" {
		return ClaudePromptCacheKeyResult{
			Key:    userID,
			Source: "metadata.user_id",
			OK:     true,
		}
	}

	prefix, ok := buildClaudeCacheControlPrefix(req)
	if !ok {
		return ClaudePromptCacheKeyResult{}
	}

	hashInput, err := common.Marshal(prefix)
	if err != nil {
		return ClaudePromptCacheKeyResult{}
	}
	sum := sha256.Sum256(hashInput)
	hexHash := hex.EncodeToString(sum[:])
	return ClaudePromptCacheKeyResult{
		Key:    "claude-cache-" + hexHash[:32],
		Source: "cache_control.prefix_hash",
		OK:     true,
	}
}

type claudePromptCachePrefixPayload struct {
	Model    string                                  `json:"model"`
	Prompt   string                                  `json:"prompt,omitempty"`
	Tools    any                                     `json:"tools,omitempty"`
	System   any                                     `json:"system,omitempty"`
	Messages []claudePromptCachePrefixPayloadMessage `json:"messages,omitempty"`
}

type claudePromptCachePrefixPayloadMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

func extractClaudeMetadataUserID(req *dto.ClaudeRequest) string {
	if len(req.Metadata) == 0 {
		return ""
	}
	var metadata struct {
		UserID string `json:"user_id"`
	}
	if err := common.Unmarshal(req.Metadata, &metadata); err != nil {
		return ""
	}
	return strings.TrimSpace(metadata.UserID)
}

// isClaudeCodeBillingHeaderText 判断文本是否为 Claude Code 动态 billing attribution block。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：识别 Claude Code 注入到 system 开头的 x-anthropic-billing-header，避免其污染 Responses prompt cache 前缀。
// 参数说明：text 为待判断文本。
// 返回值说明：返回 true 表示该文本是 Claude Code billing attribution block。
func isClaudeCodeBillingHeaderText(text string) bool {
	return strings.HasPrefix(strings.TrimSpace(text), claudeCodeBillingHeaderPrefix)
}

// isClaudeCodeBillingHeaderBlock 判断 system block 是否为 Claude Code 动态 billing attribution block。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：供 Anthropic -> Responses 兼容转换和 prompt cache key 派生共用同一过滤规则。
// 参数说明：block 为 Anthropic system/content block。
// 返回值说明：返回 true 表示该 block 应在 Responses 兼容链路中过滤。
func isClaudeCodeBillingHeaderBlock(block dto.ClaudeMediaMessage) bool {
	if block.Text == nil {
		return false
	}
	return isClaudeCodeBillingHeaderText(*block.Text)
}

func buildClaudeCacheControlPrefix(req *dto.ClaudeRequest) (claudePromptCachePrefixPayload, bool) {
	current := claudePromptCachePrefixPayload{
		Model: req.Model,
	}
	if req.Prompt != "" {
		current.Prompt = req.Prompt
	}

	var last claudePromptCachePrefixPayload
	found := false
	saveBreakpoint := func() {
		if snapshot, ok := cloneClaudePromptCachePrefix(current); ok {
			last = snapshot
			found = true
		}
	}

	if req.Tools != nil {
		if tools, ok := normalizeClaudePromptCacheValue(req.Tools); ok {
			current.Tools = tools
		}
	}
	if hasSupportedClaudeCacheControl(req.CacheControl) {
		saveBreakpoint()
	}

	appendSystemCachePrefix(req.System, &current, saveBreakpoint)
	appendMessagesCachePrefix(req.Messages, &current, saveBreakpoint)

	return last, found
}

func appendSystemCachePrefix(system any, current *claudePromptCachePrefixPayload, saveBreakpoint func()) {
	if system == nil {
		return
	}
	if systemText, ok := system.(string); ok {
		if isClaudeCodeBillingHeaderText(systemText) {
			return
		}
		current.System = systemText
		return
	}

	blocks, ok := claudePromptCacheMediaBlocks(system)
	if !ok {
		if normalized, ok := normalizeClaudePromptCacheValue(system); ok {
			current.System = normalized
		}
		return
	}

	normalizedBlocks := make([]any, 0, len(blocks))
	for _, block := range blocks {
		if isClaudeCodeBillingHeaderBlock(block) {
			continue
		}
		normalizedBlock, ok := normalizeClaudePromptCacheMediaBlock(block)
		if !ok {
			continue
		}
		normalizedBlocks = append(normalizedBlocks, normalizedBlock)
		current.System = normalizedBlocks
		if hasSupportedClaudeCacheControl(block.CacheControl) {
			saveBreakpoint()
		}
	}
}

func appendMessagesCachePrefix(messages []dto.ClaudeMessage, current *claudePromptCachePrefixPayload, saveBreakpoint func()) {
	for _, message := range messages {
		if content, ok := message.Content.(string); ok {
			current.Messages = append(current.Messages, claudePromptCachePrefixPayloadMessage{
				Role:    message.Role,
				Content: content,
			})
			continue
		}

		blocks, ok := claudePromptCacheMediaBlocks(message.Content)
		if !ok {
			normalized, normalizedOK := normalizeClaudePromptCacheValue(message.Content)
			if !normalizedOK {
				continue
			}
			current.Messages = append(current.Messages, claudePromptCachePrefixPayloadMessage{
				Role:    message.Role,
				Content: normalized,
			})
			continue
		}

		normalizedBlocks := make([]any, 0, len(blocks))
		current.Messages = append(current.Messages, claudePromptCachePrefixPayloadMessage{
			Role:    message.Role,
			Content: normalizedBlocks,
		})
		messageIndex := len(current.Messages) - 1
		for _, block := range blocks {
			normalizedBlock, normalizedOK := normalizeClaudePromptCacheMediaBlock(block)
			if !normalizedOK {
				continue
			}
			normalizedBlocks = append(normalizedBlocks, normalizedBlock)
			current.Messages[messageIndex].Content = normalizedBlocks
			if hasSupportedClaudeCacheControl(block.CacheControl) {
				saveBreakpoint()
			}
		}
	}
}

func claudePromptCacheMediaBlocks(content any) ([]dto.ClaudeMediaMessage, bool) {
	switch typed := content.(type) {
	case []dto.ClaudeMediaMessage:
		return typed, true
	case []any:
		blocks := make([]dto.ClaudeMediaMessage, 0, len(typed))
		for _, item := range typed {
			block, ok := claudePromptCacheMediaBlock(item)
			if !ok {
				return nil, false
			}
			blocks = append(blocks, block)
		}
		return blocks, true
	default:
		var blocks []dto.ClaudeMediaMessage
		data, err := common.Marshal(content)
		if err != nil {
			return nil, false
		}
		if err := common.Unmarshal(data, &blocks); err != nil {
			return nil, false
		}
		return blocks, true
	}
}

func claudePromptCacheMediaBlock(content any) (dto.ClaudeMediaMessage, bool) {
	if block, ok := content.(dto.ClaudeMediaMessage); ok {
		return block, true
	}
	var block dto.ClaudeMediaMessage
	data, err := common.Marshal(content)
	if err != nil {
		return dto.ClaudeMediaMessage{}, false
	}
	if err := common.Unmarshal(data, &block); err != nil {
		return dto.ClaudeMediaMessage{}, false
	}
	return block, true
}

func normalizeClaudePromptCacheMediaBlock(block dto.ClaudeMediaMessage) (any, bool) {
	block.CacheControl = nil
	return normalizeClaudePromptCacheValue(block)
}

func normalizeClaudePromptCacheValue(value any) (any, bool) {
	data, err := common.Marshal(value)
	if err != nil {
		return nil, false
	}
	var normalized any
	if err := common.Unmarshal(data, &normalized); err != nil {
		return nil, false
	}
	return normalized, true
}

func cloneClaudePromptCachePrefix(prefix claudePromptCachePrefixPayload) (claudePromptCachePrefixPayload, bool) {
	data, err := common.Marshal(prefix)
	if err != nil {
		return claudePromptCachePrefixPayload{}, false
	}
	var cloned claudePromptCachePrefixPayload
	if err := common.Unmarshal(data, &cloned); err != nil {
		return claudePromptCachePrefixPayload{}, false
	}
	return cloned, true
}

func hasSupportedClaudeCacheControl(cacheControl []byte) bool {
	if len(cacheControl) == 0 {
		return false
	}
	var metadata struct {
		Type string `json:"type"`
	}
	if err := common.Unmarshal(cacheControl, &metadata); err != nil {
		return false
	}
	return strings.TrimSpace(metadata.Type) != ""
}
