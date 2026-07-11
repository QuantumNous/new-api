package modelroute

import (
	"github.com/QuantumNous/new-api/model"
)

// ColdStart picks BOOTSTRAP candidate when no PRIMARY/HEALTHY/RECOVERING (PRD §11).
// Returns candidates ordered by manual_priority among UNKNOWN (and other productive unknowns).
func SelectColdStartCandidates(cands []model.ResolvedRouteCandidate) []model.ResolvedRouteCandidate {
	var unknown []model.ResolvedRouteCandidate
	for _, c := range cands {
		if candidateState(c) == model.RouteUnknown && IsProductiveState(model.RouteUnknown) {
			unknown = append(unknown, c)
		}
	}
	SortCandidatesByManualPriority(unknown)
	return unknown
}

// HasStableProductionAnchor reports whether any candidate is already Primary-worthy healthy traffic.
func HasStableProductionAnchor(cands []model.ResolvedRouteCandidate) bool {
	for _, c := range cands {
		st := candidateState(c)
		if st == model.RouteHealthy || st == model.RouteRecovering {
			return true
		}
		if GlobalRoles.Get(MakeMetricsKey(c.ChannelID, c.EffectiveModel)) == model.RolePrimary {
			return true
		}
	}
	return false
}

// AssignBootstrapRole marks the first cold-start candidate as BOOTSTRAP (PRD §11).
func AssignBootstrapRole(c *model.ResolvedRouteCandidate) {
	if c == nil || c.Metrics == nil {
		return
	}
	mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
	GlobalRoles.Set(mk, model.RoleBootstrap)
}

// PromoteToPrimary sets Role=PRIMARY after successful production validation (PRD §11 / §8.2).
func PromoteToPrimary(c *model.ResolvedRouteCandidate) {
	if c == nil {
		return
	}
	mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
	// demote previous primary for this requested model is plan-level; here only set this key
	GlobalRoles.Set(mk, model.RolePrimary)
	if c.Metrics != nil && c.Metrics.State() == model.RouteUnknown {
		ApplyTransition(c.Metrics, EventProductionSuccess, 0)
	}
}

// BuildTryListForRequest returns ordered try list for one request (P4 + P7 §10/§11/§22).
// Healthy path uses Primary → Overflow Lease → remaining; cold start uses UNKNOWN by priority.
func BuildTryListForRequest(requestedModel string) ([]model.ResolvedRouteCandidate, bool, error) {
	chain, err := BuildProductionCandidateChainWithLease(requestedModel)
	if err != nil {
		return nil, false, err
	}
	if len(chain) == 0 {
		return nil, false, nil
	}
	if HasStableProductionAnchor(chain) || (chain[0].Metrics != nil &&
		(chain[0].Metrics.State() == model.RouteHealthy || chain[0].Metrics.State() == model.RouteRecovering)) {
		return chain, false, nil
	}
	unknown := SelectColdStartCandidates(chain)
	if len(unknown) == 0 {
		return chain, false, nil
	}
	AssignBootstrapRole(&unknown[0])
	return unknown, true, nil
}
