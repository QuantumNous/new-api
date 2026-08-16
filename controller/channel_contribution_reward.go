package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type channelContributionRewardTransferInput struct {
	Amount int `json:"amount"`
}

type channelContributionRewardEntryResponse struct {
	Id             int64  `json:"id"`
	UserId         int    `json:"user_id"`
	ContributionId int    `json:"contribution_id"`
	ChannelId      int    `json:"channel_id"`
	RequestId      string `json:"request_id"`
	EntryType      string `json:"entry_type"`
	Amount         int64  `json:"amount"`
	BalanceAfter   int64  `json:"balance_after"`
	SourceQuota    int    `json:"source_quota"`
	RewardBps      int    `json:"reward_bps"`
	CreatedAt      int64  `json:"created_at"`
}

func buildChannelContributionRewardEntries(entries []*model.ChannelContributionRewardLedger) []channelContributionRewardEntryResponse {
	response := make([]channelContributionRewardEntryResponse, 0, len(entries))
	for _, entry := range entries {
		if entry == nil {
			continue
		}
		response = append(response, channelContributionRewardEntryResponse{
			Id:             entry.Id,
			UserId:         entry.UserId,
			ContributionId: entry.ContributionId,
			ChannelId:      entry.ChannelId,
			RequestId:      entry.RequestId,
			EntryType:      entry.EntryType,
			Amount:         entry.Amount,
			BalanceAfter:   entry.BalanceAfter,
			SourceQuota:    entry.SourceQuota,
			RewardBps:      entry.RewardBps,
			CreatedAt:      entry.CreatedAt,
		})
	}
	return response
}

func GetChannelContributionRewards(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	account, err := model.GetChannelContributionRewardAccount(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	entries, total, err := model.ListChannelContributionRewardLedger(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"account": account,
		"items":   buildChannelContributionRewardEntries(entries),
		"total":   total,
	})
}

func ListChannelContributionRewardTransfers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	entries, total, err := model.ListChannelContributionRewardTransfers(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": buildChannelContributionRewardEntries(entries),
		"total": total,
	})
}

func TransferChannelContributionReward(c *gin.Context) {
	var input channelContributionRewardTransferInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	entry, err := model.TransferChannelContributionReward(c.GetInt("id"), input.Amount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	entries := buildChannelContributionRewardEntries([]*model.ChannelContributionRewardLedger{entry})
	common.ApiSuccess(c, entries[0])
}
