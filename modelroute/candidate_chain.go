package modelroute

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ChannelModelMappingProvider supplies model_mapping JSON for a channel.
// Tests inject a stub; production uses DefaultChannelMappingProvider.
type ChannelModelMappingProvider func(channelID int64) (string, error)

// DefaultChannelMappingProvider loads mapping from channel cache/DB.
var DefaultChannelMappingProvider ChannelModelMappingProvider = func(channelID int64) (string, error) {
	if common.MemoryCacheEnabled {
		ch, err := model.CacheGetChannel(int(channelID))
		if err == nil && ch != nil {
			return ch.GetModelMapping(), nil
		}
	}
	ch, err := model.GetChannelById(int(channelID), true)
	if err != nil {
		return "", err
	}
	if ch == nil {
		return "", nil
	}
	return ch.GetModelMapping(), nil
}

// MappingProvider is the active provider (override in tests).
var MappingProvider = DefaultChannelMappingProvider

// BuildResolvedCandidate composes Policy + shared Metrics for one requested_model (PRD §10.1 / §10.2).
// ManualPriority always comes from Policy, never reverse-looked up from Metrics.
func BuildResolvedCandidate(policy *model.ChannelModelPolicy, metrics *model.ChannelModelMetrics, effectiveModel string) model.ResolvedRouteCandidate {
	pk := MakePolicyKey(policy.ChannelID, policy.RequestedModel)
	mk := MakeMetricsKey(policy.ChannelID, effectiveModel)
	return model.ResolvedRouteCandidate{
		PolicyKey:      pk.String(),
		MetricsKey:     mk.String(),
		ChannelID:      policy.ChannelID,
		RequestedModel: policy.RequestedModel,
		EffectiveModel: effectiveModel,
		ManualPriority: policy.ManualPriority,
		Metrics:        metrics,
	}
}

// ResolveCandidateFromPolicy loads mapping + metrics and builds a ResolvedRouteCandidate.
func ResolveCandidateFromPolicy(policy *model.ChannelModelPolicy) (model.ResolvedRouteCandidate, error) {
	if policy == nil {
		return model.ResolvedRouteCandidate{}, errNilPolicy
	}
	mappingJSON, err := MappingProvider(policy.ChannelID)
	if err != nil {
		// mapping load failure: fall back to identity mapping
		mappingJSON = ""
	}
	mk, effective, err := ResolveMetricsKeyFromPolicy(policy, mappingJSON)
	if err != nil {
		return model.ResolvedRouteCandidate{}, err
	}
	metrics, err := model.EnsureChannelModelMetrics(mk.ChannelID, mk.EffectiveModel)
	if err != nil {
		return model.ResolvedRouteCandidate{}, err
	}
	return BuildResolvedCandidate(policy, metrics, effective), nil
}

var errNilPolicy = errString("nil channel model policy")

type errString string

func (e errString) Error() string { return string(e) }

// ListEnabledPoliciesForRequestedModel returns enabled policies for a model.
func ListEnabledPoliciesForRequestedModel(requestedModel string) ([]model.ChannelModelPolicy, error) {
	rows, err := model.ListChannelModelPoliciesByRequestedModel(requestedModel)
	if err != nil {
		return nil, err
	}
	out := make([]model.ChannelModelPolicy, 0, len(rows))
	for _, r := range rows {
		if r.Enabled {
			out = append(out, r)
		}
	}
	return out, nil
}

// BuildAllCandidatesForRequestedModel resolves every enabled policy into candidates (PRD §10.3 input side).
func BuildAllCandidatesForRequestedModel(requestedModel string) ([]model.ResolvedRouteCandidate, error) {
	policies, err := ListEnabledPoliciesForRequestedModel(requestedModel)
	if err != nil {
		return nil, err
	}
	cands := make([]model.ResolvedRouteCandidate, 0, len(policies))
	for i := range policies {
		c, err := ResolveCandidateFromPolicy(&policies[i])
		if err != nil {
			continue
		}
		cands = append(cands, c)
	}
	return DeduplicateCandidates(cands), nil
}

// DeduplicateCandidates keeps first occurrence per channel_id for the same requested_model (PRD §10.3).
func DeduplicateCandidates(cands []model.ResolvedRouteCandidate) []model.ResolvedRouteCandidate {
	if len(cands) <= 1 {
		return cands
	}
	seen := make(map[int64]struct{}, len(cands))
	out := make([]model.ResolvedRouteCandidate, 0, len(cands))
	for _, c := range cands {
		if _, ok := seen[c.ChannelID]; ok {
			continue
		}
		seen[c.ChannelID] = struct{}{}
		out = append(out, c)
	}
	return out
}

// SortCandidatesByManualPriority sorts descending manual_priority, then channel_id asc for stability.
func SortCandidatesByManualPriority(cands []model.ResolvedRouteCandidate) {
	sort.SliceStable(cands, func(i, j int) bool {
		if cands[i].ManualPriority != cands[j].ManualPriority {
			return cands[i].ManualPriority > cands[j].ManualPriority
		}
		return cands[i].ChannelID < cands[j].ChannelID
	})
}

// candidateState returns RouteState for sorting / primary selection.
func candidateState(c model.ResolvedRouteCandidate) model.RouteState {
	if c.Metrics == nil {
		return model.RouteUnknown
	}
	return c.Metrics.State()
}

// stateRank for plan building: HEALTHY < RECOVERING < UNKNOWN < others.
func stateRank(s model.RouteState) int {
	switch s {
	case model.RouteHealthy:
		return 0
	case model.RouteRecovering:
		return 1
	case model.RouteUnknown:
		return 2
	case model.RouteProbing:
		return 3
	default:
		return 10
	}
}

// SortCandidatesForProduction sorts by hard state then manual_priority then experience score (PRD §10.5 / §6).
func SortCandidatesForProduction(cands []model.ResolvedRouteCandidate) {
	sort.SliceStable(cands, func(i, j int) bool {
		ri, rj := stateRank(candidateState(cands[i])), stateRank(candidateState(cands[j]))
		if ri != rj {
			return ri < rj
		}
		if cands[i].ManualPriority != cands[j].ManualPriority {
			return cands[i].ManualPriority > cands[j].ManualPriority
		}
		si, sj := experienceOf(cands[i]), experienceOf(cands[j])
		if si != sj {
			return si > sj
		}
		return cands[i].ChannelID < cands[j].ChannelID
	})
}

func experienceOf(c model.ResolvedRouteCandidate) float64 {
	if c.Metrics == nil || c.Metrics.ExperienceScore == nil {
		return 0
	}
	return *c.Metrics.ExperienceScore
}

// BuildRoutePlanFromPolicies builds Primary + OverflowChain from DB policies (P2 foundation for §10.4).
// Primary = first production-sortable candidate that is HEALTHY/RECOVERING/UNKNOWN; rest form OverflowChain.
// Lease / role assignment is process-local and refined in P3–P7.
func BuildRoutePlanFromPolicies(requestedModel string) (*model.RoutePlan, error) {
	cands, err := BuildAllCandidatesForRequestedModel(requestedModel)
	if err != nil {
		return nil, err
	}
	SortCandidatesForProduction(cands)
	plan := &model.RoutePlan{RequestedModel: requestedModel}
	if len(cands) == 0 {
		return plan, nil
	}
	// pick first non-excluded as primary candidate
	for i := range cands {
		st := candidateState(cands[i])
		if st == model.RouteManuallyDisabled || st == model.RouteOpen || st == model.RouteRateLimited {
			continue
		}
		primary := cands[i]
		plan.Primary = &primary
		for j := range cands {
			if j == i {
				continue
			}
			stj := candidateState(cands[j])
			if stj == model.RouteManuallyDisabled {
				continue
			}
			cp := cands[j]
			plan.OverflowChain = append(plan.OverflowChain, &cp)
		}
		return plan, nil
	}
	// all excluded: no primary, overflow keeps non-disabled for emergency later
	for i := range cands {
		if candidateState(cands[i]) == model.RouteManuallyDisabled {
			continue
		}
		cp := cands[i]
		plan.OverflowChain = append(plan.OverflowChain, &cp)
	}
	return plan, nil
}

// BuildProductionCandidateChain builds the ordered production try-list (PRD §10.3).
// P2 implements: Primary → OverflowChain (lease wiring lands in P7).
func BuildProductionCandidateChain(requestedModel string) ([]model.ResolvedRouteCandidate, error) {
	plan, err := GetOrBuildRoutePlan(requestedModel)
	if err != nil {
		return nil, err
	}
	var out []model.ResolvedRouteCandidate
	if plan.Primary != nil {
		out = append(out, *plan.Primary)
	}
	for _, c := range plan.OverflowChain {
		if c == nil {
			continue
		}
		out = append(out, *c)
	}
	return DeduplicateCandidates(out), nil
}

// RemainingCandidatesExcluding filters chain excluding primary + lease target keys (PRD §10.3).
func RemainingCandidatesExcluding(
	all []model.ResolvedRouteCandidate,
	primary *model.ResolvedRouteCandidate,
	leaseTarget *model.ResolvedRouteCandidate,
) []model.ResolvedRouteCandidate {
	exclude := make(map[int64]struct{})
	if primary != nil {
		exclude[primary.ChannelID] = struct{}{}
	}
	if leaseTarget != nil {
		exclude[leaseTarget.ChannelID] = struct{}{}
	}
	out := make([]model.ResolvedRouteCandidate, 0, len(all))
	for _, c := range all {
		if _, ok := exclude[c.ChannelID]; ok {
			continue
		}
		out = append(out, c)
	}
	return out
}

// NormalizeRequestedModel trims and rejects empty.
func NormalizeRequestedModel(name string) string {
	return strings.TrimSpace(name)
}
