package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http/httptest"
	"testing"
)

func TestEnabledAgentReceivesOwnConfiguredImagePrice(t *testing.T) {
	r, _ := setupDrawingTests(t)
	oldRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = oldRate })
	_, err := model.UpdateAgentProfile(81001, 1, 2, true, 0, false)
	require.NoError(t, err)
	quote, err := service.ResolveAgentImageQuote(81001, model.AgentImageModel)
	require.NoError(t, err)
	require.NotNil(t, quote, "an enabled agent without an inviter must receive the configured own price")
	assert.Equal(t, 2, quote.PriceCents)
	assert.Equal(t, 10000, quote.UnitQuota)
	assert.Equal(t, 81001, quote.AgentID)
	assert.Equal(t, 81001, quote.CustomerID)
	r.GET("/own-price", CustomerAgentPrice)
	response := httptest.NewRecorder()
	r.ServeHTTP(response, httptest.NewRequest("GET", "/own-price", nil))
	assert.Equal(t, 200, response.Code)
	assert.Contains(t, response.Body.String(), `"price_cents":2`)
	_, err = model.UpdateAgentProfile(81001, 1, 2, false, 1, false)
	require.NoError(t, err)
	quote, err = service.ResolveAgentImageQuote(81001, model.AgentImageModel)
	require.NoError(t, err)
	assert.Nil(t, quote)
	require.NoError(t, model.DB.Model(&model.AgentProfile{}).Where("user_id = ?", 81001).Update("enabled", true).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81001).Update("status", common.UserStatusDisabled).Error)
	quote, err = service.ResolveAgentImageQuote(81001, model.AgentImageModel)
	require.NoError(t, err)
	assert.Nil(t, quote)
}
