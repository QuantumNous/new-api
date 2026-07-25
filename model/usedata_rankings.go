package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const rankingTokenSumExpr = "COALESCE(sum(prompt_tokens), 0) + COALESCE(sum(completion_tokens), 0)"

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
	query := LOG_DB.Table("logs").
		Select("model_name, "+rankingTokenSumExpr+" as total_tokens, COALESCE(sum(quota), 0) as total_quota").
		Where("type = ?", LogTypeConsume).
		Where("model_name <> ''").
		Group("model_name").
		Having(rankingTokenSumExpr + " > 0").
		Order("total_tokens DESC").
		Order("model_name ASC")
	query = applyRankingLogTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func GetRankingQuotaBuckets(startTime int64, endTime int64, bucketSize int64) ([]RankingQuotaBucket, error) {
	if bucketSize <= 0 {
		bucketSize = 3600
	}
	bucketExpr := rankingBucketExpr(bucketSize)
	var rows []RankingQuotaBucket
	query := LOG_DB.Table("logs").
		Select(fmt.Sprintf("model_name, %s as bucket, %s as tokens", bucketExpr, rankingTokenSumExpr)).
		Where("type = ?", LogTypeConsume).
		Where("model_name <> ''").
		Group(fmt.Sprintf("model_name, %s", bucketExpr)).
		Having(rankingTokenSumExpr + " > 0").
		Order("bucket ASC").
		Order("model_name ASC")
	query = applyRankingLogTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func rankingBucketExpr(bucketSize int64) string {
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return fmt.Sprintf("intDiv(created_at, %d) * %d", bucketSize, bucketSize)
	}
	if common.UsingLogDatabase(common.DatabaseTypeMySQL) {
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSize, bucketSize)
	}
	return fmt.Sprintf("(created_at / %d) * %d", bucketSize, bucketSize)
}

func applyRankingLogTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}
