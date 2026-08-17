package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type affiliateUserConfigRequest struct {
	Code             *string `json:"code"`
	CodeEnabled      *bool   `json:"code_enabled"`
	RateBps          *int    `json:"rate_bps"`
	ClearRate        bool    `json:"clear_rate"`
	InviteLimit      *int    `json:"invite_limit"`
	ClearInviteLimit bool    `json:"clear_invite_limit"`
}

func affiliateUserPayload(user *model.User) (gin.H, error) {
	count, err := model.CountInvitedUsers(model.DB, user.Id)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"id": user.Id, "username": user.Username, "status": user.Status,
		"code": user.AffCode, "code_enabled": user.AffCodeEnabled,
		"code_custom": user.AffCodeCustom, "rate_bps": user.AffRebateRateBps,
		"effective_rate_bps": model.EffectiveAffiliateRateBps(user),
		"invite_limit":       user.AffInviteLimit, "invited_count": count,
		"available_reward": user.AffQuota, "frozen_reward": user.AffFrozenQuota,
		"total_reward": user.AffHistoryQuota,
	}, nil
}

func NextListAffiliateUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Model(&model.User{}).
		Where("aff_code_custom = ? OR aff_rebate_rate_bps IS NOT NULL OR aff_invite_limit IS NOT NULL OR aff_code_enabled = ?", true, false)
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR aff_code LIKE ?", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var users []model.User
	if err := query.Omit("password", "access_token").Order("id desc").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]gin.H, 0, len(users))
	for i := range users {
		item, err := affiliateUserPayload(&users[i])
		if err != nil {
			common.ApiError(c, err)
			return
		}
		items = append(items, item)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func NextGetAffiliateUser(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		nextBusinessError(c, "invalid user id", "VALIDATION_ERROR")
		return
	}
	target, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canManageTargetRole(c.GetInt("role"), target.Role) {
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
		return
	}
	if _, err := model.ThawAffiliateQuota(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	target, err = model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	payload, err := affiliateUserPayload(target)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, payload)
}

func NextUpdateAffiliateUser(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		nextBusinessError(c, "invalid user id", "VALIDATION_ERROR")
		return
	}
	var request affiliateUserConfigRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		nextBusinessError(c, "invalid affiliate settings", "VALIDATION_ERROR")
		return
	}
	target, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canManageTargetRole(c.GetInt("role"), target.Role) {
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
		return
	}
	if request.RateBps != nil && (*request.RateBps < 0 || *request.RateBps > 10000) {
		nextBusinessError(c, "rate_bps must be between 0 and 10000", "VALIDATION_ERROR")
		return
	}
	if request.InviteLimit != nil && *request.InviteLimit < 0 {
		nextBusinessError(c, "invite_limit cannot be negative", "VALIDATION_ERROR")
		return
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		updates := make(map[string]any)
		if request.Code != nil {
			code, err := model.NormalizeCustomAffiliateCode(*request.Code)
			if err != nil {
				return err
			}
			var count int64
			if err := tx.Unscoped().Model(&model.User{}).Where("aff_code = ? AND id <> ?", code, userId).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return errors.New("邀请码已存在")
			}
			updates["aff_code"] = code
			updates["aff_code_custom"] = true
		}
		if request.CodeEnabled != nil {
			updates["aff_code_enabled"] = *request.CodeEnabled
		}
		if request.ClearRate {
			updates["aff_rebate_rate_bps"] = nil
		} else if request.RateBps != nil {
			updates["aff_rebate_rate_bps"] = *request.RateBps
		}
		if request.ClearInviteLimit {
			updates["aff_invite_limit"] = nil
		} else if request.InviteLimit != nil {
			updates["aff_invite_limit"] = *request.InviteLimit
		}
		if len(updates) == 0 {
			return errors.New("未提供可更新的邀请配置")
		}
		return tx.Model(&model.User{}).Where("id = ?", userId).Updates(updates).Error
	})
	if err != nil {
		nextBusinessError(c, err.Error(), "AFFILIATE_UPDATE_FAILED")
		return
	}
	recordManageAuditFor(c, userId, "affiliate.user.update", map[string]interface{}{"user_id": userId})
	updated, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id": updated.Id, "code": updated.AffCode, "code_enabled": updated.AffCodeEnabled,
		"code_custom": updated.AffCodeCustom, "rate_bps": updated.AffRebateRateBps,
		"effective_rate_bps": model.EffectiveAffiliateRateBps(updated), "invite_limit": updated.AffInviteLimit,
	})
}

func NextResetAffiliateCode(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		nextBusinessError(c, "invalid user id", "VALIDATION_ERROR")
		return
	}
	target, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canManageTargetRole(c.GetInt("role"), target.Role) {
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
		return
	}
	var code string
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		generated, err := model.GenerateUniqueAffiliateCodeTx(tx)
		if err != nil {
			return err
		}
		code = generated
		return tx.Model(&model.User{}).Where("id = ?", userId).Updates(map[string]any{
			"aff_code": code, "aff_code_custom": false, "aff_code_enabled": true,
		}).Error
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, userId, "affiliate.code.reset", map[string]interface{}{"user_id": userId})
	common.ApiSuccess(c, gin.H{"id": userId, "code": code})
}

func NextListAffiliateRelationships(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Table("users AS invitees").Where("invitees.inviter_id > 0 AND invitees.deleted_at IS NULL")
	if inviterId := strings.TrimSpace(c.Query("inviter_id")); inviterId != "" {
		query = query.Where("invitees.inviter_id = ?", inviterId)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	type relationshipRow struct {
		InviteeId    int    `json:"invitee_id"`
		Invitee      string `json:"invitee"`
		InviterId    int    `json:"inviter_id"`
		Inviter      string `json:"inviter"`
		RegisteredAt int64  `json:"registered_at"`
		RewardTotal  int64  `json:"reward_total"`
	}
	var rows []relationshipRow
	if err := query.
		Select("invitees.id AS invitee_id, invitees.username AS invitee, invitees.inviter_id, inviters.username AS inviter, invitees.created_at AS registered_at, COALESCE(SUM(affiliate_ledgers.reward_quota), 0) AS reward_total").
		Joins("LEFT JOIN users AS inviters ON inviters.id = invitees.inviter_id").
		Joins("LEFT JOIN affiliate_ledgers ON affiliate_ledgers.invitee_id = invitees.id AND affiliate_ledgers.action = ?", model.AffiliateActionAccrue).
		Group("invitees.id, invitees.username, invitees.inviter_id, inviters.username, invitees.created_at").
		Order("invitees.id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&rows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rows)
	common.ApiSuccess(c, pageInfo)
}

func NextListAffiliateLedgers(c *gin.Context) {
	nextListAffiliateLedgers(c, strings.TrimSpace(c.Query("action")))
}

func NextListAffiliateTransfers(c *gin.Context) {
	nextListAffiliateLedgers(c, model.AffiliateActionTransfer)
}

func nextListAffiliateLedgers(c *gin.Context, action string) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Model(&model.AffiliateLedger{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if userId := strings.TrimSpace(c.Query("user_id")); userId != "" {
		query = query.Where("user_id = ?", userId)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var rows []model.AffiliateLedger
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rows)
	common.ApiSuccess(c, pageInfo)
}

func NextGetAffiliateOverview(c *gin.Context) {
	var invited int64
	if err := model.DB.Model(&model.User{}).Where("inviter_id > 0").Count(&invited).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	type ledgerTotals struct {
		Accrued     int64
		Transferred int64
		Skipped     int64
	}
	var totals ledgerTotals
	if err := model.DB.Model(&model.AffiliateLedger{}).Select(
		"COALESCE(SUM(CASE WHEN action = ? THEN reward_quota ELSE 0 END), 0) AS accrued, "+
			"COALESCE(SUM(CASE WHEN action = ? THEN reward_quota ELSE 0 END), 0) AS transferred, "+
			"COALESCE(SUM(CASE WHEN action = ? THEN 1 ELSE 0 END), 0) AS skipped",
		model.AffiliateActionAccrue, model.AffiliateActionTransfer, model.AffiliateActionSkip,
	).Scan(&totals).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"enabled": common.AffiliateEnabled, "activated_at": common.AffiliateActivatedAt,
		"registration_required": common.AffiliateRegistrationRequired,
		"invited_users":         invited, "accrued_reward": totals.Accrued,
		"transferred_reward": totals.Transferred, "skipped_events": totals.Skipped,
	})
}
