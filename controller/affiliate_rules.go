package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type affiliateRuleSetStatusRequest struct {
	Reason string `json:"reason"`
}

func AdminListAffiliateRuleSets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	ruleSets, total, err := service.ListAffiliateRuleSets(model.DB, service.AffiliateRuleSetListInput{
		Status:   c.Query("status"),
		StartIdx: pageInfo.GetStartIdx(),
		PageSize: pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(ruleSets)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetAffiliateRuleSetDefaultSeed(c *gin.Context) {
	seed := service.BuildDefaultAffiliateRuleSetDraftInput(c.Query("version"), c.GetInt("id"), "")
	common.ApiSuccess(c, seed)
}

func AdminSaveAffiliateRuleSetDraft(c *gin.Context) {
	var req service.AffiliateRuleSetDraftInput
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.ActorUserId = c.GetInt("id")

	ruleSet, err := service.SaveAffiliateRuleSetDraft(model.DB, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ruleSet)
}

func AdminPublishAffiliateRuleSet(c *gin.Context) {
	ruleSetId, err := strconv.Atoi(c.Param("id"))
	if err != nil || ruleSetId <= 0 {
		common.ApiErrorMsg(c, "无效的规则集ID")
		return
	}

	var req affiliateRuleSetStatusRequest
	if c.Request != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			common.ApiErrorMsg(c, "参数错误")
			return
		}
	}

	ruleSet, err := service.PublishAffiliateRuleSet(model.DB, ruleSetId, service.AffiliateRuleSetStatusInput{
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ruleSet)
}

func AdminArchiveAffiliateRuleSet(c *gin.Context) {
	ruleSetId, err := strconv.Atoi(c.Param("id"))
	if err != nil || ruleSetId <= 0 {
		common.ApiErrorMsg(c, "无效的规则集ID")
		return
	}

	var req affiliateRuleSetStatusRequest
	if c.Request != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			common.ApiErrorMsg(c, "参数错误")
			return
		}
	}

	ruleSet, err := service.ArchiveAffiliateRuleSet(model.DB, ruleSetId, service.AffiliateRuleSetStatusInput{
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ruleSet)
}

func AdminRollbackAffiliateRuleSetToDraft(c *gin.Context) {
	ruleSetId, err := strconv.Atoi(c.Param("id"))
	if err != nil || ruleSetId <= 0 {
		common.ApiErrorMsg(c, "无效的规则集ID")
		return
	}

	var req service.AffiliateRuleSetRollbackInput
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.ActorUserId = c.GetInt("id")

	ruleSet, err := service.RollbackAffiliateRuleSetToDraft(model.DB, ruleSetId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ruleSet)
}
