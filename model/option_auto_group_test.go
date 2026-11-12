package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsInvalidMaxTokenAutoGroups(t *testing.T) {
	for _, value := range []string{"", "0", "-1", "1.5", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue("MaxTokenAutoGroups", value))
		})
	}
	require.NoError(t, validateOptionValue("MaxTokenAutoGroups", "999999"))
}

func TestValidateOptionValueGroupVendorAcceptsOnlyKnownVendors(t *testing.T) {
	for _, value := range []string{"", "{}", `{"claude-max":"anthropic","gemini":"google","misc":"other"}`} {
		assert.NoError(t, validateOptionValue("GroupVendor", value), value)
	}
	for _, value := range []string{`{"claude-max":"claude"}`, `{"a":1}`, `["openai"]`, "not json"} {
		assert.Error(t, validateOptionValue("GroupVendor", value), value)
	}
}

func TestValidateOptionValueAcceptsOnlyBooleanAbnormalBillingSwitches(t *testing.T) {
	for _, field := range []string{
		"continue_after_cloudflare_truncation",
		"charge_policy_block",
	} {
		key := "abnormal_billing_setting." + field
		for _, value := range []string{"true", "false"} {
			assert.NoError(t, validateOptionValue(key, value), "%s=%s", key, value)
		}
		for _, value := range []string{"", "1", "0", "TRUE", "yes", " true"} {
			assert.Error(t, validateOptionValue(key, value), "%s=%q must be rejected", key, value)
		}
	}
	assert.Error(t, validateOptionValue("abnormal_billing_setting.charge_everything", "true"), "unknown switches must be rejected")
	assert.Error(t, validateOptionValue("abnormal_billing_setting.align_with_official", "true"), "removed switches must be rejected")
	assert.Error(t, validateOptionValue("abnormal_billing_setting.match_upstream_charge", "true"), "removed switches must be rejected")
	assert.Error(t, validateOptionValue("abnormal_billing_setting.charge_upstream_billed_failure", "true"), "removed switches must be rejected")
}
