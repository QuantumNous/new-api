package modelroute

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// DiscoveredModelPair is one channel × requested/effective observation (PRD §5.1).
type DiscoveredModelPair struct {
	ChannelID      int64
	RequestedModel string
	EffectiveModel string
	Source         string
	ManualPriority int
}

// DiscoverFromChannel extracts requested_model sources and effective_model targets from one channel (PRD §5.1 / §5.2).
func DiscoverFromChannel(ch *model.Channel) []DiscoveredModelPair {
	if ch == nil {
		return nil
	}
	channelID := int64(ch.Id)
	priority := int(ch.GetPriority())
	mappingJSON := ch.GetModelMapping()
	modelMap, _ := ParseModelMapping(mappingJSON)

	seenReq := make(map[string]struct{})
	var pairs []DiscoveredModelPair

	add := func(requested, source string) {
		requested = strings.TrimSpace(requested)
		if requested == "" {
			return
		}
		if _, ok := seenReq[requested]; ok {
			return
		}
		seenReq[requested] = struct{}{}
		effective, _, err := ResolveEffectiveModel(requested, mappingJSON)
		if err != nil || effective == "" {
			effective = requested
		}
		src := source
		if modelMap != nil {
			if _, ok := modelMap[requested]; ok && source == model.PolicySourceConfigured {
				src = model.PolicySourceMapped
			}
		}
		pairs = append(pairs, DiscoveredModelPair{
			ChannelID:      channelID,
			RequestedModel: requested,
			EffectiveModel: effective,
			Source:         src,
			ManualPriority: priority,
		})
	}

	for _, m := range ch.GetModels() {
		add(m, model.PolicySourceConfigured)
	}
	// mapping sources even if not listed in models
	for src := range modelMap {
		add(src, model.PolicySourceMapped)
	}
	return pairs
}

// DiscoverAllChannelModels scans all channels (PRD §5.1 migration discovery).
func DiscoverAllChannelModels() ([]DiscoveredModelPair, error) {
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		return nil, err
	}
	var all []DiscoveredModelPair
	for _, ch := range channels {
		if ch == nil || ch.Status != common.ChannelStatusEnabled {
			// include disabled for migration completeness of configured models
			if ch == nil {
				continue
			}
		}
		all = append(all, DiscoverFromChannel(ch)...)
	}
	return all, nil
}

// MaterializeDiscovery writes Policy + Metrics rows for discovered pairs (PRD §4 steps 3–5 / §5).
func MaterializeDiscovery(pairs []DiscoveredModelPair) (policies int, metrics int, err error) {
	for _, p := range pairs {
		if p.RequestedModel == "" || p.ChannelID == 0 {
			continue
		}
		pol, e := model.EnsureChannelModelPolicy(p.ChannelID, p.RequestedModel, p.Source, p.ManualPriority)
		if e != nil {
			return policies, metrics, e
		}
		if pol != nil {
			// if newly ensured with default 0 but discovery has priority, and existing was lazy 0, keep existing
			policies++
		}
		effective := p.EffectiveModel
		if effective == "" {
			effective = p.RequestedModel
		}
		if _, e := model.EnsureChannelModelMetrics(p.ChannelID, effective); e != nil {
			return policies, metrics, e
		}
		metrics++
	}
	return policies, metrics, nil
}

// LazyEnsureForRequest ensures Policy + Metrics for a live request (PRD §5.3).
func LazyEnsureForRequest(channelID int64, requestedModel string, modelMappingJSON string, defaultPriority int) (*model.ChannelModelPolicy, *model.ChannelModelMetrics, string, error) {
	requestedModel = NormalizeRequestedModel(requestedModel)
	if requestedModel == "" {
		return nil, nil, "", errString("empty requested model")
	}
	policy, err := model.EnsureChannelModelPolicy(channelID, requestedModel, model.PolicySourceLazyCreated, defaultPriority)
	if err != nil {
		return nil, nil, "", err
	}
	effective, mapped, err := ResolveEffectiveModel(requestedModel, modelMappingJSON)
	if err != nil {
		return nil, nil, "", err
	}
	if mapped && policy != nil && policy.Source == model.PolicySourceLazyCreated {
		// best-effort source upgrade; ignore error
		_ = model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
			ChannelID:      policy.ChannelID,
			RequestedModel: policy.RequestedModel,
			ManualPriority: policy.ManualPriority,
			Enabled:        policy.Enabled,
			Source:         model.PolicySourceMapped,
			CreatedAt:      policy.CreatedAt,
		})
		policy.Source = model.PolicySourceMapped
	}
	metrics, err := model.EnsureChannelModelMetrics(channelID, effective)
	if err != nil {
		return nil, nil, "", err
	}
	InvalidateRoutePlan(requestedModel)
	return policy, metrics, effective, nil
}
