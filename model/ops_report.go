package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// Ops daily report data layer. All queries are read-only aggregates over the
// PLG user population (group = 'plg'; Enterprise/internal accounts excluded).
//
// logs may live in a separate database (LOG_DB / LOG_SQL_DSN), so nothing here
// joins logs with users in SQL — user metadata is joined in memory by the
// controller. Per-user aggregates are fetched in id chunks through the
// user_id index, which keeps every query an index lookup instead of a scan.

const opsReportChunkSize = 500

type OpsPlgUser struct {
	Id             int    `json:"id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	Email          string `json:"email"`
	CreatedAt      int64  `json:"created_at"`
	AdsAttribution string `json:"ads_attribution"`
}

type OpsUserLogStats struct {
	UserId            int   `json:"user_id"`
	FirstPlaygroundAt int64 `json:"first_playground_at"`
	PlaygroundCount   int   `json:"playground_count"`
	FirstApiKeyAt     int64 `json:"first_apikey_at"`
	ApiKeyCount       int   `json:"apikey_count"`
}

type OpsUserTokenStats struct {
	UserId           int   `json:"user_id"`
	ManualTokenCount int   `json:"manual_token_count"`
	FirstManualAt    int64 `json:"first_manual_at"`
}

type OpsKeyDaily struct {
	UserId   int   `json:"user_id"`
	DayTs    int64 `json:"day_ts"`
	ReqCount int   `json:"req_count"`
	Quota    int64 `json:"quota"`
}

type OpsTopUp struct {
	UserId     int     `json:"user_id"`
	Money      float64 `json:"money"`
	Status     string  `json:"status"`
	CreateTime int64   `json:"create_time"`
}

// GetOpsPlgUsers returns every plg-group user (the self-serve population).
func GetOpsPlgUsers() ([]*OpsPlgUser, error) {
	var users []*OpsPlgUser
	err := DB.Table("users").
		Select("id, username, display_name, email, created_at, ads_attribution").
		Where(commonGroupCol+" = ?", "plg").
		Find(&users).Error
	return users, err
}

// logsForceIndexHint keeps the optimizer on the user_id index; with large IN
// lists MySQL has been observed to fall back to a full scan of the logs table.
func logsForceIndexHint() string {
	if common.UsingMySQL {
		return " FORCE INDEX (idx_logs_user_id)"
	}
	return ""
}

func chunkInts(ids []int, size int) [][]int {
	var chunks [][]int
	for i := 0; i < len(ids); i += size {
		end := i + size
		if end > len(ids) {
			end = len(ids)
		}
		chunks = append(chunks, ids[i:end])
	}
	return chunks
}

// GetOpsUserLogStats returns per-user playground/API-key usage aggregates.
func GetOpsUserLogStats(userIds []int) ([]*OpsUserLogStats, error) {
	var all []*OpsUserLogStats
	for _, chunk := range chunkInts(userIds, opsReportChunkSize) {
		var batch []*OpsUserLogStats
		sql := fmt.Sprintf(`
			SELECT user_id,
			       COALESCE(MIN(CASE WHEN token_name LIKE 'playground%%' THEN created_at END), 0) AS first_playground_at,
			       COALESCE(SUM(CASE WHEN token_name LIKE 'playground%%' THEN 1 ELSE 0 END), 0) AS playground_count,
			       COALESCE(MIN(CASE WHEN token_id > 0 THEN created_at END), 0) AS first_api_key_at,
			       COALESCE(SUM(CASE WHEN token_id > 0 THEN 1 ELSE 0 END), 0) AS api_key_count
			FROM logs%s
			WHERE type = ? AND user_id IN ?
			GROUP BY user_id`, logsForceIndexHint())
		if err := LOG_DB.Raw(sql, LogTypeConsume, chunk).Scan(&batch).Error; err != nil {
			return nil, err
		}
		all = append(all, batch...)
	}
	return all, nil
}

// GetOpsKeyDailyUsage returns per-user-per-day API-key request aggregates
// since startTs (the "key used" DAU series source).
func GetOpsKeyDailyUsage(userIds []int, startTs int64) ([]*OpsKeyDaily, error) {
	var all []*OpsKeyDaily
	for _, chunk := range chunkInts(userIds, opsReportChunkSize) {
		var batch []*OpsKeyDaily
		// FLOOR: MySQL '/' is decimal division, so without it the expression
		// equals created_at and buckets per second; PG/SQLite integer division
		// already floors and FLOOR is a no-op there.
		sql := fmt.Sprintf(`
			SELECT user_id,
			       FLOOR(created_at / 86400) * 86400 AS day_ts,
			       COUNT(*) AS req_count,
			       COALESCE(SUM(quota), 0) AS quota
			FROM logs%s
			WHERE type = ? AND token_id > 0 AND created_at >= ? AND user_id IN ?
			GROUP BY user_id, FLOOR(created_at / 86400) * 86400`, logsForceIndexHint())
		if err := LOG_DB.Raw(sql, LogTypeConsume, startTs, chunk).Scan(&batch).Error; err != nil {
			return nil, err
		}
		all = append(all, batch...)
	}
	return all, nil
}

// GetOpsAllKeyDailyUsage returns day-level usage across ALL users since
// startTs, aggregated from quota_data (hourly per-user-per-model rollups,
// ~500 rows/day) instead of raw logs: a 30-day window covers nearly the whole
// logs table, so the optimizer full-scans ~45M rows there (measured 100s+ on
// prod). Trade-off: quota_data counts all consumption including playground,
// not only token_id>0 API-key calls.
func GetOpsAllKeyDailyUsage(startTs int64) ([]*OpsDauDay, error) {
	var rows []*OpsDauDay
	err := DB.Raw(`
		SELECT FLOOR(created_at / 86400) * 86400 AS day_ts,
		       COUNT(DISTINCT user_id) AS active_users,
		       COALESCE(SUM(count), 0) AS req_count,
		       COALESCE(SUM(quota), 0) AS quota
		FROM quota_data
		WHERE created_at >= ?
		GROUP BY FLOOR(created_at / 86400) * 86400`, startTs).Scan(&rows).Error
	return rows, err
}

type OpsDauDay struct {
	DayTs       int64 `json:"day_ts"`
	ActiveUsers int   `json:"active_users"`
	ReqCount    int   `json:"req_count"`
	Quota       int64 `json:"quota"`
}

// GetOpsUserTokenStats returns per-user counts of manually created tokens.
// Tokens created within autoWindowSec of registration are auto-provisioned by
// signup integrations (main-key/auto/default) and are excluded.
func GetOpsUserTokenStats(autoWindowSec int64) ([]*OpsUserTokenStats, error) {
	var stats []*OpsUserTokenStats
	sql := fmt.Sprintf(`
		SELECT t.user_id,
		       COALESCE(SUM(CASE WHEN t.created_time - u.created_at >= ? THEN 1 ELSE 0 END), 0) AS manual_token_count,
		       COALESCE(MIN(CASE WHEN t.created_time - u.created_at >= ? THEN t.created_time END), 0) AS first_manual_at
		FROM tokens t
		INNER JOIN users u ON u.id = t.user_id
		WHERE u.%s = ?
		GROUP BY t.user_id`, commonGroupCol)
	err := DB.Raw(sql, autoWindowSec, autoWindowSec, "plg").Scan(&stats).Error
	return stats, err
}

// GetOpsTopUps returns all top-up orders belonging to plg users.
func GetOpsTopUps() ([]*OpsTopUp, error) {
	var topUps []*OpsTopUp
	sql := fmt.Sprintf(`
		SELECT t.user_id, t.money, t.status, t.create_time
		FROM top_ups t
		INNER JOIN users u ON u.id = t.user_id
		WHERE u.%s = ?
		ORDER BY t.create_time`, commonGroupCol)
	err := DB.Raw(sql, "plg").Scan(&topUps).Error
	return topUps, err
}
