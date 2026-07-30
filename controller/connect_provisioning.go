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
	"sort"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// chatEndpointTypes are the wire formats a coding client holds a conversation
// over. The relay converts between them, so a model carrying any one of them is
// reachable from every client BoxAI Connect configures.
var chatEndpointTypes = map[constant.EndpointType]bool{
	constant.EndpointTypeOpenAI:                true,
	constant.EndpointTypeOpenAIResponse:        true,
	constant.EndpointTypeOpenAIResponseCompact: true,
	constant.EndpointTypeAnthropic:             true,
	constant.EndpointTypeGemini:                true,
}

// isChatModel reports whether a model can back a coding client.
//
// Membership is decided by exclusion, because an embedding model is also tagged
// `openai`: a model qualifies only when every endpoint it supports is a chat
// format. Handing a client an embedding, image, audio, video or 3D model
// produces a config that fails on its first request.
func isChatModel(endpoints []constant.EndpointType) bool {
	if len(endpoints) == 0 {
		return false
	}
	for _, endpoint := range endpoints {
		if !chatEndpointTypes[endpoint] {
			return false
		}
	}
	return true
}

// connectAccount is the identity BoxAI Connect shows in its account panel.
// It is filled from the cached user record, so it carries no field that would
// force a database read on every provisioning call.
type connectAccount struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Quota    int    `json:"quota"`
}

type connectProvisioning struct {
	ChatModels   []string        `json:"chat_models"`
	DefaultModel string          `json:"default_model"`
	Account      *connectAccount `json:"account,omitempty"`
}

// GetConnectProvisioning serves the account-scoped configuration BoxAI Connect
// applies after sign-in: which chat models this account may use, which one to
// select for a client that has no choice recorded yet, and who the account is.
//
// Connect deliberately owns none of this. The catalog is per-account and the
// operator picks the default, so a desktop build cannot answer either question
// on its own without inventing a model name. Returning the identity here too
// spares the app a second round trip just to label its account panel.
func GetConnectProvisioning(c *gin.Context) {
	modelNames, _, err := accountModelNames(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "get user group failed"})
		return
	}

	chatModels := make([]string, 0, len(modelNames))
	for _, name := range modelNames {
		if isChatModel(model.GetModelSupportEndpointTypes(name)) {
			chatModels = append(chatModels, name)
		}
	}
	sort.Strings(chatModels)

	data := connectProvisioning{
		ChatModels:   chatModels,
		DefaultModel: connectDefaultModel(chatModels),
	}
	// A missing user is not fatal: the catalog is still usable, and the app
	// simply renders its account panel without a name.
	if user, err := model.GetUserCache(c.GetInt("id")); err == nil {
		data.Account = &connectAccount{
			Id:       user.Id,
			Username: user.Username,
			Email:    user.Email,
			Quota:    user.Quota,
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// connectDefaultModel resolves the operator-configured default against what the
// account can actually reach, falling back to its first chat model so a
// connected account is never left without a usable selection.
func connectDefaultModel(chatModels []string) string {
	if len(chatModels) == 0 {
		return ""
	}
	configured := system_setting.GetConnectSettings().DefaultModel
	for _, name := range chatModels {
		if name == configured {
			return configured
		}
	}
	return chatModels[0]
}
