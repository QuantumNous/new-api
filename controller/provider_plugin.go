package controller

import (
	"errors"
	"io"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type pluginLoginStartRequest struct {
	KeyIndex *int `json:"key_index"`
	Add      bool `json:"add"`
}

type pluginLoginContinueRequest struct {
	Flow  string                   `json:"flow"`
	Input service.PluginLoginInput `json:"input"`
}

type pluginLoginCallbackRequest struct {
	Plugin string            `json:"plugin"`
	Params map[string]string `json:"params"`
}

// pluginLoginIdentity is the administrator session a login flow belongs to:
// a browser session, or a scoped access token with its own session.
func pluginLoginIdentity(c *gin.Context) (service.PluginLoginIdentity, bool) {
	identity, ok := middleware.GetStepUpIdentity(c)
	if !ok {
		writeSecurityOperationError(c, service.ErrAuthTokenInvalid)
		return service.PluginLoginIdentity{}, false
	}
	return service.PluginLoginIdentity{UserID: identity.UserID, SessionID: identity.SessionID}, true
}

func pluginLoginChannelID(c *gin.Context) (int, bool) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Channel does not exist")
		return 0, false
	}
	return channelID, true
}

// finishPluginLogin answers a login call; a done step stored a credential, so
// the channel cache is reloaded and the change is audited.
func finishPluginLogin(c *gin.Context, result service.PluginLoginResult, data gin.H) {
	if credential := result.Step.Credential; credential != nil {
		model.InitChannelCache()
		recordManageAudit(c, "channel.update", map[string]any{
			"id":             result.ChannelID,
			"name":           result.ChannelName,
			"changed_fields": []string{"key"},
			"source":         "plugin_login",
			"label":          credential.Label,
			"account_id":     credential.AccountID,
		})
	}
	data["step"] = result.Step
	common.ApiSuccess(c, data)
}

// StartPluginLogin opens a plugin login flow on a channel.
func StartPluginLogin(c *gin.Context) {
	identity, ok := pluginLoginIdentity(c)
	if !ok {
		return
	}
	channelID, ok := pluginLoginChannelID(c)
	if !ok {
		return
	}
	var request pluginLoginStartRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil && !errors.Is(err, io.EOF) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	result, err := service.StartPluginLogin(c.Request.Context(), identity, channelID, request.KeyIndex, request.Add)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	finishPluginLogin(c, result, gin.H{"flow": result.Flow})
}

// ContinuePluginLogin submits the browser's input to a login flow.
func ContinuePluginLogin(c *gin.Context) {
	identity, ok := pluginLoginIdentity(c)
	if !ok {
		return
	}
	channelID, ok := pluginLoginChannelID(c)
	if !ok {
		return
	}
	var request pluginLoginContinueRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	result, err := service.ContinuePluginLogin(c.Request.Context(), identity, channelID, request.Flow, request.Input)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	finishPluginLogin(c, result, gin.H{})
}

// CompletePluginLoginCallback receives the query of the vendor's redirect to
// a plugin's callback page.
func CompletePluginLoginCallback(c *gin.Context) {
	identity, ok := pluginLoginIdentity(c)
	if !ok {
		return
	}
	var request pluginLoginCallbackRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	result, err := service.CompletePluginLoginCallback(c.Request.Context(), identity, request.Plugin, request.Params)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	finishPluginLogin(c, result, gin.H{"channel_id": result.ChannelID})
}

// GetPluginCredentials lists a channel's credentials without their secrets.
func GetPluginCredentials(c *gin.Context) {
	channelID, ok := pluginLoginChannelID(c)
	if !ok {
		return
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		common.ApiErrorT(c, "Channel does not exist")
		return
	}
	common.ApiSuccess(c, gin.H{"items": service.PluginCredentialViews(channel)})
}
