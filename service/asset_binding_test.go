package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

type recordingAssetMaterializer struct {
	createCalls    int64
	getCalls       int64
	blockCreate    chan struct{}
	createErr      error
	getErr         error
	createStatus   string
	getStatus      string
	getStatuses    []string
	createGroupID  string
	createAssetID  string
	lastGetAssetID string
}

func (m *recordingAssetMaterializer) CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	atomic.AddInt64(&m.createCalls, 1)
	if m.blockCreate != nil {
		<-m.blockCreate
	}
	if input.SignSource != nil {
		signedURL, err := input.SignSource(ctx, input.Asset)
		if err != nil {
			return AssetMaterializeResult{}, err
		}
		if signedURL == "" {
			return AssetMaterializeResult{}, errors.New("empty signed source")
		}
	}
	if m.createErr != nil {
		return AssetMaterializeResult{}, m.createErr
	}
	status := m.createStatus
	if status == "" {
		status = model.BytePlusAssetStatusActive
	}
	groupID := m.createGroupID
	if groupID == "" {
		groupID = "group-1"
	}
	assetID := m.createAssetID
	if assetID == "" {
		assetID = "upstream-" + input.Asset.PublicId
	}
	return AssetMaterializeResult{
		UpstreamGroupID: groupID,
		UpstreamAssetID: assetID,
		Status:          status,
	}, nil
}

func (m *recordingAssetMaterializer) GetAsset(ctx context.Context, input AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	call := atomic.AddInt64(&m.getCalls, 1)
	m.lastGetAssetID = upstreamAssetID
	if m.getErr != nil {
		return AssetMaterializeResult{}, m.getErr
	}
	status := m.getStatus
	if len(m.getStatuses) >= int(call) {
		status = m.getStatuses[call-1]
	}
	if status == "" {
		status = model.BytePlusAssetStatusActive
	}
	return AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: status}, nil
}

func TestAssetBindingConcurrentClaimersCreateProviderAssetOnce(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_11111111111111111111111111111111")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{blockCreate: make(chan struct{})}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	var start sync.WaitGroup
	start.Add(2)
	results := make(chan AssetBindingResult, 2)
	errs := make(chan error, 2)
	for _, owner := range []string{"node-a", "node-b"} {
		owner := owner
		go func() {
			start.Done()
			start.Wait()
			result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
				UserID:       asset.UserId,
				PublicID:     asset.PublicId,
				Channel:      channel,
				LeaseOwner:   owner,
				PollLimit:    5,
				PollDelay:    time.Millisecond,
				LeaseTTL:     time.Minute,
				ExpectedType: "Image",
			})
			if err != nil {
				errs <- err
				return
			}
			results <- result
		}()
	}
	require.Eventually(t, func() bool { return atomic.LoadInt64(&materializer.createCalls) == 1 }, time.Second, time.Millisecond)
	close(materializer.blockCreate)

	require.Len(t, collectBindingErrors(errs, 2, time.Second), 0)
	got := []AssetBindingResult{<-results, <-results}
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, got[0].RewriteURI, got[1].RewriteURI)
	require.Equal(t, "asset://upstream-"+asset.PublicId, got[0].RewriteURI)
	require.Len(t, store.signed, 1)
	require.Equal(t, http.MethodGet, store.signed[0].Method)
	require.Equal(t, time.Hour, store.signed[0].TTL)

	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "group-1", binding.UpstreamGroupId)
	require.Equal(t, "upstream-"+asset.PublicId, binding.UpstreamAssetId)
	require.NotContains(t, binding.UpstreamAssetId, "signed.example")
}

func TestAssetBindingStaleLeaseCanBeTakenOver(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_22222222222222222222222222222222")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:        asset.Id,
		ChannelId:      channel.Id,
		Status:         model.AssetBindingStatusLeased,
		LeaseOwner:     "dead-node",
		LeaseExpiresAt: 99,
		CreatedAt:      90,
		UpdatedAt:      90,
	}).Error)
	materializer := &recordingAssetMaterializer{}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-b",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://upstream-"+asset.PublicId, result.RewriteURI)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetBindingReusesActiveBindingWithoutSigningOrProviderCreate(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_33333333333333333333333333333333")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       channel.Id,
		Status:          model.AssetStatusActive,
		UpstreamGroupId: "group-existing",
		UpstreamAssetId: "upstream-existing",
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"source_status":     model.AssetSourceStatusExpired,
		"source_expires_at": int64(99),
	}).Error)
	materializer := &recordingAssetMaterializer{}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://upstream-existing", result.RewriteURI)
	require.Zero(t, atomic.LoadInt64(&materializer.createCalls))
	require.Len(t, store.signed, 0)
}

func TestAssetBindingBoundedPollingReturnsSanitizedInitializingError(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_44444444444444444444444444444444")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:        asset.Id,
		ChannelId:      channel.Id,
		Status:         model.AssetBindingStatusLeased,
		LeaseOwner:     "other-node",
		LeaseExpiresAt: 200,
		CreatedAt:      100,
		UpdatedAt:      100,
	}).Error)
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })
	oldSleep := assetBindingPollSleep
	sleepCalls := int64(0)
	assetBindingPollSleep = func(ctx context.Context, delay time.Duration) error {
		atomic.AddInt64(&sleepCalls, 1)
		return nil
	}
	t.Cleanup(func() { assetBindingPollSleep = oldSleep })

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    2,
		PollDelay:    time.Hour,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.Error(t, err)
	require.ErrorIs(t, err, ErrAssetBindingInitializing)
	require.Equal(t, int64(1), sleepCalls)
	require.NotContains(t, err.Error(), "other-node")
}

func TestAssetBindingProviderFailureIsSanitizedAndDoesNotPersistSignedURL(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_55555555555555555555555555555555")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{createErr: errors.New("BytePlus secret sk-live signed=https://signed.example/assets?X-Goog-Signature=abc")}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.Error(t, err)
	for _, marker := range []string{"BytePlus", "sk-live", "signed.example", "X-Goog-Signature"} {
		require.NotContains(t, err.Error(), marker)
	}
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusFailed, binding.Status)
	require.NotContains(t, binding.ErrorCode, "signed.example")
	require.Len(t, store.signed, 1, "create attempt needs exactly one ephemeral signed GET URL")
}

func TestAssetBindingProcessingCreatePollsToActiveWithoutSecondCreate(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createStatus: model.AssetStatusProcessing,
		getStatuses:  []string{model.AssetStatusProcessing, model.AssetStatusActive},
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    3,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://upstream-"+asset.PublicId, result.RewriteURI)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, int64(2), atomic.LoadInt64(&materializer.getCalls))
	require.Len(t, store.signed, 1, "only provider create signs the recoverable source")
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Empty(t, binding.LeaseOwner)
	require.Zero(t, binding.LeaseExpiresAt)
}

func TestAssetBindingExistingProcessingRefreshesWithGetOnly(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       channel.Id,
		Status:          model.AssetStatusProcessing,
		UpstreamGroupId: "group-existing",
		UpstreamAssetId: "upstream-existing",
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	materializer := &recordingAssetMaterializer{getStatus: model.AssetStatusActive}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    2,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://upstream-existing", result.RewriteURI)
	require.Zero(t, atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.getCalls))
	require.Equal(t, "upstream-existing", materializer.lastGetAssetID)
	require.Len(t, store.signed, 0, "Get-only refresh must not sign source URLs")
}

func TestAssetBindingProcessingPollTimeoutReturnsNotReady(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_cccccccccccccccccccccccccccccccc")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createStatus: model.AssetStatusProcessing,
		getStatus:    model.AssetStatusProcessing,
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    2,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.ErrorIs(t, err, ErrAssetBindingInitializing)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, int64(2), atomic.LoadInt64(&materializer.getCalls))
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusProcessing, binding.Status)
}

func TestAssetBindingProviderFailedStatusIsSanitized(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_dddddddddddddddddddddddddddddddd")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createStatus: model.AssetStatusProcessing,
		getErr:       errors.New("BytePlus secret sk-live signed=https://signed.example/?X-Goog-Signature=abc"),
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.Error(t, err)
	assertNoAssetBindingLeak(t, err)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusFailed, binding.Status)
	require.NotContains(t, binding.ErrorCode, "signed.example")
}

func TestAssetBindingProviderFailedResultDoesNotRetryInSameMaterializeCall(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_12121212121212121212121212121212")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{createStatus: model.AssetStatusFailed}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    3,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.Error(t, err)
	assertNoAssetBindingLeak(t, err)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Zero(t, atomic.LoadInt64(&materializer.getCalls))
	require.Len(t, store.signed, 1)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusFailed, binding.Status)
	require.EqualValues(t, 1, binding.AttemptCount)
}

func TestAssetBindingFailedNextRequestReclaimsAndCreatesOnce(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:        asset.Id,
		ChannelId:      channel.Id,
		Status:         model.AssetStatusFailed,
		ErrorCode:      "asset upstream error",
		AttemptCount:   1,
		LeaseExpiresAt: 0,
		CreatedAt:      100,
		UpdatedAt:      100,
	}).Error)
	materializer := &recordingAssetMaterializer{}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-b",
		PollLimit:    2,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://upstream-"+asset.PublicId, result.RewriteURI)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Len(t, store.signed, 1)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.EqualValues(t, 2, binding.AttemptCount)
}

func TestAssetBindingOldOwnerCASCannotOverwriteNewOwner(t *testing.T) {
	newAssetServiceTestDB(t)
	asset := insertMaterializeAsset(t, "ast_ffffffffffffffffffffffffffffffff")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:        asset.Id,
		ChannelId:      channel.Id,
		Status:         model.AssetBindingStatusLeased,
		LeaseOwner:     "new-owner",
		LeaseExpiresAt: 200,
		CreatedAt:      100,
		UpdatedAt:      100,
	}).Error)

	activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
		AssetID:         asset.Id,
		ChannelID:       channel.Id,
		LeaseOwner:      "old-owner",
		UpstreamGroupID: "old-group",
		UpstreamAssetID: "old-upstream",
		Status:          model.AssetStatusActive,
		Now:             120,
	})
	require.NoError(t, err)
	require.False(t, activated)
	failed, err := model.FailAssetBindingCAS(asset.Id, channel.Id, "old-owner", "old-error", 121)
	require.NoError(t, err)
	require.False(t, failed)

	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetBindingStatusLeased, binding.Status)
	require.Equal(t, "new-owner", binding.LeaseOwner)
	require.Equal(t, "", binding.UpstreamAssetId)
	require.Equal(t, "", binding.ErrorCode)
}

func TestAssetBindingMaterializeSetRequiresEveryReferenceRewrite(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	first := insertMaterializeAsset(t, "ast_66666666666666666666666666666666")
	second := insertMaterializeAsset(t, "ast_77777777777777777777777777777777")
	channel := insertMaterializeChannel(t, 131)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         first.Id,
		ChannelId:       channel.Id,
		Status:          model.AssetStatusActive,
		UpstreamAssetId: "upstream-first",
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	materializer := &recordingAssetMaterializer{createErr: errors.New("provider secret should not leak")}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	set := AssetReferenceSet{
		references: []assetReference{
			{PublicID: first.PublicId, ExpectedAssetType: "Image"},
			{PublicID: second.PublicId, ExpectedAssetType: "Image"},
		},
		assets: map[string]assetReferenceAsset{
			first.PublicId: {
				PublicID:  first.PublicId,
				AssetType: "Image",
				Status:    model.AssetStatusActive,
				Bindings: []assetReferenceBinding{{
					ChannelID:       channel.Id,
					Status:          model.AssetStatusActive,
					UpstreamAssetID: "upstream-first",
				}},
			},
			second.PublicId: {
				PublicID:        second.PublicId,
				AssetType:       "Image",
				Status:          model.AssetStatusActive,
				SourceStatus:    model.AssetSourceStatusAvailable,
				StorageBackend:  defaultAssetStorageBackend,
				StorageBucket:   second.StorageBucket,
				ObjectKey:       second.ObjectKey,
				SourceExpiresAt: second.SourceExpiresAt,
			},
		},
	}

	rewriteMap, err := MaterializeAssetBindingsForChannel(context.Background(), 7, set, channel)

	require.Error(t, err)
	assertNoAssetBindingLeak(t, err)
	require.Nil(t, rewriteMap, "a failed member must not return a partial rewrite map")
}

func TestAssetBindingMaterializeSetCreatesRecoverableBindingsAndReturnsCompleteMap(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	first := insertMaterializeAsset(t, "ast_88888888888888888888888888888888")
	second := insertMaterializeAsset(t, "ast_99999999999999999999999999999999")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	set := AssetReferenceSet{
		references: []assetReference{
			{PublicID: first.PublicId, ExpectedAssetType: "Image"},
			{PublicID: second.PublicId, ExpectedAssetType: "Image"},
		},
		assets: map[string]assetReferenceAsset{
			first.PublicId: {
				PublicID:        first.PublicId,
				AssetType:       "Image",
				Status:          model.AssetStatusActive,
				SourceStatus:    model.AssetSourceStatusAvailable,
				StorageBackend:  defaultAssetStorageBackend,
				StorageBucket:   first.StorageBucket,
				ObjectKey:       first.ObjectKey,
				SourceExpiresAt: first.SourceExpiresAt,
			},
			second.PublicId: {
				PublicID:        second.PublicId,
				AssetType:       "Image",
				Status:          model.AssetStatusActive,
				SourceStatus:    model.AssetSourceStatusAvailable,
				StorageBackend:  defaultAssetStorageBackend,
				StorageBucket:   second.StorageBucket,
				ObjectKey:       second.ObjectKey,
				SourceExpiresAt: second.SourceExpiresAt,
			},
		},
	}

	rewriteMap, err := MaterializeAssetBindingsForChannel(context.Background(), 7, set, channel)

	require.NoError(t, err)
	require.Equal(t, map[string]string{
		"asset://" + first.PublicId:  "asset://upstream-" + first.PublicId,
		"asset://" + second.PublicId: "asset://upstream-" + second.PublicId,
	}, rewriteMap)
	require.Len(t, store.signed, 2)
}

func insertMaterializeAsset(t *testing.T, publicID string) model.Asset {
	t.Helper()
	asset := model.Asset{
		PublicId:         publicID,
		UserId:           7,
		AssetType:        "Image",
		Status:           model.AssetStatusActive,
		SourceStatus:     model.AssetSourceStatusAvailable,
		StorageBackend:   defaultAssetStorageBackend,
		StorageBucket:    "asset-test-bucket",
		ObjectKey:        "assets/" + publicID + ".png",
		ObjectGeneration: 27,
		ContentType:      "image/png",
		SourceExpiresAt:  time.Now().Add(time.Hour).Unix(),
		CreatedAt:        100,
		UpdatedAt:        100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	return asset
}

func insertMaterializeChannel(t *testing.T, id int) *model.Channel {
	t.Helper()
	key, err := common.Marshal(BytePlusCredentials{
		APIKey:          "video-key",
		AccessKeyID:     "ak-test",
		SecretAccessKey: "sk-test",
		ProjectName:     "project-test",
	})
	require.NoError(t, err)
	channel := &model.Channel{Id: id, Type: constant.ChannelTypeBytePlus, Key: string(key), Status: common.ChannelStatusEnabled}
	return channel
}

func collectBindingErrors(errs <-chan error, want int, timeout time.Duration) []error {
	deadline := time.After(timeout)
	collected := make([]error, 0)
	for len(collected) < want {
		select {
		case err := <-errs:
			if err != nil {
				collected = append(collected, err)
			}
		case <-deadline:
			return collected
		}
	}
	return collected
}

func assertNoAssetBindingLeak(t *testing.T, err error) {
	t.Helper()
	text := err.Error()
	for _, marker := range []string{"BytePlus", "byteplus", "sk-", "ak-", "signed.example", "X-Goog"} {
		if strings.Contains(text, marker) {
			t.Fatalf("binding error leaked %q in %q", marker, text)
		}
	}
}

func TestAssetBindingResultPreservesOpaqueUpstreamURI(t *testing.T) {
	result := assetBindingResult("ast_opaque", model.AssetBinding{
		UpstreamAssetId: "asset://asset-opaque-123",
	})

	require.Equal(t, "asset://asset-opaque-123", result.RewriteURI)
}

func TestAssetBindingResultTrimsOpaqueUpstreamURI(t *testing.T) {
	result := assetBindingResult("ast_opaque", model.AssetBinding{
		UpstreamAssetId: "  asset://asset-opaque-123  ",
	})

	require.Equal(t, "asset://asset-opaque-123", result.RewriteURI)
}
