package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username          string `json:"username"`
	Password          string `json:"password"`
	PasswordEncrypted string `json:"password_encrypted"`
	EncryptionKeyID   string `json:"encryption_key_id"`
}

func GetPasswordEncryptionKey(c *gin.Context) {
	if !common.PasswordLoginEncryptionEnabled {
		common.ApiSuccess(c, gin.H{"enabled": false})
		return
	}
	keyID, publicKey := common.PasswordEncryptionPublicKey()
	if keyID == "" || publicKey == "" {
		common.ApiErrorT(c, "Database error, please contact the administrator")
		return
	}
	common.ApiSuccess(c, gin.H{
		"enabled":    true,
		"kid":        keyID,
		"public_key": publicKey,
	})
}

func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorT(c, "Password login has been disabled by administrator")
		return
	}
	var loginRequest LoginRequest
	err := common.DecodeJson(c.Request.Body, &loginRequest)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
	if common.PasswordLoginEncryptionEnabled {
		if loginRequest.PasswordEncrypted == "" || loginRequest.EncryptionKeyID == "" {
			common.ApiErrorT(c, "Invalid parameters")
			return
		}
		password, err = common.DecryptPassword(loginRequest.PasswordEncrypted, loginRequest.EncryptionKeyID)
		if err != nil {
			common.ApiErrorT(c, "Username or password is incorrect, or user has been banned")
			return
		}
	}
	if username == "" || password == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	user := model.User{
		Username: username,
		Password: password,
	}
	err = user.ValidateAndFill()
	if err != nil {
		switch {
		case errors.Is(err, model.ErrDatabase):
			common.SysLog(common.LogText("Login database error for user %s: %v", username, err))
			common.ApiErrorT(c, "Database error, please contact the administrator")
		case errors.Is(err, model.ErrUserEmptyCredentials):
			common.ApiErrorT(c, "Invalid parameters")
		default:
			common.ApiErrorT(c, "Username or password is incorrect, or user has been banned")
		}
		return
	}

	setupLogin(&user, nil, c)
}

// loginMethodFromContext derives the login method based on the request path and is used for logging in audit logs.
func loginMethodFromContext(c *gin.Context) string {
	if method := c.GetString("login_method"); method != "" {
		return method
	}
	switch c.FullPath() {
	case "/api/user/login":
		return "password"
	case "/api/user/login/2fa":
		return "2fa"
	case "/api/user/passkey/login/finish":
		return "passkey"
	case "/api/oauth/wechat":
		return "wechat"
	case "/api/oauth/telegram/login":
		return "telegram"
	case "/api/oauth/:provider":
		if provider := c.Param("provider"); provider != "" {
			return "oauth:" + provider
		}
		return "oauth"
	default:
		return "unknown"
	}
}

// recordLoginAudit records login success audit log (enabled for all users, only records success, not failure).
func recordLoginAudit(user *model.User, c *gin.Context) {
	method := loginMethodFromContext(c)
	ip := c.ClientIP()
	extra := model.AuditOther{
		LoginMethod: method,
		UserAgent:   c.Request.UserAgent(),
	}
	content := fmt.Sprintf("Logged in successfully via %s", method)
	params := map[string]any{
		"method": method,
	}
	if verifiedMethod := c.GetString("login_verification_method"); verifiedMethod != "" {
		params["verification_method"] = verifiedMethod
	}
	model.RecordLoginLog(user.Id, user.Role, user.Username, content, ip, "login", params, extra, c)
}

// setupLogin evaluates the shared login policy after primary authentication.
// Only a completed Passkey ceremony may go directly to session issuance. A
// pending legacy GitHub binding rewrite travels inside the challenge and is
// written only when the verification completes.
func setupLogin(user *model.User, migration *service.LegacyGitHubMigration, c *gin.Context) {
	challenge, err := service.StartLoginVerification(user, loginMethodFromContext(c), migration)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if challenge != nil {
		setAuthNoStore(c)
		common.ApiSuccess(c, challenge)
		return
	}
	setupLoginAtAuthVersion(user, user.AuthVersion, c)
}

func setupLoginAtAuthVersion(user *model.User, expectedAuthVersion int64, c *gin.Context) {
	if user == nil || user.Id <= 0 || user.Status != common.UserStatusEnabled {
		common.ApiErrorT(c, "User has been banned")
		return
	}
	currentUser, err := model.GetSelfUserById(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var bundle *service.AuthBundle
	if expectedAuthVersion > 0 {
		bundle, err = service.CreateLoginSessionAtAuthVersion(
			user.Id,
			expectedAuthVersion,
			loginMethodFromContext(c),
			c.ClientIP(),
			c.Request.UserAgent(),
		)
	} else {
		bundle, err = service.CreateLoginSession(
			user.Id,
			loginMethodFromContext(c),
			c.ClientIP(),
			c.Request.UserAgent(),
		)
	}
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	writeLoginResponse(c, currentUser, bundle)
}

func writeLoginResponse(c *gin.Context, user *model.User, bundle *service.AuthBundle) {
	c.Set("login_method", bundle.Session.LoginMethod)
	model.UpdateUserLastLoginAt(user.Id)
	service.WriteRefreshCookie(c, bundle.RefreshToken)
	setAuthNoStore(c)
	recordLoginAudit(user, c)
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data": gin.H{
			"access_token":      bundle.AccessToken,
			"token_type":        bundle.TokenType,
			"access_expires_at": bundle.AccessExpiresAt,
			"session":           bundle.Session,
			"user":              buildSelfUserData(user),
		},
	})
}

func Register(c *gin.Context) {
	if !common.RegisterEnabled {
		common.ApiErrorT(c, "New user registration has been disabled by administrator")
		return
	}
	if !common.PasswordRegisterEnabled {
		common.ApiErrorT(c, "Password registration has been disabled by administrator, please use third-party account verification")
		return
	}
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	user.Username = strings.TrimSpace(user.Username)
	user.Email = model.NormalizeEmail(user.Email)
	if user.Username == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	if common.EmailVerificationEnabled {
		if user.Email == "" || user.VerificationCode == "" {
			common.ApiErrorT(c, "Email verification is enabled, please enter email address and verification code")
			return
		}
		if !common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose) {
			common.ApiErrorT(c, "Verification code is incorrect or has expired")
			return
		}
		if err := model.EnsureEmailAvailable(user.Email, 0); err != nil {
			if errors.Is(err, model.ErrEmailAlreadyTaken) {
				common.ApiErrorT(c, "Email address is already in use")
				return
			}
			common.ApiErrorT(c, "Database error, please contact the administrator")
			return
		}
	}
	emailForExistCheck := ""
	if common.EmailVerificationEnabled {
		emailForExistCheck = user.Email
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, emailForExistCheck)
	if err != nil {
		common.ApiErrorT(c, "Database error, please contact the administrator")
		common.SysLog(common.LogText("CheckUserExistOrDeleted error: %v", err))
		return
	}
	if exist {
		common.ApiErrorT(c, "Username already exists or has been deleted")
		return
	}
	affCode := user.AffCode // this code is the inviter's code, not the user's own code
	inviterId, _ := model.GetUserIdByAffCode(affCode)
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser, // Explicitly set the role to normal user
	}
	if common.EmailVerificationEnabled {
		cleanUser.Email = user.Email
	}
	if err := cleanUser.Insert(inviterId); err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorT(c, "Email address is already in use")
			return
		}
		common.ApiError(c, err)
		return
	}

	// Get the inserted user ID
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		common.ApiErrorT(c, "User registration failed or user ID retrieval failed")
		return
	}
	// Generate default token
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			common.ApiErrorT(c, "Failed to generate default token")
			common.SysLog(common.LogText("failed to generate token key: %s", err.Error()))
			return
		}
		// Generate default token
		token := model.Token{
			UserId:             insertedUser.Id, // Use the inserted user ID
			Name:               i18n.T(c, i18n.MsgUserDefaultTokenName, map[string]any{"Username": cleanUser.Username}),
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,     // never expires
			RemainQuota:        500000, // Example amount
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		token.AllowUserQuotaQuery = true
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			common.ApiErrorT(c, "Failed to create default token")
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func GetAllUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	sortOptions := model.NewUserSortOptions(c.Query("sort_by"), c.Query("sort_order"))
	users, total, err := model.GetAllUsers(pageInfo, sortOptions)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)

	common.ApiSuccess(c, pageInfo)
	return
}

func SearchUsers(c *gin.Context) {
	keyword := c.Query("keyword")
	group := c.Query("group")
	var role *int
	if roleStr := c.Query("role"); roleStr != "" {
		if parsed, err := strconv.Atoi(roleStr); err == nil {
			role = &parsed
		}
	}
	var status *int
	if statusStr := c.Query("status"); statusStr != "" {
		if parsed, err := strconv.Atoi(statusStr); err == nil {
			status = &parsed
		}
	}
	pageInfo := common.GetPageQuery(c)
	sortOptions := model.NewUserSortOptions(c.Query("sort_by"), c.Query("sort_order"))
	users, total, err := model.SearchUsers(keyword, group, role, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), sortOptions)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
	return
}

func canManageTargetRole(myRole int, targetRole int) bool {
	return myRole == common.RoleRootUser || myRole > targetRole
}

func GetUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorT(c, "No permission to access users of same or higher level")
		return
	}
	user.AdminPermissions = authz.Capabilities(user.Id, user.Role)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user,
	})
	return
}

type TransferAffQuotaRequest struct {
	Quota int `json:"quota" binding:"required"`
}

func TransferAffQuota(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tran := TransferAffQuotaRequest{}
	if err := c.ShouldBindJSON(&tran); err != nil {
		common.ApiError(c, err)
		return
	}
	err = user.TransferAffQuotaToQuota(tran.Quota)
	var message *common.Message
	if errors.As(err, &message) {
		common.ApiError(c, err)
		return
	}
	if err != nil {
		common.ApiErrorT(c, "Transfer failed {{error}}", map[string]any{"error": err.Error()})
		return
	}
	common.ApiSuccessT(c, "Transfer successful", nil)
}

func GetAffCode(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.AffCode == "" {
		user.AffCode = common.GetRandomString(4)
		if err := user.Update(false); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user.AffCode,
	})
	return
}

func GetSelf(c *gin.Context) {
	id := c.GetInt("id")
	userRole := c.GetInt("role")
	user, err := model.GetSelfUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responseData := buildSelfUserData(user)
	// The authenticated role is loaded from GetUserCache. It should equal the
	// row role, but use it for capabilities so GetSelf and login/refresh remain
	// consistent with the authorization decision made for this request.
	permissions := calculateUserPermissions(userRole)
	permissions["admin_permissions"] = authz.Capabilities(id, userRole)
	responseData["permissions"] = permissions

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    responseData,
	})
	return
}

// buildSelfUserData is the single safe dashboard-user DTO used by GetSelf,
// login and refresh. It intentionally excludes password, management PAT and
// administrator-only remarks.
func buildSelfUserData(user *model.User) map[string]any {
	userSetting := user.GetSetting()
	permissions := calculateUserPermissions(user.Role)
	permissions["admin_permissions"] = authz.Capabilities(user.Id, user.Role)
	return map[string]any{
		"id":                user.Id,
		"username":          user.Username,
		"display_name":      user.DisplayName,
		"has_password":      user.HasPassword,
		"role":              user.Role,
		"status":            user.Status,
		"email":             user.Email,
		"github_id":         user.GitHubId,
		"discord_id":        user.DiscordId,
		"oidc_id":           user.OidcId,
		"wechat_id":         user.WeChatId,
		"telegram_id":       user.TelegramId,
		"group":             user.Group,
		"quota":             user.Quota,
		"used_quota":        user.UsedQuota,
		"request_count":     user.RequestCount,
		"aff_code":          user.AffCode,
		"aff_count":         user.AffCount,
		"aff_quota":         user.AffQuota,
		"aff_history_quota": user.AffHistoryQuota,
		"inviter_id":        user.InviterId,
		"linux_do_id":       user.LinuxDOId,
		"setting":           user.Setting,
		"stripe_customer":   user.StripeCustomer,
		"sidebar_modules":   userSetting.SidebarModules, // Correctly extract sidebar_modules field
		"permissions":       permissions,
	}
}

// Helper functions for calculating user permissions
func calculateUserPermissions(userRole int) map[string]any {
	permissions := map[string]any{}

	// Calculate permissions based on user roles
	if userRole == common.RoleRootUser {
		// Super administrator does not need sidebar settings function
		permissions["sidebar_settings"] = false
		permissions["sidebar_modules"] = map[string]any{}
	} else if userRole == common.RoleAdminUser {
		// Administrators can set the sidebar, but the system setting function is not included
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]any{
			"admin": map[string]any{
				"setting": false, // Administrators cannot access system settings
			},
		}
	} else {
		// Ordinary users can only set personal functions, excluding the administrator area.
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]any{
			"admin": false, // Ordinary users cannot access the administrator area
		}
	}

	return permissions
}

// Generate default sidebar configuration based on user role
func generateDefaultSidebarConfig(userRole int) string {
	defaultConfig := map[string]any{}

	// Chat area - accessible to all users
	defaultConfig["chat"] = map[string]any{
		"enabled":    true,
		"playground": true,
		"chat":       true,
	}

	// Console area - accessible to all users
	defaultConfig["console"] = map[string]any{
		"enabled":    true,
		"detail":     true,
		"token":      true,
		"log":        true,
		"midjourney": true,
		"task":       true,
	}

	// Personal Center Area - accessible to all users
	defaultConfig["personal"] = map[string]any{
		"enabled":  true,
		"topup":    true,
		"personal": true,
	}

	// Administrator area - determined by role
	if userRole == common.RoleAdminUser {
		// Administrators can access the administrator area but not system settings
		defaultConfig["admin"] = map[string]any{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    false, // Administrators cannot access system settings
		}
	} else if userRole == common.RoleRootUser {
		// Super administrator has access to all features
		defaultConfig["admin"] = map[string]any{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    true,
		}
	}
	// Ordinary users do not include the admin area

	// Convert to JSON string
	configBytes, err := common.Marshal(defaultConfig)
	if err != nil {
		common.SysLog(common.LogText("failed to generate the default sidebar config: %s", err.Error()))
		return ""
	}

	return string(configBytes)
}

func GetUserModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		id = c.GetInt("id")
	}
	user, err := model.GetUserCache(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := service.GetUserUsableGroups(user.Group)
	group := c.Query("group")
	var groupsToQuery []string
	switch {
	case group == "":
		for g := range groups {
			groupsToQuery = append(groupsToQuery, g)
		}
	case group == "auto":
		if _, ok := groups[group]; ok {
			groupsToQuery = service.GetUserAutoGroup(user.Group)
		}
	default:
		if _, ok := groups[group]; ok {
			groupsToQuery = []string{group}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    service.GetGroupsEnabledModels(groupsToQuery),
	})
}

func UpdateUser(c *gin.Context) {
	var updatedUser model.User
	err := common.DecodeJson(c.Request.Body, &updatedUser)
	if err != nil || updatedUser.Id == 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	updatedUser.Username = strings.TrimSpace(updatedUser.Username)
	if updatedUser.Username == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.StructExcept(&updatedUser, "Password"); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	originUser, err := model.GetUserById(updatedUser.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if updatedUser.Role != common.RoleGuestUser && updatedUser.Role != originUser.Role {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	updatedUser.Role = originUser.Role
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, originUser.Role) {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	updatePassword := updatedUser.Password != ""
	auditParams := map[string]any{
		"username": originUser.Username,
		"id":       updatedUser.Id,
	}
	// Resetting a password or rewriting the admin permission matrix changes what
	// the managed account can do or who can sign in to it.
	if updatePassword || updatedUser.AdminPermissions != nil {
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserUpdate, service.AdminUserContext{UserID: updatedUser.Id})
		if authorization == nil {
			return
		}
		auditParams["verification_method"] = authorization.Method
		auditParams["password_reset"] = updatePassword
		auditParams["admin_permissions_updated"] = updatedUser.AdminPermissions != nil
	}
	authzTouched := false
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := updatedUser.EditWithTx(tx, updatePassword); err != nil {
			return err
		}
		touched, err := updateAdminPermissionsForUserInTx(c, tx, updatedUser.Id, originUser.Role, updatedUser.AdminPermissions)
		authzTouched = touched
		return err
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	if authzTouched {
		model.BumpSyncTopic(model.SyncTopicAuthz)
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if updatedUser.AuthVersion > originUser.AuthVersion {
		if _, err := model.RevokeAllUserSessions(updatedUser.Id, "admin_user_update"); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.PublishUserAuthCache(updatedUser.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, updatedUser.Id, "user.update", auditParams)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func AdminClearUserBinding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	bindingType := strings.ToLower(strings.TrimSpace(c.Param("binding_type")))
	if bindingType == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorT(c, "No permission to access users of same or higher level")
		return
	}
	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserBindingClear, service.AdminUserBindingContext{UserID: user.Id, BindingType: bindingType})
	if authorization == nil {
		return
	}

	if err := user.ClearBinding(bindingType); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, user.Id, "user.binding_clear", map[string]any{
		"bindingType":         bindingType,
		"username":            user.Username,
		"verification_method": authorization.Method,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
	})
}

func UpdateSelf(c *gin.Context) {
	var requestData map[string]any
	if err := common.DecodeJson(c.Request.Body, &requestData); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	passwordRequested := false
	if value, exists := requestData["password"]; exists && value != nil {
		password, isString := value.(string)
		passwordRequested = !isString || password != ""
	}
	succeeded, notificationFailed := false, false
	if passwordRequested {
		defer func() {
			recordUserSecurityAudit(c, c.GetInt("id"), "user.password_change", map[string]any{"success": succeeded, "notification_failed": notificationFailed})
		}()
	}
	// Check if it is a user settings update request (sidebar_modules or language)
	if sidebarModules, sidebarExists := requestData["sidebar_modules"]; sidebarExists && !passwordRequested {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// Get current user settings
		currentSetting := user.GetSetting()

		// Update sidebar_modules field
		if sidebarModulesStr, ok := sidebarModules.(string); ok {
			currentSetting.SidebarModules = sidebarModulesStr
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorT(c, "Update failed")
			return
		}

		common.ApiSuccessT(c, "Update successful", nil)
		return
	}

	// Check if it is a language preference update request
	if language, langExists := requestData["language"]; langExists && !passwordRequested {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// Get current user settings
		currentSetting := user.GetSetting()

		// Update language field
		if langStr, ok := language.(string); ok {
			currentSetting.Language = langStr
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorT(c, "Update failed")
			return
		}

		common.ApiSuccessT(c, "Update successful", nil)
		return
	}

	// Original user information update logic
	var user model.User
	requestDataBytes, err := common.Marshal(requestData)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err = common.Unmarshal(requestDataBytes, &user); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	if err := common.Validate.StructExcept(&user, "Password"); err != nil {
		common.ApiErrorT(c, "Invalid input")
		return
	}

	cleanUser := model.User{
		Id:          c.GetInt("id"),
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
	}
	if user.Password != "" {
		identity, ok := middleware.GetStepUpIdentity(c)
		if !ok {
			writeSecurityOperationError(c, service.ErrAuthTokenInvalid)
			return
		}
		current, err := model.GetUserById(identity.UserID, true)
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		firstPassword := current.Password == ""
		scope := service.VerificationScopePasswordChange
		if firstPassword {
			scope = service.VerificationScopePasswordSet
		}
		if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: scope}) == nil {
			return
		}
		cleanUser.OriginalPassword = user.OriginalPassword
		if err := model.ChangeUserPassword(identity, &cleanUser, firstPassword); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		succeeded = true
		notificationFailed = service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, current.Id), current.Email, i18n.MsgSecurityEventPasswordUpdated) != nil
		if err := model.PublishUserAuthCache(cleanUser.Id); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		bundle, err := service.AdvanceCurrentSessionToUserVersion(identity, "password_changed")
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		data := authRotationData(bundle)
		data["has_password"] = true
		data["notification_warning"] = notificationFailed
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    data,
		})
		return
	}
	if err := cleanUser.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
	return
}

func DeleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	originUser, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if myRole <= originUser.Role {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, service.AdminUserContext{UserID: originUser.Id})
	if authorization == nil {
		return
	}
	revokedAccessTokens, err := model.HardDeleteUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, originUser.Id, "user.delete", map[string]any{
		"username":              originUser.Username,
		"id":                    originUser.Id,
		"verification_method":   authorization.Method,
		"revoked_access_tokens": revokedAccessTokens,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteSelf(c *gin.Context) {
	setAuthNoStore(c)
	succeeded := false
	var revokedAccessTokens int64
	defer func() {
		params := map[string]any{"success": succeeded}
		if succeeded {
			params["revoked_access_tokens"] = revokedAccessTokens
		}
		recordUserSecurityAudit(c, c.GetInt("id"), "user.account_delete", params)
	}()
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccountDelete}) == nil {
		return
	}
	identity, _ := middleware.GetStepUpIdentity(c)
	var err error
	if revokedAccessTokens, err = model.DeleteUserForSession(identity); err != nil {
		if errors.Is(err, model.ErrCannotDeleteRootUser) {
			common.ApiErrorT(c, "Cannot delete super administrator account")
			return
		}
		writeSecurityOperationError(c, err)
		return
	}
	succeeded = true
	service.ClearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{},
	})
}

func CreateUser(c *gin.Context) {
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	user.Username = strings.TrimSpace(user.Username)
	if err != nil || user.Username == "" || user.Password == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorT(c, "Invalid input {{error}}", map[string]any{"error": err.Error()})
		return
	}
	if !common.IsValidateRole(user.Role) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}
	myRole := c.GetInt("role")
	if user.Role >= myRole {
		common.ApiErrorT(c, "Cannot create users with permission level equal to or higher than yourself")
		return
	}
	auditParams := map[string]any{"role": user.Role}
	// Creating an administrator grants privilege just like promoting one.
	if user.Role >= common.RoleAdminUser {
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserCreate, service.AdminUserCreateContext{Role: user.Role})
		if authorization == nil {
			return
		}
		auditParams["verification_method"] = authorization.Method
	}
	// Even for admin users, we cannot fully trust them!
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role, // Keep roles set by administrator
	}
	authzTouched := false
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := cleanUser.InsertWithTx(tx, 0); err != nil {
			return err
		}
		touched, err := updateAdminPermissionsForUserInTx(c, tx, cleanUser.Id, cleanUser.Role, user.AdminPermissions)
		authzTouched = touched
		return err
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	if authzTouched {
		model.BumpSyncTopic(model.SyncTopicAuthz)
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	cleanUser.FinishInsert(0)

	auditParams["username"] = cleanUser.Username
	recordManageAuditFor(c, cleanUser.Id, "user.create", auditParams)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func updateAdminPermissionsForUserInTx(c *gin.Context, tx *gorm.DB, userID int, userRole int, permissions map[string]map[string]bool) (bool, error) {
	if permissions == nil {
		if userRole < common.RoleAdminUser && c.GetInt("role") == common.RoleRootUser {
			return true, authz.ClearUserAuthorizationInTx(tx, userID)
		}
		return false, nil
	}
	if c.GetInt("role") != common.RoleRootUser {
		return false, fmt.Errorf("only root can update admin permissions")
	}
	if userRole < common.RoleAdminUser {
		return true, authz.ClearUserAuthorizationInTx(tx, userID)
	}
	return true, authz.SetUserPermissionsInTx(tx, userID, permissions)
}

type ManageRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
	Value  int    `json:"value"`
	Mode   string `json:"mode"`
}

// ManageUser Only admin user can do this
func ManageUser(c *gin.Context) {
	var req ManageRequest
	err := common.DecodeJson(c.Request.Body, &req)

	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if req.Action == "add_quota" {
		manageUserQuota(c, req)
		return
	}
	user := model.User{
		Id: req.Id,
	}
	// Fill attributes
	model.DB.Unscoped().Where(&user).First(&user)
	if user.Id == 0 {
		common.ApiErrorT(c, "User does not exist")
		return
	}
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorT(c, "No permission to update users of same or higher permission level")
		return
	}
	switch req.Action {
	case "disable":
		user.Status = common.UserStatusDisabled
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot disable super administrator user")
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
	case "delete":
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot delete super administrator account")
			return
		}
		authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserDelete, service.AdminUserContext{UserID: user.Id})
		if authorization == nil {
			return
		}
		revokedAccessTokens, err := user.Delete()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		// After deleting a user, forcefully clear the cache of all user tokens in Redis.
		// Prevent cached tokens from still passing TokenAuth verification before the TTL expires.
		if err := model.InvalidateUserTokensCache(user.Id); err != nil {
			common.SysLog(common.LogText("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
		}
		recordManageAuditFor(c, user.Id, "user.manage", map[string]any{
			"action":                req.Action,
			"username":              user.Username,
			"id":                    user.Id,
			"verification_method":   authorization.Method,
			"revoked_access_tokens": revokedAccessTokens,
		})
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
		})
		return
	case "promote":
		if myRole != common.RoleRootUser {
			common.ApiErrorT(c, "Regular administrators cannot promote other users to administrator")
			return
		}
		if user.Role >= common.RoleAdminUser {
			common.ApiErrorT(c, "This user is already an administrator")
			return
		}
		user.Role = common.RoleAdminUser
	case "demote":
		if user.Role == common.RoleRootUser {
			common.ApiErrorT(c, "Cannot demote super administrator user")
			return
		}
		if user.Role == common.RoleCommonUser {
			common.ApiErrorT(c, "This user is already a common user")
			return
		}
		user.Role = common.RoleCommonUser
	default:
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserManage, service.AdminUserManageContext{UserID: user.Id, Action: req.Action})
	if authorization == nil {
		return
	}
	if req.Action == "demote" {
		if err := model.DB.Transaction(func(tx *gorm.DB) error {
			if err := user.UpdateWithTx(tx, false); err != nil {
				return err
			}
			return authz.ClearUserAuthorizationInTx(tx, user.Id)
		}); err != nil {
			common.ApiError(c, err)
			return
		}
		model.BumpSyncTopic(model.SyncTopicAuthz)
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.PublishUserAuthCache(user.Id); err != nil {
			common.ApiError(c, err)
			return
		}
		if _, err := model.RevokeAllUserSessions(user.Id, "admin_demote"); err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		if err := user.Update(false); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	// Update/UpdateWithTx has already published the new user hash and revoked
	// browser sessions exactly once. Only PAT/relay token caches still need an
	// explicit invalidation; deleting the user hash here would discard the
	// freshly published auth-version floor.
	if err := model.InvalidateUserTokensCache(user.Id); err != nil {
		common.SysLog(common.LogText("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
	}
	recordManageAuditFor(c, user.Id, "user.manage", map[string]any{
		"action":              req.Action,
		"username":            user.Username,
		"id":                  user.Id,
		"verification_method": authorization.Method,
	})
	clearUser := model.User{
		Role:   user.Role,
		Status: user.Status,
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    clearUser,
	})
	return
}

type topUpRequest struct {
	Key string `json:"key"`
}

var topUpLocks sync.Map
var topUpCreateLock sync.Mutex

type topUpTryLock struct {
	ch chan struct{}
}

func newTopUpTryLock() *topUpTryLock {
	return &topUpTryLock{ch: make(chan struct{}, 1)}
}

func (l *topUpTryLock) TryLock() bool {
	select {
	case l.ch <- struct{}{}:
		return true
	default:
		return false
	}
}

func (l *topUpTryLock) Unlock() {
	select {
	case <-l.ch:
	default:
	}
}

func getTopUpLock(userID int) *topUpTryLock {
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	topUpCreateLock.Lock()
	defer topUpCreateLock.Unlock()
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	l := newTopUpTryLock()
	topUpLocks.Store(userID, l)
	return l
}

func TopUp(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorT(c, "Payment, redemption, subscription, and invitation reward features are disabled. The administrator must confirm compliance terms before enabling them.")
		return
	}

	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		common.ApiErrorT(c, "Top-up is processing, please try again later")
		return
	}
	defer lock.Unlock()
	req := topUpRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		// The detailed reasons for redemption failure are not exposed to users to prevent attackers from judging the redemption code status based on the error type.
		common.ApiErrorT(c, "Redemption failed, please try again later")
		logger.LogError(c, common.LogText("failed to redeem key %s for user %d: %s", req.Key, id, err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    quota,
	})
}

type UpdateUserSettingRequest struct {
	QuotaWarningType                 string  `json:"notify_type"`
	QuotaWarningThreshold            float64 `json:"quota_warning_threshold"`
	QuotaWarningEnabled              *bool   `json:"quota_warning_enabled,omitempty"`
	WebhookUrl                       string  `json:"webhook_url,omitempty"`
	WebhookSecret                    string  `json:"webhook_secret,omitempty"`
	NotificationEmail                string  `json:"notification_email,omitempty"`
	BarkUrl                          string  `json:"bark_url,omitempty"`
	GotifyUrl                        string  `json:"gotify_url,omitempty"`
	GotifyToken                      string  `json:"gotify_token,omitempty"`
	GotifyPriority                   int     `json:"gotify_priority,omitempty"`
	UpstreamModelUpdateNotifyEnabled *bool   `json:"upstream_model_update_notify_enabled,omitempty"`
	ChannelNotifyEnabled             *bool   `json:"channel_notify_enabled,omitempty"`
	AcceptUnsetModelRatioModel       bool    `json:"accept_unset_model_ratio_model"`
	RecordIpLog                      bool    `json:"record_ip_log"`
}

func UpdateUserSetting(c *gin.Context) {
	var req UpdateUserSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	// Verification alert type
	if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark && req.QuotaWarningType != dto.NotifyTypeGotify {
		common.ApiErrorT(c, "Invalid warning type")
		return
	}

	// Verify the warning threshold, 0 means use the system default threshold
	if req.QuotaWarningThreshold < 0 {
		common.ApiErrorT(c, "Reminder threshold cannot be negative")
		return
	}

	// If it is a webhook type, verify the webhook address
	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		if req.WebhookUrl == "" {
			common.ApiErrorT(c, "Webhook URL cannot be empty")
			return
		}
		// Verify URL format
		if _, err := url.ParseRequestURI(req.WebhookUrl); err != nil {
			common.ApiErrorT(c, "Invalid Webhook URL")
			return
		}
	}

	// If it is an email type, verify the email address
	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		// Verify email format
		if !strings.Contains(req.NotificationEmail, "@") {
			common.ApiErrorT(c, "Invalid email address")
			return
		}
	}

	// If it is a Bark type, verify the Bark URL
	if req.QuotaWarningType == dto.NotifyTypeBark {
		if req.BarkUrl == "" {
			common.ApiErrorT(c, "Bark push URL cannot be empty")
			return
		}
		// Verify URL format
		if _, err := url.ParseRequestURI(req.BarkUrl); err != nil {
			common.ApiErrorT(c, "Invalid Bark push URL")
			return
		}
		// Check if it is HTTP or HTTPS
		if !strings.HasPrefix(req.BarkUrl, "https://") && !strings.HasPrefix(req.BarkUrl, "http://") {
			common.ApiErrorT(c, "URL must start with http:// or https://")
			return
		}
	}

	// If it is a Gotify type, verify the Gotify URL and Token
	if req.QuotaWarningType == dto.NotifyTypeGotify {
		if req.GotifyUrl == "" {
			common.ApiErrorT(c, "Gotify server URL cannot be empty")
			return
		}
		if req.GotifyToken == "" {
			common.ApiErrorT(c, "Gotify token cannot be empty")
			return
		}
		// Verify URL format
		if _, err := url.ParseRequestURI(req.GotifyUrl); err != nil {
			common.ApiErrorT(c, "Invalid Gotify server URL")
			return
		}
		// Check if it is HTTP or HTTPS
		if !strings.HasPrefix(req.GotifyUrl, "https://") && !strings.HasPrefix(req.GotifyUrl, "http://") {
			common.ApiErrorT(c, "URL must start with http:// or https://")
			return
		}
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Starting from the saved settings, fields not managed by this form such as language, sidebar, and chargeback policy remain unchanged;
	// Request that switches not carried also keep their original values.
	settings := user.GetSetting()
	settings.NotifyType = req.QuotaWarningType
	settings.QuotaWarningThreshold = req.QuotaWarningThreshold
	settings.AcceptUnsetRatioModel = req.AcceptUnsetModelRatioModel
	settings.RecordIpLog = req.RecordIpLog
	if req.QuotaWarningEnabled != nil {
		settings.QuotaWarningEnabled = req.QuotaWarningEnabled
	}
	if user.Role >= common.RoleAdminUser {
		if req.UpstreamModelUpdateNotifyEnabled != nil {
			settings.UpstreamModelUpdateNotifyEnabled = *req.UpstreamModelUpdateNotifyEnabled
		}
		if req.ChannelNotifyEnabled != nil {
			settings.ChannelNotifyEnabled = req.ChannelNotifyEnabled
		}
	}

	// Only the configuration of the selected notification method is retained, and the configuration of other methods is cleared.
	settings.WebhookUrl, settings.WebhookSecret = "", ""
	settings.NotificationEmail = ""
	settings.BarkUrl = ""
	settings.GotifyUrl, settings.GotifyToken, settings.GotifyPriority = "", "", 0
	switch req.QuotaWarningType {
	case dto.NotifyTypeWebhook:
		settings.WebhookUrl = req.WebhookUrl
		settings.WebhookSecret = req.WebhookSecret
	case dto.NotifyTypeEmail:
		settings.NotificationEmail = req.NotificationEmail
	case dto.NotifyTypeBark:
		settings.BarkUrl = req.BarkUrl
	case dto.NotifyTypeGotify:
		settings.GotifyUrl = req.GotifyUrl
		settings.GotifyToken = req.GotifyToken
		// The Gotify priority range is 0-10. If it exceeds the range, the default value 5 is used.
		if req.GotifyPriority < 0 || req.GotifyPriority > 10 {
			settings.GotifyPriority = 5
		} else {
			settings.GotifyPriority = req.GotifyPriority
		}
	}

	// Update user settings
	if err := model.UpdateUserSetting(user.Id, settings); err != nil {
		common.ApiErrorT(c, "Update failed")
		return
	}

	common.ApiSuccessT(c, "Settings updated", nil)
}
