package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type SubscriptionTermRefundResponse struct {
	TermSegmentID int64   `json:"term_segment_id"`
	RefundedMoney float64 `json:"refunded_money"`
	RefundedQuota int64   `json:"refunded_quota"`
	Status        string  `json:"status"`
}

func GetRefundableSubscriptionTerms(c *gin.Context) {
	result, err := service.ListRefundableSubscriptionTerms(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func RefundSubscriptionTerm(c *gin.Context) {
	termSegmentID, err := strconv.ParseInt(c.Param("term_segment_id"), 10, 64)
	if err != nil || termSegmentID <= 0 {
		common.ApiError(c, service.ErrInvalidSubscriptionTermSegmentID)
		return
	}
	result, err := service.RefundSubscriptionTermSegment(c.GetInt("id"), termSegmentID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, SubscriptionTermRefundResponse{
		TermSegmentID: result.TermSegmentID,
		RefundedMoney: result.RefundedMoney,
		RefundedQuota: result.RefundedQuota,
		Status:        model.SubscriptionTermStatusRefunded,
	})
}
