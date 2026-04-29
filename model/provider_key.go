package model

import (
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

type ProviderKey struct {
	Id             int    `json:"id"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
	KeyFingerprint string `json:"key_fingerprint" gorm:"type:char(64);uniqueIndex"`
	KeyPreview     string `json:"key_preview" gorm:"type:varchar(255);default:''"`
}

func normalizeProviderKey(rawKey string) string {
	return strings.TrimSpace(rawKey)
}

// BuildProviderKeyFingerprint intentionally ignores channel identity so the same
// upstream key reused across multiple channels resolves to the same stable ID.
func BuildProviderKeyFingerprint(rawKey string) string {
	normalized := normalizeProviderKey(rawKey)
	if normalized == "" {
		return ""
	}
	return hex.EncodeToString(common.Sha256Raw([]byte(normalized)))
}

func BuildProviderKeyPreview(rawKey string) string {
	normalized := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(rawKey, "\r", " "), "\n", " "))
	if normalized == "" {
		return ""
	}
	if len(normalized) <= 24 {
		return normalized
	}
	return normalized[:12] + "..." + normalized[len(normalized)-8:]
}

func GetOrCreateProviderKey(rawKey string) (*ProviderKey, error) {
	fingerprint := BuildProviderKeyFingerprint(rawKey)
	if fingerprint == "" {
		return nil, errors.New("provider key is empty")
	}

	now := time.Now().Unix()
	candidate := &ProviderKey{
		CreatedAt:      now,
		UpdatedAt:      now,
		KeyFingerprint: fingerprint,
		KeyPreview:     BuildProviderKeyPreview(rawKey),
	}
	if err := LOG_DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key_fingerprint"}},
		DoNothing: true,
	}).Create(candidate).Error; err != nil {
		return nil, err
	}

	var providerKey ProviderKey
	if err := LOG_DB.Where("key_fingerprint = ?", fingerprint).Limit(1).Find(&providerKey).Error; err != nil {
		return nil, err
	}
	if providerKey.Id == 0 {
		return nil, errors.New("provider key lookup failed after upsert")
	}
	return &providerKey, nil
}
