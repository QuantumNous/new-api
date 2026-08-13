package common

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

type BlockRunPaymentOutcome string

const (
	BlockRunPaymentOutcomeSigned            BlockRunPaymentOutcome = "signed"
	BlockRunPaymentOutcomeSucceeded         BlockRunPaymentOutcome = "succeeded"
	BlockRunPaymentOutcomeRejected          BlockRunPaymentOutcome = "payment_rejected"
	BlockRunPaymentOutcomeSettlementUnknown BlockRunPaymentOutcome = "settlement_unknown"
)

// BlockRunPaymentState records only request-scoped facts needed to prevent a
// second paid attempt and to reconcile an ambiguous signed request.
type BlockRunPaymentState struct {
	Attempted       bool                     `json:"attempted"`
	Chain           dto.BlockRunPaymentChain `json:"chain"`
	ChannelID       int                      `json:"channel_id"`
	Outcome         BlockRunPaymentOutcome   `json:"outcome"`
	Reconciliation  string                   `json:"reconciliation,omitempty"`
	StreamTruncated bool                     `json:"stream_truncated,omitempty"`
}

func MarkBlockRunPaymentAttempt(c *gin.Context, chain dto.BlockRunPaymentChain, channelID int, reconciliation string) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeyBlockRunPaymentState, &BlockRunPaymentState{
		Attempted:      true,
		Chain:          chain,
		ChannelID:      channelID,
		Outcome:        BlockRunPaymentOutcomeSigned,
		Reconciliation: reconciliation,
	})
}

func GetBlockRunPaymentState(c *gin.Context) (*BlockRunPaymentState, bool) {
	if c == nil {
		return nil, false
	}
	state, ok := common.GetContextKeyType[*BlockRunPaymentState](c, constant.ContextKeyBlockRunPaymentState)
	return state, ok && state != nil
}

func UpdateBlockRunPaymentOutcome(c *gin.Context, outcome BlockRunPaymentOutcome, streamTruncated bool) {
	state, ok := GetBlockRunPaymentState(c)
	if !ok {
		return
	}
	state.Outcome = outcome
	state.StreamTruncated = streamTruncated
}
