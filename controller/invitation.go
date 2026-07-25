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
	RewardMode            string  `json:"reward_mode"` // "topup" (legacy) | "subscription" (v2 fixed reward on first subscription)
	FirstSubDiscountUSD   float64 `json:"first_sub_discount_usd"`
	UnlockDelayDays       int64   `json:"unlock_delay_days"`
	InviterRewardUSD      float64 `json:"inviter_reward_usd"`
	InviteeRewardUSD      float64 `json:"invitee_reward_usd"`
	InviterRewardMaxCount int     `json:"inviter_reward_max_count"`
	HistoryUSD            float64 `json:"history_usd"`
	PendingRewardUSD      float64 `json:"pending_reward_usd"`
	LockedRewardUSD       float64 `json:"locked_reward_usd"`
	TransferableUSD       float64 `json:"transferable_usd"`
	GrantedCount          int     `json:"granted_count"`
	PendingCount          int64   `json:"pending_count"`
	TransferEnabled       bool    `json:"transfer_enabled"`
}

type invitationRecord struct {
	Id             int     `json:"id"`
	MaskedIdentity string  `json:"masked_identity"`
	RegisteredAt   int64   `json:"registered_at"`
	Status         string  `json:"status"`
	GrantedAt      int64   `json:"granted_at"`
	RewardUSD      float64 `json:"reward_usd"`
	Reason         string  `json:"reason"`
	UnlockAt       int64   `json:"unlock_at"`
}

type invitationResponse struct {
	Summary  invitationSummary  `json:"summary"`
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
			UnlockAt:       record.UnlockAt,
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
	if err := model.MigrateUserLegacyAffQuotaToQuota(userId); err != nil {
		common.ApiError(c, err)
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

	rewardMode := "topup"
	lockedRewardUSD := 0.0
	if common.InviteRewardSubscriptionMode {
		rewardMode = "subscription"
		lockedQuota, err := model.SumLockedInviteSubscriptionRewardQuota(user.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if lockedQuota > 0 && lockedQuota <= math.MaxInt {
			lockedRewardUSD = invitationUSDFromQuota(int(lockedQuota))
		}
	}

	common.ApiSuccess(c, invitationResponse{
		Summary: invitationSummary{
			RewardMode:            rewardMode,
			FirstSubDiscountUSD:   common.InviteFirstSubDiscountUSD,
			UnlockDelayDays:       common.InviteRewardUnlockDelaySeconds / 86400,
			LockedRewardUSD:       lockedRewardUSD,
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
		},
		Items:    invitationRecordsFromModel(invitationPage.Items),
		Page:     page,
		PageSize: pageSize,
		Total:    invitationPage.Total,
	})
}
