package model

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ImageBillingReservationStatus string

const (
	ImageBillingReservationPreparing ImageBillingReservationStatus = "preparing"
	ImageBillingReservationActive    ImageBillingReservationStatus = "active"
	ImageBillingReservationRefunded  ImageBillingReservationStatus = "refunded"
)

var (
	ErrImageBillingReservationNotPreparing      = errors.New("image billing reservation is not preparing")
	ErrImageBillingReservationQuotaInsufficient = errors.New("image billing reservation quota is insufficient")
)

type imageReservationTransactionCallbackError struct {
	err error
}

func (e *imageReservationTransactionCallbackError) Error() string {
	if e == nil || e.err == nil {
		return "image reservation transaction callback failed"
	}
	return e.err.Error()
}

func (e *imageReservationTransactionCallbackError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

type imageReservationTransactionBeginError struct {
	err error
}

func (e *imageReservationTransactionBeginError) Error() string {
	if e == nil || e.err == nil {
		return "image reservation transaction could not begin"
	}
	return e.err.Error()
}

func (e *imageReservationTransactionBeginError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

// withImageReservationTransaction preserves the distinction between a
// callback failure (the debit definitely rolled back) and a commit failure
// (the database may already contain the debit).
func withImageReservationTransaction(fn func(*gorm.DB) error) error {
	callbackCalled := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		callbackCalled = true
		if callbackErr := fn(tx); callbackErr != nil {
			return &imageReservationTransactionCallbackError{err: callbackErr}
		}
		return nil
	})
	if err != nil && !callbackCalled {
		return &imageReservationTransactionBeginError{err: err}
	}
	return err
}

// ImageBillingReservation is the durable ownership record for quota deducted
// before an async image task becomes runnable. Each non-zero reserved leg is
// written in the same database transaction as its corresponding quota debit.
type ImageBillingReservation struct {
	ID                   int64                         `json:"id" gorm:"primaryKey"`
	TaskID               string                        `json:"task_id" gorm:"type:varchar(191);uniqueIndex"`
	RequestID            string                        `json:"request_id" gorm:"type:varchar(64);index"`
	UserID               int                           `json:"user_id" gorm:"index"`
	TokenID              int                           `json:"token_id" gorm:"index"`
	TokenCacheKeyHash    string                        `json:"-" gorm:"type:varchar(64);not null;default:''"`
	TokenRequired        bool                          `json:"token_required"`
	ExpectedQuota        int                           `json:"expected_quota"`
	FundingSource        string                        `json:"funding_source" gorm:"type:varchar(20)"`
	WalletReserved       int                           `json:"wallet_reserved"`
	WalletLegacyDebit    bool                          `json:"-" gorm:"column:wallet_legacy_debit"`
	TokenReserved        int                           `json:"token_reserved"`
	TokenLegacyDebit     bool                          `json:"-" gorm:"column:token_legacy_debit"`
	SubscriptionID       int                           `json:"subscription_id" gorm:"index"`
	SubscriptionReserved int64                         `json:"subscription_reserved"`
	Status               ImageBillingReservationStatus `json:"status" gorm:"type:varchar(20);index:idx_image_billing_reservation_due,priority:1"`
	FailureReason        string                        `json:"failure_reason" gorm:"type:text"`
	CacheReconciledAt    int64                         `json:"cache_reconciled_at" gorm:"bigint;not null;default:0;index"`
	// QuotaModeVersion distinguishes rows written before bounded legacy-balance
	// compatibility was introduced. A zero value is an old row that may need
	// its legacy debit mode inferred from the durable balance during recovery.
	QuotaModeVersion int   `json:"-" gorm:"column:quota_mode_version"`
	CreatedAt        int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt        int64 `json:"updated_at" gorm:"bigint;index:idx_image_billing_reservation_due,priority:2"`
}

const imageBillingReservationQuotaModeVersion = 1

// inferImageReservationLegacyDebit recognizes only the bounded compatibility
// window used by old reservation rows. New rows always carry an explicit mode;
// callers must gate this inference on a pre-versioned reservation.
func inferImageReservationLegacyDebit(current, amount int, explicit bool) bool {
	if explicit || amount <= 0 {
		return explicit
	}
	currentValue := int64(current)
	if currentValue > int64(common.MaxQuota) && currentValue <= int64(common.MaxLegacyQuota) {
		return true
	}
	if currentValue < int64(common.MinQuota) || currentValue > int64(common.MaxQuota) {
		return false
	}
	beforeDebit, ok := checkedQuotaAdd(currentValue, int64(amount))
	return ok && beforeDebit > int64(common.MaxQuota) && beforeDebit <= int64(common.MaxLegacyQuota)
}

func imageReservationCacheField(taskID string) string {
	return "ImageTaskReservation:" + taskID
}

func imageReservationCacheModeField(taskID string) string {
	return "ImageTaskReservationMode:" + taskID
}

func imageReservationCachePinMember(taskID string) string {
	return "reservation:" + taskID
}

func applyImageReservationCacheDebit(cacheKey string, pinsKey string, quotaField string, unlimitedField string, taskID string, amount int64) (bool, error) {
	applied, _, err := applyImageReservationCacheDebitWithMode(cacheKey, pinsKey, quotaField, unlimitedField, taskID, amount)
	return applied, err
}

func applyImageReservationCacheDebitWithMode(cacheKey string, pinsKey string, quotaField string, unlimitedField string, taskID string, amount int64) (bool, bool, error) {
	if !common.RedisEnabled {
		return false, false, nil
	}
	if common.RDB == nil {
		return false, false, errors.New("redis is enabled but unavailable")
	}
	if cacheKey == "" || pinsKey == "" || quotaField == "" || taskID == "" || amount <= 0 || amount > int64(common.MaxQuota) {
		return false, false, errors.New("image reservation cache debit is invalid")
	}

	const script = `
if redis.call('TTL', KEYS[1]) <= 0 then
  return -2
end
local current = tonumber(redis.call('HGET', KEYS[1], ARGV[1]))
if current == nil then
  return -2
end
local amount = tonumber(ARGV[4])
local tagged = redis.call('HGET', KEYS[1], ARGV[3])
if tagged then
  if tonumber(tagged) ~= amount then
    return -3
  end
  local tagged_mode = redis.call('HGET', KEYS[1], ARGV[9]) or 'normal'
  if tagged_mode ~= 'normal' and tagged_mode ~= 'legacy' then
    return -3
  end
  redis.call('SADD', KEYS[2], ARGV[7])
  redis.call('EXPIRE', KEYS[2], ARGV[8])
  redis.call('EXPIRE', KEYS[1], ARGV[8])
  if tagged_mode == 'legacy' then
    return 4
  end
  return 2
end
local unlimited = false
if ARGV[2] ~= '' then
  unlimited = redis.call('HGET', KEYS[1], ARGV[2]) == 'true'
end
if not unlimited and current < amount then
  return -1
end
local next_quota = current - amount
local normal_debit = current >= tonumber(ARGV[5]) and current <= tonumber(ARGV[6]) and
  next_quota >= tonumber(ARGV[5]) and next_quota <= tonumber(ARGV[6])
local legacy_debit = current > tonumber(ARGV[6]) and current <= tonumber(ARGV[10]) and
  next_quota >= tonumber(ARGV[5]) and next_quota <= tonumber(ARGV[10]) and next_quota < current
if not normal_debit and not legacy_debit then
  return -3
end
redis.call('HINCRBY', KEYS[1], ARGV[1], -amount)
redis.call('HSET', KEYS[1], ARGV[3], amount)
if legacy_debit then
  redis.call('HSET', KEYS[1], ARGV[9], 'legacy')
else
  redis.call('HSET', KEYS[1], ARGV[9], 'normal')
end
redis.call('SADD', KEYS[2], ARGV[7])
redis.call('EXPIRE', KEYS[2], ARGV[8])
redis.call('EXPIRE', KEYS[1], ARGV[8])
if legacy_debit then
  return 3
end
return 1
`
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{cacheKey, pinsKey},
		quotaField,
		unlimitedField,
		imageReservationCacheField(taskID),
		amount,
		common.MinQuota,
		common.MaxQuota,
		imageReservationCachePinMember(taskID),
		imageTaskQuotaCacheHoldSeconds,
		imageReservationCacheModeField(taskID),
		common.MaxLegacyQuota,
	).Int64()
	if err != nil {
		return false, false, fmt.Errorf("apply image reservation cache debit: %w", err)
	}
	switch result {
	case 1:
		return true, false, nil
	case 2:
		return false, false, nil
	case 3:
		return true, true, nil
	case 4:
		return false, true, nil
	case -1:
		return false, false, ErrImageBillingReservationQuotaInsufficient
	case -2:
		return false, false, errors.New("image reservation quota cache is unavailable")
	default:
		return false, false, errors.New("image reservation quota cache conflicts with task state")
	}
}

func releaseImageReservationCacheDebit(cacheKey string, pinsKey string, invalidationKey string, quotaField string, taskID string, restore bool) error {
	return releaseImageReservationCacheDebitWithMode(cacheKey, pinsKey, invalidationKey, quotaField, taskID, restore, nil)
}

func releaseImageReservationCacheDebitWithMode(cacheKey string, pinsKey string, invalidationKey string, quotaField string, taskID string, restore bool, legacyDebit *bool) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	if cacheKey == "" || pinsKey == "" || invalidationKey == "" || quotaField == "" || taskID == "" {
		return errors.New("image reservation cache refund is invalid")
	}
	cacheTTL := common.RedisKeyCacheSeconds()
	if cacheTTL <= 0 {
		cacheTTL = 1
	}
	restoreFlag := 0
	if restore {
		restoreFlag = 1
	}
	explicitMode := ""
	if legacyDebit != nil {
		explicitMode = "normal"
		if *legacyDebit {
			explicitMode = "legacy"
		}
	}

	const script = `
local function release_pin()
  redis.call('SREM', KEYS[2], ARGV[5])
  if redis.call('SCARD', KEYS[2]) == 0 then
    redis.call('DEL', KEYS[2])
    if redis.call('EXISTS', KEYS[3]) == 1 then
      redis.call('DEL', KEYS[1])
      redis.call('DEL', KEYS[3])
    elseif redis.call('EXISTS', KEYS[1]) == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[6])
    end
  end
end
if redis.call('EXISTS', KEYS[1]) == 0 then
  release_pin()
  return 0
end
local tagged = redis.call('HGET', KEYS[1], ARGV[2])
if not tagged then
  redis.call('HDEL', KEYS[1], ARGV[8])
  if ARGV[7] == '1' then
    -- A refunded reservation with a missing task tag cannot safely adjust the
    -- snapshot. Invalidate it atomically; keep the hash only while another
    -- pinned task still owns the reconciliation namespace.
    redis.call('SET', KEYS[3], '1', 'EX', ARGV[6])
  end
  release_pin()
  return 0
end
if ARGV[7] == '0' then
  redis.call('HDEL', KEYS[1], ARGV[2])
  redis.call('HDEL', KEYS[1], ARGV[8])
  release_pin()
  return 1
end
local amount = tonumber(tagged)
local current = tonumber(redis.call('HGET', KEYS[1], ARGV[1]))
if not amount or amount <= 0 or amount > tonumber(ARGV[3]) or current == nil then
  return -1
end
local tagged_mode = redis.call('HGET', KEYS[1], ARGV[8])
if ARGV[10] == 'normal' or ARGV[10] == 'legacy' then
  tagged_mode = ARGV[10]
elseif not tagged_mode then
    local inferred_next = current + amount
    if inferred_next < tonumber(ARGV[4]) or inferred_next > tonumber(ARGV[9]) then
      return -1
    end
    if inferred_next > tonumber(ARGV[3]) then
      tagged_mode = 'legacy'
    else
      tagged_mode = 'normal'
    end
end
if tagged_mode ~= 'normal' and tagged_mode ~= 'legacy' then
  return -1
end
local next_quota = current + amount
local max_restore = tonumber(ARGV[3])
if tagged_mode == 'legacy' then
  max_restore = tonumber(ARGV[9])
end
if next_quota < tonumber(ARGV[4]) or next_quota > max_restore then
  return -1
end
redis.call('HINCRBY', KEYS[1], ARGV[1], amount)
redis.call('HDEL', KEYS[1], ARGV[2])
redis.call('HDEL', KEYS[1], ARGV[8])
release_pin()
return 1
`
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{cacheKey, pinsKey, invalidationKey},
		quotaField,
		imageReservationCacheField(taskID),
		common.MaxQuota,
		common.MinQuota,
		imageReservationCachePinMember(taskID),
		cacheTTL,
		restoreFlag,
		imageReservationCacheModeField(taskID),
		common.MaxLegacyQuota,
		explicitMode,
	).Int64()
	if err != nil {
		return fmt.Errorf("restore image reservation cache debit: %w", err)
	}
	if result < 0 {
		return errors.New("image reservation quota cache conflicts with task state")
	}
	return nil
}

func restoreImageReservationCacheDebit(cacheKey string, pinsKey string, invalidationKey string, quotaField string, taskID string) error {
	return releaseImageReservationCacheDebit(cacheKey, pinsKey, invalidationKey, quotaField, taskID, true)
}

func restoreImageReservationCacheDebitWithMode(cacheKey string, pinsKey string, invalidationKey string, quotaField string, taskID string, legacyDebit bool) error {
	return releaseImageReservationCacheDebitWithMode(cacheKey, pinsKey, invalidationKey, quotaField, taskID, true, &legacyDebit)
}

var errImageReservationCacheNeedsInvalidation = errors.New("image reservation cache needs invalidation")

// reconcileImageReservationCacheAfterDBNoop repairs the cache after the
// durable reservation leg was already recorded. Redis can retain a stale hash
// while losing the per-task tag; blindly restoring a retry debit would then
// return the cache to the pre-debit balance. When this reservation is the only
// pin, the durable balance is authoritative and the hash/tag are rebuilt in one
// Lua transaction. With other pins, invalidate the snapshot instead of
// overwriting unrelated pending cache work.
func reconcileImageReservationCacheAfterDBNoop(
	cacheKey string,
	pinsKey string,
	quotaField string,
	taskID string,
	amount int,
	durableQuota int,
	legacyDebit bool,
) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	if cacheKey == "" || pinsKey == "" || quotaField == "" || taskID == "" || amount <= 0 || amount > common.MaxQuota {
		return errors.New("image reservation cache reconciliation is invalid")
	}
	target := int64(durableQuota)
	if target < int64(common.MinQuota) || target > int64(common.MaxLegacyQuota) ||
		(!legacyDebit && target > int64(common.MaxQuota)) {
		return errors.New("image reservation durable quota is out of range")
	}
	mode := "normal"
	if legacyDebit {
		mode = "legacy"
	}

	const script = `
if redis.call('TTL', KEYS[1]) <= 0 then
  return -2
end
local current = tonumber(redis.call('HGET', KEYS[1], ARGV[1]))
if current == nil then
  return -2
end
local target = tonumber(ARGV[5])
if target < tonumber(ARGV[6]) or target > tonumber(ARGV[8]) then
  return -3
end
if ARGV[4] == 'normal' and target > tonumber(ARGV[7]) then
  return -3
end
local tag = redis.call('HGET', KEYS[1], ARGV[2])
if tag and tonumber(tag) ~= tonumber(ARGV[3]) then
  return -3
end
local reservation_prefix = 'ImageTaskReservation:'
local mode_prefix = 'ImageTaskReservationMode:'
local fields = redis.call('HKEYS', KEYS[1])
for _, field in ipairs(fields) do
  local is_other_tag = string.sub(field, 1, string.len(reservation_prefix)) == reservation_prefix and field ~= ARGV[2]
  local is_other_mode = string.sub(field, 1, string.len(mode_prefix)) == mode_prefix and field ~= ARGV[10]
  if is_other_tag or is_other_mode then
    if tag then
      redis.call('HSET', KEYS[1], ARGV[10], ARGV[4])
    end
    return 2
  end
end
local pin = ARGV[9]
local members = redis.call('SMEMBERS', KEYS[2])
for _, member in ipairs(members) do
  if member ~= pin then
    if tag then
      redis.call('HSET', KEYS[1], ARGV[10], ARGV[4])
    end
    return 2
  end
end
redis.call('HSET', KEYS[1], ARGV[1], target)
redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
redis.call('HSET', KEYS[1], ARGV[10], ARGV[4])
redis.call('SADD', KEYS[2], pin)
redis.call('EXPIRE', KEYS[2], ARGV[11])
redis.call('EXPIRE', KEYS[1], ARGV[11])
return 1
`
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{cacheKey, pinsKey},
		quotaField,
		imageReservationCacheField(taskID),
		amount,
		mode,
		target,
		common.MinQuota,
		common.MaxQuota,
		common.MaxLegacyQuota,
		imageReservationCachePinMember(taskID),
		imageReservationCacheModeField(taskID),
		imageTaskQuotaCacheHoldSeconds,
	).Int64()
	if err != nil {
		return fmt.Errorf("reconcile image reservation cache: %w", err)
	}
	switch result {
	case 1:
		return nil
	case 2:
		return errImageReservationCacheNeedsInvalidation
	case -2:
		return errors.New("image reservation quota cache is unavailable")
	default:
		return errors.New("image reservation quota cache conflicts with durable state")
	}
}

func removeImageReservationCacheTags(taskID string, userID int, tokenKey string) error {
	tokenHMAC := ""
	if tokenKey != "" {
		tokenHMAC = common.GenerateHMAC(tokenKey)
	}
	return removeImageReservationCacheTagsByHash(taskID, userID, tokenHMAC)
}

func removeImageReservationCacheTagsByHash(taskID string, userID int, tokenHMAC string) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	if taskID == "" || userID <= 0 {
		return errors.New("image reservation cache identity is invalid")
	}

	if err := releaseImageReservationCacheDebit(
		getUserCacheKey(userID),
		imageTaskUserQuotaPinsKey(userID),
		imageTaskUserQuotaInvalidationKey(userID),
		"Quota",
		taskID,
		false,
	); err != nil {
		return err
	}
	if tokenHMAC == "" {
		return nil
	}
	return releaseImageReservationCacheDebit(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		constant.TokenFiledRemainQuota,
		taskID,
		false,
	)
}

func reconcileActiveImageBillingReservationCache(reservation *ImageBillingReservation, tokenHMAC string) error {
	if reservation == nil || reservation.ID == 0 || reservation.TaskID == "" {
		return errors.New("active image billing reservation is required")
	}
	if reservation.Status != ImageBillingReservationActive {
		return errors.New("image billing reservation is not active")
	}
	if reservation.CacheReconciledAt > 0 {
		return nil
	}
	if reservation.TokenReserved > 0 && tokenHMAC == "" {
		return errors.New("active image billing reservation token key is unavailable")
	}
	if err := removeImageReservationCacheTagsByHash(reservation.TaskID, reservation.UserID, tokenHMAC); err != nil {
		return err
	}

	now := common.GetTimestamp()
	result := DB.Model(&ImageBillingReservation{}).
		Where("id = ? AND status = ? AND cache_reconciled_at = 0", reservation.ID, ImageBillingReservationActive).
		Updates(map[string]any{
			"cache_reconciled_at": now,
			"updated_at":          now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		reservation.CacheReconciledAt = now
		reservation.UpdatedAt = now
	}
	return nil
}

func activeImageBillingReservationTokenHash(reservation *ImageBillingReservation) (string, error) {
	if reservation == nil || reservation.TokenID <= 0 || reservation.TokenReserved <= 0 {
		return "", nil
	}
	if reservation.TokenCacheKeyHash != "" {
		return reservation.TokenCacheKeyHash, nil
	}
	var token Token
	if err := DB.Unscoped().Where("id = ?", reservation.TokenID).First(&token).Error; err != nil {
		return "", err
	}
	if token.Key == "" {
		return "", errors.New("active image billing reservation token key is empty")
	}
	tokenHMAC := common.GenerateHMAC(token.Key)
	result := DB.Model(&ImageBillingReservation{}).
		Where("id = ? AND status = ? AND (token_cache_key_hash IS NULL OR token_cache_key_hash = ?)", reservation.ID, ImageBillingReservationActive, "").
		Update("token_cache_key_hash", tokenHMAC)
	if result.Error != nil {
		return "", result.Error
	}
	if result.RowsAffected == 0 {
		var current ImageBillingReservation
		if err := DB.Select("token_cache_key_hash").Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationActive).First(&current).Error; err != nil {
			return "", err
		}
		if current.TokenCacheKeyHash == "" {
			return "", errors.New("active image billing reservation token cache identity is unavailable")
		}
		tokenHMAC = current.TokenCacheKeyHash
	}
	reservation.TokenCacheKeyHash = tokenHMAC
	return tokenHMAC, nil
}

func (reservation *ImageBillingReservation) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if reservation.QuotaModeVersion == 0 {
		reservation.QuotaModeVersion = imageBillingReservationQuotaModeVersion
	}
	if reservation.Status == "" {
		reservation.Status = ImageBillingReservationPreparing
	}
	if reservation.CreatedAt == 0 {
		reservation.CreatedAt = now
	}
	if reservation.UpdatedAt == 0 {
		reservation.UpdatedAt = now
	}
	return nil
}

// InsertPreparedImageTask persists the non-runnable task, optional webhook,
// and reservation owner in one transaction before any quota is deducted.
func InsertPreparedImageTask(task *Task, webhook *TaskWebhook, reservation *ImageBillingReservation) error {
	if task == nil || reservation == nil {
		return errors.New("prepared image task and billing reservation are required")
	}
	if task.TaskID == "" || task.Status != TaskStatusReserving {
		return errors.New("prepared image task must have a task id and RESERVING status")
	}
	if reservation.TaskID == "" {
		reservation.TaskID = task.TaskID
	}
	if reservation.TaskID != task.TaskID || reservation.UserID != task.UserId {
		return errors.New("image billing reservation identity does not match task")
	}
	if reservation.ExpectedQuota < 0 || reservation.ExpectedQuota > common.MaxQuota {
		return errors.New("image billing reservation quota is out of range")
	}
	reservation.Status = ImageBillingReservationPreparing
	reservation.CacheReconciledAt = 0
	reservation.QuotaModeVersion = imageBillingReservationQuotaModeVersion

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		if reservation.TokenID > 0 && reservation.TokenCacheKeyHash == "" {
			var token Token
			if err := tx.Unscoped().
				Where("id = ? AND user_id = ?", reservation.TokenID, reservation.UserID).
				First(&token).Error; err != nil {
				return err
			}
			if token.Key == "" {
				return errors.New("image billing reservation token key is empty")
			}
			reservation.TokenCacheKeyHash = common.GenerateHMAC(token.Key)
		}
		if webhook != nil {
			webhook.TaskID = task.TaskID
			if err := tx.Create(webhook).Error; err != nil {
				return err
			}
		}
		return tx.Create(reservation).Error
	})
}

func GetImageBillingReservation(taskID string) (*ImageBillingReservation, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, errors.New("task id is required")
	}
	var reservation ImageBillingReservation
	if err := DB.Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
		return nil, err
	}
	return &reservation, nil
}

func reconcileImageReservationUserCacheAfterDBNoop(taskID string, userID int, amount int, legacyDebit bool) error {
	var user User
	if err := DB.Unscoped().Select("id", "quota").Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}
	err := reconcileImageReservationCacheAfterDBNoop(
		getUserCacheKey(userID),
		imageTaskUserQuotaPinsKey(userID),
		"Quota",
		taskID,
		amount,
		user.Quota,
		legacyDebit,
	)
	if errors.Is(err, errImageReservationCacheNeedsInvalidation) {
		return invalidateUserQuotaCache(userID)
	}
	return err
}

func reconcileImageReservationTokenCacheAfterDBNoop(taskID string, tokenID int, key string, amount int, legacyDebit bool) error {
	var token Token
	if err := DB.Unscoped().Select("id", "remain_quota").Where("id = ?", tokenID).First(&token).Error; err != nil {
		return err
	}
	tokenHMAC := common.GenerateHMAC(key)
	err := reconcileImageReservationCacheAfterDBNoop(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		constant.TokenFiledRemainQuota,
		taskID,
		amount,
		token.RemainQuota,
		legacyDebit,
	)
	if errors.Is(err, errImageReservationCacheNeedsInvalidation) {
		return invalidateTokenQuotaCache(key)
	}
	return err
}

// ReserveImageTaskWalletQuota atomically records and applies the wallet leg.
// Redis is decremented first so concurrent nodes retain the existing direct
// reservation semantics; any database failure synchronously compensates it.
func ReserveImageTaskWalletQuota(taskID string, userID int, quota int) error {
	if strings.TrimSpace(taskID) == "" || userID <= 0 {
		return errors.New("task id and user id are required")
	}
	if quota <= 0 || quota > common.MaxQuota {
		return errors.New("wallet reservation quota is out of range")
	}

	return withUserQuotaCacheLock(userID, func() error {
		cacheDebited := false
		var cacheLegacyDebit *bool
		if common.RedisEnabled {
			if err := ensureUserQuotaCache(userID); err != nil {
				return err
			}
			cacheApplied, legacyDebit, err := applyImageReservationCacheDebitWithMode(
				getUserCacheKey(userID),
				imageTaskUserQuotaPinsKey(userID),
				"Quota",
				"",
				taskID,
				int64(quota),
			)
			cacheDebited = cacheApplied
			if err != nil {
				if errors.Is(err, ErrImageBillingReservationQuotaInsufficient) {
					return fmt.Errorf("%w: user quota is not enough", err)
				}
				return err
			}
			cacheLegacyDebit = &legacyDebit
		}

		applied, legacyDebit, err := reserveImageTaskWalletQuotaDBWithMode(taskID, userID, quota, cacheLegacyDebit)
		// Once the transaction callback applied the DB debit, a returned commit
		// error is ambiguous: the server may still have committed it. Keep the
		// tagged cache debit for terminal recovery instead of risking over-credit.
		if !applied && err == nil && common.RedisEnabled {
			if cacheErr := reconcileImageReservationUserCacheAfterDBNoop(taskID, userID, quota, legacyDebit); cacheErr != nil {
				return cacheErr
			}
		} else if cacheDebited && !applied && err == nil {
			if cacheErr := restoreImageReservationCacheDebit(
				getUserCacheKey(userID),
				imageTaskUserQuotaPinsKey(userID),
				imageTaskUserQuotaInvalidationKey(userID),
				"Quota",
				taskID,
			); cacheErr != nil {
				common.SysLog("failed to compensate image wallet reservation cache: " + cacheErr.Error())
			}
		} else if cacheDebited && !applied {
			var callbackErr *imageReservationTransactionCallbackError
			var beginErr *imageReservationTransactionBeginError
			if errors.As(err, &callbackErr) || errors.As(err, &beginErr) {
				if cacheErr := restoreImageReservationCacheDebit(
					getUserCacheKey(userID),
					imageTaskUserQuotaPinsKey(userID),
					imageTaskUserQuotaInvalidationKey(userID),
					"Quota",
					taskID,
				); cacheErr != nil {
					common.SysLog("failed to compensate image wallet reservation cache: " + cacheErr.Error())
				}
			} else if err != nil {
				// A transaction error after the callback may be an ambiguous commit.
				// Retain the tagged debit until durable recovery can decide whether
				// the reservation was committed; restoring it here can overstate quota.
				common.SysLog("image wallet reservation DB result is ambiguous; retaining tagged cache debit: " + err.Error())
			}
		}
		return err
	})
}

func reserveImageTaskWalletQuotaDB(taskID string, userID int, quota int) (bool, error) {
	applied, _, err := reserveImageTaskWalletQuotaDBWithMode(taskID, userID, quota, nil)
	return applied, err
}

func reserveImageTaskWalletQuotaDBWithMode(taskID string, userID int, quota int, expectedLegacyDebit *bool) (bool, bool, error) {
	applied := false
	legacyDebit := false
	err := withImageReservationTransaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != userID {
			return errors.New("image wallet reservation user mismatch")
		}
		if reservation.WalletReserved != 0 {
			if reservation.WalletReserved != quota || reservation.FundingSource != "wallet" {
				return errors.New("conflicting image wallet reservation")
			}
			legacyDebit = reservation.WalletLegacyDebit
			if reservation.QuotaModeVersion < imageBillingReservationQuotaModeVersion {
				if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
					return err
				}
				legacyDebit = reservation.WalletLegacyDebit
			}
			// The durable mode is authoritative on replay. A legacy debit may
			// cross back into the normal range, so Redis can legitimately report
			// normal for a tag that was rebuilt after failover.
			if expectedLegacyDebit != nil && !legacyDebit && *expectedLegacyDebit {
				return errors.New("image wallet reservation cache mode conflicts with durable state")
			}
			return nil
		}
		if reservation.SubscriptionReserved != 0 || (reservation.FundingSource != "" && reservation.FundingSource != "wallet") {
			return errors.New("conflicting image wallet reservation")
		}

		var user User
		if err := lockForUpdate(tx.Unscoped()).Select("id", "quota").Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		delta := -int64(quota)
		nextQuota, ok := checkedQuotaAdd(int64(user.Quota), delta)
		if !ok || !quotaValueFitsInt(nextQuota) {
			return errors.New("image wallet reservation quota is out of range")
		}
		legacyStorageAllowed, err := quotaStorageAllowsLegacyDebit(tx, &User{}, "quota", int64(user.Quota), delta)
		if err != nil {
			return err
		}
		if !billingAdjustmentNextQuotaAllowed(int64(user.Quota), nextQuota, delta, legacyStorageAllowed) {
			return errors.New("image wallet reservation quota is out of range")
		}
		if nextQuota < 0 {
			return fmt.Errorf("%w: user quota is not enough", ErrImageBillingReservationQuotaInsufficient)
		}
		legacyDebit = int64(user.Quota) > int64(common.MaxQuota)
		if expectedLegacyDebit != nil && legacyDebit != *expectedLegacyDebit {
			return errors.New("image wallet reservation cache mode conflicts with database balance")
		}

		debit := tx.Unscoped().Model(&User{}).Where("id = ?", userID).Update("quota", int(nextQuota))
		if debit.Error != nil {
			return debit.Error
		}
		if debit.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		now := common.GetTimestamp()
		claim := tx.Model(&ImageBillingReservation{}).
			Where(
				"task_id = ? AND user_id = ? AND status = ? AND wallet_reserved = 0 AND subscription_reserved = 0 AND (funding_source = ? OR funding_source = ?)",
				taskID,
				userID,
				ImageBillingReservationPreparing,
				"",
				"wallet",
			).
			Updates(map[string]any{
				"funding_source":      "wallet",
				"wallet_reserved":     quota,
				"wallet_legacy_debit": legacyDebit,
				"quota_mode_version":  imageBillingReservationQuotaModeVersion,
				"updated_at":          now,
			})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			return errors.New("image wallet reservation claim lost")
		}
		applied = true
		return nil
	})
	return applied, legacyDebit, err
}

// ReserveImageTaskTokenQuota atomically records and applies the token leg.
func ReserveImageTaskTokenQuota(taskID string, tokenID int, key string, quota int) error {
	if strings.TrimSpace(taskID) == "" || tokenID <= 0 || key == "" {
		return errors.New("task id, token id, and token key are required")
	}
	if quota <= 0 || quota > common.MaxQuota {
		return errors.New("token reservation quota is out of range")
	}

	return withTokenQuotaCacheLock(key, func() error {
		cacheDebited := false
		var cacheLegacyDebit *bool
		if common.RedisEnabled {
			if err := ensureTokenQuotaCache(tokenID, key); err != nil {
				return err
			}
			cacheApplied, legacyDebit, err := applyImageReservationCacheDebitWithMode(
				fmt.Sprintf("token:%s", common.GenerateHMAC(key)),
				imageTaskTokenQuotaPinsKey(common.GenerateHMAC(key)),
				constant.TokenFiledRemainQuota,
				"UnlimitedQuota",
				taskID,
				int64(quota),
			)
			cacheDebited = cacheApplied
			if err != nil {
				if errors.Is(err, ErrImageBillingReservationQuotaInsufficient) {
					return errors.New("token quota is not enough")
				}
				return err
			}
			cacheLegacyDebit = &legacyDebit
		}

		applied, legacyDebit, err := reserveImageTaskTokenQuotaDBWithMode(taskID, tokenID, quota, cacheLegacyDebit)
		if !applied && err == nil && common.RedisEnabled {
			if cacheErr := reconcileImageReservationTokenCacheAfterDBNoop(taskID, tokenID, key, quota, legacyDebit); cacheErr != nil {
				return cacheErr
			}
		} else if cacheDebited && !applied && err == nil {
			if cacheErr := restoreImageReservationCacheDebit(
				fmt.Sprintf("token:%s", common.GenerateHMAC(key)),
				imageTaskTokenQuotaPinsKey(common.GenerateHMAC(key)),
				imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(key)),
				constant.TokenFiledRemainQuota,
				taskID,
			); cacheErr != nil {
				common.SysLog("failed to compensate image token reservation cache: " + cacheErr.Error())
			}
		} else if cacheDebited && !applied {
			var callbackErr *imageReservationTransactionCallbackError
			var beginErr *imageReservationTransactionBeginError
			if errors.As(err, &callbackErr) || errors.As(err, &beginErr) {
				if cacheErr := restoreImageReservationCacheDebit(
					fmt.Sprintf("token:%s", common.GenerateHMAC(key)),
					imageTaskTokenQuotaPinsKey(common.GenerateHMAC(key)),
					imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(key)),
					constant.TokenFiledRemainQuota,
					taskID,
				); cacheErr != nil {
					common.SysLog("failed to compensate image token reservation cache: " + cacheErr.Error())
				}
			} else if err != nil {
				// A transaction error after the callback may be an ambiguous commit.
				// Retain the tagged debit until durable recovery can decide whether
				// the reservation was committed; restoring it here can overstate quota.
				common.SysLog("image token reservation DB result is ambiguous; retaining tagged cache debit: " + err.Error())
			}
		}
		return err
	})
}

func reserveImageTaskTokenQuotaDB(taskID string, tokenID int, quota int) (bool, error) {
	applied, _, err := reserveImageTaskTokenQuotaDBWithMode(taskID, tokenID, quota, nil)
	return applied, err
}

func reserveImageTaskTokenQuotaDBWithMode(taskID string, tokenID int, quota int, expectedLegacyDebit *bool) (bool, bool, error) {
	applied := false
	legacyDebit := false
	err := withImageReservationTransaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.TokenID != tokenID {
			return errors.New("image token reservation token mismatch")
		}
		if reservation.TokenReserved != 0 {
			if reservation.TokenReserved != quota {
				return errors.New("conflicting image token reservation")
			}
			legacyDebit = reservation.TokenLegacyDebit
			if reservation.QuotaModeVersion < imageBillingReservationQuotaModeVersion {
				if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
					return err
				}
				legacyDebit = reservation.TokenLegacyDebit
			}
			if expectedLegacyDebit != nil && !legacyDebit && *expectedLegacyDebit {
				return errors.New("image token reservation cache mode conflicts with durable state")
			}
			return nil
		}

		var token Token
		if err := lockForUpdate(tx.Unscoped()).Where("id = ?", tokenID).First(&token).Error; err != nil {
			return err
		}
		delta := -int64(quota)
		nextRemain, remainOK := checkedQuotaAdd(int64(token.RemainQuota), delta)
		nextUsed, usedOK := checkedQuotaSubtract(int64(token.UsedQuota), delta)
		if !remainOK || !usedOK || !quotaValueFitsInt(nextRemain) || !quotaValueFitsInt(nextUsed) ||
			nextUsed < 0 || nextUsed > int64(common.MaxQuota) {
			return errors.New("image token reservation quota is out of range")
		}
		legacyStorageAllowed, err := quotaStorageAllowsLegacyDebit(tx, &Token{}, "remain_quota", int64(token.RemainQuota), delta)
		if err != nil {
			return err
		}
		if !billingAdjustmentNextQuotaAllowed(int64(token.RemainQuota), nextRemain, delta, legacyStorageAllowed) {
			return errors.New("image token reservation quota is out of range")
		}
		if !token.UnlimitedQuota && nextRemain < 0 {
			return errors.New("token quota is not enough")
		}
		legacyDebit = int64(token.RemainQuota) > int64(common.MaxQuota)
		if expectedLegacyDebit != nil && legacyDebit != *expectedLegacyDebit {
			return errors.New("image token reservation cache mode conflicts with database balance")
		}

		debit := tx.Unscoped().Model(&Token{}).Where("id = ?", tokenID).Updates(map[string]any{
			"remain_quota":  int(nextRemain),
			"used_quota":    int(nextUsed),
			"accessed_time": common.GetTimestamp(),
		})
		if debit.Error != nil {
			return debit.Error
		}
		if debit.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		now := common.GetTimestamp()
		claim := tx.Model(&ImageBillingReservation{}).
			Where("task_id = ? AND token_id = ? AND status = ? AND token_reserved = 0", taskID, tokenID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"token_reserved":     quota,
				"token_required":     true,
				"token_legacy_debit": legacyDebit,
				"quota_mode_version": imageBillingReservationQuotaModeVersion,
				"updated_at":         now,
			})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			return errors.New("image token reservation claim lost")
		}
		applied = true
		return nil
	})
	return applied, legacyDebit, err
}

// PreConsumeImageTaskSubscription writes the subscription pre-consume record
// and the reservation leg in one transaction.
func PreConsumeImageTaskSubscription(taskID string, requestID string, userID int, modelName string, quotaType int, amount int64) (*SubscriptionPreConsumeResult, error) {
	if strings.TrimSpace(taskID) == "" || strings.TrimSpace(requestID) == "" || userID <= 0 {
		return nil, errors.New("task id, request id, and user id are required")
	}
	if amount <= 0 || amount > int64(common.MaxQuota) {
		return nil, errors.New("subscription reservation quota is out of range")
	}

	now := GetDBTimestamp()
	var result *SubscriptionPreConsumeResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != userID || reservation.RequestID != requestID {
			return errors.New("image subscription reservation identity mismatch")
		}
		if reservation.WalletReserved > 0 || (reservation.FundingSource != "" && reservation.FundingSource != "subscription") {
			return errors.New("image billing reservation already uses wallet funding")
		}
		if reservation.SubscriptionReserved > 0 {
			if reservation.SubscriptionReserved != amount || reservation.FundingSource != "subscription" {
				return errors.New("conflicting image subscription reservation")
			}
			var record SubscriptionPreConsumeRecord
			if err := tx.Where("request_id = ?", requestID).First(&record).Error; err != nil {
				return err
			}
			var subscription UserSubscription
			if err := tx.Where("id = ?", record.UserSubscriptionId).First(&subscription).Error; err != nil {
				return err
			}
			result = &SubscriptionPreConsumeResult{
				UserSubscriptionId: subscription.Id,
				PreConsumed:        record.PreConsumed,
				AmountTotal:        subscription.AmountTotal,
				AmountUsedBefore:   subscription.AmountUsed,
				AmountUsedAfter:    subscription.AmountUsed,
			}
			return nil
		}

		var err error
		result, err = preConsumeUserSubscriptionTx(tx, requestID, userID, modelName, quotaType, amount, now)
		if err != nil {
			return err
		}
		update := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ? AND subscription_reserved = 0", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"funding_source":        "subscription",
				"subscription_id":       result.UserSubscriptionId,
				"subscription_reserved": result.PreConsumed,
				"updated_at":            common.GetTimestamp(),
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("image subscription reservation claim lost")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// RefundImageTaskSubscriptionQuota atomically rolls back the subscription
// record and clears the preparing ledger leg.
func RefundImageTaskSubscriptionQuota(taskID string, requestID string) error {
	if strings.TrimSpace(taskID) == "" || strings.TrimSpace(requestID) == "" {
		return errors.New("task id and request id are required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.RequestID != requestID {
			return errors.New("image subscription reservation request mismatch")
		}
		if reservation.SubscriptionReserved == 0 {
			return nil
		}
		if err := refundSubscriptionPreConsumeTx(tx, requestID); err != nil {
			return err
		}
		return tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"subscription_reserved": 0,
				"subscription_id":       0,
				"updated_at":            common.GetTimestamp(),
			}).Error
	})
}

// RefundImageTaskWalletQuota rolls back only the preparing wallet leg. It is
// safe to call repeatedly; once the leg is zero no further credit is applied.
func RefundImageTaskWalletQuota(taskID string, userID int) error {
	if strings.TrimSpace(taskID) == "" || userID <= 0 {
		return errors.New("task id and user id are required")
	}
	return withUserQuotaCacheLock(userID, func() error {
		refunded, _, legacyDebit, err := refundImageTaskWalletQuotaDB(taskID, userID)
		if err != nil {
			return err
		}
		if common.RedisEnabled {
			if !refunded {
				return restoreImageReservationCacheDebit(
					getUserCacheKey(userID),
					imageTaskUserQuotaPinsKey(userID),
					imageTaskUserQuotaInvalidationKey(userID),
					"Quota",
					taskID,
				)
			}
			return restoreImageReservationCacheDebitWithMode(
				getUserCacheKey(userID),
				imageTaskUserQuotaPinsKey(userID),
				imageTaskUserQuotaInvalidationKey(userID),
				"Quota",
				taskID,
				legacyDebit,
			)
		}
		return nil
	})
}

// refundImageTaskWalletQuotaBalanceTx restores one durable reservation debit.
// A legacy flag only widens the exact inverse operation to MaxLegacyQuota; it
// never permits an unrelated credit or an oversized single reservation.
func refundImageTaskWalletQuotaBalanceTx(tx *gorm.DB, userID int, amount int, legacyDebit bool, quotaModeVersion int) error {
	if tx == nil || userID <= 0 || amount <= 0 || amount > common.MaxQuota {
		return errors.New("image wallet reservation refund is out of range")
	}
	var user User
	if err := lockForUpdate(tx.Unscoped()).Select("id", "quota").Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("image wallet reservation refund lost: %w", err)
		}
		return err
	}
	nextQuota, ok := checkedQuotaAdd(int64(user.Quota), int64(amount))
	if quotaModeVersion < imageBillingReservationQuotaModeVersion {
		legacyDebit = inferImageReservationLegacyDebit(user.Quota, amount, legacyDebit)
	}
	if !ok || !quotaValueFitsInt(nextQuota) || (!legacyDebit && nextQuota > int64(common.MaxQuota)) {
		return errors.New("image wallet reservation refund lost")
	}
	legacyStorageAllowed, err := quotaStorageAllowsLegacyDebit(tx, &User{}, "quota", nextQuota, -int64(amount))
	if err != nil {
		return err
	}
	if !billingAdjustmentNextQuotaAllowed(nextQuota, int64(user.Quota), -int64(amount), legacyStorageAllowed) {
		return errors.New("image wallet reservation refund lost")
	}
	result := tx.Unscoped().Model(&User{}).Where("id = ?", userID).Update("quota", int(nextQuota))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("image wallet reservation refund lost")
	}
	return nil
}

func refundImageTaskWalletQuotaDB(taskID string, userID int) (bool, int, bool, error) {
	refunded := false
	amount := 0
	legacyDebit := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != userID {
			return errors.New("image wallet reservation user mismatch")
		}
		amount = reservation.WalletReserved
		if amount == 0 {
			return nil
		}
		if amount < 0 || amount > common.MaxQuota {
			return errors.New("image wallet reservation refund is out of range")
		}
		if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
			return err
		}
		legacyDebit = reservation.WalletLegacyDebit
		if err := refundImageTaskWalletQuotaBalanceTx(tx, userID, amount, legacyDebit, reservation.QuotaModeVersion); err != nil {
			return err
		}
		ledger := tx.Model(&ImageBillingReservation{}).Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"wallet_reserved":     0,
				"wallet_legacy_debit": legacyDebit,
				"quota_mode_version":  imageBillingReservationQuotaModeVersion,
				"updated_at":          common.GetTimestamp(),
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image wallet reservation refund lost")
		}
		refunded = true
		return nil
	})
	return refunded, amount, legacyDebit, err
}

// RefundImageTaskTokenQuota rolls back only the preparing token leg.
func RefundImageTaskTokenQuota(taskID string, tokenID int, key string) error {
	if strings.TrimSpace(taskID) == "" || tokenID <= 0 || key == "" {
		return errors.New("task id, token id, and token key are required")
	}
	return withTokenQuotaCacheLock(key, func() error {
		refunded, _, legacyDebit, err := refundImageTaskTokenQuotaDB(taskID, tokenID)
		if err != nil {
			return err
		}
		if common.RedisEnabled {
			if !refunded {
				return restoreImageReservationCacheDebit(
					fmt.Sprintf("token:%s", common.GenerateHMAC(key)),
					imageTaskTokenQuotaPinsKey(common.GenerateHMAC(key)),
					imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(key)),
					constant.TokenFiledRemainQuota,
					taskID,
				)
			}
			return restoreImageReservationCacheDebitWithMode(
				fmt.Sprintf("token:%s", common.GenerateHMAC(key)),
				imageTaskTokenQuotaPinsKey(common.GenerateHMAC(key)),
				imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(key)),
				constant.TokenFiledRemainQuota,
				taskID,
				legacyDebit,
			)
		}
		return nil
	})
}

// refundImageTaskTokenQuotaBalanceTx is the token-side exact inverse used by
// both preparing refunds and active-task permanent compensation.
func refundImageTaskTokenQuotaBalanceTx(tx *gorm.DB, tokenID int, amount int, legacyDebit bool, quotaModeVersion int) error {
	if tx == nil || tokenID <= 0 || amount <= 0 || amount > common.MaxQuota {
		return errors.New("image token reservation refund is out of range")
	}
	var token Token
	if err := lockForUpdate(tx.Unscoped()).Select("id", "remain_quota", "used_quota").Where("id = ?", tokenID).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("image token reservation refund lost: %w", err)
		}
		return err
	}
	nextRemain, remainOK := checkedQuotaAdd(int64(token.RemainQuota), int64(amount))
	nextUsed, usedOK := checkedQuotaSubtract(int64(token.UsedQuota), int64(amount))
	if quotaModeVersion < imageBillingReservationQuotaModeVersion {
		legacyDebit = inferImageReservationLegacyDebit(token.RemainQuota, amount, legacyDebit)
	}
	if !remainOK || !usedOK || !quotaValueFitsInt(nextRemain) || !quotaValueFitsInt(nextUsed) ||
		nextUsed < 0 || nextUsed > int64(common.MaxQuota) || (!legacyDebit && nextRemain > int64(common.MaxQuota)) {
		return errors.New("image token reservation refund lost")
	}
	legacyStorageAllowed, err := quotaStorageAllowsLegacyDebit(tx, &Token{}, "remain_quota", nextRemain, -int64(amount))
	if err != nil {
		return err
	}
	if !billingAdjustmentNextQuotaAllowed(nextRemain, int64(token.RemainQuota), -int64(amount), legacyStorageAllowed) {
		return errors.New("image token reservation refund lost")
	}
	result := tx.Unscoped().Model(&Token{}).Where("id = ?", tokenID).Updates(map[string]any{
		"remain_quota":  int(nextRemain),
		"used_quota":    int(nextUsed),
		"accessed_time": common.GetTimestamp(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("image token reservation refund lost")
	}
	return nil
}

func refundImageTaskTokenQuotaDB(taskID string, tokenID int) (bool, int, bool, error) {
	refunded := false
	amount := 0
	legacyDebit := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.TokenID != tokenID {
			return errors.New("image token reservation token mismatch")
		}
		amount = reservation.TokenReserved
		if amount == 0 {
			return nil
		}
		if amount < 0 || amount > common.MaxQuota {
			return errors.New("image token reservation refund is out of range")
		}
		if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
			return err
		}
		legacyDebit = reservation.TokenLegacyDebit
		if err := refundImageTaskTokenQuotaBalanceTx(tx, tokenID, amount, legacyDebit, reservation.QuotaModeVersion); err != nil {
			return err
		}
		ledger := tx.Model(&ImageBillingReservation{}).Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"token_reserved":     0,
				"token_legacy_debit": legacyDebit,
				"quota_mode_version": imageBillingReservationQuotaModeVersion,
				"updated_at":         common.GetTimestamp(),
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image token reservation refund lost")
		}
		refunded = true
		return nil
	})
	return refunded, amount, legacyDebit, err
}

// normalizeImageReservationQuotaModeTx backfills legacy debit metadata for a
// reservation created by a pre-compatibility worker. The durable balance and
// reserved amount are the only available evidence for those rows; once
// normalized, later retries use the persisted mode and never infer it for a
// newly-created normal reservation.
func normalizeImageReservationQuotaModeTx(tx *gorm.DB, reservation *ImageBillingReservation) error {
	if tx == nil || reservation == nil {
		return errors.New("image billing reservation normalization requires a transaction")
	}
	if reservation.QuotaModeVersion >= imageBillingReservationQuotaModeVersion {
		return nil
	}
	if reservation.WalletReserved > 0 {
		var user User
		if err := lockForUpdate(tx.Unscoped()).Select("id", "quota").Where("id = ?", reservation.UserID).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("image wallet reservation legacy mode cannot be inferred: %w", err)
			}
			return err
		}
		reservation.WalletLegacyDebit = inferImageReservationLegacyDebit(user.Quota, reservation.WalletReserved, reservation.WalletLegacyDebit)
	}
	if reservation.TokenReserved > 0 {
		var token Token
		if err := lockForUpdate(tx.Unscoped()).Select("id", "remain_quota").Where("id = ?", reservation.TokenID).First(&token).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("image token reservation legacy mode cannot be inferred: %w", err)
			}
			return err
		}
		reservation.TokenLegacyDebit = inferImageReservationLegacyDebit(token.RemainQuota, reservation.TokenReserved, reservation.TokenLegacyDebit)
	}
	reservation.QuotaModeVersion = imageBillingReservationQuotaModeVersion
	updates := map[string]any{
		"quota_mode_version":  reservation.QuotaModeVersion,
		"wallet_legacy_debit": reservation.WalletLegacyDebit,
		"token_legacy_debit":  reservation.TokenLegacyDebit,
		"updated_at":          common.GetTimestamp(),
	}
	if err := tx.Model(&ImageBillingReservation{}).Where("id = ?", reservation.ID).Updates(updates).Error; err != nil {
		return err
	}
	return nil
}

// ActivatePreparedImageTask transfers ownership of all recorded reservation
// legs and persists any private-input cleanup row in the same transaction.
func ActivatePreparedImageTask(task *Task, cleanups ...*ImageInputCleanup) (bool, error) {
	if task == nil || task.ID == 0 || task.TaskID == "" {
		return false, errors.New("persisted prepared image task is required")
	}
	if len(cleanups) > 1 {
		return false, errors.New("prepared image task accepts at most one input cleanup")
	}
	var cleanup *ImageInputCleanup
	if len(cleanups) == 1 {
		cleanup = cleanups[0]
	}
	activated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var lockedTask Task
		if err := lockForUpdate(tx).
			Select("id", "task_id", "platform", "status").
			Where("id = ? AND task_id = ?", task.ID, task.TaskID).
			First(&lockedTask).Error; err != nil {
			return err
		}
		if lockedTask.Platform != constant.TaskPlatformOpenAIImage {
			return errors.New("prepared image task platform is invalid")
		}
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", task.TaskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status == ImageBillingReservationActive {
			return nil
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if lockedTask.Status != TaskStatusReserving {
			return errors.New("prepared image task is no longer reserving")
		}
		if reservation.UserID != task.UserId {
			return errors.New("activated image task does not match billing reservation")
		}
		if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
			return err
		}
		if task.Quota != reservation.ExpectedQuota {
			canUpgradeZeroSubscription := reservation.ExpectedQuota == 0 &&
				task.Quota == 1 &&
				reservation.FundingSource == "subscription" &&
				reservation.SubscriptionReserved == 1
			if !canUpgradeZeroSubscription {
				return errors.New("activated image task does not match billing reservation")
			}
			reservation.ExpectedQuota = task.Quota
		}
		if task.Quota > 0 && reservation.FundingSource != "wallet" && reservation.FundingSource != "subscription" {
			return errors.New("image funding reservation is incomplete")
		}
		if reservation.FundingSource == "wallet" && reservation.WalletReserved != task.Quota {
			return errors.New("image wallet reservation is incomplete")
		}
		if reservation.FundingSource == "subscription" && reservation.SubscriptionReserved != int64(task.Quota) {
			return errors.New("image subscription reservation is incomplete")
		}
		if reservation.TokenRequired && reservation.TokenReserved != task.Quota {
			return errors.New("image token reservation is incomplete")
		}

		candidate := *task
		candidate.Status = TaskStatusNotStart
		candidate.Progress = "0%"
		candidate.PrivateData.BillingSource = reservation.FundingSource
		candidate.PrivateData.SubscriptionId = reservation.SubscriptionID
		candidate.PrivateData.TokenId = reservation.TokenID
		candidate.PrivateData.TokenPreConsumed = reservation.TokenReserved
		candidate.PrivateData.TokenBillingEnabled = reservation.TokenRequired
		candidate.PrivateData.WalletLegacyDebit = reservation.WalletLegacyDebit
		candidate.PrivateData.TokenLegacyDebit = reservation.TokenLegacyDebit
		candidate.UpdatedAt = common.GetTimestamp()
		update := tx.Model(&Task{}).
			Where("id = ? AND task_id = ? AND platform = ? AND status = ?", task.ID, task.TaskID, constant.TaskPlatformOpenAIImage, TaskStatusReserving).
			Select("*").
			Updates(&candidate)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("prepared image task activation lost")
		}
		ledger := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"status":              ImageBillingReservationActive,
				"expected_quota":      reservation.ExpectedQuota,
				"cache_reconciled_at": 0,
				"updated_at":          candidate.UpdatedAt,
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image billing reservation activation lost")
		}
		if err := activateImageInputCleanupTx(tx, &candidate, cleanup, candidate.UpdatedAt); err != nil {
			return err
		}
		*task = candidate
		activated = true
		return nil
	})
	if err != nil {
		return false, err
	}
	activeReservation, queryErr := GetImageBillingReservation(task.TaskID)
	if queryErr != nil {
		common.SysLog("failed to load active image reservation for cache reconciliation: " + queryErr.Error())
		return activated, nil
	}
	if activeReservation.Status != ImageBillingReservationActive {
		return activated, nil
	}
	tokenHMAC, tokenErr := activeImageBillingReservationTokenHash(activeReservation)
	if tokenErr != nil {
		common.SysLog("failed to load token for active image reservation cache reconciliation: " + tokenErr.Error())
		return activated, nil
	}
	if cacheErr := reconcileActiveImageBillingReservationCache(activeReservation, tokenHMAC); cacheErr != nil {
		common.SysLog("failed to reconcile active image reservation cache: " + cacheErr.Error())
	}
	return activated, nil
}

// RecoverStaleImageBillingReservations refunds stale pre-activation tasks.
// All database quota legs and the terminal task transition commit atomically;
// repeated recovery passes are no-ops after the ledger becomes refunded.
func RecoverStaleImageBillingReservations(cutoff int64, limit int, reason string) (int, error) {
	if cutoff <= 0 {
		return 0, errors.New("reservation cutoff is required")
	}
	if limit <= 0 {
		limit = 1
	}
	var firstErr error
	var active []ImageBillingReservation
	if err := DB.Where("status = ? AND cache_reconciled_at = 0 AND updated_at <= ?", ImageBillingReservationActive, cutoff).
		Order("updated_at asc, id asc").
		Limit(limit).
		Find(&active).Error; err != nil {
		return 0, err
	}
	for i := range active {
		tokenHMAC, err := activeImageBillingReservationTokenHash(&active[i])
		if err == nil {
			err = reconcileActiveImageBillingReservationCache(&active[i], tokenHMAC)
		}
		if err != nil && firstErr == nil {
			firstErr = fmt.Errorf("reconcile active image billing reservation %s: %w", active[i].TaskID, err)
		}
	}

	var unreconciled []ImageBillingReservation
	if err := DB.Where("status = ? AND cache_reconciled_at = 0", ImageBillingReservationRefunded).
		Order("id asc").
		Limit(limit).
		Find(&unreconciled).Error; err != nil {
		return 0, err
	}
	for i := range unreconciled {
		if _, err := RefundImageBillingReservation(unreconciled[i].TaskID, reason); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("reconcile refunded image billing reservation %s: %w", unreconciled[i].TaskID, err)
		}
	}

	var reservations []ImageBillingReservation
	if err := DB.Where("status = ? AND updated_at <= ?", ImageBillingReservationPreparing, cutoff).
		Order("id asc").
		Limit(limit).
		Find(&reservations).Error; err != nil {
		return 0, err
	}

	recovered := 0
	for i := range reservations {
		applied, err := RefundImageBillingReservation(reservations[i].TaskID, reason)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("refund stale image billing reservation %s: %w", reservations[i].TaskID, err)
			}
			continue
		}
		if applied {
			recovered++
		}
	}
	return recovered, firstErr
}

func reconcileRefundedImageBillingReservationCache(reservation *ImageBillingReservation, tokenKey string) error {
	if reservation == nil || reservation.ID == 0 || reservation.TaskID == "" {
		return errors.New("refunded image billing reservation is required")
	}
	if reservation.Status != ImageBillingReservationRefunded {
		return errors.New("image billing reservation is not refunded")
	}
	if reservation.CacheReconciledAt > 0 {
		return nil
	}
	if common.RedisEnabled {
		var walletErr error
		if reservation.QuotaModeVersion >= imageBillingReservationQuotaModeVersion {
			walletErr = restoreImageReservationCacheDebitWithMode(
				getUserCacheKey(reservation.UserID),
				imageTaskUserQuotaPinsKey(reservation.UserID),
				imageTaskUserQuotaInvalidationKey(reservation.UserID),
				"Quota",
				reservation.TaskID,
				reservation.WalletLegacyDebit,
			)
		} else {
			walletErr = restoreImageReservationCacheDebit(
				getUserCacheKey(reservation.UserID),
				imageTaskUserQuotaPinsKey(reservation.UserID),
				imageTaskUserQuotaInvalidationKey(reservation.UserID),
				"Quota",
				reservation.TaskID,
			)
		}
		if walletErr != nil {
			return fmt.Errorf("restore image wallet reservation cache: %w", walletErr)
		}
		if tokenKey != "" {
			var tokenErr error
			if reservation.QuotaModeVersion >= imageBillingReservationQuotaModeVersion {
				tokenErr = restoreImageReservationCacheDebitWithMode(
					fmt.Sprintf("token:%s", common.GenerateHMAC(tokenKey)),
					imageTaskTokenQuotaPinsKey(common.GenerateHMAC(tokenKey)),
					imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(tokenKey)),
					constant.TokenFiledRemainQuota,
					reservation.TaskID,
					reservation.TokenLegacyDebit,
				)
			} else {
				tokenErr = restoreImageReservationCacheDebit(
					fmt.Sprintf("token:%s", common.GenerateHMAC(tokenKey)),
					imageTaskTokenQuotaPinsKey(common.GenerateHMAC(tokenKey)),
					imageTaskTokenQuotaInvalidationKey(common.GenerateHMAC(tokenKey)),
					constant.TokenFiledRemainQuota,
					reservation.TaskID,
				)
			}
			if tokenErr != nil {
				return fmt.Errorf("restore image token reservation cache: %w", tokenErr)
			}
		}
	}

	result := DB.Model(&ImageBillingReservation{}).
		Where("id = ? AND status = ? AND cache_reconciled_at = 0", reservation.ID, ImageBillingReservationRefunded).
		Update("cache_reconciled_at", common.GetTimestamp())
	if result.Error != nil {
		return result.Error
	}
	return nil
}

// RefundImageBillingReservation atomically refunds every recorded preparing
// leg, including the idempotent subscription pre-consume record.
func RefundImageBillingReservation(taskID string, reason string) (bool, error) {
	if strings.TrimSpace(taskID) == "" {
		return false, errors.New("task id is required")
	}
	reservation, err := GetImageBillingReservation(taskID)
	if err != nil {
		return false, err
	}

	tokenKey := ""
	if reservation.TokenID > 0 {
		var token Token
		if queryErr := DB.Unscoped().Select("id", "key").Where("id = ?", reservation.TokenID).First(&token).Error; queryErr == nil {
			tokenKey = token.Key
		} else if !errors.Is(queryErr, gorm.ErrRecordNotFound) {
			return false, queryErr
		}
	}

	applied := false
	refund := func() error {
		var txErr error
		applied, _, _, txErr = refundImageBillingReservationDB(taskID, reason)
		if txErr != nil {
			return txErr
		}
		reservation, txErr = GetImageBillingReservation(taskID)
		if txErr != nil || reservation.Status != ImageBillingReservationRefunded {
			return txErr
		}
		return reconcileRefundedImageBillingReservationCache(reservation, tokenKey)
	}
	err = withImageTaskQuotaCacheLocks(reservation.UserID, tokenKey, refund)
	if err != nil {
		return applied, err
	}
	return applied, nil
}

func refundImageBillingReservationDB(taskID string, reason string) (bool, int, int, error) {
	applied := false
	walletRefunded := 0
	tokenRefunded := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var task Task
		if err := lockForUpdate(tx).
			Select("id", "task_id", "platform", "status").
			Where("task_id = ?", taskID).
			First(&task).Error; err != nil {
			return err
		}
		if task.Platform != constant.TaskPlatformOpenAIImage {
			return errors.New("image billing reservation task platform is invalid")
		}
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status == ImageBillingReservationRefunded {
			return nil
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return nil
		}
		if task.Status != TaskStatusReserving {
			return errors.New("image billing reservation task is no longer reserving")
		}
		if reservation.WalletReserved < 0 || reservation.WalletReserved > common.MaxQuota ||
			reservation.TokenReserved < 0 || reservation.TokenReserved > common.MaxQuota {
			return errors.New("image billing reservation refund is out of range")
		}
		if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
			return err
		}

		if reservation.SubscriptionReserved > 0 {
			if err := refundSubscriptionPreConsumeTx(tx, reservation.RequestID); err != nil {
				return err
			}
		}
		if reservation.WalletReserved > 0 {
			if err := refundImageTaskWalletQuotaBalanceTx(
				tx,
				reservation.UserID,
				reservation.WalletReserved,
				reservation.WalletLegacyDebit,
				reservation.QuotaModeVersion,
			); err != nil {
				return err
			}
			walletRefunded = reservation.WalletReserved
		}
		if reservation.TokenReserved > 0 {
			if err := refundImageTaskTokenQuotaBalanceTx(
				tx,
				reservation.TokenID,
				reservation.TokenReserved,
				reservation.TokenLegacyDebit,
				reservation.QuotaModeVersion,
			); err != nil {
				return err
			}
			tokenRefunded = reservation.TokenReserved
		}

		now := common.GetTimestamp()
		if len(reason) > 2000 {
			reason = reason[:2000]
		}
		ledger := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"status":                ImageBillingReservationRefunded,
				"wallet_reserved":       0,
				"wallet_legacy_debit":   reservation.WalletLegacyDebit,
				"token_reserved":        0,
				"token_legacy_debit":    reservation.TokenLegacyDebit,
				"quota_mode_version":    imageBillingReservationQuotaModeVersion,
				"subscription_reserved": 0,
				"failure_reason":        reason,
				"updated_at":            now,
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image billing reservation refund lost")
		}
		taskUpdate := tx.Model(&Task{}).
			Where("id = ? AND task_id = ? AND platform = ? AND status = ?", task.ID, taskID, constant.TaskPlatformOpenAIImage, TaskStatusReserving).
			Updates(map[string]any{
				"status":      TaskStatusFailure,
				"progress":    "100%",
				"fail_reason": reason,
				"finish_time": now,
				"updated_at":  now,
			})
		if taskUpdate.Error != nil {
			return taskUpdate.Error
		}
		if taskUpdate.RowsAffected != 1 {
			return errors.New("image billing reservation task terminalization lost")
		}
		if err := scheduleImageInputCleanupTx(tx, taskID, now); err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, walletRefunded, tokenRefunded, err
}

func HasStaleImageBillingReservations(cutoff int64) bool {
	if cutoff <= 0 {
		return false
	}
	var id int64
	err := DB.Model(&ImageBillingReservation{}).
		Where(
			"(status = ? AND updated_at <= ?) OR (status = ? AND cache_reconciled_at = 0 AND updated_at <= ?) OR (status = ? AND cache_reconciled_at = 0)",
			ImageBillingReservationPreparing,
			cutoff,
			ImageBillingReservationActive,
			cutoff,
			ImageBillingReservationRefunded,
		).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
}
