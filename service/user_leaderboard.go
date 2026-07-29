package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	userLeaderboardCacheTTL    = 2 * time.Minute
	userLeaderboardDefaultTop  = 20
	userLeaderboardMaxTop      = 100
	userLeaderboardTodayWindow = 24 * time.Hour
	userLeaderboardWeekWindow  = 7 * 24 * time.Hour
	userLeaderboardMonthWindow = 30 * 24 * time.Hour
)

type UserLeaderboardPeriod string

const (
	UserLeaderboardPeriodToday UserLeaderboardPeriod = "today"
	UserLeaderboardPeriodWeek  UserLeaderboardPeriod = "week"
	UserLeaderboardPeriodMonth UserLeaderboardPeriod = "month"
)

type UserLeaderboardResponse struct {
	Period    string                     `json:"period"`
	StartTs   int64                      `json:"start_ts"`
	EndTs     int64                      `json:"end_ts"`
	Entries   []model.UserUsageRankEntry `json:"entries"`
	CachedAt  int64                      `json:"cached_at"`
	FromCache bool                       `json:"from_cache"`
}

type CheckinLeaderboardResponse struct {
	Date      string                   `json:"date"`
	Entries   []model.CheckinRankEntry `json:"entries"`
	CachedAt  int64                    `json:"cached_at"`
	FromCache bool                     `json:"from_cache"`
}

type userLeaderboardCacheItem struct {
	expiresAt time.Time
	data      *UserLeaderboardResponse
}

type checkinLeaderboardCacheItem struct {
	expiresAt time.Time
	data      *CheckinLeaderboardResponse
}

var (
	userLeaderboardCacheMu    sync.Mutex
	userLeaderboardCache      = map[string]userLeaderboardCacheItem{}
	checkinLeaderboardCacheMu sync.Mutex
	checkinLeaderboardCache   = map[string]checkinLeaderboardCacheItem{}
)

func resolveUsagePeriod(period string) (UserLeaderboardPeriod, time.Duration, error) {
	switch UserLeaderboardPeriod(period) {
	case UserLeaderboardPeriodToday, "":
		return UserLeaderboardPeriodToday, userLeaderboardTodayWindow, nil
	case UserLeaderboardPeriodWeek:
		return UserLeaderboardPeriodWeek, userLeaderboardWeekWindow, nil
	case UserLeaderboardPeriodMonth:
		return UserLeaderboardPeriodMonth, userLeaderboardMonthWindow, nil
	default:
		return "", 0, fmt.Errorf("invalid usage leaderboard period: %s", period)
	}
}

func normalizeLeaderboardLimit(limit int) int {
	if limit <= 0 {
		return userLeaderboardDefaultTop
	}
	if limit > userLeaderboardMaxTop {
		return userLeaderboardMaxTop
	}
	return limit
}

// GetUsageLeaderboard returns the usage leaderboard with a 2-minute cache.
// The cache key is period+limit (shared across users); the current user's
// IsSelf flag is applied per-request on a cloned slice.
func GetUsageLeaderboard(period string, limit int, currentUserId int) (*UserLeaderboardResponse, error) {
	resolved, window, err := resolveUsagePeriod(period)
	if err != nil {
		return nil, err
	}
	period = string(resolved)
	limit = normalizeLeaderboardLimit(limit)

	cacheKey := fmt.Sprintf("usage:%s:%d", period, limit)
	now := time.Now()

	userLeaderboardCacheMu.Lock()
	if item, ok := userLeaderboardCache[cacheKey]; ok && now.Before(item.expiresAt) {
		copied := *item.data
		copied.FromCache = true
		copied.Entries = cloneUsageEntries(item.data.Entries)
		markSelfUsage(copied.Entries, currentUserId)
		userLeaderboardCacheMu.Unlock()
		return &copied, nil
	}
	userLeaderboardCacheMu.Unlock()

	endTs := now.Unix()
	startTs := now.Add(-window).Unix()
	entries, err := model.GetUsageLeaderboard(startTs, endTs, limit)
	if err != nil {
		return nil, err
	}

	resp := &UserLeaderboardResponse{
		Period:   period,
		StartTs:  startTs,
		EndTs:    endTs,
		Entries:  entries,
		CachedAt: now.Unix(),
	}

	userLeaderboardCacheMu.Lock()
	userLeaderboardCache[cacheKey] = userLeaderboardCacheItem{
		expiresAt: now.Add(userLeaderboardCacheTTL),
		data:      resp,
	}
	userLeaderboardCacheMu.Unlock()

	copied := *resp
	copied.Entries = cloneUsageEntries(resp.Entries)
	markSelfUsage(copied.Entries, currentUserId)
	return &copied, nil
}

func cloneUsageEntries(src []model.UserUsageRankEntry) []model.UserUsageRankEntry {
	if len(src) == 0 {
		return []model.UserUsageRankEntry{}
	}
	dst := make([]model.UserUsageRankEntry, len(src))
	copy(dst, src)
	for i := range dst {
		dst[i].IsSelf = false
	}
	return dst
}

func markSelfUsage(entries []model.UserUsageRankEntry, currentUserId int) {
	if currentUserId <= 0 {
		return
	}
	for i := range entries {
		if entries[i].UserId == currentUserId {
			entries[i].IsSelf = true
		}
	}
}

// GetCheckinLeaderboard returns today's check-in leaderboard with caching.
func GetCheckinLeaderboard(date string, limit int, currentUserId int) (*CheckinLeaderboardResponse, error) {
	limit = normalizeLeaderboardLimit(limit)
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	cacheKey := fmt.Sprintf("checkin:%s:%d", date, limit)
	now := time.Now()

	checkinLeaderboardCacheMu.Lock()
	if item, ok := checkinLeaderboardCache[cacheKey]; ok && now.Before(item.expiresAt) {
		copied := *item.data
		copied.FromCache = true
		copied.Entries = cloneCheckinEntries(item.data.Entries)
		markSelfCheckin(copied.Entries, currentUserId)
		checkinLeaderboardCacheMu.Unlock()
		return &copied, nil
	}
	checkinLeaderboardCacheMu.Unlock()

	entries, err := model.GetCheckinLeaderboard(date, limit)
	if err != nil {
		return nil, err
	}

	resp := &CheckinLeaderboardResponse{
		Date:     date,
		Entries:  entries,
		CachedAt: now.Unix(),
	}

	checkinLeaderboardCacheMu.Lock()
	checkinLeaderboardCache[cacheKey] = checkinLeaderboardCacheItem{
		expiresAt: now.Add(userLeaderboardCacheTTL),
		data:      resp,
	}
	checkinLeaderboardCacheMu.Unlock()

	copied := *resp
	copied.Entries = cloneCheckinEntries(resp.Entries)
	markSelfCheckin(copied.Entries, currentUserId)
	return &copied, nil
}

func cloneCheckinEntries(src []model.CheckinRankEntry) []model.CheckinRankEntry {
	if len(src) == 0 {
		return []model.CheckinRankEntry{}
	}
	dst := make([]model.CheckinRankEntry, len(src))
	copy(dst, src)
	for i := range dst {
		dst[i].IsSelf = false
	}
	return dst
}

func markSelfCheckin(entries []model.CheckinRankEntry, currentUserId int) {
	if currentUserId <= 0 {
		return
	}
	for i := range entries {
		if entries[i].UserId == currentUserId {
			entries[i].IsSelf = true
		}
	}
}
