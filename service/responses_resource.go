package service

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/cachex"

	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
)

const (
	responsesResourceCacheNamespace = "new-api:responses_resource:v1"
	responsesResourceDefaultTTL     = 30 * 24 * time.Hour
	responsesResourceCacheCapacity  = 100_000
)

type ResponsesResourceRoute struct {
	ChannelID            int    `json:"channel_id"`
	ChannelIsMultiKey    bool   `json:"channel_is_multi_key"`
	ChannelMultiKeyIndex int    `json:"channel_multi_key_index"`
	OriginModelName      string `json:"origin_model_name"`
	UpstreamResponsesURL string `json:"upstream_responses_url"`
}

var (
	responsesResourceCacheOnce sync.Once
	responsesResourceCache     *cachex.HybridCache[ResponsesResourceRoute]
)

func getResponsesResourceCache() *cachex.HybridCache[ResponsesResourceRoute] {
	responsesResourceCacheOnce.Do(func() {
		responsesResourceCache = cachex.NewHybridCache[ResponsesResourceRoute](cachex.HybridCacheConfig[ResponsesResourceRoute]{
			Namespace: cachex.Namespace(responsesResourceCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[ResponsesResourceRoute]{},
			Memory: func() *hot.HotCache[string, ResponsesResourceRoute] {
				return hot.NewHotCache[string, ResponsesResourceRoute](hot.LRU, responsesResourceCacheCapacity).
					WithTTL(responsesResourceDefaultTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return responsesResourceCache
}

func responsesResourceCacheKey(userID int, responseID string) string {
	return strconv.Itoa(userID) + ":" + strings.TrimSpace(responseID)
}

func RecordResponsesResourceRoute(c *gin.Context, responseID string, expiresAt int64, upstreamResponsesURL string) error {
	responseID = strings.TrimSpace(responseID)
	if c == nil || responseID == "" || strings.TrimSpace(upstreamResponsesURL) == "" {
		return nil
	}

	parsedURL, err := url.Parse(upstreamResponsesURL)
	if err != nil {
		return fmt.Errorf("parse upstream responses URL: %w", err)
	}
	parsedURL.RawQuery = removeSensitiveQueryValues(parsedURL.Query()).Encode()

	ttl := responsesResourceDefaultTTL
	if expiresAt > 0 {
		untilExpiry := time.Until(time.Unix(expiresAt, 0))
		if untilExpiry > 0 {
			ttl = untilExpiry
		}
	}

	route := ResponsesResourceRoute{
		ChannelID:            common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelIsMultiKey:    common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey),
		ChannelMultiKeyIndex: common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex),
		OriginModelName:      common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		UpstreamResponsesURL: parsedURL.String(),
	}
	return getResponsesResourceCache().SetWithTTL(
		responsesResourceCacheKey(common.GetContextKeyInt(c, constant.ContextKeyUserId), responseID),
		route,
		ttl,
	)
}

func GetResponsesResourceRoute(c *gin.Context, responseID string) (ResponsesResourceRoute, bool, error) {
	if c == nil {
		return ResponsesResourceRoute{}, false, nil
	}
	return getResponsesResourceCache().Get(
		responsesResourceCacheKey(common.GetContextKeyInt(c, constant.ContextKeyUserId), responseID),
	)
}

func DeleteResponsesResourceRoute(c *gin.Context, responseID string) error {
	if c == nil {
		return nil
	}
	key := responsesResourceCacheKey(common.GetContextKeyInt(c, constant.ContextKeyUserId), responseID)
	_, err := getResponsesResourceCache().DeleteMany([]string{key})
	return err
}

func BuildResponsesResourceURL(upstreamResponsesURL string, responseID string, inputItems bool, query url.Values) (string, error) {
	parsedURL, err := url.Parse(upstreamResponsesURL)
	if err != nil {
		return "", fmt.Errorf("parse upstream responses URL: %w", err)
	}

	parsedURL.Path = strings.TrimSuffix(parsedURL.Path, "/") + "/" + url.PathEscape(strings.TrimSpace(responseID))
	if inputItems {
		parsedURL.Path += "/input_items"
	}

	mergedQuery := parsedURL.Query()
	for key, values := range query {
		mergedQuery.Del(key)
		for _, value := range values {
			mergedQuery.Add(key, value)
		}
	}
	parsedURL.RawQuery = removeSensitiveQueryValues(mergedQuery).Encode()
	return parsedURL.String(), nil
}

func removeSensitiveQueryValues(query url.Values) url.Values {
	for key := range query {
		normalized := strings.ToLower(strings.TrimSpace(key))
		if strings.Contains(normalized, "key") ||
			strings.Contains(normalized, "token") ||
			strings.Contains(normalized, "secret") ||
			strings.Contains(normalized, "signature") ||
			normalized == "authorization" ||
			normalized == "auth" {
			query.Del(key)
		}
	}
	return query
}
