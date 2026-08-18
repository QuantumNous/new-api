package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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
	assetModelProviderCallBuffer = 30 * time.Second
)

var assetModelRetrySchedule = []time.Duration{5 * time.Second, 15 * time.Second, 30 * time.Second, 60 * time.Second}
var assetModelWorkerFinalPreflightHook func()
var assetModelWorkerDBTimestamp = model.GetDBTimestampWithContext

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

type assetModelTargetUnavailableError struct{}

func (e assetModelTargetUnavailableError) Error() string {
	return "asset model target unavailable"
}

func StartAssetModelReadinessWorker() {
	startAssetModelReadinessWorkerWithConfig(context.Background(), assetModelReadinessWorkerConfig{})
}

func assetModelReadinessWorkerOwner(configured string) string {
	base := strings.TrimSpace(configured)
	if base == "" {
		base = strings.TrimSpace(os.Getenv("ASSET_MODEL_WORKER_OWNER"))
	}
	if base == "" {
		base, _ = os.Hostname()
		base = strings.TrimSpace(base)
	}
	if base == "" {
		base = "asset-model-worker"
	}
	return fmt.Sprintf("%s-%s", base, assetModelWorkerRandomSuffix())
}

func assetModelWorkerRandomSuffix() string {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err == nil {
		return hex.EncodeToString(buf[:])
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func startAssetModelReadinessWorkerWithConfig(ctx context.Context, cfg assetModelReadinessWorkerConfig) {
	owner := assetModelReadinessWorkerOwner(cfg.Owner)
	interval := cfg.Interval
	if interval <= 0 {
		interval = assetModelWorkerPollInterval
	}
	gopool.Go(func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			now, err := assetModelWorkerDBTimestamp(ctx)
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
		owner = assetModelReadinessWorkerOwner("")
	}
	nowUnix := now.Unix()
	rows, err := model.ListDueAssetModelReadiness(nowUnix, assetModelWorkerBatchSize)
	if err != nil {
		return 0, err
	}
	processed := 0
	var errs []error
	for _, due := range rows {
		currentNowUnix, err := assetModelWorkerDBTimestamp(ctx)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		leaseExpiresAt := currentNowUnix + int64(assetModelReadinessLeaseTTL.Seconds())
		claimed, err := model.ClaimAssetModelReadinessLease(due.Id, owner, currentNowUnix, leaseExpiresAt)
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
		if err := PrepareAssetModelReadiness(ctx, row, owner, time.Unix(currentNowUnix, 0)); err != nil {
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
			return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
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
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix)
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
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
	}
	if AssetModelChannelUsesSourceURLForChannel(channel) && target.BindingScope == assetModelSourceURLBindingScopeModelAPI {
		if channel.Status != common.ChannelStatusEnabled || !assetModelTargetMatchesCurrentChannel(*target, channel) {
			return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
		}
		if !assetModelSourceRecoverable(asset) {
			return finishAssetModelReadinessFailed(row, owner, nowUnix, "source_unavailable")
		}
		return finishAssetModelReadinessActive(row, owner, nowUnix)
	}
	options, _, err := ResolveAssetModelTargetOptions(*target, channel)
	if err != nil {
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, AssetMaterializeErrorProcessing, 0)
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
			return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix)
		}
		class := retryErr.class
		if class == "" {
			class = AssetMaterializeErrorProcessing
		}
		return scheduleAssetModelReadinessRetry(row, owner, nowUnix, class, retryErr.retryAfter)
	}
	var targetUnavailableErr assetModelTargetUnavailableError
	if errors.As(err, &targetUnavailableErr) {
		return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
	}
	var definitiveErr assetModelBindingDefinitiveError
	if errors.As(err, &definitiveErr) {
		return rotateAssetModelReadinessTarget(row, *target, owner, nowUnix)
	}
	return finishAssetModelReadinessFailed(row, owner, nowUnix, AssetMaterializeErrorInternal)
}

func prepareAssetModelBinding(ctx context.Context, asset model.Asset, target model.AssetModelCoverageTarget, channel *model.Channel, options AssetMaterializeOptions, owner string, nowUnix int64) (*model.AssetBinding, error) {
	if !channelCanConsumeAssetType(channel, asset.AssetType) {
		return nil, assetModelBindingDefinitiveError{class: AssetMaterializeErrorDefinitive}
	}
	existing, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if activeAssetBinding(existing) {
		return existing, nil
	}
	if processingAssetBinding(existing) {
		result, handled, err := handleProcessingAssetBinding(ctx, &asset, channel, target.BindingScope, options.Model, options.APIKey, existing.UpstreamAssetId, 1, 0)
		if err != nil {
			if !handled {
				return nil, err
			}
			if IsRetryableAssetMaterializeError(err) {
				return nil, assetModelBindingRetryError{class: AssetMaterializeErrorClass(err), retryAfter: assetModelRetryAfter(err)}
			}
			if errors.Is(err, ErrAssetBindingInitializing) {
				return nil, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
			}
			return nil, assetModelBindingDefinitiveError{class: AssetMaterializeErrorDefinitive}
		}
		if handled {
			return &result.Binding, nil
		}
	}
	binding, _, err := model.CreateAssetBindingForScopeIfAbsent(asset.Id, target.ChannelId, target.BindingScope, nowUnix)
	if err != nil {
		return nil, err
	}
	if activeAssetBinding(binding) {
		return binding, nil
	}
	bindingLeaseExpiresAt := nowUnix + int64(assetBindingDefaultLeaseTTL.Seconds())
	claimed, err := model.ClaimAssetBindingForScopeLease(asset.Id, target.ChannelId, target.BindingScope, owner, nowUnix, bindingLeaseExpiresAt)
	if err != nil {
		return nil, err
	}
	if !claimed {
		return nil, ErrAssetBindingInitializing
	}
	if assetModelWorkerFinalPreflightHook != nil {
		assetModelWorkerFinalPreflightHook()
	}
	currentTarget, currentChannel, currentOptions, err := finalPreflightAssetModelProviderWrite(target)
	if err != nil {
		_, _ = model.ReleaseAssetBindingForRetryLeaseCAS(asset.Id, target.ChannelId, target.BindingScope, owner, bindingLeaseExpiresAt, AssetMaterializeErrorProcessing, nowUnix)
		return nil, err
	}
	materializer, err := assetMaterializerForChannel(currentChannel)
	if err != nil || materializer == nil {
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, target.ChannelId, target.BindingScope, owner, bindingLeaseExpiresAt, "asset_channel_unavailable", nowUnix)
		return nil, assetModelBindingDefinitiveError{class: "asset_channel_unavailable"}
	}
	recordAssetModelWorkerEvent(ctx, assetModelWorkerEvent{
		Name:          assetModelEventWrite,
		PublicAssetID: asset.PublicId,
		Model:         currentTarget.ModelName,
		Generation:    currentTarget.Generation,
		ChannelID:     currentTarget.ChannelId,
	})
	providerCtx, cancel := assetModelProviderCallContext(ctx)
	defer cancel()
	result, err := materializer.CreateAsset(providerCtx, AssetMaterializeInput{
		UserID:         asset.UserId,
		Asset:          asset,
		Channel:        currentChannel,
		Model:          currentOptions.Model,
		APIKey:         currentOptions.APIKey,
		IdempotencyKey: assetBindingIdempotencyKey(asset.SHA256, asset.Id, currentTarget.ChannelId, currentTarget.BindingScope),
		SignSource:     signAssetBindingSourceURL,
	})
	if err != nil {
		class := AssetMaterializeErrorClass(err)
		if IsRetryableAssetMaterializeError(err) {
			_, _ = model.ReleaseAssetBindingForRetryLeaseCAS(asset.Id, target.ChannelId, target.BindingScope, owner, bindingLeaseExpiresAt, class, nowUnix)
			return nil, assetModelBindingRetryError{class: class, retryAfter: assetModelRetryAfter(err)}
		}
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, target.ChannelId, target.BindingScope, owner, bindingLeaseExpiresAt, class, nowUnix)
		return nil, assetModelBindingDefinitiveError{class: class}
	}
	if strings.TrimSpace(result.UpstreamAssetID) == "" || result.Status == model.AssetStatusFailed {
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, target.ChannelId, target.BindingScope, owner, bindingLeaseExpiresAt, AssetMaterializeErrorDefinitive, nowUnix)
		return nil, assetModelBindingDefinitiveError{class: AssetMaterializeErrorDefinitive}
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.AssetStatusActive
	}
	activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
		AssetID:                asset.Id,
		ChannelID:              target.ChannelId,
		BindingScope:           target.BindingScope,
		LeaseOwner:             owner,
		ExpectedLeaseExpiresAt: bindingLeaseExpiresAt,
		UpstreamGroupID:        result.UpstreamGroupID,
		UpstreamAssetID:        result.UpstreamAssetID,
		Status:                 status,
		Now:                    nowUnix,
	})
	if err != nil {
		recovered, recoveryErr := recoverAssetBindingAfterProviderResult(ctx, materializer, &asset, currentChannel, target.BindingScope, currentOptions.Model, currentOptions.APIKey, owner, bindingLeaseExpiresAt, result, status, 1, 0)
		if recoveryErr == nil {
			return &recovered.Binding, nil
		}
		return nil, err
	}
	if !activated {
		recovered, recoveryErr := recoverAssetBindingAfterProviderResult(ctx, materializer, &asset, currentChannel, target.BindingScope, currentOptions.Model, currentOptions.APIKey, owner, bindingLeaseExpiresAt, result, status, 1, 0)
		if recoveryErr == nil {
			return &recovered.Binding, nil
		}
		return nil, ErrAssetBindingInitializing
	}
	if status == model.AssetStatusProcessing {
		return nil, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	return model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
}

func finalPreflightAssetModelProviderWrite(target model.AssetModelCoverageTarget) (model.AssetModelCoverageTarget, *model.Channel, AssetMaterializeOptions, error) {
	current, err := model.GetAssetModelCoverageTarget(target.ScopeKey, target.ModelName)
	if err != nil {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, err
	}
	if current.Status == model.AssetModelTargetStatusUnavailable {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelTargetUnavailableError{}
	}
	if !assetModelTargetWriteSnapshotMatches(target, *current) {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	if current.Status != model.AssetModelTargetStatusActive {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	channel, err := loadAssetModelReadinessChannel(current.ChannelId)
	if err != nil {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, err
	}
	scope := assetModelScopeFromTarget(*current)
	eligible, err := AssetModelTargetIsEligible(scope, *current)
	if err != nil {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, err
	}
	if !eligible || !assetModelChannelEligible(scope, channel) || !assetModelTargetMatchesCurrentChannel(*current, channel) {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	options, _, err := ResolveAssetModelTargetOptions(*current, channel)
	if err != nil {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	bindingScope, err := assetBindingScopeForChannel(channel, options)
	if err != nil {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	if bindingScope != current.BindingScope || bindingScope != target.BindingScope {
		return model.AssetModelCoverageTarget{}, nil, AssetMaterializeOptions{}, assetModelBindingRetryError{class: AssetMaterializeErrorProcessing}
	}
	return *current, channel, options, nil
}

func assetModelTargetMatchesCurrentChannel(target model.AssetModelCoverageTarget, channel *model.Channel) bool {
	for _, candidate := range assetModelCandidatesForChannel(channel, target.ModelName) {
		if candidate.ChannelID == target.ChannelId &&
			candidate.MappedModel == target.MappedModel &&
			candidate.BindingScope == target.BindingScope &&
			candidate.CredentialIndex == target.CredentialIndex {
			return true
		}
	}
	return false
}

func assetModelTargetWriteSnapshotMatches(expected, current model.AssetModelCoverageTarget) bool {
	return strings.TrimSpace(expected.ScopeKey) == strings.TrimSpace(current.ScopeKey) &&
		strings.TrimSpace(expected.ModelName) == strings.TrimSpace(current.ModelName) &&
		expected.Status == current.Status &&
		expected.Generation == current.Generation &&
		expected.ChannelId == current.ChannelId &&
		strings.TrimSpace(expected.MappedModel) == strings.TrimSpace(current.MappedModel) &&
		strings.TrimSpace(expected.BindingScope) == strings.TrimSpace(current.BindingScope) &&
		expected.CredentialIndex == current.CredentialIndex
}

func assetModelProviderCallContext(parent context.Context) (context.Context, context.CancelFunc) {
	timeout := assetBindingDefaultLeaseTTL - assetModelProviderCallBuffer
	if timeout <= 0 {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, timeout)
}

func rotateAssetModelReadinessTarget(row model.AssetModelReadiness, target model.AssetModelCoverageTarget, owner string, nowUnix int64) error {
	scope := assetModelScopeFromTarget(target)
	candidates, err := AssetModelTargetCandidates(scope, target.ModelName)
	if err != nil {
		return err
	}
	nextIndex := 0
	matched := false
	for i, candidate := range candidates {
		if assetModelTargetMatchesCandidate(target, candidate) {
			nextIndex = i + 1
			matched = true
			break
		}
	}
	if !matched {
		if len(candidates) == 0 {
			if err := markAssetModelTargetUnavailable(target, nowUnix); err != nil {
				return err
			}
			return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
		}
		nextIndex = 0
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

func assetModelTargetMatchesCandidate(target model.AssetModelCoverageTarget, candidate AssetModelTargetCandidate) bool {
	return target.ChannelId == candidate.ChannelID &&
		strings.TrimSpace(target.MappedModel) == strings.TrimSpace(candidate.MappedModel) &&
		strings.TrimSpace(target.BindingScope) == strings.TrimSpace(candidate.BindingScope) &&
		target.CredentialIndex == candidate.CredentialIndex
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
	_, err := model.ActivateAssetModelReadinessBindingSetCAS(assetModelReadinessTransition(row, owner, nowUnix))
	return err
}

func finishAssetModelReadinessFailed(row model.AssetModelReadiness, owner string, nowUnix int64, class string) error {
	_, err := model.FailAssetModelReadinessCAS(assetModelReadinessTransition(row, owner, nowUnix), class)
	return err
}

func scheduleAssetModelReadinessRetry(row model.AssetModelReadiness, owner string, nowUnix int64, class string, retryAfter time.Duration) error {
	delay := assetModelRetryDelay(class, row.AttemptCount, retryAfter)
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

func assetModelRetryDelay(class string, attemptCount int, retryAfter time.Duration) time.Duration {
	delay := assetModelRetrySchedule[0]
	if class != AssetMaterializeErrorProcessing {
		if attemptCount <= 0 {
			attemptCount = 1
		}
		index := attemptCount - 1
		if index >= len(assetModelRetrySchedule) {
			index = len(assetModelRetrySchedule) - 1
		}
		delay = assetModelRetrySchedule[index]
	}
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
