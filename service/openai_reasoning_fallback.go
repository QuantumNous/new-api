package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const (
	ginKeyOpenAIReasoningEncryptedContentHash    = "openai_reasoning_encrypted_content_hash"
	ginKeyOpenAIReasoningDropEncryptedContent    = "openai_reasoning_drop_encrypted_content"
	ginKeyOpenAIReasoningDropApplied             = "openai_reasoning_drop_applied"
	ginKeyOpenAIReasoningSignatureRetryAttempted = "openai_reasoning_signature_retry_attempted"

	openAIReasoningFallbackCacheNamespace = "new-api:openai_reasoning_fallback:v1"
	openAIReasoningFallbackCacheCapacity  = 100_000
	openAIReasoningFallbackTTL            = 24 * time.Hour
)

var (
	openAIReasoningFallbackCacheOnce sync.Once
	openAIReasoningFallbackCache     *cachex.HybridCache[int]
)

func getOpenAIReasoningFallbackCache() *cachex.HybridCache[int] {
	openAIReasoningFallbackCacheOnce.Do(func() {
		openAIReasoningFallbackCache = cachex.NewHybridCache[int](cachex.HybridCacheConfig[int]{
			Namespace: cachex.Namespace(openAIReasoningFallbackCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.IntCodec{},
			Memory: func() *hot.HotCache[string, int] {
				return hot.NewHotCache[string, int](hot.LRU, openAIReasoningFallbackCacheCapacity).
					WithTTL(openAIReasoningFallbackTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return openAIReasoningFallbackCache
}

// PrepareOpenAIResponsesReasoningInput applies the Responses API fallback when
// the selected channel enables it or the current request already entered the
// recovery flow. The latter keeps the forced retry effective if routing falls
// back to another OpenAI channel that has the setting disabled. A later,
// independent request still needs an enabled channel before consulting the
// learned conversation cache.
func PrepareOpenAIResponsesReasoningInput(c *gin.Context, input []byte, channelEnabled bool) ([]byte, int, error) {
	dropEncryptedContent := c.GetBool(ginKeyOpenAIReasoningDropEncryptedContent)
	if !channelEnabled && !dropEncryptedContent {
		return input, 0, nil
	}

	items := gjson.ParseBytes(input)
	if !items.IsArray() {
		return input, 0, nil
	}

	firstEncryptedContent := ""
	items.ForEach(func(_, item gjson.Result) bool {
		if item.Get("type").String() != "reasoning" {
			return true
		}
		encryptedContent := item.Get("encrypted_content")
		if encryptedContent.Exists() && encryptedContent.Type == gjson.String && encryptedContent.String() != "" {
			firstEncryptedContent = encryptedContent.String()
			return false
		}
		return true
	})
	if firstEncryptedContent == "" {
		return input, 0, nil
	}

	hash := sha256.Sum256([]byte(firstEncryptedContent))
	cacheKey := hex.EncodeToString(hash[:])
	c.Set(ginKeyOpenAIReasoningEncryptedContentHash, cacheKey)

	if !dropEncryptedContent {
		_, found, err := getOpenAIReasoningFallbackCache().Get(cacheKey)
		if err != nil {
			logger.LogWarn(c, fmt.Sprintf("openai reasoning fallback cache get failed: %v", err))
		} else if found {
			dropEncryptedContent = true
			c.Set(ginKeyOpenAIReasoningDropEncryptedContent, true)
			if err := getOpenAIReasoningFallbackCache().SetWithTTL(cacheKey, 1, openAIReasoningFallbackTTL); err != nil {
				logger.LogWarn(c, fmt.Sprintf("openai reasoning fallback cache ttl refresh failed: %v", err))
			}
		}
	}
	if !dropEncryptedContent {
		return input, 0, nil
	}

	result := input
	removed := 0
	index := 0
	var deleteErr error
	items.ForEach(func(_, item gjson.Result) bool {
		if item.Get("type").String() == "reasoning" && item.Get("encrypted_content").Exists() {
			result, deleteErr = sjson.DeleteBytes(result, fmt.Sprintf("%d.encrypted_content", index))
			if deleteErr != nil {
				return false
			}
			removed++
		}
		index++
		return true
	})
	if deleteErr != nil {
		return input, 0, fmt.Errorf("remove reasoning encrypted_content: %w", deleteErr)
	}
	if removed > 0 {
		c.Set(ginKeyOpenAIReasoningDropApplied, true)
	}
	return result, removed, nil
}

// MarkOpenAIReasoningSignatureInvalid records the conversation fallback and
// enables one immediate retry for the current request. The cache write is best
// effort; the current retry still removes encrypted_content if Redis is down.
func MarkOpenAIReasoningSignatureInvalid(c *gin.Context) bool {
	if c == nil || c.GetBool(ginKeyOpenAIReasoningDropApplied) || c.GetBool(ginKeyOpenAIReasoningSignatureRetryAttempted) {
		return false
	}
	cacheKey := c.GetString(ginKeyOpenAIReasoningEncryptedContentHash)
	if cacheKey == "" {
		return false
	}

	c.Set(ginKeyOpenAIReasoningSignatureRetryAttempted, true)
	c.Set(ginKeyOpenAIReasoningDropEncryptedContent, true)
	if err := getOpenAIReasoningFallbackCache().SetWithTTL(cacheKey, 1, openAIReasoningFallbackTTL); err != nil {
		logger.LogWarn(c, fmt.Sprintf("openai reasoning fallback cache set failed: %v", err))
	}
	return true
}
