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

type statusReleaseResponse struct {
	Success bool `json:"success"`
	Data    struct {
		BuildCommit  string `json:"build_commit"`
		BuildRelease string `json:"build_release"`
		BuildTime    string `json:"build_time"`
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

func TestGetStatusExposesBuildMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldCommit, oldRelease, oldTime := common.BuildCommit, common.BuildRelease, common.BuildTime
	common.BuildCommit, common.BuildRelease, common.BuildTime = "abc123", "abc123-v1", "2026-08-02T00:00:00Z"
	t.Cleanup(func() {
		common.BuildCommit, common.BuildRelease, common.BuildTime = oldCommit, oldRelease, oldTime
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
	GetStatus(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response statusReleaseResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, "abc123", response.Data.BuildCommit)
	assert.Equal(t, "abc123-v1", response.Data.BuildRelease)
	assert.Equal(t, "2026-08-02T00:00:00Z", response.Data.BuildTime)
}
