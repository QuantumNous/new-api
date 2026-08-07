package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestResolveAssetModelScopeFiltersAuthenticatedVideoModels(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 101, "default", constant.ChannelTypeTechMobiVideo, "seedance-fast", "seedance-pro")
	seedModelAccessScope(t, db, 102, "vip", constant.ChannelTypeBytePlus, "seedance-pro", "vip-video")
	seedModelAccessScope(t, db, 103, "default", constant.ChannelTypeOpenAI, "chat-only")
	seedModelAccessScope(t, db, 104, "vip", constant.ChannelTypeAnthropic, "vip-chat")
	setModelAccessBilling(t, map[string]float64{
		"seedance-fast": 1,
		"seedance-pro":  1,
		"vip-video":     1,
		"chat-only":     1,
		"vip-chat":      1,
	}, nil, nil)

	auto, err := ResolveAssetModelScope(AssetModelScopeInput{IdentityGroup: "default", TokenGroup: "auto"})
	require.NoError(t, err)
	require.Equal(t, []string{"default", "vip"}, auto.Groups)
	require.Equal(t, []string{"seedance-fast", "seedance-pro", "vip-video"}, auto.ModelNames)
	require.Len(t, auto.ScopeKey, 64)
	require.NotContains(t, auto.ModelNames, "chat-only")
	require.NotContains(t, auto.ModelNames, "vip-chat")

	allowlist, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:      "default",
		TokenGroup:         "auto",
		ModelLimitsEnabled: true,
		ModelLimits: map[string]bool{
			"seedance-fast": true,
			"seedance-pro":  true,
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-fast", "seedance-pro"}, allowlist.ModelNames)

	blacklist, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:         "default",
		TokenGroup:            "auto",
		ModelBlacklistEnabled: true,
		ModelBlacklist:        map[string]bool{"seedance-pro": true},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-fast", "vip-video"}, blacklist.ModelNames)
}

func TestResolveAssetModelScopeSpecificChannelRemovesUnsupportedVideoModels(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 120, "default", constant.ChannelTypeTechMobiVideo, "seedance-fast")
	seedModelAccessScope(t, db, 121, "default", constant.ChannelTypeBytePlus, "seedance-pro")
	setModelAccessBilling(t, map[string]float64{"seedance-fast": 1, "seedance-pro": 1}, nil, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:     "default",
		TokenGroup:        "default",
		SpecificChannelID: 120,
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-fast"}, scope.ModelNames)
	require.Equal(t, 120, scope.SpecificChannelID)
}

func TestResolveAssetModelScopeSpecificChannelChecksLowerPriorityTiers(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 120, "default", constant.ChannelTypeTechMobiVideo, "seedance-fast")
	seedModelAccessScope(t, db, 121, "default", constant.ChannelTypeBytePlus, "seedance-fast")
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 120).Update("priority", int64(50)).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 120).Update("priority", int64(50)).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 121).Update("priority", int64(10)).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 121).Update("priority", int64(10)).Error)
	setModelAccessBilling(t, map[string]float64{"seedance-fast": 1}, nil, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{
		IdentityGroup:     "default",
		TokenGroup:        "default",
		SpecificChannelID: 121,
	})
	require.NoError(t, err)
	require.Equal(t, []string{"seedance-fast"}, scope.ModelNames)
}

func TestResolveAssetModelScopeKeepsAdvertisedVideoModelWithoutMaterializer(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 130, "default", constant.ChannelTypeMiniMaxH3, "advertised-video")
	setModelAccessBilling(t, map[string]float64{"advertised-video": 1}, nil, nil)
	registerAssetMaterializerForTest(t, constant.ChannelTypeMiniMaxH3, nil)

	scope, err := ResolveAssetModelScope(AssetModelScopeInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Equal(t, []string{"advertised-video"}, scope.ModelNames)

	candidates, err := AssetModelTargetCandidates(scope, "advertised-video")
	require.NoError(t, err)
	require.Empty(t, candidates)
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
