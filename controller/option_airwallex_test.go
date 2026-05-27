package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestMergeAirwallexAccountsOptionPreservesMaskedSecrets(t *testing.T) {
	current := map[string]operation_setting.AirwallexAccount{
		"b2c": {
			Enabled:       true,
			BaseURL:       "https://api.airwallex.com",
			ClientID:      "old-client",
			APIKey:        "real-api-key",
			LoginAs:       "old-login",
			WebhookSecret: "real-webhook-secret",
		},
	}

	merged, err := mergeAirwallexAccountsOption(`{
		"b2c": {
			"enabled": true,
			"base_url": "https://api-demo.airwallex.com",
			"client_id": "new-client",
			"api_key": "***configured***",
			"login_as": "new-login",
			"webhook_secret": "***configured***"
		}
	}`, current)

	require.NoError(t, err)
	require.Equal(t, "https://api-demo.airwallex.com", merged["b2c"].BaseURL)
	require.Equal(t, "new-client", merged["b2c"].ClientID)
	require.Equal(t, "new-login", merged["b2c"].LoginAs)
	require.Equal(t, "real-api-key", merged["b2c"].APIKey)
	require.Equal(t, "real-webhook-secret", merged["b2c"].WebhookSecret)
}

func TestMergeAirwallexAccountsOptionAllowsSecretRotation(t *testing.T) {
	current := map[string]operation_setting.AirwallexAccount{
		"b2c": {
			APIKey:        "old-api-key",
			WebhookSecret: "old-webhook-secret",
		},
	}

	merged, err := mergeAirwallexAccountsOption(`{
		"b2c": {
			"api_key": "new-api-key",
			"webhook_secret": "new-webhook-secret"
		}
	}`, current)

	require.NoError(t, err)
	require.Equal(t, "new-api-key", merged["b2c"].APIKey)
	require.Equal(t, "new-webhook-secret", merged["b2c"].WebhookSecret)
}
