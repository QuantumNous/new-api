package model

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	groupRatioKeyPrefix = "group:ratio:"
	groupAllKey         = "group:all"
	groupUsableKey      = "group:usable"
	groupCacheDuration  = 24 * time.Hour // invalidate on change; TTL is a safety net
)

func CacheGetGroupRatio(name string) (float64, bool) {
	if common.RedisEnabled {
		val, err := common.RedisGet(groupRatioKeyPrefix + name)
		if err == nil {
			ratio, err := strconv.ParseFloat(val, 64)
			if err == nil {
				return ratio, true
			}
		}
	}
	group, err := GetGroupByName(name)
	if err != nil {
		return 0, false
	}
	if common.RedisEnabled {
		_ = common.RedisSet(groupRatioKeyPrefix+name, strconv.FormatFloat(group.Ratio, 'f', -1, 64), groupCacheDuration)
	}
	return group.Ratio, true
}

func CacheContainsGroup(name string) bool {
	_, ok := CacheGetGroupRatio(name)
	return ok
}

func CacheGetAllGroups() ([]Group, error) {
	if common.RedisEnabled {
		val, err := common.RedisGet(groupAllKey)
		if err == nil && val != "" {
			var groups []Group
			if err := common.Unmarshal([]byte(val), &groups); err == nil {
				return groups, nil
			}
		}
	}
	groups, err := GetAllGroups()
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		data, _ := common.Marshal(groups)
		_ = common.RedisSet(groupAllKey, string(data), groupCacheDuration)
	}
	return groups, nil
}

func CacheGetUsableGroups() (map[string]string, error) {
	if common.RedisEnabled {
		val, err := common.RedisGet(groupUsableKey)
		if err == nil && val != "" {
			result := make(map[string]string)
			if err := common.Unmarshal([]byte(val), &result); err == nil {
				return result, nil
			}
		}
	}
	groups, err := GetAllGroups()
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, g := range groups {
		if g.UserSelectable {
			result[g.Name] = g.Description
		}
	}
	if common.RedisEnabled {
		data, _ := common.Marshal(result)
		_ = common.RedisSet(groupUsableKey, string(data), groupCacheDuration)
	}
	return result, nil
}

func InvalidateGroupCache(name string) {
	if !common.RedisEnabled {
		return
	}
	_ = common.RedisDel(groupRatioKeyPrefix + name)
	_ = common.RedisDel(groupAllKey)
	_ = common.RedisDel(groupUsableKey)
}

func InvalidateAllGroupCache() {
	if !common.RedisEnabled {
		return
	}
	ctx := context.Background()
	var keys []string
	iter := common.RDB.Scan(ctx, 0, groupRatioKeyPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	keys = append(keys, groupAllKey, groupUsableKey)
	_ = common.RDB.Unlink(ctx, keys...).Err()
}

func WarmUpGroupCache() {
	if !common.RedisEnabled {
		return
	}
	groups, err := GetAllGroups()
	if err != nil {
		common.SysLog("failed to warm up group cache: " + err.Error())
		return
	}
	for _, g := range groups {
		_ = common.RedisSet(groupRatioKeyPrefix+g.Name, strconv.FormatFloat(g.Ratio, 'f', -1, 64), groupCacheDuration)
	}
	data, _ := common.Marshal(groups)
	_ = common.RedisSet(groupAllKey, string(data), groupCacheDuration)

	usableMap := make(map[string]string)
	for _, g := range groups {
		if g.UserSelectable {
			usableMap[g.Name] = g.Description
		}
	}
	usableData, _ := common.Marshal(usableMap)
	_ = common.RedisSet(groupUsableKey, string(usableData), groupCacheDuration)

	common.SysLog(fmt.Sprintf("warmed up group cache: %d groups", len(groups)))
}
