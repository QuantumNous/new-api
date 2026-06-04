package model

import (
	"encoding/json"
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const MaxQueryKeyReportKeys = 10000

const (
	QueryKeyReportStatusNotFound    = "not_found"
	QueryKeyReportStatusFound       = "found"
	QueryKeyReportStatusOverBrushed = "over_brushed"
)

type QueryKeyReport struct {
	TotalInput           int                  `json:"total_input"`
	UniqueKeys           int                  `json:"unique_keys"`
	DuplicateCount       int                  `json:"duplicate_count"`
	FoundCount           int                  `json:"found_count"`
	NotFoundCount        int                  `json:"not_found_count"`
	OverBrushedCount     int                  `json:"over_brushed_count"`
	TotalUsedQuota       int64                `json:"total_used_quota"`
	TotalUsedAmount      float64              `json:"total_used_amount"`
	TotalOriginalAmount  float64              `json:"total_original_amount"`
	TotalCurrentAmount   float64              `json:"total_current_amount"`
	TotalOverBrushAmount float64              `json:"total_over_brush_amount"`
	Items                []QueryKeyReportItem `json:"items"`
}

type QueryKeyReportItem struct {
	Key                  string                  `json:"key"`
	Found                bool                    `json:"found"`
	Status               string                  `json:"status"`
	ChannelCount         int                     `json:"channel_count"`
	UsedQuota            int64                   `json:"used_quota"`
	UsedAmount           float64                 `json:"used_amount"`
	OriginalAmount       float64                 `json:"original_amount"`
	CurrentAmount        float64                 `json:"current_amount"`
	OverBrushAmount      float64                 `json:"over_brush_amount"`
	OriginalAmountShared bool                    `json:"original_amount_shared"`
	Channels             []QueryKeyReportChannel `json:"channels"`
}

type QueryKeyReportChannel struct {
	Id                 int     `json:"id"`
	Name               string  `json:"name"`
	Type               int     `json:"type"`
	Status             int     `json:"status"`
	Group              string  `json:"group"`
	Models             string  `json:"models"`
	Tag                *string `json:"tag"`
	IsMultiKey         bool    `json:"is_multi_key"`
	MatchedKeyCount    int     `json:"matched_key_count"`
	UsedQuota          int64   `json:"used_quota"`
	UsedAmount         float64 `json:"used_amount"`
	MatchedUsedQuota   int64   `json:"matched_used_quota"`
	MatchedUsedAmount  float64 `json:"matched_used_amount"`
	OriginalAmount     float64 `json:"original_amount"`
	CurrentAmount      float64 `json:"current_amount"`
	OverBrushAmount    float64 `json:"over_brush_amount"`
	BalanceUpdatedTime int64   `json:"balance_updated_time"`
}

type queryKeyReportInputRecord struct {
	displayKey string
	matchKey   string
}

type queryKeyReportItemAccumulator struct {
	record                  queryKeyReportInputRecord
	usedQuota               int64
	usedAmount              float64
	originalAmount          float64
	overBrushAmount         float64
	originalAmountShared    bool
	usesSharedMatchedUsage  bool
	sharedMatchedUsedAmount float64
	channels                []QueryKeyReportChannel
}

type queryKeyReportNonSharedTotal struct {
	usedQuota      int64
	usedAmount     float64
	originalAmount float64
}

type queryKeyReportSharedTotal struct {
	usedQuota       int64
	usedAmount      float64
	originalAmount  float64
	overBrushAmount float64
}

func BuildChannelQueryKeyReport(keys []string) (*QueryKeyReport, error) {
	records, totalInput := normalizeQueryKeyReportInput(keys)
	if len(records) == 0 {
		return nil, errors.New("keys不能为空")
	}
	if len(records) > MaxQueryKeyReportKeys {
		return nil, errors.New("最多支持10000个唯一密钥")
	}

	accumulators := make(map[string]*queryKeyReportItemAccumulator, len(records))
	for _, record := range records {
		accumulators[record.matchKey] = &queryKeyReportItemAccumulator{record: record}
	}

	nonSharedTotals := make(map[string]*queryKeyReportNonSharedTotal)
	sharedTotals := make(map[int]queryKeyReportSharedTotal)

	query := DB.Model(&Channel{}).
		Select("id, " + commonKeyCol + ", name, type, status, " + commonGroupCol + ", models, tag, used_quota, balance, balance_updated_time, channel_info")

	result := query.FindInBatches(&[]Channel{}, 500, func(tx *gorm.DB, batch int) error {
		channels := tx.Statement.Dest.(*[]Channel)
		for i := range *channels {
			channel := &(*channels)[i]
			parsedKeys := parseQueryKeyReportChannelKeys(channel.Key)
			if len(parsedKeys) == 0 {
				continue
			}

			matchedKeys := make([]string, 0)
			for _, parsedKey := range parsedKeys {
				if _, ok := accumulators[parsedKey]; ok {
					matchedKeys = append(matchedKeys, parsedKey)
				}
			}
			if len(matchedKeys) == 0 {
				continue
			}

			matchedKeyCount := len(matchedKeys)
			usedAmount := quotaToAmount(channel.UsedQuota)
			matchedUsedQuota := channel.UsedQuota * int64(matchedKeyCount)
			matchedUsedAmount := usedAmount * float64(matchedKeyCount)
			originalAmount := channel.Balance
			isMultiKeyChannel := channel.ChannelInfo.IsMultiKey || len(parsedKeys) > 1
			sharedOriginal := matchedKeyCount > 1
			currentAmount := originalAmount - usedAmount
			overBrushAmount := maxFloat(0, usedAmount-originalAmount)
			if sharedOriginal {
				currentAmount = originalAmount - matchedUsedAmount
				overBrushAmount = maxFloat(0, matchedUsedAmount-originalAmount)
				sharedTotals[channel.Id] = queryKeyReportSharedTotal{
					usedQuota:       matchedUsedQuota,
					usedAmount:      matchedUsedAmount,
					originalAmount:  originalAmount,
					overBrushAmount: overBrushAmount,
				}
			}

			detail := QueryKeyReportChannel{
				Id:                 channel.Id,
				Name:               channel.Name,
				Type:               channel.Type,
				Status:             channel.Status,
				Group:              channel.Group,
				Models:             channel.Models,
				Tag:                channel.Tag,
				IsMultiKey:         isMultiKeyChannel,
				MatchedKeyCount:    matchedKeyCount,
				UsedQuota:          channel.UsedQuota,
				UsedAmount:         usedAmount,
				MatchedUsedQuota:   matchedUsedQuota,
				MatchedUsedAmount:  matchedUsedAmount,
				OriginalAmount:     originalAmount,
				CurrentAmount:      currentAmount,
				OverBrushAmount:    overBrushAmount,
				BalanceUpdatedTime: channel.BalanceUpdatedTime,
			}

			for _, matchedKey := range matchedKeys {
				acc := accumulators[matchedKey]
				acc.usedQuota += channel.UsedQuota
				acc.usedAmount += usedAmount
				acc.originalAmount = maxFloat(acc.originalAmount, originalAmount)
				acc.channels = append(acc.channels, detail)
				if isMultiKeyChannel {
					acc.originalAmountShared = true
				}
				if sharedOriginal {
					acc.usesSharedMatchedUsage = true
					acc.sharedMatchedUsedAmount += matchedUsedAmount
					acc.overBrushAmount += overBrushAmount
					continue
				}

				total := nonSharedTotals[matchedKey]
				if total == nil {
					total = &queryKeyReportNonSharedTotal{}
					nonSharedTotals[matchedKey] = total
				}
				total.usedQuota += channel.UsedQuota
				total.usedAmount += usedAmount
				total.originalAmount = maxFloat(total.originalAmount, originalAmount)
			}
		}
		return nil
	})
	if result.Error != nil {
		return nil, result.Error
	}

	report := &QueryKeyReport{
		TotalInput:     totalInput,
		UniqueKeys:     len(records),
		DuplicateCount: totalInput - len(records),
		Items:          make([]QueryKeyReportItem, 0, len(records)),
	}

	for _, total := range sharedTotals {
		report.TotalUsedQuota += total.usedQuota
		report.TotalUsedAmount += total.usedAmount
		report.TotalOriginalAmount += total.originalAmount
		report.TotalOverBrushAmount += total.overBrushAmount
	}
	for _, total := range nonSharedTotals {
		report.TotalUsedQuota += total.usedQuota
		report.TotalUsedAmount += total.usedAmount
		report.TotalOriginalAmount += total.originalAmount
		report.TotalOverBrushAmount += maxFloat(0, total.usedAmount-total.originalAmount)
	}
	report.TotalCurrentAmount = report.TotalOriginalAmount - report.TotalUsedAmount

	for _, record := range records {
		acc := accumulators[record.matchKey]
		item := QueryKeyReportItem{
			Key:                  record.displayKey,
			Found:                len(acc.channels) > 0,
			Status:               QueryKeyReportStatusNotFound,
			ChannelCount:         len(acc.channels),
			UsedQuota:            acc.usedQuota,
			UsedAmount:           acc.usedAmount,
			OriginalAmount:       acc.originalAmount,
			CurrentAmount:        acc.originalAmount - acc.usedAmount,
			OverBrushAmount:      acc.overBrushAmount,
			OriginalAmountShared: acc.originalAmountShared,
			Channels:             acc.channels,
		}
		if item.Found {
			report.FoundCount++
			if acc.usesSharedMatchedUsage {
				item.CurrentAmount = item.OriginalAmount - acc.sharedMatchedUsedAmount
			} else {
				item.OverBrushAmount = maxFloat(0, item.UsedAmount-item.OriginalAmount)
			}
			if item.OverBrushAmount > 0 {
				item.Status = QueryKeyReportStatusOverBrushed
				report.OverBrushedCount++
			} else {
				item.Status = QueryKeyReportStatusFound
			}
		} else {
			report.NotFoundCount++
		}
		report.Items = append(report.Items, item)
	}

	return report, nil
}

func normalizeQueryKeyReportInput(keys []string) ([]queryKeyReportInputRecord, int) {
	records := make([]queryKeyReportInputRecord, 0, len(keys))
	seen := make(map[string]struct{}, len(keys))
	totalInput := 0
	for _, key := range keys {
		displayKey := strings.TrimSpace(key)
		if displayKey == "" {
			continue
		}
		totalInput++
		matchKey := normalizeQueryKeyReportMatchKey(displayKey)
		if matchKey == "" {
			continue
		}
		if _, ok := seen[matchKey]; ok {
			continue
		}
		seen[matchKey] = struct{}{}
		records = append(records, queryKeyReportInputRecord{displayKey: displayKey, matchKey: matchKey})
	}
	return records, totalInput
}

func normalizeQueryKeyReportMatchKey(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var decoded any
	if err := common.Unmarshal([]byte(trimmed), &decoded); err == nil {
		switch typed := decoded.(type) {
		case string:
			return strings.TrimSpace(typed)
		case nil:
			return ""
		default:
			encoded, err := common.Marshal(typed)
			if err == nil {
				return string(encoded)
			}
		}
	}
	return trimmed
}

func parseQueryKeyReportChannelKeys(key string) []string {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return []string{}
	}

	keys := make([]string, 0)
	if strings.HasPrefix(trimmed, "[") {
		var values []json.RawMessage
		if err := common.Unmarshal([]byte(trimmed), &values); err == nil {
			for _, value := range values {
				keys = append(keys, normalizeQueryKeyReportMatchKey(string(value)))
			}
			return uniqueNonBlankReportKeys(keys)
		}
	}

	for _, part := range strings.Split(strings.Trim(key, "\n"), "\n") {
		keys = append(keys, normalizeQueryKeyReportMatchKey(part))
	}
	return uniqueNonBlankReportKeys(keys)
}

func uniqueNonBlankReportKeys(keys []string) []string {
	seen := make(map[string]struct{}, len(keys))
	unique := make([]string, 0, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		unique = append(unique, key)
	}
	return unique
}

func quotaToAmount(usedQuota int64) float64 {
	if common.QuotaPerUnit == 0 {
		return 0
	}
	return float64(usedQuota) / common.QuotaPerUnit
}

func maxFloat(a, b float64) float64 {
	return math.Max(a, b)
}
