package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestConsolePaymentReturnPathPrefersConfiguredConsoleOrigin(t *testing.T) {
	originalTheme := common.GetTheme()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		common.SetTheme(originalTheme)
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	common.SetTheme("classic")
	system_setting.ServerAddress = "https://router.flatkey.ai/"
	system_setting.GetAppConsoleSettings().Origin = "https://console.flatkey.ai/"

	require.Equal(t, "https://console.flatkey.ai/console/log", consolePaymentReturnPath("/console/log"))
}

func TestConsolePaymentReturnPathFallsBackToServerAddress(t *testing.T) {
	originalTheme := common.GetTheme()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		common.SetTheme(originalTheme)
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	common.SetTheme("classic")
	system_setting.ServerAddress = "https://router.flatkey.ai/"
	system_setting.GetAppConsoleSettings().Origin = " "

	require.Equal(t, "https://router.flatkey.ai/console/topup", consolePaymentReturnPath("/console/topup"))
}

func TestConsolePaymentReturnPathFallsBackForInvalidConsoleOrigin(t *testing.T) {
	originalTheme := common.GetTheme()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		common.SetTheme(originalTheme)
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	common.SetTheme("classic")
	system_setting.ServerAddress = "https://router.flatkey.ai/"

	tests := []string{
		"console.flatkey.ai",
		"//console.flatkey.ai",
		"https://console.flatkey.ai/path",
		"javascript:alert(1)",
	}

	for _, origin := range tests {
		t.Run(origin, func(t *testing.T) {
			system_setting.GetAppConsoleSettings().Origin = origin
			require.Equal(t, "https://router.flatkey.ai/console/topup", consolePaymentReturnPath("/console/topup"))
		})
	}
}

func TestPaymentReturnPathKeepsServerAddressDefault(t *testing.T) {
	originalTheme := common.GetTheme()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		common.SetTheme(originalTheme)
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	common.SetTheme("classic")
	system_setting.ServerAddress = "https://router.flatkey.ai/"
	system_setting.GetAppConsoleSettings().Origin = "https://console.flatkey.ai/"

	require.Equal(t, "https://router.flatkey.ai/console/topup", paymentReturnPath("/console/topup"))
}

func TestConsoleReturnPathBuildsRegistrationVerificationURL(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	system_setting.ServerAddress = "https://router.flatkey.ai/"
	system_setting.GetAppConsoleSettings().Origin = "https://console.flatkey.ai/"

	require.Equal(t, "https://console.flatkey.ai/sign-up/verify", consoleReturnPath("/sign-up/verify"))
	require.Equal(t, "https://console.flatkey.ai/sign-up/verify#token=token%2Fwith%3Fchars", registrationEmailVerificationURL("token/with?chars"))
}

func TestConsoleReturnPathFallsBackForRegistrationVerificationURL(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	system_setting.ServerAddress = "https://router.flatkey.ai/"
	system_setting.GetAppConsoleSettings().Origin = " "

	require.Equal(t, "https://router.flatkey.ai/sign-up/verify", consoleReturnPath("/sign-up/verify"))
}
