package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestRealPersonProviderForChannelKeepsNativeBytePlusCallbackContract(t *testing.T) {
	originalFactory := bytePlusAssetClientFactory
	t.Cleanup(func() { bytePlusAssetClientFactory = originalFactory })
	bytePlusAssetClientFactory = func(*model.Channel) (bytePlusAssetAPI, error) {
		return &fakeBytePlusRealPersonClient{}, nil
	}
	channel := &model.Channel{
		Id:     41,
		Type:   constant.ChannelTypeBytePlus,
		Status: common.ChannelStatusEnabled,
		Key:    structuredRealPersonKey(),
	}

	binding, err := realPersonProviderForChannel(channel)

	require.NoError(t, err)
	require.Same(t, channel, binding.Channel)
	require.True(t, binding.Provider.RequiresCallback())
	require.Equal(t, bytePlusRealPersonSessionTTLSeconds, binding.Provider.VerificationTTLSeconds())
	require.NotNil(t, binding.StorageCredentials)
}

func TestRealPersonProviderForChannelSelectsExplicitTokenSpaceWithOneEnabledKey(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	})
	channel.Key = "tokenspace-key"
	channel.Status = common.ChannelStatusEnabled

	binding, err := realPersonProviderForChannel(channel)

	require.NoError(t, err)
	require.Same(t, channel, binding.Channel)
	require.False(t, binding.Provider.RequiresCallback())
	require.Equal(t, int64(300), binding.Provider.VerificationTTLSeconds())
	require.Nil(t, binding.StorageCredentials)
}

func TestTokenSpaceRealPersonChannelIsUsableRequiresDoubaoVideo(t *testing.T) {
	settings := dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	}
	doubaoVideo := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, settings)
	doubaoVideo.Key = "tokenspace-key"
	doubaoVideo.Status = common.ChannelStatusEnabled
	otherType := channelWithAssetMaterializationSettings(t, constant.ChannelTypeOpenAI, settings)
	otherType.Key = "tokenspace-key"
	otherType.Status = common.ChannelStatusEnabled

	require.True(t, TokenSpaceRealPersonChannelIsUsable(doubaoVideo))
	require.False(t, TokenSpaceRealPersonChannelIsUsable(otherType))
}

func TestRealPersonProviderForChannelRejectsTokenSpaceWithMultipleEnabledKeys(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	})
	channel.Key = "key-one\nkey-two"
	channel.Status = common.ChannelStatusEnabled
	channel.ChannelInfo.IsMultiKey = true
	channel.ChannelInfo.MultiKeyStatusList = map[int]int{
		0: common.ChannelStatusEnabled,
		1: common.ChannelStatusEnabled,
	}

	_, err := realPersonProviderForChannel(channel)

	require.Error(t, err)
}

func TestRealPersonProviderForChannelRejectsTokenSpaceWithoutEnabledKey(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	})
	channel.Key = "disabled-key"
	channel.Status = common.ChannelStatusEnabled
	channel.ChannelInfo.IsMultiKey = true
	channel.ChannelInfo.MultiKeyStatusList = map[int]int{0: common.ChannelStatusManuallyDisabled}

	_, err := realPersonProviderForChannel(channel)

	require.Error(t, err)
}

func TestRealPersonProviderForChannelRejectsUnconfiguredDoubaoVideo(t *testing.T) {
	channel := &model.Channel{
		Id:     42,
		Type:   constant.ChannelTypeDoubaoVideo,
		Status: common.ChannelStatusEnabled,
		Key:    "tokenspace-key",
	}

	_, err := realPersonProviderForChannel(channel)

	require.Error(t, err)
}

func TestLoadUsableRealPersonProviderBindingAcceptsPinnedTokenSpaceAbility(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)

	binding, err := loadUsableRealPersonProviderBinding(42, "default")

	require.NoError(t, err)
	require.Equal(t, 42, binding.Channel.Id)
	require.False(t, binding.Provider.RequiresCallback())
}

func TestLoadUsableRealPersonProviderBindingRejectsDisabledAbility(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	insertTokenSpaceRealPersonChannel(t, 42, "default", false)

	_, err := loadUsableRealPersonProviderBinding(42, "default")

	require.Error(t, err)
}

func TestRealPersonAutomaticCandidateExcludesTokenSpace(t *testing.T) {
	tokenSpace := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	})
	tokenSpace.Status = common.ChannelStatusEnabled
	tokenSpace.Key = "tokenspace-key"
	native := &model.Channel{
		Id:     41,
		Type:   constant.ChannelTypeBytePlus,
		Status: common.ChannelStatusEnabled,
		Key:    structuredRealPersonKey(),
	}

	require.False(t, realPersonChannelIsAutomaticCandidate(tokenSpace))
	require.True(t, realPersonChannelIsAutomaticCandidate(native))
}

func insertTokenSpaceRealPersonChannel(t *testing.T, id int, group string, abilityEnabled bool) {
	t.Helper()
	priority := int64(id)
	weight := uint(1)
	settings := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: "https://api.tokenspace.example",
		GroupID:        "group-virtual-not-for-real-person",
	})
	settings.Id = id
	settings.Status = common.ChannelStatusEnabled
	settings.Key = "tokenspace-key"
	settings.Name = "tokenspace"
	settings.Models = bytePlusAssetModelName
	settings.Group = group
	settings.Priority = &priority
	settings.Weight = &weight
	require.NoError(t, model.DB.Create(settings).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     group,
		Model:     bytePlusAssetModelName,
		ChannelId: id,
		Enabled:   abilityEnabled,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}
