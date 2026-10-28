package model

import (
	"errors"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// RealtimeUsageParams controls the realtime usage window and response size.
type RealtimeUsageParams struct {
	WindowSeconds int `json:"window_seconds"`
	TrendMinutes  int `json:"trend_minutes"`
	Limit         int `json:"limit"`
}

func (p RealtimeUsageParams) normalized() (RealtimeUsageParams, error) {
	if p.WindowSeconds == 0 {
		p.WindowSeconds = 60
	}
	if p.TrendMinutes == 0 {
		p.TrendMinutes = 10
	}
	if p.Limit == 0 {
		p.Limit = 20
	}
	if p.WindowSeconds < 30 || p.WindowSeconds > 300 {
		return p, errors.New("window_seconds must be between 30 and 300")
	}
	if p.TrendMinutes < 5 || p.TrendMinutes > 30 {
		return p, errors.New("trend_minutes must be between 5 and 30")
	}
	if p.Limit < 5 || p.Limit > 100 {
		return p, errors.New("limit must be between 5 and 100")
	}
	return p, nil
}

// NormalizeRealtimeUsageParams applies documented defaults and validates bounds.
func NormalizeRealtimeUsageParams(p RealtimeUsageParams) (RealtimeUsageParams, error) {
	return p.normalized()
}

type RealtimeUsageSummary struct {
	ActiveUsers int     `json:"active_users"`
	Requests    int     `json:"requests"`
	TotalTokens int     `json:"total_tokens"`
	TPM         float64 `json:"tpm"`
	ErrorRate   float64 `json:"error_rate"`
}

type RealtimeUsageUser struct {
	UserID       int     `json:"user_id"`
	Username     string  `json:"username"`
	Requests     int     `json:"requests"`
	TotalTokens  int     `json:"total_tokens"`
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	TPM          float64 `json:"tpm"`
	Errors       int     `json:"errors"`
	ErrorRate    float64 `json:"error_rate"`
	LastCallAt   int64   `json:"last_call_at"`
}

type RealtimeUsageTrend struct {
	Timestamp   int64 `json:"timestamp"`
	Requests    int   `json:"requests"`
	TotalTokens int   `json:"total_tokens"`
	Errors      int   `json:"errors"`
}

type RealtimeUsageSnapshot struct {
	Summary    RealtimeUsageSummary         `json:"summary"`
	Users      []RealtimeUsageUser          `json:"users"`
	Trend      []RealtimeUsageTrend         `json:"trend"`
	UserTrends map[int][]RealtimeUsageTrend `json:"user_trends,omitempty"`
	UpdatedAt  int64                        `json:"updated_at"`
}

func realtimeLogError(log *Log, other map[string]interface{}) bool {
	if value, ok := other["error"]; ok {
		if b, ok := value.(bool); ok && b {
			return true
		}
		if s, ok := value.(string); ok && s != "" {
			return true
		}
	}
	if status, ok := other["status"].(string); ok && status == "error" {
		return true
	}
	if value, ok := other["error_count"]; ok {
		switch n := value.(type) {
		case float64:
			return n > 0
		case int:
			return n > 0
		case int64:
			return n > 0
		}
	}
	return log.Type == LogTypeError
}

// AggregateRealtimeUsage aggregates consume logs in memory. Logs must already be bounded to the desired window.
func AggregateRealtimeUsage(logs []*Log, now int64, p RealtimeUsageParams) (RealtimeUsageSnapshot, error) {
	var snapshot RealtimeUsageSnapshot
	errorCount := 0
	params, err := p.normalized()
	if err != nil {
		return snapshot, err
	}
	if now == 0 {
		now = time.Now().Unix()
	}
	windowCutoff := now - int64(params.WindowSeconds)
	trendCutoff := now - int64(params.TrendMinutes*60)
	cutoff := windowCutoff
	if trendCutoff < cutoff {
		cutoff = trendCutoff
	}
	type aggregate struct {
		RealtimeUsageUser
	}
	byUser := map[int]*aggregate{}
	buckets := map[int64]*RealtimeUsageTrend{}
	userBuckets := map[int]map[int64]*RealtimeUsageTrend{}
	for _, log := range logs {
		if log == nil || (log.Type != LogTypeConsume && log.Type != LogTypeError) || log.CreatedAt < cutoff || log.CreatedAt > now {
			continue
		}
		inSummary := log.CreatedAt >= windowCutoff
		other, _ := common.StrToMap(log.Other)
		tokens := totalTokensFromUsage(log.PromptTokens, log.CompletionTokens, other)
		errLog := realtimeLogError(log, other)
		if !inSummary {
			// Older records only feed the trend buckets.
			bucketAt := (log.CreatedAt / 60) * 60
			userTrendBuckets := userBuckets[log.UserId]
			if userTrendBuckets == nil {
				userTrendBuckets = map[int64]*RealtimeUsageTrend{}
				userBuckets[log.UserId] = userTrendBuckets
			}
			userBucket := userTrendBuckets[bucketAt]
			if userBucket == nil {
				userBucket = &RealtimeUsageTrend{Timestamp: bucketAt}
				userTrendBuckets[bucketAt] = userBucket
			}
			userBucket.Requests++
			userBucket.TotalTokens += tokens
			if errLog {
				userBucket.Errors++
			}
			continue
		}
		a := byUser[log.UserId]
		if a == nil {
			a = &aggregate{RealtimeUsageUser: RealtimeUsageUser{UserID: log.UserId, Username: log.Username}}
			byUser[log.UserId] = a
		}
		a.Requests++
		a.InputTokens += log.PromptTokens
		a.OutputTokens += log.CompletionTokens
		a.TotalTokens += tokens
		if errLog {
			a.Errors++
		}
		if log.CreatedAt > a.LastCallAt {
			a.LastCallAt = log.CreatedAt
			if a.Username == "" {
				a.Username = log.Username
			}
		}
		bucketAt := (log.CreatedAt / 60) * 60
		bucket := buckets[bucketAt]
		if bucket == nil {
			bucket = &RealtimeUsageTrend{Timestamp: bucketAt}
			buckets[bucketAt] = bucket
		}
		bucket.Requests++
		bucket.TotalTokens += tokens
		if errLog {
			bucket.Errors++
		}
		userTrendBuckets := userBuckets[log.UserId]
		if userTrendBuckets == nil {
			userTrendBuckets = map[int64]*RealtimeUsageTrend{}
			userBuckets[log.UserId] = userTrendBuckets
		}
		userBucket := userTrendBuckets[bucketAt]
		if userBucket == nil {
			userBucket = &RealtimeUsageTrend{Timestamp: bucketAt}
			userTrendBuckets[bucketAt] = userBucket
		}
		userBucket.Requests++
		userBucket.TotalTokens += tokens
		if errLog {
			userBucket.Errors++
		}
		snapshot.Summary.Requests++
		snapshot.Summary.TotalTokens += tokens
		if errLog {
			errorCount++
		}
	}
	users := make([]RealtimeUsageUser, 0, len(byUser))
	for _, a := range byUser {
		a.ErrorRate = rate(a.Errors, a.Requests)
		a.TPM = float64(a.TotalTokens) * 60 / float64(params.WindowSeconds)
		users = append(users, a.RealtimeUsageUser)
	}
	sort.Slice(users, func(i, j int) bool {
		if users[i].TPM == users[j].TPM {
			return users[i].UserID < users[j].UserID
		}
		return users[i].TPM > users[j].TPM
	})
	snapshot.Summary.ActiveUsers = len(users)
	if len(users) > params.Limit {
		users = users[:params.Limit]
	}
	snapshot.Users = users
	snapshot.Summary.TPM = float64(snapshot.Summary.TotalTokens) * 60 / float64(params.WindowSeconds)
	snapshot.Summary.ErrorRate = rate(errorCount, snapshot.Summary.Requests)
	trendStart := now - int64(params.TrendMinutes*60)
	trendStart = (trendStart / 60) * 60
	trendEnd := (now / 60) * 60
	snapshot.Trend = make([]RealtimeUsageTrend, 0, params.TrendMinutes+1)
	for ts := trendStart; ts <= trendEnd; ts += 60 {
		if bucket := buckets[ts]; bucket != nil {
			snapshot.Trend = append(snapshot.Trend, *bucket)
		} else {
			snapshot.Trend = append(snapshot.Trend, RealtimeUsageTrend{Timestamp: ts})
		}
	}
	snapshot.UserTrends = make(map[int][]RealtimeUsageTrend, len(users))
	for _, user := range users {
		trend := make([]RealtimeUsageTrend, 0, params.TrendMinutes+1)
		for ts := trendStart; ts <= trendEnd; ts += 60 {
			if bucket := userBuckets[user.UserID][ts]; bucket != nil {
				trend = append(trend, *bucket)
			} else {
				trend = append(trend, RealtimeUsageTrend{Timestamp: ts})
			}
		}
		snapshot.UserTrends[user.UserID] = trend
	}
	snapshot.UpdatedAt = now
	return snapshot, nil
}

func rate(errors, requests int) float64 {
	if requests == 0 {
		return 0
	}
	return float64(errors) / float64(requests)
}

// GetRealtimeUsageSnapshot reads the bounded consume-log window from the log database.
func GetRealtimeUsageSnapshot(p RealtimeUsageParams) (RealtimeUsageSnapshot, error) {
	params, err := p.normalized()
	if err != nil {
		return RealtimeUsageSnapshot{}, err
	}
	now := time.Now().Unix()
	var logs []*Log
	lookback := params.WindowSeconds
	if trend := params.TrendMinutes * 60; trend > lookback {
		lookback = trend
	}
	if err := LOG_DB.Model(&Log{}).Where("type IN ? AND created_at >= ?", []int{LogTypeConsume, LogTypeError}, now-int64(lookback)).Find(&logs).Error; err != nil {
		return RealtimeUsageSnapshot{}, err
	}
	return AggregateRealtimeUsage(logs, now, params)
}
