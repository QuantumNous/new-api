package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetOptionsRedactsVolcAssetSecrets locks in two contracts:
//  1. GetOptions must return VolcAssetConfig (not accidentally dropped by the sensitive-suffix filter);
//  2. secret_key / access_token in the returned value must be redacted to empty while other fields are preserved.
func TestGetOptionsRedactsVolcAssetSecrets(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prevMap := common.OptionMap
	prevCfg := system_setting.VolcAssetConfig
	t.Cleanup(func() {
		common.OptionMap = prevMap
		system_setting.VolcAssetConfig = prevCfg
	})

	system_setting.VolcAssetConfig = system_setting.VolcAssetSettings{
		Outbounds: []system_setting.AssetOutbound{
			{
				Id:          "gw",
				Format:      system_setting.AssetFormatNewAPI,
				BaseURL:     "https://asset.example.com/api/asset-management",
				AccessToken: "tok-secret",
				AccessKey:   "AKID",
				SecretKey:   "sk-secret",
			},
		},
	}
	full, err := common.Marshal(system_setting.VolcAssetConfig)
	require.NoError(t, err)
	common.OptionMap = map[string]string{
		"VolcAssetConfig": string(full),
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)

	GetOptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &resp))
	require.True(t, resp.Success)

	var rawValue string
	found := false
	for _, opt := range resp.Data {
		if opt.Key == "VolcAssetConfig" {
			rawValue = opt.Value
			found = true
			break
		}
	}
	require.True(t, found, "VolcAssetConfig should be returned by GetOptions")

	var got system_setting.VolcAssetSettings
	require.NoError(t, common.UnmarshalJsonStr(rawValue, &got))

	require.Len(t, got.Outbounds, 1)
	ob := got.Outbounds[0]
	assert.Empty(t, ob.SecretKey, "secret_key must be redacted")
	assert.Empty(t, ob.AccessToken, "access_token must be redacted")
	assert.Equal(t, "AKID", ob.AccessKey)
	assert.Equal(t, "https://asset.example.com/api/asset-management", ob.BaseURL)
}
