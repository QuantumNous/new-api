package setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var (
	testPaddleAPIKey        = "pdl_live_apikey_" + strings.Repeat("a", 26) + "_" + strings.Repeat("B", 22) + "_" + strings.Repeat("C", 3)
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
