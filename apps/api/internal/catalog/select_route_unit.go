package channel

import (
	"errors"
	"math"
	"math/rand/v2"
	"time"

	ratio_setting "github.com/QuantumNous/new-api/internal/catalog/configure_ratio"
	"github.com/QuantumNous/new-api/internal/catalog/routestats"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type SelectedRoute struct {
	RouteId       int // channel_model_routes.id
	Group         string
	Alias         string   // public model alias (== requested model name)
	Channel       *Channel // full channel object
	ChannelId     int
	KeyIndex      int
	Key           string                  // selected API key plaintext (multi-key: by key_index; single key: channel.Key)
	UpstreamModel string                  // mapped upstream model name
	StatsHandle   *routestats.RouteHandle // EWMA stats handle for this route unit
}

// routeCandidate is a normalized candidate for selection.
// Both memory-cache and DB paths produce the same slice of these.
type routeCandidate struct {
	routeId       int
	channelId     int
	keyIndex      int
	upstreamModel string
	staticWeight  int
}

// alias2routes maps alias -> route units (enabled only). Route units are NOT
// group-scoped: a group decides which channels a user may reach, not how traffic
// is split inside an alias. Group eligibility is applied per request by
// filterCandidatesByGroup, which reads the abilities table.
// Built and refreshed under channelSyncLock alongside channelsIDM.
var alias2routes map[string][]routeCandidate

// buildGroupAliasRoutesFromDB loads enabled route units from channel_model_routes
// table and constructs the alias->[]routeCandidate index.
// Caller MUST hold channelSyncLock (write).
func buildGroupAliasRoutesFromDB() {
	alias2routes = make(map[string][]routeCandidate)
	var routes []ChannelModelRoute
	if err := dbx.DB.Where("enabled = ?", true).Find(&routes).Error; err != nil {
		common.SysError("failed to load channel_model_routes: " + err.Error())
		return
	}
	for _, r := range routes {
		alias2routes[r.PublicModelAlias] = append(
			alias2routes[r.PublicModelAlias],
			routeCandidate{
				routeId:       r.Id,
				channelId:     r.ChannelId,
				keyIndex:      r.KeyIndex,
				upstreamModel: r.UpstreamModel,
				staticWeight:  r.StaticWeight,
			},
		)
	}
}

// getCandidatesFromCache returns candidates for the given alias from the memory
// index, restricted to the channels this group may use.
// Caller MUST hold channelSyncLock (read).
func getCandidatesFromCache(group, alias string) []routeCandidate {
	if alias2routes == nil {
		return nil
	}
	return filterCandidatesByGroup(alias2routes[alias], group, alias)
}

// getCandidatesFromDB returns candidates for the given alias from the database,
// restricted to the channels this group may use.
func getCandidatesFromDB(group, alias string) []routeCandidate {
	var routes []ChannelModelRoute
	if err := dbx.DB.Where("public_model_alias = ? AND enabled = ?", alias, true).Find(&routes).Error; err != nil {
		return nil
	}
	candidates := make([]routeCandidate, 0, len(routes))
	for _, r := range routes {
		candidates = append(candidates, routeCandidate{
			routeId:       r.Id,
			channelId:     r.ChannelId,
			keyIndex:      r.KeyIndex,
			upstreamModel: r.UpstreamModel,
			staticWeight:  r.StaticWeight,
		})
	}
	return filterCandidatesByGroup(candidates, group, alias)
}

// filterCandidatesByGroup drops every candidate whose channel does not serve
// (group, alias). This is the group isolation boundary: route units carry no
// group of their own, so a request must never reach a channel its group does not
// grant. It fails CLOSED — an unknown group, an unknown alias, or a missing
// eligibility set yields no candidates rather than all of them.
func filterCandidatesByGroup(candidates []routeCandidate, group, alias string) []routeCandidate {
	if len(candidates) == 0 {
		return nil
	}
	allowed := allowedChannelsForGroupAlias(group, alias)
	if len(allowed) == 0 {
		return nil
	}
	kept := make([]routeCandidate, 0, len(candidates))
	for _, c := range candidates {
		if _, ok := allowed[c.channelId]; ok {
			kept = append(kept, c)
		}
	}
	return kept
}

// allowedChannelsForGroupAlias returns the channel ids that may serve alias for
// group. The abilities table is the authority: it is written from the channel's
// own group and model lists by AddAbilities/UpdateAbilities, it is what the
// pre-route-unit selector used for exactly this decision, and it carries the
// per-model enabled flag that DisableChannelModel flips.
func allowedChannelsForGroupAlias(group, alias string) map[int]struct{} {
	allowed := make(map[int]struct{})
	if group == "" || alias == "" {
		return allowed
	}
	if common.MemoryCacheEnabled {
		// group2model2channels is built from abilities + enabled channels by
		// InitChannelCache. Caller holds channelSyncLock (read) on this path.
		for _, id := range group2model2channels[group][alias] {
			allowed[id] = struct{}{}
		}
		return allowed
	}
	var abilities []Ability
	if err := dbx.DB.Where(dbx.GroupCol()+" = ? AND model = ? AND enabled = ?", group, alias, true).
		Find(&abilities).Error; err != nil {
		common.SysError("failed to load abilities for group eligibility: " + err.Error())
		return allowed
	}
	for _, a := range abilities {
		allowed[a.ChannelId] = struct{}{}
	}
	return allowed
}

// filterCandidatesByChannelStatusAndKey filters candidates by channel status (enabled),
// key availability (multi-key status), and Advanced Custom path filtering.
// Health selectability is NOT applied here: the P2C selector owns the eligible
// set — cooling / hard-disabled units drop out of the duel, and a fully down
// pool takes the faint-recall path (selector_p2c.go).
// Modifies the slice in place and returns the filtered result.
func filterCandidatesByChannelStatusAndKey(candidates []routeCandidate, requestPath, alias string, excludeRoutes map[RouteKey]bool) []routeCandidate {
	if len(candidates) == 0 {
		return candidates
	}

	filtered := make([]routeCandidate, 0, len(candidates))

	if common.MemoryCacheEnabled {
		// Cache-on path is unchanged: read the in-memory index under one read
		// lock. channelsIDM is built by InitChannelCache, and the Advanced Custom
		// config comes from channel2advancedCustomConfig, which caches the parsed
		// JSON built during sync — so no per-request parsing happens here.
		channelSyncLock.RLock()
		defer channelSyncLock.RUnlock()
		for _, c := range candidates {
			channel, ok := channelsIDM[c.channelId]
			if !ok {
				continue // channel not in cache
			}
			if !candidatePassesChannelChecks(channel, c, requestPath, alias, excludeRoutes, channel2advancedCustomConfig[c.channelId]) {
				continue
			}
			filtered = append(filtered, c)
		}
		return filtered
	}

	// Cache disabled: InitChannelCache early-returns, so channelsIDM is never
	// built (and channel2advancedCustomConfig stays empty). Resolve every
	// candidate channel in one bulk query (by unique id) instead of probing the
	// database per candidate, mirroring the cache-off DB reads already used by
	// allowedChannelsForGroupAlias and CacheGetChannel/CacheGetChannelInfo.
	channelIDs := make([]int, 0, len(candidates))
	seenIDs := make(map[int]struct{}, len(candidates))
	for _, c := range candidates {
		if _, dup := seenIDs[c.channelId]; !dup {
			seenIDs[c.channelId] = struct{}{}
			channelIDs = append(channelIDs, c.channelId)
		}
	}
	channels, err := GetChannelsByIds(channelIDs)
	if err != nil {
		common.SysError("failed to load channels for route selection: " + err.Error())
		return filtered
	}
	// Parse each channel's Advanced Custom config exactly once; this is the
	// cache-off equivalent of channel2advancedCustomConfig (built during sync
	// on the cache-on path) and is scoped to this single request only.
	advancedConfig := make(map[int]*dto.AdvancedCustomConfig, len(channels))
	for _, ch := range channels {
		if ch.Type == constant.ChannelTypeAdvancedCustom {
			if config := ch.GetOtherSettings().AdvancedCustom; config != nil {
				advancedConfig[ch.Id] = config
			}
		}
	}
	for _, c := range candidates {
		var channel *Channel
		for _, ch := range channels {
			if ch.Id == c.channelId {
				channel = ch
				break
			}
		}
		if channel == nil {
			continue // channel gone from DB
		}
		if !candidatePassesChannelChecks(channel, c, requestPath, alias, excludeRoutes, advancedConfig[c.channelId]) {
			continue
		}
		filtered = append(filtered, c)
	}
	return filtered
}

// candidatePassesChannelChecks applies the request-path filter for one channel:
// enabled status, multi-key availability, excludeRoutes, and Advanced Custom
// path support. advancedConfig is the pre-parsed Advanced Custom config for the
// channel: on the cache-on path it is the shared channel2advancedCustomConfig
// entry (built during sync, zero per-request parsing); on the cache-off path it
// is parsed once for this request. When nil and the channel is Advanced Custom,
// path filtering is skipped (matches the cache-on missing-entry behavior). The
// caller owns all locking and channel acquisition.
func candidatePassesChannelChecks(channel *Channel, c routeCandidate, requestPath, alias string, excludeRoutes map[RouteKey]bool, advancedConfig *dto.AdvancedCustomConfig) bool {
	if channel.Status != common.ChannelStatusEnabled {
		return false
	}
	// Check key availability
	if !isKeyEnabled(channel, c.keyIndex) {
		return false
	}
	// Exclude routes by RouteKey
	if excludeRoutes != nil {
		if excludeRoutes[RouteKey{ChannelId: c.channelId, KeyIndex: c.keyIndex, Model: alias}] {
			return false
		}
	}
	// Advanced Custom path filtering
	if requestPath != "" && channel.Type == constant.ChannelTypeAdvancedCustom && advancedConfig != nil {
		if !advancedConfig.SupportsPathForModel(requestPath, alias) {
			return false
		}
	}
	return true
}

// isKeyEnabled checks if a specific key index is enabled for the channel.
func isKeyEnabled(channel *Channel, keyIndex int) bool {
	if !channel.ChannelInfo.IsMultiKey {
		return keyIndex == 0
	}
	keys := channel.GetKeys()
	if keyIndex < 0 || keyIndex >= len(keys) {
		return false
	}
	statusList := channel.ChannelInfo.MultiKeyStatusList
	if statusList == nil {
		return true
	}
	if status, ok := statusList[keyIndex]; ok {
		return status == common.ChannelStatusEnabled
	}
	return true // default to enabled if not specified
}

// RouteScore is the full breakdown of one candidate's scheduling score, so an
// admin query can be recomputed by hand: final == base * correction, where
// base == routingBaseWeight(static) * quality * health. The P2C selection
// path no longer consumes this: the struct and scoreCandidates back the
// admin route-unit views only.
type RouteScore struct {
	StaticWeight int
	BaseWeight   float64
	Quality      float64
	Health       float64
	Correction   float64
	Final        float64

	ExpectedShare float64
	ActualShare   float64
	Opportunities int
	Selections    int
}

// scoreCandidates computes the final score of every candidate for one pool.
//
// The score is a product of four bounded terms:
//
//	base_weight  routingBaseWeight(static_weight), so weight 0 stays selectable
//	quality      EWMA synthesis, clamped to [QualityFloor, QualityCeil]; neutral
//	             1.0 until MinSamples observations exist
//	health       unit score: EWMA x slow-start factor, 0 while the unit is
//	             cooling or hard-disabled — the only term that reaches zero
//
// The division of labour matters: quality expresses a continuous preference and
// is floored well above zero, so a badly performing route loses share but never
// leaves the pool. Only the state machine ejects, and it does so by returning a
// zero health multiplier.
//
// The returned targets map is the base-score share of each candidate. The P2C
// selection path does not consume these values: the map and the correction
// term back the admin route-unit views, where the share window is fed by
// direct RecordSelection calls, not by selections.
func scoreCandidates(pool routestats.PoolKey, candidates []routeCandidate, alias string) (map[routestats.RouteID]RouteScore, map[routestats.RouteID]float64) {
	cfg := routestats.GetRouteStatsSetting()
	scores := make(map[routestats.RouteID]RouteScore, len(candidates))
	targets := make(map[routestats.RouteID]float64, len(candidates))

	var baseTotal float64
	for _, c := range candidates {
		id := routestats.RouteID{ChannelID: c.channelId, KeyIndex: c.keyIndex, UpstreamModel: c.upstreamModel}
		health := UnitHealthScore(RouteKey{ChannelId: c.channelId, KeyIndex: c.keyIndex, Model: alias}, ChannelHealthNow())
		quality := 1.0
		if cfg != nil && cfg.Enabled {
			if h := routestats.GetHandle(routestats.RouteKey{PublicModelAlias: pool.PublicModelAlias,
				ChannelID:     c.channelId,
				KeyIndex:      c.keyIndex,
				UpstreamModel: c.upstreamModel,
			}); h != nil {
				quality = h.Quality().Quality
			}
		}
		baseWeight := float64(routingBaseWeight(c.staticWeight))
		base := baseWeight * quality * health
		// A NaN or negative product would poison the cumulative pick below, where
		// it silently biases every later candidate. Degrade the single bad route to
		// zero instead of failing the whole selection.
		if math.IsNaN(base) || math.IsInf(base, 0) || base < 0 {
			base = 0
		}
		scores[id] = RouteScore{
			StaticWeight: c.staticWeight,
			BaseWeight:   baseWeight,
			Quality:      quality,
			Health:       health,
			Correction:   1.0,
			Final:        base,
		}
		if base > 0 {
			targets[id] = base
			baseTotal += base
		}
	}

	if baseTotal <= 0 {
		return scores, map[routestats.RouteID]float64{}
	}
	for id, base := range targets {
		targets[id] = base / baseTotal
	}

	for id, corr := range routestats.Corrections(pool, targets, cfg) {
		s := scores[id]
		s.Correction = corr.Correction
		s.ExpectedShare = corr.ExpectedShare
		s.ActualShare = corr.ActualShare
		s.Opportunities = corr.Opportunities
		s.Selections = corr.Selections
		final := s.Final * corr.Correction
		if math.IsNaN(final) || math.IsInf(final, 0) || final < 0 {
			final = 0
		}
		s.Final = final
		scores[id] = s
	}
	return scores, targets
}

// SelectRouteUnit is the unified entry point for route unit selection.
// It simultaneously determines channel, key, and upstream model.
// rnd is a deterministic random source; nil uses the goroutine-safe math/rand/v2 global source.
func SelectRouteUnit(group string, alias string, requestPath string, retry int, excludeRoutes map[RouteKey]bool, rnd *rand.Rand) (*SelectedRoute, error) {
	// The retry parameter in the old priority-tier system drove tier descent.
	// In the new flat route-unit model, there are no priority tiers — all enabled
	// route units for the (group, alias) compete directly. The retry parameter
	// is retained for API compatibility but has no effect on selection.
	_ = retry

	var candidates []routeCandidate
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		candidates = getCandidatesFromCache(group, alias)
		channelSyncLock.RUnlock()
	} else {
		candidates = getCandidatesFromDB(group, alias)
	}

	// Normalize alias: try exact match first, then normalized model name
	if len(candidates) == 0 {
		normalizedAlias := ratio_setting.FormatMatchingModelName(alias)
		if normalizedAlias != alias {
			if common.MemoryCacheEnabled {
				channelSyncLock.RLock()
				candidates = getCandidatesFromCache(group, normalizedAlias)
				channelSyncLock.RUnlock()
			} else {
				candidates = getCandidatesFromDB(group, normalizedAlias)
			}
		}
	}

	if len(candidates) == 0 {
		return nil, nil
	}

	// Filter by channel status, key availability, excludeRoutes, and path
	candidates = filterCandidatesByChannelStatusAndKey(candidates, requestPath, alias, excludeRoutes)
	if len(candidates) == 0 {
		return nil, nil
	}

	// P2C duel (mono selector port): sample by the effective prior (static
	// weight × slow-start ramp), then decide by the posterior likelihood.
	// Cooling or hard-disabled units are not eligible; with the whole
	// pool down, faintRecall force-recalls the shortest-remaining unit.
	selected := selectP2C(candidates, alias, ChannelHealthNow(), rnd)
	if selected == nil {
		return nil, nil
	}

	// Resolve full channel and key. When the memory cache is off, channelsIDM is
	// nil (InitChannelCache early-returns), so fall back to the database — the
	// same source the candidate filter and CacheGetChannel use in cache-off mode.
	var channel *Channel
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		channel = channelsIDM[selected.channelId]
		channelSyncLock.RUnlock()
	} else {
		resolved, err := GetChannelById(selected.channelId, true)
		if err == nil {
			channel = resolved
		}
	}

	if channel == nil {
		return nil, nil
	}

	key, _, err := channel.GetNextEnabledKeyForIndex(selected.keyIndex)
	if err != nil {
		// If the specific key index is not available, fall back to any enabled key
		key, _, _ = channel.GetNextEnabledKey(alias)
	}

	// Create routestats handle for this route unit (per-attempt attribution)
	// RouteKey uses: Group (group), PublicModelAlias (alias = requested alias),
	// ChannelID, KeyIndex, UpstreamModel (from route row, not adapted).
	routeKey := routestats.RouteKey{PublicModelAlias: alias,
		ChannelID:     selected.channelId,
		KeyIndex:      selected.keyIndex,
		UpstreamModel: selected.upstreamModel,
	}
	statsHandle := routestats.GetOrCreateHandle(routeKey)

	return &SelectedRoute{
		RouteId:       selected.routeId,
		Group:         group,
		Alias:         alias,
		Channel:       channel,
		ChannelId:     selected.channelId,
		KeyIndex:      selected.keyIndex,
		Key:           key,
		UpstreamModel: selected.upstreamModel,
		StatsHandle:   statsHandle,
	}, nil
}

// MinCooldownRemainingForModel reports the shortest live cooldown window
// (ms) among the eligible, non-excluded route units of (group, alias) —
// mono's failover-budget "probe the shortest recovery cooldown": the value
// decides whether the relay loop may sleep out a full cooling pool and what
// its 504 Retry-After carries. 0 = nothing cooling (or no units at all,
// e.g. a misconfigured model): the caller must not wait.
//
// The candidate pipeline mirrors SelectRouteUnit exactly — same group
// scoping, same status/key/exclusion filter, same alias normalization — so
// the probe measures the very pool selection will next consult.
func MinCooldownRemainingForModel(group, alias string, exclude map[RouteKey]bool, now time.Time) int64 {
	var candidates []routeCandidate
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		candidates = getCandidatesFromCache(group, alias)
		channelSyncLock.RUnlock()
	} else {
		candidates = getCandidatesFromDB(group, alias)
	}
	if len(candidates) == 0 {
		normalizedAlias := ratio_setting.FormatMatchingModelName(alias)
		if normalizedAlias == alias {
			return 0
		}
		if common.MemoryCacheEnabled {
			channelSyncLock.RLock()
			candidates = getCandidatesFromCache(group, normalizedAlias)
			channelSyncLock.RUnlock()
		} else {
			candidates = getCandidatesFromDB(group, normalizedAlias)
		}
	}
	if len(candidates) == 0 {
		return 0
	}
	candidates = filterCandidatesByChannelStatusAndKey(candidates, "", alias, exclude)

	minRemaining := int64(0)
	for i := range candidates {
		// Health rows are keyed by the requested alias (route.Alias) even
		// when the candidates came from the normalized index — mirror
		// SelectRouteUnit's keying, not the lookup key.
		remaining := CoolingRemainingMs(RouteKey{ChannelId: candidates[i].channelId, KeyIndex: candidates[i].keyIndex, Model: alias}, now)
		if remaining > 0 && (minRemaining == 0 || remaining < minRemaining) {
			minRemaining = remaining
		}
	}
	return minRemaining
}

// GetNextEnabledKeyForIndex returns the key at the specific index if enabled.
// Added to support route-unit selection where key_index is pre-determined.
func (channel *Channel) GetNextEnabledKeyForIndex(keyIndex int) (string, int, *types.NewAPIError) {
	if !channel.ChannelInfo.IsMultiKey {
		if keyIndex == 0 {
			return channel.Key, 0, nil
		}
		return "", 0, types.NewError(errors.New("invalid key index for single-key channel"), types.ErrorCodeChannelNoAvailableKey)
	}
	keys := channel.GetKeys()
	if keyIndex < 0 || keyIndex >= len(keys) {
		return "", 0, types.NewError(errors.New("key index out of range"), types.ErrorCodeChannelNoAvailableKey)
	}
	statusList := channel.ChannelInfo.MultiKeyStatusList
	getStatus := func(idx int) int {
		if statusList == nil {
			return common.ChannelStatusEnabled
		}
		if status, ok := statusList[idx]; ok {
			return status
		}
		return common.ChannelStatusEnabled
	}
	if getStatus(keyIndex) != common.ChannelStatusEnabled {
		return "", 0, types.NewError(errors.New("key at index is disabled"), types.ErrorCodeChannelNoAvailableKey)
	}
	return keys[keyIndex], keyIndex, nil
}

// SelectedRouteFromChannel constructs a SelectedRoute from a specific channel
// for paths that serve real traffic without a P2C draw: channel affinity,
// specific-channel requests and locked replay. Each such request is
// attributed to the route unit's EWMA handle (its outcomes move the unit's
// health/latency scores like any served request), but no share-window
// bookkeeping happens: the share-deficit correction was retired with the
// old scorer, so there is nothing to keep informed.
//
// It picks one enabled key via GetNextEnabledKey(). group is the requesting
// group; it does not scope the route unit (route units are group-free).
func SelectedRouteFromChannel(channel *Channel, alias string, group string) (*SelectedRoute, error) {
	return selectedRouteFromChannel(channel, alias, group)
}

// SelectedRouteForProbe is the same construction for administrative probes
// (channel test, key probe). Probes use the identical attribution: outcomes
// move the route unit's EWMA handle, and nothing else.
func SelectedRouteForProbe(channel *Channel, alias string, group string) (*SelectedRoute, error) {
	return selectedRouteFromChannel(channel, alias, group)
}

func selectedRouteFromChannel(channel *Channel, alias string, group string) (*SelectedRoute, error) {
	if channel == nil {
		return nil, errors.New("channel is nil")
	}
	key, keyIndex, err := channel.GetNextEnabledKey(alias)
	if err != nil {
		return nil, err
	}
	// Locate the route row this (channel, alias) pair corresponds to. Affinity and
	// specific-channel requests bypass weighted random selection, but they still
	// serve a real route unit, so their samples must be attributed to it. Without
	// this lookup the request would either go unattributed or, worse, be charged
	// against a key derived from the alias instead of the route's own upstream
	// model, which is a different route unit entirely.
	upstreamModel := alias
	routeId := 0
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		for _, rc := range alias2routes[alias] {
			if rc.channelId == channel.Id && rc.keyIndex == keyIndex {
				upstreamModel, routeId = rc.upstreamModel, rc.routeId
				break
			}
		}
		channelSyncLock.RUnlock()
	} else {
		var row ChannelModelRoute
		if err := dbx.DB.Where("public_model_alias = ? AND channel_id = ? AND key_index = ? AND enabled = ?",
			alias, channel.Id, keyIndex, true).First(&row).Error; err == nil {
			upstreamModel, routeId = row.UpstreamModel, row.Id
		}
	}

	var statsHandle *routestats.RouteHandle
	if routeId != 0 {
		statsHandle = routestats.GetOrCreateHandle(routestats.RouteKey{PublicModelAlias: alias,
			ChannelID:     channel.Id,
			KeyIndex:      keyIndex,
			UpstreamModel: upstreamModel,
		})
	}

	return &SelectedRoute{
		RouteId:       routeId,
		Group:         group,
		Alias:         alias,
		Channel:       channel,
		ChannelId:     channel.Id,
		KeyIndex:      keyIndex,
		Key:           key,
		UpstreamModel: upstreamModel,
		StatsHandle:   statsHandle,
	}, nil
}
