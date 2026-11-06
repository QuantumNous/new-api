package common

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// Prompt cache markers are gateway-added fields the client never sent, so a
// strict upstream that does not implement prompt caching can reject the whole
// request for them (400 "Unknown parameter: 'prompt_cache_key'"). The failover
// loop classifies upstream 400 as caller-fatal — no channel switch would help
// — so the only recovery is to undo the injection and resend without it.

// promptCacheSuppressionKey marks this client request as burned: after one
// injection-triggered rejection, later failover attempts of the same request
// skip injection entirely.
const promptCacheSuppressionKey = "prompt_cache_suppressed"

// promptCacheRejectionTTLSeconds sizes the per-channel rejection marker. It
// auto-heals a channel whose upstream starts supporting the marker (or a
// transient rejection), while keeping the wasted reject-and-retry round to at
// most once per hour per channel.
const promptCacheRejectionTTLSeconds = 3600

func promptCacheSuppressed(c contract.Context) bool {
	if c == nil {
		return false
	}
	value, ok := c.Get(promptCacheSuppressionKey)
	flag, isBool := value.(bool)
	return ok && isBool && flag
}

// promptCacheRejected reports whether the channel recently rejected an
// injected cache marker. The nil-RDB guard covers processes that read this
// before InitRedisClient ran (unit tests), where RedisEnabled defaults to
// true but no client exists yet.
func promptCacheRejected(channelId int) bool {
	if !common.RedisEnabled || common.RDB == nil {
		return false
	}
	value, err := common.RedisGet(promptCacheRejectionKey(channelId))
	return err == nil && value != ""
}

func markPromptCacheRejected(channelId int) {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	err := common.RedisSet(promptCacheRejectionKey(channelId), "1", time.Duration(promptCacheRejectionTTLSeconds)*time.Second)
	if err != nil {
		common.SysLog("failed to record prompt-cache rejection: " + err.Error())
	}
}

func promptCacheRejectionKey(channelId int) string {
	return "cache:reject:" + strconv.Itoa(channelId)
}

// FallbackPromptCacheAfterRejection disposes of a failed upstream attempt that
// carried an automatically injected cache marker. When the upstream answered
// with a 4xx naming that marker field, it reverts the injection (undo),
// suppresses further injections for this client request, blacklists the
// channel briefly, and returns true: the caller should rebuild the request
// body and resend it once without the injection. Any other failure keeps the
// original error and returns false.
//
// Matching is deliberately narrow (exact field name in the error text) so a
// genuine client-side 400 is never answered with a duplicate upstream call.
func FallbackPromptCacheAfterRejection(c contract.Context, info *RelayInfo, undo UndoPromptCache, markerField string, err *types.NewAPIError) bool {
	if undo == nil || err == nil {
		return false
	}
	if err.StatusCode < http.StatusBadRequest || err.StatusCode >= http.StatusInternalServerError {
		return false
	}
	if !strings.Contains(strings.ToLower(err.Error()), markerField) {
		return false
	}
	undo()
	if c != nil {
		c.Set(promptCacheSuppressionKey, true)
	}
	if info != nil && info.HasChannelMeta() {
		markPromptCacheRejected(info.ChannelId)
	}
	return true
}
