package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupConcurrencyStatusTest(t *testing.T) {
	t.Helper()
	prevDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	model.DB = db
	t.Cleanup(func() { model.DB = prevDB })
}

func runConcurrencyStatusRequest(t *testing.T, query string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/channel/concurrency"+query, nil)
	GetChannelConcurrencyStatus(c)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	return recorder, body
}

func TestGetChannelConcurrencyStatusEmptyIdsReturnsEmptyList(t *testing.T) {
	setupConcurrencyStatusTest(t)
	recorder, body := runConcurrencyStatusRequest(t, "")
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, true, body["success"])
	require.Empty(t, body["data"])
}

func TestGetChannelConcurrencyStatusSkipsUnlimitedChannels(t *testing.T) {
	setupConcurrencyStatusTest(t)
	require.NoError(t, model.DB.Create(&model.Channel{Id: 701, Name: "unlimited", MaxConcurrency: 0}).Error)
	require.NoError(t, model.DB.Create(&model.Channel{Id: 702, Name: "bounded", MaxConcurrency: 3}).Error)

	recorder, body := runConcurrencyStatusRequest(t, "?ids=701,702")
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, true, body["success"])

	data, ok := body["data"].([]any)
	require.True(t, ok)
	require.Len(t, data, 1)
	entry := data[0].(map[string]any)
	require.Equal(t, float64(702), entry["channel_id"])
	require.Equal(t, float64(3), entry["max_concurrency"])
	require.Equal(t, float64(0), entry["active"])
}

func TestGetChannelConcurrencyStatusRejectsOversizedRequest(t *testing.T) {
	setupConcurrencyStatusTest(t)
	ids := ""
	for i := 0; i <= channelConcurrencyQueryMaxIds; i++ {
		if i > 0 {
			ids += ","
		}
		ids += "1"
	}
	recorder, body := runConcurrencyStatusRequest(t, "?ids="+ids)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Equal(t, false, body["success"])
}

func TestGetChannelConcurrencyStatusIgnoresMalformedIds(t *testing.T) {
	setupConcurrencyStatusTest(t)
	recorder, body := runConcurrencyStatusRequest(t, "?ids=abc,-5,0,")
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, true, body["success"])
	require.Empty(t, body["data"])
}
