package service

import (
	"context"
	"strings"
	"sync/atomic"
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

func TestEnsureAssetModelCoverageTargetDoesNotRepublishConcurrentEligibleTarget(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, &recordingAssetMaterializer{})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID: 120, ChannelType: constant.ChannelTypeTechMobiVideo, Group: "default", ModelName: "seedance-2.0",
		Priority: 80, Weight: 50, Key: "techmobi-key-a",
		Mapping:     `{"seedance-2.0":"doubao/seedance-pro"}`,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
	})
	scope := AssetModelScope{ScopeKey: "scope-concurrent-target", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	require.NoError(t, model.DB.Create(&model.AssetModelCoverageTarget{
		ScopeKey:          scope.ScopeKey,
		ModelName:         "seedance-2.0",
		RoutingGroups:     "stale",
		SpecificChannelId: 0,
		Status:            model.AssetModelTargetStatusRotating,
		Generation:        0,
		CandidateIndex:    -1,
		CredentialIndex:   -1,
		CreatedAt:         100,
		UpdatedAt:         100,
	}).Error)

	aRead := make(chan struct{})
	releaseA := make(chan struct{})
	var pausedA atomic.Bool
	callbackName := "test:pause_concurrent_asset_model_target_read"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "asset_model_coverage_targets" {
			return
		}
		if pausedA.CompareAndSwap(false, true) {
			close(aRead)
			<-releaseA
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	type ensureResult struct {
		target *model.AssetModelCoverageTarget
		err    error
	}
	aResult := make(chan ensureResult, 1)
	go func() {
		target, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner-a", 300)
		aResult <- ensureResult{target: target, err: err}
	}()

	select {
	case <-aRead:
	case <-time.After(2 * time.Second):
		t.Fatal("initializer A did not reach the first target read")
	}

	bTarget, err := ensureAssetModelCoverageTargetAt(scope, "seedance-2.0", "owner-b", 200)
	require.NoError(t, err)
	require.Equal(t, int64(1), bTarget.Generation)
	require.Equal(t, 120, bTarget.ChannelId)
	require.Equal(t, "doubao/seedance-pro", bTarget.MappedModel)

	close(releaseA)

	var a ensureResult
	select {
	case a = <-aResult:
	case <-time.After(2 * time.Second):
		t.Fatal("initializer A did not finish after release")
	}
	require.NoError(t, a.err)
	require.NotNil(t, a.target)

	finalTarget, err := model.GetAssetModelCoverageTarget(scope.ScopeKey, "seedance-2.0")
	require.NoError(t, err)
	require.Equal(t, int64(1), finalTarget.Generation)
	require.Equal(t, bTarget.ChannelId, finalTarget.ChannelId)
	require.Equal(t, bTarget.MappedModel, finalTarget.MappedModel)
	require.Equal(t, bTarget.BindingScope, finalTarget.BindingScope)
	require.Equal(t, bTarget.CredentialIndex, finalTarget.CredentialIndex)
	require.Equal(t, "", finalTarget.LeaseOwner)
	require.Equal(t, int64(0), finalTarget.LeaseExpiresAt)
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

func TestClaimAssetModelTargetSelectionLeaseUsesShortTTL(t *testing.T) {
	newAssetReferenceDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AssetModelCoverageTarget{}))
	scope := AssetModelScope{ScopeKey: "scope-short-lease", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}

	leaseExpiresAt, claimed, err := claimAssetModelTargetSelectionLease(scope.ScopeKey, "seedance-2.0", "owner", 100)
	require.NoError(t, err)
	require.True(t, claimed)
	require.Equal(t, int64(115), leaseExpiresAt)

	var target model.AssetModelCoverageTarget
	require.NoError(t, model.DB.Where("scope_key = ? AND model_name = ?", scope.ScopeKey, "seedance-2.0").First(&target).Error)
	require.Equal(t, int64(115), target.LeaseExpiresAt)
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

func TestResolveAssetModelTargetOptionsReloadsTokenSpaceCredentialIndex(t *testing.T) {
	channel := &model.Channel{
		Id:            160,
		Type:          constant.ChannelTypeTechMobiVideo,
		Key:           "tokenspace-key-a\ntokenspace-key-b",
		Status:        common.ChannelStatusEnabled,
		OtherSettings: `{"asset_materialization":{"provider":"tokenspace_material","gateway_base_url":"https://materials.example.invalid","group_id":"group-internal"}}`,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "doubao/seedance-pro", APIKey: "tokenspace-key-b"})
	require.NoError(t, err)
	target := model.AssetModelCoverageTarget{
		ChannelId:       channel.Id,
		MappedModel:     "doubao/seedance-pro",
		BindingScope:    scope,
		CredentialIndex: 1,
	}

	options, index, err := ResolveAssetModelTargetOptions(target, channel)
	require.NoError(t, err)
	require.Equal(t, "doubao/seedance-pro", options.Model)
	require.Equal(t, "tokenspace-key-b", options.APIKey)
	require.Equal(t, 1, index)
}

func TestSeedanceProxyCapabilitySupportsAudioRegardlessOfLegacyChannelType(t *testing.T) {
	channel := &model.Channel{
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid","group_id":"grp_shared_aigc"}}`,
	}

	require.True(t, channelCanConsumeAssetType(channel, "Image"))
	require.True(t, channelCanConsumeAssetType(channel, "Video"))
	require.True(t, channelCanConsumeAssetType(channel, "Audio"))
}

func TestExplicitSeedanceProxyOverridesModelAPISourceURLCapability(t *testing.T) {
	channel := &model.Channel{
		Type:          constant.ChannelTypeModelAPISeedance,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid","group_id":"grp_shared_aigc"}}`,
	}

	require.True(t, AssetModelChannelUsesSourceURL(channel.Type), "the legacy type still uses source URLs when no explicit provider is configured")
	require.False(t, AssetModelChannelUsesSourceURLForChannel(channel))
	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)
	require.IsType(t, seedanceProxyAssetBindingMaterializer{}, materializer)
}

func TestAssetModelTargetExplicitTokenSpaceMaterialKeepsTechMobiEligible(t *testing.T) {
	newAssetReferenceDB(t)
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID:            140,
		ChannelType:   constant.ChannelTypeTechMobiVideo,
		Group:         "default",
		ModelName:     "seedance-2.0",
		Priority:      10,
		Weight:        100,
		Key:           "tokenspace-key",
		Mapping:       `{"seedance-2.0":"doubao/seedance-pro"}`,
		OtherSettings: `{"asset_materialization":{"provider":"tokenspace_material","gateway_base_url":"https://materials.example.invalid","group_id":"group-internal"}}`,
	})

	candidates, err := AssetModelTargetCandidates(AssetModelScope{
		ScopeKey:   "scope-tokenspace",
		Groups:     []string{"default"},
		ModelNames: []string{"seedance-2.0"},
	}, "seedance-2.0")

	require.NoError(t, err)
	require.Len(t, candidates, 1)
	require.Equal(t, 140, candidates[0].ChannelID)
	require.Equal(t, "doubao/seedance-pro", candidates[0].MappedModel)
	require.True(t, strings.HasPrefix(candidates[0].BindingScope, tokenSpaceMaterialBindingScopePrefix))
}

func TestAssetModelTargetExplicitTokenSpaceMaterialInvalidConfigAndUnknownProviderAreIneligible(t *testing.T) {
	newAssetReferenceDB(t)
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID:            141,
		ChannelType:   constant.ChannelTypeTechMobiVideo,
		Group:         "default",
		ModelName:     "seedance-2.0",
		Priority:      10,
		Weight:        100,
		Key:           "tokenspace-key",
		Mapping:       `{"seedance-2.0":"doubao/seedance-pro"}`,
		OtherSettings: `{"asset_materialization":{"provider":"tokenspace_material","gateway_base_url":"https://materials.example.invalid"}}`,
	})
	insertAssetModelTargetChannel(t, assetModelTargetChannelSeed{
		ID:            142,
		ChannelType:   constant.ChannelTypeTechMobiVideo,
		Group:         "default",
		ModelName:     "seedance-2.0",
		Priority:      9,
		Weight:        100,
		Key:           "tokenspace-key",
		Mapping:       `{"seedance-2.0":"doubao/seedance-pro"}`,
		OtherSettings: `{"asset_materialization":{"provider":"future_provider","gateway_base_url":"https://materials.example.invalid","group_id":"group-internal"}}`,
	})

	candidates, err := AssetModelTargetCandidates(AssetModelScope{
		ScopeKey:   "scope-tokenspace-invalid",
		Groups:     []string{"default"},
		ModelNames: []string{"seedance-2.0"},
	}, "seedance-2.0")

	require.NoError(t, err)
	require.Empty(t, candidates)
}

type assetModelTargetChannelSeed struct {
	ID            int
	ChannelType   int
	Group         string
	ModelName     string
	Priority      int64
	Weight        uint
	Key           string
	Mapping       string
	OtherSettings string
	ChannelInfo   model.ChannelInfo
}

func insertAssetModelTargetChannel(t *testing.T, seed assetModelTargetChannelSeed) {
	t.Helper()
	mapping := seed.Mapping
	channel := &model.Channel{
		Id:            seed.ID,
		Type:          seed.ChannelType,
		Key:           seed.Key,
		Status:        common.ChannelStatusEnabled,
		Name:          "asset-target-channel",
		Group:         seed.Group,
		Models:        seed.ModelName,
		Priority:      &seed.Priority,
		Weight:        &seed.Weight,
		ModelMapping:  &mapping,
		OtherSettings: seed.OtherSettings,
		ChannelInfo:   seed.ChannelInfo,
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
