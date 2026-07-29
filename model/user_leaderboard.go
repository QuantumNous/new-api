package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// UserUsageRankEntry is a single row in the usage leaderboard.
type UserUsageRankEntry struct {
	Rank     int    `json:"rank"`
	UserId   int    `json:"user_id"`
	Username string `json:"username"`
	Quota    int64  `json:"quota"`
	Requests int64  `json:"requests"`
	IsSelf   bool   `json:"is_self,omitempty"`
}

// CheckinRankEntry is a single row in the check-in leaderboard.
type CheckinRankEntry struct {
	Rank         int    `json:"rank"`
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	QuotaAwarded int64  `json:"quota_awarded"`
	IsSelf       bool   `json:"is_self,omitempty"`
}

// leaderboardMaxLimit caps the result set to avoid large scans.
const leaderboardMaxLimit = 100

// GetUsageLeaderboard aggregates per-user consumed quota from the log database
// over [startTimestamp, endTimestamp]. Administrators (role >= RoleAdminUser)
// are excluded. A two-step query is used for cross-database compatibility
// (ClickHouse cannot JOIN the users table in the main DB).
func GetUsageLeaderboard(startTimestamp, endTimestamp int64, limit int) ([]UserUsageRankEntry, error) {
	if limit <= 0 || limit > leaderboardMaxLimit {
		limit = leaderboardMaxLimit
	}
	if startTimestamp < 0 || endTimestamp < 0 || endTimestamp < startTimestamp {
		return nil, errors.New("invalid time range")
	}

	type aggregatedRow struct {
		UserId   int   `gorm:"column:user_id"`
		Quota    int64 `gorm:"column:total_quota"`
		Requests int64 `gorm:"column:total_requests"`
	}

	var rows []aggregatedRow
	tx := LOG_DB.Table("logs").
		Select("user_id, COALESCE(SUM(quota), 0) as total_quota, COUNT(*) as total_requests").
		Where("type = ? AND created_at >= ? AND created_at <= ? AND user_id > 0",
			LogTypeConsume, startTimestamp, endTimestamp).
		Group("user_id").
		Order("total_quota DESC").
		Limit(limit * 2)

	if err := tx.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("aggregate usage logs: %w", err)
	}

	if len(rows) == 0 {
		return []UserUsageRankEntry{}, nil
	}

	userIds := make([]int, 0, len(rows))
	for _, r := range rows {
		userIds = append(userIds, r.UserId)
	}

	type userInfo struct {
		Id       int    `gorm:"column:id"`
		Username string `gorm:"column:username"`
		Role     int    `gorm:"column:role"`
	}
	var users []userInfo
	if err := DB.Table("users").
		Select("id, username, role").
		Where("id IN ?", userIds).
		Find(&users).Error; err != nil {
		return nil, fmt.Errorf("load user info for leaderboard: %w", err)
	}

	userMap := make(map[int]userInfo, len(users))
	for _, u := range users {
		userMap[u.Id] = u
	}

	result := make([]UserUsageRankEntry, 0, limit)
	rank := 0
	for _, r := range rows {
		if len(result) >= limit {
			break
		}
		info, ok := userMap[r.UserId]
		if !ok {
			continue
		}
		if info.Role >= common.RoleAdminUser {
			continue
		}
		rank++
		result = append(result, UserUsageRankEntry{
			Rank:     rank,
			UserId:   r.UserId,
			Username: info.Username,
			Quota:    r.Quota,
			Requests: r.Requests,
		})
	}

	return result, nil
}

// GetCheckinLeaderboard aggregates per-user check-in quota for a given date.
// Administrators are excluded.
func GetCheckinLeaderboard(date string, limit int) ([]CheckinRankEntry, error) {
	if limit <= 0 || limit > leaderboardMaxLimit {
		limit = leaderboardMaxLimit
	}
	date = strings.TrimSpace(date)
	if date == "" {
		return nil, errors.New("checkin date is required")
	}

	type aggregatedRow struct {
		UserId       int   `gorm:"column:user_id"`
		QuotaAwarded int64 `gorm:"column:total_quota"`
	}

	var rows []aggregatedRow
	tx := DB.Table("checkins").
		Select("user_id, COALESCE(SUM(quota_awarded), 0) as total_quota").
		Where("checkin_date = ?", date).
		Group("user_id").
		Order("total_quota DESC").
		Limit(limit * 2)

	if err := tx.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("aggregate checkin records: %w", err)
	}

	if len(rows) == 0 {
		return []CheckinRankEntry{}, nil
	}

	userIds := make([]int, 0, len(rows))
	for _, r := range rows {
		userIds = append(userIds, r.UserId)
	}

	type userInfo struct {
		Id       int    `gorm:"column:id"`
		Username string `gorm:"column:username"`
		Role     int    `gorm:"column:role"`
	}
	var users []userInfo
	if err := DB.Table("users").
		Select("id, username, role").
		Where("id IN ?", userIds).
		Find(&users).Error; err != nil {
		return nil, fmt.Errorf("load user info for checkin leaderboard: %w", err)
	}

	userMap := make(map[int]userInfo, len(users))
	for _, u := range users {
		userMap[u.Id] = u
	}

	result := make([]CheckinRankEntry, 0, limit)
	rank := 0
	for _, r := range rows {
		if len(result) >= limit {
			break
		}
		info, ok := userMap[r.UserId]
		if !ok {
			continue
		}
		if info.Role >= common.RoleAdminUser {
			continue
		}
		rank++
		result = append(result, CheckinRankEntry{
			Rank:         rank,
			UserId:       r.UserId,
			Username:     info.Username,
			QuotaAwarded: r.QuotaAwarded,
		})
	}

	return result, nil
}
