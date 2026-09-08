package controller

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type agentQueryPage struct {
	Page     int
	PageSize int
	Offset   int
}

func GetAgentOverview(c *gin.Context) {
	overview, err := service.GetAgentOverview(c.GetInt("id"))
	if err != nil {
		writeAgentError(c, err)
		return
	}
	common.ApiSuccess(c, dto.AgentOverviewResponse{
		Status:             overview.Account.Status,
		Balance:            service.FormatAgentPoints(overview.Account.Balance),
		DailyCodeLimit:     overview.Account.DailyCodeLimit,
		DailyCodeCount:     overview.DailyCodeCount,
		DailyRemaining:     overview.DailyRemaining,
		NextDailyResetAt:   overview.NextDailyResetAt,
		AccountLastUpdated: overview.Account.UpdatedAt,
	})
}

func GetAgentOffers(c *gin.Context) {
	records, err := service.ListPurchasableAgentOffers(c.GetInt("id"))
	if err != nil {
		writeAgentError(c, err)
		return
	}
	items := make([]dto.AgentPlanOfferResponse, 0, len(records))
	for _, record := range records {
		items = append(items, agentPlanOfferResponse(record))
	}
	common.ApiSuccess(c, items)
}

func CreateAgentOrder(c *gin.Context) {
	var request dto.AgentPurchaseRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid purchase request")
		return
	}
	result, err := service.PurchaseAgentCodes(service.AgentPurchaseInput{
		AgentUserID: c.GetInt("id"), PlanID: request.PlanId,
		Quantity: request.Quantity, IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}

	codes := make([]dto.AgentPackageCodeResponse, 0, len(result.Codes))
	for _, code := range result.Codes {
		codes = append(codes, dto.AgentPackageCodeResponse{
			Id: code.Id, Key: code.Key, Name: code.Name, Status: code.Status,
			SubscriptionPlanId: code.SubscriptionPlanId,
			CreatedTime:        code.CreatedTime,
			ExpiredTime:        code.ExpiredTime,
		})
	}
	order := result.Order
	common.ApiSuccess(c, dto.AgentPurchaseResponse{
		Order: dto.AgentPurchaseOrderResponse{
			Id: order.Id, OrderNo: order.OrderNo, PlanId: order.PlanId,
			PlanTitle: order.PlanTitle, Quantity: order.Quantity,
			UnitPrice:     service.FormatAgentPoints(order.UnitPrice),
			TotalPrice:    service.FormatAgentPoints(order.TotalPrice),
			CodeValidDays: order.CodeValidDays, RefundFeeBps: order.RefundFeeBps,
			Status: order.Status, CreatedAt: order.CreatedAt,
		},
		Codes:        codes,
		BalanceAfter: service.FormatAgentPoints(result.BalanceAfter),
	})
}

func RefundAgentCodes(c *gin.Context) {
	var request dto.AgentRefundRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid refund request")
		return
	}
	userID := c.GetInt("id")
	result, err := service.RefundAgentCodes(service.AgentRefundInput{
		AgentUserID: userID, RedemptionIDs: request.RedemptionIds,
		IdempotencyKey: request.IdempotencyKey, RequestedBy: userID,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}
	common.ApiSuccess(c, agentRefundResponse(result))
}

func agentRefundResponse(result *service.AgentRefundResult) dto.AgentRefundResponse {
	return dto.AgentRefundResponse{
		RequestId: result.RequestID, RedemptionIds: result.RedemptionIDs,
		Fee: service.FormatAgentPoints(result.Fee), Refunded: service.FormatAgentPoints(result.Refunded),
		BalanceAfter: service.FormatAgentPoints(result.BalanceAfter),
	}
}

func GetAgentOrders(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	query, ok := parseAgentOrderQuery(c, page, false)
	if !ok {
		return
	}
	records, total, err := service.ListAgentOrders(c.GetInt("id"), query)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, records)
}

func GetAgentCodes(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	query, ok := parseAgentCodeQuery(c, page, false)
	if !ok {
		return
	}
	records, total, err := service.ListAgentCodes(c.GetInt("id"), query)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, records)
}

func GetAgentCreditLogs(c *gin.Context) {
	page, ok := parseAgentQueryPage(c)
	if !ok {
		return
	}
	startTimestamp, endTimestamp, ok := parseAgentTimeRange(c)
	if !ok {
		return
	}
	records, total, err := service.ListAgentCreditLogs(c.GetInt("id"), service.AgentCreditLogQuery{
		EventType: c.Query("event_type"), StartTimestamp: startTimestamp,
		EndTimestamp: endTimestamp, Offset: page.Offset, Limit: page.PageSize,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}
	writeAgentQueryPage(c, page, total, records)
}

func ExportAgentCodes(c *gin.Context) {
	query, ok := parseAgentCodeQuery(c, agentQueryPage{}, false)
	if !ok {
		return
	}
	query.AgentUserID = c.GetInt("id")
	filename := "agent-codes-" + time.Now().UTC().Format("20060102-150405") + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	if err := service.ExportAgentCodes(c.Writer, query); err != nil {
		// ExportAgentCodes validates ownership, active status, and the maximum
		// row count before writing. Restore JSON headers for those safe errors.
		if !c.Writer.Written() {
			c.Writer.Header().Del("Content-Disposition")
			c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
			writeAgentError(c, err)
			return
		}
		common.SysError("agent code export failed after response started: " + err.Error())
	}
}

func parseAgentQueryPage(c *gin.Context) (agentQueryPage, bool) {
	page := 1
	pageSize := common.ItemsPerPage
	if value := c.Query("p"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			common.ApiErrorMsg(c, "invalid pagination parameters")
			return agentQueryPage{}, false
		}
		page = parsed
	}
	if value := c.Query("page_size"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			common.ApiErrorMsg(c, "invalid pagination parameters")
			return agentQueryPage{}, false
		}
		pageSize = min(parsed, 100)
	}
	if page-1 > math.MaxInt/pageSize {
		common.ApiErrorMsg(c, "invalid pagination parameters")
		return agentQueryPage{}, false
	}
	return agentQueryPage{Page: page, PageSize: pageSize, Offset: (page - 1) * pageSize}, true
}

func parseAgentOrderQuery(c *gin.Context, page agentQueryPage, allowAgentFilter bool) (service.AgentOrderQuery, bool) {
	planID, ok := parseAgentOptionalPositiveInt(c, "plan_id")
	if !ok {
		return service.AgentOrderQuery{}, false
	}
	agentUserID := 0
	if allowAgentFilter {
		agentUserID, ok = parseAgentOptionalPositiveInt(c, "agent_user_id")
		if !ok {
			return service.AgentOrderQuery{}, false
		}
	}
	startTimestamp, endTimestamp, ok := parseAgentTimeRange(c)
	if !ok {
		return service.AgentOrderQuery{}, false
	}
	return service.AgentOrderQuery{
		AgentUserID: agentUserID, PlanID: planID, Status: c.Query("status"),
		StartTimestamp: startTimestamp, EndTimestamp: endTimestamp,
		Offset: page.Offset, Limit: page.PageSize,
	}, true
}

func parseAgentCodeQuery(c *gin.Context, page agentQueryPage, allowAgentFilter bool) (service.AgentCodeQuery, bool) {
	planID, ok := parseAgentOptionalPositiveInt(c, "plan_id")
	if !ok {
		return service.AgentCodeQuery{}, false
	}
	orderID, ok := parseAgentOptionalPositiveInt(c, "order_id")
	if !ok {
		return service.AgentCodeQuery{}, false
	}
	agentUserID := 0
	if allowAgentFilter {
		agentUserID, ok = parseAgentOptionalPositiveInt(c, "agent_user_id")
		if !ok {
			return service.AgentCodeQuery{}, false
		}
	}
	startTimestamp, endTimestamp, ok := parseAgentTimeRange(c)
	if !ok {
		return service.AgentCodeQuery{}, false
	}
	return service.AgentCodeQuery{
		AgentUserID: agentUserID, PlanID: planID, OrderID: orderID, Status: c.Query("status"),
		StartTimestamp: startTimestamp, EndTimestamp: endTimestamp,
		Offset: page.Offset, Limit: page.PageSize,
	}, true
}

func parseAgentOptionalPositiveInt(c *gin.Context, name string) (int, bool) {
	value := c.Query(name)
	if value == "" {
		return 0, true
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		common.ApiErrorMsg(c, "invalid "+name)
		return 0, false
	}
	return parsed, true
}

func parseAgentTimeRange(c *gin.Context) (int64, int64, bool) {
	var startTimestamp int64
	var endTimestamp int64
	if value := c.Query("start_timestamp"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed < 0 {
			common.ApiErrorMsg(c, "invalid start_timestamp")
			return 0, 0, false
		}
		startTimestamp = parsed
	}
	if value := c.Query("end_timestamp"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed < 0 {
			common.ApiErrorMsg(c, "invalid end_timestamp")
			return 0, 0, false
		}
		endTimestamp = parsed
	}
	if endTimestamp != 0 && endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "end_timestamp must not be earlier than start_timestamp")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

func writeAgentQueryPage(c *gin.Context, page agentQueryPage, total int64, records any) {
	common.ApiSuccess(c, gin.H{
		"page": page.Page, "page_size": page.PageSize,
		"total": total, "items": records,
	})
}

func writeAgentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAgentFeatureDisabled):
		common.ApiErrorMsg(c, "agent workspace is disabled")
	case errors.Is(err, service.ErrAgentAccountNotFound):
		common.ApiErrorMsg(c, "agent account not found")
	case errors.Is(err, service.ErrAgentAccountDisabled):
		common.ApiErrorMsg(c, "agent account is disabled")
	case errors.Is(err, service.ErrAgentPurchaseInvalidQuantity):
		common.ApiErrorMsg(c, "quantity must be between 1 and 100")
	case errors.Is(err, service.ErrAgentPurchaseInvalidRequest):
		common.ApiErrorMsg(c, "plan and idempotency key are required")
	case errors.Is(err, service.ErrAgentOfferUnavailable):
		common.ApiErrorMsg(c, "agent offer is unavailable")
	case errors.Is(err, service.ErrAgentPlanUnavailable):
		common.ApiErrorMsg(c, "subscription plan is unavailable")
	case errors.Is(err, service.ErrAgentInsufficientBalance):
		common.ApiErrorMsg(c, "agent balance is insufficient")
	case errors.Is(err, service.ErrAgentDailyLimitExceeded):
		common.ApiErrorMsg(c, "daily code purchase limit exceeded")
	case errors.Is(err, service.ErrAgentIdempotencyConflict):
		common.ApiErrorMsg(c, "idempotency key was already used for a different request")
	case errors.Is(err, service.ErrAgentAccountConflict):
		common.ApiErrorMsg(c, "agent account changed concurrently; please retry")
	case errors.Is(err, service.ErrAgentQueryInvalid), errors.Is(err, service.ErrAgentCustomerQuery):
		common.ApiErrorMsg(c, "invalid agent query parameters")
	case errors.Is(err, service.ErrAgentExportLimitExceeded):
		common.ApiErrorMsg(c, "code export exceeds the 10000 row limit")
	case errors.Is(err, service.ErrAgentRefundInvalidRequest), errors.Is(err, service.ErrAgentRefundUnavailable):
		common.ApiErrorMsg(c, "package codes are unavailable for refund")
	case errors.Is(err, service.ErrAgentLedgerMismatch):
		common.ApiErrorMsg(c, "agent ledger is inconsistent; financial operations are temporarily unavailable")
	default:
		common.SysError("agent operation failed: " + err.Error())
		common.ApiErrorMsg(c, "agent operation failed")
	}
}
