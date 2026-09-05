package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type modelMetaResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func performModelMetaRequest(
	t *testing.T,
	method string,
	path string,
	payload any,
	handler gin.HandlerFunc,
) *httptest.ResponseRecorder {
	t.Helper()
	body, err := common.Marshal(payload)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	handler(ctx)
	return recorder
}

func requireRejectedModelMetaField(t *testing.T, recorder *httptest.ResponseRecorder, field string) {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var response modelMetaResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Contains(t, response.Message, field)
}

func TestCreateModelMetaRejectsNegativeContextWindow(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	recorder := performModelMetaRequest(t, http.MethodPost, "/api/model", model.Model{
		ModelName:     "negative-context-window",
		ContextWindow: -1,
	}, CreateModelMeta)

	requireRejectedModelMetaField(t, recorder, "context_window")
	var count int64
	require.NoError(t, db.Model(&model.Model{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestCreateModelMetaRejectsNegativeMaxOutputTokens(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	recorder := performModelMetaRequest(t, http.MethodPost, "/api/model", model.Model{
		ModelName:       "negative-max-output-tokens",
		MaxOutputTokens: -1,
	}, CreateModelMeta)

	requireRejectedModelMetaField(t, recorder, "max_output_tokens")
	var count int64
	require.NoError(t, db.Model(&model.Model{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestUpdateModelMetaRejectsNegativeTokenLimits(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	existing := &model.Model{ModelName: "negative-update-token-limits", Status: 1}
	require.NoError(t, db.Create(existing).Error)

	recorder := performModelMetaRequest(t, http.MethodPut, "/api/model", model.Model{
		Id:            existing.Id,
		ModelName:     existing.ModelName,
		ContextWindow: -1,
	}, UpdateModelMeta)

	requireRejectedModelMetaField(t, recorder, "context_window")

	var stored model.Model
	require.NoError(t, db.First(&stored, existing.Id).Error)
	require.Equal(t, existing.ModelName, strings.TrimSpace(stored.ModelName))
	require.Zero(t, stored.ContextWindow)
}
