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
			common.SysLog(common.LogText("failed to unmarshal setting: %s", err.Error()))
		}
	}
	return setting
}

// getUserCacheKey returns the key for user cache
func getUserCacheKey(userId int) string {
	return fmt.Sprintf("user:%d", userId)
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
	return common.RedisDelKey(getUserCacheKey(userId))
}

func populateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	return writeUserCache(user.ToBaseUser(), true)
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
	// Try getting from Redis first.
	userCache, cacheErr := cacheGetUserBase(userId)
	if cacheErr == nil {
		return userCache, nil
	}
	quotaMutationPending := errors.Is(cacheErr, ErrUserQuotaMutationPending)

	// Redis misses and read failures fall back to the shared database. During a
	// quota mutation fence this snapshot is identity/display data only: it is
	// returned without publishing a cache hash, while TryReserveUserQuota stays
	// fail-closed on the fence. The authentication version floor still applies.
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		floor, floorErr := getUserAuthVersionFloor(userId)
		if floorErr == nil && floor > user.AuthVersion {
			return nil, ErrUserAuthCachePending
		}
		if quotaMutationPending {
			return user.ToBaseUser(), nil
		}
		if err := populateUserCache(*user); err != nil {
			if errors.Is(err, ErrUserAuthCachePending) {
				return nil, err
			}
			common.SysLog(common.LogText("failed to synchronously populate user cache: %s", err.Error()))
		}
	}
	return user.ToBaseUser(), nil
}

func cacheGetUserBase(userId int) (*UserBase, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	fenced, err := userQuotaMutationFenceExists(userId)
	if err != nil {
		return nil, err
	}
	if fenced {
		return nil, ErrUserQuotaMutationPending
	}
	var userCache UserBase
	// A shared batch marker does not invalidate an existing quota hash: Redis
	// already contains every queued delta and remains the spend authority.
	if err := common.RedisHGetObj(getUserCacheKey(userId), &userCache); err != nil {
		pending, pendingErr := userQuotaMutationPendingExists(userId)
		if pendingErr != nil {
			return nil, pendingErr
		}
		if pending {
			return nil, ErrUserQuotaMutationPending
		}
		return nil, err
	}
	// Recheck the exclusive fence after HGETALL so a transaction raised
	// concurrently cannot expose its pre-transaction snapshot. Batch markers
	// deliberately remain readable while this valid hash exists.
	fenced, err = userQuotaMutationFenceExists(userId)
	if err != nil {
		return nil, err
	}
	if fenced {
		return nil, ErrUserQuotaMutationPending
	}
	if userCache.Id != userId || userCache.CacheSchema != userCacheSchemaVersion || userCache.AuthVersion <= 0 {
		pending, pendingErr := userQuotaMutationPendingExists(userId)
		if pendingErr != nil {
			return nil, pendingErr
		}
		if pending {
			return nil, ErrUserQuotaMutationPending
		}
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

// Add atomic quota operations using hash fields.
// 通过守卫式 Lua 脚本执行：哈希不存在时直接跳过（下次读取会从数据库水合），
// 不会像裸 HINCRBY 那样创建只含 Quota 字段的残缺哈希。
func cacheIncrUserQuota(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	result, err := cacheApplyUserQuotaDelta(userId, delta)
	if err != nil {
		return err
	}
	if result == cacheQuotaPending {
		// The database mutation has already committed. Removing only the stale
		// balance hash is safe while preserving the active owner's fence: a
		// concurrent credit can no longer publish an increment over an older
		// snapshot, and the next authoritative read hydrates from committed DB.
		if invalidateErr := invalidateUserQuotaHash(userId); invalidateErr != nil {
			return fmt.Errorf("%w: failed to invalidate user quota cache: %v", ErrUserQuotaMutationPending, invalidateErr)
		}
		return ErrUserQuotaMutationPending
	}
	return nil
}

func cacheDecrUserQuota(userId int, delta int64) error {
	return cacheIncrUserQuota(userId, -delta)
}

// syncUserQuotaDeltaCache publishes a committed signed delta through the
// exclusive quota fence acquired before the database mutation. On publication
// failure the deferred fence finalizer invalidates the hash and keeps reads
// fail-closed without reporting a false database rollback.
func syncUserQuotaDeltaCache(fences *userQuotaMutationFences, userId int, delta int, operation string) {
	if delta == 0 || fences == nil {
		return
	}
	if err := fences.publishDelta(userId, delta); err != nil {
		common.SysLog(fmt.Sprintf("failed to publish %s delta to user quota cache: %s", operation, err.Error()))
	}
}

func syncCreditUserQuotaCache(fences *userQuotaMutationFences, userId int, quota int, operation string) {
	// The committed purchase also issued cashback under this fence. The caller
	// only knows the purchase delta, so invalidate and rehydrate after cooldown
	// rather than publishing a stale purchase-only balance.
	if fences != nil && fences.cashbackIssued {
		recordCashbackCreditLog(userId, fences.cashbackRewardID, fences.cashbackQuota, "immediate")
		return
	}
	if quota <= 0 {
		return
	}
	syncUserQuotaDeltaCache(fences, userId, quota, operation)
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
	// Quota-authoritative callers must not consume the direct database snapshot
	// that GetUserCache intentionally exposes for identity/profile reads during
	// a quota fence. Preserve the pending error so billing cannot enter the
	// trust-quota bypass while money state is changing.
	cache, err := cacheGetUserBase(userId)
	if err == nil {
		return cache.Quota, nil
	}
	if errors.Is(err, ErrUserQuotaMutationPending) {
		return 0, err
	}
	if _, err = GetUserCache(userId); err != nil {
		return 0, err
	}
	cache, err = cacheGetUserBase(userId)
	if err != nil {
		return 0, err
	}
	return cache.Quota, nil
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
func updateUserCacheField(userId int, field string, value any) error {
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
