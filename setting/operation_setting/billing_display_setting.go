package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// BillingDisplaySetting controls user-facing billing labels and optional panels.
// It does not affect quota calculation, payment order creation, or subscriptions.
type BillingDisplaySetting struct {
	PublicWelfareTextEnabled bool `json:"public_welfare_text_enabled"`
	InvitationPanelEnabled   bool `json:"invitation_panel_enabled"`
}

var billingDisplaySetting = BillingDisplaySetting{
	PublicWelfareTextEnabled: false,
	InvitationPanelEnabled:   true,
}

func init() {
	config.GlobalConfig.Register("billing_display_setting", &billingDisplaySetting)
}

func GetBillingDisplaySetting() BillingDisplaySetting {
	return billingDisplaySetting
}
