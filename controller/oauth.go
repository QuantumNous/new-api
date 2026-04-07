package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
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
	options := oauthFindOrCreateOptions{
		AllowAutoRegister:     true,
		AllowAutoMergeByEmail: false,
		InitialRole:           common.RoleCommonUser,
	}
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		if config := genericProvider.GetConfig(); config != nil {
			options.AllowAutoMergeByEmail = config.AutoMergeByEmail
		}
	}
	resolvedUser, err := findOrCreateOAuthUserWithOptions(c, provider, oauthUser, session, options)
	if err != nil {
		handleOAuthUserError(c, err)
		return
	}

	// 8. Check user status
	if resolvedUser.User.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	if resolvedUser.BindAfterStatusCheck {
		if err := bindOAuthIdentityToUser(resolvedUser.User, provider, oauthUser.ProviderUserID); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	// 9. Setup login
	setupLogin(resolvedUser.User, c)
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

	handleOAuthBindWithUser(c, provider, oauthUser)
}

func handleOAuthBindWithUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser) {
	err := bindOAuthIdentityToCurrentUser(c, provider, oauthUser)
	if err != nil {
		if boundErr, ok := err.(*OAuthAlreadyBoundError); ok {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(boundErr.Provider))
			return
		}
		common.ApiError(c, err)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
		"action": "bind",
	})
}

func bindOAuthIdentityToCurrentUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser) error {
	// Check if this OAuth account is already bound (check both new ID and legacy ID)
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		return &OAuthAlreadyBoundError{Provider: provider.GetName()}
	}
	// Also check legacy ID to prevent duplicate bindings during migration period
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			return &OAuthAlreadyBoundError{Provider: provider.GetName()}
		}
	}

	// Get current user from session
	session := sessions.Default(c)
	id := session.Get("id")
	if id == nil {
		return fmt.Errorf("missing current user session")
	}
	user := model.User{Id: id.(int)}
	err := user.FillUserById()
	if err != nil {
		return err
	}

	// Handle binding based on provider type
	if customBindingProvider, ok := provider.(oauth.CustomBindingProvider); ok {
		// Custom provider: use user_oauth_bindings table
		err = ensureUserHasNoCustomProviderBinding(user.Id, customBindingProvider.GetProviderId())
		if err == nil {
			err = model.UpdateUserOAuthBinding(user.Id, customBindingProvider.GetProviderId(), oauthUser.ProviderUserID)
		}
		if err != nil {
			return err
		}
	} else {
		// Built-in provider: update user record directly
		if err := ensureBuiltInProviderBindingAvailable(&user, provider, oauthUser); err != nil {
			return err
		}
		provider.SetProviderUserID(&user, oauthUser.ProviderUserID)
		err = user.Update(false)
		if err != nil {
			return err
		}
	}
	return nil
}

// findOrCreateOAuthUser finds existing user or creates new user
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, session sessions.Session) (*oauthUserResolutionResult, error) {
	return findOrCreateOAuthUserWithOptions(c, provider, oauthUser, session, oauthFindOrCreateOptions{
		AllowAutoRegister:     true,
		AllowAutoMergeByEmail: false,
		InitialRole:           common.RoleCommonUser,
	})
}

type oauthFindOrCreateOptions struct {
	AllowAutoRegister     bool
	AllowAutoMergeByEmail bool
	InitialRole           int
	InitialGroup          string
}

type oauthUserResolutionResult struct {
	User                  *model.User
	BindAfterStatusCheck  bool
	AutoRegisterTriggered bool
	EmailMergeTriggered   bool
}

func findOrCreateOAuthUserWithOptions(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, session sessions.Session, options oauthFindOrCreateOptions) (*oauthUserResolutionResult, error) {
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
		return &oauthUserResolutionResult{User: user}, nil
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if _, ok := provider.(*oauth.GitHubProvider); ok && provider.IsUserIDTaken(legacyID) {
			err := provider.FillUserByProviderID(user, legacyID)
			if err != nil {
				return nil, err
			}
			if user.Id != 0 {
				// Found user with legacy ID, migrate to new ID
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					user.Id, legacyID, oauthUser.ProviderUserID))
				if err := user.UpdateGitHubId(oauthUser.ProviderUserID); err != nil {
					common.SysError(fmt.Sprintf("[OAuth] Failed to migrate user %d: %s", user.Id, err.Error()))
					// Continue with login even if migration fails
				}
				return &oauthUserResolutionResult{User: user}, nil
			}
		}
	}

	if options.AllowAutoMergeByEmail {
		mergedUser, err := findOAuthMergeCandidateByEmail(oauthUser.Email)
		if err != nil {
			return nil, err
		}
		if mergedUser != nil {
			if customBindingProvider, ok := provider.(oauth.CustomBindingProvider); ok {
				if err := ensureUserHasNoCustomProviderBinding(mergedUser.Id, customBindingProvider.GetProviderId()); err != nil {
					return nil, err
				}
			}
			return &oauthUserResolutionResult{
				User:                 mergedUser,
				BindAfterStatusCheck: true,
				EmailMergeTriggered:  true,
			}, nil
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !options.AllowAutoRegister {
		return nil, &OAuthAutoRegisterDisabledError{}
	}
	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
	}

	// Set up new user
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)

	if oauthUser.Username != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUser.Username, ""); err == nil && !exists {
			// 防止索引退化
			if len(oauthUser.Username) <= model.UserNameMaxLength {
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
	user.Role = normalizeOAuthInitialRole(options.InitialRole)
	if strings.TrimSpace(options.InitialGroup) != "" {
		user.Group = strings.TrimSpace(options.InitialGroup)
	}
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	// Use transaction to ensure user creation and OAuth binding are atomic
	if customBindingProvider, ok := provider.(oauth.CustomBindingProvider); ok {
		// Custom provider: create user and binding in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Create OAuth binding
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     customBindingProvider.GetProviderId(),
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
			if err := tx.Model(user).Updates(map[string]interface{}{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
			}).Error; err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, err
		}

		// Perform post-transaction tasks
		user.FinalizeOAuthUserCreation(inviterId)
	}

	return &oauthUserResolutionResult{
		User:                  user,
		AutoRegisterTriggered: true,
	}, nil
}

func findOAuthMergeCandidateByEmail(email string) (*model.User, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil, nil
	}
	var users []*model.User
	if err := model.DB.Unscoped().Where("email = ?", email).Limit(2).Find(&users).Error; err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}
	if len(users) > 1 {
		return nil, fmt.Errorf("multiple users matched email %s, auto merge is not allowed", email)
	}
	if users[0].DeletedAt.Valid {
		return nil, &OAuthUserDeletedError{}
	}
	return users[0], nil
}

func ensureUserHasNoCustomProviderBinding(userID, providerID int) error {
	_, err := model.GetUserOAuthBinding(userID, providerID)
	if err == nil {
		return fmt.Errorf("user already has a binding for provider %d", providerID)
	}
	if err == gorm.ErrRecordNotFound {
		return nil
	}
	return err
}

func ensureBuiltInProviderBindingAvailable(user *model.User, provider oauth.Provider, oauthUser *oauth.OAuthUser) error {
	if user == nil || provider == nil || oauthUser == nil {
		return nil
	}

	currentID := strings.TrimSpace(getBuiltInProviderBinding(user, provider))
	if currentID == "" || currentID == strings.TrimSpace(oauthUser.ProviderUserID) {
		return nil
	}

	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok {
		if strings.TrimSpace(legacyID) != "" && currentID == strings.TrimSpace(legacyID) {
			return nil
		}
	}

	return &OAuthAlreadyBoundError{Provider: provider.GetName()}
}

func getBuiltInProviderBinding(user *model.User, provider oauth.Provider) string {
	switch provider.(type) {
	case *oauth.GitHubProvider:
		return user.GitHubId
	case *oauth.DiscordProvider:
		return user.DiscordId
	case *oauth.OIDCProvider:
		return user.OidcId
	case *oauth.LinuxDOProvider:
		return user.LinuxDOId
	default:
		return ""
	}
}

func bindOAuthIdentityToUser(user *model.User, provider oauth.Provider, providerUserID string) error {
	if customBindingProvider, ok := provider.(oauth.CustomBindingProvider); ok {
		return model.UpdateUserOAuthBinding(user.Id, customBindingProvider.GetProviderId(), providerUserID)
	}
	provider.SetProviderUserID(user, providerUserID)
	return user.Update(false)
}

func normalizeOAuthInitialRole(role int) int {
	switch role {
	case common.RoleGuestUser, common.RoleCommonUser, common.RoleAdminUser:
		return role
	default:
		return common.RoleCommonUser
	}
}

const (
	oauthSyncDisplayNameMaxLength = 20
	oauthSyncEmailMaxLength       = 50
)

type oauthUserSyncOptions struct {
	ProviderName           string
	SyncUsernameOnLogin    bool
	SyncDisplayNameOnLogin bool
	SyncEmailOnLogin       bool
	SyncGroupOnLogin       bool
	SyncRoleOnLogin        bool
	NextGroup              string
	NextRole               int
}

func syncOAuthUserLoginAttributes(user *model.User, oauthUser *oauth.OAuthUser, options oauthUserSyncOptions) error {
	if user == nil {
		return fmt.Errorf("user is nil")
	}
	if oauthUser == nil {
		return fmt.Errorf("oauth user is nil")
	}

	changes := make([]string, 0, 5)
	skips := make([]string, 0, 3)

	if options.SyncUsernameOnLogin {
		nextUsername := strings.TrimSpace(oauthUser.Username)
		switch {
		case nextUsername == "":
		case len(nextUsername) > model.UserNameMaxLength:
			skips = append(skips, fmt.Sprintf("username 超过 %d 个字符", model.UserNameMaxLength))
		case nextUsername == user.Username:
		default:
			available, err := isOAuthSyncFieldAvailable("username", nextUsername, user.Id)
			if err != nil {
				return err
			}
			if !available {
				skips = append(skips, fmt.Sprintf("username %s 已被占用", safeOAuthAuditValue(nextUsername)))
			} else {
				changes = append(changes, fmt.Sprintf("username %s -> %s", safeOAuthAuditValue(user.Username), safeOAuthAuditValue(nextUsername)))
				user.Username = nextUsername
			}
		}
	}

	if options.SyncDisplayNameOnLogin {
		nextDisplayName := strings.TrimSpace(oauthUser.DisplayName)
		switch {
		case nextDisplayName == "":
		case len(nextDisplayName) > oauthSyncDisplayNameMaxLength:
			skips = append(skips, fmt.Sprintf("display_name 超过 %d 个字符", oauthSyncDisplayNameMaxLength))
		case nextDisplayName == user.DisplayName:
		default:
			changes = append(changes, fmt.Sprintf("display_name %s -> %s", safeOAuthAuditValue(user.DisplayName), safeOAuthAuditValue(nextDisplayName)))
			user.DisplayName = nextDisplayName
		}
	}

	if options.SyncEmailOnLogin {
		nextEmail := strings.TrimSpace(oauthUser.Email)
		switch {
		case nextEmail == "":
		case len(nextEmail) > oauthSyncEmailMaxLength:
			skips = append(skips, fmt.Sprintf("email 超过 %d 个字符", oauthSyncEmailMaxLength))
		case nextEmail == user.Email:
		default:
			available, err := isOAuthSyncFieldAvailable("email", nextEmail, user.Id)
			if err != nil {
				return err
			}
			if !available {
				skips = append(skips, fmt.Sprintf("email %s 已被其他用户占用", safeOAuthAuditValue(nextEmail)))
			} else {
				changes = append(changes, fmt.Sprintf("email %s -> %s", safeOAuthAuditValue(user.Email), safeOAuthAuditValue(nextEmail)))
				user.Email = nextEmail
			}
		}
	}

	if options.SyncGroupOnLogin {
		group := strings.TrimSpace(options.NextGroup)
		if group != "" && group != user.Group {
			changes = append(changes, fmt.Sprintf("group %s -> %s", safeOAuthAuditValue(user.Group), group))
			user.Group = group
		}
	}

	oldRole := user.Role
	if options.SyncRoleOnLogin && isOAuthSyncRole(options.NextRole) && options.NextRole != user.Role {
		changes = append(changes, fmt.Sprintf("role %s -> %s", oauthRoleLabel(user.Role), oauthRoleLabel(options.NextRole)))
		user.Role = options.NextRole
	}

	if len(changes) == 0 && len(skips) == 0 {
		return nil
	}

	if len(changes) > 0 {
		if err := ensureOAuthSidebarForRoleChange(user, oldRole, user.Role); err != nil {
			common.SysLog(fmt.Sprintf("[OAuth] Failed to align sidebar for user %d after role sync: %v", user.Id, err))
		}
		if err := user.Update(false); err != nil {
			return err
		}
	}

	logParts := make([]string, 0, 2)
	if len(changes) > 0 {
		logParts = append(logParts, "变更："+strings.Join(changes, "，"))
	}
	if len(skips) > 0 {
		logParts = append(logParts, "跳过："+strings.Join(skips, "，"))
	}
	content := fmt.Sprintf("外部登录同步用户属性（%s）：%s", options.ProviderName, strings.Join(logParts, "；"))
	model.RecordLog(user.Id, model.LogTypeSystem, content)
	common.SysLog(fmt.Sprintf("[OAuth] %s", content))
	return nil
}

func isOAuthSyncFieldAvailable(field string, value string, userID int) (bool, error) {
	var existing model.User
	err := model.DB.Unscoped().Where(field+" = ? AND id <> ?", value, userID).First(&existing).Error
	if err == nil {
		return false, nil
	}
	if err == gorm.ErrRecordNotFound {
		return true, nil
	}
	return false, err
}

func ensureOAuthSidebarForRoleChange(user *model.User, oldRole int, newRole int) error {
	if user == nil || oldRole == newRole || newRole != common.RoleAdminUser {
		return nil
	}

	defaultConfig := generateDefaultSidebarConfig(newRole)
	if defaultConfig == "" {
		return nil
	}

	defaultSidebar := make(map[string]any)
	if err := common.UnmarshalJsonStr(defaultConfig, &defaultSidebar); err != nil {
		return err
	}

	adminSection, ok := defaultSidebar["admin"]
	if !ok {
		return nil
	}

	setting := user.GetSetting()
	sidebar := make(map[string]any)
	if raw := strings.TrimSpace(setting.SidebarModules); raw != "" {
		if err := common.UnmarshalJsonStr(raw, &sidebar); err != nil {
			return err
		}
	}
	if _, exists := sidebar["admin"]; exists {
		return nil
	}

	sidebar["admin"] = adminSection
	setting.SidebarModules = common.MapToJsonStr(sidebar)
	user.SetSetting(setting)
	return nil
}

func isOAuthSyncRole(role int) bool {
	switch role {
	case common.RoleCommonUser, common.RoleAdminUser:
		return true
	default:
		return false
	}
}

func oauthRoleLabel(role int) string {
	switch role {
	case common.RoleAdminUser:
		return "admin"
	case common.RoleCommonUser:
		return "common"
	case common.RoleGuestUser:
		return "guest"
	case common.RoleRootUser:
		return "root"
	default:
		return strconv.Itoa(role)
	}
}

func safeOAuthAuditValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "(empty)"
	}
	return value
}

// Error types for OAuth
type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthAlreadyBoundError struct {
	Provider string
}

func (e *OAuthAlreadyBoundError) Error() string {
	return "oauth account is already bound"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}

type OAuthAutoRegisterDisabledError struct{}

func (e *OAuthAutoRegisterDisabledError) Error() string {
	return "provider auto registration is disabled"
}

func handleOAuthUserError(c *gin.Context, err error) {
	switch err.(type) {
	case *OAuthUserDeletedError:
		common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
	case *OAuthRegistrationDisabledError, *OAuthAutoRegisterDisabledError:
		common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
	default:
		common.ApiError(c, err)
	}
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
