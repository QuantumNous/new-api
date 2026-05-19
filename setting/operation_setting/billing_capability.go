package operation_setting

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	BillingFeatureWalletTopUp          = "wallet_topup"
	BillingFeatureSubscriptionPurchase = "subscription_purchase"
	BillingFeatureRedemptionRedeem     = "redemption_redeem"

	// Legacy keys are accepted when reading older saved JSON, but they are not
	// active billing switches anymore. Each feature is controlled elsewhere.
	BillingFeatureRedemptionManage   = "redemption_manage"
	BillingFeatureInvitationReward   = "invitation_reward"
	BillingFeatureInvitationTransfer = "invitation_transfer"
	BillingFeatureCheckinReward      = "checkin_reward"

	PaymentSceneWalletTopUp          = "wallet_topup"
	PaymentSceneSubscriptionPurchase = "subscription_purchase"
	PaymentProviderEpay              = "epay"
	PaymentProviderStripe            = "stripe"
	PaymentProviderCreem             = "creem"
	PaymentProviderWaffo             = "waffo"
	PaymentProviderWaffoPancake      = "waffo_pancake"
)

var knownBillingFeatures = map[string]struct{}{
	BillingFeatureWalletTopUp:          {},
	BillingFeatureSubscriptionPurchase: {},
	BillingFeatureRedemptionRedeem:     {},
}

var legacyBillingFeatureKeys = map[string]struct{}{
	BillingFeatureRedemptionManage:   {},
	BillingFeatureInvitationReward:   {},
	BillingFeatureInvitationTransfer: {},
	BillingFeatureCheckinReward:      {},
}

var knownPaymentScenes = map[string]struct{}{
	PaymentSceneWalletTopUp:          {},
	PaymentSceneSubscriptionPurchase: {},
}

var knownPaymentProviders = map[string]struct{}{
	PaymentProviderEpay:         {},
	PaymentProviderStripe:       {},
	PaymentProviderCreem:        {},
	PaymentProviderWaffo:        {},
	PaymentProviderWaffoPancake: {},
}

func DefaultBusinessFeatures() map[string]bool {
	return map[string]bool{
		BillingFeatureWalletTopUp:          true,
		BillingFeatureSubscriptionPurchase: true,
		BillingFeatureRedemptionRedeem:     true,
	}
}

func DefaultProviderSceneScopes() map[string]map[string]bool {
	return map[string]map[string]bool{
		PaymentProviderEpay: {
			PaymentSceneWalletTopUp:          true,
			PaymentSceneSubscriptionPurchase: true,
		},
		PaymentProviderStripe: {
			PaymentSceneWalletTopUp:          true,
			PaymentSceneSubscriptionPurchase: true,
		},
		PaymentProviderCreem: {
			PaymentSceneWalletTopUp:          true,
			PaymentSceneSubscriptionPurchase: true,
		},
		PaymentProviderWaffo: {
			PaymentSceneWalletTopUp:          true,
			PaymentSceneSubscriptionPurchase: false,
		},
		PaymentProviderWaffoPancake: {
			PaymentSceneWalletTopUp:          true,
			PaymentSceneSubscriptionPurchase: false,
		},
	}
}

func NormalizePaymentSetting() {
	if paymentSetting.AmountDiscount == nil {
		paymentSetting.AmountDiscount = map[int]float64{}
	}
	normalizeBusinessFeatures(&paymentSetting.BusinessFeatures)
	normalizeProviderSceneScopes(&paymentSetting.ProviderSceneScopes)
}

func normalizeBusinessFeatures(features *map[string]bool) {
	defaults := DefaultBusinessFeatures()
	if *features == nil {
		*features = defaults
		return
	}
	for feature := range *features {
		if !IsKnownBillingFeature(feature) {
			delete(*features, feature)
		}
	}
	for feature, enabled := range defaults {
		if _, ok := (*features)[feature]; !ok {
			(*features)[feature] = enabled
		}
	}
}

func normalizeProviderSceneScopes(scopes *map[string]map[string]bool) {
	defaults := DefaultProviderSceneScopes()
	if *scopes == nil {
		*scopes = defaults
		return
	}
	for provider, scenes := range *scopes {
		if !IsKnownPaymentProvider(provider) {
			delete(*scopes, provider)
			continue
		}
		if scenes == nil {
			scenes = map[string]bool{}
			(*scopes)[provider] = scenes
		}
		for scene := range scenes {
			if !IsKnownPaymentScene(scene) {
				delete(scenes, scene)
			}
		}
	}
	for provider, defaultScenes := range defaults {
		if _, ok := (*scopes)[provider]; !ok {
			(*scopes)[provider] = map[string]bool{}
		}
		for scene, allowed := range defaultScenes {
			if _, ok := (*scopes)[provider][scene]; !ok {
				(*scopes)[provider][scene] = allowed
			}
		}
	}
}

func IsBillingFeatureEnabled(feature string) bool {
	if !IsKnownBillingFeature(feature) {
		return false
	}
	setting := GetPaymentSetting()
	return setting.BusinessFeatures[feature]
}

func IsPaymentProviderAllowedForScene(provider string, scene string) bool {
	if !IsKnownPaymentProvider(provider) || !IsKnownPaymentScene(scene) {
		return false
	}
	setting := GetPaymentSetting()
	scopes := setting.ProviderSceneScopes[provider]
	if scopes == nil {
		return false
	}
	return scopes[scene]
}

func IsKnownBillingFeature(feature string) bool {
	_, ok := knownBillingFeatures[feature]
	return ok
}

func IsKnownPaymentScene(scene string) bool {
	_, ok := knownPaymentScenes[scene]
	return ok
}

func IsKnownPaymentProvider(provider string) bool {
	_, ok := knownPaymentProviders[provider]
	return ok
}

func CopyBusinessFeatures(features map[string]bool) map[string]bool {
	copied := make(map[string]bool, len(features))
	for feature, enabled := range features {
		copied[feature] = enabled
	}
	return copied
}

func CopyProviderSceneScopes(scopes map[string]map[string]bool) map[string]map[string]bool {
	copied := make(map[string]map[string]bool, len(scopes))
	for provider, scenes := range scopes {
		copied[provider] = make(map[string]bool, len(scenes))
		for scene, allowed := range scenes {
			copied[provider][scene] = allowed
		}
	}
	return copied
}

func ValidateBusinessFeatures(features map[string]bool) error {
	for feature := range features {
		if !IsKnownBillingFeature(feature) && !IsLegacyBillingFeatureKey(feature) {
			return fmt.Errorf("unknown billing feature: %s", feature)
		}
	}
	return nil
}

func IsLegacyBillingFeatureKey(feature string) bool {
	_, ok := legacyBillingFeatureKeys[feature]
	return ok
}

func ValidateProviderSceneScopes(scopes map[string]map[string]bool) error {
	for provider, scenes := range scopes {
		if !IsKnownPaymentProvider(provider) {
			return fmt.Errorf("unknown payment provider: %s", provider)
		}
		if scenes == nil {
			return fmt.Errorf("payment provider %s has empty scene scope", provider)
		}
		for scene := range scenes {
			if !IsKnownPaymentScene(scene) {
				return fmt.Errorf("unknown payment scene for provider %s: %s", provider, scene)
			}
		}
	}
	return nil
}

func ValidateBusinessFeaturesJSON(raw string) error {
	var features map[string]bool
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &features); err != nil {
		return err
	}
	return ValidateBusinessFeatures(features)
}

func NormalizeBusinessFeaturesJSON(raw string) (string, error) {
	var features map[string]bool
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &features); err != nil {
		return "", err
	}
	if err := ValidateBusinessFeatures(features); err != nil {
		return "", err
	}
	normalizeBusinessFeatures(&features)
	bytes, err := json.Marshal(features)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func ValidateProviderSceneScopesJSON(raw string) error {
	var scopes map[string]map[string]bool
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &scopes); err != nil {
		return err
	}
	return ValidateProviderSceneScopes(scopes)
}
