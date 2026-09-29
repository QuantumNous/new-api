package model

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// Channel-level rate and quota limiting (issue #7070). Limits are opt-in per
// channel: zero or nil means unlimited, so channels without any configured
// limit take a pure in-memory fast path and never touch the counter store.
//
//   - RPM counts every upstream dispatch (one per retry attempt, mirroring the
//     pressure actually put on the upstream) inside a fixed one-minute window.
//   - TPM accumulates the settled prompt+completion tokens of consume-log
//     records inside the same one-minute window; it is checked at channel
//     selection because the request's token count is unknown up front.
//   - Daily/monthly quota limits mirror the signed used_quota deltas recorded
//     by UpdateChannelUsedQuota onto calendar windows (server local time), so
//     refunds roll the window back and the totals stay net-consistent with the
//     channels.used_quota column.

// ErrChannelsOverLimit reports that a group/model had enabled candidate
// channels but every one of them is currently over its RPM, TPM, or calendar
// quota limit. Callers surface it as HTTP 429 instead of the generic
// "no available channel" 503.
var ErrChannelsOverLimit = errors.New("all candidate channels are over their rate or quota limits")

// ChannelLimitExceededCode is the client-facing error code shared by the
// selection-side 429 and the dispatch-side RPM admission rejection. It
// deliberately avoids the "channel:" prefix of types.IsChannelError so
// ProcessChannelError never treats an over-limit attempt as a channel fault
// and auto-bans a temporarily limited channel.
const ChannelLimitExceededCode types.ErrorCode = "channel_limit_exceeded"

const (
	channelRpmCounterPrefix = "chanRPM"
	channelTpmCounterPrefix = "chanTPM"
	channelDayQuotaPrefix   = "chanQD"
	channelMonthQuotaPrefix = "chanQM"
	rpmTpmWindowTTL         = 2 * time.Minute
	dailyQuotaWindowTTL     = 48 * time.Hour
	monthlyQuotaWindowTTL   = 45 * 24 * time.Hour
	dayWindowBucketLayout   = "20060102"
	monthWindowBucketLayout = "200601"
)

func channelRpmKey(channelId int) string {
	return common.CounterKey(channelRpmCounterPrefix, channelId, common.CounterMinuteBucket())
}

func channelTpmKey(channelId int) string {
	return common.CounterKey(channelTpmCounterPrefix, channelId, common.CounterMinuteBucket())
}

func channelDayQuotaKey(channelId int) string {
	return common.CounterKey(channelDayQuotaPrefix, channelId, time.Now().Format(dayWindowBucketLayout))
}

func channelMonthQuotaKey(channelId int) string {
	return common.CounterKey(channelMonthQuotaPrefix, channelId, time.Now().Format(monthWindowBucketLayout))
}

// channelHasAnyLimit reports whether the channel has at least one limit
// configured and therefore needs counter lookups before being selected.
func channelHasAnyLimit(ch *Channel) bool {
	return ch.GetRpmLimit() > 0 || ch.GetTpmLimit() > 0 ||
		ch.GetDailyQuotaLimit() > 0 || ch.GetMonthlyQuotaLimit() > 0
}

// channelWithinLimitValues reports whether the channel stays within every
// configured limit given the current window counters. The comparison is
// "counter >= limit": a window at or past its budget no longer admits, and
// negative (refund-heavy) windows read as available headroom.
func channelWithinLimitValues(ch *Channel, rpm int64, tpm int64, dayQuota int64, monthQuota int64) bool {
	if ch.GetRpmLimit() > 0 && rpm >= ch.GetRpmLimit() {
		return false
	}
	if ch.GetTpmLimit() > 0 && tpm >= ch.GetTpmLimit() {
		return false
	}
	if ch.GetDailyQuotaLimit() > 0 && dayQuota >= ch.GetDailyQuotaLimit() {
		return false
	}
	if ch.GetMonthlyQuotaLimit() > 0 && monthQuota >= ch.GetMonthlyQuotaLimit() {
		return false
	}
	return true
}

// ChannelWithinLimits reports whether ch may still serve a new request under
// its RPM, TPM, and calendar quota limits. Counter read failures fail open
// (the channel stays selectable): RPM is still enforced per dispatch by
// ChannelRpmTryConsume, and a broken counter store must not silently shrink
// the channel pool.
func ChannelWithinLimits(ch *Channel) bool {
	if ch == nil || !channelHasAnyLimit(ch) {
		return true
	}
	values := common.CounterMGet([]string{
		channelRpmKey(ch.Id),
		channelTpmKey(ch.Id),
		channelDayQuotaKey(ch.Id),
		channelMonthQuotaKey(ch.Id),
	})
	return channelWithinLimitValues(ch,
		values[channelRpmKey(ch.Id)],
		values[channelTpmKey(ch.Id)],
		values[channelDayQuotaKey(ch.Id)],
		values[channelMonthQuotaKey(ch.Id)],
	)
}

// ChannelWithinLimitsBatch reports, keyed by channel id, whether each channel
// stays within its limits. Channels without configured limits are always
// allowed, and all counters are fetched in one round trip so candidate
// filtering stays cheap while the channel cache lock is held.
func ChannelWithinLimitsBatch(channels []*Channel) map[int]bool {
	allowed := make(map[int]bool, len(channels))
	limited := make([]*Channel, 0, len(channels))
	for _, ch := range channels {
		if ch == nil {
			continue
		}
		allowed[ch.Id] = true
		if channelHasAnyLimit(ch) {
			limited = append(limited, ch)
		}
	}
	if len(limited) == 0 {
		return allowed
	}
	keys := make([]string, 0, len(limited)*4)
	for _, ch := range limited {
		keys = append(keys,
			channelRpmKey(ch.Id),
			channelTpmKey(ch.Id),
			channelDayQuotaKey(ch.Id),
			channelMonthQuotaKey(ch.Id),
		)
	}
	values := common.CounterMGet(keys)
	for _, ch := range limited {
		allowed[ch.Id] = channelWithinLimitValues(ch,
			values[channelRpmKey(ch.Id)],
			values[channelTpmKey(ch.Id)],
			values[channelDayQuotaKey(ch.Id)],
			values[channelMonthQuotaKey(ch.Id)],
		)
	}
	return allowed
}

// ChannelRpmTryConsume atomically admits one upstream dispatch against the
// channel's RPM limit. It increments the current minute counter first and
// rolls back when the increment pushed the window past its budget, so
// concurrent attempts can never overshoot. Channels without an RPM limit and
// counter store failures both pass: limiting degrades to the selection-side
// filter instead of blocking relaying.
func ChannelRpmTryConsume(ch *Channel) bool {
	if ch == nil || ch.GetRpmLimit() <= 0 {
		return true
	}
	key := channelRpmKey(ch.Id)
	value, err := common.CounterIncrBy(key, 1, rpmTpmWindowTTL)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to consume channel rpm counter: channel_id=%d, error=%v", ch.Id, err))
		return true
	}
	if value > ch.GetRpmLimit() {
		if _, rollbackErr := common.CounterIncrBy(key, -1, rpmTpmWindowTTL); rollbackErr != nil {
			common.SysError(fmt.Sprintf("failed to roll back channel rpm counter: channel_id=%d, error=%v", ch.Id, rollbackErr))
		}
		return false
	}
	return true
}

// ChannelRpmOverLimitError is the per-attempt error for a dispatch rejected by
// the strict RPM admission check. It maps to HTTP 429 and is retryable on the
// next channel.
func ChannelRpmOverLimitError(ch *Channel) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("channel #%d is over its rpm limit (%d requests per minute)", ch.Id, ch.GetRpmLimit()),
		ChannelLimitExceededCode,
		http.StatusTooManyRequests,
	)
}

// ChannelLimitsExceededError is the eligibility error for a channel whose TPM
// or calendar quota windows are exhausted. It shares the HTTP 429 status and
// channel_limit_exceeded code with ChannelRpmOverLimitError.
func ChannelLimitsExceededError(ch *Channel) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("channel #%d is over its configured rate or quota limits", ch.Id),
		ChannelLimitExceededCode,
		http.StatusTooManyRequests,
	)
}

// RecordChannelTokenUsage adds settled token usage to the channel's TPM
// window. It is invoked from consume-log recording so every billing path
// (text, audio, realtime websocket, image, task submit, channel test) counts
// exactly once per request.
func RecordChannelTokenUsage(channelId int, tokens int64) {
	if channelId <= 0 || tokens <= 0 {
		return
	}
	if _, err := common.CounterIncrBy(channelTpmKey(channelId), tokens, rpmTpmWindowTTL); err != nil {
		common.SysError(fmt.Sprintf("failed to record channel tpm counter: channel_id=%d, tokens=%d, error=%v", channelId, tokens, err))
	}
}

// RecordChannelQuotaUsage mirrors a signed used_quota delta onto the channel's
// calendar day and month windows in one atomic step, so a partial write
// failure cannot leave the day and month windows inconsistent. Negative
// deltas (refunds and task rollbacks) flow through unchanged.
func RecordChannelQuotaUsage(channelId int, quota int64) {
	if channelId <= 0 || quota == 0 {
		return
	}
	if err := common.CounterMIncrBy([]common.CounterDelta{
		{Key: channelDayQuotaKey(channelId), Delta: quota, TTL: dailyQuotaWindowTTL},
		{Key: channelMonthQuotaKey(channelId), Delta: quota, TTL: monthlyQuotaWindowTTL},
	}); err != nil {
		common.SysError(fmt.Sprintf("failed to record channel quota counters: channel_id=%d, quota=%d, error=%v", channelId, quota, err))
	}
}
