package operation_setting

import (
	"encoding/json"
	"testing"
)

func restorePaymentSetting(t *testing.T) func() {
	t.Helper()

	original := paymentSetting
	original.AmountDiscount = make(map[int]float64, len(paymentSetting.AmountDiscount))
	for amount, discount := range paymentSetting.AmountDiscount {
		original.AmountDiscount[amount] = discount
	}
	original.BusinessFeatures = CopyBusinessFeatures(paymentSetting.BusinessFeatures)
	original.ProviderSceneScopes = CopyProviderSceneScopes(paymentSetting.ProviderSceneScopes)

	return func() {
		paymentSetting = original
	}
}

func TestNormalizePaymentSettingDefaults(t *testing.T) {
	defer restorePaymentSetting(t)()

	paymentSetting = PaymentSetting{}
	NormalizePaymentSetting()

	for feature, enabled := range DefaultBusinessFeatures() {
		if paymentSetting.BusinessFeatures[feature] != enabled {
			t.Fatalf("feature %s = %v, want %v", feature, paymentSetting.BusinessFeatures[feature], enabled)
		}
	}
	for provider, scenes := range DefaultProviderSceneScopes() {
		for scene, allowed := range scenes {
			if paymentSetting.ProviderSceneScopes[provider][scene] != allowed {
				t.Fatalf("scope %s/%s = %v, want %v", provider, scene, paymentSetting.ProviderSceneScopes[provider][scene], allowed)
			}
		}
	}
	if paymentSetting.AmountDiscount == nil {
		t.Fatal("AmountDiscount should be initialized")
	}
}

func TestNormalizePaymentSettingPreservesExplicitFalseAndDropsUnknownKeys(t *testing.T) {
	defer restorePaymentSetting(t)()

	paymentSetting = PaymentSetting{
		BusinessFeatures: map[string]bool{
			BillingFeatureWalletTopUp:      false,
			BillingFeatureInvitationReward: false,
			"walletTopup":                  true,
		},
		ProviderSceneScopes: map[string]map[string]bool{
			PaymentProviderEpay: {
				PaymentSceneWalletTopUp: false,
			},
			PaymentProviderStripe: {
				"subscription": true,
			},
			"paypal": {
				PaymentSceneWalletTopUp: true,
			},
		},
	}

	NormalizePaymentSetting()

	if paymentSetting.BusinessFeatures[BillingFeatureWalletTopUp] {
		t.Fatal("explicit wallet_topup=false should be preserved")
	}
	if _, ok := paymentSetting.BusinessFeatures["walletTopup"]; ok {
		t.Fatal("unknown business feature should be dropped")
	}
	if _, ok := paymentSetting.BusinessFeatures[BillingFeatureInvitationReward]; ok {
		t.Fatal("legacy business feature should be dropped")
	}
	if !paymentSetting.BusinessFeatures[BillingFeatureSubscriptionPurchase] {
		t.Fatal("missing subscription_purchase should be filled from defaults")
	}
	if paymentSetting.ProviderSceneScopes[PaymentProviderEpay][PaymentSceneWalletTopUp] {
		t.Fatal("explicit epay wallet_topup=false should be preserved")
	}
	if !paymentSetting.ProviderSceneScopes[PaymentProviderEpay][PaymentSceneSubscriptionPurchase] {
		t.Fatal("missing epay subscription_purchase should be filled from defaults")
	}
	if _, ok := paymentSetting.ProviderSceneScopes[PaymentProviderStripe]["subscription"]; ok {
		t.Fatal("unknown payment scene should be dropped")
	}
	if _, ok := paymentSetting.ProviderSceneScopes["paypal"]; ok {
		t.Fatal("unknown payment provider should be dropped")
	}
}

func TestValidateBillingCapabilityConfig(t *testing.T) {
	if err := ValidateBusinessFeaturesJSON(`{"wallet_topup":false}`); err != nil {
		t.Fatalf("valid business features should pass: %v", err)
	}
	if err := ValidateBusinessFeaturesJSON(`{"invitation_reward":false}`); err != nil {
		t.Fatalf("legacy business feature should be accepted: %v", err)
	}
	if err := ValidateProviderSceneScopesJSON(`{"epay":{"subscription_purchase":true}}`); err != nil {
		t.Fatalf("valid provider scene scopes should pass: %v", err)
	}
	if err := ValidateBusinessFeaturesJSON(`{"walletTopup":true}`); err == nil {
		t.Fatal("unknown business feature should fail validation")
	}
	if err := ValidateProviderSceneScopesJSON(`{"paypal":{"wallet_topup":true}}`); err == nil {
		t.Fatal("unknown payment provider should fail validation")
	}
	if err := ValidateProviderSceneScopesJSON(`{"epay":{"subscription":true}}`); err == nil {
		t.Fatal("unknown payment scene should fail validation")
	}
}

func TestNormalizeBusinessFeaturesJSONDropsLegacyKeys(t *testing.T) {
	normalized, err := NormalizeBusinessFeaturesJSON(
		`{"wallet_topup":false,"invitation_reward":false,"checkin_reward":false}`,
	)
	if err != nil {
		t.Fatalf("normalization should accept legacy keys: %v", err)
	}

	var features map[string]bool
	if err := json.Unmarshal([]byte(normalized), &features); err != nil {
		t.Fatalf("normalized features should be valid JSON: %v", err)
	}
	if features[BillingFeatureWalletTopUp] {
		t.Fatal("explicit wallet_topup=false should be preserved")
	}
	if _, ok := features[BillingFeatureInvitationReward]; ok {
		t.Fatal("legacy invitation_reward should not be written back")
	}
	if _, ok := features[BillingFeatureCheckinReward]; ok {
		t.Fatal("legacy checkin_reward should not be written back")
	}
}
