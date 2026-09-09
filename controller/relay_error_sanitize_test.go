package controller

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestRedactUpstreamURLForClientReplacesActualWithDisplay(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl:        "https://real.internal.example",
		ChannelDisplayBaseUrl: "https://api.public.example",
	}}
	got := redactUpstreamURLForClient(info, `Post "https://real.internal.example/v1/chat": dial tcp: timeout`)
	assert.Equal(t, `Post "https://api.public.example/v1/chat": dial tcp: timeout`, got)
}

func TestRedactUpstreamURLForClientNoopWithoutChannelMeta(t *testing.T) {
	assert.Equal(t, "boom", redactUpstreamURLForClient(nil, "boom"))
	assert.Equal(t, "boom", redactUpstreamURLForClient(&relaycommon.RelayInfo{}, "boom"))
}

func TestRedactUpstreamURLForClientNoopWhenNoActualURL(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl:        "https://api.public.example",
		ChannelDisplayBaseUrl: "https://api.public.example",
	}}
	assert.Equal(t, "x https://api.public.example y", redactUpstreamURLForClient(info, "x https://api.public.example y"))
}
