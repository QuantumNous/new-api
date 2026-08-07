package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAssetModelTargetCandidatesExpandsTechMobiCredentialsAndSortsDeterministically(t *testing.T) {
	newAssetReferenceDB(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, &recordingAssetMaterializer{})
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})

	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 106, ChannelType: constant.ChannelTypeBytePlus, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 20, Key: "byteplus-key",
	})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-a\ntechmobi-key-b",
		Mapping: `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{},
		},
	})

	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	candidates, err := AssetModelTargetCandidates(scope, "seedance-2.0")
	require.NoError(t, err)
	require.Len(t, candidates, 3)
	require.Equal(t, []int{120, 120, 106}, []int{candidates[0].ChannelID, candidates[1].ChannelID, candidates[2].ChannelID})
	require.Equal(t, []int{0, 1, -1}, []int{candidates[0].CredentialIndex, candidates[1].CredentialIndex, candidates[2].CredentialIndex})
	require.Equal(t, "doubao/seedance-pro", candidates[0].MappedModel)
	require.NotEqual(t, candidates[0].BindingScope, candidates[1].BindingScope)
	require.Empty(t, candidates[2].BindingScope)
}

func TestAssetModelTargetCandidatesChecksLowerPriorityTiersAfterIneligibleChannels(t *testing.T) {
	newAssetReferenceDB(t)
	registerAssetMaterializerForTest(t, constant.ChannelTypeBytePlus, nil)
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 106, ChannelType: constant.ChannelTypeBytePlus, Group: "default", ModelName: "seedance-2.0",
		Priority: 100, Weight: 50, Key: "byteplus-key",
	})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 10, Weight: 50, Key: "techmobi-key-a",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})

	candidates, err := AssetModelTargetCandidates(AssetModelScope{
		ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"},
	}, "seedance-2.0")
	require.NoError(t, err)
	require.Len(t, candidates, 1)
	require.Equal(t, 120, candidates[0].ChannelID)
}

func TestAssetModelTargetBoundaryRejectsModelOutsideScope(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "excluded-model",
		Priority: 80, Weight: 50, Key: "techmobi-key-a",
		Mapping:     `{"excluded-model":"doubao/excluded"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"allowed-model"}}

	candidates, err := AssetModelTargetCandidates(scope, "excluded-model")
	require.NoError(t, err)
	require.Empty(t, candidates)

	target, err := EnsureAssetModelCoverageTarget(scope, "excluded-model", "owner", time.Unix(100, 0))
	require.ErrorIs(t, err, ErrAssetBindingUnavailable)
	require.Nil(t, target)
	_, err = model.GetAssetModelCoverageTarget("scope", "excluded-model")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	eligible, err := AssetModelTargetIsEligible(scope, model.AssetModelCoverageTarget{
		ScopeKey:          "scope",
		ModelName:         "excluded-model",
		RoutingGroups:     "default",
		ChannelId:         120,
		MappedModel:       "doubao/excluded",
		BindingScope:      "scope",
		CredentialIndex:   0,
		Status:            model.AssetModelTargetStatusActive,
		SpecificChannelId: 0,
	})
	require.NoError(t, err)
	require.False(t, eligible)
}

func TestEnsureAssetModelCoverageTargetNoCandidatesFailsWithoutSelectingLease(t *testing.T) {
	tests := []struct {
		name     string
		register func(t *testing.T)
		seed     func(t *testing.T)
	}{
		{
			name: "no materializer",
			register: func(t *testing.T) {
				registerAssetMaterializerForTest(t, constant.ChannelTypeMiniMaxH3, nil)
			},
			seed: func(t *testing.T) {
				insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
					ID: 130, ChannelType: constant.ChannelTypeMiniMaxH3, Group: "default", ModelName: "seedance-2.0",
					Priority: 80, Weight: 50, Key: "provider-key",
				})
			},
		},
		{
			name: "no enabled credential",
			register: func(t *testing.T) {
				registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
			},
			seed: func(t *testing.T) {
				insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
					ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
					Priority: 80, Weight: 50, Key: "techmobi-key-a",
					Mapping: `{"seedance-2.0":"doubao/seedance-pro"}`,
					ChannelInfo: model.ChannelInfo{
						IsMultiKey:         true,
						MultiKeySize:       1,
						MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled},
					},
				})
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newAssetReferenceDB(t)
			require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
			tt.register(t)
			tt.seed(t)
			scope := AssetModelScope{ScopeKey: "scope-" + tt.name, Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

			target, err := EnsureAssetModelCoverageTarget(scope, "seedance-2.0", "owner", time.Unix(100, 0))
			require.ErrorIs(t, err, ErrAssetBindingUnavailable)
			require.Nil(t, target)
			_, err = model.GetAssetModelCoverageTarget(scope.ScopeKey, "seedance-2.0")
			require.ErrorIs(t, err, gorm.ErrRecordNotFound)
		})
	}
}

func TestEnsureAssetModelCoverageTargetReusesEligibleTargetAndPersistsCandidate(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-a\ntechmobi-key-b",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	})
	scope := AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

	first, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 100)
	require.NoError(t, err)
	require.NotNil(t, first)
	require.Equal(t, model.AssetModelTargetStatusActive, first.Status)
	require.Equal(t, 120, first.ChannelId)
	require.Equal(t, 0, first.CredentialIndex)
	require.Equal(t, 0, first.CandidateIndex)
	require.Equal(t, "default", first.RoutingGroups)
	require.Equal(t, "doubao/seedance-pro", first.MappedModel)

	ok, err := AssetModelTargetIsEligible(scope, *first)
	require.NoError(t, err)
	require.True(t, ok)

	second, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner", 200)
	require.NoError(t, err)
	require.Equal(t, first.Id, second.Id)
	require.Equal(t, first.Generation, second.Generation)
}

func TestEnsureAssetModelCoverageTargetUsesDatabaseTimestampAtServiceBoundary(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-a",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	scope := AssetModelScope{ScopeKey: "scope-db-time", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

	target, err := EnsureAssetModelCoverageTarget(scope, "seedance-2.0", "owner", time.Unix(100, 0))
	require.NoError(t, err)
	require.NotNil(t, target)
	require.Greater(t, target.CreatedAt, int64(100))
	require.Greater(t, target.UpdatedAt, int64(100))
}

func TestEnsureAssetModelCoverageTargetContextPropagatesContextTimestampError(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	target, err := EnsureAssetModelCoverageTargetContext(ctx, AssetModelScope{
		ScopeKey: "scope-cancelled", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"},
	}, "seedance-2.0", "owner")

	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, target)
}

func TestResolveAssetModelTargetOptionsReloadsStoredCredentialIndex(t *testing.T) {
	channel := &model.Channel{
		Id:     120,
		Type:   constant.ChannelTypeTechMobiVideo,
		Key:    "techmobi-key-a\ntechmobi-key-b",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	scope, err := assetBindingScope(channel.Type, AssetMaterializeOptions{Model: "doubao/seedance-pro", APIKey: "techmobi-key-b"})
	require.NoError(t, err)
	target := model.AssetModelCoverageTarget{
		ChannelId:       120,
		MappedModel:     "doubao/seedance-pro",
		BindingScope:    scope,
		CredentialIndex: 1,
	}

	options, index, err := ResolveAssetModelTargetOptions(target, channel)
	require.NoError(t, err)
	require.Equal(t, "doubao/seedance-pro", options.Model)
	require.Equal(t, "techmobi-key-b", options.APIKey)
	require.Equal(t, 1, index)
}

type assetModelTargetChannelSeed struct {
	ID          int
	ChannelType int
	Group       string
	ModelName   string
	Priority    int64
	Weight      uint
	Key         string
	Mapping     string
	ChannelInfo model.ChannelInfo
}

func insertAssetModelTargetChannel(t *testing.T, seed assetModelTargetChannelSeed) {
	t.Helper()
	mapping := seed.Mapping
	channel := &model.Channel{
		Id:           seed.ID,
		Type:         seed.ChannelType,
		Key:          seed.Key,
		Status:       common.ChannelStatusEnabled,
		Name:         "asset-target-channel",
		Group:        seed.Group,
		Models:       seed.ModelName,
		Priority:     &seed.Priority,
		Weight:       &seed.Weight,
		ModelMapping: &mapping,
		ChannelInfo:  seed.ChannelInfo,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     seed.Group,
		Model:     seed.ModelName,
		ChannelId: seed.ID,
		Enabled:   true,
		Priority:  &seed.Priority,
		Weight:    seed.Weight,
	}).Error)
}
