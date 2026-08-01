package service

import (
	"context"
	"errors"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type bytePlusRealPersonJobsFake struct {
	mu             sync.Mutex
	resultCalls    int
	getAssetCalls  int
	deleteCalls    int
	tosDeletes     []string
	result         BytePlusVisualValidationResult
	resultErr      error
	assetStatus    BytePlusAssetStatus
	getAssetErr    error
	deleteErr      error
	tosDeleteErr   error
	onResult       func()
	onGetAsset     func()
	onDeleteAsset  func()
	onDeleteObject func()
}

func (f *bytePlusRealPersonJobsFake) CreateVisualValidateSession(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationSession, error) {
	return BytePlusVisualValidationSession{}, errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) GetVisualValidateResult(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationResult, error) {
	f.mu.Lock()
	f.resultCalls++
	onResult := f.onResult
	err := f.resultErr
	result := f.result
	f.mu.Unlock()
	if onResult != nil {
		onResult()
	}
	if err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	return result, nil
}

func (f *bytePlusRealPersonJobsFake) CreateAsset(context.Context, BytePlusCredentials, BytePlusCreateAssetRequest) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) CreateAssetGroup(context.Context, BytePlusCredentials, string) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) GetAsset(context.Context, BytePlusCredentials, string) (BytePlusAssetStatus, error) {
	f.mu.Lock()
	f.getAssetCalls++
	onGet := f.onGetAsset
	err := f.getAssetErr
	status := f.assetStatus
	f.mu.Unlock()
	if onGet != nil {
		onGet()
	}
	if err != nil {
		return BytePlusAssetStatus{}, err
	}
	return status, nil
}

func (f *bytePlusRealPersonJobsFake) ListAssets(context.Context, BytePlusCredentials, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return BytePlusListAssetsResult{}, errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) DeleteAsset(context.Context, BytePlusCredentials, string) (string, error) {
	f.mu.Lock()
	f.deleteCalls++
	onDelete := f.onDeleteAsset
	err := f.deleteErr
	f.mu.Unlock()
	if onDelete != nil {
		onDelete()
	}
	if err != nil {
		return "", err
	}
	return "req-delete", nil
}

func (f *bytePlusRealPersonJobsFake) PutObject(context.Context, string, io.Reader, string, int64) error {
	return errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) DeleteObject(_ context.Context, key string) error {
	f.mu.Lock()
	f.tosDeletes = append(f.tosDeletes, key)
	onDelete := f.onDeleteObject
	err := f.tosDeleteErr
	f.mu.Unlock()
	if onDelete != nil {
		onDelete()
	}
	if err != nil {
		return err
	}
	return nil
}

func TestRunBytePlusRealPersonJobsOnceProcessesRowsOnNonMasterNode(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixture(t)
	originalMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = originalMaster })

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 3, result.Processed)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Equal(t, 1, fixture.fake.resultCalls)
	require.Equal(t, 1, fixture.fake.deleteCalls)
	require.Equal(t, []string{"tos-due"}, fixture.fake.tosDeletes)
}

func TestTwoJobRunnersClaimEachRowAtMostOnce(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixture(t)

	var wg sync.WaitGroup
	results := make(chan BytePlusRealPersonJobResult, 2)
	wg.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			results <- RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)
		}()
	}
	wg.Wait()
	close(results)
	total := 0
	for result := range results {
		require.NoError(t, result.Err)
		total += result.Processed
	}

	require.Equal(t, 3, total)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Equal(t, 1, fixture.fake.resultCalls)
	require.Equal(t, 1, fixture.fake.deleteCalls)
	require.Equal(t, []string{"tos-due"}, fixture.fake.tosDeletes)
}

func TestExpiredCallingUpstreamIsMarkedOutcomeUnknownWithoutExternalCall(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	asset := model.BytePlusAsset{PublicId: "ast_unknown", UserId: 7, ChannelId: 101, AssetType: "Image", Status: model.BytePlusAssetStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId, LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, CreatedTime: 100, UpdatedTime: 100}).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 1, result.Processed)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusFailed, asset.Status)
	require.Equal(t, "idempotency_outcome_unknown", asset.FailureCode)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Zero(t, fixture.fake.resultCalls)
	require.Zero(t, fixture.fake.getAssetCalls)
	require.Zero(t, fixture.fake.deleteCalls)
	require.Empty(t, fixture.fake.tosDeletes)
}

func TestSynchronousStaleOutcomeUnknownReplayLeavesScannerToReconcileBoundResources(t *testing.T) {
	cases := []struct {
		name         string
		resourceType string
		route        string
		keyHash      string
		requestHash  string
		seed         func(t *testing.T) string
		assertFailed func(t *testing.T)
	}{
		{
			name:         "asset",
			resourceType: model.APIIdempotencyResourceAsset,
			route:        bytePlusRealPersonAssetCreateRoute,
			keyHash:      strings.Repeat("a", 64),
			requestHash:  strings.Repeat("b", 64),
			seed: func(t *testing.T) string {
				asset := model.BytePlusAsset{PublicId: "ast_sync_stale", UserId: 7, ChannelId: 101, AssetType: "Image", Status: model.BytePlusAssetStatusCreating, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&asset).Error)
				return asset.PublicId
			},
			assertFailed: func(t *testing.T) {
				var asset model.BytePlusAsset
				require.NoError(t, model.DB.First(&asset, "public_id = ?", "ast_sync_stale").Error)
				require.Equal(t, model.BytePlusAssetStatusFailed, asset.Status)
				require.Equal(t, "idempotency_outcome_unknown", asset.FailureCode)
			},
		},
		{
			name:         "verification_session",
			resourceType: model.APIIdempotencyResourceVerificationSession,
			route:        bytePlusRealPersonCreateRoute,
			keyHash:      strings.Repeat("c", 64),
			requestHash:  strings.Repeat("d", 64),
			seed: func(t *testing.T) string {
				profile := model.BytePlusRealPersonProfile{PublicId: "rph_sync_stale", UserId: 7, Name: "A", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&profile).Error)
				session := model.BytePlusVisualValidationSession{PublicId: "rvs_sync_stale", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("e", 64), CallbackTokenCiphertext: "callback", BytedTokenCiphertext: "byted", H5LinkCiphertext: "h5", Status: model.BytePlusVisualValidationSessionStatusCreating, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&session).Error)
				require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
				return session.PublicId
			},
			assertFailed: func(t *testing.T) {
				var session model.BytePlusVisualValidationSession
				require.NoError(t, model.DB.First(&session, "public_id = ?", "rvs_sync_stale").Error)
				require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, session.Status)
				require.Empty(t, session.CallbackTokenCiphertext)
				require.Empty(t, session.BytedTokenCiphertext)
				require.Empty(t, session.H5LinkCiphertext)
				var profile model.BytePlusRealPersonProfile
				require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_sync_stale").Error)
				require.Equal(t, model.BytePlusRealPersonProfileStatusFailed, profile.Status)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			newBytePlusRealPersonJobsFixtureWithoutRows(t)
			publicID := tc.seed(t)
			require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: tc.route, KeyHash: tc.keyHash, RequestHash: tc.requestHash, Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: tc.resourceType, ResourcePublicId: publicID, LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, CreatedTime: 100, UpdatedTime: 100}).Error)
			var warnings []string
			oldWarn := bytePlusRealPersonJobRowWarn
			bytePlusRealPersonJobRowWarn = func(message string) {
				warnings = append(warnings, message)
			}
			t.Cleanup(func() { bytePlusRealPersonJobRowWarn = oldWarn })
			beforeOutcomeUnknown := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_outcome_unknown_total", map[string]string{"resource": tc.resourceType})

			claim, err := model.ClaimAPIIdempotency(7, tc.route, tc.keyHash, tc.requestHash, tc.resourceType, 2000, 1880, 3000)
			require.NoError(t, err)
			require.Equal(t, model.DecisionOutcomeUnknown, claim.Decision)
			var record model.APIIdempotencyRecord
			require.NoError(t, model.DB.First(&record, "route = ? AND key_hash = ?", tc.route, tc.keyHash).Error)
			require.Equal(t, model.APIIdempotencyStatusCallingUpstream, record.Status)

			result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

			require.NoError(t, result.Err)
			require.Equal(t, 1, result.Processed)
			require.Empty(t, warnings)
			require.NoError(t, model.DB.First(&record, record.Id).Error)
			require.Equal(t, model.APIIdempotencyStatusOutcomeUnknown, record.Status)
			tc.assertFailed(t)
			require.EqualValues(t, beforeOutcomeUnknown+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_outcome_unknown_total", map[string]string{"resource": tc.resourceType}))

			result = RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

			require.NoError(t, result.Err)
			require.Zero(t, result.Processed)
			require.Empty(t, warnings)
			require.EqualValues(t, beforeOutcomeUnknown+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_outcome_unknown_total", map[string]string{"resource": tc.resourceType}))
		})
	}
}

func TestBytePlusRealPersonVerificationJobsHandleExpirySuccessDefinitiveAndTransient(t *testing.T) {
	t.Run("expired without upstream call", func(t *testing.T) {
		fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
		profile, session := seedJobVerificationSession(t, "expired", model.BytePlusVisualValidationSessionStatusPending, "byted", 100)

		result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

		require.NoError(t, result.Err)
		require.NoError(t, model.DB.First(&profile, profile.Id).Error)
		require.Equal(t, model.BytePlusRealPersonProfileStatusExpired, profile.Status)
		require.NoError(t, model.DB.First(&session, session.Id).Error)
		require.Equal(t, model.BytePlusVisualValidationSessionStatusExpired, session.Status)
		fixture.fake.mu.Lock()
		defer fixture.fake.mu.Unlock()
		require.Zero(t, fixture.fake.resultCalls)
	})

	t.Run("success activates", func(t *testing.T) {
		fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
		profile, _ := seedJobVerificationSession(t, "success", model.BytePlusVisualValidationSessionStatusPending, "byted", 3000)

		result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

		require.NoError(t, result.Err)
		require.NoError(t, model.DB.First(&profile, profile.Id).Error)
		require.Equal(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
		fixture.fake.mu.Lock()
		defer fixture.fake.mu.Unlock()
		require.Equal(t, 1, fixture.fake.resultCalls)
	})

	t.Run("definitive upstream failure retries while session unexpired", func(t *testing.T) {
		fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
		fixture.fake.resultErr = &BytePlusAPIError{StatusCode: 400, Code: "bad", Definitive: true}
		profile, session := seedJobVerificationSession(t, "definitive", model.BytePlusVisualValidationSessionStatusPending, "byted", 3000)
		bytedCiphertext := session.BytedTokenCiphertext
		beforeRetry := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"})

		result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

		require.NoError(t, result.Err)
		require.Zero(t, result.Processed)
		require.NoError(t, model.DB.First(&profile, profile.Id).Error)
		require.Equal(t, model.BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
		require.Empty(t, profile.ErrorCode)
		require.Nil(t, profile.UpstreamGroupId)
		require.NoError(t, model.DB.First(&session, session.Id).Error)
		require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, session.Status)
		require.Equal(t, int64(0), session.LeaseUpdatedTime)
		require.Equal(t, int64(2060), session.UpdatedTime)
		require.Equal(t, bytedCiphertext, session.BytedTokenCiphertext)
		require.EqualValues(t, beforeRetry+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"}))
	})

	t.Run("transient upstream failure records retry without operation error", func(t *testing.T) {
		fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
		fixture.fake.resultErr = context.DeadlineExceeded
		_, session := seedJobVerificationSession(t, "transient", model.BytePlusVisualValidationSessionStatusPending, "byted", 3000)
		beforeRetry := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"})

		result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

		require.NoError(t, result.Err)
		require.NoError(t, model.DB.First(&session, session.Id).Error)
		require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, session.Status)
		require.EqualValues(t, beforeRetry+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"}))
	})
}

func TestJobsPurgeOnlyExpiredSafeIdempotencyRecords(t *testing.T) {
	newBytePlusRealPersonJobsFixtureWithoutRows(t)
	statuses := []string{
		model.APIIdempotencyStatusCompleted,
		model.APIIdempotencyStatusFailed,
		model.APIIdempotencyStatusOutcomeUnknown,
		model.APIIdempotencyStatusProcessing,
		model.APIIdempotencyStatusCallingUpstream,
	}
	for i, status := range statuses {
		require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
			UserId: 7, Route: "retention", KeyHash: strings.Repeat(string(rune('a'+i)), 64), RequestHash: strings.Repeat("b", 64),
			Status: status, ResourceType: model.APIIdempotencyResourceAsset, ExpiresAt: 100,
			LeaseUpdatedTime: 1900, UpstreamCallStartedAt: 1900, CreatedTime: 100, UpdatedTime: 100,
		}).Error)
	}

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 2, result.Processed)
	var remaining []model.APIIdempotencyRecord
	require.NoError(t, model.DB.Order("status").Find(&remaining).Error)
	require.Equal(t, []string{
		model.APIIdempotencyStatusCallingUpstream,
		model.APIIdempotencyStatusOutcomeUnknown,
		model.APIIdempotencyStatusProcessing,
	}, idempotencyStatusesForJobTest(remaining))
}

func TestExpiredVerificationCallingUpstreamTargetsExactSessionWithoutOverwritingNewCurrentSession(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_old_job", UserId: 7, Name: "A", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&profile).Error)
	oldSession := model.BytePlusVisualValidationSession{PublicId: "rvs_old_job", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64), Status: model.BytePlusVisualValidationSessionStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	newSession := model.BytePlusVisualValidationSession{PublicId: "rvs_new_job", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("b", 64), Status: model.BytePlusVisualValidationSessionStatusPending, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&oldSession).Error)
	require.NoError(t, model.DB.Create(&newSession).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", newSession.Id).Error)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonCreateRoute, KeyHash: strings.Repeat("c", 64), RequestHash: strings.Repeat("d", 64), Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: model.APIIdempotencyResourceVerificationSession, ResourcePublicId: oldSession.PublicId, LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, CreatedTime: 100, UpdatedTime: 100}).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 1, result.Processed)
	require.NoError(t, model.DB.First(&oldSession, oldSession.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, oldSession.Status)
	require.NoError(t, model.DB.First(&newSession, newSession.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, newSession.Status)
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Zero(t, fixture.fake.resultCalls)
	require.Zero(t, fixture.fake.getAssetCalls)
	require.Zero(t, fixture.fake.deleteCalls)
}

func TestBytePlusRealPersonIdempotencyRecoveryWarnsOperationOnlyOnReconcileError(t *testing.T) {
	newBytePlusRealPersonJobsFixtureWithoutRows(t)
	asset := model.BytePlusAsset{PublicId: "ast_recovery_secret", UserId: 7, ChannelId: 101, AssetType: "Image", Status: model.BytePlusAssetStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: strings.Repeat("e", 64), RequestHash: strings.Repeat("f", 64), Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId, LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, CreatedTime: 100, UpdatedTime: 100}).Error)
	callbackName := "byteplus_idempotency_recovery_asset_failure"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Schema == nil || tx.Statement.Schema.Name != "BytePlusAsset" {
			return
		}
		tx.AddError(errors.New("secret recovery-public-id ast_recovery_secret"))
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Update().Remove(callbackName)) })
	var warnings []string
	oldWarn := bytePlusRealPersonJobRowWarn
	bytePlusRealPersonJobRowWarn = func(message string) {
		warnings = append(warnings, message)
	}
	t.Cleanup(func() { bytePlusRealPersonJobRowWarn = oldWarn })
	beforeError := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "idempotency_recovery", "result": "error"})

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.Error(t, result.Err)
	require.Zero(t, result.Processed)
	require.Equal(t, []string{"byteplus real-person job row failed: idempotency_recovery"}, warnings)
	require.EqualValues(t, beforeError+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "idempotency_recovery", "result": "error"}))
	for _, forbidden := range []string{"secret", "recovery-public-id", "ast_recovery_secret"} {
		require.NotContains(t, warnings[0], forbidden)
	}
}

func TestExpiredSignedURLGetsOneFinalAssetQueryThenObjectCleanup(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	asset := model.BytePlusAsset{PublicId: "ast_expired_url", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-expired", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	object := model.BytePlusAssetTempObject{AssetId: &asset.Id, UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "expired-url", CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 100, NextCleanupAt: 100, CleanupLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&object).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 1, result.Processed)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusProcessing, asset.Status)
	require.NoError(t, model.DB.First(&object, object.Id).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, object.CleanupStatus)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Equal(t, 1, fixture.fake.getAssetCalls)
	require.Equal(t, []string{"expired-url"}, fixture.fake.tosDeletes)
}

func TestTempObjectCleanupRejectsUnknownPersistedBucketWithoutTOSDelete(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	object := model.BytePlusAssetTempObject{
		UserId: 7, ChannelId: 101, Bucket: "unknown-temp-bucket", ObjectKey: "unknown-cleanup",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, NextCleanupAt: 100,
		CleanupLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&object).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Zero(t, result.Processed)
	fixture.fake.mu.Lock()
	require.Empty(t, fixture.fake.tosDeletes)
	fixture.fake.mu.Unlock()
	require.NoError(t, model.DB.First(&object, object.Id).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupPending, object.CleanupStatus)
	require.Greater(t, object.CleanupAttempts, 0)
}

func TestTempObjectCleanupUsesPersistedGCSBucket(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
	bytePlusTempObjectStoreFactory = newPreferredBytePlusTempObjectStore
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 101).Update("key", urlOnlyRealPersonKey()).Error)
	originalDelete := deleteTempMediaObject
	t.Cleanup(func() { deleteTempMediaObject = originalDelete })
	var deletedKeys []string
	deleteTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string) error {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		deletedKeys = append(deletedKeys, objectKey)
		return nil
	}
	object := model.BytePlusAssetTempObject{
		UserId: 7, ChannelId: 101, Bucket: "gcs:gcs-real-person-bucket", ObjectKey: "gcs-cleanup",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, NextCleanupAt: 100,
		CleanupLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&object).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, 1, result.Processed)
	fixture.fake.mu.Lock()
	require.Empty(t, fixture.fake.tosDeletes)
	fixture.fake.mu.Unlock()
	require.Equal(t, []string{"gcs-cleanup"}, deletedKeys)
	require.NoError(t, model.DB.First(&object, object.Id).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, object.CleanupStatus)
}

func TestBytePlusRealPersonAssetStatusTransientFailureRecordsRetryWithoutOperationError(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	fixture.fake.getAssetErr = context.DeadlineExceeded
	asset := model.BytePlusAsset{PublicId: "ast_retry_status", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-retry", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	beforeRetry := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "retry"})

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusProcessing, asset.Status)
	require.Less(t, asset.UpdatedTime, int64(2000))
	require.EqualValues(t, beforeRetry+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "retry"}))
}

func TestBytePlusRealPersonRetryCASLosersAreSilentNoOps(t *testing.T) {
	cases := []struct {
		name      string
		operation string
		seed      func(t *testing.T, fixture *bytePlusRealPersonJobsFixture)
	}{
		{
			name:      "verification status",
			operation: "verification_status",
			seed: func(t *testing.T, fixture *bytePlusRealPersonJobsFixture) {
				_, session := seedJobVerificationSession(t, "cas_loser", model.BytePlusVisualValidationSessionStatusPending, "byted", 3000)
				fixture.fake.resultErr = context.DeadlineExceeded
				fixture.fake.onResult = func() {
					require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Where("id = ?", session.Id).Update("lease_updated_time", int64(1999)).Error)
				}
			},
		},
		{
			name:      "asset status",
			operation: "asset_status",
			seed: func(t *testing.T, fixture *bytePlusRealPersonJobsFixture) {
				asset := model.BytePlusAsset{PublicId: "ast_status_cas_loser", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-status-cas", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&asset).Error)
				fixture.fake.getAssetErr = context.DeadlineExceeded
				fixture.fake.onGetAsset = func() {
					require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("id = ?", asset.Id).Update("updated_time", int64(1999)).Error)
				}
			},
		},
		{
			name:      "asset delete",
			operation: "asset_delete",
			seed: func(t *testing.T, fixture *bytePlusRealPersonJobsFixture) {
				asset := model.BytePlusAsset{PublicId: "ast_delete_cas_loser", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-delete-cas", AssetType: "Image", Status: model.BytePlusAssetStatusDeleting, NextDeleteAt: 100, DeleteLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&asset).Error)
				fixture.fake.deleteErr = context.DeadlineExceeded
				fixture.fake.onDeleteAsset = func() {
					require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("id = ?", asset.Id).Update("delete_lease_updated_time", int64(1999)).Error)
				}
			},
		},
		{
			name:      "tos cleanup",
			operation: "tos_cleanup",
			seed: func(t *testing.T, fixture *bytePlusRealPersonJobsFixture) {
				object := model.BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "tos-cas-loser", CleanupStatus: model.BytePlusTempObjectCleanupPending, NextCleanupAt: 100, CleanupLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
				require.NoError(t, model.DB.Create(&object).Error)
				fixture.fake.tosDeleteErr = context.DeadlineExceeded
				fixture.fake.onDeleteObject = func() {
					require.NoError(t, model.DB.Model(&model.BytePlusAssetTempObject{}).Where("id = ?", object.Id).Update("cleanup_lease_updated_time", int64(1999)).Error)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
			tc.seed(t, fixture)
			beforeRetry := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": tc.operation, "result": "retry"})
			beforeError := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": tc.operation, "result": "error"})

			result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

			require.NoError(t, result.Err)
			require.EqualValues(t, beforeRetry, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": tc.operation, "result": "retry"}))
			require.EqualValues(t, beforeError, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": tc.operation, "result": "error"}))
		})
	}
}

func TestBytePlusRealPersonVerificationSuccessOnlyCountsChangedActivation(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(t *testing.T, profile model.BytePlusRealPersonProfile, session model.BytePlusVisualValidationSession)
	}{
		{
			name: "cas lost",
			mutate: func(t *testing.T, _ model.BytePlusRealPersonProfile, session model.BytePlusVisualValidationSession) {
				require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Where("id = ?", session.Id).Update("status", model.BytePlusVisualValidationSessionStatusSucceeded).Error)
			},
		},
		{
			name: "no current change",
			mutate: func(t *testing.T, profile model.BytePlusRealPersonProfile, _ model.BytePlusVisualValidationSession) {
				replacement := model.BytePlusVisualValidationSession{PublicId: "rvs_job_replacement", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("c", 64), Status: model.BytePlusVisualValidationSessionStatusPending, CreatedTime: 150, UpdatedTime: 150}
				require.NoError(t, model.DB.Create(&replacement).Error)
				require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", replacement.Id).Error)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
			profile, session := seedJobVerificationSession(t, "activation_"+strings.ReplaceAll(tc.name, " ", "_"), model.BytePlusVisualValidationSessionStatusPending, "byted", 3000)
			fixture.fake.onResult = func() {
				tc.mutate(t, profile, session)
			}
			var warnings []string
			oldWarn := bytePlusRealPersonJobRowWarn
			bytePlusRealPersonJobRowWarn = func(message string) {
				warnings = append(warnings, message)
			}
			t.Cleanup(func() { bytePlusRealPersonJobRowWarn = oldWarn })
			beforeSuccess := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "success"})
			beforeError := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "error"})
			beforeRetry := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"})

			result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

			require.NoError(t, result.Err)
			require.Zero(t, result.Processed)
			require.Empty(t, warnings)
			require.EqualValues(t, beforeSuccess, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "success"}))
			require.EqualValues(t, beforeError, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "error"}))
			require.EqualValues(t, beforeRetry, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "verification_status", "result": "retry"}))
		})
	}
}

func TestBytePlusRealPersonJobRowWarningsUseOperationOnlyMessage(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	fixture.fake.getAssetErr = errors.New("secret upstream-asset object-key https://signed.example/?X-Amz-Credential=secret")
	asset := model.BytePlusAsset{PublicId: "ast_warning_status", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-warning-secret", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	var warnings []string
	oldWarn := bytePlusRealPersonJobRowWarn
	bytePlusRealPersonJobRowWarn = func(message string) {
		warnings = append(warnings, message)
	}
	t.Cleanup(func() { bytePlusRealPersonJobRowWarn = oldWarn })

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	require.Equal(t, []string{"byteplus real-person job row failed: asset_status"}, warnings)
	for _, forbidden := range []string{"secret", "upstream-warning", "object-key", "signed.example", "X-Amz-Credential"} {
		require.NotContains(t, warnings[0], forbidden)
	}
}

func TestProcessingStatusSyncCannotOverwriteDeletingOrDeleted(t *testing.T) {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	for _, status := range []string{model.BytePlusAssetStatusDeleting, model.BytePlusAssetStatusDeleted} {
		require.NoError(t, model.DB.Create(&model.BytePlusAsset{PublicId: "ast_" + status, UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-" + status, AssetType: "Image", Status: status, NextDeleteAt: 500, CreatedTime: 100, UpdatedTime: 100}).Error)
	}

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 2000, 50)

	require.NoError(t, result.Err)
	fixture.fake.mu.Lock()
	defer fixture.fake.mu.Unlock()
	require.Zero(t, fixture.fake.getAssetCalls)
}

func TestBytePlusRealPersonOperationMetricsPreserveSuccessOnError(t *testing.T) {
	beforeSuccess := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "success"})
	beforeError := prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "error"})

	ok := recordBytePlusRealPersonOperation("asset_status", 1, errors.New("secret-upstream-id"))

	require.False(t, ok)
	require.EqualValues(t, beforeSuccess+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "success"}))
	require.EqualValues(t, beforeError+1, prometheusSampleValueForJobTest(t, "newapi_byteplus_real_person_reconcile_total", map[string]string{"operation": "asset_status", "result": "error"}))
}

func TestBytePlusRealPersonJobWarningsDoNotEmitRawErrors(t *testing.T) {
	source, err := os.ReadFile("byteplus_real_person_jobs.go")
	require.NoError(t, err)
	require.GreaterOrEqual(t, strings.Count(string(source), "warnBytePlusRealPersonJobRow("), 10)
	require.NotContains(t, string(source), "result.Err.Error()")
	require.NotContains(t, string(source), "+ err.Error()")
}

func TestMainStartsBytePlusRealPersonJobsOutsideMasterOnlyBlock(t *testing.T) {
	source, err := os.ReadFile("../main.go")
	require.NoError(t, err)
	text := string(source)
	start := strings.Index(text, "service.StartBytePlusRealPersonJobs()")
	masterBlock := strings.Index(text, "if common.IsMasterNode && constant.UpdateTask")
	require.NotEqual(t, -1, start)
	require.NotEqual(t, -1, masterBlock)
	require.Less(t, start, masterBlock)
}

type bytePlusRealPersonJobsFixture struct {
	fake *bytePlusRealPersonJobsFake
}

func newBytePlusRealPersonJobsFixture(t *testing.T) *bytePlusRealPersonJobsFixture {
	fixture := newBytePlusRealPersonJobsFixtureWithoutRows(t)
	cipher := plainBytePlusRealPersonCipher{}
	byted, err := cipher.Encrypt("rvs_due_job", bytePlusSensitiveFieldBytedToken, "byted")
	require.NoError(t, err)
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_due_job", UserId: 7, Name: "A", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_due_job", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64), BytedTokenCiphertext: byted, Status: model.BytePlusVisualValidationSessionStatusPending, LeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
	asset := model.BytePlusAsset{PublicId: "ast_delete_job", UserId: 7, ChannelId: 101, UpstreamAssetId: "upstream-delete", AssetType: "Image", Status: model.BytePlusAssetStatusDeleting, NextDeleteAt: 100, DeleteLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&asset).Error)
	object := model.BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "tos-due", CleanupStatus: model.BytePlusTempObjectCleanupPending, NextCleanupAt: 100, CleanupLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&object).Error)
	return fixture
}

func seedJobVerificationSession(t *testing.T, suffix, status, token string, expiresAt int64) (model.BytePlusRealPersonProfile, model.BytePlusVisualValidationSession) {
	t.Helper()
	profile := model.BytePlusRealPersonProfile{
		PublicId: "rph_job_" + suffix, UserId: 7, Name: "A", ChannelId: 101,
		Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	cipher := plainBytePlusRealPersonCipher{}
	byted := ""
	if strings.TrimSpace(token) != "" {
		var err error
		byted, err = cipher.Encrypt("rvs_job_"+suffix, bytePlusSensitiveFieldBytedToken, token)
		require.NoError(t, err)
	}
	session := model.BytePlusVisualValidationSession{
		PublicId: "rvs_job_" + suffix, ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64),
		BytedTokenCiphertext: byted, Status: status, ExpiresAt: expiresAt, LeaseUpdatedTime: 0,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
	return profile, session
}

func newBytePlusRealPersonJobsFixtureWithoutRows(t *testing.T) *bytePlusRealPersonJobsFixture {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &bytePlusRealPersonJobsFake{
		result:      BytePlusVisualValidationResult{GroupID: "group-job", RequestID: "req-result"},
		assetStatus: BytePlusAssetStatus{UpstreamAssetID: "upstream-expired", Status: model.BytePlusAssetStatusProcessing},
	}
	oldNow := bytePlusAssetNow
	oldFactory := bytePlusAssetClientFactory
	oldCipher := bytePlusRealPersonCipherFactory
	oldStoreFactory := bytePlusTempObjectStoreFactory
	bytePlusAssetNow = func() int64 { return 2000 }
	bytePlusAssetClientFactory = func(*model.Channel) (bytePlusAssetAPI, error) { return fake, nil }
	bytePlusRealPersonCipherFactory = func() (BytePlusSensitiveCipher, error) { return plainBytePlusRealPersonCipher{}, nil }
	bytePlusTempObjectStoreFactory = func(BytePlusCredentials) (BytePlusTempObjectStore, error) { return fake, nil }
	t.Setenv("BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL", "https://api.flatkey.example")
	t.Cleanup(func() {
		bytePlusAssetNow = oldNow
		bytePlusAssetClientFactory = oldFactory
		bytePlusRealPersonCipherFactory = oldCipher
		bytePlusTempObjectStoreFactory = oldStoreFactory
	})
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	return &bytePlusRealPersonJobsFixture{fake: fake}
}

func idempotencyStatusesForJobTest(records []model.APIIdempotencyRecord) []string {
	statuses := make([]string, 0, len(records))
	for _, record := range records {
		statuses = append(statuses, record.Status)
	}
	return statuses
}

func prometheusSampleValueForJobTest(t *testing.T, metric string, labels map[string]string) int64 {
	t.Helper()
	text, err := perfmetrics.BuildPrometheusText(context.Background())
	require.NoError(t, err)
	prefix := metric + "{"
	for _, line := range strings.Split(text, "\n") {
		if !strings.HasPrefix(line, prefix) {
			continue
		}
		match := true
		for key, value := range labels {
			if !strings.Contains(line, key+`="`+value+`"`) {
				match = false
				break
			}
		}
		if !match {
			continue
		}
		parts := strings.Split(line, " ")
		require.Len(t, parts, 2)
		parsed, err := strconv.ParseInt(parts[1], 10, 64)
		require.NoError(t, err)
		return parsed
	}
	return 0
}
