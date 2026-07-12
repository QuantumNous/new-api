package model

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const InviteRebateStatusGranted = "granted"

// maxInviteTopupRebateQuota hard-caps a single rebate grant to limit blast radius
// if ratio/topup values are misconfigured. 1e12 quota units is far above normal top-ups.
const maxInviteTopupRebateQuota = 1_000_000_000_000

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

// maskInviteeLabel reduces username/display leakage on inviter dashboards.
// Keeps first rune and length-based stars (e.g. "alice" → "a***").
func maskInviteeLabel(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	r := []rune(s)
	if len(r) == 1 {
		return "*"
	}
	if len(r) == 2 {
		return string(r[0]) + "*"
	}
	return string(r[0]) + strings.Repeat("*", min(len(r)-1, 6))
}

func CalculateInviteTopupRebate(topupQuota int, ratioBp int) int {
	if topupQuota <= 0 || ratioBp <= 0 {
		return 0
	}
	// Overflow-safe: int64 multiply before divide.
	tq := int64(topupQuota)
	rb := int64(ratioBp)
	if rb > 0 && tq > math.MaxInt64/rb {
		return 0
	}
	v := tq * rb / 10000
	if v <= 0 {
		return 0
	}
	if v > maxInviteTopupRebateQuota {
		return maxInviteTopupRebateQuota
	}
	if v > int64(math.MaxInt) {
		return math.MaxInt
	}
	return int(v)
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique_violation") ||
		strings.Contains(msg, "constraint failed") ||
		strings.Contains(msg, "unique index")
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
	// Refuse mismatched caller context (defense-in-depth against bad hooks).
	if topUp.UserId != 0 && topUp.UserId != inviteeId {
		common.SysError(fmt.Sprintf(
			"invite topup rebate skipped: topup user_id=%d != invitee_id=%d topup_id=%d",
			topUp.UserId, inviteeId, topUp.Id,
		))
		return nil
	}
	db := tx
	if db == nil {
		db = DB
	}

	// Snapshot ratio under no lock; per-grant snapshot is stored on the ledger row.
	ratioBp := common.InviteTopupRebateRatioBp
	if ratioBp < 0 {
		ratioBp = 0
	}
	if ratioBp > 10000 {
		ratioBp = 10000
	}
	rebate := CalculateInviteTopupRebate(topupQuota, ratioBp)
	if rebate <= 0 {
		return nil
	}

	var invitee User
	if err := db.Select("id", "inviter_id", "status").First(&invitee, inviteeId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if invitee.Status != common.UserStatusEnabled {
		return nil
	}
	if invitee.InviterId <= 0 || invitee.InviterId == inviteeId {
		return nil
	}

	var inviter User
	if err := db.Select("id", "status").First(&inviter, invitee.InviterId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysError(fmt.Sprintf("invite topup rebate skipped: inviter %d not found for invitee %d topup %d", invitee.InviterId, inviteeId, topUp.Id))
			return nil
		}
		return err
	}
	// Do not credit disabled/banned inviters (prevents parking rewards on disabled accounts).
	if inviter.Status != common.UserStatusEnabled {
		common.SysError(fmt.Sprintf(
			"invite topup rebate skipped: inviter %d status=%d invitee=%d topup=%d",
			inviter.Id, inviter.Status, inviteeId, topUp.Id,
		))
		return nil
	}

	granted := false
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
				// already granted for this topup
				return nil
			}
			return err
		}
		// Only credit enabled inviter (re-check status under same tx when possible).
		res := tx.Model(&User{}).
			Where("id = ? AND status = ?", invitee.InviterId, common.UserStatusEnabled).
			Updates(map[string]interface{}{
				"aff_quota":   gorm.Expr("aff_quota + ?", rebate),
				"aff_history": gorm.Expr("aff_history + ?", rebate),
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			// Inviter became disabled between read and update: remove ledger row to avoid orphan grants.
			_ = tx.Delete(&InviteRebate{}, "id = ?", row.Id).Error
			return nil
		}
		granted = true
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

	if granted {
		// Log only on first successful grant (webhook retries must not spam).
		// RecordLog may touch cache/redis; never let logging fail the grant path.
		func() {
			defer func() {
				if rec := recover(); rec != nil {
					common.SysError(fmt.Sprintf("invite rebate RecordLog panic: %v", rec))
				}
			}()
			RecordLog(invitee.InviterId, LogTypeSystem, fmt.Sprintf(
				"邀请充值返佣 %s（被邀请用户 #%d，订单 %s，基数 %s，比例 %d bp）",
				logger.LogQuota(rebate), inviteeId, topUp.TradeNo, logger.LogQuota(topupQuota), ratioBp,
			))
		}()
	}
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
		stat := InviteeRebateStat{
			InviteeId:   u.Id,
			Username:    maskInviteeLabel(u.Username),
			DisplayName: maskInviteeLabel(u.DisplayName),
		}
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


// creditedQuotaForTopUp estimates the quota actually added for a successful top-up,
// matching the formulas used by each recharge path.
func creditedQuotaForTopUp(topUp *TopUp) int {
	if topUp == nil {
		return 0
	}
	switch topUp.PaymentProvider {
	case PaymentProviderStripe:
		// Stripe stores Money as USD amount after group ratio; credit = Money * QuotaPerUnit
		v := topUp.Money * common.QuotaPerUnit
		if v <= 0 {
			return 0
		}
		if v > float64(maxInviteTopupRebateQuota) {
			return maxInviteTopupRebateQuota
		}
		return int(v)
	case PaymentProviderCreem:
		// Creem credits Amount directly as quota units
		if topUp.Amount <= 0 {
			return 0
		}
		if topUp.Amount > int64(maxInviteTopupRebateQuota) {
			return maxInviteTopupRebateQuota
		}
		return int(topUp.Amount)
	default:
		// epay / waffo / waffo_pancake / admin-complete non-stripe: Amount * QuotaPerUnit
		v := float64(topUp.Amount) * common.QuotaPerUnit
		if v <= 0 {
			return 0
		}
		if v > float64(maxInviteTopupRebateQuota) {
			return maxInviteTopupRebateQuota
		}
		return int(v)
	}
}

// BackfillMissingInviteTopupRebates scans successful top-ups without a rebate
// ledger row and attempts GrantInviteTopupRebate. Safe to re-run (unique topup_id).
// Returns processed top-up count and newly granted count.
func BackfillMissingInviteTopupRebates(limit int) (scanned int, granted int, err error) {
	if !common.InviteTopupRebateEnabled {
		return 0, 0, nil
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	// Find success topups that have no invite_rebates row yet.
	// LEFT JOIN keeps this efficient and avoids loading huge result sets.
	type row struct {
		Id              int
		UserId          int
		Amount          int64
		Money           float64
		TradeNo         string
		PaymentProvider string
	}
	var rows []row
	err = DB.Table("top_ups").
		Select("top_ups.id, top_ups.user_id, top_ups.amount, top_ups.money, top_ups.trade_no, top_ups.payment_provider").
		Joins("LEFT JOIN invite_rebates ON invite_rebates.topup_id = top_ups.id").
		Where("top_ups.status = ? AND invite_rebates.id IS NULL", common.TopUpStatusSuccess).
		Order("top_ups.id asc").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return 0, 0, err
	}

	for _, r := range rows {
		scanned++
		topUp := &TopUp{
			Id:              r.Id,
			UserId:          r.UserId,
			Amount:          r.Amount,
			Money:           r.Money,
			TradeNo:         r.TradeNo,
			PaymentProvider: r.PaymentProvider,
			Status:          common.TopUpStatusSuccess,
		}
		quota := creditedQuotaForTopUp(topUp)
		if quota <= 0 {
			continue
		}
		// Count existing rebate for this topup before grant to detect new grants.
		var before int64
		_ = DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&before).Error
		if gerr := GrantInviteTopupRebate(nil, topUp.UserId, quota, topUp); gerr != nil {
			common.SysError(fmt.Sprintf("invite rebate backfill failed topup_id=%d user_id=%d err=%q", topUp.Id, topUp.UserId, gerr.Error()))
			continue
		}
		var after int64
		_ = DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&after).Error
		if after > before {
			granted++
		}
	}
	return scanned, granted, nil
}


// InviteRebateLeaderboardEntry is a public-safe leaderboard row.
// Username/DisplayName are masked; no emails or raw aff codes.
type InviteRebateLeaderboardEntry struct {
	Rank           int    `json:"rank"`
	UserId         int    `json:"user_id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	InviteeCount   int64  `json:"invitee_count"`
	RebateQuotaSum int64  `json:"rebate_quota_sum"`
	TopupQuotaSum  int64  `json:"topup_quota_sum"`
	IsMe           bool   `json:"is_me"`
}

// ListInviteRebateLeaderboard returns top inviters by rebate sum or invitee count.
// by: "rebate" (default) or "invitees". limit capped to 100.
func ListInviteRebateLeaderboard(by string, limit int, viewerId int) (items []InviteRebateLeaderboardEntry, myRank int, err error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	order := "rebate_quota_sum DESC, invitee_count DESC, user_id ASC"
	if by == "invitees" {
		order = "invitee_count DESC, rebate_quota_sum DESC, user_id ASC"
	}

	// Aggregate from users (invitee_count) left join rebate sums.
	// Only users who invited at least one person OR earned rebate appear.
	type row struct {
		UserId         int
		Username       string
		DisplayName    string
		InviteeCount   int64
		RebateQuotaSum int64
		TopupQuotaSum  int64
	}
	var rows []row
	// Use subquery for invitee counts + rebate aggregates.
	sql := `
SELECT u.id AS user_id,
       u.username AS username,
       u.display_name AS display_name,
       COALESCE(ic.cnt, 0) AS invitee_count,
       COALESCE(rs.rebate_quota_sum, 0) AS rebate_quota_sum,
       COALESCE(rs.topup_quota_sum, 0) AS topup_quota_sum
FROM users u
LEFT JOIN (
  SELECT inviter_id, COUNT(*) AS cnt FROM users WHERE inviter_id > 0 AND deleted_at IS NULL GROUP BY inviter_id
) ic ON ic.inviter_id = u.id
LEFT JOIN (
  SELECT inviter_id,
         COALESCE(SUM(rebate_quota),0) AS rebate_quota_sum,
         COALESCE(SUM(topup_quota),0) AS topup_quota_sum
  FROM invite_rebates
  GROUP BY inviter_id
) rs ON rs.inviter_id = u.id
WHERE u.deleted_at IS NULL
  AND u.status = ?
  AND (COALESCE(ic.cnt,0) > 0 OR COALESCE(rs.rebate_quota_sum,0) > 0)
ORDER BY ` + order + `
LIMIT ?`
	err = DB.Raw(sql, common.UserStatusEnabled, limit).Scan(&rows).Error
	if err != nil {
		return
	}
	items = make([]InviteRebateLeaderboardEntry, 0, len(rows))
	for i, r := range rows {
		isMe := viewerId > 0 && r.UserId == viewerId
		entry := InviteRebateLeaderboardEntry{
			Rank: i + 1,
			// Privacy: only reveal raw user_id for the viewer themselves.
			UserId:         0,
			Username:       maskInviteeLabel(r.Username),
			DisplayName:    maskInviteeLabel(r.DisplayName),
			InviteeCount:   r.InviteeCount,
			RebateQuotaSum: r.RebateQuotaSum,
			TopupQuotaSum:  r.TopupQuotaSum,
			IsMe:           isMe,
		}
		if isMe {
			entry.UserId = r.UserId
		}
		if entry.IsMe {
			myRank = entry.Rank
		}
		items = append(items, entry)
	}

	// If viewer not in top list, compute their rank separately (optional nicety).
	if viewerId > 0 && myRank == 0 {
		type meRow struct {
			InviteeCount   int64
			RebateQuotaSum int64
		}
		var me meRow
		_ = DB.Raw(`
SELECT COALESCE((SELECT COUNT(*) FROM users WHERE inviter_id = ? AND deleted_at IS NULL),0) AS invitee_count,
       COALESCE((SELECT SUM(rebate_quota) FROM invite_rebates WHERE inviter_id = ?),0) AS rebate_quota_sum
`, viewerId, viewerId).Scan(&me).Error
		if me.InviteeCount > 0 || me.RebateQuotaSum > 0 {
			// Count how many rank strictly above me
			var better int64
			if by == "invitees" {
				_ = DB.Raw(`
SELECT COUNT(*) FROM (
  SELECT u.id,
         COALESCE(ic.cnt,0) AS invitee_count,
         COALESCE(rs.rebate_quota_sum,0) AS rebate_quota_sum
  FROM users u
  LEFT JOIN (SELECT inviter_id, COUNT(*) AS cnt FROM users WHERE inviter_id > 0 AND deleted_at IS NULL GROUP BY inviter_id) ic ON ic.inviter_id = u.id
  LEFT JOIN (SELECT inviter_id, COALESCE(SUM(rebate_quota),0) AS rebate_quota_sum FROM invite_rebates GROUP BY inviter_id) rs ON rs.inviter_id = u.id
  WHERE u.deleted_at IS NULL AND u.status = ?
    AND (COALESCE(ic.cnt,0) > 0 OR COALESCE(rs.rebate_quota_sum,0) > 0)
) t
WHERE t.invitee_count > ? OR (t.invitee_count = ? AND t.rebate_quota_sum > ?) OR (t.invitee_count = ? AND t.rebate_quota_sum = ? AND t.id < ?)
`, common.UserStatusEnabled, me.InviteeCount, me.InviteeCount, me.RebateQuotaSum, me.InviteeCount, me.RebateQuotaSum, viewerId).Scan(&better).Error
			} else {
				_ = DB.Raw(`
SELECT COUNT(*) FROM (
  SELECT u.id,
         COALESCE(ic.cnt,0) AS invitee_count,
         COALESCE(rs.rebate_quota_sum,0) AS rebate_quota_sum
  FROM users u
  LEFT JOIN (SELECT inviter_id, COUNT(*) AS cnt FROM users WHERE inviter_id > 0 AND deleted_at IS NULL GROUP BY inviter_id) ic ON ic.inviter_id = u.id
  LEFT JOIN (SELECT inviter_id, COALESCE(SUM(rebate_quota),0) AS rebate_quota_sum FROM invite_rebates GROUP BY inviter_id) rs ON rs.inviter_id = u.id
  WHERE u.deleted_at IS NULL AND u.status = ?
    AND (COALESCE(ic.cnt,0) > 0 OR COALESCE(rs.rebate_quota_sum,0) > 0)
) t
WHERE t.rebate_quota_sum > ? OR (t.rebate_quota_sum = ? AND t.invitee_count > ?) OR (t.rebate_quota_sum = ? AND t.invitee_count = ? AND t.id < ?)
`, common.UserStatusEnabled, me.RebateQuotaSum, me.RebateQuotaSum, me.InviteeCount, me.RebateQuotaSum, me.InviteeCount, viewerId).Scan(&better).Error
			}
			myRank = int(better) + 1
		}
	}
	return
}
