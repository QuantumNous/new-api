package model

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AdsAttributionOutboxPending    = "pending"
	AdsAttributionOutboxDelivering = "delivering"
	AdsAttributionOutboxDelivered  = "delivered"
	AdsAttributionOutboxDead       = "dead"
)

type AdsAttributionOutbox struct {
	Id            int64  `json:"id"`
	EventId       string `json:"event_id" gorm:"type:varchar(255);uniqueIndex"`
	EventType     string `json:"event_type" gorm:"type:varchar(32);index"`
	UserId        int    `json:"user_id" gorm:"index"`
	OrderId       string `json:"order_id" gorm:"type:varchar(255);index"`
	Payload       string `json:"payload" gorm:"type:text"`
	Status        string `json:"status" gorm:"type:varchar(24);index;default:'pending'"`
	Attempts      int    `json:"attempts" gorm:"default:0"`
	NextAttemptAt int64  `json:"next_attempt_at" gorm:"index;default:0"`
	ClaimedAt     int64  `json:"claimed_at" gorm:"default:0"`
	DeliveredAt   int64  `json:"delivered_at" gorm:"default:0"`
	LastError     string `json:"last_error" gorm:"type:varchar(512);default:''"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func attributionEnvelope(raw string) map[string]any {
	var source map[string]any
	if raw == "" || common.UnmarshalJsonStr(raw, &source) != nil {
		return nil
	}
	clickType := ""
	clickId := ""
	for _, key := range []string{"gclid", "gbraid", "wbraid"} {
		if value, ok := source[key].(string); ok && strings.TrimSpace(value) != "" {
			clickType = key
			clickId = strings.TrimSpace(value)
			break
		}
	}
	if clickType == "" {
		return nil
	}
	text := func(keys ...string) string {
		for _, key := range keys {
			if value, ok := source[key].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
		return ""
	}
	utm := map[string]string{}
	for _, key := range []string{"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"} {
		if value := text(key); value != "" {
			utm[key] = value
		}
	}
	dimensions := map[string]string{
		"account":     text("account", "hsa_acc"),
		"campaign":    text("campaign", "utm_campaign"),
		"campaign_id": text("campaign_id", "gad_campaignid", "hsa_cam"),
		"ad_group":    text("ad_group", "utm_content"),
		"ad_group_id": text("ad_group_id", "hsa_grp"),
		"creative":    text("creative"),
		"creative_id": text("creative_id", "hsa_ad"),
		"placement":   text("placement", "hsa_src"),
		"network":     text("network", "hsa_net"),
		"device":      text("device"),
		"market":      text("market", "country"),
		"keyword":     text("keyword", "utm_term", "hsa_kw"),
		"match_type":  text("match_type", "hsa_mt"),
		"target_id":   text("target_id", "hsa_tgt"),
		"location_id": text("location_id", "loc_physical_ms"),
		"language":    text("language", "lng"),
		"experiment":  text("experiment", "experiment_id"),
	}
	for key, value := range dimensions {
		if value == "" {
			delete(dimensions, key)
		}
	}
	capturedAt := text("first_captured_at", "captured_at")
	if capturedAt == "" {
		capturedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return map[string]any{
		"click_id_type": clickType,
		"click_id":      clickId,
		"captured_at":   capturedAt,
		"landing_path":  text("first_landing_path", "landing_path"),
		"utm":           utm,
		"dimensions":    dimensions,
	}
}

func enqueueAdsAttributionInTx(tx *gorm.DB, eventId string, eventType string, userId int, orderId string, payload map[string]any) error {
	if tx == nil || payload == nil {
		return nil
	}
	raw, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	event := &AdsAttributionOutbox{
		EventId:       eventId,
		EventType:     eventType,
		UserId:        userId,
		OrderId:       orderId,
		Payload:       string(raw),
		Status:        AdsAttributionOutboxPending,
		NextAttemptAt: common.GetTimestamp(),
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_id"}},
		DoNothing: true,
	}).Create(event).Error
}

func EnqueueAdsSignupInTx(tx *gorm.DB, user *User) error {
	if user == nil {
		return nil
	}
	attribution := attributionEnvelope(user.AdsAttribution)
	if attribution == nil {
		return nil
	}
	occurredAt := time.Unix(user.CreatedAt, 0).UTC()
	if user.CreatedAt <= 0 {
		occurredAt = time.Now().UTC()
	}
	payload := map[string]any{
		"event_id":    fmt.Sprintf("flatkey:signup:%d", user.Id),
		"user_id":     strconv.Itoa(user.Id),
		"occurred_at": occurredAt.Format(time.RFC3339),
		"attribution": attribution,
	}
	return enqueueAdsAttributionInTx(
		tx, payload["event_id"].(string), "signup", user.Id, "", payload,
	)
}

func EnqueueAdsActivation(userId int, occurredAt time.Time) error {
	var user User
	if err := DB.Select("id", "ads_attribution").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if attributionEnvelope(user.AdsAttribution) == nil {
		return nil
	}
	payload := map[string]any{
		"event_id":        fmt.Sprintf("flatkey:activation:%d:first_api_success", userId),
		"user_id":         strconv.Itoa(userId),
		"activation_name": "first_api_success",
		"occurred_at":     occurredAt.UTC().Format(time.RFC3339),
	}
	return enqueueAdsAttributionInTx(
		DB, payload["event_id"].(string), "activation", userId, "", payload,
	)
}

func EnqueueAdsPurchaseInTx(tx *gorm.DB, topUp *TopUp) error {
	if topUp == nil || topUp.Money <= 0 || strings.TrimSpace(topUp.PaymentCurrency) == "" {
		return nil
	}
	var user User
	if err := tx.Select("id", "ads_attribution").Where("id = ?", topUp.UserId).First(&user).Error; err != nil {
		return err
	}
	if attributionEnvelope(user.AdsAttribution) == nil {
		return nil
	}
	occurredAt := time.Unix(topUp.CompleteTime, 0).UTC()
	payload := map[string]any{
		"event_type":       "purchase",
		"event_id":         "flatkey:purchase:" + topUp.TradeNo,
		"user_id":          strconv.Itoa(topUp.UserId),
		"order_id":         topUp.TradeNo,
		"value":            topUp.Money,
		"currency":         strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency)),
		"occurred_at":      occurredAt.Format(time.RFC3339),
		"payment_provider": topUp.PaymentProvider,
	}
	return enqueueAdsAttributionInTx(
		tx, payload["event_id"].(string), "purchase", topUp.UserId, topUp.TradeNo, payload,
	)
}

func EnqueueAdsRefund(eventId string, topUp *TopUp, cumulativeRefund float64, adjustedValue float64, occurredAt time.Time) error {
	if topUp == nil || cumulativeRefund <= 0 {
		return nil
	}
	var attributedPurchaseCount int64
	if err := DB.Model(&AdsAttributionOutbox{}).
		Where("event_id = ? AND event_type = ?", "flatkey:purchase:"+topUp.TradeNo, "purchase").
		Count(&attributedPurchaseCount).Error; err != nil {
		return err
	}
	if attributedPurchaseCount == 0 {
		return nil
	}
	adjustmentType := "restatement"
	if adjustedValue <= 0 {
		adjustmentType = "retraction"
		adjustedValue = 0
	}
	payload := map[string]any{
		"event_type":       "refund",
		"event_id":         "flatkey:refund:" + eventId,
		"user_id":          strconv.Itoa(topUp.UserId),
		"order_id":         topUp.TradeNo,
		"value":            cumulativeRefund,
		"currency":         strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency)),
		"adjustment_type":  adjustmentType,
		"occurred_at":      occurredAt.UTC().Format(time.RFC3339),
		"payment_provider": topUp.PaymentProvider,
	}
	if adjustmentType == "restatement" {
		payload["adjusted_value"] = adjustedValue
	}
	return enqueueAdsAttributionInTx(
		DB, payload["event_id"].(string), "refund", topUp.UserId, topUp.TradeNo, payload,
	)
}

func ClaimAdsAttributionOutbox(limit int, now int64) ([]AdsAttributionOutbox, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	staleBefore := now - 10*60
	if err := DB.Model(&AdsAttributionOutbox{}).
		Where("status = ? AND claimed_at > 0 AND claimed_at < ?", AdsAttributionOutboxDelivering, staleBefore).
		Updates(map[string]any{
			"status": AdsAttributionOutboxPending, "claimed_at": 0, "next_attempt_at": now,
		}).Error; err != nil {
		return nil, err
	}
	var candidates []AdsAttributionOutbox
	if err := DB.Where("status = ? AND next_attempt_at <= ?", AdsAttributionOutboxPending, now).
		Order("created_at asc").Limit(limit * 2).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]AdsAttributionOutbox, 0, limit)
	for _, candidate := range candidates {
		result := DB.Model(&AdsAttributionOutbox{}).
			Where("id = ? AND status = ? AND next_attempt_at <= ?", candidate.Id, AdsAttributionOutboxPending, now).
			Updates(map[string]any{
				"status":     AdsAttributionOutboxDelivering,
				"claimed_at": now,
				"attempts":   gorm.Expr("attempts + 1"),
			})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		candidate.Status = AdsAttributionOutboxDelivering
		candidate.ClaimedAt = now
		candidate.Attempts++
		claimed = append(claimed, candidate)
		if len(claimed) >= limit {
			break
		}
	}
	return claimed, nil
}

func CompleteAdsAttributionOutbox(id int64, now int64) error {
	return DB.Model(&AdsAttributionOutbox{}).
		Where("id = ? AND status = ?", id, AdsAttributionOutboxDelivering).
		Updates(map[string]any{
			"status": AdsAttributionOutboxDelivered, "delivered_at": now,
			"claimed_at": 0, "last_error": "",
		}).Error
}

func FailAdsAttributionOutbox(id int64, attempts int, message string, now int64) error {
	if len(message) > 512 {
		message = message[:512]
	}
	status := AdsAttributionOutboxPending
	nextAttemptAt := now + int64(30*(1<<min(attempts, 7)))
	if attempts >= 10 {
		status = AdsAttributionOutboxDead
		nextAttemptAt = 0
	}
	return DB.Model(&AdsAttributionOutbox{}).
		Where("id = ? AND status = ?", id, AdsAttributionOutboxDelivering).
		Updates(map[string]any{
			"status": status, "next_attempt_at": nextAttemptAt,
			"claimed_at": 0, "last_error": message,
		}).Error
}
