package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExcludeChannelIDs(t *testing.T) {
	require.Equal(t, []int{1, 2, 3}, excludeChannelIDs([]int{1, 2, 3}, nil))
	assert.Equal(t, []int{1, 3}, excludeChannelIDs([]int{1, 2, 3}, []int{2}))
	assert.Empty(t, excludeChannelIDs([]int{1, 2}, []int{1, 2, 3}))
}

func TestExcludeAbilities(t *testing.T) {
	a := []Ability{{ChannelId: 1}, {ChannelId: 2}, {ChannelId: 3}}
	got := excludeAbilities(a, []int{2})
	assert.Equal(t, []int{1, 3}, []int{got[0].ChannelId, got[1].ChannelId})
}
