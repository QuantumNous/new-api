package middleware

import (
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func skillAuthHelper(c *gin.Context, minRole int) {
	session := sessions.Default(c)
	username := session.Get("username")
	role := session.Get("role")
	id := session.Get("id")
	status := session.Get("status")
	useAccessToken := false
	if username == nil {
		accessToken := c.Request.Header.Get("Authorization")
		if accessToken == "" {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn), nil, errcodes.ErrAuthRequired)
			return
		}
		user, authErr := model.ValidateAccessToken(accessToken)
		if authErr != nil {
			if errors.Is(authErr, model.ErrDatabase) {
				common.SysLog("ValidateAccessToken database error: " + authErr.Error())
				skillapi.Error(c, errcodes.ErrSkillInternalError, common.TranslateMessage(c, i18n.MsgDatabaseError), nil)
			}
			c.Abort()
			return
		}
		if user == nil || user.Username == "" {
			if skillAPITokenAuth(c, minRole) {
				return
			}
			if c.IsAborted() {
				return
			}
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid), nil, errcodes.ErrAuthRequired)
			return
		}
		if !validUserInfo(user.Username, user.Role) {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid), nil, errcodes.ErrAuthRequired)
			return
		}
		username = user.Username
		role = user.Role
		id = user.Id
		status = user.Status
		useAccessToken = true
	}

	apiUserIdStr := c.Request.Header.Get("New-Api-User")
	if apiUserIdStr == "" {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdNotProvided), nil, errcodes.ErrAuthRequired)
		return
	}
	apiUserId, err := strconv.Atoi(apiUserIdStr)
	if err != nil {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdFormatError), nil, errcodes.ErrAuthRequired)
		return
	}
	if id != apiUserId {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdMismatch), nil, errcodes.ErrAuthRequired)
		return
	}
	userStatus, ok := status.(int)
	if !ok || userStatus == common.UserStatusDisabled {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserBanned), nil, errcodes.ErrAuthRequired)
		return
	}
	userRole, ok := role.(int)
	if !ok || userRole < minRole {
		// Authenticated but insufficient role → 403, not 401 (tasks/05 §4.1).
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege), nil, errcodes.ErrForbidden)
		return
	}
	userName, ok := username.(string)
	if !ok || !validUserInfo(userName, userRole) {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid), nil, errcodes.ErrAuthRequired)
		return
	}

	// For session-based auth, group is carried by the session directly.
	// For access-token auth, the session is empty; load group from user cache/DB
	// so that plan-entitlement checks (e.g., skill download) use the correct tier.
	var group interface{}
	if useAccessToken {
		if g, err := model.GetUserGroup(apiUserId, false); err == nil {
			group = g
		}
	} else {
		group = session.Get("group")
	}

	c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", username)
	c.Set("role", role)
	c.Set("id", id)
	c.Set("group", group)
	c.Set("user_group", group)
	c.Set("use_access_token", useAccessToken)
	c.Next()
}

func skillAPITokenAuth(c *gin.Context, minRole int) bool {
	key, parts, ok := skillBearerTokenKey(c.Request.Header.Get("Authorization"))
	if !ok {
		return false
	}
	token, err := validateSkillDownloadToken(key)
	if err != nil {
		if errors.Is(err, model.ErrDatabase) {
			common.SysLog("SkillUserAuth ValidateUserToken database error: " + err.Error())
			skillapi.Error(c, errcodes.ErrSkillInternalError, common.TranslateMessage(c, i18n.MsgDatabaseError), nil)
			c.Abort()
			return false
		}
		return false
	}

	user, err := model.GetUserById(token.UserId, false)
	if err != nil {
		common.SysLog(fmt.Sprintf("SkillUserAuth GetUserById error for user %d: %v", token.UserId, err))
		skillapi.Error(c, errcodes.ErrSkillInternalError, common.TranslateMessage(c, i18n.MsgDatabaseError), nil)
		c.Abort()
		return false
	}
	if user.Status != common.UserStatusEnabled {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserBanned), nil, errcodes.ErrAuthRequired)
		return false
	}
	if user.Role < minRole {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege), nil, errcodes.ErrForbidden)
		return false
	}
	if !validUserInfo(user.Username, user.Role) {
		abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid), nil, errcodes.ErrAuthRequired)
		return false
	}
	if !skillTokenIPAllowed(c, token) {
		return false
	}

	userGroup := user.Group
	if token.Group != "" {
		if _, ok := service.GetUserUsableGroups(userGroup)[token.Group]; !ok {
			abortSkillAuth(c, fmt.Sprintf("无权访问 %s 分组", token.Group), nil, errcodes.ErrForbidden)
			return false
		}
		if !ratio_setting.ContainsGroupRatio(token.Group) && token.Group != "auto" {
			abortSkillAuth(c, fmt.Sprintf("分组 %s 已被弃用", token.Group), nil, errcodes.ErrForbidden)
			return false
		}
		userGroup = token.Group
	}

	c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set("id", token.UserId)
	c.Set("group", userGroup)
	c.Set("user_group", userGroup)
	c.Set("use_access_token", false)
	common.SetContextKey(c, constant.ContextKeySkillAuthEntryPoint, string(enums.EntryPointAPIToken))
	common.SetContextKey(c, constant.ContextKeyUsingGroup, userGroup)
	if err := SetupContextForToken(c, token, parts...); err != nil {
		return false
	}
	c.Next()
	return true
}

func validateSkillDownloadToken(key string) (*model.Token, error) {
	if key == "" {
		return nil, model.ErrTokenNotProvided
	}
	var token model.Token
	if err := model.DB.Where(&model.Token{Key: key}).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, model.ErrTokenInvalid
		}
		return nil, fmt.Errorf("%w: %v", model.ErrDatabase, err)
	}
	if token.Status == common.TokenStatusExhausted ||
		token.Status == common.TokenStatusExpired ||
		token.Status != common.TokenStatusEnabled {
		return &token, model.ErrTokenInvalid
	}
	if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
		return &token, model.ErrTokenInvalid
	}
	if !token.UnlimitedQuota && token.RemainQuota <= 0 {
		return &token, model.ErrTokenInvalid
	}
	return &token, nil
}

func skillBearerTokenKey(raw string) (string, []string, bool) {
	key := strings.TrimSpace(raw)
	if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
		key = strings.TrimSpace(key[7:])
	}
	if !strings.HasPrefix(key, "sk-") {
		return "", nil, false
	}
	key = strings.TrimPrefix(key, "sk-")
	parts := strings.Split(key, "-")
	if len(parts) == 0 {
		return "", nil, false
	}
	return parts[0], parts, true
}

func skillTokenIPAllowed(c *gin.Context, token *model.Token) bool {
	allowIPs := token.GetIpLimits()
	if len(allowIPs) == 0 {
		return true
	}
	ip := net.ParseIP(c.ClientIP())
	if ip == nil {
		skillapi.Error(c, errcodes.ErrForbidden, "无法解析客户端 IP 地址", nil)
		c.Abort()
		return false
	}
	if !common.IsIpInCIDRList(ip, allowIPs) {
		skillapi.Error(c, errcodes.ErrForbidden, "您的 IP 不在令牌允许访问的列表中", nil)
		c.Abort()
		return false
	}
	return true
}

func abortSkillAuth(c *gin.Context, message string, detail any, code errcodes.ErrorCode) {
	skillapi.Error(c, code, message, detail)
	c.Abort()
}

func SkillUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		skillAuthHelper(c, common.RoleCommonUser)
	}
}

// TrySkillUserAuth preserves anonymous access while enriching the request
// context when a valid browser session or platform access token is present.
//
// No credentials: continue anonymous.
// Session credentials: copy the session id/group when available.
// Authorization credentials: validate the access token plus New-Api-User header
// using the same identity semantics as SkillUserAuth.
func TrySkillUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		if id := session.Get("id"); id != nil {
			c.Set("id", id)
			if group := session.Get("group"); group != nil {
				c.Set("group", group)
				c.Set("user_group", group)
			}
			c.Next()
			return
		}

		accessToken := c.Request.Header.Get("Authorization")
		if accessToken == "" {
			c.Next()
			return
		}

		user, authErr := model.ValidateAccessToken(accessToken)
		if authErr != nil {
			if errors.Is(authErr, model.ErrDatabase) {
				common.SysLog("ValidateAccessToken database error: " + authErr.Error())
				skillapi.Error(c, errcodes.ErrSkillInternalError, common.TranslateMessage(c, i18n.MsgDatabaseError), nil)
			} else {
				abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid), nil, errcodes.ErrAuthRequired)
			}
			c.Abort()
			return
		}
		if user == nil || user.Username == "" || !validUserInfo(user.Username, user.Role) {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid), nil, errcodes.ErrAuthRequired)
			return
		}

		apiUserIdStr := c.Request.Header.Get("New-Api-User")
		if apiUserIdStr == "" {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdNotProvided), nil, errcodes.ErrAuthRequired)
			return
		}
		apiUserId, err := strconv.Atoi(apiUserIdStr)
		if err != nil {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdFormatError), nil, errcodes.ErrAuthRequired)
			return
		}
		if user.Id != apiUserId {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserIdMismatch), nil, errcodes.ErrAuthRequired)
			return
		}
		if user.Status == common.UserStatusDisabled {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthUserBanned), nil, errcodes.ErrAuthRequired)
			return
		}
		if user.Role < common.RoleCommonUser {
			abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege), nil, errcodes.ErrForbidden)
			return
		}

		group := user.Group
		if group == "" {
			if g, err := model.GetUserGroup(apiUserId, false); err == nil {
				group = g
			}
		}

		c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
		c.Set("username", user.Username)
		c.Set("role", user.Role)
		c.Set("id", user.Id)
		c.Set("group", group)
		c.Set("user_group", group)
		c.Set("use_access_token", true)
		c.Next()
	}
}

func SkillAdminAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		skillAuthHelper(c, common.RoleAdminUser)
	}
}

func SkillRootAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		skillAuthHelper(c, common.RoleRootUser)
	}
}
