package service

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAssetModelWorkerRetriesTransientScheduleAndPublishesActiveOnlyWhenExact(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
		{result: AssetMaterializeResult{UpstreamAssetID: "upstream-active", Status: model.AssetStatusActive}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_retry_aaaaaaaaaaaaaa", "techmobi-key-a")

	for _, step := range []struct {
		now       int64
		wantNext  int64
		wantState string
	}{
		{now: 100, wantNext: 105, wantState: model.AssetModelReadinessStatusRetryWaiting},
		{now: 105, wantNext: 120, wantState: model.AssetModelReadinessStatusRetryWaiting},
		{now: 120, wantNext: 150, wantState: model.AssetModelReadinessStatusRetryWaiting},
	} {
		processed, err := RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(step.now, 0))
		require.NoError(t, err)
		require.Equal(t, 1, processed)

		row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
		require.Equal(t, step.wantState, row.Status)
		require.Equal(t, step.wantNext, row.NextRetryAt)
		require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, []model.AssetModelReadiness{row}, map[string]model.AssetModelCoverageTarget{target.ModelName: target}))
	}

	processed, err := RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(150, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
	require.Equal(t, target.Generation, row.TargetGeneration)
	require.Equal(t, target.ChannelId, row.ChannelId)
	require.Equal(t, target.BindingScope, row.BindingScope)
	require.Equal(t, model.AssetStatusActive, ProjectAssetStatusForScope(asset, scope, []model.AssetModelReadiness{row}, map[string]model.AssetModelCoverageTarget{target.ModelName: target}))
	require.EqualValues(t, 4, atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetModelRotationAdvancesCandidateAfterGenerationWindowAndKeepsOldBinding(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &keyAwareAssetModelMaterializer{
		failKeys: map[string]error{"techmobi-key-a": &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, _ := seedAssetModelWorkerReadiness(t, "ast_worker_rotate_aaaaaaaaaaa", "techmobi-key-a\ntechmobi-key-b")

	processed, err := RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(100, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	first := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 0, first.CandidateIndex)

	processed, err = RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(401, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	second := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 1, second.CandidateIndex)
	require.Equal(t, int64(2), second.Generation)

	processed, err = RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(402, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
	require.Equal(t, second.Generation, row.TargetGeneration)

	var bindings []model.AssetBinding
	require.NoError(t, model.DB.Where("asset_id = ? AND channel_id = ?", asset.Id, second.ChannelId).Order("id ASC").Find(&bindings).Error)
	require.Len(t, bindings, 2)
	require.NotEqual(t, bindings[0].BindingScope, bindings[1].BindingScope)
}

func TestAssetModelDefinitiveCandidatesFailOnlyAfterAllCandidatesExhausted(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorDefinitive, HTTPStatus: http.StatusBadRequest}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorDefinitive, HTTPStatus: http.StatusBadRequest}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, _ := seedAssetModelWorkerReadiness(t, "ast_worker_definitive_aaaaaaaa", "techmobi-key-a\ntechmobi-key-b")

	processed, err := RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(100, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.NotEqual(t, model.AssetModelReadinessStatusFailed, row.Status)
	target := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 1, target.CandidateIndex)
	require.Equal(t, model.AssetModelTargetStatusActive, target.Status)

	processed, err = RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(101, 0))
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	target = requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, model.AssetModelTargetStatusUnavailable, target.Status)
}

func TestAssetModelRetryAfterOverridesScheduleAndPreservesAttemptAcrossBatches(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests, RetryAfter: 45 * time.Second}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, _ := seedAssetModelWorkerReadiness(t, "ast_worker_retry_after_aaaaaaa", "techmobi-key-a")

	_, err := RunAssetModelReadinessBatch(context.Background(), "node-a", time.Unix(100, 0))
	require.NoError(t, err)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, int64(145), row.NextRetryAt)
	require.Equal(t, 1, row.AttemptCount)
	require.Equal(t, int64(100), row.AttemptStartedAt)

	_, err = RunAssetModelReadinessBatch(context.Background(), "node-b", time.Unix(145, 0))
	require.NoError(t, err)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, int64(160), row.NextRetryAt)
	require.Equal(t, 2, row.AttemptCount)
	require.Equal(t, int64(100), row.AttemptStartedAt)
}

func TestAssetModelWorkerExpiredLeaseAndGenerationDriftCannotActivate(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{result: AssetMaterializeResult{UpstreamAssetID: "upstream-active", Status: model.AssetStatusActive}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_drift_aaaaaaaaaaaa", "techmobi-key-a")
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)

	require.NoError(t, model.DB.Model(&model.AssetModelReadiness{}).Where("id = ?", row.Id).Updates(map[string]any{
		"status":             model.AssetModelReadinessStatusProcessing,
		"lease_owner":        "node-a",
		"lease_expires_at":   int64(110),
		"attempt_count":      1,
		"attempt_started_at": int64(100),
		"target_generation":  target.Generation + 1,
		"channel_id":         target.ChannelId,
		"binding_scope":      target.BindingScope,
	}).Error)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)

	err := PrepareAssetModelReadiness(context.Background(), row, "node-a", time.Unix(120, 0))
	require.NoError(t, err)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.NotEqual(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelMultiNodeCreatesExactProviderAssetOnce(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		blockCreate: make(chan struct{}),
		create:      []scriptedAssetModelCreate{{result: AssetMaterializeResult{UpstreamAssetID: "upstream-once", Status: model.AssetStatusActive}}},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, _ := seedAssetModelWorkerReadiness(t, "ast_worker_multinode_aaaaaaaa", "techmobi-key-a")

	errs := make(chan error, 2)
	var ready sync.WaitGroup
	ready.Add(2)
	for _, owner := range []string{"node-a", "node-b"} {
		owner := owner
		go func() {
			ready.Done()
			ready.Wait()
			_, err := RunAssetModelReadinessBatch(context.Background(), owner, time.Unix(100, 0))
			errs <- err
		}()
	}
	close(materializer.blockCreate)
	require.NoError(t, <-errs)
	require.NoError(t, <-errs)

	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetModelStatusReopensWhenTargetEligibilityChanges(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &scriptedAssetModelMaterializer{})
	restoreStrict := setAssetStrictForTest(t, true)
	defer restoreStrict()
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_reopen_aaaaaaaaaaa", "techmobi-key-a\ntechmobi-key-b")
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: target.ChannelId, BindingScope: target.BindingScope,
		Status: model.AssetStatusActive, UpstreamAssetId: "upstream-old", CreatedAt: 100, UpdatedAt: 100,
	}).Error)
	require.NoError(t, model.DB.Model(&model.AssetModelReadiness{}).Where("asset_id = ?", asset.Id).Updates(map[string]any{
		"target_generation": target.Generation,
		"channel_id":        target.ChannelId,
		"binding_scope":     target.BindingScope,
		"status":            model.AssetModelReadinessStatusActive,
		"updated_at":        int64(100),
	}).Error)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", target.ChannelId).Updates(map[string]any{
		"key": "techmobi-key-b",
	}).Error)
	result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusProcessing, result.Status)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.NotEqual(t, model.AssetModelReadinessStatusActive, row.Status)
	require.NotEqual(t, target.BindingScope, row.BindingScope)
	var stored model.Asset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.AssetStatusActive, stored.Status)
}

type scriptedAssetModelCreate struct {
	result AssetMaterializeResult
	err    error
}

type scriptedAssetModelMaterializer struct {
	mu          sync.Mutex
	create      []scriptedAssetModelCreate
	createCalls int64
	blockCreate chan struct{}
}

func (m *scriptedAssetModelMaterializer) CreateAsset(_ context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	atomic.AddInt64(&m.createCalls, 1)
	if m.blockCreate != nil {
		<-m.blockCreate
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.create) == 0 {
		return AssetMaterializeResult{UpstreamAssetID: "upstream-" + input.APIKey, Status: model.AssetStatusActive}, nil
	}
	next := m.create[0]
	m.create = m.create[1:]
	return next.result, next.err
}

func (m *scriptedAssetModelMaterializer) GetAsset(_ context.Context, _ AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	return AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: model.AssetStatusActive}, nil
}

type keyAwareAssetModelMaterializer struct {
	failKeys    map[string]error
	createCalls int64
}

func (m *keyAwareAssetModelMaterializer) CreateAsset(_ context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	atomic.AddInt64(&m.createCalls, 1)
	if err := m.failKeys[input.APIKey]; err != nil {
		return AssetMaterializeResult{}, err
	}
	return AssetMaterializeResult{UpstreamAssetID: "upstream-" + input.APIKey, Status: model.AssetStatusActive}, nil
}

func (m *keyAwareAssetModelMaterializer) GetAsset(_ context.Context, _ AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	return AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: model.AssetStatusActive}, nil
}

func newAssetModelWorkerTestDB(t *testing.T) {
	t.Helper()
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}, &model.AssetModelReadiness{}))
}

func seedAssetModelWorkerReadiness(t *testing.T, publicID string, keys string) (model.Asset, AssetModelScope, model.AssetModelCoverageTarget) {
	t.Helper()
	asset := insertMaterializeAsset(t, publicID)
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: keys,
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	})
	scope := AssetModelScope{ScopeKey: "scope-" + publicID, Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 90)
	require.NoError(t, err)
	require.NotNil(t, target)
	require.NoError(t, model.EnsureAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames, 90))
	return asset, scope, *target
}

func requireAssetModelReadinessRow(t *testing.T, assetID int64, scope AssetModelScope, modelName string) model.AssetModelReadiness {
	t.Helper()
	var row model.AssetModelReadiness
	require.NoError(t, model.DB.Where("asset_id = ? AND scope_key = ? AND model_name = ?", assetID, scope.ScopeKey, modelName).First(&row).Error)
	return row
}

func requireAssetModelTarget(t *testing.T, scope AssetModelScope, modelName string) model.AssetModelCoverageTarget {
	t.Helper()
	target, err := model.GetAssetModelCoverageTarget(scope.ScopeKey, modelName)
	require.NoError(t, err)
	return *target
}
