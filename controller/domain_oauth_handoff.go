package controller

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const domainLoginHandoffTTL = 2 * time.Minute

type domainLoginHandoffPayload struct {
	DomainID            int64  `json:"domain_id"`
	TargetHost          string `json:"target_host"`
	BrowserBindingHash  string `json:"browser_binding_hash"`
	ExpectedAuthVersion int64  `json:"expected_auth_version"`
	LoginMethod         string `json:"login_method"`
}

type domainLoginHandoffRequest struct {
	Ticket string `json:"ticket"`
}

type domainBindHandoffPayload struct {
	DomainID               int64  `json:"domain_id"`
	TargetHost             string `json:"target_host"`
	BrowserBindingHash     string `json:"browser_binding_hash"`
	ExpectedAuthVersion    int64  `json:"expected_auth_version"`
	ExpectedSessionVersion int64  `json:"expected_session_version"`
	ProviderUserID         string `json:"provider_user_id"`
	ProviderColumn         string `json:"provider_column"`
}

type domainLoginFallbackPayload struct {
	ExpectedAuthVersion int64  `json:"expected_auth_version"`
	LoginMethod         string `json:"login_method"`
}

func issueDomainLoginHandoff(c *gin.Context, userID int, providerName string, statePayload oauthFlowPayload) (bool, error) {
	if statePayload.BrowserBindingHash == "" {
		return false, nil
	}
	expectedHost, active, err := resolveOAuthReturnTarget(statePayload)
	if err != nil || !active {
		return false, err
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return false, err
	}
	handoffPayload, err := common.Marshal(domainLoginHandoffPayload{
		DomainID:            statePayload.DomainID,
		TargetHost:          expectedHost,
		BrowserBindingHash:  statePayload.BrowserBindingHash,
		ExpectedAuthVersion: user.AuthVersion,
		LoginMethod:         "oauth:" + providerName,
	})
	if err != nil {
		return false, err
	}
	ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeDomainLoginHandoff,
		UserId:    user.Id,
		Provider:  providerName,
		Payload:   string(handoffPayload),
		ExpiresAt: time.Now().Add(domainLoginHandoffTTL),
	})
	if err != nil {
		return false, err
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"action":        "domain_login_handoff",
			"ticket":        ticket,
			"target_origin": "https://" + expectedHost,
		},
	})
	return true, nil
}

func resolveOAuthReturnTarget(statePayload oauthFlowPayload) (string, bool, error) {
	if statePayload.DomainID < 0 || statePayload.OriginHost == "" {
		return "", false, nil
	}
	resolver, err := service.NewRuntimeCustomDomainResolver()
	if err != nil {
		return "", false, err
	}
	context, err := resolver.ResolveStoredOrigin(statePayload.DomainID, statePayload.OriginHost)
	if err != nil {
		if err == service.ErrCustomDomainOriginInvalid {
			return "", false, nil
		}
		return "", false, err
	}
	if context.Kind == service.CustomDomainKindDisabled {
		return context.Host, false, nil
	}
	if context.Kind != service.CustomDomainKindMain && context.Kind != service.CustomDomainKindCustom {
		return "", false, nil
	}
	return context.Host, true, nil
}

func writeDomainBindReturn(c *gin.Context, targetHost, provider, result, message string) {
	setDomainHandoffNoStore(c)
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": message,
		"data": gin.H{
			"action":        "domain_bind_return",
			"target_origin": "https://" + targetHost,
			"provider":      provider,
			"result":        result,
		},
	})
}

func writeOAuthFlowFailure(c *gin.Context, intent string, statePayload oauthFlowPayload, provider, result, message string) bool {
	targetHost, active, err := resolveOAuthReturnTarget(statePayload)
	if err != nil {
		common.ApiError(c, err)
		return true
	}
	if intent == model.AuthFlowIntentBind && targetHost != "" {
		if !active {
			result = "target_unavailable"
		}
		writeDomainBindReturn(c, targetHost, provider, result, message)
		return true
	}
	if intent != model.AuthFlowIntentLogin || !active {
		return false
	}
	setDomainHandoffNoStore(c)
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": message,
		"data": gin.H{
			"action":        "domain_oauth_return",
			"target_origin": "https://" + targetHost,
		},
	})
	return true
}

func issueDomainBindHandoff(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, pendingFlow *model.AuthFlow, statePayload oauthFlowPayload) error {
	targetHost, active, err := resolveOAuthReturnTarget(statePayload)
	if err != nil {
		return err
	}
	if !active || pendingFlow.UserId <= 0 || pendingFlow.SessionId == "" || statePayload.BrowserBindingHash == "" ||
		statePayload.ExpectedAuthVersion <= 0 || statePayload.ExpectedSessionVersion <= 0 || oauthUser.ProviderUserID == "" {
		return model.ErrAuthFlowInvalid
	}
	providerColumn := provider.ProviderUserIDColumn()
	if providerColumn == "" {
		return fmt.Errorf("custom-domain OAuth bind handoff does not support provider %s", pendingFlow.Provider)
	}
	if _, _, err := service.ValidateLoginSession(service.AuthIdentity{
		UserID:          pendingFlow.UserId,
		SessionID:       pendingFlow.SessionId,
		UserAuthVersion: statePayload.ExpectedAuthVersion,
		SessionVersion:  statePayload.ExpectedSessionVersion,
	}); err != nil {
		return err
	}
	payloadBytes, err := common.Marshal(domainBindHandoffPayload{
		DomainID:               statePayload.DomainID,
		TargetHost:             targetHost,
		BrowserBindingHash:     statePayload.BrowserBindingHash,
		ExpectedAuthVersion:    statePayload.ExpectedAuthVersion,
		ExpectedSessionVersion: statePayload.ExpectedSessionVersion,
		ProviderUserID:         oauthUser.ProviderUserID,
		ProviderColumn:         providerColumn,
	})
	if err != nil {
		return err
	}
	ticket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeDomainBindHandoff,
		Provider:  pendingFlow.Provider,
		Intent:    model.AuthFlowIntentBind,
		UserId:    pendingFlow.UserId,
		SessionId: pendingFlow.SessionId,
		Payload:   string(payloadBytes),
		ExpiresAt: time.Now().Add(domainLoginHandoffTTL),
	})
	if err != nil {
		return err
	}
	setDomainHandoffNoStore(c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"action":        "domain_bind_handoff",
			"ticket":        ticket,
			"target_origin": "https://" + targetHost,
			"provider":      pendingFlow.Provider,
		},
	})
	return nil
}

func ConsumeDomainLoginHandoff(c *gin.Context) {
	setDomainHandoffNoStore(c)
	domainContext, found := middleware.GetCustomDomainContext(c)
	allowedTarget := domainContext.Kind == service.CustomDomainKindCustom ||
		domainContext.Kind == service.CustomDomainKindDisabled ||
		(domainContext.Kind == service.CustomDomainKindMain && !domainContext.IsCallbackHost)
	if !found || !allowedTarget {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	var request domainLoginHandoffRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || strings.TrimSpace(request.Ticket) == "" {
		writeInvalidDomainHandoff(c, http.StatusBadRequest)
		return
	}
	request.Ticket = strings.TrimSpace(request.Ticket)
	flow, err := model.GetAuthFlow(request.Ticket, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeDomainLoginHandoff})
	if err != nil {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	var payload domainLoginHandoffPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil ||
		flow.UserId <= 0 || payload.ExpectedAuthVersion <= 0 || payload.LoginMethod == "" ||
		payload.DomainID != domainContext.DomainID ||
		subtle.ConstantTimeCompare([]byte(payload.TargetHost), []byte(domainContext.Host)) != 1 {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}

	resolver, err := service.NewRuntimeCustomDomainResolver()
	if err != nil {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	targetContext, err := resolver.ResolveStoredOrigin(payload.DomainID, payload.TargetHost)
	if err != nil ||
		(targetContext.Kind != service.CustomDomainKindMain &&
			targetContext.Kind != service.CustomDomainKindCustom &&
			targetContext.Kind != service.CustomDomainKindDisabled) ||
		subtle.ConstantTimeCompare([]byte(targetContext.Host), []byte(domainContext.Host)) != 1 {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	binding, err := c.Cookie(domainOAuthBindingCookieName)
	if err != nil || subtle.ConstantTimeCompare([]byte(domainOAuthBindingHash(binding)), []byte(payload.BrowserBindingHash)) != 1 {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	if targetContext.Kind == service.CustomDomainKindDisabled {
		if _, err := model.ConsumeAuthFlow(request.Ticket, model.AuthFlowMatch{
			Purpose:  model.AuthFlowPurposeDomainLoginHandoff,
			Provider: flow.Provider,
			UserId:   flow.UserId,
		}); err != nil {
			writeInvalidDomainHandoff(c, http.StatusForbidden)
			return
		}
		fallbackPayload, err := common.Marshal(domainLoginFallbackPayload{
			ExpectedAuthVersion: payload.ExpectedAuthVersion,
			LoginMethod:         payload.LoginMethod,
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		fallbackTicket, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
			Purpose:   model.AuthFlowPurposeDomainLoginFallback,
			Provider:  flow.Provider,
			UserId:    flow.UserId,
			Payload:   string(fallbackPayload),
			ExpiresAt: time.Now().Add(domainLoginHandoffTTL),
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"action":        "domain_login_fallback",
				"ticket":        fallbackTicket,
				"target_origin": strings.TrimRight(common.CustomDomainMainOrigin, "/"),
			},
		})
		return
	}
	if _, err := model.ConsumeAuthFlow(request.Ticket, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeDomainLoginHandoff,
		Provider: flow.Provider,
		UserId:   flow.UserId,
	}); err != nil {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	bundle, err := service.CreateLoginSessionAtAuthVersion(
		flow.UserId,
		payload.ExpectedAuthVersion,
		payload.LoginMethod,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	model.UpdateUserLastLoginAt(flow.UserId)
	service.WriteRefreshCookie(c, bundle.RefreshToken)
	recordLoginAuditByUserID(flow.UserId, payload.LoginMethod, c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"action": "domain_login_handoff"},
	})
}

func ConsumeDomainBindHandoff(c *gin.Context) {
	setDomainHandoffNoStore(c)
	domainContext, found := middleware.GetCustomDomainContext(c)
	identity, authenticated := middleware.GetSessionAuthIdentity(c)
	allowedTarget := domainContext.Kind == service.CustomDomainKindCustom ||
		(domainContext.Kind == service.CustomDomainKindMain && !domainContext.IsCallbackHost)
	if !found || !allowedTarget || !authenticated {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	var request domainLoginHandoffRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || strings.TrimSpace(request.Ticket) == "" {
		writeInvalidDomainBindHandoff(c, http.StatusBadRequest)
		return
	}
	request.Ticket = strings.TrimSpace(request.Ticket)
	match := model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposeDomainBindHandoff,
		Intent:    model.AuthFlowIntentBind,
		UserId:    identity.UserID,
		SessionId: identity.SessionID,
	}
	flow, err := model.GetAuthFlow(request.Ticket, match)
	if err != nil {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	var payload domainBindHandoffPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil ||
		payload.DomainID != domainContext.DomainID || payload.ProviderUserID == "" || payload.ProviderColumn == "" ||
		payload.ExpectedAuthVersion != identity.UserAuthVersion || payload.ExpectedSessionVersion != identity.SessionVersion ||
		subtle.ConstantTimeCompare([]byte(payload.TargetHost), []byte(domainContext.Host)) != 1 {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	resolver, err := service.NewRuntimeCustomDomainResolver()
	if err != nil {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	targetContext, err := resolver.ResolveStoredOrigin(payload.DomainID, payload.TargetHost)
	if err != nil ||
		(targetContext.Kind != service.CustomDomainKindMain && targetContext.Kind != service.CustomDomainKindCustom) ||
		subtle.ConstantTimeCompare([]byte(targetContext.Host), []byte(domainContext.Host)) != 1 {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	binding, err := c.Cookie(domainOAuthBindingCookieName)
	if err != nil || subtle.ConstantTimeCompare([]byte(domainOAuthBindingHash(binding)), []byte(payload.BrowserBindingHash)) != 1 {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	provider := oauth.GetProvider(flow.Provider)
	if provider == nil || !provider.IsEnabled() || provider.ProviderUserIDColumn() != payload.ProviderColumn || provider.IsUserIDTaken(payload.ProviderUserID) {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	if _, err := model.ConsumeAuthFlowWithAction(request.Ticket, match, func(tx *gorm.DB, _ *model.AuthFlow) error {
		return model.UpdateUserBindColumnWithTx(tx, identity.UserID, payload.ProviderColumn, payload.ProviderUserID)
	}); err != nil {
		writeInvalidDomainBindHandoff(c, http.StatusForbidden)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"action": "bind"},
	})
}

func ConsumeDomainLoginFallback(c *gin.Context) {
	setDomainHandoffNoStore(c)
	if !isCustomDomainCallbackRequest(c) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	var request domainLoginHandoffRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || strings.TrimSpace(request.Ticket) == "" {
		writeInvalidDomainHandoff(c, http.StatusBadRequest)
		return
	}
	request.Ticket = strings.TrimSpace(request.Ticket)
	flow, err := model.GetAuthFlow(request.Ticket, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeDomainLoginFallback})
	if err != nil {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	var payload domainLoginFallbackPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil || flow.UserId <= 0 || payload.ExpectedAuthVersion <= 0 || payload.LoginMethod == "" {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	if _, err := model.ConsumeAuthFlow(request.Ticket, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeDomainLoginFallback,
		Provider: flow.Provider,
		UserId:   flow.UserId,
	}); err != nil {
		writeInvalidDomainHandoff(c, http.StatusForbidden)
		return
	}
	bundle, err := service.CreateLoginSessionAtAuthVersion(
		flow.UserId,
		payload.ExpectedAuthVersion,
		payload.LoginMethod,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	model.UpdateUserLastLoginAt(flow.UserId)
	service.WriteRefreshCookie(c, bundle.RefreshToken)
	recordLoginAuditByUserID(flow.UserId, payload.LoginMethod, c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"action": "domain_login_fallback"},
	})
}

func setDomainHandoffNoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
}

func writeInvalidDomainHandoff(c *gin.Context, status int) {
	c.JSON(status, gin.H{
		"success": false,
		"code":    "DOMAIN_LOGIN_HANDOFF_INVALID",
		"message": "domain login handoff is invalid",
	})
}

func writeInvalidDomainBindHandoff(c *gin.Context, status int) {
	c.JSON(status, gin.H{
		"success": false,
		"code":    "DOMAIN_BIND_HANDOFF_INVALID",
		"message": "domain bind handoff is invalid",
	})
}
