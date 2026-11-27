package model

import (
	"slices"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
)

var filterEvalOrder = []dto.ChannelFilterKind{
	dto.FilterRequestPath,
	dto.FilterTaskPluginEndpoint,
	dto.FilterTaskPluginIdentity,
	dto.FilterResponsesWebSocket,
}

// ChannelSatisfiesFilters reports whether ch passes every filter.
// On false, it returns the first violated filter in filterEvalOrder for error
// attribution.
func ChannelSatisfiesFilters(ch *Channel, modelName string, filters []dto.ChannelFilter) (bool, dto.ChannelFilterKind) {
	if ch == nil {
		return false, ""
	}
	for _, kind := range filterEvalOrder {
		for _, filter := range filters {
			if filter.Kind != kind {
				continue
			}
			if !channelMatchesFilter(ch, modelName, filter) {
				return false, kind
			}
		}
	}
	return true, ""
}

// filterCandidateIDs applies filters to a cached candidate id list.
// Caller must hold channelSyncLock (read lock). The input slice is never mutated.
// A missing id in channelsIDM is kept for request_path (downstream consistency
// error) and dropped for the other filters.
func filterCandidateIDs(ids []int, modelName string, filters []dto.ChannelFilter) (kept []int, emptiedBy dto.ChannelFilterKind) {
	if len(ids) == 0 {
		return ids, ""
	}
	kept = ids
	for _, kind := range filterEvalOrder {
		kindFilters := filtersByKind(filters, kind)
		if len(kindFilters) == 0 {
			continue
		}
		next := make([]int, 0, len(kept))
		for _, id := range kept {
			channel, exists := channelsIDM[id]
			if candidatePassesKindFilters(channel, exists, modelName, kind, kindFilters) {
				next = append(next, id)
			}
		}
		if len(kept) > 0 && len(next) == 0 {
			return next, kind
		}
		kept = next
	}
	return kept, ""
}

func filtersByKind(filters []dto.ChannelFilter, kind dto.ChannelFilterKind) []dto.ChannelFilter {
	var matched []dto.ChannelFilter
	for _, filter := range filters {
		if filter.Kind == kind {
			matched = append(matched, filter)
		}
	}
	return matched
}

func candidatePassesKindFilters(ch *Channel, exists bool, modelName string, kind dto.ChannelFilterKind, filters []dto.ChannelFilter) bool {
	if kind == dto.FilterRequestPath && !exists {
		return true
	}
	if !exists || ch == nil {
		return false
	}
	for _, filter := range filters {
		if !channelMatchesFilter(ch, modelName, filter) {
			return false
		}
	}
	return true
}

func channelMatchesFilter(ch *Channel, modelName string, filter dto.ChannelFilter) bool {
	switch filter.Kind {
	case dto.FilterRequestPath:
		if filter.RequestPath == "" {
			return true
		}
		if !constant.IsAdvancedCustomChannel(ch.Type) {
			return true
		}
		config := ch.GetOtherSettings().AdvancedCustom
		return config != nil && config.SupportsPathForModel(filter.RequestPath, modelName)
	case dto.FilterTaskPluginIdentity:
		if filter.TaskPluginKey == "" {
			return ch.Type != constant.ChannelTypeTaskPlugin || providerChannelServes(ch, filter.RequestPath, modelName)
		}
		if ch.Type == constant.ChannelTypeTaskPlugin || ch.Type == constant.ChannelTypeNewAPI {
			// A New API channel serves every plugin it is extended with; the
			// pinned plugin or any shared-model candidate may execute there.
			setting := ch.GetSetting()
			return setting.BindsTaskPlugin(filter.TaskPluginKey) || slices.ContainsFunc(filter.TaskPluginKeys, setting.BindsTaskPlugin)
		}
		return slices.Contains(filter.TaskPluginChannelTypes, ch.Type)
	case dto.FilterTaskPluginEndpoint:
		pluginChannel := slices.Contains(filter.TaskPluginChannelTypes, ch.Type)
		if ch.Type == constant.ChannelTypeTaskPlugin || ch.Type == constant.ChannelTypeNewAPI {
			pluginChannel = slices.ContainsFunc(filter.TaskPluginKeys, ch.GetSetting().BindsTaskPlugin)
		}
		relayChannel := ch.Type != constant.ChannelTypeTaskPlugin || providerChannelServes(ch, filter.RequestPath, modelName)
		if filter.TaskPluginRelayOnly {
			return relayChannel && !pluginChannel
		}
		// Ordinary channels and matching plugin channels compete using the same
		// group, priority, weight, affinity, and pin rules. Unrelated type-61
		// plugins cannot execute this endpoint unless their relay routes do.
		return relayChannel || pluginChannel
	case dto.FilterResponsesWebSocket:
		if !ch.GetSetting().ResponsesWebSocketEnabled {
			return false
		}
		switch ch.Type {
		case constant.ChannelTypeOpenAI, constant.ChannelTypeAzure, constant.ChannelTypeCodex, constant.ChannelTypeSub2API, constant.ChannelTypeNewAPI:
			return true
		case constant.ChannelTypeAdvancedCustom:
			// The session forwards native Responses events without protocol
			// conversion, so only a converter-free /v1/responses route qualifies.
			route, ok := ch.GetOtherSettings().AdvancedCustom.MatchPathForModel("/v1/responses", modelName)
			return ok && route.IsNative()
		case constant.ChannelTypeTaskPlugin:
			// The same rule on the relay routes of the channel's plugin.
			plugin, ok := jsplugin.DefaultRegistry.Get(ch.GetSetting().TaskPluginKey)
			return ok && plugin.Meta.ServesResponsesWebSocket(modelName)
		default:
			return false
		}
	default:
		return true
	}
}

// providerChannelServes reports a task plugin channel whose plugin relays
// requestPath for modelName through its relay routes, as an Advanced Custom
// channel with those routes would.
func providerChannelServes(ch *Channel, requestPath, modelName string) bool {
	if ch.Type != constant.ChannelTypeTaskPlugin || requestPath == "" {
		return false
	}
	plugin, ok := jsplugin.DefaultRegistry.Get(ch.GetSetting().TaskPluginKey)
	if !ok || !plugin.Meta.HasProviderPart() {
		return false
	}
	_, ok = plugin.Meta.RelayRoute(requestPath, modelName)
	return ok
}
