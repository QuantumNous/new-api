package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

const userCacheSchemaVersion = 2

type UserBase struct {
	Id          int    `json:"id"`
	Group       string `json:"group"`
	Email       string `json:"email"`
	Quota       int    `json:"quota"`
	Status      int    `json:"status"`
	Role        int    `json:"role"`
	Username    string `json:"username"`
	Setting     string `json:"setting"`
	AuthVersion int64  `json:"-"`
	CacheSchema int    `json:"-"`
}

func (user *UserBase) WriteContext(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyUserGroup, user.Group)
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserStatus, user.Status)
	common.SetContextKey(c, constant.ContextKeyUserEmail, user.Email)
	common.SetContextKey(c, constant.ContextKeyUserName, user.Username)
	common.SetContextKey(c, constant.ContextKeyUserSetting, user.GetSetting())
}

func (user *UserBase) GetSetting() dto.UserSetting {
	setting := dto.UserSetting{}
	if user.Setting != "" {
		err := common.Unmarshal([]byte(user.Setting), &setting)
		if err != nil {
			common.SysLog("failed to unmarshal setting: " + err.Error())
		}
	}
	return setting
}

// getUserCacheKey returns the key for user cache
func getUserCacheKey(userId int) string {
	return fmt.Sprintf("user:%d", userId)
}

func getUserCacheVersionKey(userId int) string {
	return fmt.Sprintf("cache-version:user:%d", userId)
}

// imageAutoUserQuotaCacheVersion returns the current quota-cache invalidation
// generation for a user. It fences populateUserCache against a concurrent
// invalidation or pending billing debit racing a stale database snapshot; it
// is independent of, and layered underneath, the AuthVersion security fence.
func imageAutoUserQuotaCacheVersion(userId int) (int64, error) {
	return common.RedisCacheVersion(getUserCacheVersionKey(userId))
}

func userCacheTTLSeconds() int {
	ttl := common.RedisKeyCacheSeconds()
	if ttl <= 0 {
		return 60
	}
	return ttl
}

// invalidateUserCache clears user cache
func invalidateUserCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisBumpCacheVersionAndDelete(getUserCacheVersionKey(userId), getUserCacheKey(userId))
}

// InvalidateUserCache is the exported version of invalidateUserCache.
// 供 controller 等上层包在用户状态变更（如禁用、删除、角色变更）后主动清理缓存。
func InvalidateUserCache(userId int) error {
	return invalidateUserCache(userId)
}

func populateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	version, err := imageAutoUserQuotaCacheVersion(user.Id)
	if err != nil {
		return err
	}
	_, err = populateUserCacheAtImageAutoQuotaCacheVersion(user, version)
	return err
}

// populateUserCacheAtImageAutoQuotaCacheVersion populates the user hash only
// when the quota-cache generation still matches the one observed before the
// database read that produced user, and reconciles any billing pending delta
// that accumulated in the meantime. The write goes through the auth-fenced
// writer so the AuthVersion security fence (pending fence, committed floor,
// current hash version) is enforced atomically together with the quota
// generation guard: bypassing it would let a stale snapshot re-authorize a
// user mid restrictive change, and would skip the committed-version
// bookkeeping the fence rollback recovery depends on.
func populateUserCacheAtImageAutoQuotaCacheVersion(user User, version int64) (bool, error) {
	if !common.RedisEnabled {
		return false, nil
	}
	written, err := writeUserCacheWithQuotaVersionGuard(user.ToBaseUser(), true, version)
	if err != nil || !written {
		return written, err
	}
	return true, common.RedisHApplyPendingDelta(getUserCacheKey(user.Id), "Quota", getUserCacheVersionKey(user.Id))
}

// updateUserCache refreshes non-quota user cache fields.
// Quota is maintained by atomic quota delta paths and must not be overwritten
// by stale user snapshots from profile/settings updates.
func updateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	return writeUserCache(user.ToBaseUser(), false)
}

// GetUserCache gets complete user cache from hash
func GetUserCache(userId int) (*UserBase, error) {
	// Try getting from Redis first
	userCache, err := cacheGetUserBase(userId)
	if err == nil {
		return userCache, nil
	}

	// Redis misses and read failures both fall back to the shared database. A
	// version fence newer than the database is the one exception: allowing that
	// snapshot would re-authorize a user while a restrictive update is pending.
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		floor, floorErr := getUserAuthVersionFloor(userId)
		if floorErr == nil && floor > user.AuthVersion {
			return nil, ErrUserAuthCachePending
		}
		if err := populateUserCache(*user); err != nil {
			if errors.Is(err, ErrUserAuthCachePending) {
				return nil, err
			}
			common.SysLog("failed to synchronously populate user cache: " + err.Error())
		}
	}
	return user.ToBaseUser(), nil
}

func cacheGetUserBase(userId int) (*UserBase, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var userCache UserBase
	// Try getting from Redis first
	err := common.RedisHGetObj(getUserCacheKey(userId), &userCache)
	if err != nil {
		return nil, err
	}
	if userCache.Id != userId || userCache.CacheSchema != userCacheSchemaVersion || userCache.AuthVersion <= 0 {
		return nil, fmt.Errorf("user cache schema is stale")
	}
	floor, err := getUserAuthVersionFloor(userId)
	if err != nil {
		return nil, err
	}
	if floor > userCache.AuthVersion {
		return nil, ErrUserAuthCachePending
	}
	return &userCache, nil
}

// Add atomic quota operations using hash fields
func cacheIncrUserQuota(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHIncrByWithVersion(getUserCacheKey(userId), "Quota", delta, getUserCacheVersionKey(userId))
}

func cacheDecrUserQuota(userId int, delta int64) error {
	return cacheIncrUserQuota(userId, -delta)
}

func cacheIncrUserQuotaPending(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHIncrByWithVersionPending(getUserCacheKey(userId), "Quota", delta, getUserCacheVersionKey(userId))
}

func cacheAcknowledgeUserQuotaPendingDelta(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHAcknowledgePendingDelta(getUserCacheKey(userId), "Quota", delta, getUserCacheVersionKey(userId))
}

// Helper functions to get individual fields if needed
func getUserGroupCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Group, nil
}

func getUserQuotaCache(userId int) (int, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return 0, err
	}
	return cache.Quota, nil
}

func getUserStatusCache(userId int) (int, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return 0, err
	}
	return cache.Status, nil
}

func getUserNameCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Username, nil
}

func getUserSettingCache(userId int) (dto.UserSetting, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return dto.UserSetting{}, err
	}
	return cache.GetSetting(), nil
}

// New functions for individual field updates
func updateUserStatusCache(userId int, status bool) error {
	statusInt := common.UserStatusEnabled
	if !status {
		statusInt = common.UserStatusDisabled
	}
	return updateUserCacheField(userId, "Status", statusInt)
}

func updateUserQuotaCache(userId int, quota int) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Quota", fmt.Sprintf("%d", quota))
}

// RefreshUserGroupCache writes the database-authoritative group into an
// existing user hash without changing the user's authentication version.
func RefreshUserGroupCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if userId <= 0 {
		return fmt.Errorf("invalid user id")
	}
	var authoritative User
	if err := DB.Select("id", "auth_version", commonGroupCol).Where("id = ?", userId).First(&authoritative).Error; err != nil {
		return err
	}
	// Group transitions intentionally keep the same authentication version. A
	// refresh that read the previous group can therefore arrive after a newer
	// refresh and still pass the auth-version fence. Re-read after every write
	// and repair the cache when the authoritative group changed in between.
	for range 3 {
		if err := updateUserCacheFieldAtVersion(userId, "Group", authoritative.Group, authoritative.AuthVersion); err != nil {
			return err
		}

		var verified User
		if err := DB.Select("id", "auth_version", commonGroupCol).Where("id = ?", userId).First(&verified).Error; err != nil {
			return err
		}
		if verified.AuthVersion == authoritative.AuthVersion && verified.Group == authoritative.Group {
			return nil
		}
		authoritative = verified
	}

	// Preserve the freshest snapshot observed even when the row was too busy to
	// stabilize within the bounded retries. Returning an error lets best-effort
	// callers emit an operation-specific warning.
	if err := updateUserCacheFieldAtVersion(userId, "Group", authoritative.Group, authoritative.AuthVersion); err != nil {
		return err
	}
	return fmt.Errorf("user group changed repeatedly during cache refresh")
}

func updateUserEmailCache(userId int, email string) error {
	return updateUserCacheField(userId, "Email", email)
}

func updateUserNameCache(userId int, username string) error {
	return updateUserCacheField(userId, "Username", username)
}

func updateUserSettingCache(userId int, setting string) error {
	return updateUserCacheField(userId, "Setting", setting)
}

// updateUserCacheField prevents individual cache refreshes from bypassing the
// auth-version fence. It intentionally does nothing when the complete hash is
// absent; the next GetUserCache call will repopulate it from the database.
func updateUserCacheField(userId int, field string, value interface{}) error {
	if !common.RedisEnabled {
		return nil
	}
	var user User
	if err := DB.Select("id", "auth_version").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if user.AuthVersion <= 0 {
		return fmt.Errorf("invalid user auth version")
	}
	return updateUserCacheFieldAtVersion(userId, field, value, user.AuthVersion)
}

// GetUserLanguage returns the user's language preference from cache
// Uses the existing GetUserCache mechanism for efficiency
func GetUserLanguage(userId int) string {
	userCache, err := GetUserCache(userId)
	if err != nil {
		return ""
	}
	return userCache.GetSetting().Language
}
