package service

import (
	"errors"
	"testing"
)

type fakeCharger struct {
	name   string
	calls  int
	result error
}

func (f *fakeCharger) ProviderName() string { return f.name }
func (f *fakeCharger) ChargeDue() error     { f.calls++; return f.result }

func TestChargeDueAgreementSubscriptionsNoopWhenEmpty(t *testing.T) {
	recurringChargersMu.Lock()
	recurringChargers = map[string]RecurringCharger{}
	recurringChargersMu.Unlock()
	ChargeDueAgreementSubscriptions() // must not panic — the HK/Airwallex steady state
}

func TestChargeDueAgreementSubscriptionsRunsRegisteredChargers(t *testing.T) {
	recurringChargersMu.Lock()
	recurringChargers = map[string]RecurringCharger{}
	recurringChargersMu.Unlock()

	wechat := &fakeCharger{name: "wechatpay"}
	alipay := &fakeCharger{name: "alipay", result: errors.New("boom")}
	RegisterRecurringCharger(wechat)
	RegisterRecurringCharger(alipay)

	ChargeDueAgreementSubscriptions()
	if wechat.calls != 1 || alipay.calls != 1 {
		t.Fatalf("expected each charger called once, got wechat=%d alipay=%d", wechat.calls, alipay.calls)
	}

	if rc, ok := GetRecurringCharger("wechatpay"); !ok || rc.ProviderName() != "wechatpay" {
		t.Fatal("registry lookup failed")
	}
	if _, ok := GetRecurringCharger("airwallex"); ok {
		t.Fatal("airwallex must never register as agreement-based")
	}

	recurringChargersMu.Lock()
	recurringChargers = map[string]RecurringCharger{}
	recurringChargersMu.Unlock()
}
