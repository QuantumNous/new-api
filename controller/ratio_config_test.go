package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRatioConfigOmitsGroupModelRatio(t *testing.T) {
	originalExpose := ratio_setting.IsExposeRatioEnabled()
	originalGroupModelRatio := ratio_setting.GroupModelRatio2JSONString()
	t.Cleanup(func() {
		ratio_setting.SetExposeRatioEnabled(originalExpose)
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatio))
		ratio_setting.InvalidateExposedDataCache()
	})

	ratio_setting.SetExposeRatioEnabled(true)
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{"plg":{"gpt-5.5":0.3}}`))
	ratio_setting.InvalidateExposedDataCache()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	GetRatioConfig(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Contains(t, response.Data, "model_ratio")
	require.NotContains(t, response.Data, "group_model_ratio")
}
