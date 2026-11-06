package common

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"

	"github.com/QuantumNous/new-api/internal/common"
)

// CachePrefixSeenBefore implements the repeat-seen gate for automatic cache
// breakpoint injection. Anthropic charges 1.25x/2x for cache writes, so
// marking a prefix that is never reused would be a pure loss. A prefix is
// marked only when its previous observation is already gone from the marker
// store (SETNX): a conversation's first turn leaves a marker without being
// injected, and every later turn sees the marker, gets injected, and refreshes
// it. Without Redis there is no shared marker state, so injection stays off.
func CachePrefixSeenBefore(affinityKey string, channelId int) bool {
	if !common.RedisEnabled || common.RDB == nil || affinityKey == "" {
		return false
	}
	seen, err := common.RedisSetNX(autoCacheControlMarkerKey(affinityKey, channelId), "1", autoCacheControlTTL)
	if err != nil {
		return false
	}
	return !seen
}

// markCachePrefixSeen refreshes the marker so the injection stays active for
// the rest of the conversation instead of expiring mid-session.
func markCachePrefixSeen(affinityKey string, channelId int) {
	if !common.RedisEnabled || common.RDB == nil || affinityKey == "" {
		return
	}
	if err := common.RedisSet(autoCacheControlMarkerKey(affinityKey, channelId), "1", autoCacheControlTTL); err != nil {
		common.SysLog("failed to refresh auto cache-control marker: " + err.Error())
	}
}

// ClearCachePrefixSeen drops the marker when a user-marked request arrives on
// a conversation that was previously auto-injected.
func ClearCachePrefixSeen(affinityKey string, channelId int) {
	if !common.RedisEnabled || common.RDB == nil || affinityKey == "" {
		return
	}
	if err := common.RedisDelKey(autoCacheControlMarkerKey(affinityKey, channelId)); err != nil {
		common.SysLog("failed to clear auto cache-control marker: " + err.Error())
	}
}

func autoCacheControlMarkerKey(affinityKey string, channelId int) string {
	if len(affinityKey) > 128 {
		// A client-declared session boundary can be arbitrarily long; hash the
		// marker suffix to keep Redis keys bounded without losing the
		// per-conversation distinction.
		sum := sha256.Sum256([]byte(affinityKey))
		affinityKey = hex.EncodeToString(sum[:])
	}
	return "cache:prefix:" + strconv.Itoa(channelId) + ":" + affinityKey
}
