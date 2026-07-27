package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestOpenRouterBalanceTokenPrefersManagementKey(t *testing.T) {
	channel := &model.Channel{Key: "sk-or-api"}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: " sk-or-mgmt ",
	})
	require.Equal(t, "sk-or-mgmt", openRouterBalanceToken(channel))
}

func TestOpenRouterBalanceTokenFallsBackToChannelKey(t *testing.T) {
	channel := &model.Channel{Key: "sk-or-api"}
	channel.SetOtherSettings(dto.ChannelOtherSettings{})
	require.Equal(t, "sk-or-api", openRouterBalanceToken(channel))
}

func TestPreserveOpenRouterManagementKeyKeepsOriginWhenMasked(t *testing.T) {
	origin := &model.Channel{}
	origin.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: "sk-or-mgmt-origin",
		OpenRouterEnterprise:    boolPtr(false),
	})
	incoming := &model.Channel{}
	incoming.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: dto.OpenRouterManagementKeyMasked,
		OpenRouterEnterprise:    boolPtr(true),
	})

	preserveOpenRouterManagementKey(incoming, origin)
	settings := incoming.GetOtherSettings()
	require.Equal(t, "sk-or-mgmt-origin", settings.OpenRouterManagementKey)
	require.True(t, settings.IsOpenRouterEnterprise())
}

func TestPreserveOpenRouterManagementKeyAllowsReplacement(t *testing.T) {
	origin := &model.Channel{}
	origin.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: "sk-or-old",
	})
	incoming := &model.Channel{}
	incoming.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: "sk-or-new",
	})

	preserveOpenRouterManagementKey(incoming, origin)
	require.Equal(t, "sk-or-new", incoming.GetOtherSettings().OpenRouterManagementKey)
}

func TestMaskOpenRouterManagementKeyInChannel(t *testing.T) {
	channel := &model.Channel{}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		OpenRouterManagementKey: "sk-or-secret",
	})
	maskOpenRouterManagementKeyInChannel(channel)
	require.Equal(t, dto.OpenRouterManagementKeyMasked, channel.GetOtherSettings().OpenRouterManagementKey)
}

func boolPtr(v bool) *bool {
	return &v
}
