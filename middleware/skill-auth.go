package middleware

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
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
			} else {
				abortSkillAuth(c, common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid), nil, errcodes.ErrAuthRequired)
			}
			c.Abort()
			return
		}
		if user == nil || user.Username == "" {
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
