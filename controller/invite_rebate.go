package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetSelfInviteRebateSummary(c *gin.Context) {
	userId := c.GetInt("id")
	inviteeCount, topupSum, rebateSum, err := model.GetInviteRebateSummaryForInviter(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"invitee_count":     inviteeCount,
		"topup_quota_sum":   topupSum,
		"rebate_quota_sum":  rebateSum,
		"aff_quota":         user.AffQuota,
		"aff_history_quota": user.AffHistoryQuota,
		"enabled":           common.InviteTopupRebateEnabled,
		"ratio_bp":          common.InviteTopupRebateRatioBp,
	})
}

func GetSelfInviteRebateLogs(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListInviteRebatesForInviter(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfInviteRebateInvitees(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListInviteesWithRebateStats(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAdminInviteRebates(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	inviterId, _ := strconv.Atoi(c.Query("inviter_id"))
	inviteeId, _ := strconv.Atoi(c.Query("invitee_id"))
	start, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	end, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	items, total, err := model.ListAllInviteRebates(inviterId, inviteeId, start, end, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAdminInviteRebateSummary(c *gin.Context) {
	inviterId, _ := strconv.Atoi(c.Query("inviter_id"))
	topupSum, rebateSum, rowCount, err := model.GetInviteRebateAdminSummary(inviterId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"topup_quota_sum":  topupSum,
		"rebate_quota_sum": rebateSum,
		"row_count":        rowCount,
		"enabled":          common.InviteTopupRebateEnabled,
		"ratio_bp":         common.InviteTopupRebateRatioBp,
	})
}
