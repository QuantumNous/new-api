package modelroute

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// ProductionSlot tracks one in-flight production request on a MetricsKey (PRD §19).
type ProductionSlot struct {
	key      model.MetricsKey
	released atomic.Bool
}

// Release frees the concurrency slot (safe to call once).
func (s *ProductionSlot) Release() {
	if s == nil || !s.released.CompareAndSwap(false, true) {
		return
	}
	GlobalConcurrency.Release(s.key)
}

// ConcurrencyTracker is process-local active production concurrency per MetricsKey (PRD §19).
type ConcurrencyTracker struct {
	mu       sync.Mutex
	active   map[string]int
	limits   map[string]int // 0 or missing → unlimited
	overflow map[string]*overflowRatioState
}

type overflowRatioState struct {
	// sliding: successes routed as overflow vs total
	overflowCount int
	totalCount    int
	highSince     time.Time
	stable        bool
}

// GlobalConcurrency is the singleton concurrency + overflow_ratio tracker.
var GlobalConcurrency = &ConcurrencyTracker{
	active:   make(map[string]int),
	limits:   make(map[string]int),
	overflow: make(map[string]*overflowRatioState),
}

// SetLimit sets max concurrent production for a metrics key; 0 = unlimited.
func (t *ConcurrencyTracker) SetLimit(mk model.MetricsKey, limit int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if limit <= 0 {
		delete(t.limits, mk.String())
		return
	}
	t.limits[mk.String()] = limit
}

// Active returns current in-flight count.
func (t *ConcurrencyTracker) Active(mk model.MetricsKey) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.active[mk.String()]
}

// Remaining returns remaining capacity; -1 means unlimited.
func (t *ConcurrencyTracker) Remaining(mk model.MetricsKey) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	lim, ok := t.limits[mk.String()]
	if !ok || lim <= 0 {
		return -1
	}
	cur := t.active[mk.String()]
	left := lim - cur
	if left < 0 {
		return 0
	}
	return left
}

// HasCapacity reports whether a slot can be acquired.
func (t *ConcurrencyTracker) HasCapacity(mk model.MetricsKey) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	lim, ok := t.limits[mk.String()]
	if !ok || lim <= 0 {
		return true
	}
	return t.active[mk.String()] < lim
}

// TryAcquireProductionSlot attempts to take one production slot (PRD §19.2).
func (t *ConcurrencyTracker) TryAcquireProductionSlot(mk model.MetricsKey) (*ProductionSlot, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	lim, ok := t.limits[mk.String()]
	if ok && lim > 0 && t.active[mk.String()] >= lim {
		return nil, false
	}
	t.active[mk.String()]++
	return &ProductionSlot{key: mk}, true
}

// Release decrements active count.
func (t *ConcurrencyTracker) Release(mk model.MetricsKey) {
	t.mu.Lock()
	defer t.mu.Unlock()
	k := mk.String()
	if t.active[k] > 0 {
		t.active[k]--
	}
	if t.active[k] == 0 {
		delete(t.active, k)
	}
}

// Clear resets all concurrency state (tests).
func (t *ConcurrencyTracker) Clear() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.active = make(map[string]int)
	t.limits = make(map[string]int)
	t.overflow = make(map[string]*overflowRatioState)
}

// RecordRouteOutcome updates overflow_ratio for requested_model (PRD §23).
func (t *ConcurrencyTracker) RecordRouteOutcome(requestedModel string, usedOverflow bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	st := t.overflow[requestedModel]
	if st == nil {
		st = &overflowRatioState{}
		t.overflow[requestedModel] = st
	}
	st.totalCount++
	if usedOverflow {
		st.overflowCount++
	}
	// decay window roughly by capping counts
	if st.totalCount > 100 {
		st.overflowCount = st.overflowCount * 80 / 100
		st.totalCount = 80
	}
	ratio := 0.0
	if st.totalCount > 0 {
		ratio = float64(st.overflowCount) / float64(st.totalCount)
	}
	if ratio > model.DefaultStableOverflowRatioThreshold {
		if st.highSince.IsZero() {
			st.highSince = now()
		}
		if now().Sub(st.highSince) >= time.Duration(model.DefaultStableOverflowConfirmSec)*time.Second {
			st.stable = true
		}
	} else {
		st.highSince = time.Time{}
		st.stable = false
	}
}

// OverflowStable reports overflow_stable flag (PRD §23).
func (t *ConcurrencyTracker) OverflowStable(requestedModel string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	st := t.overflow[requestedModel]
	return st != nil && st.stable
}

// OverflowRatio returns current overflow_ratio estimate.
func (t *ConcurrencyTracker) OverflowRatio(requestedModel string) float64 {
	t.mu.Lock()
	defer t.mu.Unlock()
	st := t.overflow[requestedModel]
	if st == nil || st.totalCount == 0 {
		return 0
	}
	return float64(st.overflowCount) / float64(st.totalCount)
}

// OverflowLease is a sticky overflow assignment for one requested_model (PRD §22).
type OverflowLease struct {
	RequestedModel string
	Candidate      model.ResolvedRouteCandidate
	GrantedAt      time.Time
	ExpiresAt      time.Time
}

// LeaseStore holds process-local leases (PRD §7 / §22).
type LeaseStore struct {
	mu     sync.RWMutex
	leases map[string]*OverflowLease // requested_model → lease
}

// GlobalLeases is the singleton lease store.
var GlobalLeases = &LeaseStore{leases: make(map[string]*OverflowLease)}

// GetValidOverflowLease returns lease if not expired (PRD §10.3 / §22).
func (s *LeaseStore) GetValidOverflowLease(requestedModel string) *OverflowLease {
	s.mu.RLock()
	defer s.mu.RUnlock()
	l := s.leases[requestedModel]
	if l == nil {
		return nil
	}
	if now().After(l.ExpiresAt) {
		return nil
	}
	cp := *l
	return &cp
}

// SetLease stores/replaces lease.
func (s *LeaseStore) SetLease(l *OverflowLease) {
	if l == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.leases[l.RequestedModel] = l
	// role OVERFLOW
	mk := MakeMetricsKey(l.Candidate.ChannelID, l.Candidate.EffectiveModel)
	GlobalRoles.Set(mk, model.RoleOverflow)
}

// ClearLease removes lease for model.
func (s *LeaseStore) ClearLease(requestedModel string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if old, ok := s.leases[requestedModel]; ok {
		mk := MakeMetricsKey(old.Candidate.ChannelID, old.Candidate.EffectiveModel)
		if GlobalRoles.Get(mk) == model.RoleOverflow {
			GlobalRoles.Set(mk, model.RoleNone)
		}
		delete(s.leases, requestedModel)
	}
}

// ClearAll drops all leases (tests).
func (s *LeaseStore) ClearAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.leases = make(map[string]*OverflowLease)
}

// SelectOverflowCandidates filters + sorts overflow candidates (PRD §21).
func SelectOverflowCandidates(
	all []model.ResolvedRouteCandidate,
	primary *model.ResolvedRouteCandidate,
) []model.ResolvedRouteCandidate {
	var out []model.ResolvedRouteCandidate
	for _, c := range all {
		if primary != nil && c.ChannelID == primary.ChannelID {
			continue
		}
		st := candidateState(c)
		if st != model.RouteHealthy && st != model.RouteRecovering {
			continue
		}
		if IsInCooldown(c.Metrics) {
			continue
		}
		mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
		if !GlobalConcurrency.HasCapacity(mk) {
			continue
		}
		out = append(out, c)
	}
	// sort: manual_priority → reliability → estimated TTFT → stream interrupt → capacity → last success
	sortOverflow(out)
	return out
}

func sortOverflow(cands []model.ResolvedRouteCandidate) {
	// reuse stable sort with multi-key comparison
	type keyed struct {
		c model.ResolvedRouteCandidate
	}
	// manual sort via slice stable using comparator
	// implement with sort.SliceStable inlined below
	less := func(i, j int) bool {
		a, b := cands[i], cands[j]
		if a.ManualPriority != b.ManualPriority {
			return a.ManualPriority > b.ManualPriority
		}
		ra, rb := f64or(nilSafeSuccess(a), 0), f64or(nilSafeSuccess(b), 0)
		if ra != rb {
			return ra > rb
		}
		ta, tb := estimatedTTFTMs(a), estimatedTTFTMs(b)
		if ta != tb {
			return ta < tb
		}
		sa, sb := f64or(nilSafeStream(a), 0), f64or(nilSafeStream(b), 0)
		if sa != sb {
			return sa < sb
		}
		// remaining capacity: more remaining first; unlimited (-1) wins
		rema := GlobalConcurrency.Remaining(MakeMetricsKey(a.ChannelID, a.EffectiveModel))
		remb := GlobalConcurrency.Remaining(MakeMetricsKey(b.ChannelID, b.EffectiveModel))
		// normalize unlimited as large
		if rema < 0 {
			rema = 1_000_000
		}
		if remb < 0 {
			remb = 1_000_000
		}
		if rema != remb {
			return rema > remb
		}
		la, lb := lastSuccessUnix(a), lastSuccessUnix(b)
		if la != lb {
			return la > lb
		}
		return a.ChannelID < b.ChannelID
	}
	// local sort
	for i := 0; i < len(cands); i++ {
		for j := i + 1; j < len(cands); j++ {
			if less(j, i) {
				cands[i], cands[j] = cands[j], cands[i]
			}
		}
	}
}

func nilSafeSuccess(c model.ResolvedRouteCandidate) *float64 {
	if c.Metrics == nil {
		return nil
	}
	return c.Metrics.ProductionSuccessEMA
}
func nilSafeStream(c model.ResolvedRouteCandidate) *float64 {
	if c.Metrics == nil {
		return nil
	}
	return c.Metrics.StreamInterruptionEMA
}
func estimatedTTFTMs(c model.ResolvedRouteCandidate) float64 {
	if c.Metrics == nil {
		return DefaultTargetTTFTMs
	}
	if c.Metrics.ProductionTTFTEMAMs != nil {
		return *c.Metrics.ProductionTTFTEMAMs
	}
	return DefaultTargetTTFTMs
}
func lastSuccessUnix(c model.ResolvedRouteCandidate) int64 {
	if c.Metrics == nil || c.Metrics.LastSuccessAt == nil {
		return 0
	}
	return *c.Metrics.LastSuccessAt
}

// EnsureOverflowLease creates or renews sticky lease when primary is full (PRD §22).
func EnsureOverflowLease(
	requestedModel string,
	primary *model.ResolvedRouteCandidate,
	candidates []model.ResolvedRouteCandidate,
) *OverflowLease {
	if primary == nil {
		return nil
	}
	primaryKey := MakeMetricsKey(primary.ChannelID, primary.EffectiveModel)
	if GlobalConcurrency.HasCapacity(primaryKey) {
		// primary not full — no need for new lease (existing may still be valid)
		return GlobalLeases.GetValidOverflowLease(requestedModel)
	}

	existing := GlobalLeases.GetValidOverflowLease(requestedModel)
	duration := time.Duration(model.DefaultOverflowLeaseDurationSec) * time.Second
	minHold := time.Duration(model.DefaultOverflowLeaseMinHoldSec) * time.Second

	if existing != nil {
		// sticky renew / switch decision (PRD §22.1)
		if shouldKeepLease(existing, candidates, minHold) {
			// renew
			existing.ExpiresAt = now().Add(duration)
			GlobalLeases.SetLease(existing)
			return existing
		}
	}

	ov := SelectOverflowCandidates(candidates, primary)
	if len(ov) == 0 {
		return existing // may be nil
	}
	// if existing still in min hold and new not significantly better, keep
	if existing != nil && now().Sub(existing.GrantedAt) < minHold {
		if !isSignificantlyBetter(ov[0], existing.Candidate) {
			existing.ExpiresAt = now().Add(duration)
			GlobalLeases.SetLease(existing)
			return existing
		}
	}

	lease := &OverflowLease{
		RequestedModel: requestedModel,
		Candidate:      ov[0],
		GrantedAt:      now(),
		ExpiresAt:      now().Add(duration),
	}
	GlobalLeases.SetLease(lease)
	return lease
}

func shouldKeepLease(existing *OverflowLease, candidates []model.ResolvedRouteCandidate, minHold time.Duration) bool {
	if existing == nil {
		return false
	}
	c := existing.Candidate
	st := candidateState(c)
	if st != model.RouteHealthy && st != model.RouteRecovering {
		return false
	}
	if IsInCooldown(c.Metrics) {
		return false
	}
	mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
	if !GlobalConcurrency.HasCapacity(mk) {
		return false
	}
	// within min hold always keep if healthy
	if now().Sub(existing.GrantedAt) < minHold {
		return true
	}
	// check if any candidate significantly better
	for _, alt := range candidates {
		if alt.ChannelID == c.ChannelID {
			continue
		}
		if isSignificantlyBetter(alt, c) {
			return false
		}
	}
	return true
}

// isSignificantlyBetter uses experience_score improvement ≥ 20% (PRD §22.1 / §33).
func isSignificantlyBetter(candidate, current model.ResolvedRouteCandidate) bool {
	cs := experienceOf(candidate)
	cu := experienceOf(current)
	if cu <= 0 {
		return cs > 0
	}
	return cs >= cu*(1.0+model.DefaultOverflowSwitchImprovement)
}

// BuildProductionCandidateChainWithLease extends chain: Primary → Lease → remaining (PRD §10.3).
func BuildProductionCandidateChainWithLease(requestedModel string) ([]model.ResolvedRouteCandidate, error) {
	plan, err := GetOrBuildRoutePlan(requestedModel)
	if err != nil {
		return nil, err
	}
	all, err := BuildAllCandidatesForRequestedModel(requestedModel)
	if err != nil {
		return nil, err
	}
	SortCandidatesForProduction(all)

	// ensure lease if primary full
	if plan.Primary != nil {
		_ = EnsureOverflowLease(requestedModel, plan.Primary, all)
	}

	var out []model.ResolvedRouteCandidate
	var leaseCand *model.ResolvedRouteCandidate
	if plan.Primary != nil {
		out = append(out, *plan.Primary)
	}
	if lease := GlobalLeases.GetValidOverflowLease(requestedModel); lease != nil {
		lc := lease.Candidate
		// skip if same as primary
		if plan.Primary == nil || lc.ChannelID != plan.Primary.ChannelID {
			out = append(out, lc)
			leaseCand = &lc
		}
	}
	rest := RemainingCandidatesExcluding(all, plan.Primary, leaseCand)
	// keep only productive for normal chain
	for _, c := range rest {
		st := candidateState(c)
		if st == model.RouteHealthy || st == model.RouteRecovering || st == model.RouteUnknown {
			out = append(out, c)
		}
	}
	return DeduplicateCandidates(out), nil
}
