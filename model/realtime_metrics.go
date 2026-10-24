package model

import (
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// This file implements the in-process counters behind the dashboard's realtime
// RPM / TPM cards.
//
// Design constraints, in priority order:
//
//  1. The relay hot path must not get slower. A request only takes a read lock
//     plus a handful of integer adds on memory that is already resident; there
//     is no allocation, no Redis round trip and no database write.
//  2. Nothing is persisted. The numbers describe the recent past only, so
//     losing them on restart is expected — the hourly quota_data rollup remains
//     the durable record and is what the dashboard's historical charts read.
//  3. Memory must be bounded. One fixed-size ring per user that has sent
//     traffic, reclaimed after a period of inactivity.
//
// The rings are per node. Each instance only sees the requests it served
// itself, so a multi-node deployment reports per-node throughput; the snapshot
// carries NodeName so a caller can tell which node answered.

const (
	// realtimeSlotSeconds is the resolution of the ring. One minute windows are
	// the shortest the dashboard asks for, so ten seconds leaves enough
	// granularity to react within a window without making the ring huge.
	realtimeSlotSeconds = 10

	// realtimeRetentionSeconds is how much history a ring holds. Six hours
	// covers the longest window plus a comfortable margin for the chart.
	realtimeRetentionSeconds = 6 * 60 * 60

	// realtimeSlotCount is the ring length. Each slot is 24 bytes, so one ring
	// costs ~52KB regardless of how much traffic the user generates.
	realtimeSlotCount = realtimeRetentionSeconds / realtimeSlotSeconds

	// realtimeIdleTTL is how long a user's ring survives without traffic before
	// the sweeper frees it. It matches the retention window on purpose: a ring
	// whose newest sample is older than that can no longer contribute to any
	// window the dashboard can ask for, so keeping it would only hold memory
	// for data that can never be read back.
	realtimeIdleTTL = realtimeRetentionSeconds * time.Second

	// realtimeSweepInterval is how often the sweeper runs.
	realtimeSweepInterval = time.Minute

	// realtimeMaxUsers caps the number of live rings. It exists so an attacker
	// cannot grow the map without bound by cycling through accounts; the value
	// is far above any realistic concurrent user count on a single node.
	realtimeMaxUsers = 20000

	// realtimeSeriesBucketSeconds is the resolution of the returned series. The
	// ring stores ten-second slots, but a chart with thousands of points is
	// wasted payload, so points are summed into one-minute buckets.
	realtimeSeriesBucketSeconds = 60

	// realtimeSlowLogInterval ratelimits the "ring limit reached" warning so a
	// flood of rejected users does not itself become a log flood.
	realtimeSlowLogInterval = 60 * time.Second
)

// realtimeNow is indirected so tests can drive the ring with a synthetic clock
// instead of sleeping through real ten-second slots.
var realtimeNow = func() int64 {
	return time.Now().Unix()
}

// realtimeSlot is one ten-second bucket of a user's traffic.
type realtimeSlot struct {
	// Timestamp is the slot's start, aligned to realtimeSlotSeconds. Zero marks
	// an unused slot.
	Timestamp int64
	// Requests counts relay requests that produced usage in this slot.
	Requests int32
	// Tokens counts prompt plus completion tokens, matching how the existing
	// dashboard defines token throughput so the two views agree.
	Tokens int32
	// CacheReadTokens and InputTokensTotal are the cache hit rate's numerator
	// and denominator. They only accumulate for requests whose upstream
	// actually reported cache metadata, mirroring the rule the hourly
	// quota_data rollup applies: a response that says nothing about caching is
	// left out of the sample entirely rather than being counted as a miss.
	// That is why the denominator is a separate counter instead of Tokens —
	// Tokens includes completion tokens and every cache-silent request, so a
	// ratio taken against it would be neither a hit rate nor comparable to the
	// historical card.
	CacheReadTokens  int32
	InputTokensTotal int32
	// BusySeconds accumulates the sum of UseTimeSeconds for requests that
	// complete in this slot. Together with the window length it lets the read
	// path estimate instantaneous concurrency via Little's Law:
	//   concurrency ≈ Σ(busy_seconds) / window_seconds
	// The estimate lags by roughly the median request duration (~15-30s for
	// typical traffic) because a request's time is credited only after it
	// finishes, so the UI labels it "~30s lag".
	BusySeconds int32
}

// realtimeRing is a fixed-size circular buffer of slots for a single user.
// Slots are indexed by absolute slot number modulo the ring length, so an
// advancing clock overwrites the oldest data without any shifting.
type realtimeRing struct {
	mu       sync.Mutex
	slots    [realtimeSlotCount]realtimeSlot
	lastSeen int64
}

// realtimeUsage is one request's contribution to a ring. It is a struct rather
// than a widening parameter list so adding a future counter does not mean
// touching every call site again.
type realtimeUsage struct {
	// Tokens is prompt plus completion tokens.
	Tokens int
	// CacheReadTokens and InputTokensTotal are both zero unless the upstream
	// reported cache metadata; see realtimeSlot for why they travel together.
	CacheReadTokens  int
	InputTokensTotal int
	// UseTimeSeconds is the wall-clock seconds the request took. It feeds the
	// BusySeconds accumulator in the slot for Little's Law concurrency estimates.
	UseTimeSeconds int
}

// add folds one request into the slot covering now.
func (r *realtimeRing) add(now int64, usage realtimeUsage) {
	slotStart := now - (now % realtimeSlotSeconds)
	idx := int((slotStart / realtimeSlotSeconds) % realtimeSlotCount)
	slot := &r.slots[idx]
	if slot.Timestamp != slotStart {
		// Either an unused slot or one left over from a full lap of the ring.
		// Both cases mean its previous contents are outside the retention
		// window, so resetting it is the rollover.
		*slot = realtimeSlot{Timestamp: slotStart}
	}
	slot.Requests++
	slot.Tokens += int32(usage.Tokens)
	slot.CacheReadTokens += int32(usage.CacheReadTokens)
	slot.InputTokensTotal += int32(usage.InputTokensTotal)
	slot.BusySeconds += int32(usage.UseTimeSeconds)
	r.lastSeen = now
}

// realtimeWindowResult is the aggregate for one requested window.
type realtimeWindowResult struct {
	Requests         int
	Tokens           int
	CacheReadTokens  int
	InputTokensTotal int
	// BusySeconds is the sum of per-request use_time_seconds accumulated in
	// the window's slots. Dividing by the window length gives an estimate of
	// average concurrency via Little's Law.
	BusySeconds int
}

// snapshot copies the slots covering the given window so the caller can
// aggregate without holding the ring lock.
func (r *realtimeRing) snapshot(now int64, window int64) []realtimeSlot {
	start := realtimeWindowStart(now, window)
	slots := make([]realtimeSlot, 0, window/realtimeSlotSeconds)
	for i := range r.slots {
		slot := r.slots[i]
		if slot.Timestamp == 0 || slot.Timestamp < start || slot.Timestamp > now {
			continue
		}
		slots = append(slots, slot)
	}
	return slots
}

// realtimeWindowStart returns the first slot included in a trailing window.
//
// The start is snapped down to a slot boundary so a window always spans exactly
// window/realtimeSlotSeconds slots. Without the snap the same nominal window
// would cover six slots at one instant and seven a few seconds later, making
// the reported rate jitter for no operational reason. The cost is that a window
// can reach up to realtimeSlotSeconds-1 further back than its name suggests,
// which is immaterial for a dashboard and is why the value is not documented as
// an exact cut-off.
func realtimeWindowStart(now int64, window int64) int64 {
	slotCount := window / realtimeSlotSeconds
	if slotCount < 1 {
		slotCount = 1
	}
	currentSlot := now - now%realtimeSlotSeconds
	return currentSlot - (slotCount-1)*realtimeSlotSeconds
}

// realtimeRegistry holds one ring per active user.
var realtimeRegistry = struct {
	mu       sync.RWMutex
	users    map[int]*realtimeRing
	lastWarn int64
}{
	users: make(map[int]*realtimeRing),
}

// EnableRealtimeMetricsForTest switches the counters on without starting the
// sweeper, and ResetRealtimeMetricsForTest clears the registry and switches
// them back off. Controller tests need both because main.go's startup path is
// not exercised under `go test ./controller/...`.
func EnableRealtimeMetricsForTest() {
	realtimeEnabled = true
}

// ResetRealtimeMetricsForTest drops every ring and disables the feature again.
func ResetRealtimeMetricsForTest() {
	realtimeEnabled = false
	realtimeRegistry.mu.Lock()
	realtimeRegistry.users = make(map[int]*realtimeRing)
	realtimeRegistry.mu.Unlock()
	resetRealtimeDimensionsForTest()
}

// RecordRealtimeUsage folds one billable request into the user's ring,
// recording throughput only. Callers that also know the request's cache
// accounting should use RecordRealtimeCacheUsage instead.
func RecordRealtimeUsage(userId int, tokens int) {
	recordRealtimeUsage(userId, realtimeUsage{Tokens: tokens})
}

// RecordRealtimeCacheUsage folds one billable request into the user's ring
// together with its cache accounting.
//
// cacheStatsAvailable is the caller's assertion that the upstream actually
// reported cache metadata. When it is false both cache counters are dropped
// rather than recorded as zero, which is what keeps the resulting ratio a hit
// rate over a consistent sample instead of silently counting every
// cache-silent upstream as a miss.
func RecordRealtimeCacheUsage(userId int, tokens int, cacheReadTokens int, inputTokensTotal int, cacheStatsAvailable bool) {
	usage := realtimeUsage{Tokens: tokens}
	if cacheStatsAvailable {
		usage.CacheReadTokens = cacheReadTokens
		usage.InputTokensTotal = inputTokensTotal
	}
	recordRealtimeUsage(userId, usage)
}

// RecordRealtimeRequest folds one billable request into both the account-level
// ring and its (key, model) breakdown.
//
// The two are recorded separately and the account ring goes first, so a
// breakdown that is refused at its cap cannot cost the account its totals.
//
// useTimeSeconds is the wall-clock duration of the request; it accumulates into
// BusySeconds to support Little's Law concurrency estimation on the read path.
func RecordRealtimeRequest(userId int, tokenId int, model string, tokens int, cacheReadTokens int, inputTokensTotal int, cacheStatsAvailable bool, useTimeSeconds int) {
	usage := realtimeUsage{Tokens: tokens, UseTimeSeconds: useTimeSeconds}
	if cacheStatsAvailable {
		usage.CacheReadTokens = cacheReadTokens
		usage.InputTokensTotal = inputTokensTotal
	}
	recordRealtimeUsage(userId, usage)
	recordRealtimeDimension(userId, tokenId, model, usage)
}

// recordRealtimeUsage is the shared hot path. It is called from the relay path
// and does no IO.
func recordRealtimeUsage(userId int, usage realtimeUsage) {
	if !realtimeEnabled || userId <= 0 {
		return
	}
	now := realtimeNow()

	realtimeRegistry.mu.RLock()
	ring, ok := realtimeRegistry.users[userId]
	realtimeRegistry.mu.RUnlock()

	if !ok {
		realtimeRegistry.mu.Lock()
		// Re-check under the write lock: a concurrent request for the same user
		// may have created the ring while this one was waiting.
		ring, ok = realtimeRegistry.users[userId]
		if !ok {
			if len(realtimeRegistry.users) >= realtimeMaxUsers {
				// Refuse rather than evict: dropping the newest arrival keeps
				// the ring set stable, and the warning is rate limited so a
				// flood of distinct users cannot turn into a log flood.
				if now-realtimeRegistry.lastWarn >= int64(realtimeSlowLogInterval/time.Second) {
					realtimeRegistry.lastWarn = now
					common.SysLog("realtime metrics: user ring limit reached, further users are not tracked")
				}
				realtimeRegistry.mu.Unlock()
				return
			}
			ring = &realtimeRing{}
			realtimeRegistry.users[userId] = ring
		}
		realtimeRegistry.mu.Unlock()
	}

	ring.mu.Lock()
	ring.add(now, usage)
	ring.mu.Unlock()
}

// realtimeEnabled is set by InitRealtimeMetrics. Until it is true,
// RecordRealtimeUsage does nothing and no sweeper runs, so the feature costs
// exactly zero when switched off.
var realtimeEnabled bool

// InitRealtimeMetrics starts the idle reclamation loop. It is called once at
// startup rather than lazily from the first request, so the goroutine is not
// spawned from the relay hot path (which would also make it non-deterministic
// under test) and so a node that is later enabled does not need a restart.
func InitRealtimeMetrics() {
	realtimeEnabled = true
	go realtimeSweepLoop()
	initRealtimeCrossnode()
}

// realtimeSweepLoop periodically frees rings for users that stopped sending
// traffic. Without it the map would keep one ring per user forever.
func realtimeSweepLoop() {
	ticker := time.NewTicker(realtimeSweepInterval)
	defer ticker.Stop()
	for range ticker.C {
		sweepRealtimeRegistry()
		sweepRealtimeDimensionRegistry()
	}
}

// sweepRealtimeRegistry drops every ring whose user has been idle past
// realtimeIdleTTL. It is a separate function from the loop so the reclamation
// rule can be tested directly rather than through a minute-long ticker.
func sweepRealtimeRegistry() {
	cutoff := realtimeNow() - int64(realtimeIdleTTL/time.Second)
	realtimeRegistry.mu.Lock()
	defer realtimeRegistry.mu.Unlock()
	for userId, ring := range realtimeRegistry.users {
		ring.mu.Lock()
		idle := ring.lastSeen < cutoff
		ring.mu.Unlock()
		if idle {
			delete(realtimeRegistry.users, userId)
		}
	}
}

// realtimeBucket is one point of the returned series.
type realtimeBucket struct {
	Timestamp int64 `json:"timestamp"`
	Requests  int   `json:"requests"`
	Tokens    int   `json:"tokens"`
	// Raw cache counters rather than a precomputed ratio: a per-minute bucket
	// is often a tiny sample, and the client may want to re-aggregate several
	// buckets before dividing. Dividing here first would make that impossible
	// without weighting.
	CacheReadTokens  int `json:"cache_read_tokens"`
	InputTokensTotal int `json:"input_tokens_total"`
}

// RealtimeWindow is throughput over one trailing window.
type RealtimeWindow struct {
	WindowSeconds int     `json:"window_seconds"`
	Requests      int     `json:"requests"`
	Tokens        int     `json:"tokens"`
	RPM           float64 `json:"rpm"`
	TPM           float64 `json:"tpm"`
	// CacheReadTokens / InputTokensTotal are the hit rate's raw terms, exposed
	// so a caller can tell an empty sample apart from a genuine 0%.
	CacheReadTokens  int `json:"cache_read_tokens"`
	InputTokensTotal int `json:"input_tokens_total"`
	// CacheHitRate is the 0-1 ratio, or nil when no request in the window
	// reported cache metadata. A pointer is used deliberately: JSON 0 and
	// "unknown" must not collapse to the same value, or the dashboard would
	// render a confident 0% for a window it knows nothing about.
	CacheHitRate *float64 `json:"cache_hit_rate"`
	// AvgConcurrency is an estimate of average in-flight requests during the
	// window, computed as sum(use_time_seconds) / window_seconds (Little's Law).
	// It lags by roughly the median request duration (~30s for typical traffic)
	// because a request contributes its time only after it completes. Clients
	// should display this with a "~30s lag" label so users are not misled during
	// a sudden burst that hasn't fully resolved yet.
	AvgConcurrency float64 `json:"avg_concurrency"`
}

// RealtimeSnapshot is the payload behind the realtime cards and chart.
type RealtimeSnapshot struct {
	UserID int   `json:"user_id"`
	Now    int64 `json:"now"`
	// NodeName identifies which instance produced this snapshot. The rings are
	// per process, so in a multi-node deployment the numbers describe only the
	// traffic this node served.
	NodeName string           `json:"node_name"`
	Windows  []RealtimeWindow `json:"windows"`
	Series   []realtimeBucket `json:"series"`
	// TokenID and Model echo the filter the snapshot was built under, so a
	// client polling with a filter can tell which selection a late response
	// belongs to and discard one that arrived after the user changed it.
	TokenID int    `json:"token_id,omitempty"`
	Model   string `json:"model,omitempty"`
}

// realtimeWindows are the trailing windows the API reports, in seconds.
var realtimeWindows = []int64{60, 300, 3600}

// GetRealtimeSnapshot builds the snapshot for a user. A user that has never
// sent traffic yields zeroes rather than an error, so the dashboard does not
// need a special empty state.
func GetRealtimeSnapshot(userId int) RealtimeSnapshot {
	return GetRealtimeSnapshotFiltered(userId, RealtimeFilter{})
}

// GetRealtimeSnapshotFiltered is GetRealtimeSnapshot narrowed to one key and/or
// model.
//
// An unfiltered request reads the account ring directly. Only a filtered one
// touches the breakdown registry, so adding this capability costs the common
// case nothing.
func GetRealtimeSnapshotFiltered(userId int, filter RealtimeFilter) RealtimeSnapshot {
	now := realtimeNow()
	longest := realtimeWindows[len(realtimeWindows)-1]

	snapshot := RealtimeSnapshot{
		UserID:   userId,
		Now:      now,
		NodeName: common.NodeName,
		Windows:  make([]RealtimeWindow, 0, len(realtimeWindows)),
		TokenID:  filter.TokenID,
		Model:    filter.Model,
	}

	var slots []realtimeSlot
	if filter.IsZero() {
		realtimeRegistry.mu.RLock()
		ring := realtimeRegistry.users[userId]
		realtimeRegistry.mu.RUnlock()
		if ring != nil {
			ring.mu.Lock()
			// The longest window drives the series, and every shorter window is
			// folded from the same slot scan so a request reads the ring once.
			slots = ring.snapshot(now, longest)
			ring.mu.Unlock()
		}
	} else {
		slots = realtimeDimensionSlots(userId, filter, now, longest)
	}

	if len(slots) == 0 {
		for _, window := range realtimeWindows {
			// Merge cross-node data even when the local ring has no slots. Other
			// nodes may have seen traffic (for this user, or this filtered
			// dimension) that this node hasn't.
			result := mergeFromRedis(userId, filter, window, realtimeWindowResult{})
			snapshot.Windows = append(snapshot.Windows, buildWindow(window, result))
		}
		snapshot.Series = emptySeries(now, longest)
		return snapshot
	}

	for _, window := range realtimeWindows {
		result := sumSlots(slots, now, window)
		// Merge in contributions from other nodes, whether this is the
		// account-level total or a filtered (token, model) breakdown — each
		// node publishes both under its own key, keyed by field.
		result = mergeFromRedis(userId, filter, window, result)
		snapshot.Windows = append(snapshot.Windows, buildWindow(window, result))
	}
	snapshot.Series = buildSeries(slots, now, longest)
	return snapshot
}

// RealtimeUserSummary is one row of the admin all-users view.
type RealtimeUserSummary struct {
	UserID   int     `json:"user_id"`
	Username string  `json:"username"`
	Requests int     `json:"requests"`
	Tokens   int     `json:"tokens"`
	RPM      float64 `json:"rpm"`
	TPM      float64 `json:"tpm"`
	LastSeen int64   `json:"last_seen"`
}

// GetRealtimeUserSummaries returns every tracked user's traffic over the window,
// busiest first. It is admin-only and reads only in-process state.
func GetRealtimeUserSummaries(window int64) []RealtimeUserSummary {
	now := realtimeNow()

	realtimeRegistry.mu.RLock()
	rings := make(map[int]*realtimeRing, len(realtimeRegistry.users))
	for userId, ring := range realtimeRegistry.users {
		rings[userId] = ring
	}
	realtimeRegistry.mu.RUnlock()

	summaries := make([]RealtimeUserSummary, 0, len(rings))
	for userId, ring := range rings {
		ring.mu.Lock()
		slots := ring.snapshot(now, window)
		lastSeen := ring.lastSeen
		ring.mu.Unlock()

		totals := sumSlots(slots, now, window)
		if totals.Requests == 0 && totals.Tokens == 0 {
			continue
		}
		windowMinutes := float64(window) / 60
		summaries = append(summaries, RealtimeUserSummary{
			UserID:   userId,
			Requests: totals.Requests,
			Tokens:   totals.Tokens,
			RPM:      float64(totals.Requests) / windowMinutes,
			TPM:      float64(totals.Tokens) / windowMinutes,
			LastSeen: lastSeen,
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].Requests != summaries[j].Requests {
			return summaries[i].Requests > summaries[j].Requests
		}
		return summaries[i].UserID < summaries[j].UserID
	})
	return summaries
}

// GetTeamRealtimeSnapshot aggregates realtime snapshots for a set of users
// (a parent account plus its currently-bound children) into a single combined
// snapshot. It is the realtime counterpart to GetTeamUsageSummaryByBindings:
// the per-key breakdown reads current rings and does not apply binding-period
// filtering — that is only meaningful for historical (quota_data) queries.
func GetTeamRealtimeSnapshot(userIds []int) RealtimeSnapshot {
	now := realtimeNow()
	longest := realtimeWindows[len(realtimeWindows)-1]

	result := RealtimeSnapshot{
		Now:      now,
		NodeName: common.NodeName,
		Windows:  make([]RealtimeWindow, len(realtimeWindows)),
		Series:   emptySeries(now, longest),
	}
	for i, w := range realtimeWindows {
		result.Windows[i].WindowSeconds = int(w)
	}

	type rawWindow struct{ requests, tokens, cacheRead, cacheInput, busySec int }
	raws := make([]rawWindow, len(realtimeWindows))

	for _, userId := range userIds {
		s := GetRealtimeSnapshot(userId)
		for i, w := range s.Windows {
			raws[i].requests += w.Requests
			raws[i].tokens += w.Tokens
			raws[i].cacheRead += w.CacheReadTokens
			raws[i].cacheInput += w.InputTokensTotal
			// Recover BusySeconds from the already-derived AvgConcurrency field so
			// the team total can be recomputed correctly: AvgConcurrency = busy/W, so
			// busy = AvgConcurrency * W.
			raws[i].busySec += int(w.AvgConcurrency * float64(w.WindowSeconds))
		}
		for j := range s.Series {
			if j < len(result.Series) {
				result.Series[j].Requests += s.Series[j].Requests
				result.Series[j].Tokens += s.Series[j].Tokens
				result.Series[j].CacheReadTokens += s.Series[j].CacheReadTokens
				result.Series[j].InputTokensTotal += s.Series[j].InputTokensTotal
			}
		}
	}

	for i, w := range realtimeWindows {
		r := raws[i]
		windowMinutes := float64(w) / 60
		result.Windows[i] = RealtimeWindow{
			WindowSeconds:    int(w),
			Requests:         r.requests,
			Tokens:           r.tokens,
			CacheReadTokens:  r.cacheRead,
			InputTokensTotal: r.cacheInput,
			RPM:              float64(r.requests) / windowMinutes,
			TPM:              float64(r.tokens) / windowMinutes,
			CacheHitRate: realtimeCacheHitRate(realtimeWindowResult{
				CacheReadTokens:  r.cacheRead,
				InputTokensTotal: r.cacheInput,
			}),
			AvgConcurrency: float64(r.busySec) / float64(w),
		}
	}

	return result
}

// FillRealtimeUsernames resolves the username for each summary. The registry
// only stores user ids, and the admin table wants something readable, so the
// names are looked up in one query at read time rather than being cached on the
// hot path.
func FillRealtimeUsernames(summaries []RealtimeUserSummary) {
	if len(summaries) == 0 {
		return
	}
	ids := make([]int, 0, len(summaries))
	seen := make(map[int]bool, len(summaries))
	for _, summary := range summaries {
		if seen[summary.UserID] {
			continue
		}
		seen[summary.UserID] = true
		ids = append(ids, summary.UserID)
	}

	var users []User
	if err := DB.Select("id", "username").Where("id in (?)", ids).Find(&users).Error; err != nil {
		// A failed lookup only costs the display name; the throughput numbers
		// are already computed and are the point of the endpoint.
		common.SysLog("realtime metrics: failed to resolve usernames: " + err.Error())
		return
	}
	names := make(map[int]string, len(users))
	for _, user := range users {
		names[user.Id] = user.Username
	}
	for i := range summaries {
		if name, ok := names[summaries[i].UserID]; ok {
			summaries[i].Username = name
		}
	}
}

// realtimeSeriesStart returns the timestamp of the first returned bucket.
//
// Unlike the window start, this is snapped to a minute rather than to a slot:
// the series exists to be drawn, and a chart whose x-axis ticks all sit offset
// from the minute boundary reads badly. Snapping means the minute-aligned span
// can be up to a minute shorter than the requested window, so the series gets
// one extra bucket to compensate and always covers the whole window. The first
// and last buckets are therefore partial, which is normal for a live chart and
// keeps the series total equal to the corresponding card.
func realtimeSeriesStart(now int64, window int64) int64 {
	lastBucket := now - now%realtimeSeriesBucketSeconds
	return lastBucket - window
}

// realtimeSeriesBucketCount is how many points the series carries: the window
// at one-minute resolution, plus one for the alignment described above.
func realtimeSeriesBucketCount(window int64) int {
	count := int(window/realtimeSeriesBucketSeconds) + 1
	if count < 1 {
		count = 1
	}
	return count
}

// sumSlots totals the slots inside the trailing window. Slots are assumed to
// have been pre-filtered by realtimeRing.snapshot, which applies the same
// aligned start.
func sumSlots(slots []realtimeSlot, now int64, window int64) realtimeWindowResult {
	start := realtimeWindowStart(now, window)
	var result realtimeWindowResult
	for _, slot := range slots {
		if slot.Timestamp < start || slot.Timestamp > now {
			continue
		}
		result.Requests += int(slot.Requests)
		result.Tokens += int(slot.Tokens)
		result.CacheReadTokens += int(slot.CacheReadTokens)
		result.InputTokensTotal += int(slot.InputTokensTotal)
		result.BusySeconds += int(slot.BusySeconds)
	}
	return result
}

// buildSeries folds the slots into one-minute buckets covering the window.
func buildSeries(slots []realtimeSlot, now int64, window int64) []realtimeBucket {
	start := realtimeSeriesStart(now, window)
	bucketCount := realtimeSeriesBucketCount(window)
	series := make([]realtimeBucket, bucketCount)
	for i := range series {
		series[i].Timestamp = start + int64(i)*realtimeSeriesBucketSeconds
	}
	for _, slot := range slots {
		index := int((slot.Timestamp - start) / realtimeSeriesBucketSeconds)
		if index < 0 || index >= bucketCount {
			continue
		}
		series[index].Requests += int(slot.Requests)
		series[index].Tokens += int(slot.Tokens)
		series[index].CacheReadTokens += int(slot.CacheReadTokens)
		series[index].InputTokensTotal += int(slot.InputTokensTotal)
	}
	return series
}

// emptySeries returns a zeroed series for a user with no recorded traffic, so
// the chart renders an empty axis instead of a single point.
func emptySeries(now int64, window int64) []realtimeBucket {
	start := realtimeSeriesStart(now, window)
	series := make([]realtimeBucket, realtimeSeriesBucketCount(window))
	for i := range series {
		series[i].Timestamp = start + int64(i)*realtimeSeriesBucketSeconds
	}
	return series
}

// buildWindow converts raw totals into a window result with derived rates.
func buildWindow(window int64, result realtimeWindowResult) RealtimeWindow {
	windowMinutes := float64(window) / 60
	return RealtimeWindow{
		WindowSeconds:    int(window),
		Requests:         result.Requests,
		Tokens:           result.Tokens,
		RPM:              float64(result.Requests) / windowMinutes,
		TPM:              float64(result.Tokens) / windowMinutes,
		CacheReadTokens:  result.CacheReadTokens,
		InputTokensTotal: result.InputTokensTotal,
		CacheHitRate:     realtimeCacheHitRate(result),
		AvgConcurrency:   float64(result.BusySeconds) / float64(window),
	}
}

// realtimeCacheHitRate returns the 0-1 hit rate, or nil when the window holds
// no cache-reporting request. Returning nil rather than 0 is what lets the
// dashboard show a placeholder for "no data" instead of claiming a 0% hit rate
// it cannot support.
func realtimeCacheHitRate(result realtimeWindowResult) *float64 {
	if result.InputTokensTotal <= 0 {
		return nil
	}
	rate := float64(result.CacheReadTokens) / float64(result.InputTokensTotal)
	return &rate
}
