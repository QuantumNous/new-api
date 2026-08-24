package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
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
		processed, err := runAssetModelReadinessBatchAt(t, "node-a", step.now)
		require.NoError(t, err)
		require.Equal(t, 1, processed)

		row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
		require.Equal(t, step.wantState, row.Status)
		require.Equal(t, step.wantNext, row.NextRetryAt)
		require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, []model.AssetModelReadiness{row}, map[string]model.AssetModelCoverageTarget{target.ModelName: target}))
	}

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 150)
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

func TestAssetModelWorkerRetriesUpstreamProcessingEveryFiveSeconds(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing, RetryAfter: 45 * time.Second}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{result: AssetMaterializeResult{UpstreamAssetID: "upstream-active", Status: model.AssetStatusActive}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_processing_retry", "techmobi-key-a")

	for _, step := range []struct {
		now      int64
		wantNext int64
	}{
		{now: 100, wantNext: 105},
		{now: 105, wantNext: 110},
		{now: 110, wantNext: 155},
		{now: 155, wantNext: 160},
	} {
		processed, err := runAssetModelReadinessBatchAt(t, "node-a", step.now)
		require.NoError(t, err)
		require.Equal(t, 1, processed)

		row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
		require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
		require.Equal(t, AssetMaterializeErrorProcessing, row.ErrorClass)
		require.Equal(t, step.wantNext, row.NextRetryAt)
	}

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 160)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
	require.EqualValues(t, 5, atomic.LoadInt64(&materializer.createCalls))
}

func TestAssetModelWorkerRefreshesDBTimeForEveryBatchRow(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		blockFirstCreate: make(chan struct{}),
		create: []scriptedAssetModelCreate{
			{result: AssetMaterializeResult{UpstreamAssetID: "upstream-first", Status: model.AssetStatusActive}},
			{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
		},
	}
	t.Cleanup(func() {
		select {
		case <-materializer.blockFirstCreate:
		default:
			close(materializer.blockFirstCreate)
		}
	})
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	firstAsset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_fresh_time_first", "techmobi-key-a")
	secondAsset := insertMaterializeAsset(t, "ast_worker_fresh_time_second")
	require.NoError(t, model.EnsureAssetModelReadiness(secondAsset.Id, scope.ScopeKey, scope.ModelNames, 90))

	dbNow := atomic.Int64{}
	dbNow.Store(100)
	originalDBTimestamp := assetModelWorkerDBTimestamp
	assetModelWorkerDBTimestamp = func(context.Context) (int64, error) {
		return dbNow.Load(), nil
	}
	t.Cleanup(func() { assetModelWorkerDBTimestamp = originalDBTimestamp })

	results := make(chan assetModelWorkerBatchResult, 1)
	go func() {
		processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
		results <- assetModelWorkerBatchResult{processed: processed, err: err}
	}()
	waitForAssetModelCreateCalls(t, materializer, 1)
	dbNow.Store(131)
	close(materializer.blockFirstCreate)
	result := receiveAssetModelWorkerBatchResult(t, results)
	require.NoError(t, result.err)
	require.Equal(t, 2, result.processed)

	first := requireAssetModelReadinessRow(t, firstAsset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, first.Status)
	second := requireAssetModelReadinessRow(t, secondAsset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, second.Status)
	require.Equal(t, int64(136), second.NextRetryAt)

	claimed, err := model.ClaimAssetModelReadinessLease(second.Id, "node-b", 131, 161)
	require.NoError(t, err)
	require.False(t, claimed, "second row must not be immediately reclaimable with the DB time observed before its claim")
}

func TestAssetModelRotationAdvancesCandidateAfterGenerationWindowAndKeepsOldBinding(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &keyAwareAssetModelMaterializer{
		failKeys: map[string]error{"techmobi-key-a": &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, _ := seedAssetModelWorkerReadiness(t, "ast_worker_rotate_aaaaaaaaaaa", "techmobi-key-a\ntechmobi-key-b")

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	first := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 0, first.CandidateIndex)

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 401)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	second := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 1, second.CandidateIndex)
	require.Equal(t, int64(2), second.Generation)

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 402)
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

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.NotEqual(t, model.AssetModelReadinessStatusFailed, row.Status)
	target := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, 1, target.CandidateIndex)
	require.Equal(t, model.AssetModelTargetStatusActive, target.Status)

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 101)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	target = requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, model.AssetModelTargetStatusUnavailable, target.Status)
}

func TestAssetModelRetryWindowFailsAfterFinalCandidate(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_final_retry_aaaaaa", "techmobi-key-a")

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, int64(100), row.AttemptStartedAt)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 401)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	updated := requireAssetModelTarget(t, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, model.AssetModelTargetStatusUnavailable, updated.Status)
	require.Equal(t, target.Generation+1, updated.Generation)
	require.Equal(t, 0, updated.CandidateIndex)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls), "final candidate exhaustion must not republish and retry the same candidate")

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 402)
	require.NoError(t, err)
	require.Equal(t, 0, processed)
	stable := requireAssetModelTarget(t, scope, target.ModelName)
	require.Equal(t, updated.Generation, stable.Generation)
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

	_, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, int64(145), row.NextRetryAt)
	require.Equal(t, 1, row.AttemptCount)
	require.Equal(t, int64(100), row.AttemptStartedAt)

	_, err = runAssetModelReadinessBatchAt(t, "node-b", 145)
	require.NoError(t, err)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, int64(160), row.NextRetryAt)
	require.Equal(t, 2, row.AttemptCount)
	require.Equal(t, int64(100), row.AttemptStartedAt)
}

func TestAssetModelWorkerFailsWhenTargetAlreadyUnavailable(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_target_unavailable", "techmobi-key-a")
	require.NoError(t, model.DB.Model(&model.AssetModelCoverageTarget{}).
		Where("scope_key = ? AND model_name = ?", scope.ScopeKey, target.ModelName).
		Updates(map[string]any{
			"status":     model.AssetModelTargetStatusUnavailable,
			"updated_at": int64(99),
		}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls))

	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, "target_unavailable", row.ErrorClass)
}

func TestAssetModelWorkerRevalidatesTargetEligibilityBeforeProviderWrite(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, first := seedAssetModelWorkerReadiness(t, "ast_worker_revalidate_aaaaaaaaa", "techmobi-key-a\ntechmobi-key-b")
	disableChannelCredential(t, first.ChannelId, 0)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "stale target must not write provider asset")

	unchanged := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, first.Generation, unchanged.Generation)
	require.Equal(t, first.BindingScope, unchanged.BindingScope)
	require.Equal(t, model.AssetModelTargetStatusActive, unchanged.Status)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, first.Generation, row.TargetGeneration)
	require.Equal(t, int64(105), row.NextRetryAt)
}

func TestAssetModelWorkerRetriesWhenPersistedTargetFallsOutOfCandidateSet(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, first := seedAssetModelWorkerReadiness(t, "ast_worker_target_drift_retry", "techmobi-key-a\ntechmobi-key-b")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", first.ChannelId).Updates(map[string]any{
		"key": "techmobi-key-c",
	}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "candidate drift must not replay candidate zero")

	unchanged := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, first.Generation, unchanged.Generation)
	require.Equal(t, first.CandidateIndex, unchanged.CandidateIndex)
	require.Equal(t, first.BindingScope, unchanged.BindingScope)
	require.Equal(t, model.AssetModelTargetStatusActive, unchanged.Status)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, first.Generation, row.TargetGeneration)
	require.Equal(t, int64(105), row.NextRetryAt)
}

func TestAssetModelWorkerRepublishesCurrentCandidateWhenDriftWindowExpires(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, first := seedAssetModelWorkerReadiness(t, "ast_worker_target_drift_window", "techmobi-key-a\ntechmobi-key-b")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", first.ChannelId).Updates(map[string]any{
		"key": "techmobi-key-c",
	}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "drift before the window expires must not write provider asset")

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 401)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "rotation after drift must only publish a fresh target; provider write happens after revalidation")

	updated := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelTargetStatusActive, updated.Status)
	require.Equal(t, first.Generation+1, updated.Generation)
	require.Equal(t, 0, updated.CandidateIndex)
	require.NotEqual(t, first.BindingScope, updated.BindingScope)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusPending, row.Status)
	require.Equal(t, updated.Generation, row.TargetGeneration)
	require.Equal(t, updated.ChannelId, row.ChannelId)
	require.Equal(t, updated.BindingScope, row.BindingScope)
	require.Equal(t, int64(0), row.AttemptStartedAt)

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 402)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelWorkerFailsWhenDriftWindowExpiresWithoutCandidates(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, first := seedAssetModelWorkerReadiness(t, "ast_worker_target_drift_empty", "techmobi-key-a")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", first.ChannelId).Updates(map[string]any{
		"status": common.ChannelStatusManuallyDisabled,
	}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls))
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 401)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "empty candidate set must not replay a stale provider write")

	updated := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelTargetStatusUnavailable, updated.Status)
	require.Equal(t, first.Generation+1, updated.Generation)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, "target_unavailable", row.ErrorClass)
}

func TestAssetModelWorkerBindingLeaseOutlivesReadinessLeaseDuringSlowProviderWrite(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		blockFirstCreate: make(chan struct{}),
		create:           []scriptedAssetModelCreate{{result: AssetMaterializeResult{UpstreamAssetID: "upstream-slow", Status: model.AssetStatusActive}}},
	}
	t.Cleanup(func() {
		select {
		case <-materializer.blockFirstCreate:
		default:
			close(materializer.blockFirstCreate)
		}
	})
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_slow_provider_aaaa", "techmobi-key-a")

	results := make(chan assetModelWorkerBatchResult, 1)
	go func() {
		processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
		results <- assetModelWorkerBatchResult{processed: processed, err: err}
	}()
	waitForAssetModelCreateCalls(t, materializer, 1)

	processed, err := runAssetModelReadinessBatchAt(t, "node-b", 140)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls), "fresh binding lease must block duplicate provider writes after readiness lease takeover")

	close(materializer.blockFirstCreate)
	result := receiveAssetModelWorkerBatchResult(t, results)
	require.NoError(t, result.err)
	require.Equal(t, 1, result.processed)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))

	binding, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-slow", binding.UpstreamAssetId)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.NotEqual(t, model.AssetModelReadinessStatusFailed, row.Status)
}

func TestAssetModelWorkerFinalPreflightRejectsTargetCredentialChangeBeforeProviderWrite(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_preflight_aaaaaaa", "techmobi-key-a\ntechmobi-key-b")

	originalHook := assetModelWorkerFinalPreflightHook
	assetModelWorkerFinalPreflightHook = func() {
		disableChannelCredential(t, target.ChannelId, 0)
	}
	t.Cleanup(func() { assetModelWorkerFinalPreflightHook = originalHook })

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "final preflight must catch stale credentials before provider side effects")

	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.NotEqual(t, model.AssetModelReadinessStatusActive, row.Status)
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, int64(105), row.NextRetryAt)
	unchanged := requireAssetModelTarget(t, scope, "seedance-2.0")
	require.Equal(t, target.Generation, unchanged.Generation)
	require.Equal(t, target.BindingScope, unchanged.BindingScope)
	require.Equal(t, model.AssetModelTargetStatusActive, unchanged.Status)
}

func TestAssetModelWorkerFinalPreflightFailsWhenTargetBecomesUnavailable(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_preflight_unavail", "techmobi-key-a")

	originalHook := assetModelWorkerFinalPreflightHook
	assetModelWorkerFinalPreflightHook = func() {
		require.NoError(t, model.DB.Model(&model.AssetModelCoverageTarget{}).
			Where("scope_key = ? AND model_name = ?", scope.ScopeKey, target.ModelName).
			Updates(map[string]any{
				"status":     model.AssetModelTargetStatusUnavailable,
				"updated_at": int64(100),
			}).Error)
	}
	t.Cleanup(func() { assetModelWorkerFinalPreflightHook = originalHook })

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "unavailable target must stop before provider write")

	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, "target_unavailable", row.ErrorClass)
}

func TestAssetModelWorkerRetryableProcessingRefreshSchedulesRetryWithoutFailingBinding(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		get: []scriptedAssetModelGet{
			{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorUpstream5xx, HTTPStatus: http.StatusBadGateway, RetryAfter: 40 * time.Second}},
			{result: AssetMaterializeResult{UpstreamAssetID: "upstream-processing", Status: model.AssetStatusActive}},
		},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, materializer)
	asset := insertMaterializeAsset(t, "ast_worker_refresh_retry_aaaaaa")
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 131, ChannelType: constant.ChannelTypeBytePlus, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "byteplus-key",
		Mapping: `{"seedance-2.0":"byteplus/seedance-pro"}`,
	})
	scope := AssetModelScope{ScopeKey: "scope-" + asset.PublicId, Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 90)
	require.NoError(t, err)
	require.NotNil(t, target)
	require.NoError(t, model.EnsureAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames, 90))
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: target.ChannelId, BindingScope: target.BindingScope,
		Status: model.AssetStatusProcessing, UpstreamAssetId: "upstream-processing", CreatedAt: 90, UpdatedAt: 90,
	}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, int64(140), row.NextRetryAt)

	binding, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.NotEqual(t, model.AssetStatusFailed, binding.Status)
	require.Equal(t, model.AssetStatusProcessing, binding.Status)
	require.Equal(t, "upstream-processing", binding.UpstreamAssetId)
	require.Equal(t, "", binding.ErrorCode)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls))

	processed, err = runAssetModelReadinessBatchAt(t, "node-a", 140)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls), "retry must poll existing upstream asset instead of creating a duplicate")
	require.Equal(t, []string{"upstream-processing", "upstream-processing"}, materializer.getUpstreamIDs())

	binding, err = model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-processing", binding.UpstreamAssetId)
	row = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelWorkerTechMobiHistoricalProcessingOpaqueAssetRematerializes(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		get: []scriptedAssetModelGet{
			{err: errors.New("TechMobi processing rows must not be refreshed from opaque asset URLs")},
		},
		create: []scriptedAssetModelCreate{
			{result: AssetMaterializeResult{UpstreamAssetID: "asset://worker-rematerialized", Status: model.AssetStatusActive}},
		},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_techmobi_remat", "techmobi-key-a")
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       target.ChannelId,
		BindingScope:    target.BindingScope,
		Status:          model.AssetStatusProcessing,
		UpstreamAssetId: "asset://historical-processing",
		CreatedAt:       90,
		UpdatedAt:       90,
	}).Error)

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Empty(t, materializer.getUpstreamIDs())
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))
	binding, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "asset://worker-rematerialized", binding.UpstreamAssetId)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelWorkerIdempotencyKeyStableAcrossRetry(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorThrottled, HTTPStatus: http.StatusTooManyRequests}},
		{result: AssetMaterializeResult{UpstreamAssetID: "upstream-idem-worker", Status: model.AssetStatusActive}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_idempotency_aaaa", "techmobi-key-a")

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = runAssetModelReadinessBatchAt(t, "node-b", 105)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	keys := materializer.capturedIdempotencyKeys()
	require.Len(t, keys, 2)
	require.NotEmpty(t, keys[0])
	require.Equal(t, keys[0], keys[1])
	require.NotContains(t, keys[0], "techmobi-key-a")
	require.Equal(t, assetBindingIdempotencyKey(asset.SHA256, asset.Id, target.ChannelId, target.BindingScope), keys[0])
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelWorkerActivationRecoveryAcceptsSameStoredProviderResult(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{
		create: []scriptedAssetModelCreate{{result: AssetMaterializeResult{UpstreamAssetID: "upstream-worker-recovered", Status: model.AssetStatusActive}}},
		beforeCreate: func(input AssetMaterializeInput) {
			require.NoError(t, model.DB.Model(&model.AssetBinding{}).
				Where("asset_id = ? AND channel_id = ?", input.Asset.Id, input.Channel.Id).
				Updates(map[string]any{
					"status":            model.AssetStatusActive,
					"upstream_asset_id": "upstream-worker-recovered",
					"lease_owner":       "",
					"lease_expires_at":  int64(0),
				}).Error)
		},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_activation_recovery", "techmobi-key-a")

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))
	binding, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-worker-recovered", binding.UpstreamAssetId)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestAssetModelWorkerActivationRecoveryRetriesAfterDBErrorWithCurrentLease(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	activationErr := errors.New("worker activation db write failed")
	activationErrors := atomic.Int64{}
	materializer := &scriptedAssetModelMaterializer{
		create: []scriptedAssetModelCreate{{result: AssetMaterializeResult{UpstreamAssetID: "upstream-worker-db-error", Status: model.AssetStatusActive}}},
		beforeCreate: func(AssetMaterializeInput) {
			installAssetBindingActivationDBError(t, func() bool {
				return activationErrors.Add(1) == 1
			}, activationErr)
		},
	}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_activation_db_error", "techmobi-key-a")

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 100)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 2, activationErrors.Load(), "first activation write must hit DB error and recovery must retry once")
	require.EqualValues(t, 1, atomic.LoadInt64(&materializer.createCalls))
	keys := materializer.capturedIdempotencyKeys()
	require.Equal(t, []string{assetBindingIdempotencyKey(asset.SHA256, asset.Id, target.ChannelId, target.BindingScope)}, keys)
	binding, err := model.GetAssetBindingForScope(asset.Id, target.ChannelId, target.BindingScope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, binding.Status)
	require.Equal(t, "upstream-worker-db-error", binding.UpstreamAssetId)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
}

func TestPrepareAssetModelReadinessActivatesExactProviderBindingSet(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, targets := seedAtomicAssetModelReadinessSet(t, "ast_atomic_provider", constant.ChannelTypeTechMobiVideo)
	driverTarget := targets["seedance-2.0"]
	siblingTarget := targets["seedance2.0-pro"]
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       driverTarget.ChannelId,
		BindingScope:    driverTarget.BindingScope,
		Status:          model.AssetStatusActive,
		UpstreamAssetId: "upstream-shared",
		CreatedAt:       90,
		UpdatedAt:       90,
	}).Error)

	driver := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	claimed, err := model.ClaimAssetModelReadinessLease(driver.Id, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)
	driver = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")

	err = PrepareAssetModelReadiness(context.Background(), driver, "node-a", time.Unix(100, 0))
	require.NoError(t, err)
	require.EqualValues(t, 0, atomic.LoadInt64(&materializer.createCalls))

	driver = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	sibling := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance2.0-pro")
	require.Equal(t, model.AssetModelReadinessStatusActive, driver.Status)
	require.Equal(t, model.AssetModelReadinessStatusActive, sibling.Status)
	require.Equal(t, siblingTarget.Generation, sibling.TargetGeneration)
	require.Equal(t, siblingTarget.ChannelId, sibling.ChannelId)
	require.Equal(t, siblingTarget.BindingScope, sibling.BindingScope)
}

func TestPrepareAssetModelBindingAllowsSeedanceProxyAudioProviderWrite(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_worker_seedance_audio")
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"asset_type":   "Audio",
		"content_type": "audio/mpeg",
	}).Error)
	asset.AssetType = "Audio"

	var seenRequest seedanceProxyAssetCreateRequest
	providerCalled := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalled = true
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, seedanceProxyAssetUploadPath, r.URL.Path)
		require.NoError(t, common.DecodeJson(r.Body, &seenRequest))
		_, _ = io.WriteString(w, `{"Result":{"Id":"upstream-audio","GroupId":"grp_shared_aigc","Status":"Active"}}`)
	}))
	defer server.Close()

	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID:            181,
		ChannelType:   constant.ChannelTypeBytePlus,
		Group:         "default",
		ModelName:     "seedance-2.0",
		Priority:      80,
		Weight:        50,
		Key:           "seedance-worker-key",
		Mapping:       `{"seedance-2.0":"doubao/seedance-pro"}`,
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + server.URL + `","group_id":"grp_shared_aigc"}}`,
	})
	scope := AssetModelScope{ScopeKey: "scope-worker-seedance-audio", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 90)
	require.NoError(t, err)
	channel, err := loadAssetModelReadinessChannel(target.ChannelId)
	require.NoError(t, err)
	options, _, err := ResolveAssetModelTargetOptions(*target, channel)
	require.NoError(t, err)

	originalFactory := seedanceProxyAssetHTTPClientFactory
	seedanceProxyAssetHTTPClientFactory = func(*model.Channel) (*http.Client, error) {
		return server.Client(), nil
	}
	t.Cleanup(func() { seedanceProxyAssetHTTPClientFactory = originalFactory })

	result, err := prepareAssetModelBinding(context.Background(), asset, *target, channel, options, "node-a", 100)
	require.NoError(t, err)
	require.True(t, providerCalled)
	require.Equal(t, "Audio", seenRequest.AssetType)
	require.Equal(t, "grp_shared_aigc", seenRequest.GroupID)
	require.Equal(t, "upstream-audio", result.UpstreamAssetId)
	require.Equal(t, model.AssetStatusActive, result.Status)

	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.AssetBinding{}).Where("asset_id = ?", asset.Id).Count(&bindingCount).Error)
	require.EqualValues(t, 1, bindingCount)
}

func TestPrepareAssetModelBindingAllowsTokenSpaceAudioBeforeProviderWrite(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	asset := insertMaterializeAsset(t, "ast_worker_tokenspace_audio")
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"asset_type":   "Audio",
		"content_type": "audio/mpeg",
	}).Error)
	asset.AssetType = "Audio"
	asset.ContentType = "audio/mpeg"

	var seenRequest tokenSpaceMaterialCreateRequest
	providerCalled := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalled = true
		require.Equal(t, "CreateAsset", r.URL.Query().Get("Action"))
		require.NoError(t, common.DecodeJson(r.Body, &seenRequest))
		_, _ = io.WriteString(w, `{"Result":{"Id":"upstream-audio","GroupId":"group-internal","Status":"Active"}}`)
	}))
	defer server.Close()
	restore := installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	defer restore()

	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID:            182,
		ChannelType:   constant.ChannelTypeTechMobiVideo,
		Group:         "default",
		ModelName:     "seedance-2.0",
		Priority:      80,
		Weight:        50,
		Key:           "tokenspace-worker-key",
		Mapping:       `{"seedance-2.0":"doubao/seedance-pro"}`,
		OtherSettings: `{"asset_materialization":{"provider":"tokenspace_material","gateway_base_url":"` + server.URL + `","group_id":"group-internal"}}`,
	})
	scope := AssetModelScope{ScopeKey: "scope-worker-tokenspace-audio", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 90)
	require.NoError(t, err)
	require.NotNil(t, target)
	channel, err := loadAssetModelReadinessChannel(target.ChannelId)
	require.NoError(t, err)
	options, _, err := ResolveAssetModelTargetOptions(*target, channel)
	require.NoError(t, err)

	_, err = prepareAssetModelBinding(context.Background(), asset, *target, channel, options, "node-a", 100)

	require.True(t, providerCalled)
	require.Equal(t, "Audio", seenRequest.AssetType)
	var definitiveErr assetModelBindingDefinitiveError
	require.False(t, errors.As(err, &definitiveErr))
}

func TestPrepareAssetModelReadinessActivatesExactSourceURLBindingSetWithoutAssetBindingRow(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	asset, scope, targets := seedAtomicAssetModelReadinessSet(t, "ast_atomic_source_url", constant.ChannelTypeModelAPISeedance)
	driverTarget := targets["seedance-2.0"]
	siblingTarget := targets["seedance2.0-pro"]
	require.Equal(t, assetModelSourceURLBindingScopeModelAPI, driverTarget.BindingScope)
	require.Equal(t, assetModelSourceURLBindingScopeModelAPI, siblingTarget.BindingScope)

	driver := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	claimed, err := model.ClaimAssetModelReadinessLease(driver.Id, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)
	driver = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")

	err = PrepareAssetModelReadiness(context.Background(), driver, "node-a", time.Unix(100, 0))
	require.NoError(t, err)

	driver = requireAssetModelReadinessRow(t, asset.Id, scope, "seedance-2.0")
	sibling := requireAssetModelReadinessRow(t, asset.Id, scope, "seedance2.0-pro")
	require.Equal(t, model.AssetModelReadinessStatusActive, driver.Status)
	require.Equal(t, model.AssetModelReadinessStatusActive, sibling.Status)
	require.Equal(t, siblingTarget.Generation, sibling.TargetGeneration)
	require.Equal(t, siblingTarget.ChannelId, sibling.ChannelId)
	require.Equal(t, siblingTarget.BindingScope, sibling.BindingScope)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.AssetBinding{}).Where("asset_id = ?", asset.Id).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
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
			_, err := runAssetModelReadinessBatchAt(t, owner, 100)
			errs <- err
		}()
	}
	close(materializer.blockCreate)
	require.NoError(t, receiveAssetModelWorkerError(t, errs))
	require.NoError(t, receiveAssetModelWorkerError(t, errs))

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

func TestAssetModelWorkerStructuredEventsCoverRequiredOutcomesWithoutSecrets(t *testing.T) {
	events := captureAssetModelWorkerEvents(t)
	row := model.AssetModelReadiness{
		ModelName:        "seedance-2.0",
		TargetGeneration: 3,
		ChannelId:        120,
		AttemptCount:     2,
	}

	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventSelection, Model: row.ModelName, Generation: 1, ChannelID: 120})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventCacheHit, Model: row.ModelName, Generation: 1, ChannelID: 120})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventRotation, PublicAssetID: "ast_public", Model: row.ModelName, Generation: 2, ChannelID: 120})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventWrite, PublicAssetID: "ast_public", Model: row.ModelName, Generation: 2, ChannelID: 120})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventThrottle, PublicAssetID: "ast_public", Model: row.ModelName, Generation: 2, ChannelID: 120, ErrorClass: AssetMaterializeErrorThrottled, Attempt: 2, RetryDelay: 15 * time.Second})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventWindowExhausted, PublicAssetID: "ast_public", Model: row.ModelName, Generation: 2, ChannelID: 120, Elapsed: assetModelGenerationWindow})
	recordAssetModelWorkerEvent(context.Background(), assetModelWorkerEvent{Name: assetModelEventActivationLatency, PublicAssetID: "ast_public", Model: row.ModelName, Generation: 2, ChannelID: 120, Elapsed: 3 * time.Second})

	require.ElementsMatch(t, []string{
		assetModelEventSelection,
		assetModelEventCacheHit,
		assetModelEventRotation,
		assetModelEventWrite,
		assetModelEventThrottle,
		assetModelEventWindowExhausted,
		assetModelEventActivationLatency,
	}, assetModelWorkerEventNames(events))
	for _, event := range *events {
		text := formatAssetModelWorkerEvent(event)
		for _, forbidden := range []string{"techmobi-key", "binding_scope", "signed", "authorization", "upstream-processing", "body"} {
			require.NotContains(t, text, forbidden)
		}
		require.Contains(t, text, "asset_model_event=")
	}
}

type scriptedAssetModelCreate struct {
	result AssetMaterializeResult
	err    error
}

type scriptedAssetModelGet struct {
	result AssetMaterializeResult
	err    error
}

type scriptedAssetModelMaterializer struct {
	mu               sync.Mutex
	create           []scriptedAssetModelCreate
	get              []scriptedAssetModelGet
	createCalls      int64
	blockCreate      chan struct{}
	blockFirstCreate chan struct{}
	beforeCreate     func(AssetMaterializeInput)
	getIDs           []string
	idempotencyKeys  []string
}

func (m *scriptedAssetModelMaterializer) CreateAsset(_ context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	call := atomic.AddInt64(&m.createCalls, 1)
	if m.blockCreate != nil {
		<-m.blockCreate
	}
	if m.blockFirstCreate != nil && call == 1 {
		<-m.blockFirstCreate
	}
	if m.beforeCreate != nil {
		m.beforeCreate(input)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.idempotencyKeys = append(m.idempotencyKeys, input.IdempotencyKey)
	if len(m.create) == 0 {
		return AssetMaterializeResult{UpstreamAssetID: "upstream-" + input.APIKey, Status: model.AssetStatusActive}, nil
	}
	next := m.create[0]
	m.create = m.create[1:]
	return next.result, next.err
}

func (m *scriptedAssetModelMaterializer) GetAsset(_ context.Context, _ AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.getIDs = append(m.getIDs, upstreamAssetID)
	if len(m.get) > 0 {
		next := m.get[0]
		m.get = m.get[1:]
		return next.result, next.err
	}
	return AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: model.AssetStatusActive}, nil
}

func (m *scriptedAssetModelMaterializer) getUpstreamIDs() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.getIDs...)
}

func (m *scriptedAssetModelMaterializer) capturedIdempotencyKeys() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.idempotencyKeys...)
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
	assetModelWorkerTestDBTime.Store(100)
	originalDBTimestamp := assetModelWorkerDBTimestamp
	assetModelWorkerDBTimestamp = func(context.Context) (int64, error) {
		return assetModelWorkerTestDBTime.Load(), nil
	}
	t.Cleanup(func() { assetModelWorkerDBTimestamp = originalDBTimestamp })
}

var assetModelWorkerTestDBTime atomic.Int64

func runAssetModelReadinessBatchAt(t *testing.T, owner string, now int64) (int, error) {
	t.Helper()
	assetModelWorkerTestDBTime.Store(now)
	return RunAssetModelReadinessBatch(context.Background(), owner, time.Unix(now, 0))
}

type assetModelWorkerBatchResult struct {
	processed int
	err       error
}

func receiveAssetModelWorkerBatchResult(t *testing.T, results <-chan assetModelWorkerBatchResult) assetModelWorkerBatchResult {
	t.Helper()
	select {
	case result := <-results:
		return result
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for asset model worker batch result")
		return assetModelWorkerBatchResult{}
	}
}

func receiveAssetModelWorkerError(t *testing.T, errs <-chan error) error {
	t.Helper()
	select {
	case err := <-errs:
		return err
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for asset model worker error")
		return nil
	}
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

func seedAtomicAssetModelReadinessSet(t *testing.T, publicID string, channelType int) (model.Asset, AssetModelScope, map[string]model.AssetModelCoverageTarget) {
	t.Helper()
	asset := insertMaterializeAsset(t, publicID)
	priority := int64(80)
	weight := uint(50)
	modelNames := []string{"seedance-2.0", "seedance2.0-pro"}
	mapping := `{"seedance-2.0":"doubao/seedance-pro","seedance2.0-pro":"doubao/seedance-pro"}`
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:           180,
		Type:         channelType,
		Key:          "provider-key-a",
		Status:       common.ChannelStatusEnabled,
		Name:         "asset-atomic-channel",
		Group:        "default",
		Models:       strings.Join(modelNames, ","),
		Priority:     &priority,
		Weight:       &weight,
		ModelMapping: &mapping,
		ChannelInfo:  model.ChannelInfo{IsMultiKey: false},
	}).Error)
	for _, modelName := range modelNames {
		require.NoError(t, model.DB.Create(&model.Ability{
			Group:     "default",
			Model:     modelName,
			ChannelId: 180,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
	}
	scope := AssetModelScope{ScopeKey: "scope-" + publicID, Groups: []string{"default"}, ModelNames: modelNames}
	targets := make(map[string]model.AssetModelCoverageTarget, len(modelNames))
	for _, modelName := range modelNames {
		target, err := ensureAssetModelCoverageTargetAt(scope, modelName, "owner", 90)
		require.NoError(t, err)
		require.NotNil(t, target)
		targets[modelName] = *target
	}
	require.Equal(t, targets["seedance-2.0"].ChannelId, targets["seedance2.0-pro"].ChannelId)
	require.Equal(t, targets["seedance-2.0"].BindingScope, targets["seedance2.0-pro"].BindingScope)
	require.NoError(t, model.EnsureAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames, 90))
	for modelName, target := range targets {
		require.NoError(t, model.DB.Model(&model.AssetModelReadiness{}).
			Where("asset_id = ? AND scope_key = ? AND model_name = ?", asset.Id, scope.ScopeKey, modelName).
			Updates(map[string]any{
				"target_generation": target.Generation,
				"channel_id":        target.ChannelId,
				"binding_scope":     target.BindingScope,
				"updated_at":        int64(90),
			}).Error)
	}
	return asset, scope, targets
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

func disableChannelCredential(t *testing.T, channelID int, credentialIndex int) {
	t.Helper()
	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, channelID).Error)
	if channel.ChannelInfo.MultiKeyStatusList == nil {
		channel.ChannelInfo.MultiKeyStatusList = map[int]int{}
	}
	channel.ChannelInfo.MultiKeyStatusList[credentialIndex] = common.ChannelStatusManuallyDisabled
	require.NoError(t, channel.SaveChannelInfo())
}

func captureAssetModelWorkerEvents(t *testing.T) *[]assetModelWorkerEvent {
	t.Helper()
	events := make([]assetModelWorkerEvent, 0)
	original := assetModelWorkerEventSink
	assetModelWorkerEventSink = func(_ context.Context, event assetModelWorkerEvent) {
		events = append(events, event)
	}
	t.Cleanup(func() { assetModelWorkerEventSink = original })
	return &events
}

func assetModelWorkerEventNames(events *[]assetModelWorkerEvent) []string {
	names := make([]string, 0, len(*events))
	for _, event := range *events {
		names = append(names, event.Name)
	}
	return names
}

func waitForAssetModelCreateCalls(t *testing.T, materializer *scriptedAssetModelMaterializer, want int64) {
	t.Helper()
	deadline := time.After(2 * time.Second)
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	for {
		if atomic.LoadInt64(&materializer.createCalls) >= want {
			return
		}
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for createCalls >= %d; got %d", want, atomic.LoadInt64(&materializer.createCalls))
		case <-tick.C:
		}
	}
}
