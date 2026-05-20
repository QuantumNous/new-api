package service

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

type OpenAIResponsesPromptCacheKeyResult struct {
	Key    string
	Source string
	OK     bool
}

var openAIResponsesPromptCacheHeaderSources = []struct {
	header string
	source string
}{
	{header: "X-Prompt-Cache-Key", source: "header.x_prompt_cache_key"},
	{header: "X-OpenAI-Prompt-Cache-Key", source: "header.x_openai_prompt_cache_key"},
	{header: "Session_id", source: "header.session_id"},
	{header: "Session-Id", source: "header.session_id"},
	{header: "X-Codex-Session-Id", source: "header.x_codex_session_id"},
	{header: "X-Session-Id", source: "header.x_session_id"},
}

func ApplyOpenAIResponsesAutoPromptCacheKey(c *gin.Context, req *dto.OpenAIResponsesRequest) (OpenAIResponsesPromptCacheKeyResult, bool) {
	result := BuildOpenAIResponsesPromptCacheKey(c, req)
	if !result.OK || result.Source == "prompt_cache_key" || req == nil {
		return result, false
	}

	raw, err := common.Marshal(result.Key)
	if err != nil {
		return OpenAIResponsesPromptCacheKeyResult{}, false
	}
	req.PromptCacheKey = raw
	return result, true
}

func BuildOpenAIResponsesPromptCacheKeyFromContext(c *gin.Context) OpenAIResponsesPromptCacheKeyResult {
	if c == nil || c.Request == nil {
		return OpenAIResponsesPromptCacheKeyResult{}
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return OpenAIResponsesPromptCacheKeyResult{}
	}
	body, err := storage.Bytes()
	if err != nil || len(body) == 0 {
		return OpenAIResponsesPromptCacheKeyResult{}
	}

	var req dto.OpenAIResponsesRequest
	if err := common.Unmarshal(body, &req); err != nil {
		return OpenAIResponsesPromptCacheKeyResult{}
	}
	return BuildOpenAIResponsesPromptCacheKey(c, &req)
}

func BuildOpenAIResponsesPromptCacheKey(c *gin.Context, req *dto.OpenAIResponsesRequest) OpenAIResponsesPromptCacheKeyResult {
	if req == nil {
		return openAIResponsesPromptCacheKeyFromHeaders(c)
	}
	if key := openAIResponsesRawString(req.PromptCacheKey); key != "" {
		return OpenAIResponsesPromptCacheKeyResult{
			Key:    key,
			Source: "prompt_cache_key",
			OK:     true,
		}
	}
	if userID := openAIResponsesMetadataString(req.Metadata, "user_id"); userID != "" {
		return buildOpenAIResponsesAutoPromptCacheKey("metadata.user_id", userID)
	}
	if sessionID := openAIResponsesMetadataString(req.Metadata, "session_id"); sessionID != "" {
		return buildOpenAIResponsesAutoPromptCacheKey("metadata.session_id", sessionID)
	}
	if user := openAIResponsesRawString(req.User); user != "" {
		return buildOpenAIResponsesAutoPromptCacheKey("user", user)
	}
	return openAIResponsesPromptCacheKeyFromHeaders(c)
}

func openAIResponsesPromptCacheKeyFromHeaders(c *gin.Context) OpenAIResponsesPromptCacheKeyResult {
	if c == nil || c.Request == nil {
		return OpenAIResponsesPromptCacheKeyResult{}
	}
	for _, item := range openAIResponsesPromptCacheHeaderSources {
		value := strings.TrimSpace(c.Request.Header.Get(item.header))
		if value == "" {
			continue
		}
		return buildOpenAIResponsesAutoPromptCacheKey(item.source, value)
	}
	return OpenAIResponsesPromptCacheKeyResult{}
}

func openAIResponsesRawString(raw []byte) string {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return ""
	}

	var value string
	if err := common.Unmarshal(raw, &value); err == nil {
		return strings.TrimSpace(value)
	}
	return s
}

func openAIResponsesMetadataString(raw []byte, key string) string {
	if len(raw) == 0 {
		return ""
	}
	var metadata map[string]interface{}
	if err := common.Unmarshal(raw, &metadata); err != nil {
		return ""
	}
	return strings.TrimSpace(common.Interface2String(metadata[key]))
}

func buildOpenAIResponsesAutoPromptCacheKey(source, value string) OpenAIResponsesPromptCacheKeyResult {
	source = strings.TrimSpace(source)
	value = strings.TrimSpace(value)
	if source == "" || value == "" {
		return OpenAIResponsesPromptCacheKeyResult{}
	}

	sum := sha256.Sum256([]byte(source + "\n" + value))
	hexHash := hex.EncodeToString(sum[:])
	return OpenAIResponsesPromptCacheKeyResult{
		Key:    "resp-cache-" + openAIResponsesPromptCacheSourceSlug(source) + "-" + hexHash[:32],
		Source: source,
		OK:     true,
	}
}

func openAIResponsesPromptCacheSourceSlug(source string) string {
	source = strings.ToLower(strings.TrimSpace(source))
	var b strings.Builder
	lastDash := false
	for _, r := range source {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	slug := strings.Trim(b.String(), "-")
	if len(slug) > 18 {
		slug = strings.Trim(slug[:18], "-")
	}
	if slug == "" {
		return "source"
	}
	return slug
}
