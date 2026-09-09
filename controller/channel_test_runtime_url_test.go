package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelRuntimeURLDB(t *testing.T) {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.LogConsumeEnabled = false
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err, "open in-memory sqlite")
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.User{}), "AutoMigrate")
}

// The channel test must hit the real upstream (actual_base_url), never the display address.
func TestChannelTestUsesRuntimeBaseURL(t *testing.T) {
	setupChannelRuntimeURLDB(t)
	withSelfUseModeEnabled(t)

	displayHits := 0
	display := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		displayHits++
		w.WriteHeader(http.StatusTeapot)
	}))
	defer display.Close()
	actual := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"x","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	}))
	defer actual.Close()

	displayURL, actualURL := display.URL, actual.URL
	channel := &model.Channel{Type: 1, Key: "sk-test", BaseURL: &displayURL, ActualBaseURL: &actualURL, Models: "gpt-4o-mini", Status: 1}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "root", Role: 100, Group: "default", Status: 1}).Error)

	result := testChannel(context.Background(), channel, 1, "gpt-4o-mini", "", false)
	assert.NoError(t, result.localErr)
	assert.Nil(t, result.newAPIError)
	assert.Equal(t, 0, displayHits, "display base url must not receive channel test traffic")
}
