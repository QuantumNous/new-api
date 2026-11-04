package model

// HwPricingFeedback is one report from the /pricing page: a price that does
// not match the provider, a model we do not sell, or something else. Every
// report is kept; only the first report of a model and kind within the dedup
// window is mailed and carded, so the same report never wakes the bureau twice.

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"net/url"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
)

const (
	HwPricingFeedbackKindPrice   = "price_wrong"
	HwPricingFeedbackKindMissing = "model_missing"
	HwPricingFeedbackKindOther   = "other"

	HwPricingFeedbackMaxModelRunes   = 64
	HwPricingFeedbackMaxMessageRunes = 2000
	HwPricingFeedbackMaxURLRunes     = 512
	HwPricingFeedbackMaxEmailRunes   = 254
	// HwPricingFeedbackDedupSeconds is how long a model and kind stay one
	// report: a second report inside the window is stored, never mailed.
	HwPricingFeedbackDedupSeconds = 7 * 24 * 3600
	// HwPricingFeedbackCardBatch bounds the rows one bundled card carries.
	HwPricingFeedbackCardBatch = 50
)

var ErrHwPricingFeedbackInvalid = errors.New("invalid pricing feedback")

type HwPricingFeedback struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	Kind      string `json:"kind" gorm:"size:16"`
	Model     string `json:"model" gorm:"size:64"`
	Message   string `json:"message" gorm:"type:text"`
	SourceURL string `json:"source_url" gorm:"size:512"`
	Email     string `json:"email" gorm:"size:254"`
	Lang      string `json:"lang" gorm:"size:8"`
	DedupKey  string `json:"dedup_key" gorm:"size:96;index"`
	Duplicate bool   `json:"duplicate"`
	// Card is the Bureau V2 card that carries the row; empty means not yet
	// bundled.
	Card      string `json:"card" gorm:"size:32;index"`
	CreatedAt int64  `json:"created_at" gorm:"index"`
}

// HwNormalizePricingFeedback trims and validates a report in place. The
// source URL is only checked for its form (http or https with a host); it is
// never fetched.
func HwNormalizePricingFeedback(row *HwPricingFeedback) error {
	row.Kind = strings.TrimSpace(row.Kind)
	row.Model = strings.TrimSpace(row.Model)
	row.Message = strings.TrimSpace(row.Message)
	row.SourceURL = strings.TrimSpace(row.SourceURL)
	row.Email = strings.TrimSpace(row.Email)
	row.Lang = strings.TrimSpace(row.Lang)
	switch row.Kind {
	case HwPricingFeedbackKindPrice, HwPricingFeedbackKindMissing:
		if row.Model == "" {
			return ErrHwPricingFeedbackInvalid
		}
	case HwPricingFeedbackKindOther:
		if row.Message == "" {
			return ErrHwPricingFeedbackInvalid
		}
	default:
		return ErrHwPricingFeedbackInvalid
	}
	if row.Lang != "tr" && row.Lang != "en" {
		row.Lang = "tr"
	}
	if utf8.RuneCountInString(row.Model) > HwPricingFeedbackMaxModelRunes ||
		utf8.RuneCountInString(row.Message) > HwPricingFeedbackMaxMessageRunes ||
		utf8.RuneCountInString(row.SourceURL) > HwPricingFeedbackMaxURLRunes ||
		utf8.RuneCountInString(row.Email) > HwPricingFeedbackMaxEmailRunes {
		return ErrHwPricingFeedbackInvalid
	}
	if strings.ContainsAny(row.Model+row.SourceURL+row.Email, "\r\n\x00`<>") {
		return ErrHwPricingFeedbackInvalid
	}
	if row.SourceURL != "" {
		parsed, err := url.Parse(row.SourceURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
			return ErrHwPricingFeedbackInvalid
		}
	}
	if row.Email != "" {
		address, err := mail.ParseAddress(row.Email)
		if err != nil || address.Address != row.Email {
			return ErrHwPricingFeedbackInvalid
		}
	}
	key := row.Kind + "|" + strings.ToLower(row.Model)
	if row.Model == "" {
		sum := sha256.Sum256([]byte(strings.ToLower(row.Message)))
		key += hex.EncodeToString(sum[:8])
	}
	row.DedupKey = key
	return nil
}

// HwStorePricingFeedback stores a normalized report and marks it a duplicate
// when a report with the same key was stored inside the dedup window.
func HwStorePricingFeedback(db *gorm.DB, row *HwPricingFeedback, now int64) error {
	var earlier int64
	if err := db.Model(&HwPricingFeedback{}).
		Where("dedup_key = ? AND created_at > ?", row.DedupKey, now-HwPricingFeedbackDedupSeconds).
		Count(&earlier).Error; err != nil {
		return err
	}
	row.ID = 0
	row.Card = ""
	row.Duplicate = earlier > 0
	row.CreatedAt = now
	return db.Create(row).Error
}

// HwPricingFeedbackToCard lists the first reports that no card carries yet,
// oldest first.
func HwPricingFeedbackToCard(db *gorm.DB) ([]HwPricingFeedback, error) {
	var rows []HwPricingFeedback
	err := db.Where("card = ? AND duplicate = ?", "", false).
		Order("id asc").Limit(HwPricingFeedbackCardBatch).Find(&rows).Error
	return rows, err
}

// HwMarkPricingFeedbackCarded links the rows to the card that carries them.
func HwMarkPricingFeedbackCarded(db *gorm.DB, ids []int, card string) error {
	if len(ids) == 0 {
		return nil
	}
	return db.Model(&HwPricingFeedback{}).Where("id IN ? AND card = ?", ids, "").Update("card", card).Error
}
