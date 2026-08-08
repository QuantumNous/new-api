package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProjectAssetStatusForScopeAggregatesRequiredModelReadiness(t *testing.T) {
	newAssetStatusTestDB(t)
	asset := insertAssetStatusAsset(t, model.AssetSourceStatusAvailable, model.AssetStatusActive)
	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0-fast", "seedance-2.0"}}
	targets := map[string]model.AssetModelCoverageTarget{
		"seedance-2.0-fast": activeAssetStatusTarget(scope, "seedance-2.0-fast", 131, "", 11),
		"seedance-2.0":      activeAssetStatusTarget(scope, "seedance-2.0", 132, "", 22),
	}

	require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, nil, targets))

	rows := []model.AssetModelReadiness{
		activeAssetStatusReadiness(asset.Id, scope, targets["seedance-2.0-fast"]),
		activeAssetStatusReadiness(asset.Id, scope, targets["seedance-2.0"]),
	}
	require.NoError(t, model.DB.Create(&model.AssetBinding{AssetId: asset.Id, ChannelId: 131, Status: model.AssetStatusActive, UpstreamAssetId: "upstream-fast"}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{AssetId: asset.Id, ChannelId: 132, Status: model.AssetStatusActive, UpstreamAssetId: "upstream-pro"}).Error)
	require.Equal(t, model.AssetStatusActive, ProjectAssetStatusForScope(asset, scope, rows, targets))

	staleRows := append([]model.AssetModelReadiness(nil), rows...)
	staleRows[1].TargetGeneration--
	require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, staleRows, targets))

	require.Equal(t, model.AssetStatusFailed, ProjectAssetStatusForScope(asset, AssetModelScope{ScopeKey: "empty"}, nil, nil))
}

func TestProjectAssetStatusForScopeUsesSourceLifecycleFirst(t *testing.T) {
	newAssetStatusTestDB(t)
	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

	require.Equal(t, model.AssetStatusCreating, ProjectAssetStatusForScope(
		model.Asset{Status: model.AssetStatusCreating, SourceStatus: model.AssetSourceStatusUnavailable}, scope, nil, nil,
	))
	require.Equal(t, model.AssetStatusFailed, ProjectAssetStatusForScope(
		model.Asset{Status: model.AssetStatusActive, SourceStatus: model.AssetSourceStatusUnavailable}, scope, nil, nil,
	))
	require.Equal(t, model.AssetStatusExpired, ProjectAssetStatusForScope(
		model.Asset{Status: model.AssetStatusActive, SourceStatus: model.AssetSourceStatusExpired}, scope, nil, nil,
	))
}

func TestReconcileAssetForScopeEnrollsReadinessWithoutPersistingAggregateStatus(t *testing.T) {
	newAssetStatusTestDB(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeMiniMaxH3, nil)
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 130, ChannelType: constant.ChannelTypeMiniMaxH3, Group: "default", ModelName: "seedance-2.0-fast",
		Priority: 80, Weight: 50, Key: "provider-key",
	})
	asset := insertAssetStatusAsset(t, model.AssetSourceStatusAvailable, model.AssetStatusActive)
	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0-fast"}}
	restoreStrict := setAssetStrictForTest(t, true)
	defer restoreStrict()

	result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusFailed, result.Status, "advertised model with no target candidates must be terminal")

	rows, err := model.ListAssetModelReadiness(asset.Id, scope.ScopeKey, scope.ModelNames)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, model.AssetModelReadinessStatusFailed, rows[0].Status)

	var stored model.Asset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.AssetStatusActive, stored.Status, "scope projection must not be written to shared assets.status")
}

func TestReconcileAssetForScopeReturnsActiveBindingLookupError(t *testing.T) {
	newAssetStatusTestDB(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-a",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	asset := insertAssetStatusAsset(t, model.AssetSourceStatusAvailable, model.AssetStatusActive)
	scope := AssetModelScope{ScopeKey: "scope-binding-error", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 100)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AssetModelReadiness{
		AssetId:          asset.Id,
		ScopeKey:         scope.ScopeKey,
		ModelName:        "seedance-2.0",
		TargetGeneration: target.Generation,
		ChannelId:        target.ChannelId,
		BindingScope:     target.BindingScope,
		Status:           model.AssetModelReadinessStatusActive,
		CreatedAt:        100,
		UpdatedAt:        100,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: target.ChannelId, BindingScope: target.BindingScope,
		Status: model.AssetStatusActive, UpstreamAssetId: "upstream",
	}).Error)
	restoreStrict := setAssetStrictForTest(t, true)
	defer restoreStrict()

	sentinel := errors.New("asset binding lookup unavailable")
	callbackName := "asset_status_test:binding_lookup_error"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "asset_bindings" {
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { require.NoError(t, model.DB.Callback().Query().Remove(callbackName)) })

	result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)

	require.ErrorIs(t, err, sentinel)
	require.Nil(t, result)
}

func TestReconcileAssetForScopeAvailableModelsIncludesOnlyCurrentExactActiveBindings(t *testing.T) {
	newAssetStatusTestDB(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 140, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0-fast",
		Priority: 80, Weight: 50, Key: "techmobi-key-fast",
		Mapping:     `{"seedance-2.0-fast":"doubao/seedance-fast"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 141, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-pro",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	asset := insertAssetStatusAsset(t, model.AssetSourceStatusAvailable, model.AssetStatusActive)
	scope := AssetModelScope{
		ScopeKey:   "scope-available-models",
		Groups:     []string{"default"},
		ModelNames: []string{"seedance-2.0-fast", "seedance-2.0", "seedance-2.0-fast"},
	}
	fastTarget, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0-fast", "owner", 100)
	require.NoError(t, err)
	proTarget, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 100)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.AssetModelReadiness{
		AssetId:          asset.Id,
		ScopeKey:         scope.ScopeKey,
		ModelName:        "seedance-2.0-fast",
		TargetGeneration: fastTarget.Generation,
		ChannelId:        fastTarget.ChannelId,
		BindingScope:     fastTarget.BindingScope,
		Status:           model.AssetModelReadinessStatusActive,
		CreatedAt:        100,
		UpdatedAt:        100,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetModelReadiness{
		AssetId:          asset.Id,
		ScopeKey:         scope.ScopeKey,
		ModelName:        "seedance-2.0",
		TargetGeneration: proTarget.Generation - 1,
		ChannelId:        proTarget.ChannelId,
		BindingScope:     proTarget.BindingScope,
		Status:           model.AssetModelReadinessStatusActive,
		CreatedAt:        100,
		UpdatedAt:        100,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetModelReadiness{
		AssetId:          asset.Id,
		ScopeKey:         "other-scope",
		ModelName:        "outside-authenticated-scope",
		TargetGeneration: fastTarget.Generation,
		ChannelId:        fastTarget.ChannelId,
		BindingScope:     fastTarget.BindingScope,
		Status:           model.AssetModelReadinessStatusActive,
		CreatedAt:        100,
		UpdatedAt:        100,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: fastTarget.ChannelId, BindingScope: fastTarget.BindingScope,
		Status: model.AssetStatusActive, UpstreamAssetId: "upstream-fast",
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: proTarget.ChannelId + 100, BindingScope: proTarget.BindingScope,
		Status: model.AssetStatusActive, UpstreamAssetId: "wrong-channel",
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: proTarget.ChannelId, BindingScope: proTarget.BindingScope + ":wrong",
		Status: model.AssetStatusActive, UpstreamAssetId: "wrong-scope",
	}).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId: asset.Id, ChannelId: proTarget.ChannelId, BindingScope: proTarget.BindingScope,
		Status: model.AssetStatusActive, UpstreamAssetId: "",
	}).Error)
	restoreStrict := setAssetStrictForTest(t, true)
	defer restoreStrict()

	result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)

	require.NoError(t, err)
	require.Equal(t, model.AssetStatusProcessing, result.Status)
	require.Equal(t, []string{"seedance-2.0-fast"}, result.AvailableModels)
}

func TestReconcileAssetForScopeAvailableModelsRejectsEachNonExactBinding(t *testing.T) {
	cases := []struct {
		name    string
		binding func(model.AssetModelCoverageTarget) model.AssetBinding
	}{
		{
			name: "wrong channel",
			binding: func(target model.AssetModelCoverageTarget) model.AssetBinding {
				return model.AssetBinding{
					ChannelId:       target.ChannelId + 100,
					BindingScope:    target.BindingScope,
					Status:          model.AssetStatusActive,
					UpstreamAssetId: "wrong-channel-upstream",
				}
			},
		},
		{
			name: "wrong binding scope",
			binding: func(target model.AssetModelCoverageTarget) model.AssetBinding {
				return model.AssetBinding{
					ChannelId:       target.ChannelId,
					BindingScope:    target.BindingScope + ":wrong",
					Status:          model.AssetStatusActive,
					UpstreamAssetId: "wrong-scope-upstream",
				}
			},
		},
		{
			name: "blank upstream id",
			binding: func(target model.AssetModelCoverageTarget) model.AssetBinding {
				return model.AssetBinding{
					ChannelId:       target.ChannelId,
					BindingScope:    target.BindingScope,
					Status:          model.AssetStatusActive,
					UpstreamAssetId: "",
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			newAssetStatusTestDB(t)
			registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
			insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
				ID: 150, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0-fast",
				Priority: 80, Weight: 50, Key: "techmobi-key-fast",
				Mapping:     `{"seedance-2.0-fast":"doubao/seedance-fast"}`,
				ChannelInfo: model.ChannelInfo{IsMultiKey: false},
			})
			asset := insertAssetStatusAsset(t, model.AssetSourceStatusAvailable, model.AssetStatusActive)
			scope := AssetModelScope{
				ScopeKey:   "scope-non-exact-binding",
				Groups:     []string{"default"},
				ModelNames: []string{"seedance-2.0-fast"},
			}
			target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0-fast", "owner", 100)
			require.NoError(t, err)
			require.NoError(t, model.DB.Create(&model.AssetModelReadiness{
				AssetId:          asset.Id,
				ScopeKey:         scope.ScopeKey,
				ModelName:        "seedance-2.0-fast",
				TargetGeneration: target.Generation,
				ChannelId:        target.ChannelId,
				BindingScope:     target.BindingScope,
				Status:           model.AssetModelReadinessStatusActive,
				CreatedAt:        100,
				UpdatedAt:        100,
			}).Error)
			binding := tc.binding(*target)
			binding.AssetId = asset.Id
			require.NoError(t, model.DB.Create(&binding).Error)
			restoreStrict := setAssetStrictForTest(t, true)
			defer restoreStrict()

			result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)

			require.NoError(t, err)
			require.Equal(t, model.AssetStatusProcessing, result.Status)
			require.Empty(t, result.AvailableModels)
		})
	}
}

func TestReconcileAssetForScopeAvailableModelsEmptyForSourceTerminalAssets(t *testing.T) {
	newAssetStatusTestDB(t)
	asset := insertAssetStatusAsset(t, model.AssetSourceStatusUnavailable, model.AssetStatusActive)
	scope := AssetModelScope{ScopeKey: "scope-source-terminal", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

	result, err := ReconcileAssetForScope(context.Background(), asset.UserId, asset.PublicId, scope)

	require.NoError(t, err)
	require.Equal(t, model.AssetStatusFailed, result.Status)
	require.Empty(t, result.AvailableModels)
}

func newAssetStatusTestDB(t *testing.T) {
	t.Helper()
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}, &model.AssetModelReadiness{}))
}

func insertAssetStatusAsset(t *testing.T, sourceStatus, status string) model.Asset {
	t.Helper()
	asset := model.Asset{
		PublicId:        "ast_status",
		UserId:          7,
		AssetType:       "Image",
		Status:          status,
		SourceStatus:    sourceStatus,
		StorageBackend:  defaultAssetStorageBackend,
		StorageBucket:   "asset-test-bucket",
		ObjectKey:       "assets/ast_status.png",
		SourceExpiresAt: time.Now().Add(time.Hour).Unix(),
		CreatedAt:       100,
		UpdatedAt:       100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	return asset
}

func activeAssetStatusTarget(scope AssetModelScope, modelName string, channelID int, bindingScope string, generation int64) model.AssetModelCoverageTarget {
	return model.AssetModelCoverageTarget{
		ScopeKey:          scope.ScopeKey,
		ModelName:         modelName,
		RoutingGroups:     assetModelRoutingGroups(scope.Groups),
		SpecificChannelId: scope.SpecificChannelID,
		ChannelId:         channelID,
		MappedModel:       modelName,
		BindingScope:      bindingScope,
		CredentialIndex:   -1,
		Generation:        generation,
		Status:            model.AssetModelTargetStatusActive,
	}
}

func activeAssetStatusReadiness(assetID int64, scope AssetModelScope, target model.AssetModelCoverageTarget) model.AssetModelReadiness {
	return model.AssetModelReadiness{
		AssetId:          assetID,
		ScopeKey:         scope.ScopeKey,
		ModelName:        target.ModelName,
		TargetGeneration: target.Generation,
		ChannelId:        target.ChannelId,
		BindingScope:     target.BindingScope,
		Status:           model.AssetModelReadinessStatusActive,
	}
}

func setAssetStrictForTest(t *testing.T, value bool) func() {
	t.Helper()
	original := AssetModelCoverageStrictEnabled
	AssetModelCoverageStrictEnabled = value
	return func() { AssetModelCoverageStrictEnabled = original }
}
