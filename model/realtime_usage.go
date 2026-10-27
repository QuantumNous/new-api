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
	Summary   RealtimeUsageSummary `json:"summary"`
	Users     []RealtimeUsageUser  `json:"users"`
	Trend     []RealtimeUsageTrend `json:"trend"`
	UpdatedAt int64                `json:"updated_at"`
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
	cutoff := now - int64(params.WindowSeconds)
	type aggregate struct {
		RealtimeUsageUser
	}
	byUser := map[int]*aggregate{}
	buckets := map[int64]*RealtimeUsageTrend{}
	for _, log := range logs {
		if log == nil || log.Type != LogTypeConsume || log.CreatedAt < cutoff || log.CreatedAt > now {
			continue
		}
		other, _ := common.StrToMap(log.Other)
		tokens := totalTokensFromUsage(log.PromptTokens, log.CompletionTokens, other)
		errLog := realtimeLogError(log, other)
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
	snapshot.Trend = make([]RealtimeUsageTrend, 0, params.TrendMinutes)
	for ts := (trendStart / 60) * 60; ts <= (now/60)*60; ts += 60 {
		if bucket := buckets[ts]; bucket != nil {
			snapshot.Trend = append(snapshot.Trend, *bucket)
		} else {
			snapshot.Trend = append(snapshot.Trend, RealtimeUsageTrend{Timestamp: ts})
		}
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
	if err := LOG_DB.Model(&Log{}).Where("type = ? AND created_at >= ?", LogTypeConsume, now-int64(params.WindowSeconds)).Find(&logs).Error; err != nil {
		return RealtimeUsageSnapshot{}, err
	}
	return AggregateRealtimeUsage(logs, now, params)
}
