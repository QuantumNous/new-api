package intelligent_routing

import (
	"testing"
	"time"

	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExecutionBudgetJumpsToFinalCandidateWhenCostWouldBeExceeded(t *testing.T) {
	now := time.Unix(1000, 0)
	nodes := []hosttypes.IntelligentRouteNode{
		{Model: "first", ExpectedCost: decimal.NewFromInt(1)},
		{Model: "second", ExpectedCost: decimal.NewFromInt(2)},
		{Model: "final", ExpectedCost: decimal.NewFromInt(5)},
	}
	budget := NewExecutionBudget(nodes, 2.5, 30*time.Second, now)
	index, ok := budget.SelectAttempt(nodes, 0, now)
	require.True(t, ok)
	assert.Equal(t, 0, index)
	budget.Record(nodes[index])
	index, ok = budget.SelectAttempt(nodes, 1, now.Add(time.Second))
	require.True(t, ok)
	assert.Equal(t, 2, index)
	budget.Record(nodes[index])
	_, ok = budget.SelectAttempt(nodes, 2, now.Add(2*time.Second))
	assert.False(t, ok)
}

func TestExecutionBudgetAllowsOnlyFinalCandidateAfterDeadline(t *testing.T) {
	now := time.Unix(1000, 0)
	nodes := []hosttypes.IntelligentRouteNode{{ExpectedCost: decimal.NewFromInt(1)}, {ExpectedCost: decimal.NewFromInt(1)}, {ExpectedCost: decimal.NewFromInt(1)}}
	budget := NewExecutionBudget(nodes, 2.5, 30*time.Second, now)
	index, ok := budget.SelectAttempt(nodes, 0, now)
	require.True(t, ok)
	budget.Record(nodes[index])
	index, ok = budget.SelectAttempt(nodes, 1, now.Add(31*time.Second))
	require.True(t, ok)
	assert.Equal(t, 2, index)
}
