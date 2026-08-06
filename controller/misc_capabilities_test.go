package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestFrontendCapabilitiesAreFlatStatuses(t *testing.T) {
	originalLogin := common.PasswordLoginEnabled
	originalRegister := common.RegisterEnabled
	t.Cleanup(func() {
		common.PasswordLoginEnabled = originalLogin
		common.RegisterEnabled = originalRegister
	})
	common.PasswordLoginEnabled = true
	common.RegisterEnabled = true
	t.Setenv("NEXT_FRONTEND_ENABLED", "true")

	capabilities := getFrontendCapabilities(true)
	require.Equal(t, "live", capabilities["next_frontend"])
	require.Equal(t, "live", capabilities["legacy_token"])
	require.Equal(t, "prototype", capabilities["marketplace"])
	require.Equal(t, "prototype", capabilities["two_factor"])
	for feature, status := range capabilities {
		require.Contains(t, []string{"live", "prototype", "disabled"}, status, feature)
	}
}

func TestFrontendCapabilitiesHonorBackendSwitches(t *testing.T) {
	originalLogin := common.PasswordLoginEnabled
	originalRegister := common.RegisterEnabled
	t.Cleanup(func() {
		common.PasswordLoginEnabled = originalLogin
		common.RegisterEnabled = originalRegister
	})
	common.PasswordLoginEnabled = false
	common.RegisterEnabled = false
	t.Setenv("NEXT_FRONTEND_ENABLED", "false")

	capabilities := getFrontendCapabilities(false)
	require.Equal(t, "disabled", capabilities["next_frontend"])
	require.Equal(t, "disabled", capabilities["login"])
	require.Equal(t, "disabled", capabilities["registration"])
	require.Equal(t, "disabled", capabilities["passkey"])
}
