package service

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	rootdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"gorm.io/gorm"
)

type UpstreamReconcileSummary struct {
	SourcesChecked    int `json:"sources_checked"`
	GroupsChecked     int `json:"groups_checked"`
	EnrollmentQueued  int `json:"enrollment_queued"`
	RoutesActivated   int `json:"routes_activated"`
	RoutesQuarantined int `json:"routes_quarantined"`
	RoutesLongRed     int `json:"routes_long_red"`
	RoutesRetained    int `json:"routes_retained"`
	PrioritiesUpdated int `json:"priorities_updated"`
}

type upstreamRouteCandidate struct {
	source model.UpstreamSource
	group  model.UpstreamGroup
	models []string
}

type managedRouteRankResult struct {
	prioritiesUpdated       int
	cacheRefreshNeeded      bool
	newlyUnservableChannels []int
}

func applyManagedReconcileSideEffects(cacheRefreshNeeded bool, newlyUnservableChannels []int) {
	if cacheRefreshNeeded {
		model.InitChannelCache()
	}
	if len(newlyUnservableChannels) > 0 {
		CloseActiveWebSocketsForChannels(
			newlyUnservableChannels,
			ChannelDisabledCloseReason,
		)
	}
}

func PrepareManagedUpstreamShadows(now time.Time) (UpstreamReconcileSummary, error) {
	var summary UpstreamReconcileSummary
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	sources, err := model.ListUpstreamSources()
	if err != nil {
		return summary, err
	}
	groups, err := model.ListUpstreamGroups()
	if err != nil {
		return summary, err
	}
	routes, err := model.ListUpstreamManagedRoutes()
	if err != nil {
		return summary, err
	}
	summary.SourcesChecked = len(sources)
	summary.GroupsChecked = len(groups)
	if !setting.AutoEnroll {
		return summary, nil
	}
	candidates, err := buildUpstreamRouteCandidates(sources, groups, now, setting)
	if err != nil {
		return summary, err
	}
	summary.EnrollmentQueued, err = enqueueMissingUpstreamEnrollments(
		candidates,
		routes,
		setting,
	)
	return summary, err
}

func ReconcileManagedUpstreams(now time.Time) (UpstreamReconcileSummary, error) {
	var summary UpstreamReconcileSummary
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	if !setting.Enabled {
		return summary, nil
	}
	sources, err := model.ListUpstreamSources()
	if err != nil {
		return summary, err
	}
	groups, err := model.ListUpstreamGroups()
	if err != nil {
		return summary, err
	}
	routes, err := model.ListUpstreamManagedRoutes()
	if err != nil {
		return summary, err
	}
	summary.SourcesChecked = len(sources)
	summary.GroupsChecked = len(groups)
	var routeChanges []string
	cacheRefreshNeeded := false
	var newlyUnservableChannels []int

	sourceByID := make(map[int64]model.UpstreamSource, len(sources))
	for index := range sources {
		source := sources[index]
		if source.Balance != nil {
			low := *source.Balance < source.LowBalanceThreshold
			if low && !source.LowBalanceAlerted {
				message := fmt.Sprintf("%s 余额 $%.2f，低于阈值 $%.2f", source.Name, *source.Balance, source.LowBalanceThreshold)
				if err := NotifyRootBark(
					fmt.Sprintf("channel_update_upstream_balance_%s", source.Key),
					"New API 上游余额告警",
					message,
				); err != nil {
					common.SysLog("upstream Bark notification skipped: " + err.Error())
				}
			}
			if low != source.LowBalanceAlerted {
				_ = model.DB.Model(&model.UpstreamSource{}).Where("id = ?", source.ID).
					Updates(map[string]any{"low_balance_alerted": low, "updated_at": now.Unix()}).Error
				source.LowBalanceAlerted = low
				sources[index] = source
			}
		}
		sourceByID[source.ID] = source
	}
	groupByIdentity := make(map[string]model.UpstreamGroup, len(groups))
	for _, group := range groups {
		groupByIdentity[upstreamGroupIdentity(group.SourceID, group.ExternalID)] = group
	}
	candidates, err := buildUpstreamRouteCandidates(sources, groups, now, setting)
	if err != nil {
		return summary, err
	}
	selectedGroups := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		selectedGroups[upstreamGroupIdentity(candidate.group.SourceID, candidate.group.ExternalID)] = struct{}{}
	}

	for i := range routes {
		route := &routes[i]
		if route.Detached {
			continue
		}
		source, sourceExists := sourceByID[route.SourceID]
		group, groupExists := groupByIdentity[upstreamGroupIdentity(route.SourceID, route.ExternalGroupID)]
		if !sourceExists || !groupExists {
			continue
		}
		identity := upstreamGroupIdentity(route.SourceID, route.ExternalGroupID)
		_, selected := selectedGroups[identity]
		selectionEvaluable := managedCandidateSelectionEvaluable(source, group, now, setting)
		var previousState, nextState, reason string
		channelChanged := false
		becameUnservable := false
		applied := false
		transactionErr := model.DB.Transaction(func(tx *gorm.DB) error {
			lockedRoute, err := model.GetAttachedUpstreamManagedRouteByIDForUpdate(tx, route.ID)
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			stateRoute := *lockedRoute
			if stateRoute.State == model.UpstreamRouteStateRetained {
				stateRoute.State = model.UpstreamRouteStateShadow
			}
			nextState, reason = desiredManagedRouteState(stateRoute, source, group, now, setting)
			if selectionEvaluable && !selected {
				nextState = model.UpstreamRouteStateRetained
				reason = "outside managed candidate limit"
			}
			if nextState == lockedRoute.State {
				return nil
			}
			previousState = lockedRoute.State
			updates := map[string]any{
				"state":       nextState,
				"last_reason": reason,
				"updated_at":  now.Unix(),
			}
			if nextState == model.UpstreamRouteStateQuarantined {
				if lockedRoute.RedSince == 0 {
					updates["red_since"] = now.Unix()
				}
				updates["recovery_attempts"] = 0
				updates["next_probe_at"] = now.Unix()
			}
			if nextState == model.UpstreamRouteStateLongRed {
				updates["next_probe_at"] = int64(0)
			}
			if nextState == model.UpstreamRouteStateRetained {
				updates["rank"] = 0
				updates["next_probe_at"] = int64(0)
			}
			if nextState == model.UpstreamRouteStateShadow &&
				lockedRoute.State == model.UpstreamRouteStateRetained {
				updates["next_probe_at"] = now.Unix()
			}
			if nextState == model.UpstreamRouteStateActive {
				updates["red_since"] = int64(0)
				updates["recovery_attempts"] = 0
				updates["next_probe_at"] = int64(0)
				updates["consecutive_failures"] = 0
				updates["failure_window_start"] = int64(0)
			}
			if err := tx.Model(&model.UpstreamManagedRoute{}).
				Where("id = ? AND detached = ?", lockedRoute.ID, false).
				Updates(updates).Error; err != nil {
				return err
			}
			status := common.ChannelStatusAutoDisabled
			if nextState == model.UpstreamRouteStateActive {
				status = common.ChannelStatusEnabled
			}
			channelChanged, err = model.UpdateChannelStatusTx(
				tx,
				lockedRoute.ChannelID,
				"",
				status,
				reason,
			)
			if errors.Is(err, gorm.ErrRecordNotFound) {
				channelChanged = false
			} else if err != nil {
				return err
			}
			becameUnservable = channelChanged && status != common.ChannelStatusEnabled
			applied = true
			return nil
		})
		if transactionErr != nil {
			applyManagedReconcileSideEffects(cacheRefreshNeeded, newlyUnservableChannels)
			return summary, transactionErr
		}
		if !applied {
			continue
		}
		switch nextState {
		case model.UpstreamRouteStateQuarantined:
			summary.RoutesQuarantined++
		case model.UpstreamRouteStateLongRed:
			summary.RoutesLongRed++
		case model.UpstreamRouteStateRetained:
			summary.RoutesRetained++
		case model.UpstreamRouteStateActive:
			summary.RoutesActivated++
		}
		routeChanges = append(routeChanges, fmt.Sprintf(
			"#%d %s/%s: %s -> %s",
			route.ChannelID,
			source.Key,
			group.Name,
			previousState,
			nextState,
		))
		if channelChanged {
			cacheRefreshNeeded = true
		}
		if becameUnservable {
			newlyUnservableChannels = append(newlyUnservableChannels, route.ChannelID)
		}
	}

	if setting.AutoEnroll {
		queued, queueErr := enqueueMissingUpstreamEnrollments(candidates, routes, setting)
		if queueErr != nil {
			applyManagedReconcileSideEffects(cacheRefreshNeeded, newlyUnservableChannels)
			return summary, queueErr
		}
		summary.EnrollmentQueued = queued
	}
	rankResult, rankErr := rankManagedRoutes(now, sources, groups, candidates, setting)
	summary.PrioritiesUpdated = rankResult.prioritiesUpdated
	newlyUnservableChannels = append(newlyUnservableChannels, rankResult.newlyUnservableChannels...)
	applyManagedReconcileSideEffects(
		cacheRefreshNeeded || rankResult.cacheRefreshNeeded,
		newlyUnservableChannels,
	)
	if rankErr != nil {
		return summary, rankErr
	}
	if len(routeChanges) > 0 {
		if err := NotifyRootBark(
			"channel_update_upstream_reconcile",
			"New API 上游线路状态变化",
			strings.Join(routeChanges, "\n"),
		); err != nil {
			common.SysLog("upstream Bark notification skipped: " + err.Error())
		}
	}
	return summary, nil
}

func managedCandidateSelectionEvaluable(
	source model.UpstreamSource,
	group model.UpstreamGroup,
	now time.Time,
	setting *operation_setting.UpstreamOrchestrationSetting,
) bool {
	if !source.Enabled || source.SelectedEndpoint == "" {
		return false
	}
	maxAge := int64((setting.SyncIntervalHours + 1) * 3600)
	if source.LastSnapshotAt == 0 || now.Unix()-source.LastSnapshotAt > maxAge {
		return false
	}
	if group.ObservedAt == 0 || now.Unix()-group.ObservedAt > maxAge {
		return false
	}
	if source.Balance != nil && *source.Balance <= 0 {
		return false
	}
	return group.HealthStatus != model.UpstreamHealthFailed &&
		group.HealthStatus != model.UpstreamHealthError
}

func desiredManagedRouteState(
	route model.UpstreamManagedRoute,
	source model.UpstreamSource,
	group model.UpstreamGroup,
	now time.Time,
	setting *operation_setting.UpstreamOrchestrationSetting,
) (string, string) {
	if route.Detached {
		return model.UpstreamRouteStateDetached, "detached"
	}
	if route.ManualPauseUntil > now.Unix() {
		return model.UpstreamRouteStatePaused, "manual pause"
	}
	if route.State == model.UpstreamRouteStatePaused {
		route.State = model.UpstreamRouteStateShadow
	}
	if source.LastSnapshotAt == 0 ||
		now.Unix()-source.LastSnapshotAt > int64((setting.SyncIntervalHours+1)*3600) {
		return route.State, route.LastReason
	}
	if group.ObservedAt == 0 ||
		now.Unix()-group.ObservedAt > int64((setting.SyncIntervalHours+1)*3600) {
		return route.State, route.LastReason
	}
	if !source.Enabled {
		return model.UpstreamRouteStateQuarantined, "source disabled"
	}
	if source.Balance != nil && *source.Balance <= 0 {
		return model.UpstreamRouteStateQuarantined, "source balance exhausted"
	}
	switch group.HealthStatus {
	case model.UpstreamHealthFailed, model.UpstreamHealthError:
		redSince := group.RedSince
		if redSince == 0 {
			redSince = now.Unix()
		}
		if now.Unix()-redSince >= int64(setting.RedLongTermHours*3600) {
			return model.UpstreamRouteStateLongRed, "upstream monitor red for 24 hours"
		}
		return model.UpstreamRouteStateQuarantined, "upstream monitor red"
	case model.UpstreamHealthOperational, model.UpstreamHealthDegraded:
		if route.State != model.UpstreamRouteStateShadow ||
			route.ConsecutiveSuccesses >= setting.ShadowSuccessesRequired {
			return model.UpstreamRouteStateActive, ""
		}
	}
	return route.State, route.LastReason
}

func buildUpstreamRouteCandidates(
	sources []model.UpstreamSource,
	groups []model.UpstreamGroup,
	now time.Time,
	setting *operation_setting.UpstreamOrchestrationSetting,
) ([]upstreamRouteCandidate, error) {
	sourceByID := make(map[int64]model.UpstreamSource, len(sources))
	for _, source := range sources {
		sourceByID[source.ID] = source
	}
	modelVendors, err := loadManagedModelVendors()
	if err != nil {
		return nil, err
	}
	var candidates []upstreamRouteCandidate
	for _, group := range groups {
		source, ok := sourceByID[group.SourceID]
		if !ok || !source.Enabled || source.SelectedEndpoint == "" {
			continue
		}
		if source.LastSnapshotAt == 0 || now.Unix()-source.LastSnapshotAt > int64((setting.SyncIntervalHours+1)*3600) {
			continue
		}
		if group.ObservedAt == 0 || now.Unix()-group.ObservedAt > int64((setting.SyncIntervalHours+1)*3600) {
			continue
		}
		if source.Balance != nil && *source.Balance <= 0 {
			continue
		}
		if group.EffectiveMultiplier <= 0 || group.EffectiveMultiplier > setting.MaxUpstreamMultiplier {
			continue
		}
		if group.HealthStatus == model.UpstreamHealthFailed || group.HealthStatus == model.UpstreamHealthError {
			continue
		}
		var upstreamModels []string
		if err := common.UnmarshalJsonStr(group.Models, &upstreamModels); err != nil {
			continue
		}
		eligible := make([]string, 0, len(upstreamModels))
		for _, upstreamModel := range upstreamModels {
			canonical := canonicalManagedModelName(upstreamModel, setting.ModelAliases)
			if managedModelExcluded(
				source.Key,
				group.ExternalID,
				upstreamModel,
				canonical,
				setting.ModelExclusions,
			) ||
				!isManagedTextModel(canonical, group.Platform) ||
				!managedModelMatchesPlatform(canonical, group.Platform, modelVendors) ||
				!hasConfiguredModelPrice(canonical) {
				continue
			}
			eligible = append(eligible, canonical)
		}
		eligible = uniqueSortedStrings(eligible)
		if len(eligible) == 0 {
			continue
		}
		candidates = append(candidates, upstreamRouteCandidate{
			source: source,
			group:  group,
			models: eligible,
		})
	}
	return selectUpstreamCandidateGroups(candidates, setting.CandidateLimit), nil
}

func selectUpstreamCandidateGroups(candidates []upstreamRouteCandidate, limit int) []upstreamRouteCandidate {
	sort.SliceStable(candidates, func(i, j int) bool {
		return lessUpstreamCandidate(candidates[i], candidates[j])
	})
	if limit == 0 {
		return candidates
	}
	if limit < 0 {
		return nil
	}
	selected := make(map[string]upstreamRouteCandidate)
	selectedModels := make(map[string]map[string]struct{})
	modelCandidates := make(map[string][]upstreamRouteCandidate)
	for _, candidate := range candidates {
		for _, modelName := range candidate.models {
			key := candidate.group.Platform + "\x00" + modelName
			modelCandidates[key] = append(modelCandidates[key], candidate)
		}
	}
	for key, perModel := range modelCandidates {
		modelName := strings.SplitN(key, "\x00", 2)[1]
		seenSources := make(map[int64]struct{})
		chosen := make([]upstreamRouteCandidate, 0, limit)
		for _, candidate := range perModel {
			if _, exists := seenSources[candidate.source.ID]; exists {
				continue
			}
			seenSources[candidate.source.ID] = struct{}{}
			chosen = append(chosen, candidate)
			if len(chosen) == limit {
				break
			}
		}
		for _, candidate := range perModel {
			if len(chosen) == limit {
				break
			}
			if slices.ContainsFunc(chosen, func(item upstreamRouteCandidate) bool {
				return item.group.SourceID == candidate.group.SourceID && item.group.ExternalID == candidate.group.ExternalID
			}) {
				continue
			}
			chosen = append(chosen, candidate)
		}
		for _, candidate := range chosen {
			identity := upstreamGroupIdentity(candidate.group.SourceID, candidate.group.ExternalID)
			selected[identity] = candidate
			if selectedModels[identity] == nil {
				selectedModels[identity] = make(map[string]struct{})
			}
			selectedModels[identity][modelName] = struct{}{}
		}
	}
	result := make([]upstreamRouteCandidate, 0, len(selected))
	for identity, candidate := range selected {
		candidate.models = candidate.models[:0]
		for modelName := range selectedModels[identity] {
			candidate.models = append(candidate.models, modelName)
		}
		sort.Strings(candidate.models)
		result = append(result, candidate)
	}
	sort.SliceStable(result, func(i, j int) bool {
		return lessUpstreamCandidate(result[i], result[j])
	})
	return result
}

func lessUpstreamCandidate(left upstreamRouteCandidate, right upstreamRouteCandidate) bool {
	if left.group.EffectiveMultiplier != right.group.EffectiveMultiplier {
		return left.group.EffectiveMultiplier < right.group.EffectiveMultiplier
	}
	leftAvailability := float64(-1)
	rightAvailability := float64(-1)
	if left.group.Availability != nil {
		leftAvailability = *left.group.Availability
	}
	if right.group.Availability != nil {
		rightAvailability = *right.group.Availability
	}
	if leftAvailability != rightAvailability {
		return leftAvailability > rightAvailability
	}
	leftLatency := int64(math.MaxInt64)
	rightLatency := int64(math.MaxInt64)
	if left.group.LatencyMS != nil {
		leftLatency = *left.group.LatencyMS
	}
	if right.group.LatencyMS != nil {
		rightLatency = *right.group.LatencyMS
	}
	if leftLatency != rightLatency {
		return leftLatency < rightLatency
	}
	if left.source.Key != right.source.Key {
		return left.source.Key < right.source.Key
	}
	return left.group.ExternalID < right.group.ExternalID
}

func enqueueMissingUpstreamEnrollments(
	candidates []upstreamRouteCandidate,
	routes []model.UpstreamManagedRoute,
	setting *operation_setting.UpstreamOrchestrationSetting,
) (int, error) {
	existing := make(map[string]struct{}, len(routes))
	for _, route := range routes {
		existing[upstreamGroupIdentity(route.SourceID, route.ExternalGroupID)] = struct{}{}
	}
	queued := 0
	for _, candidate := range candidates {
		identity := upstreamGroupIdentity(candidate.source.ID, candidate.group.ExternalID)
		if _, ok := existing[identity]; ok {
			continue
		}
		pending, err := hasPendingEnrollment(candidate.source.Key, candidate.group.ExternalID)
		if err != nil {
			return queued, err
		}
		if pending {
			continue
		}
		payload := rootdto.UpstreamEnrollmentCommand{
			SourceKey:       candidate.source.Key,
			ExternalGroupID: candidate.group.ExternalID,
			GroupName:       candidate.group.Name,
			Platform:        candidate.group.Platform,
			APIBaseURL:      candidate.source.SelectedEndpoint,
			Models:          candidate.models,
			KeyName:         managedUpstreamKeyName(candidate.source.Key, candidate.group.ExternalID),
			IPWhitelist:     append([]string(nil), setting.StaticEgressIPs[candidate.source.Key]...),
		}
		if _, err := model.CreateUpstreamSyncCommand("", upstreamSyncCommandEnroll, candidate.source.Key, payload); err != nil {
			return queued, err
		}
		existing[identity] = struct{}{}
		queued++
	}
	return queued, nil
}

func hasPendingEnrollment(sourceKey string, externalGroupID string) (bool, error) {
	var commands []model.UpstreamSyncCommand
	if err := model.DB.Where(
		"type = ? AND source_key = ? AND status IN ?",
		upstreamSyncCommandEnroll,
		sourceKey,
		[]string{model.UpstreamSyncCommandPending, model.UpstreamSyncCommandRunning},
	).Find(&commands).Error; err != nil {
		return false, err
	}
	for _, command := range commands {
		var payload rootdto.UpstreamEnrollmentCommand
		if common.UnmarshalJsonStr(command.Payload, &payload) == nil && payload.ExternalGroupID == externalGroupID {
			return true, nil
		}
	}
	return false, nil
}

func rankManagedRoutes(
	now time.Time,
	sources []model.UpstreamSource,
	groups []model.UpstreamGroup,
	candidates []upstreamRouteCandidate,
	setting *operation_setting.UpstreamOrchestrationSetting,
) (managedRouteRankResult, error) {
	var rankResult managedRouteRankResult
	sourceByID := make(map[int64]model.UpstreamSource, len(sources))
	for _, source := range sources {
		sourceByID[source.ID] = source
	}
	groupByIdentity := make(map[string]model.UpstreamGroup, len(groups))
	for _, group := range groups {
		groupByIdentity[upstreamGroupIdentity(group.SourceID, group.ExternalID)] = group
	}
	selectedModels := make(map[string][]string, len(candidates))
	for _, candidate := range candidates {
		selectedModels[upstreamGroupIdentity(candidate.group.SourceID, candidate.group.ExternalID)] = candidate.models
	}
	routes, err := model.ListUpstreamManagedRoutes()
	if err != nil {
		return rankResult, err
	}
	channelIDs := make([]int, 0, len(routes))
	for _, route := range routes {
		channelIDs = append(channelIDs, route.ChannelID)
	}
	var channels []model.Channel
	if len(channelIDs) > 0 {
		if err := model.DB.Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			return rankResult, err
		}
	}
	channelByID := make(map[int]model.Channel, len(channels))
	for _, channel := range channels {
		channelByID[channel.Id] = channel
	}
	sort.SliceStable(routes, func(i, j int) bool {
		if routes[i].Protocol != routes[j].Protocol {
			return routes[i].Protocol < routes[j].Protocol
		}
		leftNative := managedRouteUsesNativeProtocol(
			channelByID[routes[i].ChannelID],
			routes[i].Protocol,
		)
		rightNative := managedRouteUsesNativeProtocol(
			channelByID[routes[j].ChannelID],
			routes[j].Protocol,
		)
		if leftNative != rightNative {
			return leftNative
		}
		leftGroup := groupByIdentity[upstreamGroupIdentity(routes[i].SourceID, routes[i].ExternalGroupID)]
		rightGroup := groupByIdentity[upstreamGroupIdentity(routes[j].SourceID, routes[j].ExternalGroupID)]
		return lessUpstreamCandidate(
			upstreamRouteCandidate{source: sourceByID[routes[i].SourceID], group: leftGroup},
			upstreamRouteCandidate{source: sourceByID[routes[j].SourceID], group: rightGroup},
		)
	})
	rankByProtocol := map[string]int{}
	for index := range routes {
		route := &routes[index]
		if route.Detached {
			continue
		}
		identity := upstreamGroupIdentity(route.SourceID, route.ExternalGroupID)
		group, ok := groupByIdentity[identity]
		if !ok {
			continue
		}
		source, ok := sourceByID[route.SourceID]
		if !ok || !managedCandidateSelectionEvaluable(source, group, now, setting) {
			continue
		}
		models, groupSelected := selectedModels[identity]
		routeModels := make([]string, 0, len(models))
		for _, modelName := range models {
			if managedProtocolModelExcluded(
				source.Key,
				route.ExternalGroupID,
				route.Protocol,
				modelName,
				setting.ProtocolModelExclusions,
			) {
				continue
			}
			routeModels = append(routeModels, modelName)
		}
		selected := groupSelected && len(routeModels) > 0
		selectedEndpoint := source.SelectedEndpoint
		targetGroups := strings.Join(setting.TargetGroups, ",")
		channelChanged := false
		abilitiesUpdated := false
		becameUnservable := false
		applied := false
		activeSelected := false
		appliedRank := 0
		appliedProtocol := ""
		channelID := 0
		result := model.DB.Transaction(func(tx *gorm.DB) error {
			lockedRoute, lockErr := model.GetAttachedUpstreamManagedRouteByIDForUpdate(tx, route.ID)
			if errors.Is(lockErr, gorm.ErrRecordNotFound) {
				return nil
			}
			if lockErr != nil {
				return lockErr
			}
			rank := 0
			priority := int64(0)
			status := common.ChannelStatusAutoDisabled
			if selected && lockedRoute.State == model.UpstreamRouteStateActive {
				rank = rankByProtocol[lockedRoute.Protocol] + 1
				priority = int64(1000 - rank)
				status = common.ChannelStatusEnabled
				activeSelected = true
			}
			if err := tx.Model(&model.UpstreamManagedRoute{}).
				Where("id = ? AND detached = ?", lockedRoute.ID, false).
				Updates(map[string]any{
					"rank":                 rank,
					"effective_multiplier": group.EffectiveMultiplier,
					"updated_at":           now.Unix(),
				}).Error; err != nil {
				return err
			}
			channel, err := model.GetChannelForUpdate(tx, lockedRoute.ChannelID)
			if err != nil {
				return err
			}
			previousBaseURL := ""
			if channel.BaseURL != nil {
				previousBaseURL = *channel.BaseURL
			}
			desiredModels := strings.Join(routeModels, ",")
			desiredGroup := channel.Group
			if targetGroups != "" {
				desiredGroup = targetGroups
			}
			channelChanged = channel.GetPriority() != priority ||
				previousBaseURL != selectedEndpoint ||
				channel.Models != desiredModels ||
				channel.Status != status ||
				channel.Group != desiredGroup
			becameUnservable = channel.Status == common.ChannelStatusEnabled &&
				(status != common.ChannelStatusEnabled || desiredModels == "")
			applied = true
			appliedRank = rank
			appliedProtocol = lockedRoute.Protocol
			channelID = lockedRoute.ChannelID
			if channelChanged {
				channel.Priority = &priority
				channel.BaseURL = &selectedEndpoint
				channel.Models = desiredModels
				channel.Status = status
				channelUpdates := map[string]any{
					"priority": priority,
					"base_url": selectedEndpoint,
					"models":   channel.Models,
					"status":   status,
				}
				if targetGroups != "" {
					channel.Group = targetGroups
					channelUpdates["group"] = targetGroups
				}
				if err := tx.Model(&model.Channel{}).Where("id = ?", lockedRoute.ChannelID).Updates(channelUpdates).Error; err != nil {
					return err
				}
			}
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}
			abilitiesUpdated = true
			return nil
		})
		if result != nil {
			return rankResult, result
		}
		if !applied {
			continue
		}
		if activeSelected {
			rankByProtocol[appliedProtocol] = appliedRank
			rankResult.prioritiesUpdated++
		}
		if channelChanged || abilitiesUpdated {
			rankResult.cacheRefreshNeeded = true
		}
		if becameUnservable {
			rankResult.newlyUnservableChannels = append(
				rankResult.newlyUnservableChannels,
				channelID,
			)
		}
	}
	return rankResult, nil
}

func managedRouteUsesNativeProtocol(
	channel model.Channel,
	protocol string,
) bool {
	config := channel.GetOtherSettings().AdvancedCustom
	if config == nil {
		return false
	}
	found := false
	for _, route := range config.Routes {
		incomingPath := strings.TrimSpace(route.IncomingPath)
		relevant := protocol == model.UpstreamProtocolOpenAI &&
			(incomingPath == "/v1/chat/completions" ||
				incomingPath == "/v1/responses")
		relevant = relevant ||
			(protocol == model.UpstreamProtocolAnthropic &&
				incomingPath == "/v1/messages")
		if !relevant {
			continue
		}
		found = true
		converter := strings.TrimSpace(route.Converter)
		if converter != "" && converter != "none" {
			return false
		}
	}
	return found
}

func loadManagedModelVendors() (map[string]string, error) {
	var rows []struct {
		ModelName  string
		VendorName string
	}
	err := model.DB.Table("models").
		Select("models.model_name as model_name, vendors.name as vendor_name").
		Joins("JOIN vendors ON vendors.id = models.vendor_id").
		Where("models.status = ?", 1).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(rows))
	for _, row := range rows {
		result[row.ModelName] = strings.ToLower(strings.TrimSpace(row.VendorName))
	}
	var groups []model.UpstreamGroup
	if err := model.DB.Select("platform", "models").Find(&groups).Error; err != nil {
		return nil, err
	}
	for _, group := range groups {
		var modelNames []string
		if common.UnmarshalJsonStr(group.Models, &modelNames) != nil {
			continue
		}
		vendor := strings.ToLower(strings.TrimSpace(group.Platform))
		if vendor == "grok" {
			vendor = "xai"
		}
		for _, modelName := range modelNames {
			if _, exists := result[modelName]; !exists {
				result[modelName] = vendor
			}
		}
	}
	return result, nil
}

func managedModelMatchesPlatform(modelName string, platform string, vendors map[string]string) bool {
	vendor, ok := vendors[modelName]
	if !ok {
		return false
	}
	platform = strings.ToLower(strings.TrimSpace(platform))
	switch platform {
	case "openai":
		return strings.Contains(vendor, "openai") || strings.Contains(vendor, "chatgpt")
	case "anthropic":
		return strings.Contains(vendor, "anthropic") || strings.Contains(vendor, "claude")
	case "grok":
		return strings.Contains(vendor, "xai") || strings.Contains(vendor, "grok")
	default:
		return false
	}
}

func isManagedTextModel(modelName string, platform string) bool {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	switch strings.ToLower(strings.TrimSpace(platform)) {
	case "openai":
		return (strings.HasPrefix(modelName, "gpt-") ||
			strings.HasPrefix(modelName, "chatgpt-") ||
			strings.HasPrefix(modelName, "o1") ||
			strings.HasPrefix(modelName, "o3") ||
			strings.HasPrefix(modelName, "o4")) &&
			!strings.HasPrefix(modelName, "gpt-image-")
	case "anthropic":
		return strings.HasPrefix(modelName, "claude-")
	case "grok":
		return strings.HasPrefix(modelName, "grok-") &&
			!strings.HasPrefix(modelName, "grok-imagine")
	default:
		return false
	}
}

func hasConfiguredModelPrice(modelName string) bool {
	if expression, ok := billing_setting.GetBillingExpr(modelName); ok && strings.TrimSpace(expression) != "" {
		return true
	}
	if _, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		return true
	}
	_, ok, _ := ratio_setting.GetModelRatio(modelName)
	return ok
}

func canonicalManagedModelName(modelName string, aliases map[string]string) string {
	modelName = strings.TrimSpace(modelName)
	if alias, ok := aliases[modelName]; ok {
		return strings.TrimSpace(alias)
	}
	return modelName
}

func managedModelExcluded(
	sourceKey string,
	externalGroupID string,
	upstreamModel string,
	canonicalModel string,
	exclusions map[string][]string,
) bool {
	key := strings.ToLower(strings.TrimSpace(sourceKey)) + ":" +
		strings.TrimSpace(externalGroupID)
	for _, excluded := range exclusions[key] {
		excluded = strings.TrimSpace(excluded)
		if excluded == upstreamModel || excluded == canonicalModel {
			return true
		}
	}
	return false
}

func managedProtocolModelExcluded(
	sourceKey string,
	externalGroupID string,
	protocol string,
	modelName string,
	exclusions map[string][]string,
) bool {
	sourceKey = strings.ToLower(strings.TrimSpace(sourceKey))
	externalGroupID = strings.TrimSpace(externalGroupID)
	protocol = strings.ToLower(strings.TrimSpace(protocol))
	keys := []string{
		protocol,
		sourceKey + ":" + protocol,
		sourceKey + ":" + externalGroupID + ":" + protocol,
	}
	for _, key := range keys {
		for _, excluded := range exclusions[key] {
			if strings.TrimSpace(excluded) == modelName {
				return true
			}
		}
	}
	return false
}

func managedUpstreamKeyName(sourceKey string, externalGroupID string) string {
	value := strings.NewReplacer(" ", "-", "/", "-", ":", "-").Replace(externalGroupID)
	return truncateRunes(fmt.Sprintf("newapi-managed-%s-%s", sourceKey, value), 64)
}

func upstreamGroupIdentity(sourceID int64, externalGroupID string) string {
	return fmt.Sprintf("%d\x00%s", sourceID, strings.TrimSpace(externalGroupID))
}
