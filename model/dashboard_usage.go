package model

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type DashboardDimension string
type DashboardMetric string

const (
	DashboardDimensionModel       DashboardDimension = "model_name"
	DashboardDimensionProviderKey DashboardDimension = "provider_key_id"
	DashboardDimensionChannel     DashboardDimension = "channel_id"
	DashboardDimensionToken       DashboardDimension = "token_id"
	DashboardDimensionUsername    DashboardDimension = "username"

	DashboardMetricOriginal DashboardMetric = "original_quota"
	DashboardMetricCost     DashboardMetric = "cost_quota"
)

type DashboardUsageQuery struct {
	UserID         int
	Username       string
	StartTimestamp int64
	EndTimestamp   int64
	ModelName      string
	ChannelID      int
	ProviderKeyID  int
	TokenID        int
	Dimension      DashboardDimension
	Metric         DashboardMetric
}

type dashboardUsageAggregate struct {
	CreatedAt   int64  `gorm:"column:created_at"`
	ModelName   string `gorm:"column:model_name"`
	Username    string `gorm:"column:username"`
	DimensionID int    `gorm:"column:dimension_id"`
	Count       int    `gorm:"column:count"`
	Quota       int    `gorm:"column:quota"`
	TokenUsed   int    `gorm:"column:token_used"`
}

type dashboardNamedEntity struct {
	ID   int    `gorm:"column:id"`
	Name string `gorm:"column:name"`
}

func normalizeDashboardDimension(input string) DashboardDimension {
	switch DashboardDimension(input) {
	case DashboardDimensionModel,
		DashboardDimensionProviderKey,
		DashboardDimensionChannel,
		DashboardDimensionToken,
		DashboardDimensionUsername:
		return DashboardDimension(input)
	default:
		return DashboardDimensionModel
	}
}

func buildDashboardUsageBaseQuery(query DashboardUsageQuery) (*gorm.DB, error) {
	tx := logReadDB().Model(&Log{}).Where("type = ?", LogTypeConsume)

	if query.UserID > 0 {
		tx = tx.Where("user_id = ?", query.UserID)
	}
	if query.Username != "" {
		tx = tx.Where("username = ?", query.Username)
	}
	if query.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", query.EndTimestamp)
	}
	if query.ModelName != "" {
		modelNamePattern, err := sanitizeLikePattern(query.ModelName)
		if err != nil {
			return nil, err
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if query.ChannelID != 0 {
		tx = tx.Where("channel_id = ?", query.ChannelID)
	}
	if query.ProviderKeyID != 0 {
		tx = tx.Where("provider_key_id = ?", query.ProviderKeyID)
	}
	if query.TokenID != 0 {
		tx = tx.Where("token_id = ?", query.TokenID)
	}
	return tx, nil
}

func normalizeDashboardMetric(input string) DashboardMetric {
	switch DashboardMetric(input) {
	case DashboardMetricCost:
		return DashboardMetricCost
	default:
		return DashboardMetricOriginal
	}
}

func getDashboardDimensionParts(dimension DashboardDimension) (selectPart string, groupPart string) {
	switch dimension {
	case DashboardDimensionProviderKey:
		return "provider_key_id AS dimension_id", "provider_key_id"
	case DashboardDimensionChannel:
		return "channel_id AS dimension_id", "channel_id"
	case DashboardDimensionToken:
		return "token_id AS dimension_id", "token_id"
	case DashboardDimensionUsername:
		return "username", "username"
	default:
		return "model_name", "model_name"
	}
}

func listDashboardUsageRows(query DashboardUsageQuery) ([]dashboardUsageAggregate, error) {
	query.Dimension = normalizeDashboardDimension(string(query.Dimension))
	tx, err := buildDashboardUsageBaseQuery(query)
	if err != nil {
		return nil, err
	}

	bucketExpr := "((created_at / 3600) * 3600)"
	selectPart, groupPart := getDashboardDimensionParts(query.Dimension)
	quotaExpr := "COALESCE(SUM(quota), 0)"
	if normalizeDashboardMetric(string(query.Metric)) == DashboardMetricCost {
		quotaExpr = "COALESCE(SUM(CASE WHEN cost_quota IS NULL THEN quota ELSE cost_quota END), 0)"
	}
	selectFields := []string{
		bucketExpr + " AS created_at",
		selectPart,
		"COUNT(*) AS count",
		quotaExpr + " AS quota",
		"COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS token_used",
	}

	var rows []dashboardUsageAggregate
	err = tx.Select(strings.Join(selectFields, ", ")).
		Group(bucketExpr + ", " + groupPart).
		Order("created_at ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func loadNamedEntityMap(table string, ids []int) map[int]string {
	if len(ids) == 0 {
		return map[int]string{}
	}
	var rows []dashboardNamedEntity
	if err := readDB().Table(table).Select("id, name").Where("id IN ?", ids).Find(&rows).Error; err != nil {
		common.SysLog(fmt.Sprintf("failed to load %s names: %v", table, err))
		return map[int]string{}
	}
	result := make(map[int]string, len(rows))
	for _, row := range rows {
		result[row.ID] = row.Name
	}
	return result
}

func collectDashboardDimensionIDs(rows []dashboardUsageAggregate) []int {
	idSet := make(map[int]struct{})
	for _, row := range rows {
		if row.DimensionID <= 0 {
			continue
		}
		idSet[row.DimensionID] = struct{}{}
	}
	ids := make([]int, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	return ids
}

func resolveDashboardDimensionLabel(row dashboardUsageAggregate, dimension DashboardDimension, nameMap map[int]string) string {
	switch dimension {
	case DashboardDimensionProviderKey:
		return strconv.Itoa(row.DimensionID)
	case DashboardDimensionChannel, DashboardDimensionToken:
		if name := nameMap[row.DimensionID]; name != "" {
			return fmt.Sprintf("%d - %s", row.DimensionID, name)
		}
		return strconv.Itoa(row.DimensionID)
	case DashboardDimensionUsername:
		if row.Username != "" {
			return row.Username
		}
		return "-"
	default:
		if row.ModelName != "" {
			return row.ModelName
		}
		return "-"
	}
}

func mapDashboardRowsToQuotaData(rows []dashboardUsageAggregate, dimension DashboardDimension) []*QuotaData {
	nameMap := map[int]string{}
	switch dimension {
	case DashboardDimensionChannel:
		nameMap = loadNamedEntityMap("channels", collectDashboardDimensionIDs(rows))
	case DashboardDimensionToken:
		nameMap = loadNamedEntityMap("tokens", collectDashboardDimensionIDs(rows))
	}

	results := make([]*QuotaData, 0, len(rows))
	for _, row := range rows {
		label := resolveDashboardDimensionLabel(row, dimension, nameMap)
		item := &QuotaData{
			Username:  row.Username,
			ModelName: label,
			CreatedAt: row.CreatedAt,
			TokenUsed: row.TokenUsed,
			Count:     row.Count,
			Quota:     row.Quota,
		}
		if dimension == DashboardDimensionUsername {
			item.Username = label
		}
		results = append(results, item)
	}
	return results
}

func GetDashboardQuotaData(query DashboardUsageQuery) ([]*QuotaData, error) {
	rows, err := listDashboardUsageRows(query)
	if err != nil {
		return nil, err
	}
	return mapDashboardRowsToQuotaData(rows, normalizeDashboardDimension(string(query.Dimension))), nil
}

func GetDashboardUserQuotaData(query DashboardUsageQuery) ([]*QuotaData, error) {
	query.Dimension = DashboardDimensionUsername
	rows, err := listDashboardUsageRows(query)
	if err != nil {
		return nil, err
	}
	return mapDashboardRowsToQuotaData(rows, DashboardDimensionUsername), nil
}
