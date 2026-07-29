package controller

import (
	"errors"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	defaultInvitationPage     = 1
	defaultInvitationPageSize = 10
	maxInvitationPageSize     = 100
)

type invitationSummary struct {
	RewardMode            string  `json:"reward_mode"` // "topup" (legacy)
	InviterRewardUSD      float64 `json:"inviter_reward_usd"`
	InviteeRewardUSD      float64 `json:"invitee_reward_usd"`
	InviterRewardMaxCount int     `json:"inviter_reward_max_count"`
	HistoryUSD            float64 `json:"history_usd"`
	PendingRewardUSD      float64 `json:"pending_reward_usd"`
	TransferableUSD       float64 `json:"transferable_usd"`
	GrantedCount          int     `json:"granted_count"`
	PendingCount          int64   `json:"pending_count"`
	TransferEnabled       bool    `json:"transfer_enabled"`
}

type invitationSubscriptionSummary struct {
	RewardMode            string  `json:"reward_mode"`
	AvailableDiscountUSD  float64 `json:"available_discount_usd"`
	LifetimeDiscountUSD   float64 `json:"lifetime_discount_usd"`
	InviterRewardUSD      float64 `json:"inviter_reward_usd"`
	InviteeRewardUSD      float64 `json:"invitee_reward_usd"`
	InviterRewardMaxCount int     `json:"inviter_reward_max_count"`
	GrantedCount          int     `json:"granted_count"`
	PendingCount          int64   `json:"pending_count"`
}

type invitationRecord struct {
	Id             int     `json:"id"`
	MaskedIdentity string  `json:"masked_identity"`
	RegisteredAt   int64   `json:"registered_at"`
	Status         string  `json:"status"`
	GrantedAt      int64   `json:"granted_at"`
	RewardUSD      float64 `json:"reward_usd"`
	Reason         string  `json:"reason"`
}

type invitationResponse struct {
	Summary  any                `json:"summary"`
	Items    []invitationRecord `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"page_size"`
	Total    int64              `json:"total"`
}

func invitationUSDFromQuota(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func invitationQuotaFromUSD(amountUSD float64) (int, error) {
	if math.IsNaN(amountUSD) || math.IsInf(amountUSD, 0) || amountUSD < 1 || common.QuotaPerUnit <= 0 {
		return 0, errors.New("invalid USD amount")
	}
	quota := math.Round(amountUSD * common.QuotaPerUnit)
	if quota > float64(math.MaxInt) {
		return 0, errors.New("USD amount is too large")
	}
	return int(quota), nil
}

func invitationPendingRewardUSD(pendingCount int64, grantedCount int, maxCount int, rewardQuota int) float64 {
	if pendingCount <= 0 || rewardQuota <= 0 {
		return 0
	}

	eligibleCount := pendingCount
	if maxCount > 0 {
		remainingCount := maxCount - grantedCount
		if remainingCount <= 0 {
			return 0
		}
		if eligibleCount > int64(remainingCount) {
			eligibleCount = int64(remainingCount)
		}
	}

	return float64(eligibleCount) * invitationUSDFromQuota(rewardQuota)
}

func invitationRecordsFromModel(records []model.InvitationRecord) []invitationRecord {
	items := make([]invitationRecord, 0, len(records))
	for _, record := range records {
		items = append(items, invitationRecord{
			Id:             record.Id,
			MaskedIdentity: record.MaskedIdentity,
			RegisteredAt:   record.RegisteredAt,
			Status:         record.Status,
			GrantedAt:      record.GrantedAt,
			RewardUSD:      invitationUSDFromQuota(record.RewardQuota),
			Reason:         record.Reason,
		})
	}
	return items
}

func getInvitationPagination(c *gin.Context) (int, int) {
	page := defaultInvitationPage
	canonicalPageValid := false
	if rawPage, exists := c.GetQuery("page"); exists {
		if parsedPage, err := strconv.Atoi(rawPage); err == nil && parsedPage > 0 {
			page = parsedPage
			canonicalPageValid = true
		}
	}
	if !canonicalPageValid {
		if rawPage, exists := c.GetQuery("p"); exists {
			if parsedPage, err := strconv.Atoi(rawPage); err == nil && parsedPage > 0 {
				page = parsedPage
			}
		}
	}

	pageSize := defaultInvitationPageSize
	if rawPageSize, exists := c.GetQuery("page_size"); exists {
		if parsedPageSize, err := strconv.Atoi(rawPageSize); err == nil && parsedPageSize > 0 {
			pageSize = parsedPageSize
		}
	}
	if pageSize > maxInvitationPageSize {
		pageSize = maxInvitationPageSize
	}
	if page-1 > math.MaxInt/pageSize {
		page = defaultInvitationPage
	}

	return page, pageSize
}

func GetSelfInvitations(c *gin.Context) {
	page, pageSize := getInvitationPagination(c)
	userId := c.GetInt("id")
	var migrationErr error
	if common.InviteRewardSubscriptionMode {
		migrationErr = model.MigrateUserLegacyInvitationValueToSubscriptionDiscount(userId)
	} else {
		migrationErr = model.MigrateUserLegacyAffQuotaToQuota(userId)
	}
	if migrationErr != nil {
		common.ApiError(c, migrationErr)
		return
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	invitationPage, err := model.GetInvitationPage(user.Id, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var summary any
	if common.InviteRewardSubscriptionMode {
		discountSummary, err := model.GetSubscriptionDiscountSummary(user.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		summary = invitationSubscriptionSummary{
			RewardMode:            "subscription",
			AvailableDiscountUSD:  discountSummary.AvailableDiscountUSD,
			LifetimeDiscountUSD:   discountSummary.LifetimeDiscountUSD,
			InviterRewardUSD:      invitationUSDFromQuota(common.QuotaForInviter),
			InviteeRewardUSD:      common.InviteFirstSubDiscountUSD,
			InviterRewardMaxCount: common.QuotaForInviterMaxCount,
			GrantedCount:          user.AffCount,
			PendingCount:          invitationPage.PendingCount,
		}
	} else {
		summary = invitationSummary{
			RewardMode:            "topup",
			InviterRewardUSD:      invitationUSDFromQuota(common.QuotaForInviter),
			InviteeRewardUSD:      invitationUSDFromQuota(common.QuotaForInvitee),
			InviterRewardMaxCount: common.QuotaForInviterMaxCount,
			HistoryUSD:            invitationUSDFromQuota(user.AffHistoryQuota),
			PendingRewardUSD: invitationPendingRewardUSD(
				invitationPage.PendingCount,
				user.AffCount,
				common.QuotaForInviterMaxCount,
				common.QuotaForInviter,
			),
			TransferableUSD: invitationUSDFromQuota(user.AffQuota),
			GrantedCount:    user.AffCount,
			PendingCount:    invitationPage.PendingCount,
			TransferEnabled: operation_setting.IsPaymentComplianceConfirmed(),
		}
	}

	common.ApiSuccess(c, invitationResponse{
		Summary:  summary,
		Items:    invitationRecordsFromModel(invitationPage.Items),
		Page:     page,
		PageSize: pageSize,
		Total:    invitationPage.Total,
	})
}
