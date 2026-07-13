package modelroute

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
)

// PruneOptions controls orphan policy/metrics cleanup.
type PruneOptions struct {
	DryRun  bool
	Sources []string // empty => configured + mapped
}

// PrunePolicyKey is an orphan policy identity for audit/dry-run.
type PrunePolicyKey struct {
	ChannelID      int64  `json:"channel_id"`
	RequestedModel string `json:"requested_model"`
	Source         string `json:"source,omitempty"`
}

// PruneMetricsKey is an orphan metrics identity for audit/dry-run.
type PruneMetricsKey struct {
	ChannelID      int64  `json:"channel_id"`
	EffectiveModel string `json:"effective_model"`
}

// PruneResult summarizes one prune run.
type PruneResult struct {
	PoliciesDeleted int              `json:"policies_deleted"`
	MetricsDeleted  int              `json:"metrics_deleted"`
	PolicyKeys      []PrunePolicyKey `json:"policy_keys,omitempty"`
	MetricsKeys     []PruneMetricsKey `json:"metrics_keys,omitempty"`
}

func defaultPrunableSources() map[string]struct{} {
	return map[string]struct{}{
		model.PolicySourceConfigured: {},
		model.PolicySourceMapped:     {},
	}
}

func prunableSourceSet(sources []string) map[string]struct{} {
	if len(sources) == 0 {
		return defaultPrunableSources()
	}
	out := make(map[string]struct{}, len(sources))
	for _, s := range sources {
		s = strings.TrimSpace(strings.ToLower(s))
		if s == "" {
			continue
		}
		out[s] = struct{}{}
	}
	if len(out) == 0 {
		return defaultPrunableSources()
	}
	return out
}

func (r *PruneResult) merge(other PruneResult) {
	if r == nil {
		return
	}
	r.PoliciesDeleted += other.PoliciesDeleted
	r.MetricsDeleted += other.MetricsDeleted
	r.PolicyKeys = append(r.PolicyKeys, other.PolicyKeys...)
	r.MetricsKeys = append(r.MetricsKeys, other.MetricsKeys...)
}

// PruneOrphanPoliciesForChannel deletes configured/mapped policies no longer declared
// by the channel models/mapping, then metrics no longer reachable from remaining policies.
func PruneOrphanPoliciesForChannel(ch *model.Channel, opts PruneOptions) (PruneResult, error) {
	var res PruneResult
	if ch == nil || ch.Id <= 0 {
		return res, nil
	}
	channelID := int64(ch.Id)
	aliveReq := make(map[string]struct{})
	for _, p := range DiscoverFromChannel(ch) {
		if p.RequestedModel == "" {
			continue
		}
		aliveReq[p.RequestedModel] = struct{}{}
	}
	prunable := prunableSourceSet(opts.Sources)

	policies, err := model.ListChannelModelPoliciesByChannel(channelID)
	if err != nil {
		return res, err
	}

	deletedRequested := make([]string, 0)
	for i := range policies {
		p := policies[i]
		if _, ok := aliveReq[p.RequestedModel]; ok {
			continue
		}
		src := strings.TrimSpace(strings.ToLower(p.Source))
		if _, ok := prunable[src]; !ok {
			continue
		}
		res.PolicyKeys = append(res.PolicyKeys, PrunePolicyKey{
			ChannelID:      channelID,
			RequestedModel: p.RequestedModel,
			Source:         p.Source,
		})
		if opts.DryRun {
			res.PoliciesDeleted++
			continue
		}
		if err := model.DeleteChannelModelPolicy(channelID, p.RequestedModel); err != nil {
			return res, err
		}
		res.PoliciesDeleted++
		deletedRequested = append(deletedRequested, p.RequestedModel)
	}

	// Remaining policies after prune (re-list unless dry-run: simulate by filtering).
	mappingJSON := ch.GetModelMapping()
	aliveEff := make(map[string]struct{})
	if opts.DryRun {
		for i := range policies {
			p := policies[i]
			willDelete := false
			if _, ok := aliveReq[p.RequestedModel]; !ok {
				src := strings.TrimSpace(strings.ToLower(p.Source))
				if _, ok := prunable[src]; ok {
					willDelete = true
				}
			}
			if willDelete {
				continue
			}
			eff := resolvePolicyEffectiveModelLocal(p.RequestedModel, mappingJSON)
			if eff != "" {
				aliveEff[eff] = struct{}{}
			}
		}
	} else {
		remaining, err := model.ListChannelModelPoliciesByChannel(channelID)
		if err != nil {
			return res, err
		}
		for i := range remaining {
			eff := resolvePolicyEffectiveModelLocal(remaining[i].RequestedModel, mappingJSON)
			if eff != "" {
				aliveEff[eff] = struct{}{}
			}
		}
	}

	metricsRows, err := model.ListChannelModelMetricsByChannel(channelID)
	if err != nil {
		return res, err
	}
	for i := range metricsRows {
		eff := metricsRows[i].EffectiveModel
		if _, ok := aliveEff[eff]; ok {
			continue
		}
		res.MetricsKeys = append(res.MetricsKeys, PruneMetricsKey{
			ChannelID:      channelID,
			EffectiveModel: eff,
		})
		if opts.DryRun {
			res.MetricsDeleted++
			continue
		}
		if err := model.DeleteChannelModelMetrics(channelID, eff); err != nil {
			return res, err
		}
		res.MetricsDeleted++
	}

	if !opts.DryRun {
		for _, req := range deletedRequested {
			InvalidateRoutePlan(req)
		}
	}
	return res, nil
}

func resolvePolicyEffectiveModelLocal(requestedModel, modelMappingJSON string) string {
	effective, _, err := ResolveEffectiveModel(requestedModel, modelMappingJSON)
	if err != nil || effective == "" {
		return requestedModel
	}
	return effective
}

// PruneOrphanPoliciesAll prunes every channel.
func PruneOrphanPoliciesAll(opts PruneOptions) (PruneResult, error) {
	var res PruneResult
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		return res, err
	}
	for _, ch := range channels {
		if ch == nil {
			continue
		}
		part, err := PruneOrphanPoliciesForChannel(ch, opts)
		if err != nil {
			return res, err
		}
		res.merge(part)
	}
	return res, nil
}
