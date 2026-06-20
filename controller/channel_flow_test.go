package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
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

	if pool.MaxInflightPerUser != 2 {
		t.Fatalf("expected max_inflight_per_user to be copied from request, got %d", pool.MaxInflightPerUser)
	}
}
