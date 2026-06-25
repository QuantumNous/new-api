package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func TestTopUpURLUsesThemeAwareTopupPath(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalTheme := common.GetTheme()
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		common.SetTheme(originalTheme)
	})

	system_setting.ServerAddress = "https://console.flatkey.ai"

	tests := []struct {
		name  string
		theme string
		want  string
	}{
		{name: "classic theme", theme: "classic", want: "https://console.flatkey.ai/console/topup"},
		{name: "default theme", theme: "default", want: "https://console.flatkey.ai/wallet"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			common.SetTheme(tt.theme)
			if got := topUpURL(); got != tt.want {
				t.Fatalf("topUpURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTopUpURLSkipsLoopbackServerAddress(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalTheme := common.GetTheme()
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		common.SetTheme(originalTheme)
	})

	common.SetTheme("classic")

	tests := []struct {
		name          string
		serverAddress string
	}{
		{name: "ipv4 loopback", serverAddress: "http://127.0.0.1:3000"},
		{name: "ipv6 loopback", serverAddress: "http://[::1]:3000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			system_setting.ServerAddress = tt.serverAddress
			if got := topUpURL(); got != "" {
				t.Fatalf("topUpURL() = %q, want empty for loopback address", got)
			}
		})
	}
}
