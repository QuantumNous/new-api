package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelMaxConcurrencyUpdateTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/channel-max-concurrency.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)

	model.DB = db
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		require.NoError(t, sqlDB.Close())
	})
}

func performUpdateChannelMaxConcurrencyRequest(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.PUT("/api/channel", UpdateChannel)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/channel", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder
}

func requireChannelMaxConcurrency(t *testing.T, channelID int, want int) {
	t.Helper()

	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, channelID).Error)
	require.Equal(t, want, channel.MaxConcurrency)
}

func createChannelForMaxConcurrencyUpdateTest(t *testing.T, id int, maxConcurrency int) {
	t.Helper()

	channel := &model.Channel{
		Id:             id,
		Type:           1,
		Key:            "test-key",
		Name:           "test-channel",
		Status:         common.ChannelStatusEnabled,
		Models:         "gpt-test",
		Group:          "default",
		MaxConcurrency: maxConcurrency,
	}
	require.NoError(t, model.DB.Create(channel).Error)
}

func TestUpdateChannelMaxConcurrencyWritesExplicitZero(t *testing.T) {
	setupChannelMaxConcurrencyUpdateTestDB(t)
	createChannelForMaxConcurrencyUpdateTest(t, 101, 5)

	clear := performUpdateChannelMaxConcurrencyRequest(t, `{"id":101,"max_concurrency":0}`)
	require.Equal(t, http.StatusOK, clear.Code)
	requireChannelMaxConcurrency(t, 101, 0)
}

func TestUpdateChannelMaxConcurrencyPreservesMissingField(t *testing.T) {
	setupChannelMaxConcurrencyUpdateTestDB(t)
	createChannelForMaxConcurrencyUpdateTest(t, 102, 5)

	missing := performUpdateChannelMaxConcurrencyRequest(t, `{"id":102,"name":"renamed-channel"}`)
	require.Equal(t, http.StatusOK, missing.Code)
	requireChannelMaxConcurrency(t, 102, 5)

	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, 102).Error)
	require.Equal(t, "renamed-channel", channel.Name)
}

func TestUpdateChannelMaxConcurrencyWritesPositiveValue(t *testing.T) {
	setupChannelMaxConcurrencyUpdateTestDB(t)
	createChannelForMaxConcurrencyUpdateTest(t, 103, 5)

	nonZero := performUpdateChannelMaxConcurrencyRequest(t, `{"id":103,"max_concurrency":3}`)
	require.Equal(t, http.StatusOK, nonZero.Code)
	requireChannelMaxConcurrency(t, 103, 3)
}

func TestUpdateChannelMaxConcurrencyTreatsNullAsMissing(t *testing.T) {
	setupChannelMaxConcurrencyUpdateTestDB(t)
	createChannelForMaxConcurrencyUpdateTest(t, 104, 5)

	nullValue := performUpdateChannelMaxConcurrencyRequest(t, `{"id":104,"name":"renamed-channel","max_concurrency":null}`)
	require.Equal(t, http.StatusOK, nullValue.Code)
	requireChannelMaxConcurrency(t, 104, 5)
}

func TestUpdateChannelMaxConcurrencyRejectsNegativeValue(t *testing.T) {
	setupChannelMaxConcurrencyUpdateTestDB(t)
	createChannelForMaxConcurrencyUpdateTest(t, 105, 2)

	recorder := performUpdateChannelMaxConcurrencyRequest(t, `{"id":105,"max_concurrency":-1}`)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "channel max concurrency cannot be negative")
	requireChannelMaxConcurrency(t, 105, 2)
}
