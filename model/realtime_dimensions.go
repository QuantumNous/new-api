package model

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Per-key / per-model breakdown of the realtime counters.
//
// The user-level rings in realtime_metrics.go answer "how much is this account
// doing right now". They cannot answer "which key" or "which model", because
// every request folds into the same ring. This file adds a second registry
// keyed by (user, token, model) so the dashboard can filter.
//
// Two properties are deliberate:
//
//  1. The user-level ring stays authoritative for totals. This registry is a
//     breakdown laid alongside it, never a replacement. If the breakdown hits
//     its cap and stops tracking a new combination, the account total is still
//     complete — the filtered view loses a row, the headline number does not.
//
//  2. Rings are created on demand. A user holding 50 keys does not cost 50
//     rings; only the key/model pairs that actually served traffic allocate.
//     Real traffic is very sparse in this dimension, so the cap is reached only
//     by genuinely broad usage rather than by provisioning.

const (
	// realtimeMaxDimensionRings caps how many (user, token, model) rings exist
	// at once. Each ring is ~50KB, so this is a ~100MB ceiling.
	//
	// The limit is independent of the per-user token quota on purpose. That
	// quota is an operator setting which can be raised at any time, and an
	// operator raising it should not be able to turn a configuration change
	// into unbounded memory growth on the relay nodes.
	realtimeMaxDimensionRings = 2000

	// realtimeMaxModelNameLen bounds the model component of the key. Model
	// names arrive from the request body, so without a bound a caller could mint
	// unlimited distinct keys — each one a ring — by varying a long string.
	// Truncation keeps such a caller inside the cap and merely makes two absurd
	// names share a row.
	realtimeMaxModelNameLen = 64
)

// realtimeDimensionKey identifies one breakdown ring.
//
// It is a comparable struct rather than a concatenated string because it is
// built on the relay hot path for every billable request. A struct key hashes
// in place; formatting a string key measured ~6x slower and allocated twice per
// request, which is a real cost to pay on a path that does nothing else.
type realtimeDimensionKey struct {
	UserID  int
	TokenID int
	Model   string
}

// realtimeDimensionRegistry holds the breakdown rings.
//
// It is a separate registry from the user-level one, with its own lock, so a
// breakdown sweep or a cap check never delays the path that maintains the
// account totals.
var realtimeDimensionRegistry = struct {
	mu       sync.RWMutex
	rings    map[realtimeDimensionKey]*realtimeRing
	lastWarn int64
	// capped records that at least one combination was refused since the last
	// sweep, so a reader can be told its breakdown may be incomplete rather
	// than silently seeing fewer rows than it should.
	capped bool
}{
	rings: make(map[realtimeDimensionKey]*realtimeRing),
}

// recordRealtimeDimension folds one request into its (user, token, model) ring.
//
// Failure is silent and total-preserving: if the cap is reached, or the caller
// has no token id, the request simply does not appear in the breakdown. The
// user-level ring has already counted it either way.
func recordRealtimeDimension(userId int, tokenId int, model string, usage realtimeUsage) {
	if !realtimeEnabled || userId <= 0 || tokenId <= 0 {
		return
	}
	if len(model) > realtimeMaxModelNameLen {
		model = model[:realtimeMaxModelNameLen]
	}

	now := realtimeNow()
	key := realtimeDimensionKey{UserID: userId, TokenID: tokenId, Model: model}

	realtimeDimensionRegistry.mu.RLock()
	ring, ok := realtimeDimensionRegistry.rings[key]
	realtimeDimensionRegistry.mu.RUnlock()

	if !ok {
		realtimeDimensionRegistry.mu.Lock()
		// Re-check under the write lock: a concurrent request for the same
		// combination may have created the ring while this one waited.
		ring, ok = realtimeDimensionRegistry.rings[key]
		if !ok {
			if len(realtimeDimensionRegistry.rings) >= realtimeMaxDimensionRings {
				realtimeDimensionRegistry.capped = true
				if now-realtimeDimensionRegistry.lastWarn >= int64(realtimeSlowLogInterval/time.Second) {
					realtimeDimensionRegistry.lastWarn = now
					common.SysLog("realtime metrics: key/model ring limit reached, further combinations are not broken down (account totals are unaffected)")
				}
				realtimeDimensionRegistry.mu.Unlock()
				return
			}
			ring = &realtimeRing{}
			realtimeDimensionRegistry.rings[key] = ring
		}
		realtimeDimensionRegistry.mu.Unlock()
	}

	ring.mu.Lock()
	ring.add(now, usage)
	ring.mu.Unlock()
}

// sweepRealtimeDimensionRegistry frees breakdown rings idle past the TTL.
//
// It also clears the capped flag: once space has been reclaimed, new
// combinations can be tracked again, so a stale warning would misreport the
// current state.
func sweepRealtimeDimensionRegistry() {
	cutoff := realtimeNow() - int64(realtimeIdleTTL/time.Second)
	realtimeDimensionRegistry.mu.Lock()
	defer realtimeDimensionRegistry.mu.Unlock()
	for key, ring := range realtimeDimensionRegistry.rings {
		ring.mu.Lock()
		idle := ring.lastSeen < cutoff
		ring.mu.Unlock()
		if idle {
			delete(realtimeDimensionRegistry.rings, key)
		}
	}
	if len(realtimeDimensionRegistry.rings) < realtimeMaxDimensionRings {
		realtimeDimensionRegistry.capped = false
	}
}

// resetRealtimeDimensionsForTest clears the breakdown registry.
func resetRealtimeDimensionsForTest() {
	realtimeDimensionRegistry.mu.Lock()
	realtimeDimensionRegistry.rings = make(map[realtimeDimensionKey]*realtimeRing)
	realtimeDimensionRegistry.capped = false
	realtimeDimensionRegistry.lastWarn = 0
	realtimeDimensionRegistry.mu.Unlock()
}

// RealtimeFilter narrows a snapshot to one key and/or one model.
//
// A zero TokenID means "every key", and an empty Model means "every model", so
// the zero value is an unfiltered request. This is what lets the caller ask for
// one key across all its models without naming them.
type RealtimeFilter struct {
	TokenID int
	Model   string
}

// IsZero reports whether the filter selects everything, in which case the
// caller can use the cheaper user-level ring instead of merging a subset.
func (f RealtimeFilter) IsZero() bool {
	return f.TokenID <= 0 && f.Model == ""
}

// matches reports whether a breakdown key falls inside the filter.
func (f RealtimeFilter) matches(key realtimeDimensionKey) bool {
	if f.TokenID > 0 && key.TokenID != f.TokenID {
		return false
	}
	if f.Model != "" && key.Model != f.Model {
		return false
	}
	return true
}

// realtimeDimensionSlots collects the slots of every ring matching the filter.
//
// Slots from different rings are returned as one flat list rather than being
// merged by timestamp. The aggregation helpers already sum by timestamp, so
// pre-merging here would duplicate that logic for no gain.
func realtimeDimensionSlots(userId int, filter RealtimeFilter, now int64, window int64) []realtimeSlot {
	realtimeDimensionRegistry.mu.RLock()
	rings := make([]*realtimeRing, 0, 8)
	for key, ring := range realtimeDimensionRegistry.rings {
		if key.UserID != userId || !filter.matches(key) {
			continue
		}
		rings = append(rings, ring)
	}
	realtimeDimensionRegistry.mu.RUnlock()

	// Snapshot outside the registry lock: copying slots is the expensive part,
	// and holding the registry lock through it would block every concurrent
	// request that needs to create a ring.
	slots := make([]realtimeSlot, 0, len(rings)*int(window/realtimeSlotSeconds))
	for _, ring := range rings {
		ring.mu.Lock()
		slots = append(slots, ring.snapshot(now, window)...)
		ring.mu.Unlock()
	}
	return slots
}

// RealtimeDimensionOption is one selectable key or model.
type RealtimeDimensionOption struct {
	TokenID   int    `json:"token_id,omitempty"`
	TokenName string `json:"token_name,omitempty"`
	Model     string `json:"model,omitempty"`
	Requests  int    `json:"requests"`
}

// RealtimeDimensions lists what a user can currently filter by.
//
// Only combinations with live traffic appear. A key that exists but has not
// been used in the retention window is not offered, because selecting it could
// only ever produce an empty chart.
type RealtimeDimensions struct {
	Tokens []RealtimeDimensionOption `json:"tokens"`
	Models []RealtimeDimensionOption `json:"models"`
	// Truncated reports that the breakdown hit its ring cap, so some
	// combinations are missing from these lists even though their traffic is
	// still included in the account totals.
	Truncated bool `json:"truncated"`
}

// GetRealtimeDimensions reports the keys and models a user has traffic for
// within the given trailing window.
func GetRealtimeDimensions(userId int, window int64) RealtimeDimensions {
	now := realtimeNow()
	byToken := make(map[int]int)
	byModel := make(map[string]int)

	realtimeDimensionRegistry.mu.RLock()
	type entry struct {
		key  realtimeDimensionKey
		ring *realtimeRing
	}
	entries := make([]entry, 0, len(realtimeDimensionRegistry.rings))
	for key, ring := range realtimeDimensionRegistry.rings {
		if key.UserID != userId {
			continue
		}
		entries = append(entries, entry{key, ring})
	}
	truncated := realtimeDimensionRegistry.capped
	realtimeDimensionRegistry.mu.RUnlock()

	for _, e := range entries {
		e.ring.mu.Lock()
		slots := e.ring.snapshot(now, window)
		e.ring.mu.Unlock()
		requests := 0
		for _, slot := range slots {
			requests += int(slot.Requests)
		}
		if requests == 0 {
			continue
		}
		byToken[e.key.TokenID] += requests
		byModel[e.key.Model] += requests
	}

	dims := RealtimeDimensions{
		Tokens:    make([]RealtimeDimensionOption, 0, len(byToken)),
		Models:    make([]RealtimeDimensionOption, 0, len(byModel)),
		Truncated: truncated,
	}
	for tokenId, requests := range byToken {
		dims.Tokens = append(dims.Tokens, RealtimeDimensionOption{TokenID: tokenId, Requests: requests})
	}
	for model, requests := range byModel {
		dims.Models = append(dims.Models, RealtimeDimensionOption{Model: model, Requests: requests})
	}

	// Busiest first, then by identity so equal-traffic entries keep a stable
	// order across polls instead of reshuffling the dropdown every few seconds.
	sort.Slice(dims.Tokens, func(i, j int) bool {
		if dims.Tokens[i].Requests != dims.Tokens[j].Requests {
			return dims.Tokens[i].Requests > dims.Tokens[j].Requests
		}
		return dims.Tokens[i].TokenID < dims.Tokens[j].TokenID
	})
	sort.Slice(dims.Models, func(i, j int) bool {
		if dims.Models[i].Requests != dims.Models[j].Requests {
			return dims.Models[i].Requests > dims.Models[j].Requests
		}
		return dims.Models[i].Model < dims.Models[j].Model
	})

	fillRealtimeTokenNames(dims.Tokens)
	return dims
}

// fillRealtimeTokenNames resolves key names for display.
//
// Names are looked up in one query rather than per row, and a key that has been
// deleted since it last served traffic simply keeps an empty name instead of
// dropping the row: its traffic is real and still belongs in the list.
func fillRealtimeTokenNames(options []RealtimeDimensionOption) {
	if len(options) == 0 {
		return
	}
	ids := make([]int, 0, len(options))
	for _, option := range options {
		ids = append(ids, option.TokenID)
	}

	var rows []struct {
		Id   int
		Name string
	}
	if err := DB.Model(&Token{}).Select("id, name").Where("id IN ?", ids).Find(&rows).Error; err != nil {
		common.SysLog("realtime metrics: failed to resolve token names: " + err.Error())
		return
	}
	names := make(map[int]string, len(rows))
	for _, row := range rows {
		names[row.Id] = row.Name
	}
	for i := range options {
		options[i].TokenName = names[options[i].TokenID]
	}
}

// RealtimeKeyBreakdown is one key's realtime throughput: the same window
// metrics the account snapshot reports, scoped to a single key.
type RealtimeKeyBreakdown struct {
	TokenID   int              `json:"token_id"`
	TokenName string           `json:"token_name,omitempty"`
	Windows   []RealtimeWindow `json:"windows"`
}

// RealtimeKeyBreakdowns is the per-key payload behind the API-key realtime
// endpoint: the account snapshot's numbers split by the key that served them.
type RealtimeKeyBreakdowns struct {
	UserID   int    `json:"user_id"`
	Now      int64  `json:"now"`
	NodeName string `json:"node_name"`
	// Truncated reports that the breakdown hit its ring cap, so some keys
	// are missing from this list even though their traffic is still counted
	// in the account totals.
	Truncated bool                   `json:"truncated"`
	Keys      []RealtimeKeyBreakdown `json:"keys"`
}

// GetRealtimeKeyBreakdowns splits the account's realtime snapshot by key.
//
// Only keys with traffic inside the retention window appear — an idle key's
// row would be all zeroes and only invite misreading, mirroring
// GetRealtimeDimensions. Cross-node contributions are folded in per key, and
// keys whose traffic lives only on other nodes are discovered there, so the
// split always reconciles with the unfiltered account snapshot.
func GetRealtimeKeyBreakdowns(userId int) RealtimeKeyBreakdowns {
	now := realtimeNow()
	longest := realtimeWindows[len(realtimeWindows)-1]

	// One pass over the dimension rings, grouped by token.
	localSlots := make(map[int][]realtimeSlot)
	realtimeDimensionRegistry.mu.RLock()
	for key, ring := range realtimeDimensionRegistry.rings {
		if key.UserID != userId {
			continue
		}
		ring.mu.Lock()
		slots := ring.snapshot(now, longest)
		ring.mu.Unlock()
		localSlots[key.TokenID] = append(localSlots[key.TokenID], slots...)
	}
	truncated := realtimeDimensionRegistry.capped
	realtimeDimensionRegistry.mu.RUnlock()

	remote := realtimeRemotePerToken(userId, realtimeWindows)

	breakdowns := make([]RealtimeKeyBreakdown, 0, len(localSlots)+len(remote))
	appendKey := func(tokenId int, slots []realtimeSlot) {
		windows := make([]RealtimeWindow, 0, len(realtimeWindows))
		for _, window := range realtimeWindows {
			result := sumSlots(slots, now, window)
			if remoteResults, ok := remote[tokenId]; ok {
				result.Requests += remoteResults[window].Requests
				result.Tokens += remoteResults[window].Tokens
				result.CacheReadTokens += remoteResults[window].CacheReadTokens
				result.InputTokensTotal += remoteResults[window].InputTokensTotal
				result.BusySeconds += remoteResults[window].BusySeconds
			}
			windows = append(windows, buildWindow(window, result))
		}
		breakdowns = append(breakdowns, RealtimeKeyBreakdown{TokenID: tokenId, Windows: windows})
	}
	for tokenId, slots := range localSlots {
		appendKey(tokenId, slots)
	}
	// A key with no local ring still counts if other nodes served it.
	for tokenId := range remote {
		if _, ok := localSlots[tokenId]; !ok {
			appendKey(tokenId, nil)
		}
	}
	// Drop keys whose merged traffic is zero everywhere: a ring can outlive
	// its traffic (retention window rolled past, or an idle sweep hasn't run
	// yet), and an all-zero row only invites misreading.
	kept := breakdowns[:0]
	for _, breakdown := range breakdowns {
		if breakdown.Windows[len(breakdown.Windows)-1].Requests > 0 {
			kept = append(kept, breakdown)
		}
	}
	breakdowns = kept

	resolveRealtimeTokenNames(breakdowns)

	// Busiest first by the longest window, then by id so equal-traffic keys
	// keep a stable order across polls.
	sort.Slice(breakdowns, func(i, j int) bool {
		left := breakdowns[i].Windows[len(breakdowns[i].Windows)-1]
		right := breakdowns[j].Windows[len(breakdowns[j].Windows)-1]
		if left.Requests != right.Requests {
			return left.Requests > right.Requests
		}
		return breakdowns[i].TokenID < breakdowns[j].TokenID
	})

	return RealtimeKeyBreakdowns{
		UserID:    userId,
		Now:       now,
		NodeName:  common.NodeName,
		Truncated: truncated,
		Keys:      breakdowns,
	}
}

// resolveRealtimeTokenNames fills in each key's display name. The lookup is
// one primary-key IN query per response; a key that no longer exists keeps an
// empty name, which omitempty drops from the payload rather than showing a
// stale label.
func resolveRealtimeTokenNames(breakdowns []RealtimeKeyBreakdown) {
	if len(breakdowns) == 0 {
		return
	}
	ids := make([]int, 0, len(breakdowns))
	for i := range breakdowns {
		ids = append(ids, breakdowns[i].TokenID)
	}
	rows := []struct {
		Id   int
		Name string
	}{}
	if err := DB.Table("tokens").Select("id, name").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		common.SysLog(fmt.Sprintf("realtime key breakdown name lookup failed: %s", err))
		return
	}
	names := make(map[int]string, len(rows))
	for _, row := range rows {
		names[row.Id] = row.Name
	}
	for i := range breakdowns {
		breakdowns[i].TokenName = names[breakdowns[i].TokenID]
	}
}
