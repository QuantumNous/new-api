package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type ChannelMonitorScheduler interface {
	Schedule(m *model.ChannelMonitor)
	Unschedule(id int64)
}

var channelMonitorScheduler ChannelMonitorScheduler

func SetChannelMonitorScheduler(scheduler ChannelMonitorScheduler) {
	channelMonitorScheduler = scheduler
}

func ListChannelMonitors(ctx context.Context, params ChannelMonitorListParams) ([]*model.ChannelMonitor, int64, error) {
	items, total, err := model.ListChannelMonitors(model.ChannelMonitorListParams{
		Page:     params.Page,
		PageSize: params.PageSize,
		Provider: strings.TrimSpace(params.Provider),
		Enabled:  params.Enabled,
		Search:   strings.TrimSpace(params.Search),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list channel monitors: %w", err)
	}
	for _, item := range items {
		decryptMonitorAPIKeyInPlace(ctx, item)
	}
	return items, total, nil
}

func GetChannelMonitor(ctx context.Context, id int64) (*model.ChannelMonitor, error) {
	m, err := model.GetChannelMonitorByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelMonitorNotFound
		}
		return nil, err
	}
	decryptMonitorAPIKeyInPlace(ctx, m)
	return m, nil
}

func CreateChannelMonitor(ctx context.Context, p ChannelMonitorCreateParams) (*model.ChannelMonitor, error) {
	if err := validateChannelMonitorCreate(p); err != nil {
		return nil, err
	}
	if err := applyTemplateSnapshotOnCreate(ctx, &p); err != nil {
		return nil, err
	}
	if err := validateBodyModeForProtocol(p.Provider, p.APIMode, p.BodyOverrideMode, p.BodyOverride); err != nil {
		return nil, err
	}
	if err := validateExtraHeaders(p.ExtraHeaders); err != nil {
		return nil, err
	}
	encrypted, err := common.EncryptSecret(strings.TrimSpace(p.APIKey))
	if err != nil {
		return nil, fmt.Errorf("encrypt api key: %w", err)
	}
	m := &model.ChannelMonitor{
		Name:             strings.TrimSpace(p.Name),
		Provider:         strings.TrimSpace(p.Provider),
		APIMode:          normalizeMonitorAPIModeForProvider(p.Provider, p.APIMode),
		Endpoint:         normalizeMonitorEndpoint(p.Endpoint),
		APIKeyEncrypted:  encrypted,
		PrimaryModel:     strings.TrimSpace(p.PrimaryModel),
		GroupName:        strings.TrimSpace(p.GroupName),
		Enabled:          p.Enabled,
		IntervalSeconds:  p.IntervalSeconds,
		JitterSeconds:    p.JitterSeconds,
		CreatedBy:        p.CreatedBy,
		TemplateID:       cloneMonitorTemplateID(p.TemplateID),
		BodyOverrideMode: defaultBodyMode(p.BodyOverrideMode),
	}
	if err := m.SetExtraModels(normalizeMonitorModels(p.ExtraModels)); err != nil {
		return nil, err
	}
	if err := m.SetExtraHeaders(emptyMonitorHeadersIfNil(p.ExtraHeaders)); err != nil {
		return nil, err
	}
	if err := m.SetBodyOverride(p.BodyOverride); err != nil {
		return nil, err
	}
	if err := model.CreateChannelMonitor(m); err != nil {
		return nil, err
	}
	m.APIKey = strings.TrimSpace(p.APIKey)
	if channelMonitorScheduler != nil {
		channelMonitorScheduler.Schedule(m)
	}
	return m, nil
}

func UpdateChannelMonitor(ctx context.Context, id int64, p ChannelMonitorUpdateParams) (*model.ChannelMonitor, error) {
	existing, err := model.GetChannelMonitorByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelMonitorNotFound
		}
		return nil, err
	}
	if err := applyChannelMonitorUpdate(existing, p); err != nil {
		return nil, err
	}
	if err := validateAndMaybeApplyTemplateSnapshot(ctx, existing, p); err != nil {
		return nil, err
	}
	apiKeyUpdated := false
	if p.APIKey != nil && strings.TrimSpace(*p.APIKey) != "" {
		encrypted, err := common.EncryptSecret(strings.TrimSpace(*p.APIKey))
		if err != nil {
			return nil, fmt.Errorf("encrypt api key: %w", err)
		}
		existing.APIKeyEncrypted = encrypted
		apiKeyUpdated = true
	}
	if err := model.UpdateChannelMonitor(existing); err != nil {
		return nil, err
	}
	if apiKeyUpdated {
		existing.APIKey = strings.TrimSpace(*p.APIKey)
	} else {
		decryptMonitorAPIKeyInPlace(ctx, existing)
	}
	if channelMonitorScheduler != nil {
		channelMonitorScheduler.Schedule(existing)
	}
	return existing, nil
}

func applyTemplateSnapshotOnCreate(ctx context.Context, p *ChannelMonitorCreateParams) error {
	if p == nil || p.TemplateID == nil {
		return nil
	}
	template, err := validateTemplateMatchesMonitor(ctx, *p.TemplateID, p.Provider, normalizeMonitorAPIModeForProvider(p.Provider, p.APIMode))
	if err != nil {
		return err
	}
	if p.ExtraHeaders == nil && p.BodyOverrideMode == "" && p.BodyOverride == nil {
		p.ExtraHeaders = template.GetExtraHeaders()
		p.BodyOverrideMode = template.BodyOverrideMode
		p.BodyOverride = template.GetBodyOverride()
	}
	return nil
}

func validateAndMaybeApplyTemplateSnapshot(ctx context.Context, existing *model.ChannelMonitor, p ChannelMonitorUpdateParams) error {
	if existing == nil || existing.TemplateID == nil {
		return nil
	}
	template, err := validateTemplateMatchesMonitor(ctx, *existing.TemplateID, existing.Provider, existing.APIMode)
	if err != nil {
		return err
	}
	if p.TemplateID != nil && p.ExtraHeaders == nil && p.BodyOverrideMode == nil && p.BodyOverride == nil {
		if err := existing.SetExtraHeaders(template.GetExtraHeaders()); err != nil {
			return err
		}
		existing.BodyOverrideMode = template.BodyOverrideMode
		if err := existing.SetBodyOverride(template.GetBodyOverride()); err != nil {
			return err
		}
	}
	return nil
}

func validateTemplateMatchesMonitor(ctx context.Context, id int64, provider, apiMode string) (*model.ChannelMonitorRequestTemplate, error) {
	template, err := GetChannelMonitorRequestTemplate(ctx, id)
	if err != nil {
		return nil, err
	}
	if template.Provider != strings.TrimSpace(provider) {
		return nil, ErrChannelMonitorTemplateProviderMismatch
	}
	if defaultMonitorAPIMode(template.APIMode) != defaultMonitorAPIMode(apiMode) {
		return nil, ErrChannelMonitorTemplateAPIModeMismatch
	}
	return template, nil
}

func DeleteChannelMonitor(id int64) error {
	if err := model.DeleteChannelMonitor(id); err != nil {
		return err
	}
	if channelMonitorScheduler != nil {
		channelMonitorScheduler.Unschedule(id)
	}
	return nil
}

func RunChannelMonitorCheck(ctx context.Context, id int64) ([]*CheckResult, error) {
	m, err := GetChannelMonitor(ctx, id)
	if err != nil {
		return nil, err
	}
	if m.APIKeyDecryptFailed {
		return nil, ErrChannelMonitorAPIKeyDecryptFailed
	}
	results := runChannelMonitorChecksConcurrent(ctx, m)
	persistChannelMonitorCheckResults(ctx, m, results)
	return results, nil
}

func ListChannelMonitorHistory(id int64, modelName string, limit int) ([]*model.ChannelMonitorHistory, error) {
	if _, err := model.GetChannelMonitorByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelMonitorNotFound
		}
		return nil, err
	}
	if limit <= 0 {
		limit = ChannelMonitorHistoryLimit
	}
	if limit > ChannelMonitorHistoryMaxLimit {
		limit = ChannelMonitorHistoryMaxLimit
	}
	return model.ListChannelMonitorHistory(id, strings.TrimSpace(modelName), limit)
}

func ListEnabledChannelMonitors(ctx context.Context) ([]*model.ChannelMonitor, error) {
	items, err := model.ListEnabledChannelMonitors()
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		decryptMonitorAPIKeyInPlace(ctx, item)
	}
	return items, nil
}

func BatchChannelMonitorStatusSummary(ctx context.Context, items []*model.ChannelMonitor) map[int64]MonitorStatusSummary {
	ids := make([]int64, 0, len(items))
	primaryByID := make(map[int64]string, len(items))
	extrasByID := make(map[int64][]string, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		ids = append(ids, item.Id)
		primaryByID[item.Id] = item.PrimaryModel
		extrasByID[item.Id] = item.GetExtraModels()
	}
	return buildMonitorStatusSummaries(ctx, ids, primaryByID, extrasByID)
}

func ListUserChannelMonitorViews(ctx context.Context) ([]*UserMonitorView, error) {
	items, err := model.ListEnabledChannelMonitors()
	if err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(items))
	primaryByID := make(map[int64]string, len(items))
	extrasByID := make(map[int64][]string, len(items))
	for _, item := range items {
		ids = append(ids, item.Id)
		primaryByID[item.Id] = item.PrimaryModel
		extrasByID[item.Id] = item.GetExtraModels()
	}
	summaries := buildMonitorStatusSummaries(ctx, ids, primaryByID, extrasByID)
	recent, err := model.ListRecentChannelMonitorHistoryForPrimaries(ids, primaryByID, monitorTimelineMaxPoints)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor recent history query failed: %v", err))
	}

	out := make([]*UserMonitorView, 0, len(items))
	for _, item := range items {
		summary := summaries[item.Id]
		view := &UserMonitorView{
			ID:                   item.Id,
			Name:                 item.Name,
			Provider:             item.Provider,
			GroupName:            item.GroupName,
			PrimaryModel:         item.PrimaryModel,
			PrimaryStatus:        summary.PrimaryStatus,
			PrimaryLatencyMs:     summary.PrimaryLatencyMs,
			PrimaryPingLatencyMs: summary.PrimaryPingLatencyMs,
			PrimaryCheckedAt:     summary.PrimaryCheckedAt,
			Availability7d:       summary.Availability7d,
			Availability15d:      summary.Availability15d,
			Availability30d:      summary.Availability30d,
			ExtraModels:          summary.ExtraModels,
			Timeline:             make([]UserMonitorTimelinePoint, 0, len(recent[item.Id])),
		}
		for _, row := range recent[item.Id] {
			view.Timeline = append(view.Timeline, UserMonitorTimelinePoint{
				Status:        row.Status,
				LatencyMs:     row.LatencyMs,
				PingLatencyMs: row.PingLatencyMs,
				CheckedAt:     row.CheckedAt,
			})
		}
		out = append(out, view)
	}
	return out, nil
}

func GetUserChannelMonitorDetail(ctx context.Context, id int64) (*UserMonitorDetail, error) {
	monitor, err := model.GetChannelMonitorByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelMonitorNotFound
		}
		return nil, err
	}
	if !monitor.Enabled {
		return nil, ErrChannelMonitorNotFound
	}

	ids := []int64{id}
	latestMap, err := model.ListLatestChannelMonitorHistoryForIDs(ids)
	if err != nil {
		return nil, err
	}
	availability7, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 7)
	if err != nil {
		return nil, err
	}
	availability15, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 15)
	if err != nil {
		return nil, err
	}
	availability30, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 30)
	if err != nil {
		return nil, err
	}

	latestByModel := latestSliceToMap(latestMap[id])
	av7 := availabilitySliceToMap(availability7[id])
	av15 := availabilitySliceToMap(availability15[id])
	av30 := availabilitySliceToMap(availability30[id])

	modelNames := append([]string{monitor.PrimaryModel}, monitor.GetExtraModels()...)
	detail := &UserMonitorDetail{
		ID:        monitor.Id,
		Name:      monitor.Name,
		Provider:  monitor.Provider,
		GroupName: monitor.GroupName,
		Models:    make([]ModelDetail, 0, len(modelNames)),
	}
	for _, modelName := range modelNames {
		latest := latestByModel[modelName]
		modelDetail := ModelDetail{Model: modelName}
		if latest != nil {
			modelDetail.LatestStatus = latest.Status
			modelDetail.LatestLatencyMs = latest.LatencyMs
			modelDetail.LatestPingMs = latest.PingLatencyMs
			modelDetail.LatestCheckedAt = &latest.CheckedAt
		}
		if v := av7[modelName]; v != nil {
			modelDetail.Availability7d = v.AvailabilityPct
			modelDetail.AvgLatency7dMs = v.AvgLatencyMs
		}
		if v := av15[modelName]; v != nil {
			modelDetail.Availability15d = v.AvailabilityPct
		}
		if v := av30[modelName]; v != nil {
			modelDetail.Availability30d = v.AvailabilityPct
		}
		detail.Models = append(detail.Models, modelDetail)
	}
	return detail, nil
}

func CleanupChannelMonitorHistory(ctx context.Context) {
	before := time.Now().UTC().AddDate(0, 0, -monitorHistoryRetentionDays)
	deleted, err := model.DeleteChannelMonitorHistoryBefore(before)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor history cleanup failed: %v", err))
		return
	}
	if deleted > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("channel monitor history cleanup: deleted=%d before=%s", deleted, before.Format(time.RFC3339)))
	}
}

func MaskChannelMonitorAPIKey(plain string) string {
	plain = strings.TrimSpace(plain)
	if len(plain) <= 4 {
		return "***"
	}
	return plain[:4] + "***"
}

func validateChannelMonitorCreate(p ChannelMonitorCreateParams) error {
	if err := validateMonitorProvider(strings.TrimSpace(p.Provider)); err != nil {
		return err
	}
	if err := validateMonitorAPIMode(strings.TrimSpace(p.Provider), p.APIMode); err != nil {
		return err
	}
	if err := validateMonitorInterval(p.IntervalSeconds); err != nil {
		return err
	}
	if err := validateMonitorJitter(p.JitterSeconds, p.IntervalSeconds); err != nil {
		return err
	}
	if err := validateMonitorEndpoint(p.Endpoint); err != nil {
		return err
	}
	if strings.TrimSpace(p.APIKey) == "" {
		return ErrChannelMonitorMissingAPIKey
	}
	if strings.TrimSpace(p.PrimaryModel) == "" {
		return ErrChannelMonitorMissingPrimaryModel
	}
	return nil
}

func applyChannelMonitorUpdate(existing *model.ChannelMonitor, p ChannelMonitorUpdateParams) error {
	providerChanged := false
	if p.Name != nil {
		existing.Name = strings.TrimSpace(*p.Name)
	}
	if p.Provider != nil {
		if err := validateMonitorProvider(strings.TrimSpace(*p.Provider)); err != nil {
			return err
		}
		existing.Provider = strings.TrimSpace(*p.Provider)
		providerChanged = true
	}
	if p.APIMode != nil {
		if err := validateMonitorAPIMode(existing.Provider, *p.APIMode); err != nil {
			return err
		}
		existing.APIMode = normalizeMonitorAPIModeForProvider(existing.Provider, *p.APIMode)
	} else {
		existing.APIMode = normalizeMonitorAPIModeForProvider(existing.Provider, existing.APIMode)
	}
	if p.Endpoint != nil {
		if err := validateMonitorEndpoint(*p.Endpoint); err != nil {
			return err
		}
		existing.Endpoint = normalizeMonitorEndpoint(*p.Endpoint)
	}
	if p.PrimaryModel != nil {
		existing.PrimaryModel = strings.TrimSpace(*p.PrimaryModel)
		if existing.PrimaryModel == "" {
			return ErrChannelMonitorMissingPrimaryModel
		}
	}
	if p.ExtraModels != nil {
		if err := existing.SetExtraModels(normalizeMonitorModels(*p.ExtraModels)); err != nil {
			return err
		}
	}
	if p.GroupName != nil {
		existing.GroupName = strings.TrimSpace(*p.GroupName)
	}
	if p.Enabled != nil {
		existing.Enabled = *p.Enabled
	}
	interval := existing.IntervalSeconds
	jitter := existing.JitterSeconds
	if p.IntervalSeconds != nil {
		if err := validateMonitorInterval(*p.IntervalSeconds); err != nil {
			return err
		}
		interval = *p.IntervalSeconds
	}
	if p.JitterSeconds != nil {
		jitter = *p.JitterSeconds
	}
	if err := validateMonitorJitter(jitter, interval); err != nil {
		return err
	}
	existing.IntervalSeconds = interval
	existing.JitterSeconds = jitter
	return applyChannelMonitorAdvancedUpdate(existing, p, providerChanged)
}

func applyChannelMonitorAdvancedUpdate(existing *model.ChannelMonitor, p ChannelMonitorUpdateParams, providerChanged bool) error {
	if p.ClearTemplate {
		existing.TemplateID = nil
	} else if p.TemplateID != nil {
		existing.TemplateID = cloneMonitorTemplateID(p.TemplateID)
	}
	if p.ExtraHeaders != nil {
		if err := validateExtraHeaders(*p.ExtraHeaders); err != nil {
			return err
		}
		if err := existing.SetExtraHeaders(emptyMonitorHeadersIfNil(*p.ExtraHeaders)); err != nil {
			return err
		}
	}

	newAPIMode := defaultMonitorAPIMode(existing.APIMode)
	if p.APIMode != nil {
		newAPIMode = defaultMonitorAPIMode(*p.APIMode)
	} else if existing.Provider != MonitorProviderOpenAI {
		newAPIMode = MonitorAPIModeChatCompletions
	}
	if err := validateMonitorAPIMode(existing.Provider, newAPIMode); err != nil {
		return err
	}

	newMode := existing.BodyOverrideMode
	newBody := existing.GetBodyOverride()
	if p.BodyOverrideMode != nil {
		newMode = *p.BodyOverrideMode
	}
	if p.BodyOverride != nil {
		newBody = *p.BodyOverride
	}
	if providerChanged || p.APIMode != nil || p.BodyOverrideMode != nil || p.BodyOverride != nil {
		if err := validateBodyModeForProtocol(existing.Provider, newAPIMode, newMode, newBody); err != nil {
			return err
		}
		existing.BodyOverrideMode = defaultBodyMode(newMode)
		if err := existing.SetBodyOverride(newBody); err != nil {
			return err
		}
	}
	existing.APIMode = newAPIMode
	return nil
}

func cloneMonitorTemplateID(id *int64) *int64 {
	if id == nil {
		return nil
	}
	value := *id
	return &value
}

func normalizeMonitorAPIModeForProvider(provider, apiMode string) string {
	if provider != MonitorProviderOpenAI {
		return MonitorAPIModeChatCompletions
	}
	return defaultMonitorAPIMode(apiMode)
}

func decryptMonitorAPIKeyInPlace(ctx context.Context, m *model.ChannelMonitor) {
	if m == nil || strings.TrimSpace(m.APIKeyEncrypted) == "" {
		return
	}
	plain, err := common.DecryptSecret(m.APIKeyEncrypted)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor decrypt api key failed: monitor_id=%d error=%v", m.Id, err))
		m.APIKey = ""
		m.APIKeyDecryptFailed = true
		return
	}
	m.APIKey = plain
	m.APIKeyDecryptFailed = false
}

func runChannelMonitorChecksConcurrent(ctx context.Context, m *model.ChannelMonitor) []*CheckResult {
	models := append([]string{m.PrimaryModel}, m.GetExtraModels()...)
	results := make([]*CheckResult, len(models))
	pingMs := pingChannelMonitorEndpointOrigin(ctx, m.Endpoint)
	opts := &CheckOptions{
		APIMode:          m.APIMode,
		ExtraHeaders:     m.GetExtraHeaders(),
		BodyOverrideMode: m.BodyOverrideMode,
		BodyOverride:     m.GetBodyOverride(),
	}

	var eg errgroup.Group
	var mu sync.Mutex
	for i, modelName := range models {
		i, modelName := i, modelName
		eg.Go(func() error {
			result := runChannelMonitorCheckForModel(ctx, m.Provider, m.APIMode, m.Endpoint, m.APIKey, modelName, opts)
			result.PingLatencyMs = pingMs
			mu.Lock()
			results[i] = result
			mu.Unlock()
			return nil
		})
	}
	_ = eg.Wait()
	return results
}

func persistChannelMonitorCheckResults(ctx context.Context, m *model.ChannelMonitor, results []*CheckResult) {
	rows := make([]*model.ChannelMonitorHistoryRow, 0, len(results))
	for _, result := range results {
		if result == nil {
			continue
		}
		rows = append(rows, &model.ChannelMonitorHistoryRow{
			MonitorID:     m.Id,
			Model:         result.Model,
			Status:        result.Status,
			LatencyMs:     result.LatencyMs,
			PingLatencyMs: result.PingLatencyMs,
			Message:       result.Message,
			CheckedAt:     result.CheckedAt,
		})
	}
	if err := model.InsertChannelMonitorHistoryBatch(rows); err != nil {
		logger.LogError(ctx, fmt.Sprintf("channel monitor insert history failed: monitor_id=%d error=%v", m.Id, err))
	}
	if err := model.MarkChannelMonitorChecked(m.Id, time.Now()); err != nil {
		logger.LogError(ctx, fmt.Sprintf("channel monitor mark checked failed: monitor_id=%d error=%v", m.Id, err))
	}
}

func buildMonitorStatusSummaries(ctx context.Context, ids []int64, primaryByID map[int64]string, extrasByID map[int64][]string) map[int64]MonitorStatusSummary {
	out := make(map[int64]MonitorStatusSummary, len(ids))
	latest, err := model.ListLatestChannelMonitorHistoryForIDs(ids)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor latest query failed: %v", err))
		latest = map[int64][]*model.ChannelMonitorLatest{}
	}
	availability7, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 7)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor 7d availability query failed: %v", err))
		availability7 = map[int64][]*model.ChannelMonitorAvailability{}
	}
	availability15, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 15)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor 15d availability query failed: %v", err))
		availability15 = map[int64][]*model.ChannelMonitorAvailability{}
	}
	availability30, err := model.ComputeChannelMonitorAvailabilityForIDs(ids, 30)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor 30d availability query failed: %v", err))
		availability30 = map[int64][]*model.ChannelMonitorAvailability{}
	}

	for _, id := range ids {
		latestByModel := latestSliceToMap(latest[id])
		availability7ByModel := availabilitySliceToMap(availability7[id])
		availability15ByModel := availabilitySliceToMap(availability15[id])
		availability30ByModel := availabilitySliceToMap(availability30[id])
		primary := primaryByID[id]
		summary := MonitorStatusSummary{ExtraModels: []ExtraModelStatus{}}
		if row := latestByModel[primary]; row != nil {
			summary.PrimaryStatus = row.Status
			summary.PrimaryLatencyMs = row.LatencyMs
			summary.PrimaryPingLatencyMs = row.PingLatencyMs
			summary.PrimaryCheckedAt = &row.CheckedAt
		}
		if av := availability7ByModel[primary]; av != nil {
			summary.Availability7d = av.AvailabilityPct
		}
		if av := availability15ByModel[primary]; av != nil {
			summary.Availability15d = av.AvailabilityPct
		}
		if av := availability30ByModel[primary]; av != nil {
			summary.Availability30d = av.AvailabilityPct
		}
		for _, extra := range extrasByID[id] {
			status := ExtraModelStatus{Model: extra}
			if row := latestByModel[extra]; row != nil {
				status.Status = row.Status
				status.LatencyMs = row.LatencyMs
			}
			summary.ExtraModels = append(summary.ExtraModels, status)
		}
		out[id] = summary
	}
	return out
}

func latestSliceToMap(items []*model.ChannelMonitorLatest) map[string]*model.ChannelMonitorLatest {
	out := make(map[string]*model.ChannelMonitorLatest, len(items))
	for _, item := range items {
		out[item.Model] = item
	}
	return out
}

func availabilitySliceToMap(items []*model.ChannelMonitorAvailability) map[string]*model.ChannelMonitorAvailability {
	out := make(map[string]*model.ChannelMonitorAvailability, len(items))
	for _, item := range items {
		out[item.Model] = item
	}
	return out
}
