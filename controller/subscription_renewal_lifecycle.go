package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type SubscriptionRenewalLifecycleResponse struct {
	RenewalSource       string `json:"renewal_source"`
	RenewalStatus       string `json:"renewal_status"`
	CurrentPeriodEnd    int64  `json:"current_period_end"`
	CanCancel           bool   `json:"can_cancel"`
	CanResume           bool   `json:"can_resume"`
	IsCancelAtPeriodEnd bool   `json:"is_cancel_at_period_end"`
	SyncPending         bool   `json:"sync_pending"`
}

var cancelCurrentSubscriptionRenewal = service.CancelCurrentSubscriptionRenewal
var resumeCurrentSubscriptionRenewal = service.ResumeCurrentSubscriptionRenewal

func CancelSubscriptionRenewal(c *gin.Context) {
	result, err := cancelCurrentSubscriptionRenewal(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if result == nil {
		common.ApiError(c, errors.New("subscription renewal lifecycle result is missing"))
		return
	}
	common.ApiSuccess(c, subscriptionRenewalLifecycleResponse(result))
}

func ResumeSubscriptionRenewal(c *gin.Context) {
	result, err := resumeCurrentSubscriptionRenewal(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if result == nil {
		common.ApiError(c, errors.New("subscription renewal lifecycle result is missing"))
		return
	}
	common.ApiSuccess(c, subscriptionRenewalLifecycleResponse(result))
}

func subscriptionRenewalLifecycleResponse(result *service.SubscriptionRenewalLifecycleResult) SubscriptionRenewalLifecycleResponse {
	if result == nil {
		return SubscriptionRenewalLifecycleResponse{}
	}
	return SubscriptionRenewalLifecycleResponse{
		RenewalSource:       result.RenewalSource,
		RenewalStatus:       result.RenewalStatus,
		CurrentPeriodEnd:    result.CurrentPeriodEnd,
		CanCancel:           result.CanCancel,
		CanResume:           result.CanResume,
		IsCancelAtPeriodEnd: result.CancelAtPeriodEnd,
		SyncPending:         result.SyncPending,
	}
}
