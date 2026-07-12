package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const InviteRebateStatusGranted = "granted"

type InviteRebate struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	InviterId   int    `json:"inviter_id" gorm:"index;not null"`
	InviteeId   int    `json:"invitee_id" gorm:"index;not null"`
	TopupId     int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	TradeNo     string `json:"trade_no" gorm:"type:varchar(255);index"`
	TopupQuota  int    `json:"topup_quota" gorm:"not null"`
	RebateQuota int    `json:"rebate_quota" gorm:"not null"`
	RatioBp     int    `json:"ratio_bp" gorm:"not null"`
	Status      string `json:"status" gorm:"type:varchar(32);not null;default:'granted'"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
}

func (InviteRebate) TableName() string { return "invite_rebates" }

type InviteeRebateStat struct {
	InviteeId      int    `json:"invitee_id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	TopupQuotaSum  int64  `json:"topup_quota_sum"`
	RebateQuotaSum int64  `json:"rebate_quota_sum"`
	RebateCount    int64  `json:"rebate_count"`
}

func CalculateInviteTopupRebate(topupQuota int, ratioBp int) int {
	if topupQuota <= 0 || ratioBp <= 0 {
		return 0
	}
	return topupQuota * ratioBp / 10000
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique_violation") ||
		strings.Contains(msg, "constraint failed")
}

// GrantInviteTopupRebate credits inviter aff_quota for one successful top-up.
// tx may be nil (uses DB). Idempotent on topup_id.
func GrantInviteTopupRebate(tx *gorm.DB, inviteeId int, topupQuota int, topUp *TopUp) error {
	if !common.InviteTopupRebateEnabled {
		return nil
	}
	if topupQuota <= 0 || topUp == nil || topUp.Id == 0 {
		return nil
	}
	db := tx
	if db == nil {
		db = DB
	}

	ratioBp := common.InviteTopupRebateRatioBp
	rebate := CalculateInviteTopupRebate(topupQuota, ratioBp)
	if rebate <= 0 {
		return nil
	}

	var invitee User
	if err := db.Select("id", "inviter_id").First(&invitee, inviteeId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == inviteeId {
		return nil
	}

	run := func(tx *gorm.DB) error {
		row := &InviteRebate{
			InviterId:   invitee.InviterId,
			InviteeId:   inviteeId,
			TopupId:     topUp.Id,
			TradeNo:     topUp.TradeNo,
			TopupQuota:  topupQuota,
			RebateQuota: rebate,
			RatioBp:     ratioBp,
			Status:      InviteRebateStatusGranted,
			CreatedAt:   common.GetTimestamp(),
		}
		if err := tx.Create(row).Error; err != nil {
			if isDuplicateKeyError(err) {
				return nil
			}
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", invitee.InviterId).Updates(map[string]interface{}{
			"aff_quota":   gorm.Expr("aff_quota + ?", rebate),
			"aff_history": gorm.Expr("aff_history + ?", rebate),
		}).Error; err != nil {
			return err
		}
		return nil
	}

	var err error
	if tx != nil {
		err = run(tx)
	} else {
		err = DB.Transaction(run)
	}
	if err != nil {
		return err
	}

	// Log outside caller concerns; ignore log failures
	RecordLog(invitee.InviterId, LogTypeSystem, fmt.Sprintf(
		"邀请充值返佣 %s（被邀请用户 #%d，订单 %s，基数 %s，比例 %d bp）",
		logger.LogQuota(rebate), inviteeId, topUp.TradeNo, logger.LogQuota(topupQuota), ratioBp,
	))
	return nil
}

func GetInviteRebateSummaryForInviter(inviterId int) (inviteeCount int64, topupQuotaSum int64, rebateQuotaSum int64, err error) {
	err = DB.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&inviteeCount).Error
	if err != nil {
		return
	}
	type sumRow struct {
		TopupQuotaSum  int64
		RebateQuotaSum int64
	}
	var s sumRow
	err = DB.Model(&InviteRebate{}).
		Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum").
		Where("inviter_id = ?", inviterId).
		Scan(&s).Error
	topupQuotaSum = s.TopupQuotaSum
	rebateQuotaSum = s.RebateQuotaSum
	return
}

func ListInviteRebatesForInviter(inviterId int, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error) {
	q := DB.Model(&InviteRebate{}).Where("inviter_id = ?", inviterId)
	if err = q.Count(&total).Error; err != nil {
		return
	}
	err = q.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return
}

func ListInviteesWithRebateStats(inviterId int, pageInfo *common.PageInfo) (items []InviteeRebateStat, total int64, err error) {
	if err = DB.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&total).Error; err != nil {
		return
	}
	// Page invitees, then attach aggregates
	var users []User
	err = DB.Select("id", "username", "display_name").
		Where("inviter_id = ?", inviterId).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&users).Error
	if err != nil {
		return
	}
	items = make([]InviteeRebateStat, 0, len(users))
	for _, u := range users {
		stat := InviteeRebateStat{InviteeId: u.Id, Username: u.Username, DisplayName: u.DisplayName}
		type sumRow struct {
			TopupQuotaSum  int64
			RebateQuotaSum int64
			RebateCount    int64
		}
		var s sumRow
		_ = DB.Model(&InviteRebate{}).
			Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum, COUNT(*) as rebate_count").
			Where("inviter_id = ? AND invitee_id = ?", inviterId, u.Id).
			Scan(&s).Error
		stat.TopupQuotaSum = s.TopupQuotaSum
		stat.RebateQuotaSum = s.RebateQuotaSum
		stat.RebateCount = s.RebateCount
		items = append(items, stat)
	}
	return
}

func ListAllInviteRebates(inviterId, inviteeId int, start, end int64, pageInfo *common.PageInfo) (items []*InviteRebate, total int64, err error) {
	q := DB.Model(&InviteRebate{})
	if inviterId > 0 {
		q = q.Where("inviter_id = ?", inviterId)
	}
	if inviteeId > 0 {
		q = q.Where("invitee_id = ?", inviteeId)
	}
	if start > 0 {
		q = q.Where("created_at >= ?", start)
	}
	if end > 0 {
		q = q.Where("created_at <= ?", end)
	}
	if err = q.Count(&total).Error; err != nil {
		return
	}
	err = q.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return
}

func GetInviteRebateAdminSummary(inviterId int) (topupQuotaSum int64, rebateQuotaSum int64, rowCount int64, err error) {
	q := DB.Model(&InviteRebate{})
	if inviterId > 0 {
		q = q.Where("inviter_id = ?", inviterId)
	}
	if err = q.Count(&rowCount).Error; err != nil {
		return
	}
	type sumRow struct {
		TopupQuotaSum  int64
		RebateQuotaSum int64
	}
	var s sumRow
	sq := DB.Model(&InviteRebate{}).
		Select("COALESCE(SUM(topup_quota),0) as topup_quota_sum, COALESCE(SUM(rebate_quota),0) as rebate_quota_sum")
	if inviterId > 0 {
		sq = sq.Where("inviter_id = ?", inviterId)
	}
	err = sq.Scan(&s).Error
	topupQuotaSum = s.TopupQuotaSum
	rebateQuotaSum = s.RebateQuotaSum
	return
}
