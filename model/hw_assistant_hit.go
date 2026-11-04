package model

// HwAssistantHit counts how often the assistant was asked a question. A key
// "faq:<id>" counts a fixed answer (the chips are ordered by it), a key
// "q:<question>" counts a question that no fixed answer covers, so the admin
// sees what to add next. Nothing is stored for a question that contains an
// address or a long number.

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const HwAssistantHitKeyMaxLen = 160

type HwAssistantHit struct {
	ID     int    `json:"id" gorm:"primaryKey"`
	Key    string `json:"key" gorm:"size:200;not null;uniqueIndex"`
	Hits   int    `json:"hits" gorm:"not null;default:0"`
	LastAt int64  `json:"last_at"`
}

var hwAssistantPersonalPattern = regexp.MustCompile(`@|\d{6,}|https?://`)

// HwAssistantRecordHit adds one to the counter of key. A key that looks
// personal (address, long number, link) or is too long is ignored.
func HwAssistantRecordHit(db *gorm.DB, key string, now int64) error {
	key = strings.TrimSpace(key)
	if key == "" || utf8.RuneCountInString(key) > HwAssistantHitKeyMaxLen || hwAssistantPersonalPattern.MatchString(key) {
		return nil
	}
	return hwAssistantBump(db, key, now)
}

// HwAssistantBumpCounter adds one to the counter of key and returns how often
// it now counts. Unlike HwAssistantRecordHit nothing is skipped: the caller
// counts an event of its own (the per-day model-answer budget of the Telegram
// bot), not a question a customer typed, so the personal-looking guard must
// not swallow the key.
func HwAssistantBumpCounter(db *gorm.DB, key string, now int64) (int, error) {
	key = strings.TrimSpace(key)
	if key == "" || utf8.RuneCountInString(key) > HwAssistantHitKeyMaxLen {
		return 0, errors.New("invalid counter key")
	}
	if err := hwAssistantBump(db, key, now); err != nil {
		return 0, err
	}
	var row HwAssistantHit
	if err := db.Where(commonKeyCol+" = ?", key).First(&row).Error; err != nil {
		return 0, err
	}
	return row.Hits, nil
}

// HwAssistantCounter returns how often key counts now, 0 for a key never
// counted.
func HwAssistantCounter(db *gorm.DB, key string) (int, error) {
	var rows []HwAssistantHit
	if err := db.Where(commonKeyCol+" = ?", strings.TrimSpace(key)).Limit(1).Find(&rows).Error; err != nil || len(rows) == 0 {
		return 0, err
	}
	return rows[0].Hits, nil
}

// hwAssistantBump writes the one-up counter behind both hit functions.
func hwAssistantBump(db *gorm.DB, key string, now int64) error {
	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "key"}},
		DoUpdates: clause.Assignments(map[string]any{
			"hits":    gorm.Expr("hw_assistant_hits.hits + 1"),
			"last_at": now,
		}),
	}).Create(&HwAssistantHit{Key: key, Hits: 1, LastAt: now}).Error
}

// HwAssistantHitsByPrefix returns the counters whose key starts with prefix,
// most asked first, with the prefix removed from the key.
func HwAssistantHitsByPrefix(db *gorm.DB, prefix string, limit int) ([]HwAssistantHit, error) {
	var rows []HwAssistantHit
	err := db.Where(commonKeyCol+" LIKE ?", prefix+"%").Order("hits DESC, last_at DESC").Limit(limit).Find(&rows).Error
	for index := range rows {
		rows[index].Key = strings.TrimPrefix(rows[index].Key, prefix)
	}
	return rows, err
}
