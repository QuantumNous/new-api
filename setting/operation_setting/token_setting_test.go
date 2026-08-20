package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRequireEmailVerificationForTokens(t *testing.T) {
	prevEnabled := common.EmailVerificationEnabled
	prevSetting := tokenSetting.RequireEmailVerification
	t.Cleanup(func() {
		common.EmailVerificationEnabled = prevEnabled
		tokenSetting.RequireEmailVerification = prevSetting
	})

	// Both the feature flag and the token toggle must be on.
	common.EmailVerificationEnabled = true
	tokenSetting.RequireEmailVerification = true
	require.True(t, RequireEmailVerificationForTokens())

	// Toggle off -> no enforcement.
	tokenSetting.RequireEmailVerification = false
	require.False(t, RequireEmailVerificationForTokens())

	// Feature flag off -> no enforcement regardless of the toggle.
	tokenSetting.RequireEmailVerification = true
	common.EmailVerificationEnabled = false
	require.False(t, RequireEmailVerificationForTokens())
}
