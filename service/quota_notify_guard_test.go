package service

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLegacyWalletQuotaNotifyPathIsRemoved(t *testing.T) {
	for _, path := range []string{"billing.go", "quota.go"} {
		content, err := os.ReadFile(path)
		require.NoError(t, err)
		require.NotContains(t, string(content), "checkAndSendQuotaNotify")
	}
}

func TestSubscriptionQuotaNotifyPathRemains(t *testing.T) {
	content, err := os.ReadFile("quota.go")
	require.NoError(t, err)
	require.True(t, strings.Contains(string(content), "checkAndSendSubscriptionQuotaNotify"))
}
