package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetStatusIncludesPlaygroundModelRules(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{
		"PlaygroundModelRules": `[{"model":"gpt-4o","order":1}]`,
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalMap
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	GetStatus(c)

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			PlaygroundModelRules string `json:"playground_model_rules"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, `[{"model":"gpt-4o","order":1}]`, payload.Data.PlaygroundModelRules)
}
