package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupSub2APIBalanceTest wires an in-memory SQLite DB into model.DB so
// Channel.UpdateBalance can persist, mirroring the pattern used by other
// controller tests.
func setupSub2APIBalanceTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Discard,
	})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.Channel{}))
	model.DB = database
	t.Cleanup(func() {
		model.DB = originalDB
	})
}

func newSub2APITestChannel(t *testing.T, serverURL string) *model.Channel {
	t.Helper()
	channel := &model.Channel{
		Type:    constant.ChannelTypeSub2API,
		BaseURL: &serverURL,
		Key:     "sk-test",
		Name:    "sub2api-test",
	}
	require.NoError(t, model.DB.Create(channel).Error)
	return channel
}

func TestUpdateChannelSub2APIBalanceRemainingPreferred(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/usage", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance": 100.0, "remaining": 986.17194888, "isValid": true, "unit": "USD"}`))
	}))
	defer server.Close()

	channel := newSub2APITestChannel(t, server.URL)
	balance, err := updateChannelSub2APIBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 986.17194888, balance, 1e-9)
	assert.InDelta(t, 986.17194888, channel.Balance, 1e-9)
}

func TestUpdateChannelSub2APIBalanceWalletFallback(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance": 42.5, "isValid": true, "unit": "USD"}`))
	}))
	defer server.Close()

	channel := newSub2APITestChannel(t, server.URL)
	balance, err := updateChannelSub2APIBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 42.5, balance, 1e-9)
}

func TestUpdateChannelSub2APIBalanceSubscriptionKeyMissingFields(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance": null, "remaining": null, "isValid": true, "mode": "unrestricted"}`))
	}))
	defer server.Close()

	channel := newSub2APITestChannel(t, server.URL)
	_, err := updateChannelSub2APIBalance(channel)
	require.Error(t, err)
}

func TestUpdateChannelSub2APIBalanceInvalidKey(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance": 0, "isValid": false}`))
	}))
	defer server.Close()

	channel := newSub2APITestChannel(t, server.URL)
	_, err := updateChannelSub2APIBalance(channel)
	require.Error(t, err)
}

func TestUpdateChannelSub2APIBalanceMissingBaseURL(t *testing.T) {
	setupSub2APIBalanceTest(t)
	empty := ""
	channel := &model.Channel{BaseURL: &empty, Key: "sk-test"}
	_, err := updateChannelSub2APIBalance(channel)
	require.Error(t, err)
}

func TestUpdateStandardChannelBalanceRoutesSub2API(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance": 77.7, "isValid": true, "unit": "USD"}`))
	}))
	defer server.Close()

	channel := newSub2APITestChannel(t, server.URL)
	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 77.7, result.Balance, 1e-9)
}
