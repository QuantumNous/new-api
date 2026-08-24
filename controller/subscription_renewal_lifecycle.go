package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type SubscriptionRenewalLifecycleResponse struct {
	RenewalSource       string `json:"renewal_source"`
	RenewalStatus       string `json:"renewal_status"`
	CurrentPeriodEnd    int64  `json:"current_period_end"`
	ChangeVersion       int64  `json:"change_version"`
	CanCancel           bool   `json:"can_cancel"`
	CanResume           bool   `json:"can_resume"`
	IsCancelAtPeriodEnd bool   `json:"is_cancel_at_period_end"`
}

type SubscriptionRenewalLifecycleRequest struct {
	ExpectedContractID       int64  `json:"expected_contract_id"`
	ExpectedChangeVersion    *int64 `json:"expected_change_version"`
	ExpectedCurrentPeriodEnd int64  `json:"expected_current_period_end"`
	ExpectedRenewalSource    string `json:"expected_renewal_source"`
	ExpectedRenewalStatus    string `json:"expected_renewal_status"`
}

var cancelCurrentSubscriptionRenewal = service.CancelCurrentSubscriptionRenewal
var resumeCurrentSubscriptionRenewal = service.ResumeCurrentSubscriptionRenewal

func CancelSubscriptionRenewal(c *gin.Context) {
	precondition, ok := parseSubscriptionRenewalLifecyclePrecondition(c)
	if !ok {
		return
	}
	result, err := cancelCurrentSubscriptionRenewal(c.GetInt("id"), precondition)
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
	precondition, ok := parseSubscriptionRenewalLifecyclePrecondition(c)
	if !ok {
		return
	}
	result, err := resumeCurrentSubscriptionRenewal(c.GetInt("id"), precondition)
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

func parseSubscriptionRenewalLifecyclePrecondition(c *gin.Context) (service.SubscriptionRenewalLifecyclePrecondition, bool) {
	var req SubscriptionRenewalLifecycleRequest
	if err := common.DecodeJsonDisallowUnknownFields(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "subscription renewal precondition is required")
		return service.SubscriptionRenewalLifecyclePrecondition{}, false
	}
	req.ExpectedRenewalSource = strings.TrimSpace(req.ExpectedRenewalSource)
	req.ExpectedRenewalStatus = strings.TrimSpace(req.ExpectedRenewalStatus)
	if req.ExpectedContractID <= 0 ||
		req.ExpectedChangeVersion == nil ||
		*req.ExpectedChangeVersion < 0 ||
		req.ExpectedCurrentPeriodEnd <= 0 ||
		(req.ExpectedRenewalSource != model.SubscriptionRenewalSourceProvider &&
			req.ExpectedRenewalSource != model.SubscriptionRenewalSourceWallet) ||
		(req.ExpectedRenewalStatus != model.SubscriptionRenewalStatusEnabled &&
			req.ExpectedRenewalStatus != model.SubscriptionRenewalStatusCancelledByUser) {
		common.ApiErrorMsg(c, "subscription renewal precondition is required")
		return service.SubscriptionRenewalLifecyclePrecondition{}, false
	}
	return service.SubscriptionRenewalLifecyclePrecondition{
		ExpectedContractID:       req.ExpectedContractID,
		ExpectedChangeVersion:    *req.ExpectedChangeVersion,
		ExpectedCurrentPeriodEnd: req.ExpectedCurrentPeriodEnd,
		ExpectedRenewalSource:    req.ExpectedRenewalSource,
		ExpectedRenewalStatus:    req.ExpectedRenewalStatus,
	}, true
}

func subscriptionRenewalLifecycleResponse(result *service.SubscriptionRenewalLifecycleResult) SubscriptionRenewalLifecycleResponse {
	if result == nil {
		return SubscriptionRenewalLifecycleResponse{}
	}
	return SubscriptionRenewalLifecycleResponse{
		RenewalSource:       result.RenewalSource,
		RenewalStatus:       result.RenewalStatus,
		CurrentPeriodEnd:    result.CurrentPeriodEnd,
		ChangeVersion:       result.ChangeVersion,
		CanCancel:           result.CanCancel,
		CanResume:           result.CanResume,
		IsCancelAtPeriodEnd: result.CancelAtPeriodEnd,
	}
}
