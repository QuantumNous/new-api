package intelligent_routing

import (
	"time"

	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/shopspring/decimal"
)

type ExecutionBudget struct {
	startedAt time.Time
	duration  time.Duration
	maxCost   decimal.Decimal
	spent     decimal.Decimal
	finalUsed bool
}

func NewExecutionBudget(nodes []hosttypes.IntelligentRouteNode, multiplier float64, duration time.Duration, now time.Time) *ExecutionBudget {
	maxCost := decimal.Zero
	if len(nodes) > 0 {
		maxCost = nodes[0].ExpectedCost.Mul(decimal.NewFromFloat(multiplier))
	}
	return &ExecutionBudget{startedAt: now, duration: duration, maxCost: maxCost}
}

func (budget *ExecutionBudget) SelectAttempt(nodes []hosttypes.IntelligentRouteNode, requestedIndex int, now time.Time) (int, bool) {
	if budget == nil || requestedIndex < 0 || requestedIndex >= len(nodes) {
		return 0, false
	}
	finalIndex := len(nodes) - 1
	withinTime := budget.duration <= 0 || now.Sub(budget.startedAt) <= budget.duration
	withinCost := budget.spent.Add(nodes[requestedIndex].ExpectedCost).LessThanOrEqual(budget.maxCost)
	if withinTime && withinCost {
		if requestedIndex == finalIndex {
			budget.finalUsed = true
		}
		return requestedIndex, true
	}
	if budget.finalUsed {
		return 0, false
	}
	budget.finalUsed = true
	return finalIndex, true
}

func (budget *ExecutionBudget) Record(node hosttypes.IntelligentRouteNode) {
	if budget != nil {
		budget.spent = budget.spent.Add(node.ExpectedCost)
	}
}
