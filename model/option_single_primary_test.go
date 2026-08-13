package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateSinglePrimaryOptionRequiresSMTPAndRejectsLegacyEmailKey(t *testing.T) {
	originalServer, originalPort := common.SMTPServer, common.SMTPPort
	originalAccount, originalToken := common.SMTPAccount, common.SMTPToken
	originalFrom := common.SMTPFrom
	originalEmailKey, originalSingle := common.EmailDefaultTokenEnabled, common.SinglePrimaryAPIKeyEnabled
	t.Cleanup(func() {
		common.SMTPServer, common.SMTPPort = originalServer, originalPort
		common.SMTPAccount, common.SMTPToken = originalAccount, originalToken
		common.SMTPFrom = originalFrom
		common.EmailDefaultTokenEnabled, common.SinglePrimaryAPIKeyEnabled = originalEmailKey, originalSingle
	})

	common.SMTPServer, common.SMTPPort = "", 587
	common.SMTPAccount, common.SMTPToken = "", ""
	common.EmailDefaultTokenEnabled, common.SinglePrimaryAPIKeyEnabled = false, false
	err := validateOptionValue("SinglePrimaryAPIKeyEnabled", "true")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "SMTP")

	common.SMTPServer, common.SMTPAccount, common.SMTPToken = "smtp.example.com", "no-reply@example.com", "app-password"
	common.SMTPFrom = ""
	common.EmailDefaultTokenEnabled = true
	err = validateOptionValue("SinglePrimaryAPIKeyEnabled", "true")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "完整 Key")

	common.EmailDefaultTokenEnabled = false
	common.SinglePrimaryAPIKeyEnabled = true
	err = validateOptionValue("SMTPFrom", "invalid-from")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "SMTP")
}

func TestValidateSinglePrimaryOptionKeepsLoginAndRolesIndependent(t *testing.T) {
	originalSingle := common.SinglePrimaryAPIKeyEnabled
	t.Cleanup(func() { common.SinglePrimaryAPIKeyEnabled = originalSingle })
	common.SinglePrimaryAPIKeyEnabled = true

	err := validateOptionValue("APIKeyLoginEnabled", "false")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "API Key 登录")

	// The option validator only governs mode wiring; role-specific token
	// enforcement remains in ValidatePrimaryUserTokenForLogin.
	assert.NoError(t, validateOptionValue("APIKeyLoginEnabled", "true"))
}

func TestLegacyEmailTokenModeDoesNotForceSingleKey(t *testing.T) {
	// The legacy mail-delivery switch must not silently change token-count
	// semantics when the complete single-primary mode is disabled.
	originalSingle, originalEmail := common.SinglePrimaryAPIKeyEnabled, common.EmailDefaultTokenEnabled
	t.Cleanup(func() {
		common.SinglePrimaryAPIKeyEnabled = originalSingle
		common.EmailDefaultTokenEnabled = originalEmail
	})
	common.SinglePrimaryAPIKeyEnabled = false
	common.EmailDefaultTokenEnabled = true

	// validateOptionValue is the mode boundary; enabling the legacy switch
	// remains valid and does not imply SinglePrimaryAPIKeyEnabled.
	assert.NoError(t, validateOptionValue("EmailDefaultTokenEnabled", "true"))
	assert.False(t, common.SinglePrimaryAPIKeyEnabled)
}
