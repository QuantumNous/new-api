package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type modelMetaMutationResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    model.Model `json:"data"`
}

func requestModelMetaMutation(t *testing.T, method, target, body string, handler gin.HandlerFunc) modelMetaMutationResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	handler(ctx)

	var response modelMetaMutationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestCreateModelMetaTrimsAndRejectsBlankName(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	db := setupModelListControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/model_meta", strings.NewReader(`{"model_name":"   "}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	CreateModelMeta(ctx)
	var blank modelMetaMutationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &blank))
	require.False(t, blank.Success)
	require.Equal(t, "Model name cannot be empty", blank.Message)

	created := requestModelMetaMutation(t, http.MethodPost, "/api/model_meta", `{"model_name":"  trimmed-model  ","status":1}`, CreateModelMeta)
	require.True(t, created.Success, created.Message)
	require.Equal(t, "trimmed-model", created.Data.ModelName)

	var stored model.Model
	require.NoError(t, db.First(&stored, created.Data.Id).Error)
	require.Equal(t, "trimmed-model", stored.ModelName)
}

func TestUpdateModelMetaTrimsAndRejectsBlankName(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	db := setupModelListControllerTestDB(t)
	existing := model.Model{ModelName: "original-model", Status: 1}
	require.NoError(t, db.Create(&existing).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/model_meta", strings.NewReader(`{"id":`+strconv.Itoa(existing.Id)+`,"model_name":"   "}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	UpdateModelMeta(ctx)
	var blank modelMetaMutationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &blank))
	require.False(t, blank.Success)
	require.Equal(t, "Model name cannot be empty", blank.Message)

	var stored model.Model
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, "original-model", stored.ModelName)

	updated := requestModelMetaMutation(t, http.MethodPut, "/api/model_meta", `{"id":`+strconv.Itoa(existing.Id)+`,"model_name":"  renamed-model  ","status":1}`, UpdateModelMeta)
	require.True(t, updated.Success, updated.Message)
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, "renamed-model", stored.ModelName)
}

func TestUpdateModelMetaStatusOnlyDoesNotRequireName(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	existing := model.Model{ModelName: "status-only-model", Status: 1}
	require.NoError(t, db.Create(&existing).Error)

	response := requestModelMetaMutation(t, http.MethodPut, "/api/model_meta?status_only=true", `{"id":`+strconv.Itoa(existing.Id)+`,"model_name":"   ","status":0}`, UpdateModelMeta)
	require.True(t, response.Success, response.Message)

	var stored model.Model
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, "status-only-model", stored.ModelName)
	require.Zero(t, stored.Status)
}
