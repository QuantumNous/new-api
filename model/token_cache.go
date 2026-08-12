package model

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

const (
	tokenCacheFillFenceKey                   = "token:cache:fill-fence"
	tokenPermissionUpdateMarkerPrefix        = "token:cache:permission-update:"
	tokenPermissionUpdateMarkerSafetySeconds = 60
	tokenCacheCompleteField                  = "__complete"
	tokenCacheMutationFenceMismatch          = -1
	tokenCacheMutationNotPatched             = 0
	tokenCachePermissionUpdatePending        = -2
)

var captureTokenCacheFillFenceScript = redis.NewScript(`
local fence = redis.call('GET', KEYS[1])
if not fence then
  redis.call('SET', KEYS[1], ARGV[1])
  fence = ARGV[1]
end
return fence
`)

var fillTokenCacheScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
if redis.call('EXISTS', KEYS[2]) ~= 0 then
  return 0
end
if redis.call('EXISTS', KEYS[3]) ~= 0 then
  return 0
end
redis.call('HSET', KEYS[3], unpack(ARGV, 3))
local ttl = tonumber(ARGV[2])
if ttl and ttl > 0 then
  redis.call('EXPIRE', KEYS[3], ttl)
end
return 1
`)

var beginTokenPermissionUpdateScript = redis.NewScript(`
redis.call('SET', KEYS[1], ARGV[1])
for index = 2, #KEYS, 2 do
  redis.call('SET', KEYS[index], ARGV[2], 'EX', ARGV[3])
  redis.call('DEL', KEYS[index + 1])
end
return (#KEYS - 1) / 2
`)

var finishTokenPermissionUpdateScript = redis.NewScript(`
redis.call('SET', KEYS[1], ARGV[1])
local cleared = 0
for index = 2, #KEYS, 2 do
  redis.call('DEL', KEYS[index + 1])
  if redis.call('GET', KEYS[index]) == ARGV[2] then
    redis.call('DEL', KEYS[index])
    cleared = cleared + 1
  end
end
return cleared
`)

var invalidateTokenCacheScript = redis.NewScript(`
redis.call('SET', KEYS[1], ARGV[1])
if #KEYS > 1 then
  return redis.call('DEL', unpack(KEYS, 2))
end
return 0
`)

var validateTokenCacheScript = redis.NewScript(`
if redis.call('EXISTS', KEYS[1]) ~= 0 then
  return -2
end
if redis.call('EXISTS', KEYS[2]) == 0 then
  return 0
end
if redis.call('HGET', KEYS[2], ARGV[1]) ~= ARGV[2] then
  redis.call('DEL', KEYS[2])
  return -1
end
return 1
`)

var updateCompleteTokenCacheFieldScript = redis.NewScript(`
if redis.call('TYPE', KEYS[1]).ok ~= 'hash' then
  return 0
end
if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[3], ARGV[4])
return 1
`)

var incrementCompleteTokenCacheFieldScript = redis.NewScript(`
if redis.call('TYPE', KEYS[1]).ok ~= 'hash' then
  return 0
end
if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then
  return 0
end
redis.call('HINCRBY', KEYS[1], ARGV[3], ARGV[4])
return 1
`)

var patchTokenCacheGroupsScript = redis.NewScript(`
redis.call('SET', KEYS[1], ARGV[1])
local patched = 0
for index = 2, #KEYS do
  local key_type = redis.call('TYPE', KEYS[index]).ok
  if key_type == 'hash' then
    if redis.call('HGET', KEYS[index], ARGV[2]) == ARGV[3] then
      redis.call('HSET', KEYS[index], ARGV[4], ARGV[5])
	  if ARGV[6] ~= '' then
	    redis.call('HSET', KEYS[index], ARGV[6], ARGV[7])
	  end
      patched = patched + 1
    else
      redis.call('DEL', KEYS[index])
    end
  elseif key_type ~= 'none' then
    redis.call('DEL', KEYS[index])
  end
end
return patched
`)

var patchTokenCacheMutationScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('DEL', KEYS[2])
  return -1
end
redis.call('SET', KEYS[1], ARGV[2])
local key_type = redis.call('TYPE', KEYS[2]).ok
if key_type == 'none' then
  return 0
end
if key_type ~= 'hash' then
  redis.call('DEL', KEYS[2])
  return 0
end
if redis.call('HGET', KEYS[2], ARGV[3]) ~= ARGV[4] then
  redis.call('DEL', KEYS[2])
  return 0
end
redis.call('HSET', KEYS[2], unpack(ARGV, 5))
return 1
`)

func redisTokenCacheKey(key string) string {
	return fmt.Sprintf("token:%s", common.GenerateHMAC(key))
}

func tokenPermissionUpdateMarkerKey(key string) string {
	return tokenPermissionUpdateMarkerPrefix + common.GenerateHMAC(key)
}

func tokenPermissionUpdateRedisKeys(keys []string) []string {
	redisKeys := make([]string, 1, len(keys)*2+1)
	redisKeys[0] = tokenCacheFillFenceKey
	for _, key := range keys {
		redisKeys = append(redisKeys, tokenPermissionUpdateMarkerKey(key), redisTokenCacheKey(key))
	}
	return redisKeys
}

func beginTokenPermissionUpdate(keys []string) (string, error) {
	if len(keys) == 0 || !common.RedisEnabled {
		return "", nil
	}
	if common.RDB == nil {
		return "", errors.New("cannot prepare token permission update: Redis client is nil")
	}
	guard := uuid.NewString()
	markerTTL := common.RedisKeyCacheSeconds() + tokenPermissionUpdateMarkerSafetySeconds
	if markerTTL <= tokenPermissionUpdateMarkerSafetySeconds {
		markerTTL = tokenPermissionUpdateMarkerSafetySeconds * 2
	}
	if err := beginTokenPermissionUpdateScript.Run(
		context.Background(),
		common.RDB,
		tokenPermissionUpdateRedisKeys(keys),
		uuid.NewString(),
		guard,
		markerTTL,
	).Err(); err != nil {
		return "", fmt.Errorf("failed to prepare token permission update: %w", err)
	}
	return guard, nil
}

func finishTokenPermissionUpdate(keys []string, guard string) error {
	if len(keys) == 0 || !common.RedisEnabled || guard == "" {
		return nil
	}
	if common.RDB == nil {
		return errors.New("cannot finish token permission update: Redis client is nil")
	}
	if err := finishTokenPermissionUpdateScript.Run(
		context.Background(),
		common.RDB,
		tokenPermissionUpdateRedisKeys(keys),
		uuid.NewString(),
		guard,
	).Err(); err != nil {
		return fmt.Errorf("failed to finish token permission update: %w", err)
	}
	return nil
}

func captureTokenCacheFillFence() (string, error) {
	if !common.RedisEnabled || common.RDB == nil {
		return "", errors.New("redis is not enabled")
	}
	fence, err := captureTokenCacheFillFenceScript.Run(
		context.Background(),
		common.RDB,
		[]string{tokenCacheFillFenceKey},
		uuid.NewString(),
	).Text()
	if err != nil {
		return "", fmt.Errorf("failed to capture token cache fill fence: %w", err)
	}
	return fence, nil
}

func tokenCacheFields(token Token) []interface{} {
	token.Clean()
	return []interface{}{
		"Id", token.Id,
		"UserId", token.UserId,
		"Status", token.Status,
		"Name", token.Name,
		"CreatedTime", token.CreatedTime,
		"AccessedTime", token.AccessedTime,
		"ExpiredTime", token.ExpiredTime,
		"RemainQuota", token.RemainQuota,
		"UnlimitedQuota", strconv.FormatBool(token.UnlimitedQuota),
		"ModelLimitsEnabled", strconv.FormatBool(token.ModelLimitsEnabled),
		"ModelLimits", token.ModelLimits,
		"ModelBlacklistEnabled", strconv.FormatBool(token.ModelBlacklistEnabled),
		"ModelBlacklist", token.ModelBlacklist,
		"AllowIps", tokenCacheAllowIps(token),
		"UsedQuota", token.UsedQuota,
		"Group", token.Group,
		"CrossGroupRetry", strconv.FormatBool(token.CrossGroupRetry),
		"Source", token.Source,
		"DeviceIdHash", token.DeviceIdHash,
		"ClientName", token.ClientName,
		"ClientVersion", token.ClientVersion,
		"LastUsedClientAt", token.LastUsedClientAt,
		tokenCacheCompleteField, "1",
	}
}

func tokenCacheAllowIps(token Token) string {
	if token.AllowIps == nil {
		return ""
	}
	return *token.AllowIps
}

func tokenUpdateCacheFields(token Token) []interface{} {
	return []interface{}{
		"Name", token.Name,
		"Status", token.Status,
		"ExpiredTime", token.ExpiredTime,
		"RemainQuota", token.RemainQuota,
		"UnlimitedQuota", strconv.FormatBool(token.UnlimitedQuota),
		"ModelLimitsEnabled", strconv.FormatBool(token.ModelLimitsEnabled),
		"ModelLimits", token.ModelLimits,
		"ModelBlacklistEnabled", strconv.FormatBool(token.ModelBlacklistEnabled),
		"ModelBlacklist", token.ModelBlacklist,
		"AllowIps", tokenCacheAllowIps(token),
		"Group", token.Group,
		"CrossGroupRetry", strconv.FormatBool(token.CrossGroupRetry),
		"Source", token.Source,
		"DeviceIdHash", token.DeviceIdHash,
		"ClientName", token.ClientName,
		"ClientVersion", token.ClientVersion,
		"LastUsedClientAt", token.LastUsedClientAt,
	}
}

func tokenSelectUpdateCacheFields(token Token) []interface{} {
	return []interface{}{
		"AccessedTime", token.AccessedTime,
		"Status", token.Status,
	}
}

func cacheSetToken(token Token, fillFence string) error {
	if fillFence == "" {
		return errors.New("token cache fill fence is empty")
	}
	args := []interface{}{fillFence, common.RedisKeyCacheSeconds()}
	args = append(args, tokenCacheFields(token)...)
	if err := fillTokenCacheScript.Run(
		context.Background(),
		common.RDB,
		[]string{tokenCacheFillFenceKey, tokenPermissionUpdateMarkerKey(token.Key), redisTokenCacheKey(token.Key)},
		args...,
	).Err(); err != nil {
		return fmt.Errorf("failed to fill token cache: %w", err)
	}
	return nil
}

func cacheDeleteTokens(keys []string) error {
	if len(keys) == 0 || !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("cannot invalidate token cache: Redis client is nil")
	}
	redisKeys := make([]string, 1, len(keys)+1)
	redisKeys[0] = tokenCacheFillFenceKey
	for _, key := range keys {
		redisKeys = append(redisKeys, redisTokenCacheKey(key))
	}
	if err := invalidateTokenCacheScript.Run(
		context.Background(),
		common.RDB,
		redisKeys,
		uuid.NewString(),
	).Err(); err != nil {
		return fmt.Errorf("failed to invalidate token cache: %w", err)
	}
	return nil
}

func cacheDeleteToken(key string) error {
	return cacheDeleteTokens([]string{key})
}

func cachePatchTokenGroups(keys []string, group string) error {
	if len(keys) == 0 || !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("cannot patch token cache groups: Redis client is nil")
	}
	crossGroupRetryField := ""
	crossGroupRetryValue := ""
	if group == plgUserGroup {
		crossGroupRetryField = "CrossGroupRetry"
		crossGroupRetryValue = "false"
	}
	redisKeys := make([]string, 1, len(keys)+1)
	redisKeys[0] = tokenCacheFillFenceKey
	for _, key := range keys {
		redisKeys = append(redisKeys, redisTokenCacheKey(key))
	}
	if err := patchTokenCacheGroupsScript.Run(
		context.Background(),
		common.RDB,
		redisKeys,
		uuid.NewString(),
		tokenCacheCompleteField,
		"1",
		"Group",
		group,
		crossGroupRetryField,
		crossGroupRetryValue,
	).Err(); err != nil {
		return fmt.Errorf("failed to patch token cache groups: %w", err)
	}
	return nil
}

func cachePatchTokenMutation(key string, expectedFence string, fields []interface{}) (int, error) {
	if expectedFence == "" {
		return tokenCacheMutationNotPatched, errors.New("token cache mutation fence is empty")
	}
	if len(fields) == 0 || len(fields)%2 != 0 {
		return tokenCacheMutationNotPatched, errors.New("token cache mutation fields are invalid")
	}
	args := []interface{}{
		expectedFence,
		uuid.NewString(),
		tokenCacheCompleteField,
		"1",
	}
	args = append(args, fields...)
	result, err := patchTokenCacheMutationScript.Run(
		context.Background(),
		common.RDB,
		[]string{tokenCacheFillFenceKey, redisTokenCacheKey(key)},
		args...,
	).Int()
	if err != nil {
		return tokenCacheMutationNotPatched, fmt.Errorf("failed to patch token cache mutation: %w", err)
	}
	return result, nil
}

func cachePatchTokenAfterUpdate(token Token, expectedFence string) (int, error) {
	return cachePatchTokenMutation(token.Key, expectedFence, tokenUpdateCacheFields(token))
}

func cachePatchTokenAfterSelectUpdate(token Token, expectedFence string) (int, error) {
	return cachePatchTokenMutation(token.Key, expectedFence, tokenSelectUpdateCacheFields(token))
}

func cacheIncrTokenQuota(key string, increment int64) error {
	if err := incrementCompleteTokenCacheFieldScript.Run(
		context.Background(),
		common.RDB,
		[]string{redisTokenCacheKey(key)},
		tokenCacheCompleteField,
		"1",
		constant.TokenFiledRemainQuota,
		increment,
	).Err(); err != nil {
		return fmt.Errorf("failed to increment token cache quota: %w", err)
	}
	return nil
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

func cacheSetTokenField(key string, field string, value string) error {
	if err := updateCompleteTokenCacheFieldScript.Run(
		context.Background(),
		common.RDB,
		[]string{redisTokenCacheKey(key)},
		tokenCacheCompleteField,
		"1",
		field,
		value,
	).Err(); err != nil {
		return fmt.Errorf("failed to update token cache field: %w", err)
	}
	return nil
}

// CacheGetTokenByKey 从缓存中获取 token，如果缓存中不存在，则从数据库中获取
func cacheGetTokenByKey(key string) (*Token, error) {
	if !common.RedisEnabled || common.RDB == nil {
		return nil, errors.New("redis is not enabled")
	}
	redisKey := redisTokenCacheKey(key)
	valid, err := validateTokenCacheScript.Run(
		context.Background(),
		common.RDB,
		[]string{tokenPermissionUpdateMarkerKey(key), redisKey},
		tokenCacheCompleteField,
		"1",
	).Int()
	if err != nil {
		return nil, fmt.Errorf("failed to validate token cache: %w", err)
	}
	if valid == tokenCachePermissionUpdatePending {
		return nil, ErrTokenPermissionUpdatePending
	}
	if valid != 1 {
		return nil, fmt.Errorf("key %s is missing a complete token cache entry", redisKey)
	}
	var token Token
	if err := common.RedisHGetObj(redisKey, &token); err != nil {
		return nil, err
	}
	token.Key = key
	return &token, nil
}
