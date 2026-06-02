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

type affiliateSettlementPaidRequest struct {
	PaidAt           int64  `json:"paid_at"`
	PaymentReference string `json:"payment_reference"`
	Reason           string `json:"reason"`
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

	settlements, err := service.GenerateAffiliateSettlements(model.DB, service.AffiliateSettlementBuildInput{
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

func parseAffiliateSettlementId(c *gin.Context) (int, bool) {
	settlementId, err := strconv.Atoi(c.Param("id"))
	if err != nil || settlementId <= 0 {
		common.ApiErrorMsg(c, "无效的结算单ID")
		return 0, false
	}
	return settlementId, true
}
