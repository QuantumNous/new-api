package billing_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const AbnormalBillingOptionPrefix = "abnormal_billing_setting."

// AbnormalBillingSetting decides whether requests that ended abnormally are
// still charged. Without any switch here, an interrupted response is charged
// the usage produced so far, a client that leaves after the request reached
// upstream is charged the estimated input, and an upstream or gateway failure
// before the response started is always refunded.
//
// ContinueAfterCloudflareTruncation keeps a relay running after Cloudflare
// cut an idle connection so the real usage is settled. Upstream new-api has
// no such behavior.
//
// ChargePolicyBlock charges a request upstream refused by a safety policy
// (cyber_policy and the like). Off, such a request is never charged, as
// Sub2API does.
// DB keys: abnormal_billing_setting.<json field>
type AbnormalBillingSetting struct {
	ContinueAfterCloudflareTruncation bool `json:"continue_after_cloudflare_truncation"`
	ChargePolicyBlock                 bool `json:"charge_policy_block"`
}

var abnormalBillingSetting = AbnormalBillingSetting{
	ContinueAfterCloudflareTruncation: true,
}

func init() {
	config.GlobalConfig.Register("abnormal_billing_setting", &abnormalBillingSetting)
}

func GetAbnormalBillingSetting() AbnormalBillingSetting {
	return abnormalBillingSetting
}

// ChargePolicyBlock reports whether a request upstream refused by a safety
// policy is charged.
func ChargePolicyBlock() bool {
	return abnormalBillingSetting.ChargePolicyBlock
}

// ContinueAfterCloudflareTruncation reports whether a relay keeps reading
// upstream after Cloudflare truncated the client connection.
func ContinueAfterCloudflareTruncation() bool {
	return abnormalBillingSetting.ContinueAfterCloudflareTruncation
}

// ValidateAbnormalBillingOption accepts only the declared switches with an
// explicit true/false value, so a typo can never silently keep the old policy.
func ValidateAbnormalBillingOption(key, value string) error {
	field, ok := strings.CutPrefix(key, AbnormalBillingOptionPrefix)
	if !ok {
		return nil
	}
	switch field {
	case "continue_after_cloudflare_truncation",
		"charge_policy_block":
	default:
		return fmt.Errorf("unknown abnormal billing option %q", key)
	}
	if value != "true" && value != "false" {
		return fmt.Errorf("%s must be true or false", key)
	}
	return nil
}
