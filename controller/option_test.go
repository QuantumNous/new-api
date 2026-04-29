package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type optionAPIResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Data    []model.Option `json:"data"`
}

func TestGetOptionsIncludesChannelTimeoutDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{
		"PublicOption": "visible",
		"SecretToken":  "hidden",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)

	GetOptions(ctx)

	var response optionAPIResponse
	err := common.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	require.True(t, response.Success)

	optionMap := make(map[string]string, len(response.Data))
	for _, option := range response.Data {
		optionMap[option.Key] = option.Value
	}

	_, exists := optionMap["SecretToken"]
	require.False(t, exists)
	require.Equal(t, "visible", optionMap["PublicOption"])

	var timeoutDefaults dto.ChannelTimeoutDefaults
	err = common.UnmarshalJsonStr(optionMap["ChannelTimeoutDefaults"], &timeoutDefaults)
	require.NoError(t, err)
	require.Equal(t, dto.GetChannelTimeoutDefaults(), timeoutDefaults)
}
