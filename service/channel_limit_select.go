package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// GateHandle tracks the semaphore slots acquired for one request so they can be
// released together when the request completes (success or failure).
type GateHandle struct {
	GateKeys []string
}

// Release frees every acquired semaphore slot.
func (h *GateHandle) Release() {
	if h == nil {
		return
	}
	for _, k := range h.GateKeys {
		ReleaseConcurrency(k)
	}
	h.GateKeys = nil
}

func (h *GateHandle) acquire(key string, max int) bool {
	if !TryAcquireConcurrency(key, max) {
		return false
	}
	h.GateKeys = append(h.GateKeys, key)
	return true
}

// channelGateKey builds the semaphore key. keyIdx<0 means per-channel.
func channelGateKey(channelID, keyIdx int) string {
	if keyIdx < 0 {
		return fmt.Sprintf("channel:%d", channelID)
	}
	return fmt.Sprintf("channel:%d:key:%d", channelID, keyIdx)
}

// evaluateChannelForLimits checks the per-channel concurrency cap for one
// candidate channel. Returns true (skip) when the channel is at its cap right
// now; the caller adds it to `excluded` and re-selects.
//
// Does NOT acquire the concurrency slot — the caller (SelectChannelWithLimits)
// does that explicitly via GateHandle.acquire so the slot ownership is traceable.
func evaluateChannelForLimits(channelID, keyIdx int, lim ChannelLimits, excluded map[int]bool) bool {
	if !lim.Enabled || lim.MaxConcurrency <= 0 {
		return false
	}
	if !TryAcquireConcurrency(channelGateKey(channelID, keyIdx), lim.MaxConcurrency) {
		excluded[channelID] = true
		return true
	}
	return false
}

// selectHealthyKey finds a key index whose per-key concurrency slot is
// available. Returns (idx, true) on success. Tries up to len(keys)
// alternatives via the excludeKeyIdx set passed to channel.GetNextEnabledKey.
// The helper acquires and immediately releases the per-key semaphore slot
// purely as a probe — the orchestrator re-acquires the slot through
// GateHandle.acquire so ownership stays on the handle's release path.
func selectHealthyKey(channel *model.Channel, lim ChannelLimits) (int, bool) {
	keys := channel.GetKeys()
	excluded := map[int]bool{}
	for attempt := 0; attempt < len(keys); attempt++ {
		_, idx, err := channel.GetNextEnabledKey(excluded)
		if err != nil {
			return 0, false
		}
		if lim.MaxConcurrency > 0 && !TryAcquireConcurrency(channelGateKey(channel.Id, idx), lim.MaxConcurrency) {
			excluded[idx] = true
			continue
		}
		// Release the slot — the orchestrator's handle will re-acquire it
		// through the normal lifecycle so the slot is tracked there.
		ReleaseConcurrency(channelGateKey(channel.Id, idx))
		return idx, true
	}
	return 0, false
}

// SelectChannelWithLimits selects a channel honoring the per-channel
// concurrency cap. On a usable hit it acquires the per-channel concurrency
// slot (and per-key slot for multi-key channels when MaxConcurrency > 0) and
// returns a non-nil GateHandle that the caller MUST Release() (typically via
// defer). Channels at their cap are added to excluded (carried across retries
// within one request without consuming the retry counter).
//
// For multi-key channels the orchestrator also runs the per-key selection
// loop via selectHealthyKey: pick a key whose per-key semaphore slot is
// available. The chosen index is stashed on the request context so
// SetupContextForSelectedChannel (distributor.go) can use it without re-running
// selection — otherwise the chosen key could be overridden by
// GetNextEnabledKey's polling index move on the next call.
//
// Returns (channel, selectGroup, gateHandle, error). The handle is always
// non-nil; Release() is safe even when no slot was acquired (empty slice or
// error path). On a nil channel with a nil error, the orchestrator exhausted
// maxReAttempts and the caller should treat it as "no channel available".
//
// Side effect: param.ExcludeIDs is rewritten on each iteration as the
// exclude set grows. RetryParam is short-lived per request so this is safe;
// callers must not rely on the pre-call value of ExcludeIDs after the call.
func SelectChannelWithLimits(param *RetryParam) (*model.Channel, string, *GateHandle, error) {
	excluded := make(map[int]bool, len(param.ExcludeIDs))
	for _, id := range param.ExcludeIDs {
		excluded[id] = true
	}
	handle := &GateHandle{}
	// maxReAttempts bounds the worst-case number of channels we will try in a
	// single selection. Comfortably above typical channel-count-per-group and
	// well under the loop's per-iteration cost; if all 8 candidates are unusable
	// the orchestrator returns (nil, param.TokenGroup, handle, nil).
	const maxReAttempts = 8

	for attempt := 0; attempt < maxReAttempts; attempt++ {
		param.ExcludeIDs = mapKeys(excluded)
		channel, selectGroup, err := CacheGetRandomSatisfiedChannel(param)
		if err != nil {
			return nil, selectGroup, handle, err
		}
		if channel == nil {
			return nil, selectGroup, handle, nil
		}
		lim := GetChannelLimits(channel)
		if evaluateChannelForLimits(channel.Id, -1, lim, excluded) {
			continue
		}
		// Per-key selection for multi-key channels.
		if channel.ChannelInfo.IsMultiKey && lim.Enabled {
			keyIdx, ok := selectHealthyKey(channel, lim)
			if !ok {
				// evaluateChannelForLimits already acquired the per-channel slot
				// above; release it before excluding this channel so MaxConcurrency
				// is not permanently leaked.
				if lim.MaxConcurrency > 0 {
					ReleaseConcurrency(channelGateKey(channel.Id, -1))
				}
				excluded[channel.Id] = true
				continue
			}
			common.SetContextKey(param.Ctx, constant.ContextKeyChannelPreSelectedKeyIdx, keyIdx)
			if lim.MaxConcurrency > 0 {
				k := channelGateKey(channel.Id, keyIdx)
				if !handle.acquire(k, lim.MaxConcurrency) {
					// same leak prevention: release the per-channel slot acquired
					// by evaluateChannelForLimits before retrying on another channel.
					ReleaseConcurrency(channelGateKey(channel.Id, -1))
					excluded[channel.Id] = true
					common.SetContextKey(param.Ctx, constant.ContextKeyChannelPreSelectedKeyIdx, nil)
					continue
				}
			}
		}
		// per-channel concurrency slot — record it on the handle so it is released later
		if lim.Enabled && lim.MaxConcurrency > 0 {
			handle.GateKeys = append(handle.GateKeys, channelGateKey(channel.Id, -1))
		}
		return channel, selectGroup, handle, nil
	}
	return nil, param.TokenGroup, handle, nil
}

func mapKeys(m map[int]bool) []int {
	out := make([]int, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
