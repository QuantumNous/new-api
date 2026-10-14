package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var upstreamRecoveryBackoff = []time.Duration{
	0,
	5 * time.Minute,
	15 * time.Minute,
	time.Hour,
	4 * time.Hour,
}

type managedRouteAdminCacheEntry struct {
	info      map[string]any
	expiresAt int64
}

var managedRouteAdminCache sync.Map

const managedModelExclusionsOption = "upstream_orchestration.model_exclusions"

var (
	runManagedFailureNotification = gopool.Go
	notifyManagedFailure          = NotifyRootBark
)

func GetManagedRouteAdminInfo(channelID int) map[string]any {
	now := common.GetTimestamp()
	if cached, ok := managedRouteAdminCache.Load(channelID); ok {
		entry := cached.(managedRouteAdminCacheEntry)
		if entry.expiresAt > now {
			return entry.info
		}
	}
	var row struct {
		model.UpstreamManagedRoute
		SourceKey         string
		SourceEndpoint    string
		GroupName         string
		GroupHealth       string
		GroupObservedAt   int64
		GroupAvailability *float64
	}
	err := model.DB.Table("upstream_managed_routes AS routes").
		Select("routes.*, sources.key AS source_key, sources.selected_endpoint AS source_endpoint, groups.name AS group_name, groups.health_status AS group_health, groups.observed_at AS group_observed_at, groups.availability AS group_availability").
		Joins("JOIN upstream_sources AS sources ON sources.id = routes.source_id").
		Joins("JOIN upstream_groups AS groups ON groups.source_id = routes.source_id AND groups.external_id = routes.external_group_id").
		Where("routes.channel_id = ? AND routes.detached = ?", channelID, false).
		Scan(&row).Error
	if err != nil || row.ID == 0 {
		return nil
	}
	info := map[string]any{
		"source":               row.SourceKey,
		"group":                row.GroupName,
		"external_group_id":    row.ExternalGroupID,
		"protocol":             row.Protocol,
		"state":                row.State,
		"effective_multiplier": row.EffectiveMultiplier,
		"selected_endpoint":    row.SourceEndpoint,
		"health_status":        row.GroupHealth,
		"health_sample_age":    max(int64(0), now-row.GroupObservedAt),
	}
	if row.GroupAvailability != nil {
		info["availability"] = *row.GroupAvailability
	}
	managedRouteAdminCache.Store(channelID, managedRouteAdminCacheEntry{info: info, expiresAt: now + 60})
	return info
}

func invalidateManagedRouteAdminInfo(channelID int) {
	managedRouteAdminCache.Delete(channelID)
}

func IsManagedChannel(channelID int) bool {
	if channelID <= 0 || !operation_setting.GetUpstreamOrchestrationSetting().Enabled {
		return false
	}
	var route model.UpstreamManagedRoute
	err := model.DB.Select("id").
		Where("channel_id = ? AND detached = ?", channelID, false).
		First(&route).Error
	return err == nil
}

func ShouldRecordManagedRouteFailure(err *types.NewAPIError) bool {
	if err == nil || types.IsSkipRetryError(err) {
		return false
	}
	if IsManagedModelUnsupported(err) {
		return true
	}
	if types.IsChannelError(err) {
		return true
	}
	switch err.StatusCode {
	case 401, 403, 408, 429:
		return true
	default:
		return err.StatusCode >= 500 && err.StatusCode <= 599
	}
}

func IsManagedModelUnsupported(err *types.NewAPIError) bool {
	if err == nil || err.StatusCode != 404 {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "model") &&
		strings.Contains(message, "not supported by any configured account")
}

func IsolateManagedRouteModel(channelID int, modelName string, reason string) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	if channelID <= 0 || modelName == "" {
		return false, nil
	}
	route, _, err := model.MutateUpstreamModelExclusionForAttachedRoute(
		channelID,
		modelName,
		func(tx *gorm.DB, lockedRoute *model.UpstreamManagedRoute) error {
			channel, err := model.GetChannelForUpdate(tx, channelID)
			if err != nil {
				return err
			}
			channelModels, removed := removeManagedModel(channel.Models, modelName)
			if removed {
				channel.Models = strings.Join(channelModels, ",")
				if err := tx.Model(&model.Channel{}).Where("id = ?", channelID).
					Update("models", channel.Models).Error; err != nil {
					return err
				}
				if err := channel.UpdateAbilities(tx); err != nil {
					return err
				}
			}

			var group model.UpstreamGroup
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("source_id = ? AND external_id = ?", lockedRoute.SourceID, lockedRoute.ExternalGroupID).
				First(&group).Error; err != nil {
				return err
			}
			var groupModels []string
			if err := common.UnmarshalJsonStr(group.Models, &groupModels); err != nil {
				return err
			}
			groupModels, groupRemoved := removeManagedModel(strings.Join(groupModels, ","), modelName)
			now := common.GetTimestamp()
			if groupRemoved {
				encodedModels, err := common.Marshal(groupModels)
				if err != nil {
					return err
				}
				if err := tx.Model(&model.UpstreamGroup{}).Where("id = ?", group.ID).
					Updates(map[string]any{
						"models":     string(encodedModels),
						"updated_at": now,
					}).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&model.UpstreamManagedRoute{}).Where("id = ?", lockedRoute.ID).
				Updates(map[string]any{
					"last_failure_at": now,
					"last_reason":     strings.TrimSpace(reason),
					"updated_at":      now,
				}).Error; err != nil {
				return err
			}
			return nil
		},
	)
	if err != nil {
		return false, err
	}
	if route == nil {
		return false, nil
	}
	model.InitChannelCache()
	invalidateManagedRouteAdminInfo(channelID)
	return true, nil
}

func persistManagedModelExclusion(
	sourceID int64,
	externalGroupID string,
	modelName string,
) (bool, error) {
	return model.AppendUpstreamModelExclusion(sourceID, externalGroupID, modelName)
}

func removeManagedModel(models string, target string) ([]string, bool) {
	items := strings.Split(models, ",")
	result := make([]string, 0, len(items))
	removed := false
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if item == target {
			removed = true
			continue
		}
		result = append(result, item)
	}
	return result, removed
}

func RecordManagedChannelFailure(channelError types.ChannelError, reason string) (bool, bool, error) {
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	if !setting.Enabled {
		return false, false, nil
	}
	var route *model.UpstreamManagedRoute
	var quarantined, channelUpdated bool
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		route, quarantined, err = model.RecordUpstreamRouteFailureTx(
			tx,
			channelError.ChannelId,
			common.GetTimestamp(),
			int64(setting.FailureWindowMinutes*60),
			setting.FailureThreshold,
			common.LocalLogPreview(reason),
		)
		if err != nil || route == nil || !quarantined {
			return err
		}
		channelUpdated, err = model.UpdateChannelStatusTx(
			tx,
			channelError.ChannelId,
			channelError.UsingKey,
			common.ChannelStatusAutoDisabled,
			reason,
		)
		return err
	})
	if err != nil {
		return false, false, err
	}
	if route == nil {
		return false, false, nil
	}
	if quarantined {
		invalidateManagedRouteAdminInfo(channelError.ChannelId)
		if channelUpdated {
			model.InitChannelCache()
			CloseActiveWebSocketsForChannel(channelError.ChannelId, ChannelDisabledCloseReason)
			runManagedFailureNotification(func() {
				if err := notifyManagedFailure(
					fmt.Sprintf("%s_managed_%d", dto.NotifyTypeChannelUpdate, channelError.ChannelId),
					fmt.Sprintf("受管通道「%s」（#%d）已隔离", channelError.ChannelName, channelError.ChannelId),
					fmt.Sprintf("%d 分钟内连续错误达到 %d 次，已停止生产流量。原因：%s", setting.FailureWindowMinutes, setting.FailureThreshold, common.LocalLogPreview(reason)),
				); err != nil {
					common.SysLog("upstream Bark notification skipped: " + err.Error())
				}
			})
		}
	}
	return true, quarantined, nil
}

func RecordManagedChannelSuccess(channelID int, elapsed time.Duration) {
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	if !setting.Enabled || channelID <= 0 {
		return
	}
	route, err := model.RecordUpstreamRouteSuccess(channelID, common.GetTimestamp(), elapsed.Milliseconds())
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysLog(fmt.Sprintf("record managed upstream success failed: channel_id=%d error=%v", channelID, err))
		}
		return
	}
	if route == nil {
		return
	}
	invalidateManagedRouteAdminInfo(channelID)
	enqueueStaleManagedRouteProbes(route, common.GetTimestamp(), setting.ProbeFreshnessMinutes*60)
}

func enqueueStaleManagedRouteProbes(current *model.UpstreamManagedRoute, now int64, freshnessSeconds int) {
	if current == nil || freshnessSeconds <= 0 {
		return
	}
	query := model.DB.Model(&model.UpstreamManagedRoute{}).Where(
		"platform = ? AND protocol = ? AND detached = ? AND channel_id <> ? AND state IN ? AND last_success_at < ?",
		current.Platform,
		current.Protocol,
		false,
		current.ChannelID,
		[]string{model.UpstreamRouteStateActive, model.UpstreamRouteStateQuarantined},
		now-int64(freshnessSeconds),
	)
	limit := operation_setting.GetUpstreamOrchestrationSetting().CandidateLimit
	if limit == 0 {
		if err := query.Where("next_probe_at <= ?", now).
			Updates(map[string]any{"next_probe_at": now, "updated_at": now}).Error; err != nil {
			common.SysLog("schedule stale managed route probes failed: " + err.Error())
		}
		return
	}

	var routes []model.UpstreamManagedRoute
	query = query.Order("rank asc")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&routes).Error; err != nil {
		common.SysLog("load stale managed routes failed: " + err.Error())
		return
	}
	for _, route := range routes {
		if route.NextProbeAt > now {
			continue
		}
		if err := model.DB.Model(&model.UpstreamManagedRoute{}).
			Where("id = ? AND next_probe_at <= ?", route.ID, now).
			Updates(map[string]any{"next_probe_at": now, "updated_at": now}).Error; err != nil {
			common.SysLog(fmt.Sprintf("schedule managed route probe failed: route_id=%d error=%v", route.ID, err))
		}
	}
}

func PauseManagedRoute(routeID int64, reason string) error {
	setting := operation_setting.GetUpstreamOrchestrationSetting()
	now := common.GetTimestamp()
	var route model.UpstreamManagedRoute
	if err := model.DB.First(&route, routeID).Error; err != nil {
		return err
	}
	if route.Detached {
		return errors.New("managed route is detached")
	}
	until := now + int64(setting.ManualPauseHours*3600)
	if err := model.DB.Model(&route).Updates(map[string]any{
		"state":              model.UpstreamRouteStatePaused,
		"manual_pause_until": until,
		"last_reason":        strings.TrimSpace(reason),
		"updated_at":         now,
	}).Error; err != nil {
		return err
	}
	updateManagedChannelStatus(route.ChannelID, "", common.ChannelStatusManuallyDisabled, "upstream orchestration manual pause")
	invalidateManagedRouteAdminInfo(route.ChannelID)
	return nil
}

func ResumeManagedRoute(routeID int64) error {
	now := common.GetTimestamp()
	var route model.UpstreamManagedRoute
	if err := model.DB.First(&route, routeID).Error; err != nil {
		return err
	}
	if route.Detached {
		return errors.New("managed route is detached")
	}
	if err := model.DB.Model(&route).Updates(map[string]any{
		"state":              model.UpstreamRouteStateShadow,
		"manual_pause_until": int64(0),
		"next_probe_at":      now,
		"last_reason":        "",
		"updated_at":         now,
	}).Error; err != nil {
		return err
	}
	invalidateManagedRouteAdminInfo(route.ChannelID)
	return nil
}

func DetachManagedRoute(routeID int64) error {
	now := common.GetTimestamp()
	channelID := 0
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		route, err := model.GetAttachedUpstreamManagedRouteByIDForUpdate(tx, routeID)
		if err != nil {
			return err
		}
		channelID = route.ChannelID
		result := tx.Model(&model.UpstreamManagedRoute{}).
			Where("id = ? AND detached = ?", route.ID, false).
			Updates(map[string]any{
				"state":      model.UpstreamRouteStateDetached,
				"detached":   true,
				"updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		return err
	}
	invalidateManagedRouteAdminInfo(channelID)
	return nil
}

func MarkManagedRouteProbeResult(routeID int64, succeeded bool, latencyMS int64, reason string) error {
	now := common.GetTimestamp()
	var route model.UpstreamManagedRoute
	if err := model.DB.First(&route, routeID).Error; err != nil {
		return err
	}
	if route.Detached || route.State == model.UpstreamRouteStateLongRed {
		return nil
	}
	if succeeded {
		nextState := model.UpstreamRouteStateActive
		successes := route.ConsecutiveSuccesses + 1
		if route.State == model.UpstreamRouteStateShadow &&
			(!operation_setting.GetUpstreamOrchestrationSetting().Enabled ||
				successes < operation_setting.GetUpstreamOrchestrationSetting().ShadowSuccessesRequired) {
			nextState = model.UpstreamRouteStateShadow
		}
		if err := model.DB.Model(&route).Updates(map[string]any{
			"state":                 nextState,
			"consecutive_failures":  0,
			"consecutive_successes": successes,
			"failure_window_start":  int64(0),
			"recovery_attempts":     0,
			"next_probe_at":         nextProbeAfterSuccess(nextState, now),
			"last_probe_at":         now,
			"last_success_at":       now,
			"last_latency_ms":       latencyMS,
			"last_reason":           "",
			"updated_at":            now,
		}).Error; err != nil {
			return err
		}
		if nextState == model.UpstreamRouteStateActive {
			EnableChannel(route.ChannelID, "", managedRouteChannelName(route.ChannelID))
		}
		invalidateManagedRouteAdminInfo(route.ChannelID)
		return nil
	}

	attempts := route.RecoveryAttempts + 1
	nextProbeAt := int64(0)
	if attempts < len(upstreamRecoveryBackoff) {
		nextProbeAt = now + int64(upstreamRecoveryBackoff[attempts].Seconds())
	}
	failureState := model.UpstreamRouteStateQuarantined
	if route.State == model.UpstreamRouteStateShadow {
		failureState = model.UpstreamRouteStateShadow
	}
	err := model.DB.Model(&route).Updates(map[string]any{
		"state":                 failureState,
		"consecutive_successes": 0,
		"recovery_attempts":     attempts,
		"next_probe_at":         nextProbeAt,
		"last_probe_at":         now,
		"last_failure_at":       now,
		"last_reason":           common.LocalLogPreview(reason),
		"updated_at":            now,
	}).Error
	if err == nil {
		invalidateManagedRouteAdminInfo(route.ChannelID)
	}
	return err
}

func nextProbeAfterSuccess(state string, now int64) int64 {
	if state == model.UpstreamRouteStateShadow {
		return now + 60
	}
	return 0
}

func managedRouteChannelName(channelID int) string {
	channel, err := model.GetChannelById(channelID, false)
	if err != nil || channel == nil {
		return fmt.Sprintf("#%d", channelID)
	}
	return channel.Name
}
