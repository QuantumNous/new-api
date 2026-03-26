package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func TestNormalizeInternalReturnTo(t *testing.T) {
	testCases := []struct {
		name         string
		raw          string
		defaultPath  string
		expectedPath string
	}{
		{
			name:         "empty uses default",
			raw:          "",
			defaultPath:  "/console/topup",
			expectedPath: "/console/topup",
		},
		{
			name:         "relative path allowed",
			raw:          "/console/topup?tab=sub#history",
			defaultPath:  "/console/topup",
			expectedPath: "/console/topup?tab=sub#history",
		},
		{
			name:         "external url blocked",
			raw:          "https://example.com/evil",
			defaultPath:  "/console/topup",
			expectedPath: "/console/topup",
		},
		{
			name:         "protocol relative blocked",
			raw:          "//example.com/evil",
			defaultPath:  "/console/topup",
			expectedPath: "/console/topup",
		},
		{
			name:         "missing slash blocked",
			raw:          "console/topup",
			defaultPath:  "/console/topup",
			expectedPath: "/console/topup",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			actualPath := NormalizeInternalReturnTo(testCase.raw, testCase.defaultPath)
			if actualPath != testCase.expectedPath {
				t.Fatalf("expected %q, got %q", testCase.expectedPath, actualPath)
			}
		})
	}
}

func TestMergeAlipayOrderPayload(t *testing.T) {
	base := MergeAlipayOrderPayload("", &AlipayOrderPayload{
		Scene:    AlipaySceneTopUp,
		Title:    "余额充值",
		ReturnTo: "/console/topup",
	})

	merged := ParseAlipayOrderPayload(
		MergeAlipayOrderPayload(base, &AlipayOrderPayload{
			QRCode:    "https://qr.example.com",
			ExpiresAt: 1234567890,
			NotifyPayload: map[string]string{
				"trade_status": "TRADE_SUCCESS",
			},
		}),
	)

	if merged.Scene != AlipaySceneTopUp {
		t.Fatalf("expected scene %q, got %q", AlipaySceneTopUp, merged.Scene)
	}
	if merged.Title != "余额充值" {
		t.Fatalf("expected title to be preserved, got %q", merged.Title)
	}
	if merged.QRCode != "https://qr.example.com" {
		t.Fatalf("expected qr code to be updated, got %q", merged.QRCode)
	}
	if merged.ExpiresAt != 1234567890 {
		t.Fatalf("expected expires_at to be updated, got %d", merged.ExpiresAt)
	}
	if merged.NotifyPayload["trade_status"] != "TRADE_SUCCESS" {
		t.Fatalf("expected notify payload to be merged")
	}
}

func TestAlipayF2FReadyRequiresNotifyURL(t *testing.T) {
	previousEnabled := setting.AlipayF2FEnabled
	previousAppID := setting.AlipayF2FAppID
	previousPrivateKey := setting.AlipayF2FPrivateKey
	previousPublicKey := setting.AlipayF2FPublicKey
	previousNotifyURL := setting.AlipayF2FNotifyUrl
	previousServerAddress := system_setting.ServerAddress
	defer func() {
		setting.AlipayF2FEnabled = previousEnabled
		setting.AlipayF2FAppID = previousAppID
		setting.AlipayF2FPrivateKey = previousPrivateKey
		setting.AlipayF2FPublicKey = previousPublicKey
		setting.AlipayF2FNotifyUrl = previousNotifyURL
		system_setting.ServerAddress = previousServerAddress
	}()

	setting.AlipayF2FEnabled = true
	setting.AlipayF2FAppID = "app-id"
	setting.AlipayF2FPrivateKey = "private-key"
	setting.AlipayF2FPublicKey = "public-key"
	setting.AlipayF2FNotifyUrl = ""
	system_setting.ServerAddress = ""

	if AlipayF2FReady() {
		t.Fatal("expected alipay f2f to be unavailable without notify url")
	}

	system_setting.ServerAddress = "https://console.example.com"
	if !AlipayF2FReady() {
		t.Fatal("expected alipay f2f to be ready when server address can derive notify url")
	}
}

func TestResolveRequestBaseURL(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://api.example.com/api/user/alipay/pay", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Origin", "https://console.example.com")

	if actual := ResolveRequestBaseURL(req); actual != "https://console.example.com" {
		t.Fatalf("expected origin base url, got %q", actual)
	}

	req.Header.Del("Origin")
	req.Header.Set("Referer", "https://console.example.com/console/topup?tab=balance")
	if actual := ResolveRequestBaseURL(req); actual != "https://console.example.com" {
		t.Fatalf("expected referer base url, got %q", actual)
	}
}

func TestBuildAlipayPaymentPageURLUsesExplicitBaseURL(t *testing.T) {
	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://api.example.com"
	defer func() {
		system_setting.ServerAddress = previousServerAddress
	}()

	actual := BuildAlipayPaymentPageURL(
		"TRADE123",
		"/console/topup?tab=subscriptions",
		"https://console.example.com",
	)

	expected := "https://console.example.com/payment/alipay/TRADE123?return_to=%2Fconsole%2Ftopup%3Ftab%3Dsubscriptions"
	if actual != expected {
		t.Fatalf("expected %q, got %q", expected, actual)
	}
}
