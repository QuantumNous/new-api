package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
)

var scheduleQuotaCacheRefresh = func(refresh func()) {
	gopool.Go(refresh)
}

// UserBase struct remains the same as it represents the cached data structure
type UserBase struct {
	Id       int    `json:"id"`
	Group    string `json:"group"`
	Email    string `json:"email"`
	Quota    int    `json:"quota"`
	Status   int    `json:"status"`
	Username string `json:"username"`
	Setting  string `json:"setting"`
}

const quotaCachePopulateAttempts = 3

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

func userQuotaCacheGenerationKey(userId int) string {
	return fmt.Sprintf("billing:quota-cache-generation:user:%d", userId)
}

func userQuotaCacheGeneration(userId int) (int64, error) {
	if !common.RedisEnabled {
		return 0, nil
	}
	if common.RDB == nil {
		return 0, fmt.Errorf("redis is enabled but unavailable")
	}
	return common.RedisGeneration(userQuotaCacheGenerationKey(userId))
}

func invalidateUserQuotaCacheWithStatus(userId int, invalidStatus *int) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("redis is enabled but unavailable")
	}
	_, err := common.RedisHInvalidateWithGeneration(
		getUserCacheKey(userId),
		imageTaskUserQuotaPinsKey(userId),
		imageTaskUserQuotaInvalidationKey(userId),
		userQuotaCacheGenerationKey(userId),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		invalidStatus,
	)
	return err
}

func invalidateUserQuotaCache(userId int) error {
	return invalidateUserQuotaCacheWithStatus(userId, nil)
}

func applyUserQuotaCacheDelta(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("redis is enabled but unavailable")
	}
	_, err := common.RedisHApplyDeltaAndInvalidateWithGeneration(
		getUserCacheKey(userId),
		imageTaskUserQuotaPinsKey(userId),
		imageTaskUserQuotaInvalidationKey(userId),
		userQuotaCacheGenerationKey(userId),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		"Quota",
		delta,
	)
	return err
}

func applyUserQuotaCacheDeltaOnce(userId int, delta int64, operationKey string) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("redis is enabled but unavailable")
	}
	_, err := common.RedisHApplyDeltaAndInvalidateWithGenerationOnce(
		getUserCacheKey(userId),
		imageTaskUserQuotaPinsKey(userId),
		imageTaskUserQuotaInvalidationKey(userId),
		userQuotaCacheGenerationKey(userId),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		"Quota",
		delta,
		operationKey,
		30*24*time.Hour,
	)
	return err
}

// invalidateUserCache clears user cache
func invalidateUserCache(userId int) error {
	invalidStatus := common.UserStatusDisabled
	return invalidateUserQuotaCacheWithStatus(userId, &invalidStatus)
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

	_, err := common.RedisHSetObjIfAbsent(
		getUserCacheKey(user.Id),
		user.ToBaseUser(),
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
	)
	return err
}

func populateUserCacheAtGeneration(user User, generation int64) (bool, error) {
	if !common.RedisEnabled {
		return false, nil
	}
	return common.RedisHSetObjIfGeneration(
		getUserCacheKey(user.Id),
		imageTaskUserQuotaPinsKey(user.Id),
		imageTaskUserQuotaInvalidationKey(user.Id),
		userQuotaCacheGenerationKey(user.Id),
		generation,
		user.ToBaseUser(),
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
	)
}

// updateUserCache refreshes non-quota user cache fields.
// Quota is maintained by atomic quota delta paths and must not be overwritten
// by stale user snapshots from profile/settings updates.
func updateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	if err := updateUserGroupCache(user.Id, user.Group); err != nil {
		return err
	}
	if err := updateUserEmailCache(user.Id, user.Email); err != nil {
		return err
	}
	if err := updateUserStatusCache(user.Id, user.Status == common.UserStatusEnabled); err != nil {
		return err
	}
	if err := updateUserNameCache(user.Id, user.Username); err != nil {
		return err
	}
	return updateUserSettingCache(user.Id, user.Setting)
}

// GetUserCache gets complete user cache from hash
func GetUserCache(userId int) (userCache *UserBase, err error) {
	// Try getting from Redis first
	userCache, err = cacheGetUserBaseForRead(userId)
	if err == nil && userCache.Status == common.UserStatusEnabled && userCache.Quota > 0 {
		return userCache, nil
	}
	cachedForConfirmation := userCache

	generation, generationErr := userQuotaCacheGeneration(userId)

	// If Redis fails, get from DB
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err // Return nil and error if DB lookup fails
	}
	if cachedForConfirmation != nil &&
		(cachedForConfirmation.Quota != user.Quota || cachedForConfirmation.Status != user.Status) {
		if cacheErr := invalidateUserQuotaCache(userId); cacheErr != nil {
			common.SysLog("failed to invalidate stale user cache after DB confirmation: " + cacheErr.Error())
		}
		generationErr = fmt.Errorf("stale cache invalidated")
	}
	if generationErr == nil && common.RedisEnabled {
		cacheUser := *user
		scheduleQuotaCacheRefresh(func() {
			if _, err := populateUserCacheAtGeneration(cacheUser, generation); err != nil {
				common.SysLog("failed to update user status cache: " + err.Error())
			}
		})
	}

	// Create cache object from user data
	userCache = &UserBase{
		Id:       user.Id,
		Group:    user.Group,
		Quota:    user.Quota,
		Status:   user.Status,
		Username: user.Username,
		Setting:  user.Setting,
		Email:    user.Email,
	}

	return userCache, nil
}

func cacheGetUserBaseForRead(userId int) (*UserBase, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var userCache UserBase
	err := common.RedisHGetObjIfValid(
		getUserCacheKey(userId),
		imageTaskUserQuotaInvalidationKey(userId),
		&userCache,
	)
	if err != nil {
		return nil, err
	}
	if userCache.Id != userId {
		return nil, fmt.Errorf("incomplete user cache for user %d", userId)
	}
	return &userCache, nil
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
	if userCache.Id != userId {
		return nil, fmt.Errorf("incomplete user cache for user %d", userId)
	}
	return &userCache, nil
}

func ensureUserQuotaCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	var lastErr error
	for attempt := 0; attempt < quotaCachePopulateAttempts; attempt++ {
		if _, err := cacheGetUserBase(userId); err == nil {
			return nil
		}

		generation, err := userQuotaCacheGeneration(userId)
		if err != nil {
			return err
		}
		var user User
		if err := DB.Unscoped().First(&user, userId).Error; err != nil {
			return err
		}
		if user.DeletedAt.Valid {
			user.Status = common.UserStatusDisabled
		}
		if _, err := populateUserCacheAtGeneration(user, generation); err != nil {
			return err
		}
		if _, err := cacheGetUserBase(userId); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	return fmt.Errorf("failed to initialize user quota cache after generation retries: %w", lastErr)
}

// Add atomic quota operations using hash fields
func cacheIncrUserQuota(userId int, delta int64) error {
	return applyUserQuotaCacheDelta(userId, delta)
}

func cacheDecrUserQuota(userId int, delta int64) error {
	return cacheIncrUserQuota(userId, -delta)
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
	if !common.RedisEnabled {
		return nil
	}
	statusInt := common.UserStatusEnabled
	if !status {
		statusInt = common.UserStatusDisabled
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Status", fmt.Sprintf("%d", statusInt))
}

func updateUserQuotaCache(userId int, quota int) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Quota", fmt.Sprintf("%d", quota))
}

func updateUserGroupCache(userId int, group string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Group", group)
}

func UpdateUserGroupCache(userId int, group string) error {
	return updateUserGroupCache(userId, group)
}

func updateUserEmailCache(userId int, email string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Email", email)
}

func updateUserNameCache(userId int, username string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Username", username)
}

func updateUserSettingCache(userId int, setting string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Setting", setting)
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
