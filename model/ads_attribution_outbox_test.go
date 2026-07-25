package model

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupAdsAttributionOutboxTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(
		sqlite.Open(filepath.Join(t.TempDir(), "ads-attribution.db")+"?_pragma=busy_timeout(5000)"),
		&gorm.Config{},
	)
	if err != nil {
		t.Fatalf("open attribution test database: %v", err)
	}
	if err := db.AutoMigrate(&AdsAttributionOutbox{}); err != nil {
		t.Fatalf("migrate attribution outbox: %v", err)
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestAttributionEnvelopeKeepsGoogleClickAndAnalysisDimensions(t *testing.T) {
	envelope := attributionEnvelope(`{
		"gclid":"CLICK_123456",
		"first_captured_at":"2026-07-24T12:00:00Z",
		"first_landing_path":"/openrouter-alternative",
		"utm_campaign":"flatkey-us",
		"hsa_grp":"ad-group-7",
		"hsa_ad":"creative-9",
		"device":"m"
	}`)
	if envelope == nil {
		t.Fatal("expected paid attribution envelope")
	}
	if envelope["click_id_type"] != "gclid" || envelope["click_id"] != "CLICK_123456" {
		t.Fatalf("unexpected click attribution: %#v", envelope)
	}
	dimensions := envelope["dimensions"].(map[string]string)
	if dimensions["campaign"] != "flatkey-us" || dimensions["ad_group_id"] != "ad-group-7" ||
		dimensions["creative_id"] != "creative-9" || dimensions["device"] != "m" {
		t.Fatalf("unexpected dimensions: %#v", dimensions)
	}
}

func TestAttributionEnvelopeRejectsUtmOnlyTrafficForGoogleOfflineUpload(t *testing.T) {
	if envelope := attributionEnvelope(`{"utm_source":"google","utm_campaign":"brand"}`); envelope != nil {
		t.Fatalf("UTM-only traffic must not be treated as click-addressable: %#v", envelope)
	}
}

func TestAdsAttributionOutboxIsTransactionalAndIdempotent(t *testing.T) {
	db := setupAdsAttributionOutboxTestDB(t)
	payload := map[string]any{
		"event_id": "flatkey:purchase:order-1",
		"order_id": "order-1",
		"value":    10.0,
	}

	tx := db.Begin()
	if err := enqueueAdsAttributionInTx(tx, "flatkey:purchase:order-1", "purchase", 7, "order-1", payload); err != nil {
		t.Fatalf("enqueue inside transaction: %v", err)
	}
	if err := tx.Rollback().Error; err != nil {
		t.Fatalf("rollback transaction: %v", err)
	}
	var count int64
	if err := db.Model(&AdsAttributionOutbox{}).Count(&count).Error; err != nil {
		t.Fatalf("count rolled back events: %v", err)
	}
	if count != 0 {
		t.Fatalf("rolled back business transaction leaked %d outbox events", count)
	}

	for attempt := 0; attempt < 2; attempt++ {
		if err := enqueueAdsAttributionInTx(db, "flatkey:purchase:order-1", "purchase", 7, "order-1", payload); err != nil {
			t.Fatalf("idempotent enqueue %d: %v", attempt, err)
		}
	}
	if err := db.Model(&AdsAttributionOutbox{}).Count(&count).Error; err != nil {
		t.Fatalf("count idempotent events: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one event after duplicate enqueue, got %d", count)
	}
}

func TestAdsAttributionOutboxClaimIsExclusiveAndRecoversStaleLease(t *testing.T) {
	db := setupAdsAttributionOutboxTestDB(t)
	payload := map[string]any{"event_id": "flatkey:activation:7:first_api_success"}
	if err := enqueueAdsAttributionInTx(db, payload["event_id"].(string), "activation", 7, "", payload); err != nil {
		t.Fatalf("enqueue activation: %v", err)
	}

	const now = int64(1_800_000_000)
	first, err := ClaimAdsAttributionOutbox(1, now)
	if err != nil || len(first) != 1 {
		t.Fatalf("first claim got %#v, %v", first, err)
	}
	second, err := ClaimAdsAttributionOutbox(1, now)
	if err != nil {
		t.Fatalf("second claim: %v", err)
	}
	if len(second) != 0 {
		t.Fatalf("delivering event was claimed twice: %#v", second)
	}

	recovered, err := ClaimAdsAttributionOutbox(1, now+10*60+1)
	if err != nil || len(recovered) != 1 {
		t.Fatalf("stale lease recovery got %#v, %v", recovered, err)
	}
	if recovered[0].Attempts != 2 {
		t.Fatalf("expected second delivery attempt after lease recovery, got %d", recovered[0].Attempts)
	}
}

func TestAdsAttributionOutboxRetriesThenDeadLetters(t *testing.T) {
	db := setupAdsAttributionOutboxTestDB(t)
	event := AdsAttributionOutbox{
		EventId:   "flatkey:purchase:order-retry",
		EventType: "purchase",
		Status:    AdsAttributionOutboxDelivering,
		Attempts:  1,
	}
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("create delivering event: %v", err)
	}
	const now = int64(1_800_000_000)
	if err := FailAdsAttributionOutbox(event.Id, 1, "temporary", now); err != nil {
		t.Fatalf("schedule retry: %v", err)
	}
	if err := db.First(&event, event.Id).Error; err != nil {
		t.Fatalf("read retry event: %v", err)
	}
	if event.Status != AdsAttributionOutboxPending || event.NextAttemptAt <= now {
		t.Fatalf("unexpected retry state: %#v", event)
	}

	if err := db.Model(&event).Updates(map[string]any{
		"status": AdsAttributionOutboxDelivering, "attempts": 10,
	}).Error; err != nil {
		t.Fatalf("prepare dead-letter attempt: %v", err)
	}
	if err := FailAdsAttributionOutbox(event.Id, 10, "permanent", now); err != nil {
		t.Fatalf("dead-letter event: %v", err)
	}
	if err := db.First(&event, event.Id).Error; err != nil {
		t.Fatalf("read dead-letter event: %v", err)
	}
	if event.Status != AdsAttributionOutboxDead || event.NextAttemptAt != 0 {
		t.Fatalf("unexpected dead-letter state: %#v", event)
	}
}

func TestAdsRefundOutboxUsesCumulativeRestatementAndRetraction(t *testing.T) {
	db := setupAdsAttributionOutboxTestDB(t)
	topUp := &TopUp{
		UserId:          7,
		TradeNo:         "order-refund",
		Money:           10,
		PaymentCurrency: "usd",
		PaymentProvider: PaymentProviderStripe,
	}
	if err := enqueueAdsAttributionInTx(db, "flatkey:purchase:"+topUp.TradeNo, "purchase", topUp.UserId, topUp.TradeNo, map[string]any{
		"event_id": "flatkey:purchase:" + topUp.TradeNo,
	}); err != nil {
		t.Fatalf("seed attributed purchase: %v", err)
	}
	occurredAt := time.Unix(1_800_000_000, 0)
	if err := EnqueueAdsRefund("refund-partial", topUp, 3, 7, occurredAt); err != nil {
		t.Fatalf("enqueue partial refund: %v", err)
	}
	if err := EnqueueAdsRefund("refund-full", topUp, 10, 0, occurredAt.Add(time.Minute)); err != nil {
		t.Fatalf("enqueue full refund: %v", err)
	}

	var events []AdsAttributionOutbox
	if err := db.Order("created_at asc, id asc").Find(&events).Error; err != nil {
		t.Fatalf("read refund events: %v", err)
	}
	if len(events) != 3 {
		t.Fatalf("expected purchase plus two refund adjustments, got %d", len(events))
	}
	var partial map[string]any
	if err := json.Unmarshal([]byte(events[1].Payload), &partial); err != nil {
		t.Fatalf("decode partial refund: %v", err)
	}
	if partial["adjustment_type"] != "restatement" || partial["adjusted_value"] != float64(7) {
		t.Fatalf("unexpected partial refund payload: %#v", partial)
	}
	var full map[string]any
	if err := json.Unmarshal([]byte(events[2].Payload), &full); err != nil {
		t.Fatalf("decode full refund: %v", err)
	}
	if full["adjustment_type"] != "retraction" {
		t.Fatalf("unexpected full refund payload: %#v", full)
	}
	if _, exists := full["adjusted_value"]; exists {
		t.Fatalf("retraction must not send adjusted_value: %#v", full)
	}
}
