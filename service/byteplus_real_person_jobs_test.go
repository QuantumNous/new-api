package service

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

type bytePlusRealPersonJobsFake struct {
	mu            sync.Mutex
	resultCalls   int
	getAssetCalls int
	deleteCalls   int
	tosDeletes    []string
	result        BytePlusVisualValidationResult
	assetStatus   BytePlusAssetStatus
}

func (f *bytePlusRealPersonJobsFake) CreateVisualValidateSession(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationSession, error) {
	return BytePlusVisualValidationSession{}, errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) GetVisualValidateResult(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resultCalls++
	return f.result, nil
}

func (f *bytePlusRealPersonJobsFake) CreateAsset(context.Context, BytePlusCredentials, BytePlusCreateAssetRequest) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) CreateAssetGroup(context.Context, BytePlusCredentials, string) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) GetAsset(context.Context, BytePlusCredentials, string) (BytePlusAssetStatus, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getAssetCalls++
	return f.assetStatus, nil
}

func (f *bytePlusRealPersonJobsFake) ListAssets(context.Context, BytePlusCredentials, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return BytePlusListAssetsResult{}, errors.New("unused")
}

func (f *bytePlusRealPersonJobsFake) DeleteAsset(context.Context, BytePlusCredentials, string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleteCalls++
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
	defer f.mu.Unlock()
	f.tosDeletes = append(f.tosDeletes, key)
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
