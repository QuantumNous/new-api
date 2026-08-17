package intelligent_routing

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCatalogExcludesUnpricedDisabledAndUnsupportedCandidates(t *testing.T) {
	config := routingsetting.Config{Models: []routingsetting.ModelPolicy{
		{Model: "cheap", Tier: 0, InputPrice: 1, OutputPrice: 2, ContextLimit: 8192, Capabilities: []string{"tools"}},
		{Model: "unpriced", Tier: 1, ContextLimit: 8192},
	}}
	channels := []*model.Channel{
		{Id: 7, Status: common.ChannelStatusEnabled, Models: "cheap", Group: "default"},
		{Id: 8, Status: common.ChannelStatusManuallyDisabled, Models: "cheap", Group: "default"},
		{Id: 9, Status: common.ChannelStatusEnabled, Models: "unpriced", Group: "default"},
	}
	got := NewCatalog(config, func(string, string) []*model.Channel { return channels }).Build("default", "/v1/chat/completions")
	require.Len(t, got, 1)
	assert.Equal(t, "cheap", got[0].Model)
	assert.Equal(t, 7, got[0].ChannelID)
	assert.True(t, got[0].Capabilities[CapabilityTools])
}

func TestCatalogReturnsIndependentCandidateValues(t *testing.T) {
	config := routingsetting.Config{Models: []routingsetting.ModelPolicy{{Model: "cheap", Tier: 0, InputPrice: 1, OutputPrice: 2}}}
	channel := &model.Channel{Id: 7, Status: common.ChannelStatusEnabled, Models: "cheap", Group: "default", ResponseTime: 20}
	catalog := NewCatalog(config, func(string, string) []*model.Channel { return []*model.Channel{channel} })
	first := catalog.Build("default", "/v1/chat/completions")
	channel.ResponseTime = 900
	assert.Equal(t, 20, first[0].ResponseTimeMS)
}
