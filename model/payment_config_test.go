package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func withPaymentConfigTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldSQLite := common.UsingSQLite
	common.UsingSQLite = true
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldSQLite
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(&PaymentConfig{}); err != nil {
		t.Fatalf("migrate payment config: %v", err)
	}
}

func TestPaymentConfigCRUDByProvider(t *testing.T) {
	withPaymentConfigTestDB(t)

	config := &PaymentConfig{
		Provider:    PaymentProviderAlipay,
		Name:        "Alipay",
		DisplayName: "支付宝",
		Enabled:     true,
		SortOrder:   20,
		AppID:       "app-1",
	}
	if err := CreatePaymentConfig(config); err != nil {
		t.Fatalf("CreatePaymentConfig returned error: %v", err)
	}

	got, err := GetPaymentConfigByProvider(PaymentProviderAlipay)
	if err != nil {
		t.Fatalf("GetPaymentConfigByProvider returned error: %v", err)
	}
	if got.Provider != PaymentProviderAlipay || got.DisplayName != "支付宝" {
		t.Fatalf("unexpected config: %+v", got)
	}

	got.Enabled = false
	if err := UpdatePaymentConfig(got); err != nil {
		t.Fatalf("UpdatePaymentConfig returned error: %v", err)
	}
	if _, err := GetEnabledPaymentConfigByProvider(PaymentProviderAlipay); err == nil {
		t.Fatal("GetEnabledPaymentConfigByProvider returned disabled config")
	}
}

func TestGetEnabledPaymentConfigsSorted(t *testing.T) {
	withPaymentConfigTestDB(t)

	configs := []*PaymentConfig{
		{Provider: PaymentProviderWechat, Name: "WeChat", Enabled: true, SortOrder: 30},
		{Provider: PaymentProviderAlipay, Name: "Alipay", Enabled: true, SortOrder: 10},
	}
	for _, config := range configs {
		if err := CreatePaymentConfig(config); err != nil {
			t.Fatalf("CreatePaymentConfig returned error: %v", err)
		}
	}

	got, err := GetEnabledPaymentConfigs()
	if err != nil {
		t.Fatalf("GetEnabledPaymentConfigs returned error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(GetEnabledPaymentConfigs) = %d, want 2", len(got))
	}
	if got[0].Provider != PaymentProviderAlipay || got[1].Provider != PaymentProviderWechat {
		t.Fatalf("configs not sorted by sort_order: %+v", got)
	}
}
