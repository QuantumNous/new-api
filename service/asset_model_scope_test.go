package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResolveAssetModelScopeFiltersAuthenticatedVideoModels(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 101, "default", constant.ChannelTypeTechMobiVideo, "seedance-2.0-fast", "seedance-2.0")
	seedModelAccessScope(t, db, 102, "vip", constant.ChannelTypeBytePlus, "seedance-2.0", "vip-video")
	seedModelAccessScope(t, db, 103, "default", constant.ChannelTypeOpenAI, "chat-only")
	seedModelAccessScope(t, db, 104, "vip", constant.ChannelTypeAnthropic, "vip-chat")
	setModelAccessBilling(t, map[string]float64{
		"seedance-2.0-fast": 1,
		"seedance-2.0":      1,
		"vip-video":         1,
		"chat-only":         1,
		"vip-chat":          1,
	}, nil, nil)

	auto, err := ResolveAssetModelScope(AssetModelScopeInput{IdentityGroup: "default", TokenGroup: "auto"})
	require.NoError(t, err)
	require.Equal(t, []string{"default", "vip"}, auto.Groups)
	require.Equal(t, []string{"seedance-2.0", "seedance-2.0-fast"}, auto.ModelNames)
	require.Len(t, auto.ScopeKey, 64)
	require.NotContains(t, auto.ModelNames, "vip-video")
	require.NotContains(t, auto.ModelNames, "chat-only")
	require.NotContains(t, auto.ModelNames, "vip-chat")

	allowlist, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:      "default",
		TokenGroup:         "auto",
		ModelLimitsEnabled: true,
		ModelLimits: map[string]bool{
			"seedance-2.0-fast": true,
			"seedance-2.0":      true,
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0", "seedance-2.0-fast"}, allowlist.ModelNames)

	blacklist, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:         "default",
		TokenGroup:            "auto",
		ModelBlacklistEnabled: true,
		ModelBlacklist:        map[string]bool{"seedance-2.0": true},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-fast"}, blacklist.ModelNames)
}

func TestResolveAssetModelScopeSpecificChannelRemovesUnsupportedVideoModels(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 120, "default", constant.ChannelTypeTechMobiVideo, "seedance-2.0-fast")
	seedModelAccessScope(t, db, 121, "default", constant.ChannelTypeBytePlus, "seedance-2.0")
	setModelAccessBilling(t, map[string]float64{"seedance-2.0-fast": 1, "seedance-2.0": 1}, nil, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:     "default",
		TokenGroup:        "default",
		SpecificChannelID: 120,
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-fast"}, scope.ModelNames)
	require.Equal(t, 120, scope.SpecificChannelID)
}

func TestResolveAssetModelScopeSpecificChannelChecksLowerPriorityTiers(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 120, "default", constant.ChannelTypeTechMobiVideo, "seedance-2.0-fast")
	seedModelAccessScope(t, db, 121, "default", constant.ChannelTypeBytePlus, "seedance-2.0-fast")
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 120).Update("priority", int64(50)).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 120).Update("priority", int64(50)).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 121).Update("priority", int64(10)).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 121).Update("priority", int64(10)).Error)
	setModelAccessBilling(t, map[string]float64{"seedance-2.0-fast": 1}, nil, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:     "default",
		TokenGroup:        "default",
		SpecificChannelID: 121,
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-fast"}, scope.ModelNames)
}

func TestResolveAssetModelScopeForContextUsesAuthenticatedUnpricedPolicy(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 125, "default", constant.ChannelTypeTechMobiVideo, "seedance-2.0-unpriced")
	setModelAccessBilling(t, nil, nil, nil)

	originalSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = originalSelfUse })

	scope, err := ResolveAssetModelScopeForContext(assetModelScopeGinContext(t, nil), 0)
	require.NoError(t, err)
	require.Empty(t, scope.ModelNames)

	scope, err = ResolveAssetModelScopeForContext(assetModelScopeGinContext(t, dto.UserSetting{AcceptUnsetRatioModel: true}), 0)
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-unpriced"}, scope.ModelNames)

	operation_setting.SelfUseModeEnabled = true
	scope, err = ResolveAssetModelScopeForContext(assetModelScopeGinContext(t, nil), 0)
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-unpriced"}, scope.ModelNames)
}

func TestResolveAssetModelScopeForContextRejectsInvalidSpecificChannel(t *testing.T) {
	for _, raw := range []string{"abc", "0", "-7"} {
		t.Run(raw, func(t *testing.T) {
			ctx := assetModelScopeGinContext(t, nil)
			common.SetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId, raw)

			scope, err := ResolveAssetModelScopeForContext(ctx, 0)

			require.Error(t, err)
			require.Empty(t, scope.ModelNames)
		})
	}
}

func TestResolveAssetModelScopeForContextAllowsMissingSpecificChannel(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 126, "default", constant.ChannelTypeTechMobiVideo, "seedance-2.0-default")
	setModelAccessBilling(t, map[string]float64{"seedance-2.0-default": 1}, nil, nil)

	scope, err := ResolveAssetModelScopeForContext(assetModelScopeGinContext(t, nil), 0)

	require.NoError(t, err)
	require.Zero(t, scope.SpecificChannelID)
	require.Equal(t, []string{"seedance-2.0-default"}, scope.ModelNames)
}

func TestResolveAssetModelScopeKeepsAdvertisedSeedanceModelWithoutMaterializer(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 130, "default", constant.ChannelTypeMiniMaxH3, "seedance-2.0-custom")
	setModelAccessBilling(t, map[string]float64{"seedance-2.0-custom": 1}, nil, nil)
	registerAssetMaterializerForTest(t, constant.ChannelTypeMiniMaxH3, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0-custom"}, scope.ModelNames)

	candidates, err := AssetModelTargetCandidates(scope, "seedance-2.0-custom")
	require.NoError(t, err)
	require.Empty(t, candidates)
}

func TestResolveAssetModelScopeExcludesUnrelatedVideoModels(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 131, "default", constant.ChannelTypeBytePlus, "seedance-2.0", "sora-2", "vip-video")
	setModelAccessBilling(t, map[string]float64{"seedance-2.0": 1, "sora-2": 1, "vip-video": 1}, nil, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-2.0"}, scope.ModelNames)
}

func TestAssetModelHasReusableAssetCapabilityMatchesOnlySeedance20Family(t *testing.T) {
	tests := map[string]bool{
		"seedance-2.0":                      true,
		"seedance2.0-pro":                   true,
		"doubao/doubao-seedance-2-0-260128": true,
		"bytedance/seedance_2_0_fast":       true,
		"seedance-1.5-pro":                  false,
		"seedance-20":                       false,
		"notseedance-2.0":                   false,
		"sora-2":                            false,
	}
	for modelName, expected := range tests {
		t.Run(modelName, func(t *testing.T) {
			require.Equal(t, expected, assetModelHasReusableAssetCapability(modelName))
		})
	}
}

func assetModelScopeGinContext(t *testing.T, userSetting any) *gin.Context {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/assets/ast_public", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	if userSetting != nil {
		common.SetContextKey(ctx, constant.ContextKeyUserSetting, userSetting)
	}
	return ctx
}

func TestResolveAssetModelScopeKeyUsesCanonicalPayload(t *testing.T) {
	scope := AssetModelScope{Groups: []string{"vip", "default"}, ModelNames: []string{"z", "a"}, SpecificChannelID: 106}
	key, err := assetModelScopeKey(scope)
	require.NoError(t, err)

	payload, err := common.Marshal(assetModelScopeHashPayload{
		Version:           1,
		Groups:            []string{"default", "vip"},
		Models:            []string{"a", "z"},
		SpecificChannelID: 106,
	})
	require.NoError(t, err)
	require.Equal(t, sha256Hex(payload), key)
}
