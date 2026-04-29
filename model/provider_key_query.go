package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type ProviderKeyChannelRef struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Status int    `json:"status"`
	Type   int    `json:"type"`
}

type ProviderKeyListItem struct {
	Id             int                     `json:"id"`
	CreatedAt      int64                   `json:"created_at"`
	UpdatedAt      int64                   `json:"updated_at"`
	KeyPreview     string                  `json:"key_preview"`
	KeyFingerprint string                  `json:"key_fingerprint"`
	CurrentKey     string                  `json:"current_key"`
	ChannelCount   int                     `json:"channel_count"`
	Channels       []ProviderKeyChannelRef `json:"channels"`
	RequestCount   int64                   `json:"request_count"`
	SuccessCount   int64                   `json:"success_count"`
	ErrorCount     int64                   `json:"error_count"`
	TotalQuota     int64                   `json:"total_quota"`
	TotalCostQuota int64                   `json:"total_cost_quota"`
	LastUsedAt     int64                   `json:"last_used_at"`
}

type providerKeyLogAggregateRow struct {
	ProviderKeyId  int   `gorm:"column:provider_key_id"`
	RequestCount   int64 `gorm:"column:request_count"`
	SuccessCount   int64 `gorm:"column:success_count"`
	ErrorCount     int64 `gorm:"column:error_count"`
	TotalQuota     int64 `gorm:"column:total_quota"`
	TotalCostQuota int64 `gorm:"column:total_cost_quota"`
	LastUsedAt     int64 `gorm:"column:last_used_at"`
}

type providerKeyChannelRow struct {
	Id     int    `gorm:"column:id"`
	Name   string `gorm:"column:name"`
	Status int    `gorm:"column:status"`
	Type   int    `gorm:"column:type"`
	Key    string `gorm:"column:key"`
}

func GetPagedProviderKeys(keyword string, startIdx int, pageSize int) ([]*ProviderKeyListItem, int64, error) {
	if err := syncProviderKeysFromChannels(); err != nil {
		return nil, 0, err
	}

	baseQuery := LOG_DB.Model(&ProviderKey{})

	trimmedKeyword := strings.TrimSpace(keyword)
	if trimmedKeyword != "" {
		likeKeyword := "%" + trimmedKeyword + "%"
		if providerKeyId, err := strconv.Atoi(trimmedKeyword); err == nil && providerKeyId > 0 {
			baseQuery = baseQuery.Where(
				"id = ? OR key_preview LIKE ? OR key_fingerprint LIKE ?",
				providerKeyId,
				likeKeyword,
				likeKeyword,
			)
		} else {
			baseQuery = baseQuery.Where(
				"key_preview LIKE ? OR key_fingerprint LIKE ?",
				likeKeyword,
				likeKeyword,
			)
		}
	}

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var providerKeys []*ProviderKey
	if err := baseQuery.Order("id desc").Offset(startIdx).Limit(pageSize).Find(&providerKeys).Error; err != nil {
		return nil, 0, err
	}
	if len(providerKeys) == 0 {
		return []*ProviderKeyListItem{}, total, nil
	}

	providerKeyIds := make([]int, 0, len(providerKeys))
	fingerprintSet := make(map[string]struct{}, len(providerKeys))
	for _, providerKey := range providerKeys {
		providerKeyIds = append(providerKeyIds, providerKey.Id)
		fingerprintSet[providerKey.KeyFingerprint] = struct{}{}
	}

	statsByProviderKeyId, err := getProviderKeyUsageStats(providerKeyIds)
	if err != nil {
		return nil, 0, err
	}
	channelsByFingerprint, currentKeyByFingerprint, err := getProviderKeyChannels(fingerprintSet)
	if err != nil {
		return nil, 0, err
	}

	items := make([]*ProviderKeyListItem, 0, len(providerKeys))
	for _, providerKey := range providerKeys {
		item := &ProviderKeyListItem{
			Id:             providerKey.Id,
			CreatedAt:      providerKey.CreatedAt,
			UpdatedAt:      providerKey.UpdatedAt,
			KeyPreview:     providerKey.KeyPreview,
			KeyFingerprint: providerKey.KeyFingerprint,
			CurrentKey:     currentKeyByFingerprint[providerKey.KeyFingerprint],
			Channels:       channelsByFingerprint[providerKey.KeyFingerprint],
		}
		item.ChannelCount = len(item.Channels)
		if stat, ok := statsByProviderKeyId[providerKey.Id]; ok {
			item.RequestCount = stat.RequestCount
			item.SuccessCount = stat.SuccessCount
			item.ErrorCount = stat.ErrorCount
			item.TotalQuota = stat.TotalQuota
			item.TotalCostQuota = stat.TotalCostQuota
			item.LastUsedAt = stat.LastUsedAt
		}
		items = append(items, item)
	}

	return items, total, nil
}

func syncProviderKeysFromChannels() error {
	keyColumn := commonKeyCol
	if keyColumn == "" {
		if common.UsingPostgreSQL {
			keyColumn = `"key"`
		} else {
			keyColumn = "`key`"
		}
	}

	var channels []providerKeyChannelRow
	if err := DB.Model(&Channel{}).
		Select("id, name, status, type, " + keyColumn + " as key").
		Find(&channels).Error; err != nil {
		return err
	}

	seenFingerprints := make(map[string]struct{})
	for _, channel := range channels {
		channelModel := Channel{Key: channel.Key}
		for _, rawKey := range channelModel.GetKeys() {
			fingerprint := BuildProviderKeyFingerprint(rawKey)
			if fingerprint == "" {
				continue
			}
			if _, duplicated := seenFingerprints[fingerprint]; duplicated {
				continue
			}
			if _, err := GetOrCreateProviderKey(rawKey); err != nil {
				return err
			}
			seenFingerprints[fingerprint] = struct{}{}
		}
	}

	return nil
}

func getProviderKeyUsageStats(providerKeyIds []int) (map[int]providerKeyLogAggregateRow, error) {
	statsByProviderKeyId := make(map[int]providerKeyLogAggregateRow, len(providerKeyIds))
	if len(providerKeyIds) == 0 {
		return statsByProviderKeyId, nil
	}

	var rows []providerKeyLogAggregateRow
	err := LOG_DB.Model(&Log{}).
		Select(
			"provider_key_id, COUNT(*) AS request_count, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_count, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS error_count, "+
				"COALESCE(SUM(CASE WHEN type = ? THEN quota ELSE 0 END), 0) AS total_quota, "+
				"COALESCE(SUM(CASE WHEN type = ? THEN COALESCE(cost_quota, quota) ELSE 0 END), 0) AS total_cost_quota, "+
				"COALESCE(MAX(created_at), 0) AS last_used_at",
			LogTypeConsume,
			LogTypeError,
			LogTypeConsume,
			LogTypeConsume,
		).
		Where("provider_key_id IN ?", providerKeyIds).
		Group("provider_key_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		statsByProviderKeyId[row.ProviderKeyId] = row
	}
	return statsByProviderKeyId, nil
}

func getProviderKeyChannels(fingerprintSet map[string]struct{}) (map[string][]ProviderKeyChannelRef, map[string]string, error) {
	channelsByFingerprint := make(map[string][]ProviderKeyChannelRef, len(fingerprintSet))
	currentKeyByFingerprint := make(map[string]string, len(fingerprintSet))
	if len(fingerprintSet) == 0 {
		return channelsByFingerprint, currentKeyByFingerprint, nil
	}

	keyColumn := commonKeyCol
	if keyColumn == "" {
		if common.UsingPostgreSQL {
			keyColumn = `"key"`
		} else {
			keyColumn = "`key`"
		}
	}

	var channels []providerKeyChannelRow
	if err := DB.Model(&Channel{}).
		Select("id, name, status, type, " + keyColumn + " as key").
		Find(&channels).Error; err != nil {
		return nil, nil, err
	}

	for _, channel := range channels {
		channelModel := Channel{Key: channel.Key}
		keys := channelModel.GetKeys()
		if len(keys) == 0 {
			continue
		}

		seenFingerprints := make(map[string]struct{}, len(keys))
		for _, rawKey := range keys {
			fingerprint := BuildProviderKeyFingerprint(rawKey)
			if fingerprint == "" {
				continue
			}
			if _, ok := fingerprintSet[fingerprint]; !ok {
				continue
			}
			if _, duplicated := seenFingerprints[fingerprint]; duplicated {
				continue
			}

			channelsByFingerprint[fingerprint] = append(channelsByFingerprint[fingerprint], ProviderKeyChannelRef{
				Id:     channel.Id,
				Name:   channel.Name,
				Status: channel.Status,
				Type:   channel.Type,
			})
			if currentKeyByFingerprint[fingerprint] == "" {
				currentKeyByFingerprint[fingerprint] = strings.TrimSpace(rawKey)
			}
			seenFingerprints[fingerprint] = struct{}{}
		}
	}

	return channelsByFingerprint, currentKeyByFingerprint, nil
}
