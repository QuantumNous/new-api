package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	assetModelWorkerBatchSize    = 50
	assetModelWorkerPollInterval = time.Second
	assetModelReadinessLeaseTTL  = 30 * time.Second
	assetModelTargetLeaseTTL     = 15 * time.Second
	assetModelGenerationWindow   = 5 * time.Minute
)

var assetModelRetrySchedule = []time.Duration{5 * time.Second, 15 * time.Second, 30 * time.Second, 60 * time.Second}

const (
	assetModelEventSelection         = "selection"
	assetModelEventCacheHit          = "cache_hit"
	assetModelEventRotation          = "rotation"
	assetModelEventWrite             = "write"
	assetModelEventThrottle          = "throttle"
	assetModelEventWindowExhausted   = "window_exhausted"
	assetModelEventActivationLatency = "activation_latency"
	assetModelEventRetry             = "retry"
)

type assetModelReadinessWorkerConfig struct {
	Owner    string
	Interval time.Duration
}

type assetModelWorkerEvent struct {
	Name          string
	PublicAssetID string
	Model         string
	Generation    int64
	ChannelID     int
	ErrorClass    string
	Attempt       int
	RetryDelay    time.Duration
	Elapsed       time.Duration
}

var assetModelWorkerEventSink = func(ctx context.Context, event assetModelWorkerEvent) {
	logger.LogInfo(ctx, formatAssetModelWorkerEvent(event))
}

type assetModelBindingRetryError struct {
	class      string
	retryAfter time.Duration
}

func (e assetModelBindingRetryError) Error() string {
	return "asset model binding retry"
}

type assetModelBindingDefinitiveError struct {
	class string
}

func (e assetModelBindingDefinitiveError) Error() string {
	return "asset model binding definitive failure"
}

func StartAssetModelReadinessWorker() {
	startAssetModelReadinessWorkerWithConfig(context.Background(), assetModelReadinessWorkerConfig{})
}

func startAssetModelReadinessWorkerWithConfig(ctx context.Context, cfg assetModelReadinessWorkerConfig) {
	owner := strings.TrimSpace(cfg.Owner)
	if owner == "" {
		owner = strings.TrimSpace(os.Getenv("ASSET_MODEL_WORKER_OWNER"))
	}
	if owner == "" {
		owner, _ = os.Hostname()
	}
	if owner == "" {
		owner = fmt.Sprintf("asset-model-worker-%d", time.Now().UnixNano())
	}
	interval := cfg.Interval
	if interval <= 0 {
		interval = assetModelWorkerPollInterval
	}
	gopool.Go(func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			now, err := model.GetDBTimestampWithContext(ctx)
			if err != nil {
				common.SysError("asset model worker timestamp error: " + err.Error())
			} else if _, err := RunAssetModelReadinessBatch(ctx, owner, time.Unix(now, 0)); err != nil {
				common.SysError("asset model worker error: " + err.Error())
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	})
}

func RunAssetModelReadinessBatch(ctx context.Context, owner string, now time.Time) (int, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	owner = strings.TrimSpace(owner)
	if owner == "" {
		owner = fmt.Sprintf("asset-model-worker-%d", time.Now().UnixNano())
	}
	nowUnix := now.Unix()
	rows, err := model.ListDueAssetModelReadiness(nowUnix, assetModelWorkerBatchSize)
	if err != nil {
		return 0, err
	}
	processed := 0
	var errs []error
	for _, due := range rows {
		leaseExpiresAt := nowUnix + int64(assetModelReadinessLeaseTTL.Seconds())
		claimed, err := model.ClaimAssetModelReadinessLease(due.Id, owner, nowUnix, leaseExpiresAt)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if !claimed {
			continue
		}
		row, err := loadAssetModelReadinessByID(due.Id)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		processed++
		if err := PrepareAssetModelReadiness(ctx, row, owner, now); err != nil {
			errs = append(errs, err)
		}
	}
	return processed, errors.Join(errs...)
}

func PrepareAssetModelReadiness(ctx context.Context, row model.AssetModelReadiness, owner string, now time.Time) error {
	if ctx == nil {
		ctx = context.Background()
	}
	owner = strings.TrimSpace(owner)
	nowUnix := now.Unix()
	if owner == "" || row.Id <= 0 || row.AssetId <= 0 {
		return nil
	}

	var asset model.Asset
	if err := model.DB.First(&asset, row.AssetId).Error; err != nil {
		return err
	}
	if !assetReferenceSourceRecoverable(assetReferenceAsset{
		Status:          asset.Status,
		AssetType:       asset.AssetType,
		SourceStatus:    asset.SourceStatus,
		StorageBackend:  asset.StorageBackend,
		StorageBucket:   asset.StorageBucket,
		ObjectKey:       asset.ObjectKey,
		SourceExpiresAt: asset.SourceExpiresAt,
	}) {
		return finishAssetModelReadinessFailed(row, owner, nowUnix, "source_unavailable")
	}

	target, err := model.GetAssetModelCoverageTarget(row.ScopeKey, row.ModelName)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
		}
		return err
	}
	if target.Status != model.AssetModelTargetStatusActive {
		if target.Status == model.AssetModelTargetStatusUnavailable {
			return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
		}
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
	}
	if !assetModelReadinessMatchesTarget(row, *target) {
		targetChanged := row.TargetGeneration != target.Generation
		adopted, err := adoptAssetModelReadinessTarget(row, *target, owner, nowUnix)
		if err != nil || !adopted {
			return err
		}
		row.TargetGeneration = target.Generation
		row.ChannelId = target.ChannelId
		row.BindingScope = target.BindingScope
		if targetChanged {
			row.AttemptCount = 1
			row.AttemptStartedAt = nowUnix
		}
	}
	if row.AttemptStartedAt > 0 && nowUnix-row.AttemptStartedAt >= int64(assetModelGenerationWindow.Seconds()) {
		recordAssetModelWorkerEvent(ctx, assetModelWorkerEvent{
			Name:          assetModelEventWindowExhausted,
			PublicAssetID: asset.PublicId,
			Model:         row.ModelName,
			Generation:    row.TargetGeneration,
			ChannelID:     row.ChannelId,
			Attempt:       row.AttemptCount,
			Elapsed:       time.Duration(nowUnix-row.AttemptStartedAt) * time.Second,
		})
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix, false)
	}

	channel, err := loadAssetModelReadinessChannel(target.ChannelId)
	if err != nil {
		return err
	}
	eligible, err := AssetModelTargetIsEligible(assetModelScopeFromTarget(*target), *target)
	if err != nil {
		return err
	}
	if !eligible {
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix, false)
	}
	options, _, err := ResolveAssetModelTargetOptions(*target, channel)
	if err != nil {
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix, true)
	}

	binding, err := prepareAssetModelBinding(ctx, asset, *target, channel, options, owner, nowUnix)
	if err == nil {
		if !activeAssetBinding(binding) ||
			binding.ChannelId != target.ChannelId ||
			binding.BindingScope != target.BindingScope {
			return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
		}
		return finishAssetModelReadinessActive(row, owner, nowUnix)
	}

	var retryErr assetModelBindingRetryError
	if errors.As(err, &retryErr) || errors.Is(err, ErrAssetBindingInitializing) {
		if row.AttemptStartedAt > 0 && nowUnix-row.AttemptStartedAt >= int64(assetModelGenerationWindow.Seconds()) {
			recordAssetModelWorkerEvent(ctx, assetModelWorkerEvent{
				Name:          assetModelEventWindowExhausted,
				PublicAssetID: asset.PublicId,
				Model:         row.ModelName,
				Generation:    row.TargetGeneration,
				ChannelID:     row.ChannelId,
				Attempt:       row.AttemptCount,
				Elapsed:       time.Duration(nowUnix-row.AttemptStartedAt) * time.Second,
			})
			return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix, false)
		}
		class := retryErr.class
		if class == "" {
			class = AssetMaterializeErrorProcessing
		}
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, class, retryErr.retryAfter)
	}
	var definitiveErr assetModelBindingDefinitiveError
	if errors.As(err, &definitiveErr) {
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix, true)
	}
	return finishAssetModelReadinessFailed(row, owner, nowUnix, AssetMaterializeErrorInternal)
}

func prepareAssetModelBinding(ctx context.Context, asset model.Asset, target model.AssetModelCoverageTarget, channel *model.Channel, options AssetMaterializeOptions, owner string, nowUnix int64) (*model.AssetBinding, error) {
	existing, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if activeAssetBinding(existing) {
		return existing, nil
	}
	if processingAssetBinding(existing) {
		result, err := refreshProcessingAssetBinding(ctx, &asset, channel, target.BindingScope, options.Model, options.APIKey, existing.UpstreamAssetId, 1, 0)
		if err == nil {
			return &result.Binding, nil
		}
		if IsRetryableAssetMaterializeError(err) {
			return nil, assetModelBindingRetryError{class: AssetMaterializeErrorClass(err), retryAfter: assetModelRetryAfter(err)}
		}
		if errors.Is(err, ErrAssetBindingInitializing) {
			return nil, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
		}
		return nil, assetModelBindingDefinitiveError{class: AssetMaterializeErrorDefinitive}
	}
	binding, _, err := model.CreateAssetBindingForScopeIfAbsent(asset.Id, target.ChannelId, target.BindingScope, nowUnix)
	if err != nil {
		return nil, err
	}
	if activeAssetBinding(binding) {
		return binding, nil
	}
	claimed, err := model.ClaimAssetBindingForScopeLease(asset.Id, target.ChannelId, target.BindingScope, owner, nowUnix, nowUnix+int64(assetModelTargetLeaseTTL.Seconds()))
	if err != nil {
		return nil, err
	}
	if !claimed {
		return nil, ErrAssetBindingInitializing
	}
	materializer, ok := assetMaterializerForChannel(channel.Type)
	if !ok {
		_, _ = model.FailAssetBindingForScopeCAS(asset.Id, target.ChannelId, target.BindingScope, owner, "asset_channel_unavailable", nowUnix)
		return nil, assetModelBindingDefinitiveError{class: "asset_channel_unavailable"}
	}
	recordAssetModelWorkerEvent(ctx, assetModelWorkerEvent{
		Name:          assetModelEventWrite,
		PublicAssetID: asset.PublicId,
		Model:         target.ModelName,
		Generation:    target.Generation,
		ChannelID:     target.ChannelId,
	})
	result, err := materializer.CreateAsset(ctx, AssetMaterializeInput{
		UserID:     asset.UserId,
		Asset:      asset,
		Channel:    channel,
		Model:      options.Model,
		APIKey:     options.APIKey,
		SignSource: signAssetBindingSourceURL,
	})
	if err != nil {
		class := AssetMaterializeErrorClass(err)
		if IsRetryableAssetMaterializeError(err) {
			_, _ = model.ReleaseAssetBindingForRetryCAS(asset.Id, target.ChannelId, target.BindingScope, owner, class, nowUnix)
			return nil, assetModelBindingRetryError{class: class, retryAfter: assetModelRetryAfter(err)}
		}
		_, _ = model.FailAssetBindingForScopeCAS(asset.Id, target.ChannelId, target.BindingScope, owner, class, nowUnix)
		return nil, assetModelBindingDefinitiveError{class: class}
	}
	if strings.TrimSpace(result.UpstreamAssetID) == "" || result.Status == model.AssetStatusFailed {
		_, _ = model.FailAssetBindingForScopeCAS(asset.Id, target.ChannelId, target.BindingScope, owner, AssetMaterializeErrorDefinitive, nowUnix)
		return nil, assetModelBindingDefinitiveError{class: AssetMaterializeErrorDefinitive}
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.AssetStatusActive
	}
	activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
		AssetID:         asset.Id,
		ChannelID:       target.ChannelId,
		BindingScope:    target.BindingScope,
		LeaseOwner:      owner,
		UpstreamGroupID: result.UpstreamGroupID,
		UpstreamAssetID: result.UpstreamAssetID,
		Status:          status,
		Now:             nowUnix,
	})
	if err != nil {
		return nil, err
	}
	if !activated {
		return nil, ErrAssetBindingInitializing
	}
	if status == model.AssetStatusProcessing {
		return nil, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	return model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
}

func rotateAssetModelReadinessTarget(row model.AssetModelReadiness, target model.AssetModelCoverageTarget, owner string, nowUnix int64, exhausted bool) error {
	scope := assetModelScopeFromTarget(target)
	candidates, err := AssetModelTargetCandidates(scope, target.ModelName)
	if err != nil {
		return err
	}
	nextIndex := target.CandidateIndex + 1
	if !exhausted && nextIndex >= len(candidates) {
		nextIndex = target.CandidateIndex
	}
	if nextIndex >= len(candidates) || nextIndex < 0 {
		if err := markAssetModelTargetUnavailable(target, nowUnix); err != nil {
			return err
		}
		return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
	}
	leaseExpiresAt := nowUnix + int64(assetModelTargetLeaseTTL.Seconds())
	claimed, err := model.ClaimAssetModelTargetLease(target.ScopeKey, target.ModelName, owner, nowUnix, leaseExpiresAt)
	if err != nil {
		return err
	}
	if !claimed {
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
	}
	current, err := model.GetAssetModelCoverageTarget(target.ScopeKey, target.ModelName)
	if err != nil {
		return err
	}
	if current.Generation != target.Generation || current.CandidateIndex != target.CandidateIndex {
		_, err := model.ResetAssetModelReadinessForTargetCAS(row.Id, owner, row.AttemptCount, row.LeaseExpiresAt, *current, nowUnix)
		return err
	}
	next := assetModelCoverageTargetFromCandidate(scope, target.ModelName, candidates[nextIndex], nextIndex)
	published, err := model.PublishAssetModelTargetCAS(target.ScopeKey, target.ModelName, owner, current.Generation, leaseExpiresAt, next, nowUnix)
	if err != nil {
		return err
	}
	if !published {
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
	}
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{
		Name:       assetModelEventRotation,
		Model:      target.ModelName,
		Generation: current.Generation + 1,
		ChannelID:  next.ChannelId,
	})
	updated, err := model.GetAssetModelCoverageTarget(target.ScopeKey, target.ModelName)
	if err != nil {
		return err
	}
	_, err = model.ResetAssetModelReadinessForTargetCAS(row.Id, owner, row.AttemptCount, row.LeaseExpiresAt, *updated, nowUnix)
	return err
}

func finishAssetModelReadinessActive(row model.AssetModelReadiness, owner string, nowUnix int64) error {
	if row.AttemptStartedAt > 0 {
		recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{
			Name:       assetModelEventActivationLatency,
			Model:      row.ModelName,
			Generation: row.TargetGeneration,
			ChannelID:  row.ChannelId,
			Attempt:    row.AttemptCount,
			Elapsed:    time.Duration(nowUnix-row.AttemptStartedAt) * time.Second,
		})
	}
	_, err := model.ActivateAssetModelReadinessCAS(assetModelReadinessTransition(row, owner, nowUnix))
	return err
}

func finishAssetModelReadinessFailed(row model.AssetModelReadiness, owner string, nowUnix int64, class string) error {
	_, err := model.FailAssetModelReadinessCAS(assetModelReadinessTransition(row, owner, nowUnix), class)
	return err
}

func scheduleAssetModelReadinessRetry(row model.AssetModelReadiness, owner string, nowUnix int64, class string, retryAfter time.Duration) error {
	delay := assetModelRetryDelay(row.AttemptCount, retryAfter)
	nextRetryAt := nowUnix + int64(delay.Seconds())
	eventName := assetModelEventRetry
	if class == AssetMaterializeErrorThrottled {
		eventName = assetModelEventThrottle
	}
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{
		Name:       eventName,
		Model:      row.ModelName,
		Generation: row.TargetGeneration,
		ChannelID:  row.ChannelId,
		ErrorClass: class,
		Attempt:    row.AttemptCount,
		RetryDelay: delay,
	})
	_, err := model.ScheduleAssetModelReadinessRetryCAS(assetModelReadinessTransition(row, owner, nowUnix), class, nextRetryAt)
	return err
}

func assetModelReadinessTransition(row model.AssetModelReadiness, owner string, nowUnix int64) model.AssetModelReadinessTransition {
	return model.AssetModelReadinessTransition{
		AssetId:                row.AssetId,
		ScopeKey:               row.ScopeKey,
		ModelName:              row.ModelName,
		TargetGeneration:       row.TargetGeneration,
		ChannelId:              row.ChannelId,
		BindingScope:           row.BindingScope,
		LeaseOwner:             owner,
		ExpectedAttemptCount:   row.AttemptCount,
		ExpectedLeaseExpiresAt: row.LeaseExpiresAt,
		Now:                    nowUnix,
	}
}

func adoptAssetModelReadinessTarget(row model.AssetModelReadiness, target model.AssetModelCoverageTarget, owner string, nowUnix int64) (bool, error) {
	updates := map[string]any{
		"target_generation": target.Generation,
		"channel_id":        target.ChannelId,
		"binding_scope":     target.BindingScope,
		"error_class":       "",
		"next_retry_at":     int64(0),
		"updated_at":        nowUnix,
	}
	if row.TargetGeneration != target.Generation {
		updates["attempt_count"] = 1
		updates["attempt_started_at"] = nowUnix
	}
	result := model.DB.Model(&model.AssetModelReadiness{}).
		Where("id = ? AND scope_key = ? AND model_name = ?", row.Id, target.ScopeKey, target.ModelName).
		Where("status = ? AND lease_owner = ? AND attempt_count = ? AND lease_expires_at = ? AND lease_expires_at > ?",
			model.AssetModelReadinessStatusProcessing, owner, row.AttemptCount, row.LeaseExpiresAt, nowUnix).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func assetModelRetryDelay(attemptCount int, retryAfter time.Duration) time.Duration {
	if attemptCount <= 0 {
		attemptCount = 1
	}
	index := attemptCount - 1
	if index >= len(assetModelRetrySchedule) {
		index = len(assetModelRetrySchedule) - 1
	}
	delay := assetModelRetrySchedule[index]
	if retryAfter > delay {
		return retryAfter
	}
	return delay
}

func assetModelRetryAfter(err error) time.Duration {
	var failure *AssetMaterializeFailure
	if errors.As(err, &failure) && failure != nil && failure.RetryAfter > 0 {
		return failure.RetryAfter
	}
	return 0
}

func assetModelReadinessMatchesTarget(row model.AssetModelReadiness, target model.AssetModelCoverageTarget) bool {
	return row.TargetGeneration == target.Generation &&
		row.ChannelId == target.ChannelId &&
		row.BindingScope == target.BindingScope
}

func assetModelScopeFromTarget(target model.AssetModelCoverageTarget) AssetModelScope {
	return AssetModelScope{
		ScopeKey:          target.ScopeKey,
		Groups:            strings.Split(target.RoutingGroups, ","),
		ModelNames:        []string{target.ModelName},
		SpecificChannelID: target.SpecificChannelId,
	}
}

func loadAssetModelReadinessByID(id int64) (model.AssetModelReadiness, error) {
	var row model.AssetModelReadiness
	err := model.DB.First(&row, id).Error
	return row, err
}

func loadAssetModelReadinessChannel(channelID int) (*model.Channel, error) {
	var channel model.Channel
	if err := model.DB.First(&channel, channelID).Error; err != nil {
		return nil, err
	}
	return &channel, nil
}

func markAssetModelTargetUnavailable(target model.AssetModelCoverageTarget, nowUnix int64) error {
	return model.DB.Model(&model.AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ? AND generation = ?", target.ScopeKey, target.ModelName, target.Generation).
		Updates(map[string]any{
			"status":           model.AssetModelTargetStatusUnavailable,
			"generation":       gorm.Expr("generation + ?", 1),
			"lease_owner":      "",
			"lease_expires_at": int64(0),
			"updated_at":       nowUnix,
		}).Error
}

func recordAssetModelWorkerEvent(ctx context.Context, event assetModelWorkerEvent) {
	event.Name = strings.TrimSpace(event.Name)
	if event.Name == "" {
		return
	}
	assetModelWorkerEventSink(ctx, event)
}

func formatAssetModelWorkerEvent(event assetModelWorkerEvent) string {
	return fmt.Sprintf(
		"asset_model_event=%s public_asset_id=%s model=%s generation=%d channel_id=%d error_class=%s attempt=%d retry_delay_ms=%d elapsed_ms=%d",
		strings.TrimSpace(event.Name),
		strings.TrimSpace(event.PublicAssetID),
		strings.TrimSpace(event.Model),
		event.Generation,
		event.ChannelID,
		strings.TrimSpace(event.ErrorClass),
		event.Attempt,
		event.RetryDelay.Milliseconds(),
		event.Elapsed.Milliseconds(),
	)
}
