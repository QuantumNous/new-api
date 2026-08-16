package service

import (
	"context"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStrictSSRFClientBlocksLoopbackWhenGlobalProtectionIsDisabled(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	previous := fetchSetting.EnableSSRFProtection
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() { fetchSetting.EnableSSRFProtection = previous })

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://127.0.0.1:65535/v1/models", nil)
	require.NoError(t, err)
	_, err = GetStrictSSRFProtectedHTTPClient().Do(req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "private IP address not allowed")
}
