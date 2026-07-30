/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type connectProvisioningResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ChatModels   []string `json:"chat_models"`
		DefaultModel string   `json:"default_model"`
		Account      *struct {
			Id       int    `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
			Quota    int    `json:"quota"`
		} `json:"account"`
	} `json:"data"`
}

func decodeConnectProvisioning(t *testing.T, recorder *httptest.ResponseRecorder) connectProvisioningResponse {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload connectProvisioningResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload
}

func withConnectDefaultModel(t *testing.T, name string) {
	t.Helper()

	settings := system_setting.GetConnectSettings()
	original := settings.DefaultModel
	settings.DefaultModel = name
	t.Cleanup(func() {
		system_setting.GetConnectSettings().DefaultModel = original
	})
}

// requestConnectProvisioning drives the handler the way TokenAuthReadOnly would:
// the caller's user id in context, no session.
func requestConnectProvisioning(t *testing.T, userID int) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/connect/provisioning", nil)
	ctx.Set("id", userID)

	GetConnectProvisioning(ctx)
	return recorder
}

// withPricingCache makes the pricing cache authoritative for the fixture's
// abilities. Endpoint types are read from it, and a model it does not know
// reports none — which the handler correctly treats as "not a chat model".
func withPricingCache(t *testing.T) {
	t.Helper()

	original := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = original
		model.InvalidatePricingCache()
	})
	model.InitChannelCache()
	model.GetPricing()
}

// A coding client that is handed an embedding, image or video model fails on
// its first request, so the catalog Connect writes into client config files
// must contain chat models only.
func TestConnectProvisioningReturnsChatModelsOnly(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		model.InvalidatePricingCache()
	})

	require.NoError(t, db.Create(&model.User{
		Id:       2001,
		Username: "connect-user",
		Email:    "connect@example.com",
		Password: "password",
		Group:    "default",
		Quota:    4242,
		Status:   common.UserStatusEnabled,
	}).Error)

	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 801, Type: constant.ChannelTypeOpenAI, Key: "k", Status: common.ChannelStatusEnabled, Name: "openai", Group: "default", Models: "zz-connect-chat-model,zz-connect-flux-image"},
		{Id: 802, Type: constant.ChannelTypeAnthropic, Key: "k", Status: common.ChannelStatusEnabled, Name: "anthropic", Group: "default", Models: "zz-connect-claude"},
		{Id: 803, Type: constant.ChannelTypeSora, Key: "k", Status: common.ChannelStatusEnabled, Name: "sora", Group: "default", Models: "zz-connect-video"},
		{Id: 804, Type: constant.ChannelTypeJina, Key: "k", Status: common.ChannelStatusEnabled, Name: "jina", Group: "default", Models: "zz-connect-rerank"},
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-connect-chat-model", ChannelId: 801, Enabled: true},
		// Image generation contributes `image-generation` alongside `openai`,
		// which is the case a "supports openai?" check would wrongly admit.
		{Group: "default", Model: "zz-connect-flux-image", ChannelId: 801, Enabled: true},
		{Group: "default", Model: "zz-connect-claude", ChannelId: 802, Enabled: true},
		{Group: "default", Model: "zz-connect-video", ChannelId: 803, Enabled: true},
		{Group: "default", Model: "zz-connect-rerank", ChannelId: 804, Enabled: true},
	}).Error)

	model.InitChannelCache()
	model.GetPricing()

	payload := decodeConnectProvisioning(t, requestConnectProvisioning(t, 2001))

	require.Equal(t, []string{"zz-connect-chat-model", "zz-connect-claude"}, payload.Data.ChatModels)
}

// The catalog is per-account and the default is an operator decision, so a
// default this account cannot reach must degrade to something it can.
func TestConnectProvisioningDefaultModelFallsBackToAReachableModel(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	require.NoError(t, db.Create(&model.User{
		Id:       2002,
		Username: "connect-default-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id: 811, Type: constant.ChannelTypeOpenAI, Key: "k", Status: common.ChannelStatusEnabled,
		Name: "openai", Group: "default", Models: "zz-connect-a-model,zz-connect-b-model",
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-connect-a-model", ChannelId: 811, Enabled: true},
		{Group: "default", Model: "zz-connect-b-model", ChannelId: 811, Enabled: true},
	}).Error)
	withPricingCache(t)

	withConnectDefaultModel(t, "zz-connect-b-model")
	payload := decodeConnectProvisioning(t, requestConnectProvisioning(t, 2002))
	require.Equal(t, "zz-connect-b-model", payload.Data.DefaultModel)

	withConnectDefaultModel(t, "zz-connect-model-this-account-cannot-use")
	payload = decodeConnectProvisioning(t, requestConnectProvisioning(t, 2002))
	require.Equal(t, "zz-connect-a-model", payload.Data.DefaultModel,
		"an unreachable operator default must degrade to a model the account can call")
}

// An account with no chat models must not be handed a model name anyway: the
// desktop app has no fallback of its own and would write a config that fails.
func TestConnectProvisioningWithoutChatModelsReturnsNoDefault(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	require.NoError(t, db.Create(&model.User{
		Id:       2003,
		Username: "connect-empty-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	withConnectDefaultModel(t, "zz-connect-configured-model")

	payload := decodeConnectProvisioning(t, requestConnectProvisioning(t, 2003))

	require.Empty(t, payload.Data.ChatModels)
	require.Empty(t, payload.Data.DefaultModel)
}

// Provisioning must not become a way around a token's model limit: the key
// Connect holds is an ordinary relay token and the catalog it is shown has to
// match what that token may actually call.
func TestConnectProvisioningHonoursTokenModelLimit(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	require.NoError(t, db.Create(&model.Channel{
		Id: 821, Type: constant.ChannelTypeOpenAI, Key: "k", Status: common.ChannelStatusEnabled,
		Name: "openai", Group: "default", Models: "zz-connect-allowed-model,zz-connect-withheld-model",
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-connect-allowed-model", ChannelId: 821, Enabled: true},
		{Group: "default", Model: "zz-connect-withheld-model", ChannelId: 821, Enabled: true},
	}).Error)
	withPricingCache(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/connect/provisioning", nil)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{
		"zz-connect-allowed-model": true,
	})

	GetConnectProvisioning(ctx)

	payload := decodeConnectProvisioning(t, recorder)
	require.Equal(t, []string{"zz-connect-allowed-model"}, payload.Data.ChatModels,
		"a model the group serves but the token forbids must not appear")
}

// The desktop app labels its account panel from this response rather than
// making a second call, so the identity has to travel with the catalog.
func TestConnectProvisioningCarriesTheAccountIdentity(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)

	require.NoError(t, db.Create(&model.User{
		Id:       2004,
		Username: "connect-identity-user",
		Email:    "identity@example.com",
		Password: "password",
		Group:    "default",
		Quota:    777,
		Status:   common.UserStatusEnabled,
	}).Error)

	payload := decodeConnectProvisioning(t, requestConnectProvisioning(t, 2004))

	require.NotNil(t, payload.Data.Account)
	require.Equal(t, 2004, payload.Data.Account.Id)
	require.Equal(t, "connect-identity-user", payload.Data.Account.Username)
	require.Equal(t, "identity@example.com", payload.Data.Account.Email)
	require.Equal(t, 777, payload.Data.Account.Quota)
}
