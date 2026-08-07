package model

import (
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// channelKeyCooldown maps "channelId:keyIndex" -> unix expiry (seconds).
//
// It is a cross-request soft circuit breaker: a channel key that just returned
// a rate-limit response (429, or any response carrying a Retry-After hint) is
// skipped by selection until the cooldown expires, so subsequent requests avoid
// a just-throttled upstream instead of re-hitting it and burning a 429 every
// time. This is distinct from the per-request exclude set, which is a hard
// filter scoped to a single request; cooldown is a soft, time-bounded hint
// shared across requests and always has a fallback so it can never deny service
// on its own.
var channelKeyCooldown sync.Map // string -> int64

const (
	// MaxChannelCooldownSeconds caps an upstream-provided Retry-After so a
	// hostile or mis-configured header cannot park a channel/key for an
	// unbounded time.
	MaxChannelCooldownSeconds = 300
	// DefaultChannelCooldownSeconds is used when a rate-limit response carries
	// no usable Retry-After / reset hint.
	DefaultChannelCooldownSeconds = 15
)

func channelKeyCooldownMapKey(channelId, keyIndex int) string {
	return strconv.Itoa(channelId) + ":" + strconv.Itoa(keyIndex)
}

// MarkChannelKeyCooldown puts one channel key into cooldown for seconds,
// clamped to [1, MaxChannelCooldownSeconds]. keyIndex is 0 for single-key
// channels. A non-positive seconds falls back to DefaultChannelCooldownSeconds.
func MarkChannelKeyCooldown(channelId, keyIndex, seconds int) {
	if seconds <= 0 {
		seconds = DefaultChannelCooldownSeconds
	}
	if seconds > MaxChannelCooldownSeconds {
		seconds = MaxChannelCooldownSeconds
	}
	until := time.Now().Unix() + int64(seconds)
	channelKeyCooldown.Store(channelKeyCooldownMapKey(channelId, keyIndex), until)
}

// IsChannelKeyCoolingDown reports whether the given channel key is currently in
// cooldown. Expired entries are cleaned up lazily on read.
func IsChannelKeyCoolingDown(channelId, keyIndex int) bool {
	k := channelKeyCooldownMapKey(channelId, keyIndex)
	v, ok := channelKeyCooldown.Load(k)
	if !ok {
		return false
	}
	until, _ := v.(int64)
	if time.Now().Unix() >= until {
		channelKeyCooldown.Delete(k)
		return false
	}
	return true
}

// ClearChannelKeyCooldown removes any cooldown on the given channel key. Called
// after a successful request so a recovered key becomes selectable immediately.
func ClearChannelKeyCooldown(channelId, keyIndex int) {
	channelKeyCooldown.Delete(channelKeyCooldownMapKey(channelId, keyIndex))
}

// EnabledKeysAllCoolingDown reports whether every currently-enabled key of the
// channel is in cooldown, i.e. the channel has nothing ready to serve right
// now. Selection uses this to skip such a channel (with a fallback that ignores
// cooldown when no other candidate remains). A channel with no enabled keys
// returns false; its unavailability is handled by the normal enabled-key path.
func (channel *Channel) EnabledKeysAllCoolingDown() bool {
	if !channel.ChannelInfo.IsMultiKey {
		return IsChannelKeyCoolingDown(channel.Id, 0)
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return false
	}
	statusList := channel.ChannelInfo.MultiKeyStatusList
	anyEnabled := false
	for i := range keys {
		if statusList != nil {
			if status, ok := statusList[i]; ok && status != common.ChannelStatusEnabled {
				continue
			}
		}
		anyEnabled = true
		if !IsChannelKeyCoolingDown(channel.Id, i) {
			return false
		}
	}
	return anyEnabled
}
