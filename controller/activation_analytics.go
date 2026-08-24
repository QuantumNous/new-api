package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func sendActivationEvent(c *gin.Context, name string, params map[string]any) {
	if c == nil || c.Request == nil {
		return
	}
	clientID, sessionID := service.ResolveGAIdentifiers(c.Request, "", "")
	if clientID == "" || sessionID == "" {
		return
	}
	if params == nil {
		params = map[string]any{}
	}
	params["activation_surface"] = name
	base := service.GAEvent{
		Name: name, ClientID: clientID, SessionID: sessionID,
		TimestampMicros: common.GetTimestamp() * 1_000_000, Params: params,
	}
	service.SendGAEvent(c, base)
	activateParams := make(map[string]any, len(params)+1)
	for key, value := range params {
		activateParams[key] = value
	}
	activateParams["activation_type"] = name
	service.SendGAEvent(c, service.GAEvent{
		Name: "activate_success", ClientID: base.ClientID, SessionID: base.SessionID,
		TimestampMicros: base.TimestampMicros, Params: activateParams,
	})
}

func sendActivationEventOnSuccess(c *gin.Context, name string, params map[string]any) {
	if c != nil && c.Writer != nil && c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
		sendActivationEvent(c, name, params)
	}
}
