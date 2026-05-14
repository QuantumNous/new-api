package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type apiSuccessEnvelope[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type modelMetaListPayload struct {
	Items []model.Model `json:"items"`
	Total int64         `json:"total"`
}

func newJSONContext(method string, target string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func decodeAPISuccess[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload apiSuccessEnvelope[T]
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload.Data
}

func TestCreateModelMetaAcceptsCoverURLAlias(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.True(t, db.Migrator().HasColumn(&model.Model{}, "cover_url"))

	ctx, recorder := newJSONContext(http.MethodPost, "/api/models/", `{
		"model_name":"zz-cover-alias-model",
		"coverUrl":"https://placehold.co/800x450.png",
		"status":1,
		"sync_official":1,
		"name_rule":0
	}`)

	CreateModelMeta(ctx)

	created := decodeAPISuccess[model.Model](t, recorder)
	require.Equal(t, "https://placehold.co/800x450.png", created.CoverURL)

	var stored model.Model
	require.NoError(t, db.First(&stored, created.Id).Error)
	require.Equal(t, "https://placehold.co/800x450.png", stored.CoverURL)
}

func TestUpdateModelMetaCoverURLRoundTrip(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.True(t, db.Migrator().HasColumn(&model.Model{}, "cover_url"))

	initial := &model.Model{
		ModelName:    "zz-cover-roundtrip-model",
		Status:       1,
		SyncOfficial: 1,
		NameRule:     model.NameRuleExact,
	}
	require.NoError(t, db.Create(initial).Error)

	updateURL := "https://placehold.co/800x450.png"
	updateCtx, updateRecorder := newJSONContext(http.MethodPut, "/api/models/", fmt.Sprintf(`{
		"id":%d,
		"model_name":"zz-cover-roundtrip-model",
		"description":"cover url round trip",
		"cover_url":"%s",
		"status":1,
		"sync_official":1,
		"name_rule":0
	}`, initial.Id, updateURL))

	UpdateModelMeta(updateCtx)

	updated := decodeAPISuccess[model.Model](t, updateRecorder)
	require.Equal(t, updateURL, updated.CoverURL)

	var stored model.Model
	require.NoError(t, db.First(&stored, initial.Id).Error)
	require.Equal(t, updateURL, stored.CoverURL)

	detailCtx, detailRecorder := newJSONContext(http.MethodGet, "/api/models/"+strconv.Itoa(initial.Id), "")
	detailCtx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(initial.Id)}}
	GetModelMeta(detailCtx)
	detail := decodeAPISuccess[model.Model](t, detailRecorder)
	require.Equal(t, updateURL, detail.CoverURL)

	listCtx, listRecorder := newJSONContext(http.MethodGet, "/api/models/?p=1&page_size=20", "")
	GetAllModelsMeta(listCtx)
	listPayload := decodeAPISuccess[modelMetaListPayload](t, listRecorder)
	require.Len(t, listPayload.Items, 1)
	require.Equal(t, updateURL, listPayload.Items[0].CoverURL)

	clearCtx, clearRecorder := newJSONContext(http.MethodPut, "/api/models/", fmt.Sprintf(`{
		"id":%d,
		"model_name":"zz-cover-roundtrip-model",
		"cover_url":"",
		"status":1,
		"sync_official":1,
		"name_rule":0
	}`, initial.Id))
	UpdateModelMeta(clearCtx)
	cleared := decodeAPISuccess[model.Model](t, clearRecorder)
	require.Empty(t, cleared.CoverURL)

	require.NoError(t, db.First(&stored, initial.Id).Error)
	require.Empty(t, stored.CoverURL)
}
