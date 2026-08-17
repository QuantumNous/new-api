package types

import "github.com/shopspring/decimal"

type IntelligentRouteNode struct {
	Model            string
	ChannelID        int
	Tier             int
	PredictedSuccess float64
	ExpectedCost     decimal.Decimal
	ReasonCodes      []string
}

type IntelligentRoutePlan struct {
	RequestedModel    string
	PolicyVersion     int
	Nodes             []IntelligentRouteNode
	MaxAttempts       int
	MaxCostMultiplier float64
}

type IntelligentRouteAttempt struct {
	Index         int
	Model         string
	ChannelID     int
	Outcome       string
	FailureReason string
	LatencyMS     int64
}
