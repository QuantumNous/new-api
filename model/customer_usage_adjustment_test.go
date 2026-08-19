package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupCustomerUsageAdjustmentTestDB(t *testing.T) {
	t.Helper()
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&Log{}, &CustomerUsageAdjustment{}); err != nil {
		t.Fatal(err)
	}
	LOG_DB = db
	common.UsingSQLite = true
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
	})
}

func TestCreateCustomerUsageAdjustmentValidatesImmutableSource(t *testing.T) {
	setupCustomerUsageAdjustmentTestDB(t)
	log := &Log{UserId: 42, Type: LogTypeConsume, CreatedAt: 1000, Quota: 500}
	if err := LOG_DB.Create(log).Error; err != nil {
		t.Fatal(err)
	}
	adjustment := &CustomerUsageAdjustment{
		AdjustmentID: "refund:42:1", CustomerID: 42, EventType: CustomerUsageAdjustmentEventRefund,
		SourceTransactionID: strconv.Itoa(log.Id), AmountDeltaQuota: -500, ReasonCode: "UPSTREAM_REVERSAL", OccurredAt: 1001,
	}
	if err := CreateCustomerUsageAdjustment(adjustment); err != nil {
		t.Fatalf("create adjustment: %v", err)
	}
	if err := CreateCustomerUsageAdjustment(adjustment); err != nil {
		t.Fatalf("idempotent replay: %v", err)
	}
	conflict := *adjustment
	conflict.AmountDeltaQuota = -499
	if err := CreateCustomerUsageAdjustment(&conflict); err == nil {
		t.Fatal("expected conflicting duplicate to fail")
	}
	crossCustomer := *adjustment
	crossCustomer.AdjustmentID = "refund:99:1"
	crossCustomer.CustomerID = 99
	if err := CreateCustomerUsageAdjustment(&crossCustomer); err == nil {
		t.Fatal("expected cross-customer source to fail")
	}
	invalid := *adjustment
	invalid.AdjustmentID = "invalid:1"
	invalid.EventType = "LEGACY_REFUND"
	if err := CreateCustomerUsageAdjustment(&invalid); err == nil {
		t.Fatal("expected invalid event type to fail")
	}
}
