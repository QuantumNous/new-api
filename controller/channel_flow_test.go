package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestChannelFlowPoolFromRequestIncludesMaxInflightPerUser(t *testing.T) {
	pool := channelFlowPoolFromRequest(channelFlowPoolRequest{
		Name:               "fair pool",
		Backend:            model.ChannelFlowBackendMemory,
		MaxInflight:        4,
		MaxInflightPerUser: 2,
		QueuePolicy:        model.ChannelFlowQueuePolicyFIFO,
		OnLimit:            model.ChannelFlowOnLimitQueue,
	}, nil)

	require.Equal(t, 2, pool.MaxInflightPerUser, "max_inflight_per_user should be copied from request")
}
