package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ImageTaskFinalizationResult struct {
	Task          *Task
	PreviousQuota int
	ActualQuota   int
	Delta         int
	Applied       bool
}

// ImageTaskFinalizationPermanentError identifies a billing-state invariant
// that cannot be repaired by retrying the same settlement inputs. The
// recovery worker may compensate only when BillingDBApplied is false.
type ImageTaskFinalizationPermanentError struct {
	BillingDBApplied bool
	Err              error
}

func (e *ImageTaskFinalizationPermanentError) Error() string {
	if e == nil || e.Err == nil {
		return "permanent image task finalization error"
	}
	return e.Err.Error()
}

func (e *ImageTaskFinalizationPermanentError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func IsPermanentImageTaskFinalizationError(err error) (*ImageTaskFinalizationPermanentError, bool) {
	var permanent *ImageTaskFinalizationPermanentError
	return permanent, errors.As(err, &permanent)
}

func isImageTaskFinalizationInvariantError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, errImageTaskQuotaCacheConflict) {
		return true
	}
	message := strings.ToLower(err.Error())
	for _, marker := range []string{
		"invalid final status",
		"actual quota is out of range",
		"pre-consumed quota is out of range",
		"token pre-consumed quota is out of range",
		"has no subscription id",
		"unsupported billing source",
		"subscription used exceeds total",
		"quota adjustment is out of range",
		"integer adjustment is out of range",
		"billing outbox quota is out of range",
		"billing reservation user mismatch",
		"has no active billing reservation",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

type imageTaskCacheAdjustment struct {
	taskID     string
	userID     int
	userDelta  int
	tokenKey   string
	tokenDelta int
}

type imageTaskCacheCoordinator struct {
	prepare func(imageTaskCacheAdjustment, *User, *Token) error
	commit  func(imageTaskCacheAdjustment) error
}

var (
	errImageTaskWalletQuotaInsufficient = errors.New("image task wallet quota is insufficient")
	errImageTaskTokenQuotaInsufficient  = errors.New("image task token quota is insufficient")
	errImageTaskQuotaCacheUnavailable   = errors.New("image task quota cache is unavailable")
	errImageTaskQuotaCacheConflict      = errors.New("image task quota cache state conflicts with billing state")
)

var defaultImageTaskCacheCoordinator = imageTaskCacheCoordinator{
	prepare: prepareImageTaskCacheAdjustment,
	commit:  commitImageTaskCacheAdjustment,
}

const imageTaskQuotaCacheHoldSeconds = 7 * 24 * 60 * 60

func imageTaskUserQuotaPinsKey(userID int) string {
	return fmt.Sprintf("billing:image-task-cache-pins:user:%d", userID)
}

func imageTaskUserQuotaInvalidationKey(userID int) string {
	return fmt.Sprintf("billing:image-task-cache-invalidate:user:%d", userID)
}

func imageTaskTokenQuotaPinsKey(tokenHMAC string) string {
	return fmt.Sprintf("billing:image-task-cache-pins:token:%s", tokenHMAC)
}

func imageTaskTokenQuotaInvalidationKey(tokenHMAC string) string {
	return fmt.Sprintf("billing:image-task-cache-invalidate:token:%s", tokenHMAC)
}

func invalidateImageTaskQuotaCache(cacheKey string, pinsKey string, invalidationKey string, invalidStatus int) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	const script = `
if redis.call('SCARD', KEYS[2]) > 0 then
  -- Quota reconciliation still owns this hash, so deletion must be deferred.
  -- Disable authentication immediately while preserving the pinned quota data.
  if redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('HSET', KEYS[1], 'Status', ARGV[2])
  end
  redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
  return 0
end
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[3])
return 1
`
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return common.RDB.Eval(
		ctx,
		script,
		[]string{cacheKey, pinsKey, invalidationKey},
		imageTaskQuotaCacheHoldSeconds,
		invalidStatus,
	).Err()
}

// FinalizeImageTask first fences local pending quota batches, then atomically
// reserves the final cache delta before committing the durable billing rows.
// BillingDBApplied makes the DB phase replay-safe; the Redis marker makes the
// cache phase replay-safe across worker crashes and gateway nodes.
func FinalizeImageTask(taskID string) (*ImageTaskFinalizationResult, error) {
	if taskID == "" {
		return nil, errors.New("image task id is required")
	}

	var identity Task
	if err := DB.Select("id", "task_id", "platform", "user_id", "status", "quota", "private_data").
		Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).
		First(&identity).Error; err != nil {
		return nil, err
	}
	if identity.Status == TaskStatusSuccess || identity.Status == TaskStatusFailure {
		return &ImageTaskFinalizationResult{
			Task:          &identity,
			PreviousQuota: identity.Quota,
			ActualQuota:   identity.Quota,
		}, nil
	}

	tokenKey := ""
	if identity.PrivateData.TokenId > 0 {
		var token Token
		query := DB.Unscoped().Select(commonKeyCol).
			Where("id = ? AND user_id = ?", identity.PrivateData.TokenId, identity.UserId).
			First(&token)
		if query.Error != nil && !errors.Is(query.Error, gorm.ErrRecordNotFound) {
			return nil, query.Error
		}
		if query.Error == nil {
			tokenKey = token.Key
		}
	}

	var result *ImageTaskFinalizationResult
	finalize := func() error {
		return withFlushedImageQuotaBatches(identity.UserId, identity.PrivateData.TokenId, func() error {
			var err error
			result, err = finalizeImageTaskWithCache(taskID, defaultImageTaskCacheCoordinator)
			return err
		})
	}
	var err error
	if tokenKey != "" {
		err = withTokenQuotaCacheLock(tokenKey, finalize)
	} else {
		err = finalize()
	}
	if err != nil && isImageTaskFinalizationInvariantError(err) {
		var current Task
		if queryErr := DB.Select("private_data").Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).First(&current).Error; queryErr == nil {
			err = &ImageTaskFinalizationPermanentError{BillingDBApplied: current.PrivateData.BillingDBApplied, Err: err}
		}
	}
	return result, err
}

func finalizeImageTaskWithCache(taskID string, cache imageTaskCacheCoordinator) (*ImageTaskFinalizationResult, error) {
	if cache.prepare == nil || cache.commit == nil {
		return nil, errors.New("image task cache coordinator is required")
	}

	result := &ImageTaskFinalizationResult{}
	cacheAdjustment := imageTaskCacheAdjustment{taskID: taskID}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var task Task
		if err := lockForUpdate(tx).
			Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).
			First(&task).Error; err != nil {
			return err
		}

		if task.Status == TaskStatusSuccess || task.Status == TaskStatusFailure {
			result.Task = &task
			result.PreviousQuota = task.Quota
			result.ActualQuota = task.Quota
			return nil
		}
		if task.Status != TaskStatusFinalizing {
			return fmt.Errorf("image task %s is not finalizing", task.TaskID)
		}

		targetStatus := task.PrivateData.BillingFinalStatus
		if targetStatus != TaskStatusSuccess && targetStatus != TaskStatusFailure {
			return fmt.Errorf("image task %s has invalid final status %q", task.TaskID, targetStatus)
		}
		actualQuota := task.PrivateData.BillingActualQuota
		if actualQuota < 0 || actualQuota > common.MaxQuota {
			return fmt.Errorf("image task %s actual quota is out of range", task.TaskID)
		}
		if task.Quota < 0 || task.Quota > common.MaxQuota {
			return fmt.Errorf("image task %s pre-consumed quota is out of range", task.TaskID)
		}
		previousQuota := task.Quota
		delta := actualQuota - previousQuota

		isSubscription := false
		switch task.PrivateData.BillingSource {
		case "", "wallet":
		case "subscription":
			if task.PrivateData.SubscriptionId <= 0 {
				return fmt.Errorf("image task %s has no subscription id", task.TaskID)
			}
			isSubscription = true
		default:
			return fmt.Errorf("image task %s has unsupported billing source %q", task.TaskID, task.PrivateData.BillingSource)
		}
		tokenPreConsumed := task.PrivateData.TokenPreConsumed
		if tokenPreConsumed < 0 || tokenPreConsumed > common.MaxQuota {
			return fmt.Errorf("image task %s token pre-consumed quota is out of range", task.TaskID)
		}
		tokenBillingEnabled := task.PrivateData.TokenBillingEnabled || tokenPreConsumed > 0
		tokenActualQuota := 0
		if tokenBillingEnabled {
			tokenActualQuota = actualQuota
		}
		tokenDelta := tokenActualQuota - tokenPreConsumed

		if !task.PrivateData.BillingDBApplied {
			var user User
			if err := lockForUpdate(tx.Unscoped()).Where("id = ?", task.UserId).First(&user).Error; err != nil {
				return err
			}

			var subscription UserSubscription
			if isSubscription {
				if err := lockForUpdate(tx).
					Where("id = ? AND user_id = ?", task.PrivateData.SubscriptionId, task.UserId).
					First(&subscription).Error; err != nil {
					return err
				}
			}

			var token Token
			hasToken := false
			if task.PrivateData.TokenId > 0 && tokenBillingEnabled {
				tokenQuery := lockForUpdate(tx.Unscoped()).
					Where("id = ? AND user_id = ?", task.PrivateData.TokenId, task.UserId).
					First(&token)
				if tokenQuery.Error != nil && !errors.Is(tokenQuery.Error, gorm.ErrRecordNotFound) {
					return tokenQuery.Error
				}
				hasToken = tokenQuery.Error == nil
			}
			var tokenSnapshot *Token
			if hasToken {
				tokenSnapshot = &token
			}

			insufficientReason := ""
			if targetStatus == TaskStatusSuccess {
				if delta > 0 && isSubscription {
					newAmountUsed, err := checkedInt64Add(subscription.AmountUsed, int64(delta))
					if err != nil {
						return fmt.Errorf("adjust subscription quota for image task %s: %w", task.TaskID, err)
					}
					if subscription.AmountTotal > 0 && newAmountUsed > subscription.AmountTotal {
						insufficientReason = "subscription quota insufficient during final settlement"
					}
				} else if delta > 0 && !common.RedisEnabled && user.Quota < delta {
					insufficientReason = "wallet quota insufficient during final settlement"
				}
				if insufficientReason == "" && tokenDelta > 0 && hasToken && !common.RedisEnabled && !token.UnlimitedQuota && token.RemainQuota < tokenDelta {
					insufficientReason = "token quota insufficient during final settlement"
				}
			}

			cacheAdjustment.userID = task.UserId
			if !isSubscription {
				cacheAdjustment.userDelta = -delta
			}
			cacheAdjustment.tokenDelta = -tokenDelta
			if hasToken {
				cacheAdjustment.tokenKey = token.Key
			} else {
				cacheAdjustment.tokenDelta = 0
			}

			cachePrepared := false
			if insufficientReason == "" {
				prepareErr := cache.prepare(cacheAdjustment, &user, tokenSnapshot)
				switch {
				case prepareErr == nil:
					cachePrepared = true
				case errors.Is(prepareErr, errImageTaskWalletQuotaInsufficient):
					insufficientReason = "wallet quota insufficient during final settlement"
				case errors.Is(prepareErr, errImageTaskTokenQuotaInsufficient):
					insufficientReason = "token quota insufficient during final settlement"
				default:
					return prepareErr
				}
			}

			if insufficientReason != "" {
				// No billing leg has been changed yet. Convert the task to a failure
				// and refund every pre-consumed leg in this same settlement.
				targetStatus = TaskStatusFailure
				actualQuota = 0
				delta = -previousQuota
				tokenActualQuota = 0
				tokenDelta = -tokenPreConsumed
				task.FailReason = insufficientReason
				task.Data = nil
				task.PrivateData.ResultURL = ""
				task.PrivateData.BillingFinalStatus = targetStatus
				task.PrivateData.BillingActualQuota = actualQuota

				cacheAdjustment.userID = task.UserId
				cacheAdjustment.userDelta = 0
				if !isSubscription {
					cacheAdjustment.userDelta = -delta
				}
				cacheAdjustment.tokenDelta = -tokenDelta
				if !hasToken {
					cacheAdjustment.tokenDelta = 0
				}
				if !cachePrepared {
					if err := cache.prepare(cacheAdjustment, &user, tokenSnapshot); err != nil {
						return err
					}
				}
			}

			if isSubscription && delta != 0 {
				newAmountUsed, err := checkedInt64Add(subscription.AmountUsed, int64(delta))
				if err != nil {
					return fmt.Errorf("adjust subscription quota for image task %s: %w", task.TaskID, err)
				}
				if newAmountUsed < 0 {
					newAmountUsed = 0
				}
				if subscription.AmountTotal > 0 && newAmountUsed > subscription.AmountTotal {
					return fmt.Errorf("subscription used exceeds total, used=%d total=%d", newAmountUsed, subscription.AmountTotal)
				}
				if err := tx.Model(&subscription).Update("amount_used", newAmountUsed).Error; err != nil {
					return err
				}
			}

			newUsedQuota, err := checkedImageQuotaAdd(user.UsedQuota, actualQuota)
			if err != nil {
				return fmt.Errorf("record user used quota for image task %s: %w", task.TaskID, err)
			}
			if user.RequestCount == math.MaxInt {
				return fmt.Errorf("record user request count for image task %s: integer adjustment is out of range", task.TaskID)
			}
			userUpdates := map[string]any{
				"used_quota":    newUsedQuota,
				"request_count": user.RequestCount + 1,
			}
			if !isSubscription && delta != 0 {
				newQuota, err := checkedImageQuotaAdd(user.Quota, -delta)
				if err != nil {
					return fmt.Errorf("adjust user quota for image task %s: %w", task.TaskID, err)
				}
				userUpdates["quota"] = newQuota
			}
			if err := tx.Unscoped().Model(&User{}).Where("id = ?", task.UserId).Updates(userUpdates).Error; err != nil {
				return err
			}

			if task.PrivateData.TokenId > 0 && tokenDelta != 0 {
				if hasToken {
					newRemainQuota, err := checkedImageQuotaAdd(token.RemainQuota, -tokenDelta)
					if err != nil {
						return fmt.Errorf("adjust token remaining quota for image task %s: %w", task.TaskID, err)
					}
					newTokenUsedQuota, err := checkedImageQuotaAdd(token.UsedQuota, tokenDelta)
					if err != nil {
						return fmt.Errorf("adjust token used quota for image task %s: %w", task.TaskID, err)
					}
					tokenUpdate := tx.Unscoped().Model(&token).Updates(map[string]any{
						"remain_quota":  newRemainQuota,
						"used_quota":    newTokenUsedQuota,
						"accessed_time": common.GetTimestamp(),
					})
					if tokenUpdate.Error != nil {
						return tokenUpdate.Error
					}
					if tokenUpdate.RowsAffected != 1 {
						return errors.New("image task token ledger update lost")
					}
				}
			}

			if task.ChannelId > 0 && actualQuota != 0 {
				var channel Channel
				channelQuery := lockForUpdate(tx).Where("id = ?", task.ChannelId).First(&channel)
				if channelQuery.Error != nil && !errors.Is(channelQuery.Error, gorm.ErrRecordNotFound) {
					return channelQuery.Error
				}
				if channelQuery.Error == nil {
					newUsedQuota, err := checkedInt64Add(channel.UsedQuota, int64(actualQuota))
					if err != nil {
						return fmt.Errorf("record channel used quota for image task %s: %w", task.TaskID, err)
					}
					if err := tx.Model(&channel).Update("used_quota", newUsedQuota).Error; err != nil {
						return err
					}
				}
			}

			task.PrivateData.BillingDBApplied = true
			task.UpdatedAt = common.GetTimestamp()
			update := tx.Model(&Task{}).
				Where("id = ? AND status = ?", task.ID, TaskStatusFinalizing).
				Updates(map[string]any{
					"private_data": task.PrivateData,
					"fail_reason":  task.FailReason,
					"data":         task.Data,
					"updated_at":   task.UpdatedAt,
				})
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errors.New("image task billing lost its state lock")
			}
		} else {
			cacheAdjustment.userID = task.UserId
			if !isSubscription {
				cacheAdjustment.userDelta = -delta
			}
			cacheAdjustment.tokenDelta = -tokenDelta
			if task.PrivateData.TokenId > 0 && cacheAdjustment.tokenDelta != 0 {
				var token Token
				query := tx.Unscoped().Select(commonKeyCol).
					Where("id = ? AND user_id = ?", task.PrivateData.TokenId, task.UserId).
					First(&token)
				if query.Error != nil && !errors.Is(query.Error, gorm.ErrRecordNotFound) {
					return query.Error
				}
				if query.Error == nil {
					cacheAdjustment.tokenKey = token.Key
				} else {
					cacheAdjustment.tokenDelta = 0
				}
			}
		}

		result.Task = &task
		result.PreviousQuota = previousQuota
		result.ActualQuota = actualQuota
		result.Delta = delta
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result.Task == nil || result.Task.Status != TaskStatusFinalizing {
		return result, nil
	}

	if err := cache.commit(cacheAdjustment); err != nil {
		return nil, err
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		var task Task
		if err := lockForUpdate(tx).
			Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).
			First(&task).Error; err != nil {
			return err
		}
		if task.Status == TaskStatusSuccess || task.Status == TaskStatusFailure {
			result.Task = &task
			return nil
		}
		if task.Status != TaskStatusFinalizing || !task.PrivateData.BillingDBApplied {
			return errors.New("image task cache reconciliation lost its state lock")
		}

		targetStatus := task.PrivateData.BillingFinalStatus
		actualQuota := task.PrivateData.BillingActualQuota
		now := common.GetTimestamp()
		task.Quota = actualQuota
		task.Status = targetStatus
		task.Progress = "100%"
		task.FinishTime = now
		task.UpdatedAt = now
		task.FinalizeAttempts = 0
		task.FinalizeNextRetryAt = 0
		task.FinalizeError = ""
		task.CheckpointData = nil
		task.PrivateData.BillingFinalStatus = ""
		task.PrivateData.BillingActualQuota = 0
		task.PrivateData.BillingDBApplied = false
		if err := deleteImageTaskArtifactTx(tx, task.TaskID); err != nil {
			return err
		}
		billingLogReason := "async image usage reconciliation"
		if task.Status == TaskStatusFailure && task.FailReason != "" {
			billingLogReason = task.FailReason
		}
		if err := enqueueImageTaskBillingLogTx(tx, &task, result.PreviousQuota, billingLogReason); err != nil {
			return err
		}
		update := tx.Model(&Task{}).
			Where("id = ? AND status = ?", task.ID, TaskStatusFinalizing).
			Select(
				"quota", "status", "progress", "finish_time", "updated_at",
				"finalize_attempts", "finalize_next_retry_at", "finalize_error", "fail_reason", "data", "checkpoint_data", "private_data",
			).
			Updates(&task)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("image task finalization lost its state lock")
		}
		result.Task = &task
		result.Applied = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func prepareImageTaskCacheAdjustment(adjustment imageTaskCacheAdjustment, user *User, token *Token) error {
	if !common.RedisEnabled || (adjustment.userDelta == 0 && adjustment.tokenDelta == 0) {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("%w: redis client is nil", errImageTaskQuotaCacheUnavailable)
	}
	if adjustment.taskID == "" {
		return fmt.Errorf("%w: task id is empty", errImageTaskQuotaCacheConflict)
	}
	if adjustment.userDelta != 0 {
		if user == nil || user.Id <= 0 || user.Id != adjustment.userID {
			return fmt.Errorf("%w: user cache identity is invalid", errImageTaskQuotaCacheConflict)
		}
		if _, err := cacheGetUserBase(adjustment.userID); err != nil {
			cacheUser := *user
			if cacheUser.DeletedAt.Valid {
				cacheUser.Status = common.UserStatusDisabled
			}
			if err := populateUserCache(cacheUser); err != nil {
				return fmt.Errorf("%w: initialize user cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
			if _, err := cacheGetUserBase(adjustment.userID); err != nil {
				return fmt.Errorf("%w: verify user cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
		}
		if user.DeletedAt.Valid {
			if err := updateUserStatusCache(user.Id, false); err != nil {
				return fmt.Errorf("%w: disable deleted user cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
		}
	}
	if adjustment.tokenDelta != 0 {
		if token == nil || token.Id <= 0 || adjustment.tokenKey == "" || token.Key != adjustment.tokenKey {
			return fmt.Errorf("%w: token cache identity is invalid", errImageTaskQuotaCacheConflict)
		}
		cached, err := cacheGetTokenByKey(adjustment.tokenKey)
		if err != nil || cached.Id != token.Id {
			cacheToken := *token
			if cacheToken.DeletedAt.Valid {
				cacheToken.Status = common.TokenStatusDisabled
			}
			if err := cacheSetTokenIfAbsent(cacheToken); err != nil {
				return fmt.Errorf("%w: initialize token cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
			cached, err = cacheGetTokenByKey(adjustment.tokenKey)
			if err != nil {
				return fmt.Errorf("%w: verify token cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
			if cached.Id != token.Id {
				return fmt.Errorf("%w: token cache id mismatch", errImageTaskQuotaCacheConflict)
			}
		}
		if token.DeletedAt.Valid {
			if err := cacheSetTokenField(token.Key, "Status", fmt.Sprintf("%d", common.TokenStatusDisabled)); err != nil {
				return fmt.Errorf("%w: disable deleted token cache: %v", errImageTaskQuotaCacheUnavailable, err)
			}
		}
	}

	const script = `
local user_delta = tonumber(ARGV[1])
local token_delta = tonumber(ARGV[2])
local task_field = ARGV[3]
local task_id = ARGV[4]
local hold_ttl = tonumber(ARGV[5])
local min_quota = tonumber(ARGV[6])
local max_quota = tonumber(ARGV[7])

local state = redis.call('HGET', KEYS[1], 'state')
if state then
  if redis.call('HGET', KEYS[1], 'user_key') ~= KEYS[2]
    or redis.call('HGET', KEYS[1], 'user_delta') ~= ARGV[1]
    or redis.call('HGET', KEYS[1], 'token_key') ~= KEYS[3]
    or redis.call('HGET', KEYS[1], 'token_delta') ~= ARGV[2] then
    return -4
  end
  if state ~= 'prepared' then
    return -4
  end
elseif redis.call('EXISTS', KEYS[1]) == 1 then
  -- A marker hash without a state is partial/corrupt and must not be
  -- overwritten. A completely missing marker is the expected first prepare.
  return -4
end

local apply_user = false
if user_delta ~= 0 then
  if redis.call('EXISTS', KEYS[2]) == 0 then
    return -3
  end
  local tagged_delta = redis.call('HGET', KEYS[2], task_field)
  if tagged_delta then
    if tagged_delta ~= ARGV[1] then
      return -4
    end
  else
    local current = tonumber(redis.call('HGET', KEYS[2], 'Quota'))
    if current == nil then
      return -3
    end
    local next_quota = current + user_delta
    if next_quota < 0 then
      return -1
    end
    if next_quota < min_quota or next_quota > max_quota then
      return -4
    end
    apply_user = true
  end
end

local apply_token = false
if token_delta ~= 0 then
  if redis.call('EXISTS', KEYS[3]) == 0 then
    return -3
  end
  local tagged_delta = redis.call('HGET', KEYS[3], task_field)
  if tagged_delta then
    if tagged_delta ~= ARGV[2] then
      return -4
    end
  else
    local current = tonumber(redis.call('HGET', KEYS[3], ARGV[8]))
    if current == nil then
      return -3
    end
    local unlimited = redis.call('HGET', KEYS[3], 'UnlimitedQuota') == 'true'
    local next_quota = current + token_delta
    if not unlimited and next_quota < 0 then
      return -2
    end
    if next_quota < min_quota or next_quota > max_quota then
      return -4
    end
    apply_token = true
  end
end

if apply_user then
  redis.call('HINCRBY', KEYS[2], 'Quota', user_delta)
  redis.call('HSET', KEYS[2], task_field, ARGV[1])
end
if user_delta ~= 0 then
  redis.call('SADD', KEYS[4], task_id)
  redis.call('EXPIRE', KEYS[4], hold_ttl)
  redis.call('EXPIRE', KEYS[2], hold_ttl)
end
if apply_token then
  redis.call('HINCRBY', KEYS[3], ARGV[8], token_delta)
  redis.call('HSET', KEYS[3], task_field, ARGV[2])
end
if token_delta ~= 0 then
  redis.call('SADD', KEYS[5], task_id)
  redis.call('EXPIRE', KEYS[5], hold_ttl)
  redis.call('EXPIRE', KEYS[3], hold_ttl)
end

redis.call('HSET', KEYS[1],
  'state', 'prepared',
  'user_key', KEYS[2],
  'user_delta', ARGV[1],
  'token_key', KEYS[3],
  'token_delta', ARGV[2])
redis.call('EXPIRE', KEYS[1], hold_ttl)
return 1
`
	markerKey := "billing:image-task-cache:" + adjustment.taskID
	userKey := markerKey + ":no-user"
	userPinsKey := markerKey + ":no-user-pins"
	if adjustment.userDelta != 0 {
		userKey = getUserCacheKey(adjustment.userID)
		userPinsKey = imageTaskUserQuotaPinsKey(adjustment.userID)
	}
	tokenKey := markerKey + ":no-token"
	tokenPinsKey := markerKey + ":no-token-pins"
	if adjustment.tokenKey != "" {
		tokenHMAC := common.GenerateHMAC(adjustment.tokenKey)
		tokenKey = fmt.Sprintf("token:%s", tokenHMAC)
		tokenPinsKey = imageTaskTokenQuotaPinsKey(tokenHMAC)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{markerKey, userKey, tokenKey, userPinsKey, tokenPinsKey},
		adjustment.userDelta,
		adjustment.tokenDelta,
		"ImageTaskBilling:"+adjustment.taskID,
		adjustment.taskID,
		imageTaskQuotaCacheHoldSeconds,
		common.MinQuota,
		common.MaxQuota,
		constant.TokenFiledRemainQuota,
	).Int64()
	if err != nil {
		return fmt.Errorf("%w: prepare task %s: %v", errImageTaskQuotaCacheUnavailable, adjustment.taskID, err)
	}
	if user != nil && user.DeletedAt.Valid {
		if err := invalidateUserCache(user.Id); err != nil {
			return fmt.Errorf("%w: invalidate deleted user cache: %v", errImageTaskQuotaCacheUnavailable, err)
		}
	}
	if token != nil && token.DeletedAt.Valid && token.Key != "" {
		if err := cacheDeleteToken(token.Key); err != nil {
			return fmt.Errorf("%w: invalidate deleted token cache: %v", errImageTaskQuotaCacheUnavailable, err)
		}
	}
	switch result {
	case 1:
		return nil
	case -1:
		return errImageTaskWalletQuotaInsufficient
	case -2:
		return errImageTaskTokenQuotaInsufficient
	case -3:
		return errImageTaskQuotaCacheUnavailable
	default:
		return errImageTaskQuotaCacheConflict
	}
}

func commitImageTaskCacheAdjustment(adjustment imageTaskCacheAdjustment) error {
	if !common.RedisEnabled || (adjustment.userDelta == 0 && adjustment.tokenDelta == 0) {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("%w: redis client is nil", errImageTaskQuotaCacheUnavailable)
	}

	const script = `
local user_delta = tonumber(ARGV[1])
local token_delta = tonumber(ARGV[2])
local task_field = ARGV[3]
local task_id = ARGV[4]
local marker_ttl = tonumber(ARGV[5])
local cache_ttl = tonumber(ARGV[6])

local state = redis.call('HGET', KEYS[1], 'state')
if not state then
  -- A missing marker is not evidence that the cache phase completed. The
  -- durable billing rows may already have been committed, so silently
  -- proceeding would make the task appear reconciled while leaving stale
  -- quota cache state behind.
  if redis.call('EXISTS', KEYS[1]) == 1 then
    return -4
  end
  return -5
end
if redis.call('HGET', KEYS[1], 'user_key') ~= KEYS[2]
  or redis.call('HGET', KEYS[1], 'user_delta') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'token_key') ~= KEYS[3]
  or redis.call('HGET', KEYS[1], 'token_delta') ~= ARGV[2] then
  return -4
end
if state == 'committed' then
  return 2
end
if state ~= 'prepared' then
  return -4
end

if user_delta ~= 0 then
  local tagged_delta = redis.call('HGET', KEYS[2], task_field)
  if tagged_delta and tagged_delta ~= ARGV[1] then
    return -4
  end
end
if token_delta ~= 0 then
  local tagged_delta = redis.call('HGET', KEYS[3], task_field)
  if tagged_delta and tagged_delta ~= ARGV[2] then
    return -4
  end
end

if user_delta ~= 0 then
  redis.call('HDEL', KEYS[2], task_field)
  redis.call('SREM', KEYS[4], task_id)
  if redis.call('SCARD', KEYS[4]) == 0 then
    redis.call('DEL', KEYS[4])
    if redis.call('EXISTS', KEYS[6]) == 1 then
      redis.call('DEL', KEYS[2])
      redis.call('DEL', KEYS[6])
    elseif redis.call('EXISTS', KEYS[2]) == 1 then
      redis.call('EXPIRE', KEYS[2], cache_ttl)
    end
  end
end
if token_delta ~= 0 then
  redis.call('HDEL', KEYS[3], task_field)
  redis.call('SREM', KEYS[5], task_id)
  if redis.call('SCARD', KEYS[5]) == 0 then
    redis.call('DEL', KEYS[5])
    if redis.call('EXISTS', KEYS[7]) == 1 then
      redis.call('DEL', KEYS[3])
      redis.call('DEL', KEYS[7])
    elseif redis.call('EXISTS', KEYS[3]) == 1 then
      redis.call('EXPIRE', KEYS[3], cache_ttl)
    end
  end
end

redis.call('HSET', KEYS[1],
  'state', 'committed',
  'user_key', KEYS[2],
  'user_delta', ARGV[1],
  'token_key', KEYS[3],
  'token_delta', ARGV[2])
redis.call('EXPIRE', KEYS[1], marker_ttl)
return 1
`
	markerKey := "billing:image-task-cache:" + adjustment.taskID
	userKey := markerKey + ":no-user"
	userPinsKey := markerKey + ":no-user-pins"
	userInvalidationKey := markerKey + ":no-user-invalidation"
	if adjustment.userDelta != 0 {
		userKey = getUserCacheKey(adjustment.userID)
		userPinsKey = imageTaskUserQuotaPinsKey(adjustment.userID)
		userInvalidationKey = imageTaskUserQuotaInvalidationKey(adjustment.userID)
	}
	tokenKey := markerKey + ":no-token"
	tokenPinsKey := markerKey + ":no-token-pins"
	tokenInvalidationKey := markerKey + ":no-token-invalidation"
	if adjustment.tokenKey != "" {
		tokenHMAC := common.GenerateHMAC(adjustment.tokenKey)
		tokenKey = fmt.Sprintf("token:%s", tokenHMAC)
		tokenPinsKey = imageTaskTokenQuotaPinsKey(tokenHMAC)
		tokenInvalidationKey = imageTaskTokenQuotaInvalidationKey(tokenHMAC)
	}
	cacheTTL := common.RedisKeyCacheSeconds()
	if cacheTTL <= 0 {
		cacheTTL = 1
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{markerKey, userKey, tokenKey, userPinsKey, tokenPinsKey, userInvalidationKey, tokenInvalidationKey},
		adjustment.userDelta,
		adjustment.tokenDelta,
		"ImageTaskBilling:"+adjustment.taskID,
		adjustment.taskID,
		imageTaskQuotaCacheHoldSeconds,
		cacheTTL,
	).Int64()
	if err != nil {
		return fmt.Errorf("%w: commit task %s: %v", errImageTaskQuotaCacheUnavailable, adjustment.taskID, err)
	}
	if result == 1 || result == 2 {
		return nil
	}
	if result == -5 {
		return fmt.Errorf("%w: commit marker is missing", errImageTaskQuotaCacheConflict)
	}
	return errImageTaskQuotaCacheConflict
}

// rollbackPreparedImageTaskCache removes a settlement delta whose database
// phase did not commit. It invalidates the affected quota snapshots before the
// compensating database refund, so either side of a crash reloads authoritative
// balances instead of leaving a terminal task pinned in Redis.
func rollbackPreparedImageTaskCache(taskID string, userID int, tokenKey string) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return fmt.Errorf("%w: redis client is nil", errImageTaskQuotaCacheUnavailable)
	}
	if taskID == "" || userID <= 0 {
		return fmt.Errorf("%w: rollback cache identity is invalid", errImageTaskQuotaCacheConflict)
	}

	const script = `
local state = redis.call('HGET', KEYS[1], 'state')
if not state and redis.call('EXISTS', KEYS[1]) == 1 then
  return -4
end
if state and state ~= 'prepared' then
  return -4
end

local expected_user_delta = nil
local expected_token_delta = nil
if state then
  local marker_user_key = redis.call('HGET', KEYS[1], 'user_key')
  local marker_token_key = redis.call('HGET', KEYS[1], 'token_key')
  local marker_user_delta = redis.call('HGET', KEYS[1], 'user_delta')
  local marker_token_delta = redis.call('HGET', KEYS[1], 'token_delta')
  if not marker_user_key or not marker_token_key or not marker_user_delta or not marker_token_delta then
    return -4
  end
  expected_user_delta = tonumber(marker_user_delta)
  expected_token_delta = tonumber(marker_token_delta)
  if not expected_user_delta or not expected_token_delta then
    return -4
  end
  if (expected_user_delta ~= 0 and marker_user_key ~= KEYS[2])
    or (expected_user_delta == 0 and marker_user_key ~= ARGV[7])
    or (expected_token_delta ~= 0 and marker_token_key ~= KEYS[3])
    or (expected_token_delta == 0 and marker_token_key ~= ARGV[8]) then
    return -4
  end
end

local function inspect_leg(cache_key, quota_field, expected_delta)
  local tagged = redis.call('HGET', cache_key, ARGV[1])
  if tagged then
    local tagged_delta = tonumber(tagged)
    if not tagged_delta or (expected_delta and tagged_delta ~= expected_delta) then
      return -4, 0, false
    end
    local current = tonumber(redis.call('HGET', cache_key, quota_field))
    if not current then
      return -3, 0, false
    end
    local restored = current - tagged_delta
    if restored < tonumber(ARGV[5]) or restored > tonumber(ARGV[6]) then
      return -4, 0, false
    end
    return 1, tagged_delta, true
  elseif expected_delta and expected_delta ~= 0 and redis.call('EXISTS', cache_key) == 1 then
    return -4, 0, false
  end
  return 1, 0, false
end

local function apply_rollback(cache_key, pins_key, invalidation_key, quota_field, tagged_delta, has_tag, invalid_status)
  if has_tag then
    redis.call('HINCRBY', cache_key, quota_field, -tagged_delta)
    redis.call('HDEL', cache_key, ARGV[1])
  end
  redis.call('SREM', pins_key, ARGV[2])
  if redis.call('SCARD', pins_key) == 0 then
    redis.call('DEL', pins_key)
    redis.call('DEL', cache_key)
    redis.call('DEL', invalidation_key)
  else
    if redis.call('EXISTS', cache_key) == 1 then
      redis.call('HSET', cache_key, 'Status', invalid_status)
    end
    redis.call('SET', invalidation_key, '1', 'EX', ARGV[9])
  end
end

local user_result, user_delta, user_has_tag = inspect_leg(KEYS[2], 'Quota', expected_user_delta)
if user_result ~= 1 then
  return user_result
end
local token_result, token_delta, token_has_tag = inspect_leg(KEYS[3], ARGV[10], expected_token_delta)
if token_result ~= 1 then
  return token_result
end
apply_rollback(KEYS[2], KEYS[4], KEYS[6], 'Quota', user_delta, user_has_tag, ARGV[3])
apply_rollback(KEYS[3], KEYS[5], KEYS[7], ARGV[10], token_delta, token_has_tag, ARGV[4])
redis.call('DEL', KEYS[1])
return 1
`
	markerKey := "billing:image-task-cache:" + taskID
	userKey := getUserCacheKey(userID)
	userPinsKey := imageTaskUserQuotaPinsKey(userID)
	userInvalidationKey := imageTaskUserQuotaInvalidationKey(userID)
	tokenCacheKey := markerKey + ":no-token"
	tokenPinsKey := markerKey + ":no-token-pins"
	tokenInvalidationKey := markerKey + ":no-token-invalidation"
	if tokenKey != "" {
		tokenHMAC := common.GenerateHMAC(tokenKey)
		tokenCacheKey = fmt.Sprintf("token:%s", tokenHMAC)
		tokenPinsKey = imageTaskTokenQuotaPinsKey(tokenHMAC)
		tokenInvalidationKey = imageTaskTokenQuotaInvalidationKey(tokenHMAC)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := common.RDB.Eval(
		ctx,
		script,
		[]string{
			markerKey,
			userKey,
			tokenCacheKey,
			userPinsKey,
			tokenPinsKey,
			userInvalidationKey,
			tokenInvalidationKey,
		},
		"ImageTaskBilling:"+taskID,
		taskID,
		common.UserStatusDisabled,
		common.TokenStatusDisabled,
		common.MinQuota,
		common.MaxQuota,
		markerKey+":no-user",
		markerKey+":no-token",
		imageTaskQuotaCacheHoldSeconds,
		constant.TokenFiledRemainQuota,
	).Int64()
	if err != nil {
		return fmt.Errorf("%w: rollback task %s: %v", errImageTaskQuotaCacheUnavailable, taskID, err)
	}
	if result != 1 {
		return fmt.Errorf("%w: rollback task %s returned %d", errImageTaskQuotaCacheConflict, taskID, result)
	}
	return nil
}

func checkedImageQuotaAdd(current int, delta int) (int, error) {
	value := int64(current) + int64(delta)
	if value < int64(common.MinQuota) || value > int64(common.MaxQuota) {
		return 0, errors.New("quota adjustment is out of range")
	}
	return int(value), nil
}

func checkedInt64Add(current int64, delta int64) (int64, error) {
	if (delta > 0 && current > math.MaxInt64-delta) || (delta < 0 && current < math.MinInt64-delta) {
		return 0, errors.New("integer adjustment is out of range")
	}
	return current + delta, nil
}
