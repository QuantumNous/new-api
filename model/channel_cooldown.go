package model

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
)

// Channel cooldown is a per-channel, time-bounded skip signal consulted by
// the channel selector. It is *not* persisted in the database and is
// *not* synced across processes. It complements (not replaces) the
// channel Status field: Status=Enabled means the channel is allowed to
// be picked; the cooldown overlay means "skip it until <until>". This
// lets us avoid permanent AutoDisabled (which requires manual enable)
// for transient upstream faults, while still suppressing repeated
// hits on a broken channel during the cooldown window.
//
// Concurrency: the selector reads IsInCooldown under channelSyncLock
// (its existing read lock for the candidate pool). The cooldown map
// itself uses a dedicated cooldownMu so that writers (error handling
// path) do not contend with the read-heavy selector path.

var (
	cooldownMu  sync.RWMutex
	cooldownMap = make(map[int]time.Time)
)

// MarkCooldown records that channel id should be skipped by the selector
// until `until`. If a later expiry already exists for the same channel,
// the later time wins — this is the conservative choice for back-to-back
// failures (we keep the longer skip).
func MarkCooldown(id int, until time.Time) {
	if id == 0 || !until.After(time.Now()) {
		return
	}
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	if existing, ok := cooldownMap[id]; ok && existing.After(until) {
		return
	}
	cooldownMap[id] = until
}

// ClearCooldown removes the cooldown entry for the given channel, so it
// becomes immediately eligible again. Used by manual enable and tests.
func ClearCooldown(id int) {
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	delete(cooldownMap, id)
}

// IsInCooldown returns true if the channel is currently in a cooldown
// window. `now` is taken as a parameter so callers and tests can pin the
// clock. Expired entries return false but are not evicted here — that is
// the GC goroutine's job, to keep this hot-path branch lock-free for
// readers other than the brief RLock.
func IsInCooldown(id int, now time.Time) bool {
	cooldownMu.RLock()
	until, ok := cooldownMap[id]
	cooldownMu.RUnlock()
	if !ok {
		return false
	}
	return now.Before(until)
}

// InCooldownIDs returns the set of channel IDs currently inside an
// unexpired cooldown. The selector uses this once per call to filter
// the candidate list. Reads are O(N) over the cooldown map, which is
// expected to be small (at most one entry per enabled channel).
func InCooldownIDs(now time.Time) map[int]struct{} {
	cooldownMu.RLock()
	defer cooldownMu.RUnlock()
	if len(cooldownMap) == 0 {
		return nil
	}
	out := make(map[int]struct{}, len(cooldownMap))
	for id, until := range cooldownMap {
		if now.Before(until) {
			out[id] = struct{}{}
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// gcExpiredCooldown drops entries whose expiry has passed and returns
// the number of removed IDs. Safe to call concurrently.
func gcExpiredCooldown(now time.Time) int {
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	removed := 0
	for id, until := range cooldownMap {
		if !now.Before(until) {
			delete(cooldownMap, id)
			removed++
		}
	}
	return removed
}

// StartCooldownGC launches a background goroutine that periodically
// evicts expired entries from the cooldown map. Frequency is in seconds
// and is best kept <= 30s so that channels coming out of cooldown
// become eligible within a bounded window after their expiry.
func StartCooldownGC(frequency int) {
	if frequency <= 0 {
		frequency = 30
	}
	go func() {
		ticker := time.NewTicker(time.Duration(frequency) * time.Second)
		defer ticker.Stop()
		for now := range ticker.C {
			ch, key := gcAllExpired(now)
			if (ch > 0 || key > 0) && common.DebugEnabled {
				logger.LogDebug(nil, "cooldown gc: removed %d channel, %d key entries", ch, key)
			}
		}
	}()
}

// Per-key cooldown is a finer-grained skip signal: it marks a single
// API key of a multi-key channel as unusable until a deadline, while
// leaving the rest of the channel's keys (and the channel itself
// from the candidate-pool perspective) eligible. This is the right
// granularity when the upstream signals a per-key failure (a single
// credential out of credit, a single project suspended, a single
// account in arrears) and the channel carries several keys — blocking
// the whole channel would deny service to keys that still work.
//
// The map is keyed by a 64-bit composite of (channelId, keyIndex) so
// the GC walk is the same shape as the channel-level map. Concurrency
// rules mirror MarkCooldown: per-key writers run from the error path
// (low frequency), readers run from GetNextEnabledKey (per request).
// They share cooldownMu to keep both maps consistent if we ever need
// to GC them together.

const (
	keyCooldownChannelIDBits = 40 // supports up to ~1T channels; well above the realistic ceiling
	keyCooldownKeyIndexBits  = 24 // supports up to 16M keys per channel
)

var keyCooldownMap = make(map[uint64]time.Time)

// keyCooldownKey packs (channelId, keyIndex) into a single uint64
// suitable for map keying. The bit split assumes channelId >= 0 and
// keyIndex >= 0; we sanitise inputs at the call sites.
func keyCooldownKey(channelId int, keyIndex int) uint64 {
	if channelId < 0 || keyIndex < 0 {
		return 0
	}
	return (uint64(channelId) << keyCooldownKeyIndexBits) | uint64(keyIndex)
}

// MarkKeyCooldown records that (channelId, keyIndex) should be skipped
// by GetNextEnabledKey until `until`. The same "longer wins" policy as
// MarkCooldown applies: a second call with an earlier `until` is a
// no-op so back-to-back failures don't accidentally shorten the skip
// window the operator intended.
func MarkKeyCooldown(channelId int, keyIndex int, until time.Time) {
	if channelId == 0 || keyIndex < 0 || !until.After(time.Now()) {
		return
	}
	k := keyCooldownKey(channelId, keyIndex)
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	if existing, ok := keyCooldownMap[k]; ok && existing.After(until) {
		return
	}
	keyCooldownMap[k] = until
}

// IsKeyInCooldown returns true if (channelId, keyIndex) is currently
// inside an unexpired skip window.
func IsKeyInCooldown(channelId int, keyIndex int, now time.Time) bool {
	if channelId == 0 || keyIndex < 0 {
		return false
	}
	k := keyCooldownKey(channelId, keyIndex)
	cooldownMu.RLock()
	until, ok := keyCooldownMap[k]
	cooldownMu.RUnlock()
	if !ok {
		return false
	}
	return now.Before(until)
}

// InCooldownKeyIndices returns the set of key indices of a given
// channel that are currently in cooldown. Used by
// GetNextEnabledKey to filter the random / polling candidate list
// in a single pass instead of probing each key individually.
func InCooldownKeyIndices(channelId int, now time.Time) map[int]struct{} {
	if channelId == 0 {
		return nil
	}
	cooldownMu.RLock()
	defer cooldownMu.RUnlock()
	if len(keyCooldownMap) == 0 {
		return nil
	}
	out := make(map[int]struct{})
	for k, until := range keyCooldownMap {
		if !now.Before(until) {
			continue
		}
		// Decode the channel id from the high bits; if it matches the
		// requested channel, expose the low bits as the key index.
		cid := int(k >> keyCooldownKeyIndexBits)
		if cid != channelId {
			continue
		}
		out[int(k & ((uint64(1) << keyCooldownKeyIndexBits) - 1))] = struct{}{}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// ClearKeyCooldown removes the cooldown entry for a single
// (channelId, keyIndex) pair. Used by manual reset and tests.
func ClearKeyCooldown(channelId int, keyIndex int) {
	if channelId == 0 || keyIndex < 0 {
		return
	}
	k := keyCooldownKey(channelId, keyIndex)
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	delete(keyCooldownMap, k)
}

// gcExpiredKeyCooldown removes expired per-key entries and returns
// the number removed. Safe to call concurrently.
func gcExpiredKeyCooldown(now time.Time) int {
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	removed := 0
	for k, until := range keyCooldownMap {
		if !now.Before(until) {
			delete(keyCooldownMap, k)
			removed++
		}
	}
	return removed
}

// gcAllExpired sweeps both maps in a single critical section so the
// per-key and per-channel views stay consistent. StartCooldownGC
// calls this periodically.
func gcAllExpired(now time.Time) (channelRemoved, keyRemoved int) {
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	for id, until := range cooldownMap {
		if !now.Before(until) {
			delete(cooldownMap, id)
			channelRemoved++
		}
	}
	for k, until := range keyCooldownMap {
		if !now.Before(until) {
			delete(keyCooldownMap, k)
			keyRemoved++
		}
	}
	return
}

// ClearChannelCooldown removes every cooldown overlay entry that
// belongs to the given channel — both the channel-level entry in
// cooldownMap and every per-key entry in keyCooldownMap whose
// channelId component matches. This is the operator's escape
// hatch for the case where the cooldown duration is too long and
// they want to bring a channel back into service without waiting
// for the deadline. The function returns the number of entries
// removed, so a UI can show "cleared 1 channel + 3 keys" to
// confirm the action took effect.
func ClearChannelCooldown(channelId int) (channelRemoved, keyRemoved int) {
	if channelId == 0 {
		return 0, 0
	}
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	if _, ok := cooldownMap[channelId]; ok {
		delete(cooldownMap, channelId)
		channelRemoved = 1
	}
	for k := range keyCooldownMap {
		cid := int(k >> keyCooldownKeyIndexBits)
		if cid == channelId {
			delete(keyCooldownMap, k)
			keyRemoved++
		}
	}
	return channelRemoved, keyRemoved
}

// ClearAllCooldowns removes every overlay entry across all channels.
// Used by tests and by an emergency-reset admin endpoint. The
// counts are returned for parity with ClearChannelCooldown.
func ClearAllCooldowns() (channelRemoved, keyRemoved int) {
	cooldownMu.Lock()
	defer cooldownMu.Unlock()
	channelRemoved = len(cooldownMap)
	keyRemoved = len(keyCooldownMap)
	cooldownMap = make(map[int]time.Time)
	keyCooldownMap = make(map[uint64]time.Time)
	return
}
