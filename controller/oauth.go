package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// providerParams returns map with Provider key for i18n templates
func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	session := sessions.Default(c)
	state := common.GetRandomString(12)
	affCode := c.Query("aff")
	if affCode != "" {
		session.Set("aff", affCode)
	}
	session.Set("oauth_state", state)
	err := session.Save()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    state,
	})
}

// HandleOAuth handles OAuth callback for all standard OAuth providers
func HandleOAuth(c *gin.Context) {
	providerName := c.Param("provider")
	provider := oauth.GetProvider(providerName)
	if provider == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthUnknownProvider),
		})
		return
	}

	session := sessions.Default(c)

	// 1. Validate state (CSRF protection)
	state := c.Query("state")
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
		})
		return
	}

	// 2. Check if user is already logged in (bind flow)
	username := session.Get("username")
	if username != nil {
		handleOAuthBind(c, provider)
		return
	}

	// 3. Check if provider is enabled
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// 4. Handle error from provider
	errorCode := c.Query("error")
	if errorCode != "" {
		errorDescription := c.Query("error_description")
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}

	// 5. Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// 6. Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// 7. Find or create user
	user, err := findOrCreateOAuthUser(c, provider, oauthUser, session)
	if err != nil {
		switch err.(type) {
		case *OAuthUserDeletedError:
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
		case *OAuthRegistrationDisabledError:
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		default:
			common.ApiError(c, err)
		}
		return
	}

	// 8. Check user status
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	// 9. Setup login
	setupLogin(user, c)
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, provider oauth.Provider) {
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Check if this OAuth account is already bound (check both new ID and legacy ID)
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
		return
	}
	// Also check legacy ID to prevent duplicate bindings during migration period
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
	}

	// Get current user from session
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Handle binding based on provider type
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		err = model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// Built-in provider: update user record directly
		provider.SetProviderUserID(&user, oauthUser.ProviderUserID)
		err = user.Update(false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
		"action": "bind",
	})
}

// findOrCreateOAuthUser finds existing user or creates new user
func canUseOAuthUsername(username string) bool {
	name := strings.TrimSpace(username)
	if name == "" {
		return false
	}
	return utf8.RuneCountInString(name) <= model.UserNameMaxLength
}

func buildFeishuOAuthUsername(oauthUser *oauth.OAuthUser) string {
	if oauthUser == nil {
		return ""
	}
	baseName := strings.TrimSpace(oauthUser.DisplayName)
	if baseName == "" {
		baseName = strings.TrimSpace(oauthUser.Username)
	}
	if baseName == "" {
		return ""
	}
	employeeNo := ""
	if userIDRaw, ok := oauthUser.Extra["user_id"].(string); ok {
		employeeNo = strings.TrimSpace(userIDRaw)
	}
	candidate := baseName
	if employeeNo != "" {
		candidate = candidate + "_" + employeeNo
	}
	if canUseOAuthUsername(candidate) {
		return candidate
	}
	if canUseOAuthUsername(baseName) {
		return baseName
	}
	return ""
}

func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, session sessions.Session) (*model.User, error) {
	user := &model.User{}

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, &OAuthUserDeletedError{}
		}

		if provider.GetName() == "Feishu" {
			updates := map[string]interface{}{}
			feishuPreferredUsername := buildFeishuOAuthUsername(oauthUser)
			if feishuPreferredUsername != "" && user.Username != feishuPreferredUsername {
				if exists, checkErr := model.CheckUserExistOrDeleted(feishuPreferredUsername, ""); checkErr == nil && !exists {
					updates["username"] = feishuPreferredUsername
				}
			}
			if oauthUser.DisplayName != "" && user.DisplayName != oauthUser.DisplayName {
				updates["display_name"] = oauthUser.DisplayName
			}
			if userIdRaw, ok := oauthUser.Extra["user_id"].(string); ok {
				userIdRaw = strings.TrimSpace(userIdRaw)
				if userIdRaw != "" && user.FeishuUserId != userIdRaw {
					updates["feishu_user_id"] = userIdRaw
				}
			}
			if unionIDRaw, ok := oauthUser.Extra["union_id"].(string); ok {
				unionIDRaw = strings.TrimSpace(unionIDRaw)
				if unionIDRaw != "" && user.FeishuUnionId != unionIDRaw {
					updates["feishu_union_id"] = unionIDRaw
				}
			}
			if len(updates) > 0 {
				if err := model.DB.Model(user).Updates(updates).Error; err != nil {
					common.SysError(fmt.Sprintf("[OAuth-Feishu] Failed to sync profile for user %d: %s", user.Id, err.Error()))
				} else {
					if un, ok := updates["username"]; ok {
						user.Username = un.(string)
					}
					if dn, ok := updates["display_name"]; ok {
						user.DisplayName = dn.(string)
					}
					if fuid, ok := updates["feishu_user_id"]; ok {
						user.FeishuUserId = fuid.(string)
					}
					if funion, ok := updates["feishu_union_id"]; ok {
						user.FeishuUnionId = funion.(string)
					}
				}
			}
		}

		return user, nil
	}

	// Try to find user with Feishu union_id and user_id as secondary binding keys.
	if provider.GetName() == "Feishu" {
		if unionIDRaw, ok := oauthUser.Extra["union_id"].(string); ok {
			unionIDRaw = strings.TrimSpace(unionIDRaw)
			if unionIDRaw != "" {
				userByUnionID := &model.User{FeishuUnionId: unionIDRaw}
				if err := userByUnionID.FillUserByFeishuUnionId(); err == nil && userByUnionID.Id > 0 {
					updates := map[string]any{}
					if userByUnionID.FeishuId != oauthUser.ProviderUserID {
						updates["feishu_id"] = oauthUser.ProviderUserID
					}
					if userByUnionID.FeishuUnionId != unionIDRaw {
						updates["feishu_union_id"] = unionIDRaw
					}
					if oauthUser.DisplayName != "" && userByUnionID.DisplayName != oauthUser.DisplayName {
						updates["display_name"] = oauthUser.DisplayName
					}
					if oauthUser.Username != "" && userByUnionID.Username != oauthUser.Username {
						if exists, checkErr := model.CheckUserExistOrDeleted(oauthUser.Username, ""); checkErr == nil && !exists && canUseOAuthUsername(oauthUser.Username) {
							updates["username"] = oauthUser.Username
						}
					}
					if userIDRaw, ok := oauthUser.Extra["user_id"].(string); ok && strings.TrimSpace(userIDRaw) != "" && userByUnionID.FeishuUserId != strings.TrimSpace(userIDRaw) {
						updates["feishu_user_id"] = strings.TrimSpace(userIDRaw)
					}
					if len(updates) > 0 {
						_ = model.DB.Model(userByUnionID).Updates(updates).Error
						if v, ok := updates["feishu_id"]; ok {
							userByUnionID.FeishuId = v.(string)
						}
						if v, ok := updates["feishu_union_id"]; ok {
							userByUnionID.FeishuUnionId = v.(string)
						}
						if v, ok := updates["feishu_user_id"]; ok {
							userByUnionID.FeishuUserId = v.(string)
						}
						if v, ok := updates["display_name"]; ok {
							userByUnionID.DisplayName = v.(string)
						}
						if v, ok := updates["username"]; ok {
							userByUnionID.Username = v.(string)
						}
					}
					return userByUnionID, nil
				}
			}
		}
		if userIDRaw, ok := oauthUser.Extra["user_id"].(string); ok {
			userIDRaw = strings.TrimSpace(userIDRaw)
			if userIDRaw != "" {
				userByFeishuUserID := &model.User{FeishuUserId: userIDRaw}
				if err := userByFeishuUserID.FillUserByFeishuUserId(); err == nil && userByFeishuUserID.Id > 0 {
					updates := map[string]any{}
					if userByFeishuUserID.FeishuId != oauthUser.ProviderUserID {
						updates["feishu_id"] = oauthUser.ProviderUserID
					}
					if unionIDRaw, ok := oauthUser.Extra["union_id"].(string); ok && strings.TrimSpace(unionIDRaw) != "" && userByFeishuUserID.FeishuUnionId != strings.TrimSpace(unionIDRaw) {
						updates["feishu_union_id"] = strings.TrimSpace(unionIDRaw)
					}
					if oauthUser.DisplayName != "" && userByFeishuUserID.DisplayName != oauthUser.DisplayName {
						updates["display_name"] = oauthUser.DisplayName
					}
					if oauthUser.Username != "" && userByFeishuUserID.Username != oauthUser.Username {
						if exists, checkErr := model.CheckUserExistOrDeleted(oauthUser.Username, ""); checkErr == nil && !exists && canUseOAuthUsername(oauthUser.Username) {
							updates["username"] = oauthUser.Username
						}
					}
					if len(updates) > 0 {
						_ = model.DB.Model(userByFeishuUserID).Updates(updates).Error
						if v, ok := updates["feishu_id"]; ok {
							userByFeishuUserID.FeishuId = v.(string)
						}
						if v, ok := updates["feishu_union_id"]; ok {
							userByFeishuUserID.FeishuUnionId = v.(string)
						}
						if v, ok := updates["display_name"]; ok {
							userByFeishuUserID.DisplayName = v.(string)
						}
						if v, ok := updates["username"]; ok {
							userByFeishuUserID.Username = v.(string)
						}
					}
					return userByFeishuUserID, nil
				}
			}
		}
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			err := provider.FillUserByProviderID(user, legacyID)
			if err != nil {
				return nil, err
			}
			if user.Id != 0 {
				// Found user with legacy ID, migrate to new ID
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					user.Id, legacyID, oauthUser.ProviderUserID))
				if provider.GetName() == "Feishu" {
					if err := user.UpdateFeishuId(oauthUser.ProviderUserID); err != nil {
						common.SysError(fmt.Sprintf("[OAuth-Feishu] Failed to migrate user %d: %s", user.Id, err.Error()))
					} else {
						user.FeishuId = oauthUser.ProviderUserID
					}
					if oauthUser.DisplayName != "" {
						_ = model.DB.Model(user).Update("display_name", oauthUser.DisplayName)
						user.DisplayName = oauthUser.DisplayName
					}
				} else {
					if err := user.UpdateGitHubId(oauthUser.ProviderUserID); err != nil {
						common.SysError(fmt.Sprintf("[OAuth] Failed to migrate user %d: %s", user.Id, err.Error()))
					}
				}
				return user, nil
			}
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled && provider.GetName() != "Feishu" {
		return nil, &OAuthRegistrationDisabledError{}
	}

	// Set up new user
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)

	if provider.GetName() == "Feishu" {
		feishuPreferredUsername := buildFeishuOAuthUsername(oauthUser)
		if feishuPreferredUsername != "" {
			if exists, err := model.CheckUserExistOrDeleted(feishuPreferredUsername, ""); err == nil && !exists {
				user.Username = feishuPreferredUsername
			}
		}
	} else if oauthUser.Username != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUser.Username, ""); err == nil && !exists {
			if canUseOAuthUsername(oauthUser.Username) {
				user.Username = oauthUser.Username
			}
		}
	}

	if oauthUser.DisplayName != "" {
		user.DisplayName = oauthUser.DisplayName
	} else if oauthUser.Username != "" {
		user.DisplayName = oauthUser.Username
	} else {
		user.DisplayName = provider.GetName() + " User"
	}
	if oauthUser.Email != "" {
		user.Email = oauthUser.Email
	}
	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	if provider.GetName() == "Feishu" {
		user.Group = oauth.GetFeishuDefaultGroup()
	}

	// Handle affiliate code
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	if provider.GetName() == "Feishu" {
		inviterId = 0
	}

	// Use transaction to ensure user creation and OAuth binding are atomic
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: create user and binding in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Create OAuth binding
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			if err := model.CreateUserOAuthBindingWithTx(tx, binding); err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, err
		}

		// Perform post-transaction tasks (logs, sidebar config, inviter rewards)
		user.FinalizeOAuthUserCreation(inviterId)
	} else {
		// Built-in provider: create user and update provider ID in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Set the provider user ID on the user model and update
			provider.SetProviderUserID(user, oauthUser.ProviderUserID)
			updates := map[string]interface{}{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
				"feishu_id":   user.FeishuId,
			}
			if provider.GetName() == "Feishu" {
				if userIdRaw, ok := oauthUser.Extra["user_id"].(string); ok && strings.TrimSpace(userIdRaw) != "" {
					updates["feishu_user_id"] = strings.TrimSpace(userIdRaw)
				}
				if unionIDRaw, ok := oauthUser.Extra["union_id"].(string); ok && strings.TrimSpace(unionIDRaw) != "" {
					updates["feishu_union_id"] = strings.TrimSpace(unionIDRaw)
				}
				updates["quota"] = 0
				updates["group"] = user.Group
			}
			if err := tx.Model(user).Updates(updates).Error; err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, err
		}

		// Perform post-transaction tasks
		user.FinalizeOAuthUserCreation(inviterId)

		if provider.GetName() == "Feishu" {
			model.RecordLog(user.Id, model.LogTypeSystem,
				fmt.Sprintf("飞书OAuth创建用户，分组=%s，额度=0", oauth.GetFeishuDefaultGroup()))
			// 创建后尝试按岗位自动分组（拉飞书 job_title -> 决策 -> 应用）
			if user.FeishuId != "" {
				user.Group = service.TryAutoGroupOnUserCreate(user.Id, user.Group, user.FeishuId)
			}
		}
	}

	return user, nil
}

// Error types for OAuth
type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}

// handleOAuthError handles OAuth errors and returns translated message
func handleOAuthError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *oauth.OAuthError:
		if e.Params != nil {
			common.ApiErrorI18n(c, e.MsgKey, e.Params)
		} else {
			common.ApiErrorI18n(c, e.MsgKey)
		}
	case *oauth.AccessDeniedError:
		common.ApiErrorMsg(c, e.Message)
	case *oauth.TrustLevelError:
		common.ApiErrorI18n(c, i18n.MsgOAuthTrustLevelLow)
	default:
		common.ApiError(c, err)
	}
}
