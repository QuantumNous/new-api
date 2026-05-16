package model

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	groupAliasKeyPrefix     = "group:alias:"
	groupAliasAllKey        = "group:aliases:all" // note: "aliases" (plural) avoids collision with groupAliasKeyPrefix pattern
	aliasNotFoundSentinel   = "__NOT_FOUND__"
	groupAliasCacheDuration = 24 * time.Hour // invalidate on change; TTL is a safety net
)

// memAliasCache is the in-memory alias cache used when Redis is disabled.
// Values are *AliasResolved or the string aliasNotFoundSentinel.
var memAliasCache sync.Map

// memAliasAllCache caches the full alias list when Redis is disabled.
var memAliasAllCache atomic.Pointer[[]GroupAlias]

func CacheResolveAlias(alias string) (*AliasResolved, bool) {
	if common.RedisEnabled {
		val, err := common.RedisGet(groupAliasKeyPrefix + alias)
		if err == nil {
			if val == aliasNotFoundSentinel {
				return nil, false
			}
			if val != "" {
				var resolved AliasResolved
				if err := common.Unmarshal([]byte(val), &resolved); err == nil {
					return &resolved, true
				}
			}
		}
	} else {
		if v, ok := memAliasCache.Load(alias); ok {
			if v == aliasNotFoundSentinel {
				return nil, false
			}
			if resolved, ok := v.(*AliasResolved); ok {
				return resolved, true
			}
		}
	}

	record, err := GetGroupAliasByAlias(alias)
	if err != nil {
		if common.RedisEnabled {
			_ = common.RedisSet(groupAliasKeyPrefix+alias, aliasNotFoundSentinel, 5*time.Minute)
		} else {
			memAliasCache.Store(alias, aliasNotFoundSentinel)
		}
		return nil, false
	}
	resolved := &AliasResolved{
		TargetGroup:   record.TargetGroup,
		RatioOverride: record.RatioOverride,
	}
	if common.RedisEnabled {
		data, _ := common.Marshal(resolved)
		_ = common.RedisSet(groupAliasKeyPrefix+alias, string(data), groupAliasCacheDuration)
	} else {
		memAliasCache.Store(alias, resolved)
	}
	return resolved, true
}

func InvalidateAliasCache(alias string) {
	memAliasCache.Delete(alias)
	if !common.RedisEnabled {
		return
	}
	_ = common.RedisDel(groupAliasKeyPrefix + alias)
	_ = common.RedisDel(groupAliasAllKey)
}

func InvalidateAllAliasCache() {
	memAliasAllCache.Store(nil)
	memAliasCache.Range(func(k, _ any) bool {
		memAliasCache.Delete(k)
		return true
	})
	if !common.RedisEnabled {
		return
	}
	ctx := context.Background()
	var keys []string
	iter := common.RDB.Scan(ctx, 0, groupAliasKeyPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	keys = append(keys, groupAliasAllKey)
	_ = common.RDB.Unlink(ctx, keys...).Err()
}

func CacheGetAllGroupAliases() ([]GroupAlias, error) {
	if common.RedisEnabled {
		val, err := common.RedisGet(groupAliasAllKey)
		if err == nil && val != "" {
			var aliases []GroupAlias
			if err := common.Unmarshal([]byte(val), &aliases); err == nil {
				return aliases, nil
			}
		}
	} else {
		if cached := memAliasAllCache.Load(); cached != nil {
			return *cached, nil
		}
	}
	aliases, err := GetAllGroupAliases()
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		data, _ := common.Marshal(aliases)
		_ = common.RedisSet(groupAliasAllKey, string(data), groupAliasCacheDuration)
	} else {
		memAliasAllCache.Store(&aliases)
	}
	return aliases, nil
}

func WarmUpAliasCache() {
	aliases, err := GetAllGroupAliases()
	if err != nil {
		common.SysLog("failed to warm up alias cache: " + err.Error())
		return
	}
	memAliasAllCache.Store(&aliases)
	for _, a := range aliases {
		resolved := &AliasResolved{
			TargetGroup:   a.TargetGroup,
			RatioOverride: a.RatioOverride,
		}
		memAliasCache.Store(a.Alias, resolved)
		if common.RedisEnabled {
			data, _ := common.Marshal(resolved)
			_ = common.RedisSet(groupAliasKeyPrefix+a.Alias, string(data), groupAliasCacheDuration)
		}
	}
	common.SysLog(fmt.Sprintf("warmed up alias cache: %d aliases", len(aliases)))
}
