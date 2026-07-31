package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type themeOptionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Theme string `json:"theme"`
	} `json:"data"`
}

func TestUpdateOptionRejectsNonDefaultFrontend(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, frontend := range []string{"classic", "unknown", ""} {
		t.Run(frontend, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(
				http.MethodPut,
				"/api/option",
				strings.NewReader(`{"key":"theme.frontend","value":"`+frontend+`"}`),
			)

			UpdateOption(ctx)

			assert.Equal(t, http.StatusOK, recorder.Code)
			var response themeOptionResponse
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.NotEmpty(t, response.Message)
		})
	}
}

func TestGetStatusExposesDefaultFrontend(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response themeOptionResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, system_setting.DefaultFrontend, response.Data.Theme)
}
