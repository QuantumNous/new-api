package controller

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	nextNewcomerActivityID  = 2
	nextNewcomerActivityKey = "newcomer-v1"
	nextNewcomerReward      = 110000
)

type nextNewcomerTask struct {
	ID       string `json:"id"`
	LabelKey string `json:"labelKey"`
	Reward   int    `json:"reward"`
	Done     bool   `json:"done"`
}

func ensureNextInviteCode(user *model.User) error {
	code, err := model.EnsureAffiliateCode(user.Id)
	if err == nil {
		user.AffCode = code
	}
	return err
}

func ValidateInviteCode(c *gin.Context) {
	var request struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Code) == "" {
		nextBusinessError(c, "邀请码不能为空", "VALIDATION_ERROR")
		return
	}
	if err := model.ValidateAffiliateCode(request.Code); err != nil {
		nextBusinessError(c, err.Error(), "INVALID_INVITE_CODE")
		return
	}
	common.ApiSuccess(c, gin.H{"valid": true, "attribution_days": 30})
}

func NextGetInvite(c *gin.Context) {
	userId := c.GetInt("id")
	if _, err := model.ThawAffiliateQuota(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := ensureNextInviteCode(user); err != nil {
		common.ApiError(c, err)
		return
	}

	invitees := make([]model.User, 0)
	if err := model.DB.Select("id", "username", "created_at").
		Where("inviter_id = ?", user.Id).
		Order("created_at desc").Find(&invitees).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	type inviteeRewardRow struct {
		InviteeId   int
		RewardTotal int64
		LastPaidAt  int64
	}
	rewardRows := make([]inviteeRewardRow, 0)
	if err := model.DB.Model(&model.AffiliateLedger{}).
		Select("invitee_id, COALESCE(SUM(reward_quota), 0) AS reward_total, MAX(created_at) AS last_paid_at").
		Where("user_id = ? AND action = ?", user.Id, model.AffiliateActionAccrue).
		Group("invitee_id").Find(&rewardRows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	rewardByInvitee := make(map[int]inviteeRewardRow, len(rewardRows))
	for _, row := range rewardRows {
		rewardByInvitee[row.InviteeId] = row
	}
	records := make([]gin.H, 0, len(invitees))
	for _, invitee := range invitees {
		reward := rewardByInvitee[invitee.Id]
		records = append(records, gin.H{
			"id": invitee.Id, "invitee": invitee.Username,
			"created": invitee.CreatedAt, "paid": reward.RewardTotal > 0,
			"reward_total": reward.RewardTotal, "last_paid_at": reward.LastPaidAt,
		})
	}

	now := time.Now()
	monthCounts := make(map[string]int)
	monthRewards := make(map[string]int64)
	for _, invitee := range invitees {
		monthCounts[time.Unix(invitee.CreatedAt, 0).Format("2006-01")]++
	}
	var accruals []model.AffiliateLedger
	if err := model.DB.Select("reward_quota", "created_at").
		Where("user_id = ? AND action = ?", user.Id, model.AffiliateActionAccrue).
		Find(&accruals).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	for _, accrual := range accruals {
		monthRewards[time.Unix(accrual.CreatedAt, 0).Format("2006-01")] += accrual.RewardQuota
	}
	series := make([]gin.H, 0, 6)
	cumulative := len(invitees)
	for offset := 5; offset >= 0; offset-- {
		month := now.AddDate(0, -offset, 0).Format("2006-01")
		newCount := monthCounts[month]
		if offset == 5 {
			cumulative = 0
			for _, invitee := range invitees {
				if time.Unix(invitee.CreatedAt, 0).Format("2006-01") <= month {
					cumulative++
				}
			}
		} else {
			cumulative += newCount
		}
		series = append(series, gin.H{"month": month, "new_count": newCount, "cumulative": cumulative, "reward": monthRewards[month]})
	}
	var remainingInvites any
	if user.AffInviteLimit != nil {
		remaining := *user.AffInviteLimit - len(invitees)
		if remaining < 0 {
			remaining = 0
		}
		remainingInvites = remaining
	}

	common.ApiSuccess(c, gin.H{
		"code": user.AffCode, "invited": len(invitees),
		"code_enabled": user.AffCodeEnabled, "invite_limit": user.AffInviteLimit,
		"remaining_invites":      remainingInvites,
		"effective_rate_bps":     model.EffectiveAffiliateRateBps(user),
		"effective_rate_percent": float64(model.EffectiveAffiliateRateBps(user)) / 100,
		"available_reward":       user.AffQuota, "frozen_reward": user.AffFrozenQuota,
		"total_reward":      user.AffHistoryQuota,
		"reward_per_invite": 0,
		"reward_total":      user.AffHistoryQuota, "transferable": user.AffQuota,
		"policy": gin.H{
			"enabled": common.AffiliateEnabled, "activated_at": common.AffiliateActivatedAt,
			"registration_required": common.AffiliateRegistrationRequired,
			"freeze_hours":          common.AffiliateFreezeHours, "duration_days": common.AffiliateDurationDays,
			"per_invitee_cap": common.AffiliatePerInviteeCap, "cash_withdrawal": false,
		},
		"monthly_series": series, "records": records,
	})
}

func NextTransferInviteQuota(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var request struct {
		Amount int `json:"amount"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || request.Amount <= 0 {
		nextBusinessError(c, "invalid transfer amount", "VALIDATION_ERROR")
		return
	}
	transferred, balance, err := model.TransferAffiliateQuota(c.GetInt("id"), request.Amount)
	if err != nil {
		nextBusinessError(c, err.Error(), "TRANSFER_FAILED")
		return
	}
	user, err := model.GetUserById(c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"message": "已转入账户余额", "transferred": transferred,
		"balance": balance, "remaining_reward": user.AffQuota,
	})
}

func nextStreaks(records []model.Checkin, now time.Time) (current, best int) {
	dates := make(map[string]bool, len(records))
	for _, record := range records {
		dates[record.CheckinDate] = true
	}
	start := now
	if !dates[start.Format("2006-01-02")] {
		start = start.AddDate(0, 0, -1)
	}
	for dates[start.Format("2006-01-02")] {
		current++
		start = start.AddDate(0, 0, -1)
	}
	ordered := make([]time.Time, 0, len(dates))
	for value := range dates {
		date, err := time.ParseInLocation("2006-01-02", value, now.Location())
		if err == nil {
			ordered = append(ordered, date)
		}
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Before(ordered[j]) })
	run := 0
	for index, date := range ordered {
		if index == 0 || date.Sub(ordered[index-1]) == 24*time.Hour {
			run++
		} else {
			run = 1
		}
		if run > best {
			best = run
		}
	}
	return current, best
}

func nextNewcomerTasks(user *model.User) ([]nextNewcomerTask, bool, error) {
	var tokenCount int64
	if err := model.DB.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&tokenCount).Error; err != nil {
		return nil, false, err
	}
	var topupCount int64
	if err := model.DB.Model(&model.TopUp{}).
		Where("user_id = ? AND status = ?", user.Id, common.TopUpStatusSuccess).
		Count(&topupCount).Error; err != nil {
		return nil, false, err
	}
	tasks := []nextNewcomerTask{
		{ID: "first-key", LabelKey: "activity.newcomer.taskFirstKey", Reward: 20000, Done: tokenCount > 0},
		{ID: "first-call", LabelKey: "activity.newcomer.taskFirstCall", Reward: 30000, Done: user.RequestCount > 0},
		{ID: "profile", LabelKey: "activity.newcomer.taskProfile", Reward: 10000, Done: user.DisplayName != "" && user.Email != ""},
		{ID: "topup", LabelKey: "activity.newcomer.taskTopup", Reward: 50000, Done: topupCount > 0},
	}
	allDone := true
	for _, task := range tasks {
		allDone = allDone && task.Done
	}
	return tasks, allDone, nil
}

func nextActivityPayload(user *model.User) (gin.H, error) {
	now := time.Now()
	allCheckins, err := model.GetUserCheckinRecords(user.Id, "1970-01-01", now.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	currentStreak, bestStreak := nextStreaks(allCheckins, now)
	monthStart := now.Format("2006-01") + "-01"
	monthRecords, err := model.GetUserCheckinRecords(user.Id, monthStart, now.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	totalReward := 0
	monthReward := 0
	for _, record := range allCheckins {
		totalReward += record.QuotaAwarded
	}
	for _, record := range monthRecords {
		monthReward += record.QuotaAwarded
	}
	todayClaimed, err := model.HasCheckedInToday(user.Id)
	if err != nil {
		return nil, err
	}
	setting := operation_setting.GetCheckinSetting()
	days := make([]gin.H, 0, 7)
	for index := 0; index < 7; index++ {
		reward := setting.MinQuota
		if setting.MaxQuota > setting.MinQuota {
			reward += (setting.MaxQuota - setting.MinQuota) * index / 6
		}
		days = append(days, gin.H{"done": index < currentStreak%7, "reward": reward})
	}
	weekStart := now.AddDate(0, 0, -((int(now.Weekday()) + 6) % 7))
	weekRecords, err := model.GetUserCheckinRecords(user.Id, weekStart.Format("2006-01-02"), weekStart.AddDate(0, 0, 6).Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	weekMap := make(map[string]int, len(weekRecords))
	for _, record := range weekRecords {
		weekMap[record.CheckinDate] = record.QuotaAwarded
	}
	weekEntries := make([]gin.H, 0, 7)
	for index := 0; index < 7; index++ {
		date := weekStart.AddDate(0, 0, index)
		reward, claimed := weekMap[date.Format("2006-01-02")]
		weekEntries = append(weekEntries, gin.H{
			"date": date.Format("01/02"), "weekday": strings.ToUpper(date.Format("Mon")),
			"reward": reward, "claimed": claimed, "today": date.Format("2006-01-02") == now.Format("2006-01-02"),
		})
	}
	monthEndDay := now.AddDate(0, 1, -now.Day()).Day()
	tasks, tasksDone, err := nextNewcomerTasks(user)
	if err != nil {
		return nil, err
	}
	newcomerClaimed, err := model.HasActivityClaim(user.Id, nextNewcomerActivityKey)
	if err != nil {
		return nil, err
	}
	activities := make([]gin.H, 0, 3)
	if setting.Enabled {
		activities = append(activities, gin.H{
			"id": 1, "kind": "checkin", "title": "每日签到", "tagline": "每日签到领取额度奖励",
			"status": "ongoing", "gradient": "accent", "badgeKey": "hot", "start": now.AddDate(0, -1, 0).Unix(), "end": now.AddDate(0, 1, 0).Unix(),
			"icon": "M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
			"checkin": gin.H{
				"days": days, "todayClaimed": todayClaimed, "streak": currentStreak,
				"total_days": len(allCheckins), "month_days": len(monthRecords), "month_days_total": monthEndDay,
				"total_reward": totalReward, "month_reward": monthReward, "best_streak": bestStreak, "week_entries": weekEntries,
			},
		})
	}
	invitedCount, err := model.CountInvitedUsers(model.DB, user.Id)
	if err != nil {
		return nil, err
	}
	activities = append(activities,
		gin.H{
			"id": nextNewcomerActivityID, "kind": "newcomer", "title": "新人礼包", "tagline": "完成新手任务后领取奖励",
			"status": "ongoing", "gradient": "signal", "badgeKey": "new", "start": user.CreatedAt, "end": now.AddDate(1, 0, 0).Unix(),
			"icon":     "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z",
			"newcomer": gin.H{"tasks": tasks, "claimed": newcomerClaimed},
		},
		gin.H{
			"id": 4, "kind": "invite", "title": "邀请返利", "tagline": "受邀用户真实付费后按比例获得返利",
			"status": "ongoing", "gradient": "signal", "start": user.CreatedAt, "end": now.AddDate(10, 0, 0).Unix(),
			"icon": "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 8v6M22 11h-6",
			"invite": gin.H{
				"invited": invitedCount, "reward_total": user.AffHistoryQuota,
				"available_reward": user.AffQuota, "frozen_reward": user.AffFrozenQuota,
				"effective_rate_percent": float64(model.EffectiveAffiliateRateBps(user)) / 100,
			},
		},
	)
	claimable := 0
	if setting.Enabled && !todayClaimed {
		claimable++
	}
	if tasksDone && !newcomerClaimed {
		claimable++
	}
	var claimedReward int64
	if err := model.DB.Model(&model.ActivityClaim{}).Where("user_id = ?", user.Id).
		Select("COALESCE(SUM(reward), 0)").Scan(&claimedReward).Error; err != nil {
		return nil, err
	}
	return gin.H{
		"activities": activities,
		"summary":    gin.H{"claimable": claimable, "reward_earned": totalReward + int(claimedReward) + user.AffHistoryQuota, "ongoing": len(activities)},
	}, nil
}

func NextGetActivities(c *gin.Context) {
	userId := c.GetInt("id")
	if _, err := model.ThawAffiliateQuota(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	payload, err := nextActivityPayload(user)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, payload)
}

func NextCheckin(c *gin.Context) {
	if !operation_setting.GetCheckinSetting().Enabled {
		nextBusinessError(c, "签到功能未启用", "ACTIVITY_DISABLED")
		return
	}
	checkin, err := model.UserCheckin(c.GetInt("id"))
	if err != nil {
		nextBusinessError(c, err.Error(), "CHECKIN_FAILED")
		return
	}
	recordUserSystemAudit(c, c.GetInt("id"), "user.checkin", map[string]interface{}{
		"quota": checkin.QuotaAwarded,
	})
	now := time.Now()
	records, recordsErr := model.GetUserCheckinRecords(c.GetInt("id"), "1970-01-01", now.Format("2006-01-02"))
	streak := 0
	if recordsErr != nil {
		common.SysError(fmt.Sprintf("failed to load check-in streak for user %d: %v", c.GetInt("id"), recordsErr))
	} else {
		streak, _ = nextStreaks(records, now)
	}
	common.ApiSuccess(c, gin.H{"reward": checkin.QuotaAwarded, "streak": streak})
}

func NextClaimActivity(c *gin.Context) {
	var request struct {
		ActivityID int `json:"activity_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || request.ActivityID != nextNewcomerActivityID {
		nextBusinessError(c, "activity does not support claiming", "VALIDATION_ERROR")
		return
	}
	user, err := model.GetUserById(c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_, allDone, err := nextNewcomerTasks(user)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !allDone {
		nextBusinessError(c, "complete all newcomer tasks before claiming", "TASKS_INCOMPLETE")
		return
	}
	if err := model.ClaimActivityReward(user.Id, nextNewcomerActivityKey, nextNewcomerReward); err != nil {
		nextBusinessError(c, err.Error(), "CLAIM_FAILED")
		return
	}
	common.ApiSuccess(c, gin.H{"message": "领取成功", "reward": nextNewcomerReward})
}
