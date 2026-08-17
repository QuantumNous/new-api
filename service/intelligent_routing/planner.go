package intelligent_routing

import (
	"errors"
	"sort"

	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/shopspring/decimal"
)

type PlanInput struct {
	RequestedModel       string
	PolicyVersion        int
	Features             Features
	Requirements         Requirements
	Candidates           []Candidate
	QualityThreshold     float64
	MaxAttempts          int
	MaxEndpointsPerModel int
	MaxCostMultiplier    float64
	PreferredModel       string
	PreferredChannelID   int
}

type RouteNode = hosttypes.IntelligentRouteNode
type RoutePlan = hosttypes.IntelligentRoutePlan

func Plan(input PlanInput) (RoutePlan, error) {
	if input.MaxAttempts < 1 || input.MaxEndpointsPerModel < 1 || input.MaxCostMultiplier < 1 {
		return RoutePlan{}, errors.New("invalid route plan budget")
	}
	eligible := make([]Candidate, 0, len(input.Candidates))
	for _, candidate := range input.Candidates {
		if candidate.Tier < input.Requirements.MinimumTier || !supports(candidate, input.Requirements.Capabilities) {
			continue
		}
		if candidate.ContextLimit > 0 && input.Requirements.ContextNeeded*10 > candidate.ContextLimit*7 {
			continue
		}
		eligible = append(eligible, candidate)
	}
	if len(eligible) == 0 {
		return RoutePlan{}, errors.New("no eligible intelligent routing candidate")
	}
	qualified := make([]Candidate, 0, len(eligible))
	for _, candidate := range eligible {
		if candidate.PredictedSuccess >= input.QualityThreshold {
			qualified = append(qualified, candidate)
		}
	}
	fallbackByQuality := len(qualified) == 0
	if fallbackByQuality {
		qualified = eligible
		sort.SliceStable(qualified, func(i, j int) bool {
			if qualified[i].PredictedSuccess != qualified[j].PredictedSuccess {
				return qualified[i].PredictedSuccess > qualified[j].PredictedSuccess
			}
			return expectedCost(input.Features, qualified[i]).LessThan(expectedCost(input.Features, qualified[j]))
		})
	} else {
		sort.SliceStable(qualified, func(i, j int) bool {
			left, right := qualified[i], qualified[j]
			if left.HealthTier != right.HealthTier {
				return left.HealthTier < right.HealthTier
			}
			leftCost, rightCost := expectedCost(input.Features, left), expectedCost(input.Features, right)
			if !leftCost.Equal(rightCost) {
				return leftCost.LessThan(rightCost)
			}
			if left.ResponseTimeMS != right.ResponseTimeMS {
				return left.ResponseTimeMS < right.ResponseTimeMS
			}
			if left.FailureRate != right.FailureRate {
				return left.FailureRate < right.FailureRate
			}
			return left.ChannelID < right.ChannelID
		})
	}
	if !fallbackByQuality && input.PreferredModel != "" && len(qualified) > 1 {
		cheapestCost := expectedCost(input.Features, qualified[0])
		for _, candidate := range qualified[1:] {
			cost := expectedCost(input.Features, candidate)
			if cost.LessThan(cheapestCost) {
				cheapestCost = cost
			}
		}
		limit := cheapestCost.Mul(decimal.NewFromFloat(1.15))
		for i, candidate := range qualified {
			if candidate.Model == input.PreferredModel && candidate.ChannelID == input.PreferredChannelID && candidate.HealthTier != HealthDegraded && candidate.HealthTier != HealthOpen && !expectedCost(input.Features, candidate).GreaterThan(limit) {
				copy(qualified[1:i+1], qualified[0:i])
				qualified[0] = candidate
				break
			}
		}
	}
	if fallbackByQuality {
		nodes := make([]RouteNode, 0, min(input.MaxAttempts, len(qualified)))
		perModel := make(map[string]int)
		seen := make(map[[2]interface{}]struct{})
		for _, candidate := range qualified {
			key := [2]interface{}{candidate.Model, candidate.ChannelID}
			if _, ok := seen[key]; ok || perModel[candidate.Model] >= input.MaxEndpointsPerModel {
				continue
			}
			nodes = append(nodes, routeNode(input.Features, candidate))
			seen[key] = struct{}{}
			perModel[candidate.Model]++
			if len(nodes) == input.MaxAttempts {
				break
			}
		}
		if len(nodes) == 0 {
			return RoutePlan{}, errors.New("route plan is empty")
		}
		return RoutePlan{RequestedModel: input.RequestedModel, PolicyVersion: input.PolicyVersion, Nodes: nodes, MaxAttempts: input.MaxAttempts, MaxCostMultiplier: input.MaxCostMultiplier}, nil
	}
	strongest := len(qualified) - 1
	for i := 0; i < len(qualified)-1; i++ {
		if qualified[i].PredictedSuccess > qualified[strongest].PredictedSuccess {
			strongest = i
		}
	}
	nodes := make([]RouteNode, 0, min(input.MaxAttempts, len(qualified)))
	perModel := make(map[string]int)
	seen := make(map[[2]interface{}]struct{})
	for i, candidate := range qualified {
		if i == strongest || len(nodes) == input.MaxAttempts-1 {
			continue
		}
		key := [2]interface{}{candidate.Model, candidate.ChannelID}
		modelLimit := input.MaxEndpointsPerModel
		if candidate.Model == qualified[strongest].Model {
			modelLimit--
		}
		if _, ok := seen[key]; ok || perModel[candidate.Model] >= modelLimit {
			continue
		}
		nodes = append(nodes, routeNode(input.Features, candidate))
		seen[key] = struct{}{}
		perModel[candidate.Model]++
	}
	strongestCandidate := qualified[strongest]
	strongestKey := [2]interface{}{strongestCandidate.Model, strongestCandidate.ChannelID}
	if _, ok := seen[strongestKey]; !ok && perModel[strongestCandidate.Model] < input.MaxEndpointsPerModel {
		nodes = append(nodes, routeNode(input.Features, strongestCandidate))
	}
	if len(nodes) == 0 {
		return RoutePlan{}, errors.New("route plan is empty")
	}
	return RoutePlan{RequestedModel: input.RequestedModel, PolicyVersion: input.PolicyVersion, Nodes: nodes, MaxAttempts: input.MaxAttempts, MaxCostMultiplier: input.MaxCostMultiplier}, nil
}

func supports(candidate Candidate, required map[Capability]bool) bool {
	for capability, needed := range required {
		if needed && !candidate.Capabilities[capability] {
			return false
		}
	}
	return true
}

func expectedCost(features Features, candidate Candidate) decimal.Decimal {
	input := decimal.NewFromInt(int64(features.PromptTokens)).Mul(decimal.NewFromFloat(candidate.InputPrice))
	output := decimal.NewFromInt(int64(features.MaxOutputTokens)).Mul(decimal.NewFromFloat(candidate.OutputPrice))
	base := input.Add(output).Div(decimal.NewFromInt(1_000_000))
	failureRate := candidate.FailureRate
	if failureRate < 0 {
		failureRate = 0
	}
	if failureRate > .99 {
		failureRate = .99
	}
	return base.Div(decimal.NewFromFloat(1 - failureRate))
}

func routeNode(features Features, candidate Candidate) RouteNode {
	return RouteNode{Model: candidate.Model, ChannelID: candidate.ChannelID, Tier: candidate.Tier, PredictedSuccess: candidate.PredictedSuccess, ExpectedCost: expectedCost(features, candidate), ReasonCodes: []string{"quality_threshold_met", "lowest_expected_cost"}}
}
