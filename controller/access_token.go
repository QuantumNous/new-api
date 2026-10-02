package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// accessTokenMinLifetimeSecs is the shortest expiry a new access token may have.
const accessTokenMinLifetimeSecs = 60 * 60

type accessTokenItem struct {
	model.UserAccessToken
	Scopes []string `json:"scopes"`
}

type accessTokenCreateRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt int64    `json:"expires_at"`
}

// accessTokenUpdateRequest renames a token; a present scopes field also
// replaces its grant.
type accessTokenUpdateRequest struct {
	Name   string   `json:"name"`
	Scopes []string `json:"scopes"`
}

func newAccessTokenItem(token *model.UserAccessToken) accessTokenItem {
	scopes := token.GetScopes()
	if scopes == nil {
		scopes = []string{}
	}
	return accessTokenItem{UserAccessToken: *token, Scopes: scopes}
}

func writeAccessTokenError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"success": false, "code": code, "message": message})
}

// normalizeAccessTokenName returns the trimmed name, or false when it is empty
// or longer than the 64-character column.
func normalizeAccessTokenName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	count := utf8.RuneCountInString(name)
	return name, count > 0 && count <= 64
}

func ListAccessTokens(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	tokens, err := model.ListUserAccessTokens(identity.UserID)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	items := make([]accessTokenItem, 0, len(tokens))
	for i := range tokens {
		items = append(items, newAccessTokenItem(&tokens[i]))
	}
	var legacy gin.H
	if !model.LegacyAccessTokensRetired(common.GetTimestamp()) {
		status, err := model.GetUserAccessTokenStatus(identity.UserID)
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		if status.Exists {
			legacy = gin.H{
				"token_hint":   status.TokenHint,
				"token_ref":    status.TokenRef,
				"created_at":   status.CreatedAt,
				"last_used_at": status.LastUsedAt,
				"last_used_ip": status.LastUsedIp,
				"retire_at":    model.LegacyAccessTokenRetireAt(),
			}
		}
	}
	common.ApiSuccess(c, gin.H{"items": items, "legacy": legacy})
}

func GetAccessTokenCatalog(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	common.ApiSuccess(c, gin.H{
		"groups":              service.AccessTokenCatalog(identity.UserID, c.GetInt("role")),
		"max_tokens":          service.AccessTokenMaxPerUser,
		"default_expiry_days": service.AccessTokenDefaultExpiryDays,
	})
}

// GetAccessTokenScopes returns the unfiltered scope labels used to describe
// stored grants, such as those in audit records.
func GetAccessTokenScopes(c *gin.Context) {
	if _, ok := requireBrowserSession(c); !ok {
		return
	}
	common.ApiSuccess(c, gin.H{"resources": service.AccessTokenScopeDictionary()})
}

// CreateAccessToken validates the whole request before consuming the proof, so
// a rejected grant never burns the user's verification.
func CreateAccessToken(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	var req accessTokenCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		writeAccessTokenError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body.")
		return
	}
	name, ok := normalizeAccessTokenName(req.Name)
	if !ok {
		writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_NAME_INVALID", "Access token name must be 1 to 64 characters.")
		return
	}
	now := common.GetTimestamp()
	if req.ExpiresAt != 0 && req.ExpiresAt < now+accessTokenMinLifetimeSecs {
		writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_EXPIRY_INVALID", "Access token expiry must be at least one hour from now.")
		return
	}
	scopes, err := service.NormalizeAccessTokenScopes(identity.UserID, c.GetInt("role"), req.Scopes)
	switch {
	case errors.Is(err, service.ErrAccessTokenScopeForbidden):
		writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_SCOPE_FORBIDDEN", "You cannot grant one or more of these permissions.")
		return
	case err != nil:
		writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_SCOPE_INVALID", "Select at least one valid permission.")
		return
	}
	proofContext, err := common.Marshal(service.AccessTokenGenerateContext{Scopes: scopes, ExpiresAt: req.ExpiresAt})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenGenerate, Context: proofContext}) == nil {
		return
	}
	suffix, err := common.GenerateRandomCharsKey(43)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	raw := model.AccessTokenPrefix + suffix
	token := &model.UserAccessToken{
		Name:      name,
		TokenHash: model.AccessTokenFingerprint(raw),
		TokenHint: model.AccessTokenHint(raw),
		ExpiresAt: req.ExpiresAt,
		CreatedAt: now,
	}
	if err := token.SetScopes(scopes); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if err := model.CreateUserAccessToken(identity.UserID, token, service.AccessTokenMaxPerUser); err != nil {
		if errors.Is(err, model.ErrAccessTokenLimit) {
			writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_LIMIT", common.TranslateMessage(c, i18n.MsgAuthAccessTokenLimit, map[string]any{"Count": service.AccessTokenMaxPerUser}))
			return
		}
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "access_token.generate", map[string]any{
		"token_id":   token.Id,
		"name":       token.Name,
		"scopes":     scopes,
		"expires_at": token.ExpiresAt,
		"token_ref":  token.TokenHash,
	})
	common.ApiSuccess(c, gin.H{"token": raw, "item": newAccessTokenItem(token)})
}

// UpdateAccessToken renames a token without verification. Changing the grant
// is checked in full before the proof is consumed, like creation.
func UpdateAccessToken(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	var req accessTokenUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		writeAccessTokenError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body.")
		return
	}
	name, ok := normalizeAccessTokenName(req.Name)
	if !ok {
		writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_NAME_INVALID", "Access token name must be 1 to 64 characters.")
		return
	}
	var scopes []string
	var previous *model.UserAccessToken
	if req.Scopes != nil {
		previous, err = model.GetUserAccessToken(identity.UserID, id)
		if errors.Is(err, model.ErrAccessTokenNotFound) {
			writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
			return
		}
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		scopes, err = service.NormalizeAccessTokenScopes(identity.UserID, c.GetInt("role"), req.Scopes)
		switch {
		case errors.Is(err, service.ErrAccessTokenScopeForbidden):
			writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_SCOPE_FORBIDDEN", "You cannot grant one or more of these permissions.")
			return
		case err != nil:
			writeAccessTokenError(c, http.StatusBadRequest, "ACCESS_TOKEN_SCOPE_INVALID", "Select at least one valid permission.")
			return
		}
		proofContext, err := common.Marshal(service.AccessTokenUpdateContext{TokenID: id, Scopes: scopes})
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenUpdate, Context: proofContext}) == nil {
			return
		}
	}
	token, err := model.UpdateUserAccessToken(identity.UserID, id, name, scopes)
	if errors.Is(err, model.ErrAccessTokenNotFound) {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if previous == nil {
		recordUserSecurityAudit(c, identity.UserID, "access_token.rename", map[string]any{"token_id": token.Id, "name": token.Name})
		common.ApiSuccess(c, newAccessTokenItem(token))
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "access_token.update", map[string]any{
		"token_id":        token.Id,
		"name":            token.Name,
		"scopes":          scopes,
		"previous_scopes": previous.GetScopes(),
		"token_ref":       token.TokenHash,
	})
	common.ApiSuccess(c, newAccessTokenItem(token))
}

// DeleteAccessToken checks ownership before consuming the proof, so probing
// other users' token IDs never burns a verification.
func DeleteAccessToken(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	if _, err := model.GetUserAccessToken(identity.UserID, id); err != nil {
		if errors.Is(err, model.ErrAccessTokenNotFound) {
			writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
			return
		}
		writeSecurityOperationError(c, err)
		return
	}
	proofContext, err := common.Marshal(service.AccessTokenRevokeContext{TokenID: id})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenRevoke, Context: proofContext}) == nil {
		return
	}
	token, err := model.DeleteUserAccessToken(identity.UserID, id)
	if errors.Is(err, model.ErrAccessTokenNotFound) {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "access_token.revoke", map[string]any{"token_id": token.Id, "name": token.Name, "token_ref": token.TokenHash})
	common.ApiSuccess(c, nil)
}

// RevokeLegacyAccessToken removes the pre-scope users.access_token credential.
// After the transition deadline the legacy token no longer exists for callers.
func RevokeLegacyAccessToken(c *gin.Context) {
	identity, ok := requireBrowserSession(c)
	if !ok {
		return
	}
	if model.LegacyAccessTokensRetired(common.GetTimestamp()) {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	status, err := model.GetUserAccessTokenStatus(identity.UserID)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if !status.Exists {
		writeAccessTokenError(c, http.StatusNotFound, "ACCESS_TOKEN_NOT_FOUND", model.ErrAccessTokenNotFound.Error())
		return
	}
	proofContext, err := common.Marshal(service.AccessTokenRevokeContext{Legacy: true})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccessTokenRevoke, Context: proofContext}) == nil {
		return
	}
	ref, err := model.RevokeUserAccessToken(identity.UserID)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if ref != "" {
		recordUserSecurityAudit(c, identity.UserID, "access_token.revoke", map[string]any{"legacy": true, "token_ref": ref})
	}
	common.ApiSuccess(c, nil)
}

func GetAuditLogs(c *gin.Context) {
	page := common.GetPageQuery(c)
	if page.Page < 1 || page.PageSize < 1 || page.Page > 100000000 {
		common.ApiErrorMsg(c, "Invalid audit pagination")
		return
	}
	filter := model.AuditLogFilter{Username: c.Query("username"), Category: c.Query("category"), TokenRef: c.Query("token_ref"), ExcludeTokenRef: c.Query("exclude_token_ref"), RequestId: c.Query("request_id")}
	viewerRole := c.GetInt("role")
	if c.FullPath() == "/api/audit/self" {
		filter.UserId = c.GetInt("id")
		filter.Username = ""
		filter.SelfView = true
	}
	if !model.ValidAuditCategory(filter.Category) || !model.ValidTokenFingerprint(filter.TokenRef) || !model.ValidTokenFingerprint(filter.ExcludeTokenRef) {
		common.ApiErrorMsg(c, "Invalid audit filters")
		return
	}
	for name, target := range map[string]*int64{"start_timestamp": &filter.StartTimestamp, "end_timestamp": &filter.EndTimestamp} {
		if raw := c.Query(name); raw != "" {
			parsed, err := strconv.ParseInt(raw, 10, 64)
			if err != nil || parsed < 0 {
				common.ApiErrorMsg(c, "Invalid audit time range")
				return
			}
			*target = parsed
		}
	}
	if filter.EndTimestamp > 0 && filter.EndTimestamp < filter.StartTimestamp {
		common.ApiErrorMsg(c, "Invalid audit time range")
		return
	}
	if raw := c.Query("success"); raw != "" {
		if raw != "true" && raw != "false" {
			common.ApiErrorMsg(c, "Invalid audit result")
			return
		}
		success := raw == "true"
		filter.Success = &success
	}
	logs, total, err := model.GetAuditLogs(filter, page.GetStartIdx(), page.GetPageSize(), viewerRole)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetItems(logs)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}
