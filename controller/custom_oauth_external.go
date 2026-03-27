package controller

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func completeCustomOAuthIdentityLogin(
	c *gin.Context,
	providerConfig *model.CustomOAuthProvider,
	provider oauth.Provider,
	session sessions.Session,
	oauthUser *oauth.OAuthUser,
	group string,
	role int,
	audit *customOAuthJWTAuditInfo,
) (*customOAuthJWTLoginResult, *customOAuthJWTAuditInfo, error) {
	if oauthUser == nil {
		if audit != nil {
			audit.FailureReason = "missing_external_identity"
		}
		return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthJWTMissing, nil)
	}
	if audit != nil {
		audit.ExternalID = redactOAuthAuditID(oauthUser.ProviderUserID)
		audit.GroupResult = safeOAuthAuditValue(group)
		audit.RoleResult = oauthRoleLabel(role)
	}

	if session.Get("username") != nil {
		if audit != nil {
			if sessionUserID, ok := session.Get("id").(int); ok {
				audit.TargetUserID = sessionUserID
			}
		}
		currentUser, currentUserErr := getSessionUser(c)
		if currentUserErr != nil {
			if audit != nil {
				if errors.Is(currentUserErr, errSessionUserDisabled) {
					audit.FailureReason = "user_disabled"
				} else {
					audit.FailureReason = oauthAuditFailureReason(currentUserErr)
				}
			}
			if errors.Is(currentUserErr, errSessionUserDisabled) {
				return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthUserBanned, nil)
			}
			return nil, audit, currentUserErr
		}
		if currentUser.Status != common.UserStatusEnabled {
			if audit != nil {
				audit.FailureReason = "user_disabled"
			}
			return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthUserBanned, nil)
		}
		if err := bindOAuthIdentityToCurrentUser(c, provider, oauthUser); err != nil {
			if audit != nil && audit.FailureReason == "" {
				audit.FailureReason = oauthAuditFailureReason(err)
			}
			return nil, audit, err
		}
		if audit != nil {
			audit.Action = "bind"
		}
		return &customOAuthJWTLoginResult{Action: "bind"}, audit, nil
	}

	resolvedUser, err := findOrCreateOAuthUserWithOptions(c, provider, oauthUser, session, oauthFindOrCreateOptions{
		AllowAutoRegister:     providerConfig.AutoRegister,
		AllowAutoMergeByEmail: providerConfig.AutoMergeByEmail,
		InitialRole:           role,
		InitialGroup:          group,
	})
	if err != nil {
		if audit != nil && audit.FailureReason == "" {
			audit.FailureReason = oauthAuditFailureReason(err)
		}
		return nil, audit, err
	}

	if resolvedUser.User.Status == common.UserStatusEnabled {
		if err := syncOAuthUserLoginAttributes(
			resolvedUser.User,
			oauthUser,
			oauthUserSyncOptions{
				ProviderName:           providerConfig.Name,
				SyncUsernameOnLogin:    providerConfig.SyncUsernameOnLogin,
				SyncDisplayNameOnLogin: providerConfig.SyncDisplayNameOnLogin,
				SyncEmailOnLogin:       providerConfig.SyncEmailOnLogin,
				SyncGroupOnLogin:       providerConfig.SyncGroupOnLogin,
				SyncRoleOnLogin:        providerConfig.SyncRoleOnLogin,
				NextGroup:              group,
				NextRole:               role,
			},
		); err != nil {
			if audit != nil && audit.FailureReason == "" {
				audit.FailureReason = oauthAuditFailureReason(err)
			}
			return nil, audit, err
		}
	}

	result := &customOAuthJWTLoginResult{
		Action:                "login",
		User:                  resolvedUser.User,
		BindAfterStatusCheck:  resolvedUser.BindAfterStatusCheck,
		ProviderUserID:        oauthUser.ProviderUserID,
		AutoRegisterTriggered: resolvedUser.AutoRegisterTriggered,
		EmailMergeTriggered:   resolvedUser.EmailMergeTriggered,
		GroupResult:           group,
		RoleResult:            role,
	}
	if audit != nil {
		audit.Action = result.Action
		audit.TargetUserID = result.User.Id
		audit.AutoRegisterTriggered = result.AutoRegisterTriggered
		audit.EmailMergeTriggered = result.EmailMergeTriggered
	}
	return result, audit, nil
}

func finalizeCustomOAuthIdentityLogin(c *gin.Context, provider oauth.Provider, result *customOAuthJWTLoginResult, audit *customOAuthJWTAuditInfo) {
	if result.Action == "bind" {
		recordCustomOAuthJWTAudit(audit)
		common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
			"action": "bind",
		})
		return
	}

	if result.User.Status != common.UserStatusEnabled {
		audit.FailureReason = "user_disabled"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	if result.BindAfterStatusCheck {
		if err := bindOAuthIdentityToUser(result.User, provider, result.ProviderUserID); err != nil {
			audit.FailureReason = oauthAuditFailureReason(err)
			recordCustomOAuthJWTAudit(audit)
			handleCustomOAuthJWTLoginError(c, err)
			return
		}
	}

	if !setupLoginWithResult(result.User, c) {
		if !c.Writer.Written() {
			common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
		}
		audit.FailureReason = "session_save_failed"
		recordCustomOAuthJWTAudit(audit)
		return
	}
	recordCustomOAuthJWTAudit(audit)
}

func oauthAuditFailureReason(err error) string {
	if err == nil {
		return ""
	}

	switch e := err.(type) {
	case *oauth.OAuthError:
		return "oauth_error:" + safeOAuthAuditValue(e.MsgKey)
	case *oauth.AccessDeniedError:
		return "access_denied"
	case *oauth.TrustLevelError:
		return "trust_level_denied"
	case *OAuthAlreadyBoundError:
		return "oauth_already_bound"
	case *OAuthUserDeletedError:
		return "oauth_user_deleted"
	case *OAuthRegistrationDisabledError, *OAuthAutoRegisterDisabledError:
		return "registration_disabled"
	default:
		return "internal_error"
	}
}

func newCustomOAuthJWTAuditInfo(providerConfig *model.CustomOAuthProvider) *customOAuthJWTAuditInfo {
	if providerConfig == nil {
		return &customOAuthJWTAuditInfo{}
	}
	return &customOAuthJWTAuditInfo{
		ProviderSlug: providerConfig.Slug,
		ProviderKind: providerConfig.GetKind(),
	}
}

func recordCustomOAuthJWTAudit(audit *customOAuthJWTAuditInfo) {
	if audit == nil {
		return
	}

	content := fmt.Sprintf(
		"企业认证审计 provider_slug=%s provider_kind=%s action=%s external_id=%s target_user_id=%d auto_register=%t email_merge=%t group_result=%s role_result=%s failure_reason=%s",
		safeOAuthAuditValue(audit.ProviderSlug),
		safeOAuthAuditValue(audit.ProviderKind),
		safeOAuthAuditValue(audit.Action),
		safeOAuthAuditValue(audit.ExternalID),
		audit.TargetUserID,
		audit.AutoRegisterTriggered,
		audit.EmailMergeTriggered,
		safeOAuthAuditValue(audit.GroupResult),
		safeOAuthAuditValue(audit.RoleResult),
		safeOAuthAuditValue(audit.FailureReason),
	)
	common.SysLog("[EnterpriseAuth] " + content)
	if audit.TargetUserID > 0 {
		model.RecordLog(audit.TargetUserID, model.LogTypeSystem, content)
	}
}

func redactOAuthAuditID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return "hmac_sha256:" + common.GenerateHMAC(value)
}
