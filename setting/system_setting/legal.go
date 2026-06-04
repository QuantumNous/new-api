package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type LegalSettings struct {
	UserAgreement string `json:"user_agreement"`
	PrivacyPolicy string `json:"privacy_policy"`
	RefundPolicy  string `json:"refund_policy"`
	// AuthNoticeEnabled controls whether the Terms of Service / Privacy Policy
	// consent notice is shown at the bottom of the sign-in and sign-up pages.
	// Decoupled from whether the documents above have content, because the
	// linked pages always fall back to built-in default documents.
	AuthNoticeEnabled bool `json:"auth_notice_enabled"`
}

var defaultLegalSettings = LegalSettings{
	UserAgreement:     "",
	PrivacyPolicy:     "",
	RefundPolicy:      "",
	AuthNoticeEnabled: false,
}

func init() {
	config.GlobalConfig.Register("legal", &defaultLegalSettings)
}

func GetLegalSettings() *LegalSettings {
	return &defaultLegalSettings
}
