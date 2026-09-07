package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAccountBalanceConfigPreservesSecretAndInvalidatesOldWallet(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })
	channel := model.Channel{Id: 1, Key: "relay-secret", Balance: 99999898.89, BalanceUpdatedTime: 123}
	require.NoError(t, db.Create(&channel).Error)
	config := model.ChannelBalanceConfig{Enabled: true, BaseURL: "https://wallet.example", UserID: 42, AccessToken: "account-secret"}
	require.NoError(t, model.SaveChannelBalanceConfig(1, config))
	saved, err := model.GetChannelById(1, true)
	require.NoError(t, err)
	assert.Zero(t, saved.BalanceUpdatedTime)
	assert.Zero(t, saved.Balance)
	assert.Equal(t, "relay-secret", saved.Key)
	serialized, err := common.Marshal(saved)
	require.NoError(t, err)
	assert.NotContains(t, string(serialized), "account-secret")

	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}
	GetChannelBalanceConfig(ctx)
	assert.NotContains(t, response.Body.String(), "account-secret")
	assert.Contains(t, response.Body.String(), `"has_access_token":true`)
	assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))

	config.AccessToken = ""
	require.NoError(t, model.SaveChannelBalanceConfig(1, config))
	config.BaseURL = "https://different.example"
	require.Error(t, model.SaveChannelBalanceConfig(1, config))
	current, err := model.GetChannelById(1, true)
	require.NoError(t, err)
	require.NoError(t, current.StoreAccountBalance(99.89, "CNY"))

	config.Enabled = false
	require.NoError(t, model.SaveChannelBalanceConfig(1, config))
	require.Error(t, current.StoreAccountBalance(1, "CNY"))
	current, err = model.GetChannelById(1, true)
	require.NoError(t, err)
	assert.NotContains(t, current.BalanceConfig, "account-secret")
	assert.Zero(t, current.BalanceUpdatedTime)
}

func TestAccountBalanceRefreshKeepsLastSuccessOnUpstreamFailure(t *testing.T) {
	failed := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/status" {
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"CNY","usd_exchange_rate":1}}`))
			return
		}
		assert.Equal(t, "/api/user/self", r.URL.Path)
		if failed {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"success":true,"data":{"id":42,"quota":49945000}}`))
	}))
	defer server.Close()
	service.InitHttpClient()
	client, err := service.GetHttpClientWithProxy("")
	require.NoError(t, err)
	previousClient := *client
	*client = *server.Client()
	t.Cleanup(func() { *client = previousClient })
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.Create(&model.Channel{Id: 1, Type: 1, Key: "relay-secret", ChannelInfo: model.ChannelInfo{IsMultiKey: true}}).Error)
	require.NoError(t, model.SaveChannelBalanceConfig(1, model.ChannelBalanceConfig{Enabled: true, BaseURL: server.URL, UserID: 42, AccessToken: "account-secret"}))
	channel, err := model.GetChannelById(1, true)
	require.NoError(t, err)
	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 99.89, result.Balance, 0.000001)
	assert.Equal(t, "CNY", result.Currency)
	last, err := model.GetChannelById(1, true)
	require.NoError(t, err)
	failed = true
	_, err = updateChannelBalance(last)
	require.ErrorContains(t, err, "401")
	retained, err := model.GetChannelById(1, true)
	require.NoError(t, err)
	assert.Equal(t, last.Balance, retained.Balance)
	assert.Equal(t, last.BalanceCurrency, retained.BalanceCurrency)
	assert.Equal(t, last.BalanceUpdatedTime, retained.BalanceUpdatedTime)
}

func TestUnlimitedCompatibilityQuotaIsNotAWalletBalance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/dashboard/billing/subscription", r.URL.Path)
		_, _ = w.Write([]byte(`{"object":"billing_subscription","hard_limit_usd":100000000,"soft_limit_usd":100000000,"system_hard_limit_usd":100000000}`))
	}))
	defer server.Close()
	service.InitHttpClient()
	channel := &model.Channel{Type: 1, Key: "relay-secret", BaseURL: common.GetPointer(server.URL)}
	_, err := updateStandardChannelBalance(channel)
	require.ErrorContains(t, err, "无限额度")
}
