package setting

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var (
	testPaddleAPIKey        = "pdl_live_apikey_" + strings.Repeat("a", 26) + "_" + strings.Repeat("B", 22) + "_" + strings.Repeat("C", 3)
	testPaddleSandboxAPIKey = "pdl_sdbx_apikey_" + strings.Repeat("a", 26) + "_" + strings.Repeat("B", 22) + "_" + strings.Repeat("C", 3)
	testPaddleWebhookSecret = "pdl_ntfset_" + "ABCDEF1234567890abcdef1234" + "_" + "0123456789abcdef0123456789ABCDEF"
)

func TestValidatePaddleOptionAcceptsFullSecretFormats(t *testing.T) {
	require.NoError(t, ValidatePaddleOption("PaddleApiKey", testPaddleAPIKey))
	require.NoError(t, ValidatePaddleOption("PaddleWebhookSecret", testPaddleWebhookSecret))
	require.NoError(t, ValidatePaddleOption("PaddleWebhookSecret", strings.ToLower(testPaddleWebhookSecret)))
}

func TestValidatePaddleOptionRejectsPaddleIDsAsSecrets(t *testing.T) {
	require.Error(t, ValidatePaddleOption("PaddleApiKey", "apikey_01example"))
	require.Error(t, ValidatePaddleOption("PaddleWebhookSecret", "ntfset_01example"))
}

func TestEffectivePaddleSandboxPrefersCredentialEnvironment(t *testing.T) {
	originalAPIKey := PaddleApiKey
	originalClientToken := PaddleClientToken
	originalSandbox := PaddleSandbox
	t.Cleanup(func() {
		PaddleApiKey = originalAPIKey
		PaddleClientToken = originalClientToken
		PaddleSandbox = originalSandbox
	})

	PaddleSandbox = true
	PaddleApiKey = testPaddleAPIKey
	PaddleClientToken = "live_" + strings.Repeat("a", 27)
	require.False(t, EffectivePaddleSandbox())

	PaddleSandbox = false
	PaddleApiKey = testPaddleSandboxAPIKey
	PaddleClientToken = "test_" + strings.Repeat("b", 27)
	require.True(t, EffectivePaddleSandbox())

	PaddleApiKey = ""
	PaddleClientToken = ""
	PaddleSandbox = false
	require.False(t, EffectivePaddleSandbox())

	PaddleSandbox = true
	require.True(t, EffectivePaddleSandbox())
}

func TestEffectivePaddleSandboxPrefersExplicitEnvironment(t *testing.T) {
	original := snapshotPaddleSettings()
	t.Cleanup(func() {
		restorePaddleSettings(original)
	})

	PaddleApiKey = testPaddleSandboxAPIKey
	PaddleClientToken = "test_" + strings.Repeat("b", 27)
	PaddleSandbox = true
	t.Setenv("PADDLE_ENVIRONMENT", "live")
	require.False(t, EffectivePaddleSandbox())

	t.Setenv("PADDLE_ENVIRONMENT", "sandbox")
	PaddleApiKey = testPaddleAPIKey
	PaddleClientToken = "live_" + strings.Repeat("a", 27)
	PaddleSandbox = false
	require.True(t, EffectivePaddleSandbox())
}

func TestApplyPaddleEnvOverridesSelectsLiveConfig(t *testing.T) {
	original := snapshotPaddleSettings()
	t.Cleanup(func() {
		restorePaddleSettings(original)
	})
	t.Setenv("PADDLE_ENVIRONMENT", "live")
	t.Setenv("PADDLE_LIVE_API_KEY", testPaddleAPIKey)
	t.Setenv("PADDLE_LIVE_CLIENT_TOKEN", "live_"+strings.Repeat("z", 27))
	t.Setenv("PADDLE_LIVE_WEBHOOK_SECRET", testPaddleWebhookSecret)
	t.Setenv("PADDLE_LIVE_PRODUCT_ID", "pro_"+strings.Repeat("p", 26))
	t.Setenv("PADDLE_LIVE_CURRENCY", "usd")
	t.Setenv("PADDLE_LIVE_UNIT_PRICE", "1.25")
	t.Setenv("PADDLE_LIVE_MIN_TOPUP", "12")

	PaddleSandbox = true
	ApplyPaddleEnvOverrides()

	require.False(t, PaddleSandbox)
	require.False(t, EffectivePaddleSandbox())
	require.Equal(t, testPaddleAPIKey, PaddleApiKey)
	require.Equal(t, "live_"+strings.Repeat("z", 27), PaddleClientToken)
	require.Equal(t, testPaddleWebhookSecret, PaddleWebhookSecret)
	require.Equal(t, "pro_"+strings.Repeat("p", 26), PaddleProductId)
	require.Equal(t, "USD", PaddleCurrency)
	require.Equal(t, 1.25, PaddleUnitPrice)
	require.Equal(t, 12, PaddleMinTopUp)
}

func TestApplyPaddleEnvOverridesSelectsSandboxConfig(t *testing.T) {
	original := snapshotPaddleSettings()
	t.Cleanup(func() {
		restorePaddleSettings(original)
	})
	t.Setenv("PADDLE_ENVIRONMENT", "sandbox")
	t.Setenv("PADDLE_SANDBOX_API_KEY", testPaddleSandboxAPIKey)
	t.Setenv("PADDLE_SANDBOX_CLIENT_TOKEN", "test_"+strings.Repeat("y", 27))
	t.Setenv("PADDLE_SANDBOX_WEBHOOK_SECRET", testPaddleWebhookSecret)
	t.Setenv("PADDLE_SANDBOX_PRODUCT_ID", "pro_"+strings.Repeat("s", 26))

	PaddleSandbox = false
	ApplyPaddleEnvOverrides()

	require.True(t, PaddleSandbox)
	require.True(t, EffectivePaddleSandbox())
	require.Equal(t, testPaddleSandboxAPIKey, PaddleApiKey)
	require.Equal(t, "test_"+strings.Repeat("y", 27), PaddleClientToken)
	require.Equal(t, "pro_"+strings.Repeat("s", 26), PaddleProductId)
}

func TestApplyPaddleEnvOverridesIgnoresUnsetEnvironment(t *testing.T) {
	original := snapshotPaddleSettings()
	t.Cleanup(func() {
		restorePaddleSettings(original)
	})
	require.NoError(t, os.Unsetenv("PADDLE_ENVIRONMENT"))
	PaddleApiKey = "db-value"

	ApplyPaddleEnvOverrides()

	require.Equal(t, "db-value", PaddleApiKey)
}

type paddleSettingsSnapshot struct {
	apiKey        string
	clientToken   string
	webhookSecret string
	sandbox       bool
	productID     string
	currency      string
	unitPrice     float64
	minTopUp      int
}

func snapshotPaddleSettings() paddleSettingsSnapshot {
	return paddleSettingsSnapshot{
		apiKey:        PaddleApiKey,
		clientToken:   PaddleClientToken,
		webhookSecret: PaddleWebhookSecret,
		sandbox:       PaddleSandbox,
		productID:     PaddleProductId,
		currency:      PaddleCurrency,
		unitPrice:     PaddleUnitPrice,
		minTopUp:      PaddleMinTopUp,
	}
}

func restorePaddleSettings(snapshot paddleSettingsSnapshot) {
	PaddleApiKey = snapshot.apiKey
	PaddleClientToken = snapshot.clientToken
	PaddleWebhookSecret = snapshot.webhookSecret
	PaddleSandbox = snapshot.sandbox
	PaddleProductId = snapshot.productID
	PaddleCurrency = snapshot.currency
	PaddleUnitPrice = snapshot.unitPrice
	PaddleMinTopUp = snapshot.minTopUp
}
