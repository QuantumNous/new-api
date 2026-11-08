package identity

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/transport/contract"

	"gorm.io/gorm"
)

// REST surface for personal access tokens, mounted under /api/user/access_tokens.
// Browser-session only: a PAT can never manage tokens (the create/revoke proof
// flow is bound to the step-up session, and tokens must not self-replicate).

type accessTokenItem struct {
	UserAccessToken
	Scopes []string `json:"scopes"`
}

type accessTokenCreateRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt int64    `json:"expires_at"`
}

type accessTokenUpdateRequest struct {
	Name   string   `json:"name"`
	Scopes []string `json:"scopes"`
}

func newAccessTokenItem(token *UserAccessToken) accessTokenItem {
	scopes := token.GetScopes()
	if scopes == nil {
		scopes = []string{}
	}
	return accessTokenItem{UserAccessToken: *token, Scopes: scopes}
}

func writeAccessTokenError(c contract.Context, status int, message string) {
	_ = c.JSON(status, common.H{"success": false, "message": message})
}

// requireAccessTokenSession resolves the browser session identity plus the
// cached user base (role, id) the token handlers need.
func requireAccessTokenSession(c contract.Context) (AuthIdentity, *UserBase, bool) {
	authID, ok := requireBrowserSession(c)
	if !ok {
		return AuthIdentity{}, nil, false
	}
	user, err := GetUserCache(authID.UserID)
	if err != nil || user == nil {
		writeAccessTokenError(c, http.StatusUnauthorized, "登录会话无效，请刷新页面后重试")
		return AuthIdentity{}, nil, false
	}
	return authID, user, true
}

// normalizeAccessTokenName returns the trimmed name, or false when it is empty
// or longer than the 64-character column.
func normalizeAccessTokenName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	count := utf8.RuneCountInString(name)
	return name, count > 0 && count <= 64
}

func ListAccessTokens(c contract.Context) {
	_, base, ok := requireAccessTokenSession(c)
	if !ok {
		return
	}
	tokens, err := ListUserAccessTokens(base.Id)
	if err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	items := make([]accessTokenItem, 0, len(tokens))
	for i := range tokens {
		items = append(items, newAccessTokenItem(&tokens[i]))
	}
	// Legacy single-token hint, so an existing credential is visible and
	// revocable from the same page.
	legacy := map[string]any{}
	var holder User
	if err := dbx.DB.Select("access_token").First(&holder, base.Id).Error; err == nil && holder.AccessToken != nil && *holder.AccessToken != "" {
		legacy["token_hint"] = AccessTokenHint(*holder.AccessToken)
		legacy["created"] = true
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"data":    map[string]any{"items": items, "legacy": legacy},
	})
}

func GetAccessTokenCatalog(c contract.Context) {
	if _, ok := requireBrowserSession(c); !ok {
		return
	}
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"data": map[string]any{
			"groups":              AccessTokenScopeCatalog(),
			"max_tokens":          AccessTokenMaxPerUser,
			"default_expiry_days": AccessTokenDefaultExpiryDays,
		},
	})
}

// CreateAccessToken validates the whole request before consuming the proof, so
// a rejected grant never burns the user's verification.
func CreateAccessToken(c contract.Context) {
	_, base, ok := requireAccessTokenSession(c)
	if !ok {
		return
	}
	var req accessTokenCreateRequest
	if err := c.BindJSON(&req); err != nil {
		writeAccessTokenError(c, http.StatusBadRequest, "无效的请求体")
		return
	}
	name, valid := normalizeAccessTokenName(req.Name)
	if !valid {
		writeAccessTokenError(c, http.StatusBadRequest, "访问令牌名称必须为 1 到 64 个字符")
		return
	}
	now := common.GetTimestamp()
	if req.ExpiresAt != 0 && req.ExpiresAt < now+accessTokenMinLifetimeSecs {
		writeAccessTokenError(c, http.StatusBadRequest, "有效期必须至少为 1 小时之后")
		return
	}
	scopes, err := NormalizeAccessTokenScopes(base.Role, req.Scopes)
	switch {
	case errors.Is(err, ErrAccessTokenScopeForbidden):
		writeAccessTokenError(c, http.StatusBadRequest, "你无权授予其中一个或多个权限")
		return
	case err != nil:
		writeAccessTokenError(c, http.StatusBadRequest, "请至少选择一个有效权限")
		return
	}
	if !RequireSecurityProof(c, SecurityProofScopeAccessTokenGenerate, []string{"2fa", "passkey"}) {
		return
	}
	suffix, err := common.GenerateRandomCharsKey(43)
	if err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	raw := AccessTokenPrefix + suffix
	token := &UserAccessToken{
		Name:      name,
		TokenHash: AccessTokenFingerprint(raw),
		TokenHint: AccessTokenHint(raw),
		ExpiresAt: req.ExpiresAt,
		CreatedAt: now,
	}
	if err := token.SetScopes(scopes); err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := CreateUserAccessToken(base.Id, token, AccessTokenMaxPerUser); err != nil {
		if errors.Is(err, ErrAccessTokenLimit) {
			writeAccessTokenError(c, http.StatusBadRequest, "最多只能创建 "+strconv.Itoa(AccessTokenMaxPerUser)+" 个访问令牌")
			return
		}
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	common.SysLog("access token generated: user_id=" + strconv.Itoa(base.Id) + " token_ref=" + token.TokenHash)
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"data":    map[string]any{"token": raw, "item": newAccessTokenItem(token)},
	})
}

// UpdateAccessToken renames a token without verification. Changing the grant
// is checked in full before the proof is consumed, like creation.
func UpdateAccessToken(c contract.Context) {
	_, base, ok := requireAccessTokenSession(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		writeAccessTokenError(c, http.StatusNotFound, ErrAccessTokenNotFound.Error())
		return
	}
	var req accessTokenUpdateRequest
	if err := c.BindJSON(&req); err != nil {
		writeAccessTokenError(c, http.StatusBadRequest, "无效的请求体")
		return
	}
	name, valid := normalizeAccessTokenName(req.Name)
	if !valid {
		writeAccessTokenError(c, http.StatusBadRequest, "访问令牌名称必须为 1 到 64 个字符")
		return
	}
	var scopes []string
	if req.Scopes != nil {
		if _, err := GetUserAccessToken(base.Id, id); errors.Is(err, ErrAccessTokenNotFound) {
			writeAccessTokenError(c, http.StatusNotFound, ErrAccessTokenNotFound.Error())
			return
		} else if err != nil {
			writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
			return
		}
		scopes, err = NormalizeAccessTokenScopes(base.Role, req.Scopes)
		switch {
		case errors.Is(err, ErrAccessTokenScopeForbidden):
			writeAccessTokenError(c, http.StatusBadRequest, "你无权授予其中一个或多个权限")
			return
		case err != nil:
			writeAccessTokenError(c, http.StatusBadRequest, "请至少选择一个有效权限")
			return
		}
		if !RequireSecurityProof(c, SecurityProofScopeAccessTokenUpdate, []string{"2fa", "passkey"}) {
			return
		}
	}
	token, err := UpdateUserAccessTokenRecord(base.Id, id, name, scopes)
	if errors.Is(err, ErrAccessTokenNotFound) {
		writeAccessTokenError(c, http.StatusNotFound, ErrAccessTokenNotFound.Error())
		return
	}
	if err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	_ = c.JSON(http.StatusOK, common.H{"success": true, "data": newAccessTokenItem(token)})
}

// DeleteAccessToken checks ownership before consuming the proof, so probing
// other users' token IDs never burns a verification.
func DeleteAccessToken(c contract.Context) {
	_, base, ok := requireAccessTokenSession(c)
	if !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		writeAccessTokenError(c, http.StatusNotFound, ErrAccessTokenNotFound.Error())
		return
	}
	if _, err := GetUserAccessToken(base.Id, id); err != nil {
		if errors.Is(err, ErrAccessTokenNotFound) {
			writeAccessTokenError(c, http.StatusNotFound, ErrAccessTokenNotFound.Error())
			return
		}
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !RequireSecurityProof(c, SecurityProofScopeAccessTokenRevoke, []string{"2fa", "passkey"}) {
		return
	}
	if _, err := DeleteUserAccessToken(base.Id, id); err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	common.SysLog("access token revoked: user_id=" + strconv.Itoa(base.Id))
	_ = c.JSON(http.StatusOK, common.H{"success": true})
}

// RevokeLegacyAccessToken clears the unscoped users.access_token column.
func RevokeLegacyAccessToken(c contract.Context) {
	_, base, ok := requireAccessTokenSession(c)
	if !ok {
		return
	}
	if !RequireSecurityProof(c, SecurityProofScopeAccessTokenRevoke, []string{"2fa", "passkey"}) {
		return
	}
	if err := UpdateUserAccessToken(base.Id, ""); err != nil {
		writeAccessTokenError(c, http.StatusInternalServerError, err.Error())
		return
	}
	common.SysLog("legacy access token revoked: user_id=" + strconv.Itoa(base.Id))
	_ = c.JSON(http.StatusOK, common.H{"success": true})
}
