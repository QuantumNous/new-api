package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type cashbackCampaignCreateRequest struct {
	StartAt           int64  `json:"start_at"`
	EndAt             int64  `json:"end_at"`
	MaxRewardsPerUser int    `json:"max_rewards_per_user"`
	PayerScope        string `json:"payer_scope"`
}

func ListCashbackCampaigns(c *gin.Context) {
	campaigns, err := model.ListCashbackCampaigns()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, campaigns)
}

func CreateCashbackCampaign(c *gin.Context) {
	var request cashbackCampaignCreateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		cashbackAPIError(c, http.StatusBadRequest, err)
		return
	}
	campaign, err := model.CreateCashbackCampaign(request.StartAt, request.EndAt, request.MaxRewardsPerUser, c.GetInt("id"), request.PayerScope)
	if err != nil {
		cashbackAPIError(c, cashbackErrorStatus(err), err)
		return
	}
	recordManageAudit(c, "cashback.campaign_create", map[string]any{
		"campaign_id": campaign.ID, "start_at": campaign.StartAt,
		"end_at": campaign.EndAt, "max_rewards_per_user": campaign.MaxRewardsPerUser,
		"payer_scope": campaign.PayerScope,
	})
	common.ApiSuccess(c, campaign)
}

func StopCashbackCampaign(c *gin.Context) {
	id, err := parseCashbackPathID(c.Param("id"))
	if err != nil {
		cashbackAPIError(c, http.StatusBadRequest, err)
		return
	}
	campaign, err := model.StopCashbackCampaign(id, c.GetInt("id"))
	if err != nil {
		cashbackAPIError(c, cashbackErrorStatus(err), err)
		return
	}
	recordManageAudit(c, "cashback.campaign_stop", map[string]any{
		"campaign_id": campaign.ID, "stopped_at": campaign.StoppedAt,
	})
	common.ApiSuccess(c, campaign)
}
