package model

import (
	"errors"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"golang.org/x/sync/singleflight"
)

type subscriptionDecisionState struct {
	HasActive           *bool `json:"has_active"`
	AllowWalletOverflow *bool `json:"allow_wallet_overflow"`
}

var subscriptionDecisionLoads singleflight.Group

func subscriptionDecisionCacheKey(userID int) string {
	return "user_subscription_state:" + strconv.Itoa(userID)
}

func readSubscriptionDecisionCache(userID int) (subscriptionDecisionState, bool) {
	if !common.RedisEnabled || common.RDB == nil {
		return subscriptionDecisionState{}, false
	}
	data, err := common.RedisGet(subscriptionDecisionCacheKey(userID))
	if err != nil {
		return subscriptionDecisionState{}, false
	}
	var state subscriptionDecisionState
	if err := common.UnmarshalJsonStr(data, &state); err != nil ||
		state.HasActive == nil || state.AllowWalletOverflow == nil ||
		(!*state.HasActive && !*state.AllowWalletOverflow) {
		return subscriptionDecisionState{}, false
	}
	return state, true
}

func loadSubscriptionDecisionState(userID int) (subscriptionDecisionState, error) {
	if userID <= 0 {
		return subscriptionDecisionState{}, errors.New("invalid userId")
	}
	if state, ok := readSubscriptionDecisionCache(userID); ok {
		return state, nil
	}

	value, err, _ := subscriptionDecisionLoads.Do(strconv.Itoa(userID), func() (any, error) {
		// A different request may have populated Redis while this one waited.
		if state, ok := readSubscriptionDecisionCache(userID); ok {
			return state, nil
		}
		var rows []struct {
			EndTime             int64
			AllowWalletOverflow *bool
		}
		now := common.GetTimestamp()
		if err := DB.Model(&UserSubscription{}).
			Select("end_time", "allow_wallet_overflow").
			Where("user_id = ? AND status = ? AND end_time > ?", userID, "active", now).
			Find(&rows).Error; err != nil {
			return subscriptionDecisionState{}, err
		}
		hasActive := len(rows) > 0
		allowWallet := true
		var earliestEnd int64
		for _, row := range rows {
			if row.AllowWalletOverflow != nil && !*row.AllowWalletOverflow {
				allowWallet = false
			}
			if earliestEnd == 0 || row.EndTime < earliestEnd {
				earliestEnd = row.EndTime
			}
		}
		state := subscriptionDecisionState{
			HasActive: &hasActive, AllowWalletOverflow: &allowWallet,
		}
		if common.RedisEnabled && common.RDB != nil {
			ttl := time.Duration(userCacheTTLSeconds()) * time.Second
			if earliestEnd > 0 {
				ttl = min(ttl, time.Until(time.Unix(earliestEnd, 0)))
			}
			if ttl > 0 {
				data, err := common.Marshal(state)
				if err == nil {
					_ = common.RedisSet(subscriptionDecisionCacheKey(userID), string(data), ttl)
				}
			}
		}
		return state, nil
	})
	if err != nil {
		return subscriptionDecisionState{}, err
	}
	return value.(subscriptionDecisionState), nil
}

// Invalidation follows the committed database change. A Redis failure leaves an
// old decision until its bounded TTL expires and never reverses the transaction.
func invalidateSubscriptionDecisionCache(userID int) {
	if userID <= 0 || !common.RedisEnabled || common.RDB == nil {
		return
	}
	if err := common.RedisDelKey(subscriptionDecisionCacheKey(userID)); err != nil {
		common.SysError(common.LogText("failed to invalidate subscription decision cache for user %d: %v", userID, err))
	}
}
