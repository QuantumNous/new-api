package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Ranking reads the hourly pre-aggregated quota_data dashboard table rather
// than the raw logs table: one leaderboard refresh stays a small grouped scan
// even when logs holds tens of millions of rows, and the numbers keep matching
// the rest of the dashboard, which is fed by the same table.
const (
	rankingTokenSumExpr = "COALESCE(sum(token_used), 0)"
	rankingQuotaSumExpr = "COALESCE(sum(quota), 0)"
)

type RankingQuotaTotal struct {
	ModelName   string `json:"model_name"`
	TotalTokens int64  `json:"total_tokens"`
	TotalQuota  int64  `json:"total_quota"`
}

type RankingQuotaBucket struct {
	ModelName string `json:"model_name"`
	Bucket    int64  `json:"bucket"`
	Tokens    int64  `json:"tokens"`
}

func GetRankingQuotaTotals(startTime int64, endTime int64) ([]RankingQuotaTotal, error) {
	var rows []RankingQuotaTotal
	query := DB.Table("quota_data").
		Select("model_name, " + rankingTokenSumExpr + " as total_tokens, " + rankingQuotaSumExpr + " as total_quota").
		Where("model_name <> ''").
		Group("model_name").
		// Per-request billing charges quota without reporting tokens, so a
		// token-only filter would silently drop those models from the board.
		Having(rankingTokenSumExpr + " > 0 OR " + rankingQuotaSumExpr + " > 0").
		Order("total_tokens DESC").
		Order("total_quota DESC").
		Order("model_name ASC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func GetRankingQuotaBuckets(startTime int64, endTime int64, bucketSize int64) ([]RankingQuotaBucket, error) {
	if bucketSize <= 0 {
		bucketSize = 3600
	}
	bucketExpr := rankingBucketExpr(bucketSize)
	var rows []RankingQuotaBucket
	query := DB.Table("quota_data").
		Select(fmt.Sprintf("model_name, %s as bucket, %s as tokens", bucketExpr, rankingTokenSumExpr)).
		Where("model_name <> ''").
		Group(fmt.Sprintf("model_name, %s", bucketExpr)).
		Having(rankingTokenSumExpr + " > 0").
		Order("bucket ASC").
		Order("model_name ASC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

// rankingBucketExpr buckets quota_data.created_at, so it must follow the main
// database dialect: quota_data lives in the main database, not the log database.
func rankingBucketExpr(bucketSize int64) string {
	if common.UsingMainDatabase(common.DatabaseTypeClickHouse) {
		return fmt.Sprintf("intDiv(created_at, %d) * %d", bucketSize, bucketSize)
	}
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSize, bucketSize)
	}
	return fmt.Sprintf("(created_at / %d) * %d", bucketSize, bucketSize)
}

func applyRankingQuotaTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}
