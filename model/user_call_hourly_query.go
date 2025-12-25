package model

import (
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"
)

type UserHourlyCallsRankItem struct {
	UserId     int    `json:"user_id"`
	Username   string `json:"username"`
	TotalCalls int64  `json:"total_calls"`
}

func NormalizeHourList(hours []int64) ([]int64, error) {
	if len(hours) == 0 {
		return nil, nil
	}
	out := make([]int64, 0, len(hours))
	seen := make(map[int64]struct{}, len(hours))
	for _, h := range hours {
		if h <= 0 || h%3600 != 0 {
			return nil, fmt.Errorf("hours must be aligned to hour (ts %% 3600 == 0)")
		}
		if _, ok := seen[h]; ok {
			continue
		}
		seen[h] = struct{}{}
		out = append(out, h)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out, nil
}

func GetUserHourlyCallsRank(db *gorm.DB, hours []int64, startHourTs int64, endHourTs int64, limit int) ([]UserHourlyCallsRankItem, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	useHoursList := len(hours) > 0
	if useHoursList {
		var err error
		hours, err = NormalizeHourList(hours)
		if err != nil {
			return nil, err
		}
		if len(hours) == 0 {
			return []UserHourlyCallsRankItem{}, nil
		}
	} else {
		if startHourTs <= 0 || endHourTs <= 0 || endHourTs <= startHourTs {
			return nil, fmt.Errorf("invalid hour range")
		}
		if startHourTs%3600 != 0 || endHourTs%3600 != 0 {
			return nil, fmt.Errorf("start_hour/end_hour must be aligned to hour (ts %% 3600 == 0)")
		}
		// guardrail: 31 days
		if endHourTs-startHourTs > 31*24*3600 {
			return nil, fmt.Errorf("hour range too large (max 31 days)")
		}
	}

	base := db.Table((&UserCallHourly{}).TableName()).Select(strings.TrimSpace(`
user_id as user_id,
MAX(username) as username,
SUM(total_calls) as total_calls`))

	if useHoursList {
		base = base.Where("hour_start_ts IN ?", hours)
	} else {
		base = base.Where("hour_start_ts >= ? AND hour_start_ts < ?", startHourTs, endHourTs)
	}

	var rows []UserHourlyCallsRankItem
	err := base.Group("user_id").
		Order("total_calls DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}