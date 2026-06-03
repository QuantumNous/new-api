package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type affiliateSettlementGenerateRequest struct {
	RuleSetId   int    `json:"rule_set_id"`
	PeriodStart int64  `json:"period_start"`
	PeriodEnd   int64  `json:"period_end"`
	FreezeDays  int    `json:"freeze_days"`
	Reason      string `json:"reason"`
}

type affiliateSettlementRunRequest struct {
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	FreezeDays      int     `json:"freeze_days"`
	DryRun          bool    `json:"dry_run"`
	Now             int64   `json:"now"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDExchangeRate float64 `json:"usd_exchange_rate"`
	Reason          string  `json:"reason"`
}

type affiliateSettlementPaidRequest struct {
	PaidAt           int64  `json:"paid_at"`
	PaymentReference string `json:"payment_reference"`
	Reason           string `json:"reason"`
}

type affiliateCommissionAdjustmentRequest struct {
	AffiliateUserId  int    `json:"affiliate_user_id"`
	DownstreamUserId int    `json:"downstream_user_id"`
	RuleSetId        int    `json:"rule_set_id"`
	PeriodStart      int64  `json:"period_start"`
	PeriodEnd        int64  `json:"period_end"`
	CommissionCents  int64  `json:"commission_cents"`
	Reason           string `json:"reason"`
}

type affiliateCommissionVoidRequest struct {
	Reason string `json:"reason"`
}

type affiliateCommissionRecomputeRequest struct {
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDExchangeRate float64 `json:"usd_exchange_rate"`
	Reason          string  `json:"reason"`
}

func AdminListAffiliateCommissions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	affiliateUserId, _ := strconv.Atoi(c.Query("affiliate_user_id"))
	ruleSetId, _ := strconv.Atoi(c.Query("rule_set_id"))
	downstreamUserId, _ := strconv.Atoi(c.Query("downstream_user_id"))
	settlementId, _ := strconv.Atoi(c.Query("settlement_id"))
	periodStart, _ := strconv.ParseInt(c.Query("period_start"), 10, 64)
	periodEnd, _ := strconv.ParseInt(c.Query("period_end"), 10, 64)

	events, total, err := service.ListAffiliateCommissionEvents(model.DB, service.AffiliateCommissionEventListInput{
		Scope: service.AffiliateScope{
			Kind:   service.AffiliateScopeGlobal,
			UserId: c.GetInt("id"),
		},
		AffiliateUserId:  affiliateUserId,
		RuleSetId:        ruleSetId,
		DownstreamUserId: downstreamUserId,
		SettlementId:     settlementId,
		Status:           c.Query("status"),
		Kind:             c.Query("kind"),
		PeriodStart:      periodStart,
		PeriodEnd:        periodEnd,
		StartIdx:         pageInfo.GetStartIdx(),
		PageSize:         pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(events)
	common.ApiSuccess(c, pageInfo)
}

func AdminCreateAffiliateCommissionAdjustment(c *gin.Context) {
	var req affiliateCommissionAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	event, err := service.CreateAffiliateManualCommissionAdjustment(model.DB, service.AffiliateManualCommissionAdjustmentInput{
		AffiliateUserId:  req.AffiliateUserId,
		DownstreamUserId: req.DownstreamUserId,
		RuleSetId:        req.RuleSetId,
		PeriodStart:      req.PeriodStart,
		PeriodEnd:        req.PeriodEnd,
		CommissionCents:  req.CommissionCents,
		ActorUserId:      c.GetInt("id"),
		Reason:           req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, event)
}

func AdminVoidAffiliateCommissionEvent(c *gin.Context) {
	eventId, ok := parseAffiliateCommissionEventId(c)
	if !ok {
		return
	}

	var req affiliateCommissionVoidRequest
	if c.Request != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			common.ApiErrorMsg(c, "参数错误")
			return
		}
	}
	event, err := service.VoidAffiliateCommissionEvent(model.DB, eventId, service.AffiliateCommissionEventVoidInput{
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, event)
}

func AdminRecomputeAffiliateCommissions(c *gin.Context) {
	var req affiliateCommissionRecomputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	result, err := service.RecomputeAffiliatePendingCommissionEvents(model.DB, model.LOG_DB, service.AffiliateCommissionRecomputeInput{
		RuleSetId:       req.RuleSetId,
		PeriodStart:     req.PeriodStart,
		PeriodEnd:       req.PeriodEnd,
		QuotaPerUnit:    req.QuotaPerUnit,
		USDExchangeRate: req.USDExchangeRate,
		ActorUserId:     c.GetInt("id"),
		Reason:          req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func AdminListAffiliateSettlements(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	affiliateUserId, _ := strconv.Atoi(c.Query("affiliate_user_id"))
	ruleSetId, _ := strconv.Atoi(c.Query("rule_set_id"))
	periodStart, _ := strconv.ParseInt(c.Query("period_start"), 10, 64)
	periodEnd, _ := strconv.ParseInt(c.Query("period_end"), 10, 64)

	settlements, total, err := service.ListAffiliateSettlements(model.DB, service.AffiliateSettlementListInput{
		Scope: service.AffiliateScope{
			Kind:   service.AffiliateScopeGlobal,
			UserId: c.GetInt("id"),
		},
		AffiliateUserId: affiliateUserId,
		RuleSetId:       ruleSetId,
		Status:          c.Query("status"),
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		StartIdx:        pageInfo.GetStartIdx(),
		PageSize:        pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(settlements)
	common.ApiSuccess(c, pageInfo)
}

func AdminGenerateAffiliateSettlements(c *gin.Context) {
	var req affiliateSettlementGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	settlements, _, err := service.GenerateAffiliateSettlementsWithJobRun(model.DB, service.AffiliateSettlementBuildInput{
		RuleSetId:   req.RuleSetId,
		PeriodStart: req.PeriodStart,
		PeriodEnd:   req.PeriodEnd,
		FreezeDays:  req.FreezeDays,
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, settlements)
}

func AdminRunAffiliateSettlementPipeline(c *gin.Context) {
	var req affiliateSettlementRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	result, err := service.RunAffiliateSettlementPipeline(model.DB, model.LOG_DB, service.AffiliateSettlementRunInput{
		RuleSetId:       req.RuleSetId,
		PeriodStart:     req.PeriodStart,
		PeriodEnd:       req.PeriodEnd,
		FreezeDays:      req.FreezeDays,
		DryRun:          req.DryRun,
		Now:             req.Now,
		QuotaPerUnit:    req.QuotaPerUnit,
		USDExchangeRate: req.USDExchangeRate,
		ActorUserId:     c.GetInt("id"),
		Reason:          req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func AdminFreezeAffiliateSettlement(c *gin.Context) {
	settlementId, ok := parseAffiliateSettlementId(c)
	if !ok {
		return
	}

	var req affiliateRuleSetStatusRequest
	if c.Request != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			common.ApiErrorMsg(c, "参数错误")
			return
		}
	}

	settlement, err := service.FreezeAffiliateSettlement(model.DB, settlementId, service.AffiliateSettlementStatusInput{
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, settlement)
}

func AdminVoidAffiliateSettlement(c *gin.Context) {
	settlementId, ok := parseAffiliateSettlementId(c)
	if !ok {
		return
	}

	var req affiliateRuleSetStatusRequest
	if c.Request != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			common.ApiErrorMsg(c, "参数错误")
			return
		}
	}

	settlement, err := service.VoidAffiliateSettlement(model.DB, settlementId, service.AffiliateSettlementStatusInput{
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, settlement)
}

func AdminMarkAffiliateSettlementPaid(c *gin.Context) {
	settlementId, ok := parseAffiliateSettlementId(c)
	if !ok {
		return
	}

	var req affiliateSettlementPaidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	settlement, err := service.MarkAffiliateSettlementPaid(model.DB, settlementId, service.AffiliateSettlementPaidInput{
		ActorUserId:      c.GetInt("id"),
		PaidAt:           req.PaidAt,
		PaymentReference: req.PaymentReference,
		Reason:           req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, settlement)
}

func parseAffiliateCommissionEventId(c *gin.Context) (int, bool) {
	eventId, err := strconv.Atoi(c.Param("id"))
	if err != nil || eventId <= 0 {
		common.ApiErrorMsg(c, "无效的佣金事件ID")
		return 0, false
	}
	return eventId, true
}

func parseAffiliateSettlementId(c *gin.Context) (int, bool) {
	settlementId, err := strconv.Atoi(c.Param("id"))
	if err != nil || settlementId <= 0 {
		common.ApiErrorMsg(c, "无效的结算单ID")
		return 0, false
	}
	return settlementId, true
}
