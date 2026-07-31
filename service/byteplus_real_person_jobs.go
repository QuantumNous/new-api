package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	bytePlusRealPersonJobInterval = 15 * time.Second
	bytePlusRealPersonJobLease    = 2 * time.Minute
	bytePlusRealPersonJobBatch    = 50
)

type BytePlusRealPersonJobResult struct {
	Processed int
	Err       error
}

var bytePlusRealPersonJobsOnce sync.Once

func StartBytePlusRealPersonJobs() {
	bytePlusRealPersonJobsOnce.Do(func() {
		gopool.Go(func() {
			logBytePlusRealPersonJobError(RunBytePlusRealPersonJobsOnce(context.Background(), bytePlusAssetNow(), bytePlusRealPersonJobBatch))
			ticker := time.NewTicker(bytePlusRealPersonJobInterval)
			defer ticker.Stop()
			for range ticker.C {
				logBytePlusRealPersonJobError(RunBytePlusRealPersonJobsOnce(context.Background(), bytePlusAssetNow(), bytePlusRealPersonJobBatch))
			}
		})
	})
}

func logBytePlusRealPersonJobError(result BytePlusRealPersonJobResult) {
	if result.Err != nil {
		common.SysError("byteplus real-person jobs failed")
	}
}

func RunBytePlusRealPersonJobsOnce(ctx context.Context, now int64, limit int) BytePlusRealPersonJobResult {
	if limit <= 0 {
		limit = bytePlusRealPersonJobBatch
	}
	staleBefore := now - int64(bytePlusRealPersonJobLease.Seconds())
	result := BytePlusRealPersonJobResult{}
	allOK := true

	processed, err := recoverBytePlusRealPersonIdempotency(ctx, now, staleBefore, limit)
	result.Processed += processed
	allOK = recordBytePlusRealPersonOperation("idempotency_recovery", processed, err) && allOK
	if err != nil && result.Err == nil {
		result.Err = err
	}

	operations := []struct {
		name string
		run  func(context.Context, int64, int64, int) (int, error)
	}{
		{name: "verification_status", run: runBytePlusRealPersonVerificationStatusJobs},
		{name: "asset_status", run: runBytePlusRealPersonAssetStatusJobs},
		{name: "asset_delete", run: runBytePlusRealPersonAssetDeleteJobs},
		{name: "tos_cleanup", run: runBytePlusRealPersonTOSCleanupJobs},
	}
	for _, operation := range operations {
		processed, err = operation.run(ctx, now, staleBefore, limit)
		result.Processed += processed
		allOK = recordBytePlusRealPersonOperation(operation.name, processed, err) && allOK
		if err != nil && result.Err == nil {
			result.Err = err
		}
	}

	deleted, err := model.DeleteExpiredSafeAPIIdempotencyRecords(now, limit)
	result.Processed += deleted
	allOK = recordBytePlusRealPersonOperation("idempotency_retention", deleted, err) && allOK
	if err != nil && result.Err == nil {
		result.Err = err
	}

	if allOK {
		snapshot, err := model.GetBytePlusRealPersonBacklogSnapshot(now, staleBefore)
		if err != nil {
			result.Err = err
			return result
		}
		perfmetrics.SetBytePlusRealPersonBacklog("deleting", snapshot.DeletingCount, snapshot.DeletingOldestUpdateAgeSeconds)
		perfmetrics.SetBytePlusRealPersonBacklog("tos_cleanup_due", snapshot.TOSCleanupDueCount, snapshot.TOSCleanupDueOldestUpdateAgeSeconds)
		perfmetrics.MarkBytePlusRealPersonReconcileSuccess(now)
	}
	return result
}

func recoverBytePlusRealPersonIdempotency(ctx context.Context, now, staleBefore int64, limit int) (int, error) {
	records, err := model.MarkStaleAPIIdempotencyOutcomeUnknown(staleBefore, now, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, record := range records {
		resource := strings.TrimSpace(record.ResourceType)
		if resource != model.APIIdempotencyResourceAsset && resource != model.APIIdempotencyResourceVerificationSession {
			continue
		}
		perfmetrics.RecordBytePlusRealPersonOutcomeUnknown(resource)
		if err := reconcileBytePlusOutcomeUnknownResource(ctx, record, now); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		processed++
	}
	return processed, firstErr
}

func reconcileBytePlusOutcomeUnknownResource(_ context.Context, record model.APIIdempotencyRecord, now int64) error {
	switch record.ResourceType {
	case model.APIIdempotencyResourceAsset:
		_, err := model.MarkBytePlusAssetOutcomeUnknown(record.ResourcePublicId, now)
		return err
	case model.APIIdempotencyResourceVerificationSession:
		_, err := model.MarkBytePlusVerificationSessionOutcomeUnknown(record.ResourcePublicId, now)
		return err
	default:
		return nil
	}
}

func runBytePlusRealPersonVerificationStatusJobs(ctx context.Context, now, staleBefore int64, limit int) (int, error) {
	sessions, err := model.ClaimDueBytePlusVisualValidationSessions(now, staleBefore, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, session := range sessions {
		profile, err := model.GetBytePlusRealPersonProfileByID(session.ProfileId)
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		if session.ExpiresAt > 0 && session.ExpiresAt <= now {
			if ok, err := model.ExpireBytePlusRealPersonSession(profile.Id, session.Id, now); err != nil && !errors.Is(err, model.ErrAPIIdempotencyCASLost) {
				firstErr = firstNonNil(firstErr, err)
			} else if ok {
				processed++
			}
			continue
		}
		cipher, err := bytePlusRealPersonCipherFactory()
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		bytedToken, err := cipher.Decrypt(session.PublicId, bytePlusSensitiveFieldBytedToken, session.BytedTokenCiphertext)
		if err != nil {
			_, _ = model.FailBytePlusRealPersonSession(profile.Id, session.Id, "verification_secret_unreadable", now)
			processed++
			continue
		}
		channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, profile.UserId, "")
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		client, err := realPersonClientForChannel(channel)
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		upstream, err := client.GetVisualValidateResult(ctx, creds, bytedToken)
		if err != nil {
			if isBytePlusDefinitiveResponse(err) {
				if ok, err := model.FailBytePlusRealPersonSession(profile.Id, session.Id, "verification_upstream_error", now); err != nil && !errors.Is(err, model.ErrAPIIdempotencyCASLost) {
					firstErr = firstNonNil(firstErr, err)
				} else if ok {
					processed++
				}
				continue
			}
			firstErr = firstNonNil(firstErr, retryBytePlusVerificationStatus(session, now))
			continue
		}
		if strings.TrimSpace(upstream.GroupID) != "" {
			if _, err := model.ActivateBytePlusRealPersonProfile(profile.Id, session.Id, upstream.GroupID, now); err != nil && !errors.Is(err, model.ErrAPIIdempotencyCASLost) {
				firstErr = firstNonNil(firstErr, err)
				continue
			}
			processed++
		}
	}
	return processed, firstErr
}

func retryBytePlusVerificationStatus(session model.BytePlusVisualValidationSession, now int64) error {
	ok, err := model.RetryBytePlusVisualValidationSession(session.Id, session.LeaseUpdatedTime, now+bytePlusAssetDeleteRetryDelaySecs, now)
	if err != nil {
		return err
	}
	if !ok {
		return model.ErrAPIIdempotencyCASLost
	}
	perfmetrics.RecordBytePlusRealPersonReconcile("verification_status", "retry")
	return nil
}

func runBytePlusRealPersonAssetStatusJobs(ctx context.Context, now, staleBefore int64, limit int) (int, error) {
	assets, err := model.ClaimDueBytePlusAssetStatusChecks(now, staleBefore, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, asset := range assets {
		channel, creds, err := loadUsableBytePlusRealPersonChannel(asset.ChannelId, asset.UserId, "")
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		client, err := realPersonClientForChannel(channel)
		if err != nil {
			firstErr = firstNonNil(firstErr, err)
			continue
		}
		status, err := client.GetAsset(ctx, creds, asset.UpstreamAssetId)
		if err != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusAssetStatusCheck(asset, now))
			continue
		}
		if status.UpstreamAssetID != "" && status.UpstreamAssetID != asset.UpstreamAssetId {
			continue
		}
		if err := model.UpdateBytePlusAssetStatus(asset.Id, status.Status, status.ErrorMessage, now); err != nil {
			if !errors.Is(err, model.ErrBytePlusAssetNotUpdatable) {
				firstErr = firstNonNil(firstErr, err)
			}
			continue
		}
		if status.Status != model.BytePlusAssetStatusProcessing {
			processed++
		}
	}
	return processed, firstErr
}

func retryBytePlusAssetStatusCheck(asset model.BytePlusAsset, now int64) error {
	ok, err := model.RetryBytePlusAssetStatusCheck(asset.Id, asset.UpdatedTime, now+bytePlusAssetDeleteRetryDelaySecs)
	if err != nil {
		return err
	}
	if !ok {
		return model.ErrAPIIdempotencyCASLost
	}
	perfmetrics.RecordBytePlusRealPersonReconcile("asset_status", "retry")
	return nil
}

func runBytePlusRealPersonAssetDeleteJobs(ctx context.Context, now, staleBefore int64, limit int) (int, error) {
	assets, err := model.ClaimDueBytePlusAssetDeletions(now, staleBefore, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, asset := range assets {
		if strings.TrimSpace(asset.UpstreamAssetId) == "" {
			if ok, err := model.CompleteBytePlusAssetDeletion(asset.Id, asset.DeleteLeaseUpdatedTime, now); err != nil {
				firstErr = firstNonNil(firstErr, err)
			} else if ok {
				processed++
			}
			continue
		}
		channel, creds, err := loadUsableBytePlusRealPersonChannel(asset.ChannelId, asset.UserId, "")
		if err != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusAssetDeletion(asset, now))
			continue
		}
		client, err := realPersonClientForChannel(channel)
		if err != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusAssetDeletion(asset, now))
			continue
		}
		_, err = client.DeleteAsset(ctx, creds, asset.UpstreamAssetId)
		if err == nil || isBytePlusNotFound(err) {
			if ok, err := model.CompleteBytePlusAssetDeletion(asset.Id, asset.DeleteLeaseUpdatedTime, now); err != nil {
				firstErr = firstNonNil(firstErr, err)
			} else if ok {
				processed++
			}
			continue
		}
		firstErr = firstNonNil(firstErr, retryBytePlusAssetDeletion(asset, now))
	}
	return processed, firstErr
}

func retryBytePlusAssetDeletion(asset model.BytePlusAsset, now int64) error {
	ok, err := model.RetryBytePlusAssetDeletion(asset.Id, asset.DeleteLeaseUpdatedTime, now+bytePlusAssetDeleteRetryDelaySecs, now)
	if err != nil {
		return err
	}
	if !ok {
		return model.ErrAPIIdempotencyCASLost
	}
	perfmetrics.RecordBytePlusRealPersonReconcile("asset_delete", "retry")
	return nil
}

func runBytePlusRealPersonTOSCleanupJobs(ctx context.Context, now, staleBefore int64, limit int) (int, error) {
	objects, err := model.ClaimDueBytePlusTempObjectCleanups(now, staleBefore, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, object := range objects {
		if object.AssetId != nil && object.SignedURLExpiresAt > 0 && object.SignedURLExpiresAt <= now {
			_ = finalBytePlusAssetStatusProbe(ctx, *object.AssetId)
		}
		channelID := object.ChannelId
		if object.AssetId != nil {
			if asset, err := model.GetBytePlusAssetByID(*object.AssetId); err == nil {
				channelID = asset.ChannelId
			}
		}
		channel, err := model.GetChannelById(channelID, true)
		if err != nil || !bytePlusAssetChannelIsUsable(channel) {
			firstErr = firstNonNil(firstErr, retryBytePlusTempObjectCleanup(object, now))
			continue
		}
		creds, err := ParseBytePlusCredentials(channel.Key)
		if err != nil || creds.ValidateRealPersonAssets() != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusTempObjectCleanup(object, now))
			continue
		}
		store, err := bytePlusTempObjectStoreFactory(creds)
		if err != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusTempObjectCleanup(object, now))
			continue
		}
		if err := store.DeleteObject(ctx, object.ObjectKey); err != nil {
			firstErr = firstNonNil(firstErr, retryBytePlusTempObjectCleanup(object, now))
			continue
		}
		if ok, err := model.CompleteBytePlusAssetTempObjectCleanup(object.Id, object.CleanupLeaseUpdatedTime, now); err != nil {
			firstErr = firstNonNil(firstErr, err)
		} else if ok {
			processed++
		}
	}
	return processed, firstErr
}

func finalBytePlusAssetStatusProbe(ctx context.Context, assetID int64) error {
	asset, err := model.GetBytePlusAssetByID(assetID)
	if err != nil || asset.Status != model.BytePlusAssetStatusProcessing || strings.TrimSpace(asset.UpstreamAssetId) == "" {
		return err
	}
	channel, creds, err := loadUsableBytePlusRealPersonChannel(asset.ChannelId, asset.UserId, "")
	if err != nil {
		return err
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		return err
	}
	status, err := client.GetAsset(ctx, creds, asset.UpstreamAssetId)
	if err != nil {
		return err
	}
	if status.Status != model.BytePlusAssetStatusProcessing && (status.UpstreamAssetID == "" || status.UpstreamAssetID == asset.UpstreamAssetId) {
		return model.UpdateBytePlusAssetStatus(asset.Id, status.Status, status.ErrorMessage, bytePlusAssetNow())
	}
	return nil
}

func retryBytePlusTempObjectCleanup(object model.BytePlusAssetTempObject, now int64) error {
	ok, err := model.RetryBytePlusAssetTempObjectCleanup(object.Id, object.CleanupLeaseUpdatedTime, now+bytePlusAssetDeleteRetryDelaySecs, now)
	if err != nil {
		return err
	}
	if !ok {
		return model.ErrAPIIdempotencyCASLost
	}
	perfmetrics.RecordBytePlusRealPersonReconcile("tos_cleanup", "retry")
	return nil
}

func recordBytePlusRealPersonOperation(operation string, processed int, err error) bool {
	for i := 0; i < processed; i++ {
		perfmetrics.RecordBytePlusRealPersonReconcile(operation, "success")
	}
	if err != nil {
		perfmetrics.RecordBytePlusRealPersonReconcile(operation, "error")
		return false
	}
	return true
}

func firstNonNil(first, next error) error {
	if first != nil {
		return first
	}
	return next
}
