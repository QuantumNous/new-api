package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type recordingAssetMaterializer struct {
	mu              sync.Mutex
	createCalls     int64
	getCalls        int64
	blockCreate     chan struct{}
	createErr       error
	getErr          error
	createStatus    string
	getStatus       string
	getStatuses     []string
	createGroupID   string
	createAssetID   string
	beforeCreate    func(AssetMaterializeInput)
	lastGetAssetID  string
	idempotencyKeys []string
}

func (m *recordingAssetMaterializer) CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	atomic.AddInt64(&m.createCalls, 1)
	if m.blockCreate != nil {
		<-m.blockCreate
	}
	if m.beforeCreate != nil {
		m.beforeCreate(input)
	}
	m.mu.Lock()
	m.idempotencyKeys = append(m.idempotencyKeys, input.IdempotencyKey)
	m.mu.Unlock()
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

func (m *recordingAssetMaterializer) capturedIdempotencyKeys() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.idempotencyKeys...)
}

func installAssetBindingActivationDBError(t *testing.T, shouldFail func() bool, err error) {
	t.Helper()
	callbackName := "test:asset_binding_activation_db_error:" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "AssetBinding" {
			return
		}
		if shouldFail() {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})
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
				PollLimit:    50,
				PollDelay:    10 * time.Millisecond,
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

func TestAssetBindingMaterializeExpectedLeaseExpiryFenceRejectsStaleSameOwnerLease(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_expected_lease_expiry_fence")
	channel := insertMaterializeChannel(t, 131)
	claimedLeaseMutated := atomic.Bool{}
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-stale-same-owner",
		beforeCreate: func(input AssetMaterializeInput) {
			if !claimedLeaseMutated.Swap(true) {
				require.NoError(t, model.DB.Model(&model.AssetBinding{}).
					Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
					Updates(map[string]any{"lease_expires_at": int64(999)}).Error)
			}
		},
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.ErrorIs(t, err, ErrAssetBindingInitializing)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetBindingStatusLeased, binding.Status)
	require.Equal(t, "node-a", binding.LeaseOwner)
	require.EqualValues(t, 999, binding.LeaseExpiresAt)
	require.Empty(t, binding.UpstreamAssetId)
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

func TestSeedanceProxyAssetBindingReusesActiveBindingAcrossSeedanceModelsOnSameKey(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_seedance_model_reuse_scope")
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		Status:        common.ChannelStatusEnabled,
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid/v1","group_id":"grp_shared_aigc"}}`,
	}
	materializer := &recordingAssetMaterializer{
		createGroupID: "grp_shared_aigc",
		createAssetID: "upstream-seedance-shared",
	}
	descriptor := assetMaterializationProviderDescriptors[assetMaterializationProviderSeedanceProxy]
	assetMaterializationProviderDescriptors[assetMaterializationProviderSeedanceProxy] = assetMaterializationProviderDescriptor{
		MaterializerFactory: func(assetMaterializationChannelConfig) AssetMaterializer {
			return materializer
		},
		BindingScope:     descriptor.BindingScope,
		ValidateConfig:   descriptor.ValidateConfig,
		CredentialScoped: descriptor.CredentialScoped,
	}
	t.Cleanup(func() {
		assetMaterializationProviderDescriptors[assetMaterializationProviderSeedanceProxy] = descriptor
	})

	models := []string{"seedance-2.0", "seedance-2.0-fast", "seedance-2.0-mini"}
	scopes := make([]string, 0, len(models))
	results := make([]AssetBindingResult, 0, len(models))
	for _, modelName := range models {
		scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: modelName, APIKey: "seedance-key"})
		require.NoError(t, err)
		scopes = append(scopes, scope)

		result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
			UserID:       asset.UserId,
			PublicID:     asset.PublicId,
			Channel:      channel,
			LeaseOwner:   "node-a",
			PollLimit:    1,
			LeaseTTL:     time.Minute,
			ExpectedType: "Image",
			Model:        modelName,
			APIKey:       "seedance-key",
		})
		require.NoError(t, err)
		results = append(results, result)
	}

	require.Equal(t, scopes[0], scopes[1])
	require.Equal(t, scopes[0], scopes[2])
	for _, result := range results {
		require.Equal(t, "asset://upstream-seedance-shared", result.RewriteURI)
		require.Equal(t, scopes[0], result.Binding.BindingScope)
		require.Equal(t, "upstream-seedance-shared", result.Binding.UpstreamAssetId)
	}
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Len(t, store.signed, 1)
	var bindings []model.AssetBinding
	require.NoError(t, model.DB.Where("asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Find(&bindings).Error)
	require.Len(t, bindings, 1)
	require.Equal(t, scopes[0], bindings[0].BindingScope)
	require.Equal(t, model.AssetStatusActive, bindings[0].Status)
	require.Equal(t, "upstream-seedance-shared", bindings[0].UpstreamAssetId)
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

func TestTokenSpaceMaterialTechMobiProcessingBindingRefreshesWithGetOnly(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_tokenspace_processing_refresh")
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid",
		GroupID:        "group-internal",
	})
	channel.Id = 106
	options := AssetMaterializeOptions{Model: "seedance-2.0-fast", APIKey: "tokenspace-key"}
	bindingScope, err := assetBindingScopeForChannel(channel, options)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       channel.Id,
		BindingScope:    bindingScope,
		Status:          model.AssetStatusProcessing,
		UpstreamGroupId: "group-internal",
		UpstreamAssetId: "asset-created",
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	materializer := &recordingAssetMaterializer{getStatus: model.AssetStatusActive}
	descriptor := assetMaterializationProviderDescriptors[assetMaterializationProviderTokenSpaceMaterial]
	assetMaterializationProviderDescriptors[assetMaterializationProviderTokenSpaceMaterial] = assetMaterializationProviderDescriptor{
		MaterializerFactory: func(assetMaterializationChannelConfig) AssetMaterializer {
			return materializer
		},
		BindingScope:     descriptor.BindingScope,
		ValidateConfig:   descriptor.ValidateConfig,
		CredentialScoped: descriptor.CredentialScoped,
	}
	t.Cleanup(func() {
		assetMaterializationProviderDescriptors[assetMaterializationProviderTokenSpaceMaterial] = descriptor
	})

	result, handled, err := handleProcessingAssetBinding(context.Background(), &asset, channel, bindingScope, options.Model, options.APIKey, "asset-created", 2, 0)

	require.NoError(t, err)
	require.True(t, handled)
	require.Equal(t, "asset://asset-created", result.RewriteURI)
	require.Zero(t, atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.getCalls))
	require.Equal(t, "asset-created", materializer.lastGetAssetID)
	require.Len(t, store.signed, 0, "explicit provider processing refresh must not sign or create a replacement asset")
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ? AND binding_scope = ?", asset.Id, channel.Id, bindingScope).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "asset-created", binding.UpstreamAssetId)
}

func TestTechMobiAssetBindingHistoricalProcessingOpaqueAssetRematerializes(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_techmobi_processing_remat")
	channel := &model.Channel{Id: 106, Type: constant.ChannelTypeTechMobiVideo, Status: common.ChannelStatusEnabled}
	options := AssetMaterializeOptions{
		Model:  "seedance-2.0-fast",
		APIKey: "selected-techmobi-key",
	}
	bindingScope, err := assetBindingScope(channel.Type, options)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       channel.Id,
		BindingScope:    bindingScope,
		Status:          model.AssetStatusProcessing,
		UpstreamAssetId: "asset://historical-processing",
		CreatedAt:       100,
		UpdatedAt:       100,
	}).Error)
	materializer := &recordingAssetMaterializer{
		getErr:        errors.New("TechMobi processing rows must not be refreshed from opaque asset URLs"),
		createAssetID: "asset://new-techmobi-binding",
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
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
		Model:        options.Model,
		APIKey:       options.APIKey,
	})

	require.NoError(t, err)
	require.Equal(t, "asset://new-techmobi-binding", result.RewriteURI)
	require.Zero(t, atomic.LoadInt64(&materializer.getCalls))
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Len(t, store.signed, 1, "rematerialization must sign and upload the recoverable source")
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ? AND binding_scope = ?", asset.Id, channel.Id, bindingScope).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "asset://new-techmobi-binding", binding.UpstreamAssetId)
	require.EqualValues(t, 1, binding.AttemptCount)
}

func TestTechMobiAssetBindingRematerializesObservedProcessingWithinSinglePoll(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_techmobi_claim_observed_processing")
	channel := &model.Channel{Id: 106, Type: constant.ChannelTypeTechMobiVideo, Status: common.ChannelStatusEnabled}
	options := AssetMaterializeOptions{
		Model:  "seedance-2.0-fast",
		APIKey: "selected-techmobi-key",
	}
	bindingScope, err := assetBindingScope(channel.Type, options)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:        asset.Id,
		ChannelId:      channel.Id,
		BindingScope:   bindingScope,
		Status:         model.AssetBindingStatusLeased,
		LeaseOwner:     "other-node",
		LeaseExpiresAt: 200,
		CreatedAt:      100,
		UpdatedAt:      100,
	}).Error)
	materializer := &recordingAssetMaterializer{
		getErr:        errors.New("TechMobi processing rows must not be refreshed from opaque asset URLs"),
		createAssetID: "asset://rematerialized-after-observed-processing",
	}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	defer restore()
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })

	callbackName := "test:techmobi_observed_processing_after_claim"
	observedProcessing := atomic.Bool{}
	require.NoError(t, model.DB.Callback().Update().After("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "AssetBinding" {
			return
		}
		if !observedProcessing.CompareAndSwap(false, true) {
			return
		}
		require.NoError(t, model.DB.Session(&gorm.Session{NewDB: true, SkipHooks: true}).
			Model(&model.AssetBinding{}).
			Where("asset_id = ? AND channel_id = ? AND binding_scope = ?", asset.Id, channel.Id, bindingScope).
			Updates(map[string]any{
				"status":            model.AssetStatusProcessing,
				"lease_owner":       "",
				"lease_expires_at":  int64(0),
				"upstream_asset_id": "asset://observed-processing",
				"updated_at":        int64(100),
			}).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	result, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		PollDelay:    0,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
		Model:        options.Model,
		APIKey:       options.APIKey,
	})

	require.NoError(t, err)
	require.True(t, observedProcessing.Load())
	require.Equal(t, "asset://rematerialized-after-observed-processing", result.RewriteURI)
	require.Zero(t, atomic.LoadInt64(&materializer.getCalls))
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Len(t, store.signed, 1)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ? AND binding_scope = ?", asset.Id, channel.Id, bindingScope).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "asset://rematerialized-after-observed-processing", binding.UpstreamAssetId)
	require.EqualValues(t, 1, binding.AttemptCount)
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

func TestAssetBindingRetryableMaterializeErrorReleasesBindingForReclaim(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_retryable_release_aaaaaaaaaaaa")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{createErr: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests}}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
	})

	require.ErrorIs(t, err, ErrAssetBindingInitializing)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetBindingStatusPending, binding.Status)
	require.Equal(t, AssetMaterializeErrorThrottled, binding.ErrorCode)
	require.Empty(t, binding.LeaseOwner)
	require.Zero(t, binding.LeaseExpiresAt)

	materializer.createErr = nil
	assetBindingNow = func() time.Time { return time.Unix(101, 0) }
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
	require.Equal(t, int64(2), atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetBindingIdempotencyKeyStableAcrossRetryAndExcludesCredential(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_idempotency_retry_aaaaaaaa")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{createErr: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests}}
	restore := registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	defer restore()
	assetBindingNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetBindingNow = time.Now })

	_, err := MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-a",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
		APIKey:       "credential-must-not-appear",
	})
	require.ErrorIs(t, err, ErrAssetBindingInitializing)

	materializer.createErr = nil
	assetBindingNow = func() time.Time { return time.Unix(101, 0) }
	_, err = MaterializeAssetBinding(context.Background(), AssetBindingRequest{
		UserID:       asset.UserId,
		PublicID:     asset.PublicId,
		Channel:      channel,
		LeaseOwner:   "node-b",
		PollLimit:    1,
		LeaseTTL:     time.Minute,
		ExpectedType: "Image",
		APIKey:       "credential-must-not-appear",
	})
	require.NoError(t, err)

	keys := materializer.capturedIdempotencyKeys()
	require.Len(t, keys, 2)
	require.NotEmpty(t, keys[0])
	require.Equal(t, keys[0], keys[1])
	require.NotContains(t, keys[0], "credential")
	require.Equal(t, assetBindingIdempotencyKey(asset.SHA256, asset.Id, channel.Id, ""), keys[0])
}

func TestAssetBindingActivationRecoveryAcceptsSameStoredProviderResult(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_activation_recovery_active")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-recovered",
		createStatus:  model.AssetStatusActive,
		beforeCreate: func(input AssetMaterializeInput) {
			require.NoError(t, model.DB.Model(&model.AssetBinding{}).
				Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
				Updates(map[string]any{
					"status":            model.AssetStatusActive,
					"upstream_group_id": "group-1",
					"upstream_asset_id": "upstream-recovered",
					"lease_owner":       "",
					"lease_expires_at":  int64(0),
				}).Error)
		},
	}
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
	require.Equal(t, "asset://upstream-recovered", result.RewriteURI)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetBindingActivationRecoveryRetriesAfterDBErrorWithCurrentLease(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_activation_recovery_db_error")
	channel := insertMaterializeChannel(t, 131)
	activationErr := errors.New("activation db write failed")
	activationErrors := atomic.Int64{}
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-db-error-recovered",
		createStatus:  model.AssetStatusActive,
		beforeCreate: func(AssetMaterializeInput) {
			installAssetBindingActivationDBError(t, func() bool {
				return activationErrors.Add(1) == 1
			}, activationErr)
		},
	}
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
	require.Equal(t, "asset://upstream-db-error-recovered", result.RewriteURI)
	require.EqualValues(t, 2, activationErrors.Load(), "first activation write must hit DB error and recovery must retry once")
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	keys := materializer.capturedIdempotencyKeys()
	require.Equal(t, []string{assetBindingIdempotencyKey(asset.SHA256, asset.Id, channel.Id, "")}, keys)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-db-error-recovered", binding.UpstreamAssetId)
}

func TestAssetBindingActivationRecoveryPersistentDBErrorDoesNotFakeSuccessOrOverwriteConflict(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_activation_persistent_db_error")
	channel := insertMaterializeChannel(t, 131)
	activationErr := errors.New("activation db write persistently failed")
	activationErrors := atomic.Int64{}
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-provider-result",
		createStatus:  model.AssetStatusActive,
		beforeCreate: func(input AssetMaterializeInput) {
			require.NoError(t, model.DB.Model(&model.AssetBinding{}).
				Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
				Updates(map[string]any{
					"status":            model.AssetStatusActive,
					"upstream_asset_id": "upstream-conflict",
					"lease_owner":       "",
					"lease_expires_at":  int64(0),
				}).Error)
			installAssetBindingActivationDBError(t, func() bool {
				activationErrors.Add(1)
				return true
			}, activationErr)
		},
	}
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

	require.ErrorIs(t, err, ErrAssetBindingUnavailable)
	require.EqualValues(t, 1, activationErrors.Load(), "conflicting stored result should be reread without retrying a write over it")
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-conflict", binding.UpstreamAssetId)
}

func TestAssetBindingProviderResultRecoveryReusesStoredProcessingResult(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_provider_result_processing")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-processing-recovered",
		createStatus:  model.AssetStatusProcessing,
		getStatus:     model.AssetStatusActive,
		beforeCreate: func(input AssetMaterializeInput) {
			require.NoError(t, model.DB.Model(&model.AssetBinding{}).
				Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
				Updates(map[string]any{
					"status":            model.AssetStatusProcessing,
					"upstream_group_id": "group-1",
					"upstream_asset_id": "upstream-processing-recovered",
					"lease_owner":       "",
					"lease_expires_at":  int64(0),
				}).Error)
		},
	}
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
	require.Equal(t, "asset://upstream-processing-recovered", result.RewriteURI)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.getCalls))
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-processing-recovered", binding.UpstreamAssetId)
}

func TestAssetBindingProviderResultRecoveryRejectsConflictingUpstreamID(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_provider_result_conflict")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{
		createAssetID: "upstream-provider",
		createStatus:  model.AssetStatusActive,
		beforeCreate: func(input AssetMaterializeInput) {
			require.NoError(t, model.DB.Model(&model.AssetBinding{}).
				Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
				Updates(map[string]any{
					"status":            model.AssetStatusActive,
					"upstream_group_id": "group-1",
					"upstream_asset_id": "upstream-conflict",
					"lease_owner":       "",
					"lease_expires_at":  int64(0),
				}).Error)
		},
	}
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

	require.ErrorIs(t, err, ErrAssetBindingInitializing)
	require.Equal(t, int64(1), atomic.LoadInt64(&materializer.createCalls))
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, "upstream-conflict", binding.UpstreamAssetId)
}

func TestAssetBindingDefinitiveMaterializeErrorRemainsFailed(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_definitive_failed_aaaaaaaaaaaa")
	channel := insertMaterializeChannel(t, 131)
	materializer := &recordingAssetMaterializer{createErr: &AssetMaterializeFailure{Class: AssetMaterializeErrorDefinitive, HTTPStatus: http.StatusBadRequest}}
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

	require.ErrorIs(t, err, ErrAssetBindingUnavailable)
	var binding model.AssetBinding
	require.NoError(t, model.DB.First(&binding, "asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Error)
	require.Equal(t, model.AssetStatusFailed, binding.Status)
	require.Equal(t, AssetMaterializeErrorDefinitive, binding.ErrorCode)
}

func TestAssetBindingAPIErrorMapsRetryableMaterializeToAssetNotReady(t *testing.T) {
	apiErr := AssetBindingAPIError(&AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx})

	require.Equal(t, types.ErrorCodeAssetNotReady, apiErr.GetErrorCode())
	require.Equal(t, http.StatusConflict, apiErr.StatusCode)
	require.NotContains(t, apiErr.Error(), "upstream_5xx")
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

func TestAssetBindingScopeUsesLegacyTechMobiFallbackWhenProviderEmpty(t *testing.T) {
	channel := &model.Channel{
		Id:   120,
		Type: constant.ChannelTypeTechMobiVideo,
		Key:  "techmobi-key",
	}

	scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "seedance-2.0-fast", APIKey: "techmobi-key"})
	require.NoError(t, err)
	require.NotEmpty(t, scope)
	require.True(t, strings.HasPrefix(scope, "techmobi:v1:"))
}

func TestAssetBindingScopeUsesSeedanceProxyConfigWithoutModelOrType(t *testing.T) {
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid/v1/","group_id":"grp_shared_aigc"}}`,
	}

	scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "seedance-2.0-mini", APIKey: "seedance-key"})
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(scope, "seedance-proxy:v1:"))
	require.NotContains(t, scope, "seedance-2.0-mini")
	require.NotContains(t, scope, "byteplus")
}

func TestAssetMaterializerForChannelSelectsTokenSpaceMaterial(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid",
		GroupID:        "group-internal",
	})

	materializer, err := assetMaterializerForChannel(channel)

	require.NoError(t, err)
	require.IsType(t, tokenSpaceMaterialAssetBindingMaterializer{}, materializer)
}

func TestAssetBindingScopeForTokenSpaceMaterialIsCredentialScopedAndModelIndependent(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/path/",
		GroupID:        "group-internal",
	})

	first, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-a", APIKey: "key-a"})
	require.NoError(t, err)
	same, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-b", APIKey: "key-a"})
	require.NoError(t, err)
	otherKey, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-a", APIKey: "key-b"})
	require.NoError(t, err)

	require.Equal(t, first, same)
	require.NotEqual(t, first, otherKey)
	require.True(t, strings.HasPrefix(first, "tokenspace-material:v1:"))
}

func TestAssetBindingScopeForTokenSpaceMaterialChangesWithGroupAndOriginOnly(t *testing.T) {
	base := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/base/",
		GroupID:        "group-internal",
	})
	otherGroup := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/base/",
		GroupID:        "group-other",
	})
	otherOrigin := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://other-materials.example.invalid/base/",
		GroupID:        "group-internal",
	})
	otherType := channelWithAssetMaterializationSettings(t, constant.ChannelTypeBytePlus, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/other-path/",
		GroupID:        "group-internal",
	})

	options := AssetMaterializeOptions{Model: "seedance-2.0", APIKey: "key-a"}
	baseScope, err := assetBindingScopeForChannel(base, options)
	require.NoError(t, err)
	groupScope, err := assetBindingScopeForChannel(otherGroup, options)
	require.NoError(t, err)
	originScope, err := assetBindingScopeForChannel(otherOrigin, options)
	require.NoError(t, err)
	typeScope, err := assetBindingScopeForChannel(otherType, options)
	require.NoError(t, err)

	require.NotEqual(t, baseScope, groupScope)
	require.NotEqual(t, baseScope, originScope)
	require.Equal(t, baseScope, typeScope)
}

func TestAssetBindingScopeForTokenSpaceMaterialFailClosedAndEmptyProviderFallsBack(t *testing.T) {
	unknown := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "unknown_provider",
		GatewayBaseURL: "https://materials.example.invalid",
		GroupID:        "group-internal",
	})
	emptyProvider := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		GatewayBaseURL: "https://materials.example.invalid",
		GroupID:        "group-internal",
	})

	_, err := assetMaterializerForChannel(unknown)
	require.ErrorIs(t, err, ErrAssetBindingUnavailable)
	_, err = assetBindingScopeForChannel(unknown, AssetMaterializeOptions{Model: "model-a", APIKey: "key-a"})
	require.ErrorIs(t, err, ErrAssetBindingUnavailable)

	materializer, err := assetMaterializerForChannel(emptyProvider)
	require.NoError(t, err)
	require.IsType(t, techMobiAssetBindingMaterializer{}, materializer)
	scope, err := assetBindingScopeForChannel(emptyProvider, AssetMaterializeOptions{Model: "model-a", APIKey: "key-a"})
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(scope, "techmobi:v1:"))
}

func TestAssetBindingScopeRejectsUnknownExplicitProvider(t *testing.T) {
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		OtherSettings: `{"asset_materialization":{"provider":"unknown_provider","gateway_base_url":"https://asset-gateway.example.invalid","group_id":"grp_shared_aigc"}}`,
	}

	_, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "seedance-2.0-mini", APIKey: "seedance-key"})
	require.ErrorIs(t, err, ErrAssetBindingUnavailable)
}

func TestSeedanceProxyBindingScopeDigestNormalizesGatewayOrigin(t *testing.T) {
	rawGateway := "https://asset-gateway.example.invalid/v1/assets/"
	parsed, err := url.Parse(rawGateway)
	require.NoError(t, err)
	require.Equal(t, "/v1/assets/", parsed.Path)

	origin, err := normalizedGatewayOrigin(rawGateway)
	require.NoError(t, err)
	require.Equal(t, "https://asset-gateway.example.invalid", origin)
	sum := sha256.Sum256([]byte(origin + "\x00" + "grp_shared_aigc" + "\x00" + "seedance-key"))
	require.Equal(t, "seedance-proxy:v1:"+hex.EncodeToString(sum[:]), seedanceProxyBindingScope(origin, "grp_shared_aigc", "seedance-key"))
}

func TestSeedanceProxyBindingScopeIncludesNormalizedGatewayBasePath(t *testing.T) {
	baseA := channelWithAssetMaterializationSettings(t, constant.ChannelTypeBytePlus, dto.AssetMaterializationSettings{
		Provider:       "seedance_proxy",
		GatewayBaseURL: "https://ASSET-GATEWAY.example.invalid/v1/base/",
		GroupID:        "grp_shared_aigc",
	})
	baseATrailingVariant := channelWithAssetMaterializationSettings(t, constant.ChannelTypeBytePlus, dto.AssetMaterializationSettings{
		Provider:       "seedance_proxy",
		GatewayBaseURL: "https://asset-gateway.example.invalid/v1/base",
		GroupID:        "grp_shared_aigc",
	})
	baseB := channelWithAssetMaterializationSettings(t, constant.ChannelTypeBytePlus, dto.AssetMaterializationSettings{
		Provider:       "seedance_proxy",
		GatewayBaseURL: "https://asset-gateway.example.invalid/v2/base/",
		GroupID:        "grp_shared_aigc",
	})
	options := AssetMaterializeOptions{Model: "seedance-2.0", APIKey: "seedance-key"}

	scopeA, err := assetBindingScopeForChannel(baseA, options)
	require.NoError(t, err)
	scopeATrailingVariant, err := assetBindingScopeForChannel(baseATrailingVariant, options)
	require.NoError(t, err)
	scopeB, err := assetBindingScopeForChannel(baseB, options)
	require.NoError(t, err)

	require.Equal(t, scopeA, scopeATrailingVariant)
	require.NotEqual(t, scopeA, scopeB)
	require.True(t, strings.HasPrefix(scopeA, seedanceProxyBindingScopePrefix))
}

func TestTokenSpaceMaterialBindingScopeRemainsPathIndependent(t *testing.T) {
	baseA := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/v1/base/",
		GroupID:        "group-internal",
	})
	baseB := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid/v2/base/",
		GroupID:        "group-internal",
	})
	options := AssetMaterializeOptions{Model: "seedance-2.0", APIKey: "tokenspace-key"}

	scopeA, err := assetBindingScopeForChannel(baseA, options)
	require.NoError(t, err)
	scopeB, err := assetBindingScopeForChannel(baseB, options)
	require.NoError(t, err)

	require.Equal(t, scopeA, scopeB)
	require.True(t, strings.HasPrefix(scopeA, tokenSpaceMaterialBindingScopePrefix))
}

func TestNormalizedGatewayOriginRejectsNonHTTPS(t *testing.T) {
	_, err := normalizedGatewayOrigin("http://asset-gateway.example.invalid")
	require.Error(t, err)
}

func TestNormalizedGatewayOriginRejectsUserInfo(t *testing.T) {
	_, err := normalizedGatewayOrigin("https://user:pass@asset-gateway.example.invalid/v1/assets")
	require.Error(t, err)
}

func TestNormalizedGatewayOriginRejectsQueryFragmentOpaqueAndDotSegments(t *testing.T) {
	tests := []string{
		"https://asset-gateway.example.invalid/v1/assets?debug=1",
		"https://asset-gateway.example.invalid/v1/assets#fragment",
		"https:asset-gateway.example.invalid/v1/assets",
		"https://asset-gateway.example.invalid/v1/../assets",
		"https://asset-gateway.example.invalid/v1/./assets",
		"https://asset-gateway.example.invalid/v1/%2e%2e/assets",
		"https://asset-gateway.example.invalid/v1/%2E%2E/assets",
		"https://asset-gateway.example.invalid/v1/%252e%252e/assets",
	}

	for _, rawURL := range tests {
		t.Run(rawURL, func(t *testing.T) {
			_, err := normalizedGatewayOrigin(rawURL)
			require.Error(t, err)
		})
	}
}

func TestSeedanceProxyExplicitProviderOverridesLegacyTypeMaterializer(t *testing.T) {
	channel := &model.Channel{
		Type:          constant.ChannelTypeModelAPISeedance,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid/v1","group_id":"grp_shared_aigc"}}`,
	}

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)
	require.IsType(t, seedanceProxyAssetBindingMaterializer{}, materializer)

	scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "seedance-2.0", APIKey: "seedance-key"})
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(scope, seedanceProxyBindingScopePrefix))
}

func channelWithAssetMaterializationSettings(t *testing.T, channelType int, settings dto.AssetMaterializationSettings) *model.Channel {
	t.Helper()
	payload, err := common.Marshal(dto.ChannelOtherSettings{AssetMaterialization: &settings})
	require.NoError(t, err)
	return &model.Channel{
		Id:            156,
		Type:          channelType,
		Key:           "material-key",
		OtherSettings: string(payload),
	}
}
