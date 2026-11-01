package controller

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const partnerOAuthFormMediaType = "application/x-www-form-urlencoded"

func partnerOAuthHostOK(c *gin.Context) bool {
	customOK := false
	if common.CustomDomainEnabled {
		context, found := middleware.GetCustomDomainContext(c)
		customOK = found && context.Kind == service.CustomDomainKindMain && context.IsCallbackHost
	}
	return service.PartnerOAuthHostAllowed(c.Request.Host, common.CustomDomainEnabled, customOK)
}

func ensurePartnerOAuthHost(c *gin.Context) bool {
	if _, err := service.PartnerOAuthIssuer(); err != nil {
		writePartnerOAuthError(c, err)
		return false
	}
	if !partnerOAuthHostOK(c) {
		c.Status(http.StatusNotFound)
		return false
	}
	return true
}

func writePartnerOAuthError(c *gin.Context, err error) {
	typed := service.AsPartnerOAuthError(err)
	if typed == nil {
		_ = c.Error(err)
		c.Header("Cache-Control", "no-store")
		c.Header("Pragma", "no-cache")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "please try again later",
		})
		return
	}
	if typed.WWWAuth != "" {
		c.Header("WWW-Authenticate", typed.WWWAuth)
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(typed.Status, gin.H{
		"error":             typed.Code,
		"error_description": typed.Description,
	})
}

func writePartnerIntegrationAPIError(c *gin.Context, err error) {
	typed := service.AsPartnerOAuthError(err)
	if typed == nil {
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":      gin.H{"code": "server_error", "message": "please try again later"},
			"request_id": c.GetString(common.RequestIdKey),
		})
		return
	}
	if typed.WWWAuth != "" {
		c.Header("WWW-Authenticate", typed.WWWAuth)
	}
	c.JSON(typed.Status, gin.H{
		"error":      gin.H{"code": typed.Code, "message": typed.Description},
		"request_id": c.GetString(common.RequestIdKey),
	})
}

// recordPartnerOAuthReplay logs a replay that revoked an active binding, and
// surfaces a replay whose revocation could not be completed.
func recordPartnerOAuthReplay(c *gin.Context, client *model.PartnerOAuthClient, action string, err error) {
	if errors.Is(err, service.ErrPartnerOAuthReplayRevocationUnavailable) {
		logger.LogError(c.Request.Context(), common.LogText("partner oauth replay revocation failed (request_id=%s): database error", c.GetString(common.RequestIdKey)))
	}
	var replay *service.PartnerOAuthReplayRevocation
	if errors.As(err, &replay) {
		model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: action, Success: false,
			Reason: replay.Kind, ClientId: client.ClientId, BindingId: replay.BindingID, TargetUserId: replay.UserID, Status: http.StatusBadRequest})
	}
}

func PartnerOAuthAuthorize(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("Cache-Control", "no-store")
	params, err := parsePartnerOAuthQuery(c)
	if err != nil {
		writePartnerOAuthAuthorizeRedirectOrPage(c, params, err)
		return
	}
	if params["response_type"] != "" && params["response_type"] != "code" {
		writePartnerOAuthAuthorizeRedirectOrPage(c, params, service.AsPartnerOAuthError(partnerOAuthRequestErr("unsupported_response_type", "response_type must be code")))
		return
	}
	requestToken, nonce, consentURL, err := service.BeginPartnerOAuthAuthorization(
		params["client_id"],
		params["redirect_uri"],
		params["scope"],
		params["state"],
		params["code_challenge"],
		params["code_challenge_method"],
	)
	if err != nil {
		writePartnerOAuthAuthorizeRedirectOrPage(c, params, err)
		return
	}
	setPartnerOAuthRequestCookie(c, nonce)
	c.Header("Referrer-Policy", "no-referrer")
	c.Redirect(http.StatusSeeOther, consentURL)
	_ = requestToken
}

func writePartnerOAuthAuthorizeRedirectOrPage(c *gin.Context, params map[string]string, err error) {
	typed := service.AsPartnerOAuthError(err)
	if typed == nil {
		writePartnerOAuthHTMLError(c, http.StatusInternalServerError, "server_error")
		return
	}
	if typed.Code == "invalid_client" || typed.Code == "invalid_redirect" {
		writePartnerOAuthHTMLError(c, http.StatusBadRequest, typed.Code)
		return
	}
	issuer, issuerErr := service.PartnerOAuthIssuer()
	if issuerErr != nil || params["redirect_uri"] == "" {
		writePartnerOAuthHTMLError(c, typed.Status, typed.Code)
		return
	}
	// Query and response_type errors arrive before the redirect URI was
	// matched against the client, so verify it here before redirecting.
	if _, resolveErr := service.ResolvePartnerOAuthRedirectClient(params["client_id"], params["redirect_uri"]); resolveErr != nil {
		resolved := service.AsPartnerOAuthError(resolveErr)
		writePartnerOAuthHTMLError(c, http.StatusBadRequest, resolved.Code)
		return
	}
	state := params["state"]
	if service.ValidatePartnerOAuthState(state) != nil {
		state = ""
	}
	values := url.Values{}
	values.Set("error", typed.Code)
	target, appendErr := service.AppendPartnerOAuthCallback(params["redirect_uri"], state, issuer, values)
	if appendErr != nil {
		writePartnerOAuthHTMLError(c, http.StatusBadRequest, "invalid_request")
		return
	}
	c.Header("Referrer-Policy", "no-referrer")
	c.Redirect(http.StatusFound, target)
}

func partnerOAuthRequestErr(code, description string) error {
	return &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: code, Description: description}
}

func parsePartnerOAuthQuery(c *gin.Context) (map[string]string, error) {
	raw := c.Request.URL.RawQuery
	values, err := url.ParseQuery(raw)
	if err != nil {
		return map[string]string{}, partnerOAuthRequestErr("invalid_request", "query is invalid")
	}
	keys := []string{"response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"}
	out := make(map[string]string, len(keys))
	for _, key := range keys {
		items := values[key]
		if len(items) > 1 {
			return out, partnerOAuthRequestErr("invalid_request", "parameter is repeated")
		}
		if len(items) == 1 {
			out[key] = items[0]
		}
	}
	return out, nil
}

func writePartnerOAuthHTMLError(c *gin.Context, status int, code string) {
	if !service.IsPrintablePartnerOAuthErrorCode(code) {
		code = "invalid_request"
	}
	title := i18n.T(c, "partner_oauth.error."+code+".title")
	description := i18n.T(c, "partner_oauth.error."+code+".description")
	lang := i18n.StatedLang(c)
	if lang == "" {
		lang = common.DefaultLanguage
	}
	page := "<!DOCTYPE html><html lang=\"" + html.EscapeString(lang) + "\"><head><meta charset=\"utf-8\">" +
		"<meta name=\"referrer\" content=\"no-referrer\">" +
		"<title>" + html.EscapeString(title) + "</title></head><body><h1>" + html.EscapeString(title) +
		"</h1><p>" + html.EscapeString(description) + "</p></body></html>"
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'")
	c.Data(status, "text/html; charset=utf-8", []byte(page))
}

func setPartnerOAuthRequestCookie(c *gin.Context, nonce string) {
	secure := !service.PartnerOAuthIssuerIsHTTP()
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     service.PartnerOAuthCookieName,
		Value:    nonce,
		Path:     service.PartnerOAuthCookiePath,
		MaxAge:   service.PartnerOAuthCookieMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearPartnerOAuthRequestCookie(c *gin.Context) {
	secure := !service.PartnerOAuthIssuerIsHTTP()
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     service.PartnerOAuthCookieName,
		Value:    "",
		Path:     service.PartnerOAuthCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func partnerOAuthRequestCookie(c *gin.Context) string {
	cookie, err := c.Request.Cookie(service.PartnerOAuthCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func PartnerOAuthInspectAuthorization(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	identity, ok := middleware.GetBrowserSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "a browser session is required"})
		return
	}
	view, err := service.InspectPartnerOAuthAuthorizationForUser(c.Query("request"), partnerOAuthRequestCookie(c), identity.UserID)
	if err != nil {
		if typed := service.AsPartnerOAuthError(err); typed != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": typed.Description})
			return
		}
		logger.LogError(c.Request.Context(), common.LogText("partner oauth consent inspect failed (request_id=%s): database error", c.GetString(common.RequestIdKey)))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "please try again later"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": view})
}

func PartnerOAuthDecideAuthorization(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	identity, ok := middleware.GetBrowserSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "a browser session is required"})
		return
	}
	var body struct {
		Request  string `json:"request"`
		Decision string `json:"decision"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if body.Decision != "approve" && body.Decision != "deny" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "decision must be approve or deny"})
		return
	}
	user, err := model.GetUserById(identity.UserID, false)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "account is unavailable"})
		return
	}
	redirectTo, clientID, err := service.DecidePartnerOAuthAuthorization(body.Request, partnerOAuthRequestCookie(c), body.Decision, user)
	if err != nil {
		// A rejected decision (e.g. binding limit) leaves the request
		// unconsumed, so keep the cookie and let the user retry.
		if typed := service.AsPartnerOAuthError(err); typed != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": typed.Description})
			return
		}
		logger.LogError(c.Request.Context(), common.LogText("partner oauth consent decision failed (request_id=%s): database error", c.GetString(common.RequestIdKey)))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "please try again later"})
		return
	}
	clearPartnerOAuthRequestCookie(c)
	action := "partner_oauth.consent.deny"
	if body.Decision == "approve" {
		action = "partner_oauth.consent.approve"
	}
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: action, Success: true, Status: http.StatusOK,
		ActorUserId: user.Id, TargetUserId: user.Id, ClientId: clientID})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"redirect_to": redirectTo}})
}

func PartnerOAuthToken(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	form, err := parsePartnerOAuthForm(c)
	if err != nil {
		writePartnerOAuthError(c, err)
		return
	}
	// Partner servers authenticate with server secrets, never the OAuth
	// client secret, so this grant bypasses OAuth client authentication.
	if form["grant_type"] == "client_credentials" {
		partnerServerClientCredentials(c, form)
		return
	}
	client, authErr := authenticatePartnerOAuthClient(c, form)
	if c.IsAborted() {
		return
	}
	if authErr != nil {
		writePartnerOAuthError(c, authErr)
		return
	}
	switch form["grant_type"] {
	case "authorization_code":
		issued, exchangeErr := service.ExchangePartnerOAuthCode(client, form["code"], form["redirect_uri"], form["code_verifier"])
		if exchangeErr != nil {
			recordPartnerOAuthReplay(c, client, "partner_oauth.code.replay_detected", exchangeErr)
			writePartnerOAuthError(c, exchangeErr)
			return
		}
		model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.token.issue", Success: true,
			ClientId: client.ClientId, BindingId: issued.BindingID, TargetUserId: issued.UserID, Status: http.StatusOK})
		c.JSON(http.StatusOK, issued)
	case "refresh_token":
		issued, refreshErr := service.RefreshPartnerOAuthToken(client, form["refresh_token"], form["scope"])
		if refreshErr != nil {
			recordPartnerOAuthReplay(c, client, "partner_oauth.refresh.reuse_detected", refreshErr)
			writePartnerOAuthError(c, refreshErr)
			return
		}
		c.JSON(http.StatusOK, issued)
	default:
		writePartnerOAuthError(c, partnerOAuthRequestErr("unsupported_grant_type", "unsupported grant_type"))
	}
}

func PartnerOAuthRevoke(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	form, err := parsePartnerOAuthForm(c)
	if err != nil {
		writePartnerOAuthError(c, err)
		return
	}
	client, authErr := authenticatePartnerOAuthClient(c, form)
	if c.IsAborted() {
		return
	}
	if authErr != nil {
		writePartnerOAuthError(c, authErr)
		return
	}
	binding, err := service.RevokePartnerOAuthToken(client, form["token"])
	if err != nil {
		writePartnerOAuthError(c, err)
		return
	}
	if binding != nil {
		model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.binding.revoke", Success: true,
			ClientId: client.ClientId, BindingId: binding.BindingId, TargetUserId: binding.UserId, Reason: "revoked", Status: http.StatusOK})
	}
	c.Status(http.StatusOK)
}

func PartnerOAuthAccount(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	if c.Request.URL.RawQuery != "" {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "query parameters are not allowed"})
		return
	}
	principal := middleware.PartnerOAuthPrincipal(c)
	account, err := service.BuildPartnerOAuthAccount(principal)
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	c.JSON(http.StatusOK, account)
}

func PartnerOAuthCredential(c *gin.Context) {
	if !ensurePartnerOAuthHost(c) {
		return
	}
	if c.Request.URL.RawQuery != "" {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "query parameters are not allowed"})
		return
	}
	if c.Request.URL.Query().Has("access_token") {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "access_token must not be sent in the query"})
		return
	}
	media := strings.ToLower(strings.TrimSpace(strings.Split(c.GetHeader("Content-Type"), ";")[0]))
	if media != "application/json" {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusUnsupportedMediaType, Code: "unsupported_media_type", Description: "content type must be application/json"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.PartnerOAuthJSONLimit)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "request body is invalid"})
		return
	}
	if strings.Contains(string(body), "access_token") {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "access_token must not be sent in the body"})
		return
	}
	var object map[string]json.RawMessage
	if err := common.Unmarshal(body, &object); err != nil || len(object) != 0 {
		writePartnerIntegrationAPIError(c, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_request", Description: "request body must be an empty object"})
		return
	}
	principal := middleware.PartnerOAuthPrincipal(c)
	issued, err := service.IssuePartnerOAuthCredential(principal)
	if err != nil {
		writePartnerIntegrationAPIError(c, err)
		return
	}
	if issued.NewlyIssued {
		model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.credential.issue", Success: true,
			ClientId: principal.Client.ClientId, BindingId: principal.Binding.BindingId, TargetUserId: principal.User.Id, Status: http.StatusOK})
	}
	c.JSON(http.StatusOK, issued)
}

func GetUserPartnerOAuthBindings(c *gin.Context) {
	identity, ok := middleware.GetAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	bindings, err := service.ListUserPartnerOAuthBindings(identity.UserID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": bindings})
}

func DeleteUserPartnerOAuthBinding(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	if _, ok := middleware.GetBrowserSessionAuthIdentity(c); !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "code": "AUTH_SESSION_REQUIRED", "message": "a dashboard login session is required"})
		return
	}
	binding, err := service.RevokeUserPartnerOAuthBinding(identity.UserID, c.Param("binding_id"), service.PartnerOAuthRevokeReasonUser)
	if err != nil {
		if typed := service.AsPartnerOAuthError(err); typed != nil && typed.Status == http.StatusNotFound {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "code": typed.Code, "message": typed.Description})
			return
		}
		common.ApiError(c, err)
		return
	}
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.binding.revoke", Success: true,
		ActorUserId: identity.UserID, TargetUserId: identity.UserID, ClientId: binding.ClientId,
		BindingId: binding.BindingId, Reason: "user_revoked", Status: http.StatusOK})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func loadPartnerOAuthAdminTarget(c *gin.Context) (*model.User, bool) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "invalid user id")
		return nil, false
	}
	target, err := model.GetUserById(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	if !canManageTargetRole(c.GetInt("role"), target.Role) {
		common.ApiErrorMsg(c, "no permission")
		return nil, false
	}
	return target, true
}

func GetUserPartnerOAuthBindingsByAdmin(c *gin.Context) {
	target, ok := loadPartnerOAuthAdminTarget(c)
	if !ok {
		return
	}
	bindings, err := service.ListUserPartnerOAuthBindings(target.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": bindings})
}

func DeleteUserPartnerOAuthBindingByAdmin(c *gin.Context) {
	// This token operation is never a generic management audit, even when
	// the binding is missing or the dedicated log store is unavailable, so
	// every outcome, including rejected attempts, goes to the dedicated log.
	markAuditLogged(c)
	entry := model.PartnerOauthAuthorizationLog{Action: "partner_oauth.binding.admin_revoke",
		ActorUserId: c.GetInt("id"), Reason: service.PartnerOAuthRevokeReasonAdmin}
	if targetID, err := strconv.Atoi(c.Param("id")); err == nil && targetID > 0 {
		entry.TargetUserId = targetID
	}
	bindingID := c.Param("binding_id")
	if model.ValidPartnerOAuthLogBindingID(bindingID) {
		entry.BindingId = bindingID
	}
	defer func() {
		entry.Status = c.Writer.Status()
		model.RecordPartnerOAuthAuthorizationLog(c, entry)
	}()
	target, ok := loadPartnerOAuthAdminTarget(c)
	if !ok {
		return
	}
	binding, err := service.RevokeUserPartnerOAuthBinding(target.Id, bindingID, service.PartnerOAuthRevokeReasonAdmin)
	if err != nil {
		if typed := service.AsPartnerOAuthError(err); typed != nil && typed.Status == http.StatusNotFound {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "code": typed.Code, "message": typed.Description})
			return
		}
		common.ApiError(c, err)
		return
	}
	entry.Success = true
	entry.ClientId = binding.ClientId
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func parsePartnerOAuthForm(c *gin.Context) (map[string]string, error) {
	if c.Request.URL.RawQuery != "" {
		return nil, partnerOAuthRequestErr("invalid_request", "query parameters are not allowed")
	}
	media := strings.ToLower(strings.TrimSpace(c.GetHeader("Content-Type")))
	mediaType, _, _ := strings.Cut(media, ";")
	mediaType = strings.TrimSpace(mediaType)
	if mediaType != partnerOAuthFormMediaType {
		return nil, partnerOAuthRequestErr("invalid_request", "content type must be application/x-www-form-urlencoded")
	}
	if strings.Contains(media, "charset=") && !strings.Contains(media, "charset=utf-8") && !strings.Contains(media, `charset="utf-8"`) {
		return nil, partnerOAuthRequestErr("invalid_request", "form charset must be utf-8")
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.PartnerOAuthFormLimit)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, partnerOAuthRequestErr("invalid_request", "request body is too large or invalid")
	}
	if !utf8.Valid(body) {
		return nil, partnerOAuthRequestErr("invalid_request", "request body must be utf-8")
	}
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, partnerOAuthRequestErr("invalid_request", "form is invalid")
	}
	out := make(map[string]string, len(values))
	for key, items := range values {
		if len(items) > 1 {
			return nil, partnerOAuthRequestErr("invalid_request", "parameter is repeated")
		}
		if len(items) == 1 {
			out[key] = items[0]
		}
	}
	return out, nil
}

func authenticatePartnerOAuthClient(c *gin.Context, form map[string]string) (*model.PartnerOAuthClient, error) {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if header != "" {
		scheme, encoded, ok := strings.Cut(header, " ")
		if !ok || !strings.EqualFold(scheme, "Basic") || encoded == "" {
			c.Header("WWW-Authenticate", `Basic realm="oauth"`)
			return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
		}
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			c.Header("WWW-Authenticate", `Basic realm="oauth"`)
			return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
		}
		id, secret, ok := strings.Cut(string(decoded), ":")
		if !ok {
			c.Header("WWW-Authenticate", `Basic realm="oauth"`)
			return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
		}
		id, _ = url.QueryUnescape(id)
		secret, _ = url.QueryUnescape(secret)
		if _, hasSecret := form["client_secret"]; hasSecret {
			return nil, partnerOAuthRequestErr("invalid_request", "client_secret must not be sent in the form")
		}
		if formID, ok := form["client_id"]; ok && formID != id {
			c.Header("WWW-Authenticate", `Basic realm="oauth"`)
			return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
		}
		client, _ := model.GetPartnerOAuthClientByClientID(id)
		matched := service.VerifyPartnerOAuthClientSecret(client, secret)
		if !matched || client == nil || client.Status != model.PartnerOAuthClientStatusEnabled {
			if middleware.PartnerOAuthClientAuthLimited(c, id) {
				return nil, &service.PartnerOAuthError{Status: http.StatusTooManyRequests, Code: "rate_limited", Description: "too many requests"}
			}
			c.Header("WWW-Authenticate", `Basic realm="oauth"`)
			return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
		}
		return client, nil
	}
	if _, hasSecret := form["client_secret"]; hasSecret {
		return nil, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_client", Description: "client authentication failed"}
	}
	clientID := form["client_id"]
	if clientID == "" {
		return nil, partnerOAuthRequestErr("invalid_request", "client_id is required")
	}
	client, err := model.GetPartnerOAuthClientByClientID(clientID)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		if middleware.PartnerOAuthClientAuthLimited(c, clientID) {
			return nil, &service.PartnerOAuthError{Status: http.StatusTooManyRequests, Code: "rate_limited", Description: "too many requests"}
		}
		return nil, &service.PartnerOAuthError{Status: http.StatusBadRequest, Code: "invalid_client", Description: "client authentication failed"}
	}
	if client.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodBasic {
		c.Header("WWW-Authenticate", `Basic realm="oauth"`)
		return nil, &service.PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
	}
	return client, nil
}

func ServePartnerAuthorizePage(indexPage []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Frame-Options", "DENY")
		c.Header("Content-Security-Policy", "frame-ancestors 'none'")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	}
}
