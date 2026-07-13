package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
)

const (
	ginKeyRefusalFallbackMeta    = "refusal_fallback_meta"
	ginKeyRefusalFallbackUsed    = "refusal_fallback_used"
	ginKeyRefusalFallbackLogInfo = "refusal_fallback_log_info"

	refusalFallbackCacheNamespace = "new-api:refusal_fallback:v1"
	refusalFallbackCacheCapacity  = 100_000
)

var (
	refusalFallbackCacheOnce sync.Once
	refusalFallbackCache     *cachex.HybridCache[string]
	refusalFallbackRegexes   sync.Map
)

type refusalFallbackMeta struct {
	CacheKey        string
	Active          bool
	RuleName        string
	ModelName       string
	UsingGroup      string
	RequestPath     string
	FallbackGroup   string
	CooldownSeconds int
}

func getRefusalFallbackCache() *cachex.HybridCache[string] {
	refusalFallbackCacheOnce.Do(func() {
		refusalFallbackCache = cachex.NewHybridCache[string](cachex.HybridCacheConfig[string]{
			Namespace: cachex.Namespace(refusalFallbackCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.StringCodec{},
			Memory: func() *hot.HotCache[string, string] {
				return hot.NewHotCache[string, string](hot.LRU, refusalFallbackCacheCapacity).
					WithTTL(time.Hour).
					WithJanitor().
					Build()
			},
		})
	})
	return refusalFallbackCache
}

func matchRefusalFallbackRegex(patterns []string, value string) bool {
	for _, pattern := range patterns {
		compiledAny, found := refusalFallbackRegexes.Load(pattern)
		if !found {
			compiled, err := regexp.Compile(pattern)
			if err != nil {
				continue
			}
			compiledAny, _ = refusalFallbackRegexes.LoadOrStore(pattern, compiled)
		}
		compiled, ok := compiledAny.(*regexp.Regexp)
		if ok && compiled.MatchString(value) {
			return true
		}
	}
	return false
}

func refusalFallbackGroupMatches(groups []string, usingGroup string) bool {
	if len(groups) == 0 {
		return true
	}
	for _, group := range groups {
		if strings.TrimSpace(group) == usingGroup {
			return true
		}
	}
	return false
}

func buildRefusalFallbackCacheKey(rule operation_setting.RefusalFallbackRule, tokenID int, modelName, usingGroup string) string {
	payload := fmt.Sprintf(
		"%s\x00%s\x00%d\x00%d\x00%s\x00%s",
		strings.TrimSpace(rule.Name),
		strings.TrimSpace(rule.FallbackGroup),
		rule.CooldownSeconds,
		tokenID,
		modelName,
		usingGroup,
	)
	digest := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(digest[:])
}

// GetRefusalFallbackGroup returns an active fallback routing group for the stable
// token/model/group scope. A matching inactive rule is retained on the Gin
// context so a refusal observed later in the request can activate it.
func GetRefusalFallbackGroup(c *gin.Context, modelName, usingGroup string) (string, bool) {
	setting := operation_setting.GetRefusalFallbackSetting()
	if c == nil || setting == nil || !setting.Enabled || modelName == "" {
		return "", false
	}
	tokenID := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	if tokenID <= 0 {
		return "", false
	}

	requestPath := ""
	if c.Request != nil && c.Request.URL != nil {
		requestPath = c.Request.URL.Path
	}

	for _, rule := range setting.Rules {
		if !matchRefusalFallbackRegex(rule.ModelRegex, modelName) {
			continue
		}
		if len(rule.PathRegex) > 0 && !matchRefusalFallbackRegex(rule.PathRegex, requestPath) {
			continue
		}
		if !refusalFallbackGroupMatches(rule.Groups, usingGroup) {
			continue
		}
		fallbackGroup := strings.TrimSpace(rule.FallbackGroup)
		if fallbackGroup == "" || fallbackGroup == usingGroup || rule.CooldownSeconds <= 0 {
			continue
		}

		meta := refusalFallbackMeta{
			CacheKey:        buildRefusalFallbackCacheKey(rule, tokenID, modelName, usingGroup),
			RuleName:        strings.TrimSpace(rule.Name),
			ModelName:       modelName,
			UsingGroup:      usingGroup,
			RequestPath:     requestPath,
			FallbackGroup:   fallbackGroup,
			CooldownSeconds: rule.CooldownSeconds,
		}
		cachedGroup, found, err := getRefusalFallbackCache().Get(meta.CacheKey)
		if err != nil {
			common.SysError(fmt.Sprintf("refusal fallback cache get failed: err=%v", err))
			c.Set(ginKeyRefusalFallbackMeta, meta)
			return "", false
		}
		meta.Active = found && cachedGroup == fallbackGroup
		c.Set(ginKeyRefusalFallbackMeta, meta)
		if meta.Active {
			return fallbackGroup, true
		}
		return "", false
	}
	return "", false
}

func getRefusalFallbackMeta(c *gin.Context) (refusalFallbackMeta, bool) {
	if c == nil {
		return refusalFallbackMeta{}, false
	}
	value, found := c.Get(ginKeyRefusalFallbackMeta)
	if !found {
		return refusalFallbackMeta{}, false
	}
	meta, ok := value.(refusalFallbackMeta)
	return meta, ok
}

func MarkRefusalFallbackUsed(c *gin.Context, selectedGroup string, channelID int) {
	meta, found := getRefusalFallbackMeta(c)
	if !found || !meta.Active || channelID <= 0 {
		return
	}
	c.Set(ginKeyRefusalFallbackUsed, true)
	c.Set(ginKeyRefusalFallbackLogInfo, map[string]interface{}{
		"rule_name":        meta.RuleName,
		"using_group":      meta.UsingGroup,
		"selected_group":   selectedGroup,
		"model":            meta.ModelName,
		"request_path":     meta.RequestPath,
		"fallback_group":   meta.FallbackGroup,
		"channel_id":       channelID,
		"cooldown_seconds": meta.CooldownSeconds,
	})
}

func WasRefusalFallbackUsed(c *gin.Context) bool {
	if c == nil {
		return false
	}
	used, found := c.Get(ginKeyRefusalFallbackUsed)
	if !found {
		return false
	}
	result, ok := used.(bool)
	return ok && result
}

func AppendRefusalFallbackAdminInfo(c *gin.Context, adminInfo map[string]interface{}) {
	if c == nil || adminInfo == nil {
		return
	}
	info, found := c.Get(ginKeyRefusalFallbackLogInfo)
	if found && info != nil {
		adminInfo["refusal_fallback"] = info
	}
}

func ClearCurrentRefusalFallback(c *gin.Context) bool {
	meta, found := getRefusalFallbackMeta(c)
	if !found || !meta.Active || meta.CacheKey == "" {
		return false
	}
	deleted, err := getRefusalFallbackCache().DeleteMany([]string{meta.CacheKey})
	if err != nil {
		common.SysError(fmt.Sprintf("refusal fallback cache delete failed: err=%v", err))
		return false
	}
	for _, wasDeleted := range deleted {
		if wasDeleted {
			return true
		}
	}
	return false
}

func shouldActivateRefusalFallback(meta refusalFallbackMeta, upstreamRefusal bool, selectedChannelID int) bool {
	return upstreamRefusal &&
		!meta.Active &&
		selectedChannelID > 0 &&
		meta.FallbackGroup != ""
}

// ObserveRefusalFallback activates the fallback only after a primary request
// refuses. Requests already using the fallback never refresh the TTL, keeping
// the cooldown a fixed window and allowing a primary probe when it expires.
func ObserveRefusalFallback(c *gin.Context) {
	setting := operation_setting.GetRefusalFallbackSetting()
	if c == nil || setting == nil || !setting.Enabled {
		return
	}
	meta, found := getRefusalFallbackMeta(c)
	if !found || !shouldActivateRefusalFallback(
		meta,
		common.GetContextKeyBool(c, constant.ContextKeyUpstreamRefusal),
		common.GetContextKeyInt(c, constant.ContextKeyChannelId),
	) {
		return
	}

	ttl := time.Duration(meta.CooldownSeconds) * time.Second
	if err := getRefusalFallbackCache().SetWithTTL(meta.CacheKey, meta.FallbackGroup, ttl); err != nil {
		common.SysError(fmt.Sprintf("refusal fallback cache set failed: err=%v", err))
	}
}
