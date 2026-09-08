package controller

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func AdminListAgents(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	records, total, err := service.ListAdminAgentAccounts(
		c.Query("keyword"),
		c.Query("status"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	items := make([]dto.AgentAccountResponse, 0, len(records))
	for _, record := range records {
		items = append(items, agentAccountResponse(record.Account, record.Username, record.DisplayName))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminListAgentCreditLogs(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	pageInfo := common.GetPageQuery(c)
	logs, total, err := service.ListAdminAgentCreditLogs(userID, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	items := make([]dto.AgentCreditLogResponse, 0, len(logs))
	for _, log := range logs {
		items = append(items, agentCreditLogResponse(log))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminListAgentPlanOffers(c *gin.Context) {
	records, err := service.ListAgentPlanOffers()
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	items := make([]dto.AgentPlanOfferResponse, 0, len(records))
	for _, record := range records {
		items = append(items, agentPlanOfferResponse(record))
	}
	common.ApiSuccess(c, items)
}

func AdminListAgentOrders(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	query, ok := parseAgentOrderQuery(c, page, true)
	if !ok {
		return
	}
	records, total, err := service.ListAdminAgentOrders(query)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, records)
}

func AdminListAgentCodes(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	query, ok := parseAgentCodeQuery(c, page, true)
	if !ok {
		return
	}
	records, total, err := service.ListAdminAgentCodes(query)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, records)
}

func AdminReconcileAgentAccount(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	result, err := service.ReconcileAgentAccount(userID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	common.ApiSuccess(c, dto.AgentReconciliationResponse{
		AgentUserId: result.AgentUserID, Balance: service.FormatAgentPoints(result.Balance),
		LedgerSum: service.FormatAgentPoints(result.LedgerSum), Difference: service.FormatAgentPoints(result.Difference),
		LedgerCount: result.LedgerCount, LedgerContinuous: result.LedgerContinuous, Matches: result.Matches,
	})
}

func RootRefundAgentCodes(c *gin.Context) {
	var request dto.AgentAdminRefundRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid refund request")
		return
	}
	request.IdempotencyKey = strings.TrimSpace(request.IdempotencyKey)
	result, err := service.RefundAgentCodes(service.AgentRefundInput{
		AgentUserID: request.AgentUserId, RedemptionIDs: request.RedemptionIds,
		IdempotencyKey: request.IdempotencyKey, RequestedBy: c.GetInt("id"), RootOverride: true,
	})
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, request.AgentUserId, "agent.refund", map[string]interface{}{
		"agent_user_id": request.AgentUserId, "request_id": result.RequestID, "redemption_ids": result.RedemptionIDs,
		"fee": service.FormatAgentPoints(result.Fee), "refunded": service.FormatAgentPoints(result.Refunded),
		"balance_after": service.FormatAgentPoints(result.BalanceAfter), "idempotency_key": request.IdempotencyKey,
	})
	common.ApiSuccess(c, agentRefundResponse(result))
}

func RootEnableAgent(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	account, err := service.EnableAgent(userID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.enable", map[string]interface{}{
		"agent_user_id": userID,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootDisableAgent(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	account, err := service.DisableAgent(userID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.disable", map[string]interface{}{
		"agent_user_id": userID,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootUpdateAgentDailyLimit(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	var request dto.AgentDailyLimitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}
	account, err := service.UpdateAgentDailyLimit(userID, request.DailyCodeLimit)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.limit_update", map[string]interface{}{
		"agent_user_id":    userID,
		"daily_code_limit": account.DailyCodeLimit,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootAdjustAgentCredit(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	var request dto.AgentCreditAdjustmentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}
	amount, err := service.ParseAgentPoints(request.Amount)
	if err != nil || amount <= 0 {
		common.ApiErrorMsg(c, "amount must be a positive value with at most two decimal places")
		return
	}
	result, err := service.AdjustAgentCredit(service.AgentCreditAdjustment{
		AgentUserID:    userID,
		OperatorUserID: c.GetInt("id"),
		Amount:         amount,
		Direction:      request.Direction,
		Reason:         request.Reason,
		IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	action := "agent.credit"
	if result.Log.EventType == model.AgentCreditEventAdminDebit {
		action = "agent.debit"
	}
	recordManageAuditFor(c, userID, action, map[string]interface{}{
		"agent_user_id": userID,
		"amount":        service.FormatAgentPoints(amount),
		"balance_after": service.FormatAgentPoints(result.Log.BalanceAfter),
		"reason":        result.Log.Remark,
	})
	common.ApiSuccess(c, dto.AgentCreditAdjustmentResponse{
		Account: dto.AgentCreditBalanceResponse{Balance: service.FormatAgentPoints(result.Account.Balance)},
		Log:     agentCreditLogResponse(result.Log),
	})
}

func RootUpsertAgentPlanOffer(c *gin.Context) {
	planID, err := strconv.Atoi(c.Param("plan_id"))
	if err != nil || planID <= 0 {
		common.ApiErrorMsg(c, "invalid subscription plan ID")
		return
	}
	var request dto.AgentPlanOfferUpsertRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Enabled == nil {
		common.ApiErrorMsg(c, "enabled and offer terms are required")
		return
	}
	unitPrice, err := service.ParseAgentPoints(request.UnitPrice)
	if err != nil || unitPrice <= 0 {
		common.ApiErrorMsg(c, "unit price must be a positive value with at most two decimal places")
		return
	}
	offer, err := service.UpsertAgentPlanOffer(service.AgentPlanOfferInput{
		PlanID: planID, Enabled: *request.Enabled, UnitPrice: unitPrice,
		CodeValidDays: request.CodeValidDays, RefundFeeBps: request.RefundFeeBps,
	})
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	plan, err := model.GetSubscriptionPlanById(planID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAudit(c, "agent.offer_update", map[string]interface{}{
		"plan_id":         planID,
		"enabled":         offer.Enabled,
		"unit_price":      service.FormatAgentPoints(offer.UnitPrice),
		"code_valid_days": offer.CodeValidDays,
		"refund_fee_bps":  offer.RefundFeeBps,
	})
	common.ApiSuccess(c, agentPlanOfferResponse(service.AgentPlanOfferRecord{
		Offer: *offer,
		Plan:  *plan,
	}))
}

func agentAdminUserID(c *gin.Context) (int, error) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userID <= 0 {
		return 0, errors.New("invalid agent user ID")
	}
	return userID, nil
}

func agentAccountResponse(account model.AgentAccount, username string, displayName string) dto.AgentAccountResponse {
	dailyCodeCount := 0
	if account.DailyCountDate == time.Now().In(time.Local).Format("2006-01-02") {
		dailyCodeCount = account.DailyCodeCount
	}
	return dto.AgentAccountResponse{
		Id:             account.Id,
		UserId:         account.UserId,
		Username:       username,
		DisplayName:    displayName,
		Status:         account.Status,
		Balance:        service.FormatAgentPoints(account.Balance),
		DailyCodeLimit: account.DailyCodeLimit,
		DailyCountDate: account.DailyCountDate,
		DailyCodeCount: dailyCodeCount,
		Version:        account.Version,
		CreatedAt:      account.CreatedAt,
		UpdatedAt:      account.UpdatedAt,
	}
}

func agentCreditLogResponse(log model.AgentCreditLog) dto.AgentCreditLogResponse {
	return dto.AgentCreditLogResponse{
		Id:             log.Id,
		AgentUserId:    log.AgentUserId,
		Delta:          service.FormatAgentPoints(log.Delta),
		BalanceBefore:  service.FormatAgentPoints(log.BalanceBefore),
		BalanceAfter:   service.FormatAgentPoints(log.BalanceAfter),
		EventType:      log.EventType,
		BusinessKey:    log.BusinessKey,
		OrderId:        log.OrderId,
		RedemptionId:   log.RedemptionId,
		OperatorUserId: log.OperatorUserId,
		Remark:         log.Remark,
		CreatedAt:      log.CreatedAt,
	}
}

func agentPlanOfferResponse(record service.AgentPlanOfferRecord) dto.AgentPlanOfferResponse {
	offer := record.Offer
	plan := record.Plan
	return dto.AgentPlanOfferResponse{
		Id:            offer.Id,
		PlanId:        offer.PlanId,
		Enabled:       offer.Enabled,
		UnitPrice:     service.FormatAgentPoints(offer.UnitPrice),
		CodeValidDays: offer.CodeValidDays,
		RefundFeeBps:  offer.RefundFeeBps,
		Plan: dto.AgentSubscriptionPlanResponse{
			Id:                      plan.Id,
			Title:                   plan.Title,
			Subtitle:                plan.Subtitle,
			PriceAmount:             plan.PriceAmount,
			Currency:                plan.Currency,
			DurationUnit:            plan.DurationUnit,
			DurationValue:           plan.DurationValue,
			CustomSeconds:           plan.CustomSeconds,
			Enabled:                 plan.Enabled,
			SortOrder:               plan.SortOrder,
			AllowBalancePay:         plan.AllowBalancePay,
			AllowWalletOverflow:     plan.AllowWalletOverflow,
			StripePriceId:           plan.StripePriceId,
			CreemProductId:          plan.CreemProductId,
			WaffoPancakeProductId:   plan.WaffoPancakeProductId,
			MaxPurchasePerUser:      plan.MaxPurchasePerUser,
			UpgradeGroup:            plan.UpgradeGroup,
			DowngradeGroup:          plan.DowngradeGroup,
			TotalAmount:             plan.TotalAmount,
			QuotaResetPeriod:        plan.QuotaResetPeriod,
			QuotaResetCustomSeconds: plan.QuotaResetCustomSeconds,
			CreatedAt:               plan.CreatedAt,
			UpdatedAt:               plan.UpdatedAt,
		},
		CreatedAt: offer.CreatedAt,
		UpdatedAt: offer.UpdatedAt,
	}
}

func writeAgentAdminError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAgentAccountNotFound), errors.Is(err, service.ErrAgentUserNotFound):
		common.ApiErrorMsg(c, "agent or user not found")
	case errors.Is(err, service.ErrAgentAccountDisabled):
		common.ApiErrorMsg(c, "agent account is disabled")
	case errors.Is(err, service.ErrAgentInvalidDailyLimit):
		common.ApiErrorMsg(c, "daily code limit must be positive")
	case errors.Is(err, service.ErrAgentInvalidAdjustment):
		common.ApiErrorMsg(c, "direction, reason, amount, and idempotency key are required")
	case errors.Is(err, service.ErrAgentInsufficientBalance):
		common.ApiErrorMsg(c, "agent balance is insufficient")
	case errors.Is(err, service.ErrAgentIdempotencyConflict):
		common.ApiErrorMsg(c, "idempotency key was already used for a different request")
	case errors.Is(err, service.ErrAgentAccountConflict):
		common.ApiErrorMsg(c, "agent account changed concurrently; please retry")
	case errors.Is(err, service.ErrAgentBalanceOverflow):
		common.ApiErrorMsg(c, "agent balance is outside the supported range")
	case errors.Is(err, service.ErrAgentPlanNotFound):
		common.ApiErrorMsg(c, "subscription plan not found")
	case errors.Is(err, service.ErrAgentOfferInvalidPrice):
		common.ApiErrorMsg(c, "agent offer unit price must be positive")
	case errors.Is(err, service.ErrAgentOfferInvalidValidity):
		common.ApiErrorMsg(c, "code validity must be between 1 and 3650 days")
	case errors.Is(err, service.ErrAgentOfferInvalidRefundFee):
		common.ApiErrorMsg(c, "refund fee must be between 0 and 10000 basis points")
	case errors.Is(err, service.ErrAgentQueryInvalid):
		common.ApiErrorMsg(c, "invalid agent query parameters")
	case errors.Is(err, service.ErrAgentRefundInvalidRequest):
		common.ApiErrorMsg(c, "invalid refund request")
	case errors.Is(err, service.ErrAgentRefundUnavailable):
		common.ApiErrorMsg(c, "package codes are unavailable for refund")
	case errors.Is(err, service.ErrAgentReconciliation):
		common.ApiErrorMsg(c, "agent reconciliation failed")
	case errors.Is(err, service.ErrAgentReconciliationUnstable):
		common.ApiErrorMsg(c, "agent account changed during reconciliation; please retry")
	case errors.Is(err, service.ErrAgentLedgerMismatch):
		common.ApiErrorMsg(c, "agent ledger is inconsistent; financial operations are temporarily unavailable")
	default:
		common.SysError("agent administration failed: " + err.Error())
		common.ApiErrorMsg(c, "agent account operation failed")
	}
}
