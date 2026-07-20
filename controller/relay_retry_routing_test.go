package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayRetryRoutingRetriesOnceThenCyclesChannels(t *testing.T) {
	routing := newRelayRetryRouting()

	routing.recordFailure(26, "vip")
	next, ok := routing.takeNext()
	require.True(t, ok)
	assert.Equal(t, relayRetryChannel{id: 26, group: "vip"}, next)

	routing.recordFailure(26, "vip")
	options, ok := routing.selectionOptions()
	require.True(t, ok)
	assert.Equal(t, []int{26}, options.ExcludedChannelIds)

	routing.recordFailure(7, "vip")
	next, ok = routing.takeNext()
	require.True(t, ok)
	assert.Equal(t, relayRetryChannel{id: 7, group: "vip"}, next)

	routing.recordFailure(7, "vip")
	options, ok = routing.selectionOptions()
	require.True(t, ok)
	assert.Equal(t, []int{26, 7}, options.ExcludedChannelIds)

	next, ok = routing.restartFromFirst()
	require.True(t, ok)
	assert.Equal(t, relayRetryChannel{id: 26, group: "vip"}, next)
	_, ok = routing.selectionOptions()
	assert.False(t, ok)

	routing.recordFailure(26, "vip")
	next, ok = routing.takeNext()
	require.True(t, ok)
	assert.Equal(t, relayRetryChannel{id: 26, group: "vip"}, next)
}

func TestRelayRetryRoutingFallsBackToOnlyChannel(t *testing.T) {
	routing := newRelayRetryRouting()
	routing.recordFailure(26, "vip")
	_, ok := routing.takeNext()
	require.True(t, ok)
	routing.recordFailure(26, "vip")

	next, ok := routing.restartFromFirst()
	require.True(t, ok)
	assert.Equal(t, relayRetryChannel{id: 26, group: "vip"}, next)
}
