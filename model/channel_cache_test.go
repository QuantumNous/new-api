package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPickWeightedChannelCandidatePreservesZeroWeightSemantics(t *testing.T) {
	zeroWeight := ChannelCandidate{Channel: &Channel{Id: 207}, Weight: 0}
	positiveWeight := ChannelCandidate{Channel: &Channel{Id: 208}, Weight: 1}

	candidate, index := PickWeightedChannelCandidate([]ChannelCandidate{zeroWeight, positiveWeight})

	assert.Equal(t, 1, index)
	assert.Equal(t, positiveWeight.Channel.Id, candidate.Channel.Id)
}
