package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type affiliateBalanceTransferRequest struct {
	AmountQuota int64  `json:"amount_quota"`
	CashCents   int64  `json:"cash_cents"`
	RewardID    int    `json:"reward_id"`
	RequestKey  string `json:"request_key"`
}

type affiliateAdjustmentRequest struct {
	AmountQuota int64  `json:"amount_quota" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
	RequestKey  string `json:"request_key"`
}

func GetAffiliateSummary(c *gin.Context) {
	summary, err := model.GetAffiliateSummary(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetAffiliateCampaign(c *gin.Context) {
	campaign, err := model.GetAffiliateCampaign()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, campaign)
}

func GetAffiliateInviteeTopUps(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	startAt, _ := strconv.ParseInt(c.Query("start_at"), 10, 64)
	endAt, _ := strconv.ParseInt(c.Query("end_at"), 10, 64)
	items, total, err := model.GetAffiliateInviteeTopUpsSorted(
		c.GetInt("id"), c.Query("status"), c.Query("keyword"), c.Query("sort"), startAt, endAt,
		pageInfo.GetStartIdx(), pageInfo.GetPageSize(),
	)
	if errors.Is(err, model.ErrAffiliateTopUpsHidden) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateAffiliateBalanceTransfer(c *gin.Context) {
	var request affiliateBalanceTransferRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	requestKey := strings.TrimSpace(request.RequestKey)
	if requestKey == "" {
		requestKey = common.GetUUID()
	}
	var transfer interface{}
	var err error
	if request.CashCents > 0 {
		transfer, err = model.CreateAffiliateCashTransfer(c.GetInt("id"), request.CashCents, requestKey)
	} else if request.RewardID > 0 {
		transfer, err = model.CreateAffiliateRewardBalanceTransfer(c.GetInt("id"), request.RewardID, requestKey)
	} else {
		transfer, err = model.CreateAffiliateBalanceTransfer(c.GetInt("id"), request.AmountQuota, requestKey)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, transfer)
}

func GetAffiliateBalanceTransfers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAffiliateBalanceTransfers(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetAffiliateSettings(c *gin.Context) {
	common.ApiSuccess(c, model.GetGlobalAffiliateSetting())
}

func AdminGetAffiliateCampaign(c *gin.Context) {
	GetAffiliateCampaign(c)
}

func AdminUpdateAffiliateCampaign(c *gin.Context) {
	var request model.AffiliateCampaign
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	campaign, err := model.UpdateAffiliateCampaign(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.campaign.update", map[string]interface{}{
		"enabled": request.Enabled, "starts_at": request.StartsAt, "ends_at": request.EndsAt,
	})
	common.ApiSuccess(c, campaign)
}

func AdminUpdateAffiliateSettings(c *gin.Context) {
	var request operation_setting.AffiliateSetting
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateAffiliateSetting(request); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.settings.update", map[string]interface{}{
		"enabled":            request.Enabled,
		"reward_mode":        request.RewardMode,
		"cashback_frequency": request.CashbackFrequency,
	})
	common.ApiSuccess(c, model.GetGlobalAffiliateSetting())
}

func AdminGetAffiliateUserOverrides(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.SearchUsers(c.Query("keyword"), "", nil, nil, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]*model.AffiliateUserOverrideView, 0, len(users))
	for _, user := range users {
		view, viewErr := model.GetAffiliateUserOverrideView(user.Id)
		if viewErr != nil {
			common.ApiError(c, viewErr)
			return
		}
		items = append(items, view)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetAffiliateUserOverride(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	view, err := model.GetAffiliateUserOverrideView(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, view)
}

func AdminUpdateAffiliateUserOverride(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request model.AffiliateUserOverride
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	view, err := model.SaveAffiliateUserOverride(userID, c.GetInt("id"), request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.user_override.update", map[string]interface{}{
		"user_id":       userID,
		"change_reason": request.ChangeReason,
	})
	common.ApiSuccess(c, view)
}

func AdminDeleteAffiliateUserOverride(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteAffiliateUserOverride(userID); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.user_override.delete", map[string]interface{}{"user_id": userID})
	common.ApiSuccess(c, nil)
}

func AdminGetAffiliateRewards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	startAt, _ := strconv.ParseInt(c.Query("start_at"), 10, 64)
	endAt, _ := strconv.ParseInt(c.Query("end_at"), 10, 64)
	items, total, err := model.GetAffiliateAdminRewards(
		c.Query("keyword"), c.Query("status"), startAt, endAt,
		pageInfo.GetStartIdx(), pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminAdjustAffiliateReward(c *gin.Context) {
	rewardID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request affiliateAdjustmentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	requestKey := strings.TrimSpace(request.RequestKey)
	if requestKey == "" {
		requestKey = common.GetUUID()
	}
	adjustment, err := model.AdjustAffiliateReward(rewardID, c.GetInt("id"), request.AmountQuota, request.Reason, requestKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.reward.adjust", map[string]interface{}{
		"reward_id":    rewardID,
		"amount_quota": request.AmountQuota,
		"status":       adjustment.Status,
	})
	common.ApiSuccess(c, adjustment)
}
