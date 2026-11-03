package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type partnerOAuthClientView struct {
	Id              int64    `json:"id"`
	ClientId        string   `json:"client_id"`
	Name            string   `json:"name"`
	TokenAuthMethod string   `json:"token_auth_method"`
	RedirectURIs    []string `json:"redirect_uris"`
	Scopes          []string `json:"scopes"`
	Status          int      `json:"status"`
	CreatedAt       int64    `json:"created_at"`
	UpdatedAt       int64    `json:"updated_at"`
	ClientSecret    string   `json:"client_secret,omitempty"`
}

func partnerOAuthClientToView(client *model.PartnerOAuthClient, secret string) partnerOAuthClientView {
	uris, _ := service.ParsePartnerOAuthRedirectURIs(client.RedirectURIs)
	return partnerOAuthClientView{
		Id:              client.Id,
		ClientId:        client.ClientId,
		Name:            client.Name,
		TokenAuthMethod: client.TokenAuthMethod,
		RedirectURIs:    uris,
		Scopes:          strings.Fields(client.Scopes),
		Status:          client.Status,
		CreatedAt:       client.CreatedAt,
		UpdatedAt:       client.UpdatedAt,
		ClientSecret:    secret,
	}
}

// GetPartnerOAuthAuthorizationLogs exposes only the dedicated safe projection.
func GetPartnerOAuthAuthorizationLogs(c *gin.Context) {
	query := c.Request.URL.Query()
	for key, values := range query {
		switch key {
		case "page", "page_size", "start", "end", "action", "success", "client_id", "target_user_id":
		default:
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid filter"})
			return
		}
		if len(values) != 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid filter"})
			return
		}
	}
	page, pageSize := 1, 20
	var err error
	if query.Has("page") {
		page, err = strconv.Atoi(query.Get("page"))
		if err != nil || page < 1 || page > 1000000 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid page"})
			return
		}
	}
	if query.Has("page_size") {
		pageSize, err = strconv.Atoi(query.Get("page_size"))
		if err != nil || pageSize < 1 || pageSize > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid page size"})
			return
		}
	}
	filter := model.PartnerOauthAuthorizationLogFilter{Action: query.Get("action"), ClientId: query.Get("client_id")}
	if filter.Action != "" && !model.ValidPartnerOAuthLogAction(filter.Action) ||
		filter.ClientId != "" && !model.ValidPartnerOAuthLogClientID(filter.ClientId) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid filter"})
		return
	}
	if query.Has("success") {
		value, err := strconv.ParseBool(query.Get("success"))
		if err != nil || (query.Get("success") != "true" && query.Get("success") != "false") {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid result"})
			return
		}
		filter.Success = &value
	}
	for _, field := range []struct {
		name string
		into *int64
	}{{"start", &filter.Start}, {"end", &filter.End}} {
		if query.Has(field.name) {
			*field.into, err = strconv.ParseInt(query.Get(field.name), 10, 64)
			if err != nil || *field.into <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid time range"})
				return
			}
		}
	}
	if filter.End > 0 && filter.Start > filter.End {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid time range"})
		return
	}
	if query.Has("target_user_id") {
		filter.TargetUserId, err = strconv.Atoi(query.Get("target_user_id"))
		if err != nil || filter.TargetUserId <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid target user"})
			return
		}
	}
	items, total, err := model.GetPartnerOAuthAuthorizationLogs(filter, (page-1)*pageSize, pageSize)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("partner oauth authorization log read failed (request_id=%s): database error", c.GetString(common.RequestIdKey)))
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "authorization logs unavailable"})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items, "total": total}})
}

func GetPartnerOAuthClients(c *gin.Context) {
	clients, err := model.ListPartnerOAuthClients()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views := make([]partnerOAuthClientView, 0, len(clients))
	for i := range clients {
		views = append(views, partnerOAuthClientToView(&clients[i], ""))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": views})
}

type partnerOAuthClientCreateRequest struct {
	Name            string   `json:"name"`
	TokenAuthMethod string   `json:"token_auth_method"`
	RedirectURIs    []string `json:"redirect_uris"`
	Scopes          []string `json:"scopes"`
}

func CreatePartnerOAuthClient(c *gin.Context) {
	var req partnerOAuthClientCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if err := validatePartnerOAuthClientWrite(req.Name, req.TokenAuthMethod, req.RedirectURIs, req.Scopes, true); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerOAuthClientSensitiveWrite,
		Context: mustPartnerOAuthProofContext(`{"action":"create"}`),
	}) == nil {
		return
	}
	scopes, err := service.CanonicalPartnerOAuthScopes(strings.Join(req.Scopes, " "))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	encoded, err := common.Marshal(req.RedirectURIs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	client := &model.PartnerOAuthClient{
		Name:            strings.TrimSpace(req.Name),
		TokenAuthMethod: req.TokenAuthMethod,
		RedirectURIs:    string(encoded),
		Scopes:          scopes,
		Status:          model.PartnerOAuthClientStatusEnabled,
	}
	var secret string
	if req.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodBasic {
		secret, err = service.GeneratePartnerOAuthClientSecret()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		client.SecretHash = model.HashPartnerOAuthSecret(secret)
	}
	if err := model.CreatePartnerOAuthClient(client); err != nil {
		common.ApiError(c, err)
		return
	}
	recordPartnerOAuthAdminAudit(c, "partner_oauth.client.create", client.ClientId, []string{"name", "redirect_uris", "scopes", "token_auth_method"})
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": partnerOAuthClientToView(client, secret)})
}

type partnerOAuthClientUpdateRequest struct {
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
}

func UpdatePartnerOAuthClient(c *gin.Context) {
	client, ok := loadPartnerOAuthClientByParam(c)
	if !ok {
		return
	}
	var req partnerOAuthClientUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if err := validatePartnerOAuthClientWrite(req.Name, client.TokenAuthMethod, req.RedirectURIs, req.Scopes, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerOAuthClientSensitiveWrite,
		Context: mustPartnerOAuthProofContext(`{"action":"update","client_id":"` + client.ClientId + `"}`),
	}) == nil {
		return
	}
	scopes, err := service.CanonicalPartnerOAuthScopes(strings.Join(req.Scopes, " "))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	encoded, err := common.Marshal(req.RedirectURIs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	client.Name = strings.TrimSpace(req.Name)
	client.RedirectURIs = string(encoded)
	client.Scopes = scopes
	if err := model.UpdatePartnerOAuthClient(client); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePartnerServerSnapshot(client.ClientId)
	recordPartnerOAuthAdminAudit(c, "partner_oauth.client.update", client.ClientId, []string{"name", "redirect_uris", "scopes"})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": partnerOAuthClientToView(client, "")})
}

func RotatePartnerOAuthClientSecret(c *gin.Context) {
	client, ok := loadPartnerOAuthClientByParam(c)
	if !ok {
		return
	}
	if client.TokenAuthMethod != model.PartnerOAuthTokenAuthMethodBasic {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "public clients have no secret"})
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerOAuthClientSensitiveWrite,
		Context: mustPartnerOAuthProofContext(`{"action":"rotate_secret","client_id":"` + client.ClientId + `"}`),
	}) == nil {
		return
	}
	secret, err := service.GeneratePartnerOAuthClientSecret()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RotatePartnerOAuthClientSecret(client.ClientId, model.HashPartnerOAuthSecret(secret)); err != nil {
		common.ApiError(c, err)
		return
	}
	client.SecretHash = model.HashPartnerOAuthSecret(secret)
	recordPartnerOAuthAdminAudit(c, "partner_oauth.client.secret_rotate", client.ClientId, []string{"secret"})
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": partnerOAuthClientToView(client, secret)})
}

func UpdatePartnerOAuthClientStatus(c *gin.Context) {
	client, ok := loadPartnerOAuthClientByParam(c)
	if !ok {
		return
	}
	var req struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Status != model.PartnerOAuthClientStatusEnabled && req.Status != model.PartnerOAuthClientStatusDisabled) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "status must be 1 or 2"})
		return
	}
	suspensionChanged, err := model.SetPartnerOAuthClientStatus(client.ClientId, req.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	client.Status = req.Status
	service.InvalidatePartnerServerSnapshot(client.ClientId)
	reconcilePartnerServerSuspension(c, client, suspensionChanged)
	action := "partner_oauth.client.enable"
	if req.Status == model.PartnerOAuthClientStatusDisabled {
		action = "partner_oauth.client.disable"
	}
	recordPartnerOAuthAdminAudit(c, action, client.ClientId, []string{"status"})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": partnerOAuthClientToView(client, "")})
}

func DeletePartnerOAuthClient(c *gin.Context) {
	client, ok := loadPartnerOAuthClientByParam(c)
	if !ok {
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{
		Scope:   service.VerificationScopePartnerOAuthClientSensitiveWrite,
		Context: mustPartnerOAuthProofContext(`{"action":"delete","client_id":"` + client.ClientId + `"}`),
	}) == nil {
		return
	}
	revoked, err := model.DeletePartnerOAuthClient(client.ClientId)
	if errors.Is(err, model.ErrPartnerOAuthClientHasAccounts) {
		common.ApiErrorT(c, "This client still owns partner sub-accounts; disable it instead")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidatePartnerServerSnapshot(client.ClientId)
	entries := make([]model.PartnerOauthAuthorizationLog, 0, len(revoked))
	for _, binding := range revoked {
		entries = append(entries, model.PartnerOauthAuthorizationLog{Action: "partner_oauth.binding.client_delete", Success: true,
			ActorUserId: c.GetInt("id"), TargetUserId: binding.UserId, ClientId: client.ClientId,
			BindingId: binding.BindingId, Reason: "client_deleted", Status: http.StatusOK})
	}
	model.RecordPartnerOAuthAuthorizationLogs(c, entries)
	recordPartnerOAuthAdminAudit(c, "partner_oauth.client.delete", client.ClientId, nil)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func loadPartnerOAuthClientByParam(c *gin.Context) (*model.PartnerOAuthClient, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return nil, false
	}
	client, err := model.GetPartnerOAuthClientByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "client not found"})
		return nil, false
	}
	return client, true
}

func validatePartnerOAuthClientWrite(name, method string, uris, scopes []string, creating bool) error {
	if err := service.ValidatePartnerOAuthClientName(name); err != nil {
		return err
	}
	if creating {
		if method != model.PartnerOAuthTokenAuthMethodBasic && method != model.PartnerOAuthTokenAuthMethodNone {
			return errPartnerOAuthInvalidAuthMethod
		}
	}
	publicClient := method == model.PartnerOAuthTokenAuthMethodNone
	if err := service.ValidatePartnerOAuthClientRedirects(uris, publicClient); err != nil {
		return err
	}
	_, err := service.CanonicalPartnerOAuthScopes(strings.Join(scopes, " "))
	return err
}

var errPartnerOAuthInvalidAuthMethod = errString("token_auth_method must be client_secret_basic or none")

type errString string

func (e errString) Error() string { return string(e) }

func mustPartnerOAuthProofContext(raw string) []byte {
	return []byte(raw)
}

func recordPartnerOAuthAdminAudit(c *gin.Context, action, clientID string, fields []string) {
	role := c.GetInt("role")
	params := model.AuditFields{"client_id": clientID, "actor_id": c.GetInt("id"), "actor_role": role}
	if len(fields) > 0 {
		params["changed_fields"] = fields
	}
	model.RecordAuditLog(c, model.AuditLog{
		UserId:    c.GetInt("id"),
		ActorRole: role,
		Category:  model.AuditCategorySecurity,
		Action:    action,
		Success:   true,
		Other:     model.AuditOther{Op: &model.AuditOperation{Action: action, Params: params}},
	})
	markAuditLogged(c)
}

// reconcilePartnerServerSuspension brings a partner's sub-accounts in line
// with the status just committed. It runs for every status request with
// server access configured, so repeating the request also retries a job that
// stopped early.
func reconcilePartnerServerSuspension(c *gin.Context, client *model.PartnerOAuthClient, changed bool) {
	if _, err := model.GetPartnerServerConfig(client.ClientId); err != nil {
		if !errors.Is(err, model.ErrPartnerServerConfigNotFound) {
			logger.LogError(c.Request.Context(), common.LogText("partner server config lookup failed client_id=%s: %s", client.ClientId, err.Error()))
		}
		return
	}
	service.StartPartnerServerJob(service.PartnerServerJobSuspension, client.ClientId)
	if !changed {
		return
	}
	action := "partner_server.resume"
	if client.Status == model.PartnerOAuthClientStatusDisabled {
		action = "partner_server.suspend"
	}
	model.RecordPartnerOAuthAuthorizationLog(c, model.PartnerOauthAuthorizationLog{Action: action, Success: true,
		ActorUserId: c.GetInt("id"), ClientId: client.ClientId, Status: http.StatusOK})
}
