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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username          string `json:"username"`
	Password          string `json:"password"`
	PasswordEncrypted string `json:"password_encrypted"`
	EncryptionKeyID   string `json:"encryption_key_id"`
}

var (
	errUserPasswordUnset    = errors.New("user password is not set")
	errOriginalPasswordFail = errors.New("original password is incorrect")
)

// ensurePasswordEncryptionKey lazily loads the shared key on replicas that
// enabled encryption through option sync before the key was loaded.
func ensurePasswordEncryptionKey() (keyID string, publicKey string, err error) {
	keyID, publicKey = common.PasswordEncryptionPublicKey()
	if keyID != "" && publicKey != "" {
		return keyID, publicKey, nil
	}
	if err = model.InitPasswordEncryption(); err != nil {
		return "", "", err
	}
	keyID, publicKey = common.PasswordEncryptionPublicKey()
	if keyID == "" || publicKey == "" {
		return "", "", errors.New("password encryption key is unavailable")
	}
	return keyID, publicKey, nil
}

func GetPasswordEncryptionKey(c *gin.Context) {
	if !common.PasswordLoginEncryptionEnabled {
		common.ApiSuccess(c, gin.H{"enabled": false})
		return
	}
	keyID, publicKey, err := ensurePasswordEncryptionKey()
	if err != nil {
		common.SysError("failed to load password encryption key: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	common.ApiSuccess(c, gin.H{
		"enabled":    true,
		"kid":        keyID,
		"public_key": publicKey,
	})
}

func disabledUserMessage(c *gin.Context, user *model.User) string {
	if user != nil && strings.TrimSpace(user.DisableReason) != "" {
		return i18n.T(c, i18n.MsgUserDisabledWithReason, map[string]any{
			"Reason": strings.TrimSpace(user.DisableReason),
		})
	}
	return i18n.T(c, i18n.MsgUserDisabled)
}

func apiDisabledUser(c *gin.Context, user *model.User) {
	reason := ""
	userId := 0
	username := ""
	disabledUntil := int64(0)
	if user != nil {
		reason = strings.TrimSpace(user.DisableReason)
		userId = user.Id
		username = user.Username
		disabledUntil = user.DisabledUntil
	}
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": disabledUserMessage(c, user),
		"data": gin.H{
			"error_type":     "user_disabled",
			"disable_reason": reason,
			"disabled_until": disabledUntil,
			"user_id":        userId,
			"username":       username,
		},
	})
}

func refreshExpiredUserBan(c *gin.Context, user *model.User) bool {
	if user == nil {
		return true
	}
	if _, err := user.RestoreExpiredUserBan(); err != nil {
		common.ApiError(c, err)
		return false
	}
	return true
}

const (
	usernameChangeLimit         = 3
	usernameChangeWindowSeconds = 365 * 24 * 60 * 60
)

type usernameChangeQuotaStatus struct {
	Limit       int
	Count       int
	Remaining   int
	WindowStart int64
	ResetAt     int64
}

func getUsernameChangeQuotaStatus(userSetting dto.UserSetting, now int64) usernameChangeQuotaStatus {
	status := usernameChangeQuotaStatus{
		Limit:     usernameChangeLimit,
		Remaining: usernameChangeLimit,
	}

	if userSetting.UsernameChangeWindowStart <= 0 || userSetting.UsernameChangeCount <= 0 {
		return status
	}

	resetAt := userSetting.UsernameChangeWindowStart + usernameChangeWindowSeconds
	if now >= resetAt {
		return status
	}

	count := userSetting.UsernameChangeCount
	if count < 0 {
		count = 0
	}
	if count > usernameChangeLimit {
		count = usernameChangeLimit
	}

	status.Count = count
	status.Remaining = usernameChangeLimit - count
	status.WindowStart = userSetting.UsernameChangeWindowStart
	status.ResetAt = resetAt
	return status
}

func applyUsernameChangeWindow(userSetting *dto.UserSetting, now int64) usernameChangeQuotaStatus {
	status := getUsernameChangeQuotaStatus(*userSetting, now)
	if status.WindowStart == 0 {
		userSetting.UsernameChangeWindowStart = now
		userSetting.UsernameChangeCount = 1
	} else {
		userSetting.UsernameChangeCount = status.Count + 1
	}
	return getUsernameChangeQuotaStatus(*userSetting, now)
}

func requiresOAuthEmailRepair(user *model.User) bool {
	return user != nil &&
		strings.TrimSpace(user.GitHubId) != "" &&
		model.NormalizeEmail(user.Email) == ""
}

func rejectOAuthEmailRepair(c *gin.Context, user *model.User) bool {
	if !requiresOAuthEmailRepair(user) {
		return false
	}
	common.ApiErrorI18n(c, i18n.MsgAuthOAuthEmailRepair)
	return true
}

func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordLoginDisabled)
		return
	}
	var loginRequest LoginRequest
	err := common.DecodeJson(c.Request.Body, &loginRequest)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
	if common.PasswordLoginEncryptionEnabled {
		if loginRequest.PasswordEncrypted == "" || loginRequest.EncryptionKeyID == "" {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		if _, _, keyErr := ensurePasswordEncryptionKey(); keyErr != nil {
			common.SysError("failed to load password encryption key: " + keyErr.Error())
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
			return
		}
		password, err = common.DecryptPassword(loginRequest.PasswordEncrypted, loginRequest.EncryptionKeyID)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
			return
		}
	}
	if username == "" || password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
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
			common.SysLog(fmt.Sprintf("Login database error for user %s: %v", username, err))
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		case errors.Is(err, model.ErrUserNotFound):
			common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		case errors.Is(err, model.ErrUserEmptyCredentials):
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		case errors.Is(err, model.ErrUserDisabled):
			apiDisabledUser(c, &user)
		default:
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
		}
		return
	}
	if rejectOAuthEmailRepair(c, &user) {
		return
	}

	// 检查是否启用2FA
	twoFAEnabled, err := model.IsTwoFAEnabled(user.Id)
	if err != nil {
		common.SysLog(fmt.Sprintf("Login failed to load 2FA status for user %d: %v", user.Id, err))
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	if twoFAEnabled {
		// 设置pending session，等待2FA验证
		session := sessions.Default(c)
		session.Set("pending_username", user.Username)
		session.Set("pending_user_id", user.Id)
		err := session.Save()
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": i18n.T(c, i18n.MsgUserRequire2FA),
			"success": true,
			"data": map[string]interface{}{
				"require_2fa": true,
			},
		})
		return
	}

	setupLogin(&user, c)
}

// loginMethodFromContext 根据请求路径推导登录方式，用于登录审计日志。
func loginMethodFromContext(c *gin.Context) string {
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

// recordLoginAudit 记录登录成功审计日志（对所有用户启用，仅记录成功，不记录失败）。
func recordLoginAudit(user *model.User, c *gin.Context) {
	method := loginMethodFromContext(c)
	ip := c.ClientIP()
	extra := map[string]interface{}{
		"login_method": method,
		"user_agent":   c.Request.UserAgent(),
	}
	content := fmt.Sprintf("Logged in successfully via %s", method)
	model.RecordLoginLog(user.Id, user.Username, content, ip, "login", map[string]interface{}{
		"method": method,
	}, extra)
}

// setup session & cookies and then return user info
func setupLogin(user *model.User, c *gin.Context) {
	if rejectOAuthEmailRepair(c, user) {
		return
	}
	setupLoginSession(user, c)
}

// setupLoginSession completes a login after the caller has performed all
// authentication-specific account checks.
func setupLoginSession(user *model.User, c *gin.Context) {
	model.UpdateUserLastLoginAt(user.Id)
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	err := session.Save()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
		return
	}
	recordLoginAudit(user, c)
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data": map[string]any{
			"id":           user.Id,
			"username":     user.Username,
			"display_name": user.Username,
			"role":         user.Role,
			"status":       user.Status,
			"group":        user.Group,
		},
	})
}

func Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	err := session.Save()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
	})
}

func handleRegistrationCredentialError(c *gin.Context, err error) bool {
	switch {
	case errors.Is(err, model.ErrRegistrationCredentialRequired):
		common.ApiErrorI18n(c, i18n.MsgUserAffCodeEmpty)
		return true
	case errors.Is(err, model.ErrRegistrationCredentialInvalid):
		common.ApiErrorI18n(c, i18n.MsgUserAffCodeInvalid)
		return true
	default:
		return false
	}
}

func Register(c *gin.Context) {
	if !common.RegisterEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		return
	}
	if !common.PasswordRegisterEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordRegisterDisabled)
		return
	}
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	user.Username = strings.TrimSpace(user.Username)
	user.Email = model.NormalizeEmail(user.Email)
	if user.Username == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	if common.EmailVerificationEnabled {
		if user.Email == "" || user.VerificationCode == "" {
			common.ApiErrorI18n(c, i18n.MsgUserEmailVerificationRequired)
			return
		}
		if err := validateEmailDomainPolicy(user.Email, common.EmailDomainRestrictionEnabled); err != nil {
			common.ApiError(c, err)
			return
		}
		if !common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose) {
			common.ApiErrorI18n(c, i18n.MsgUserVerificationCodeError)
			return
		}
		if err := model.EnsureEmailAvailable(user.Email, 0); err != nil {
			if errors.Is(err, model.ErrEmailAlreadyTaken) {
				common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
				return
			}
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
			return
		}
	}
	emailForExistCheck := ""
	if common.EmailVerificationEnabled {
		emailForExistCheck = user.Email
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, emailForExistCheck)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		common.SysLog(fmt.Sprintf("CheckUserExistOrDeleted error: %v", err))
		return
	}
	if exist {
		common.ApiErrorI18n(c, i18n.MsgUserExists)
		return
	}
	registrationCredential := user.AffCode
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		Role:        common.RoleCommonUser, // 明确设置角色为普通用户
	}
	if common.EmailVerificationEnabled {
		cleanUser.Email = user.Email
	}
	if err := cleanUser.InsertWithRegistrationCredential(registrationCredential, common.RegisterInviteCodeRequired); err != nil {
		if handleRegistrationCredentialError(c, err) {
			return
		}
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
			return
		}
		common.ApiError(c, err)
		return
	}

	// 获取插入后的用户ID
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
		return
	}
	// 生成默认令牌
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserDefaultTokenFailed)
			common.SysLog("failed to generate token key: " + err.Error())
			return
		}
		// 生成默认令牌
		token := model.Token{
			UserId:             insertedUser.Id, // 使用插入后的用户ID
			Name:               cleanUser.Username + "的初始令牌",
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,     // 永不过期
			RemainQuota:        500000, // 示例额度
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			common.ApiErrorI18n(c, i18n.MsgCreateDefaultTokenErr)
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
	users, total, err := model.GetAllUsers(pageInfo, getUserListQuery(c))
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
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.SearchUsersWithQuery(getUserListQuery(c), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
	return
}

func getUserListQuery(c *gin.Context) model.UserListQuery {
	role, _ := strconv.Atoi(c.Query("role"))
	if !common.IsValidateRole(role) || role == common.RoleGuestUser {
		role = 0
	}
	return model.UserListQuery{
		Keyword:    c.Query("keyword"),
		Group:      c.Query("group"),
		Status:     c.Query("status"),
		Role:       role,
		QuotaOrder: c.Query("quota_order"),
	}
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
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionSameLevel)
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

func GenerateAccessToken(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// get rand int 28-32
	randI := common.GetRandomInt(4)
	key, err := common.GenerateRandomKey(29 + randI)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgGenerateFailed)
		common.SysLog("failed to generate key: " + err.Error())
		return
	}
	user.SetAccessToken(key)

	if model.DB.Where("access_token = ?", user.AccessToken).First(user).RowsAffected != 0 {
		common.ApiErrorI18n(c, i18n.MsgUuidDuplicate)
		return
	}

	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user.AccessToken,
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
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserTransferFailed, map[string]any{"Error": err.Error()})
		return
	}
	common.ApiSuccessI18n(c, i18n.MsgUserTransferSuccess, nil)
}

func GetAffCode(c *gin.Context) {
	id := c.GetInt("id")
	affCode, err := model.EnsureUserAffCode(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    affCode,
	})
	return
}

func ResetAffCode(c *gin.Context) {
	id := c.GetInt("id")
	affCode, err := model.ResetUserAffCode(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, affCode)
}

func GenerateOneTimeInviteCode(c *gin.Context) {
	id := c.GetInt("id")
	inviteCode, err := model.GenerateOneTimeInviteCode(id)
	if err != nil {
		if errors.Is(err, model.ErrLoanDebtInviteBlocked) {
			common.ApiErrorI18n(c, i18n.MsgLoanDebtInviteBlocked)
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, inviteCode)
}

func GetInvitedUsers(c *gin.Context) {
	id := c.GetInt("id")
	users, err := model.GetInvitedUsers(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, users)
}

func GetSelf(c *gin.Context) {
	id := c.GetInt("id")
	userRole := c.GetInt("role")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Hide admin remarks: set to empty to trigger omitempty tag, ensuring the remark field is not included in JSON returned to regular users
	user.Remark = ""

	// 计算用户权限信息
	permissions := calculateUserPermissions(userRole)
	permissions["admin_permissions"] = authz.Capabilities(id, userRole)

	// 获取用户设置并提取sidebar_modules
	userSetting := user.GetSetting()
	userSettingJSON := model.UserSettingJSONForResponse(user.Setting)
	usernameChangeStatus := getUsernameChangeQuotaStatus(userSetting, common.GetTimestamp())

	// 判断用户是否设置了密码
	hasPassword := user.Password != ""
	user.Password = ""

	// 构建响应数据，包含用户信息和权限
	responseData := map[string]interface{}{
		"id":                           user.Id,
		"username":                     user.Username,
		"display_name":                 user.Username,
		"role":                         user.Role,
		"status":                       user.Status,
		"email":                        user.Email,
		"github_id":                    user.GitHubId,
		"discord_id":                   user.DiscordId,
		"oidc_id":                      user.OidcId,
		"wechat_id":                    user.WeChatId,
		"telegram_id":                  user.TelegramId,
		"qq_id":                        user.QQId,
		"steam_id":                     user.SteamId,
		"group":                        user.Group,
		"quota":                        user.Quota,
		"used_quota":                   user.UsedQuota,
		"request_count":                user.RequestCount,
		"aff_code":                     user.AffCode,
		"aff_count":                    user.AffCount,
		"aff_quota":                    user.AffQuota,
		"aff_history_quota":            user.AffHistoryQuota,
		"inviter_id":                   user.InviterId,
		"linux_do_id":                  user.LinuxDOId,
		"setting":                      userSettingJSON,
		"stripe_customer":              user.StripeCustomer,
		"sidebar_modules":              userSetting.SidebarModules, // 正确提取sidebar_modules字段
		"permissions":                  permissions,                // 新增权限字段
		"has_password":                 hasPassword,
		"force_record_ip_log_enabled":  common.ForceRecordIpLogEnabled,
		"setup_completed":              userSetting.SetupCompleted,
		"feature_update_v1":            userSetting.FeatureUpdateV1,
		"username_change_limit":        usernameChangeStatus.Limit,
		"username_change_count":        usernameChangeStatus.Count,
		"username_change_remaining":    usernameChangeStatus.Remaining,
		"username_change_window_start": usernameChangeStatus.WindowStart,
		"username_change_reset_at":     usernameChangeStatus.ResetAt,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    responseData,
	})
	return
}

// 计算用户权限的辅助函数
func calculateUserPermissions(userRole int) map[string]interface{} {
	permissions := map[string]interface{}{}

	// 根据用户角色计算权限
	if userRole == common.RoleRootUser {
		// 超级管理员不需要边栏设置功能
		permissions["sidebar_settings"] = false
		permissions["sidebar_modules"] = map[string]interface{}{}
	} else if userRole == common.RoleAdminUser {
		// 管理员可以设置边栏，但不包含系统设置功能
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": map[string]interface{}{
				"risk_center": false, // 管理员不能访问风控中心
				"setting":     false, // 管理员不能访问系统设置
			},
		}
	} else {
		// 普通用户只能设置个人功能，不包含管理员区域
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": false, // 普通用户不能访问管理员区域
		}
	}

	return permissions
}

// 根据用户角色生成默认的边栏配置
func generateDefaultSidebarConfig(userRole int) string {
	defaultConfig := map[string]interface{}{}

	// 聊天区域 - 所有用户都可以访问
	defaultConfig["chat"] = map[string]interface{}{
		"enabled":    true,
		"playground": true,
		"chat":       true,
	}

	// 控制台区域 - 所有用户都可以访问
	defaultConfig["console"] = map[string]interface{}{
		"enabled":    true,
		"detail":     true,
		"token":      true,
		"log":        true,
		"midjourney": true,
		"task":       true,
	}

	// 个人中心区域 - 所有用户都可以访问
	defaultConfig["personal"] = map[string]interface{}{
		"enabled":  true,
		"topup":    true,
		"invite":   true,
		"personal": true,
	}

	// 管理员区域 - 根据角色决定
	if userRole == common.RoleAdminUser {
		// 管理员可以访问管理员区域，但不能访问系统设置
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":     true,
			"ip_ban":      true,
			"channel":     true,
			"models":      true,
			"deployment":  true,
			"redemption":  true,
			"user":        true,
			"risk_center": false,
			"setting":     false, // 管理员不能访问系统设置
		}
	} else if userRole == common.RoleRootUser {
		// 超级管理员可以访问所有功能
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":     true,
			"ip_ban":      true,
			"channel":     true,
			"models":      true,
			"deployment":  true,
			"redemption":  true,
			"user":        true,
			"risk_center": true,
			"setting":     true,
		}
	}
	// 普通用户不包含admin区域

	// 转换为JSON字符串
	configBytes, err := common.Marshal(defaultConfig)
	if err != nil {
		common.SysLog("生成默认边栏配置失败: " + err.Error())
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
	if !isPrivilegedViewer(c) {
		groups = service.FilterHiddenGroupsForDisplay(groups, user.Group)
	}
	if group := c.Query("group"); group != "" {
		if _, ok := groups[group]; !ok {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    []string{},
			})
			return
		}
		if c.Query("with_capabilities") == "true" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    buildUserModelsWithCapabilities(model.GetGroupEnabledModels(group)),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    model.GetGroupEnabledModels(group),
		})
		return
	}
	models := buildUserModelsResponse(user.Group, isPrivilegedViewer(c))
	if c.Query("with_capabilities") == "true" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    buildUserModelsWithCapabilities(models),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
	return
}

// UserModelWithCapabilities 用户模型条目（含能力分类）
type UserModelWithCapabilities struct {
	Id                     string                  `json:"id"`
	SupportedEndpointTypes []constant.EndpointType `json:"supported_endpoint_types"`
}

// buildUserModelsWithCapabilities 为模型名列表附加 supported_endpoint_types
func buildUserModelsWithCapabilities(modelNames []string) []UserModelWithCapabilities {
	result := make([]UserModelWithCapabilities, 0, len(modelNames))
	for _, name := range modelNames {
		result = append(result, UserModelWithCapabilities{
			Id:                     name,
			SupportedEndpointTypes: model.GetModelSupportEndpointTypes(name),
		})
	}
	return result
}

func AdminGetUserModels(c *gin.Context) {
	user, ok := getAdminTokenTargetUser(c)
	if !ok {
		return
	}
	models := buildUserModelsResponse(user.Group, true)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
}

func buildUserModelsResponse(userGroup string, includeHidden bool) []string {
	groups := service.GetUserUsableGroups(userGroup)
	if !includeHidden {
		groups = service.FilterHiddenGroupsForDisplay(groups, userGroup)
	}
	var models []string
	for group := range groups {
		for _, g := range model.GetGroupEnabledModels(group) {
			if !common.StringsContains(models, g) {
				models = append(models, g)
			}
		}
	}
	return models
}

func UpdateUser(c *gin.Context) {
	var updatedUser model.User
	err := common.DecodeJson(c.Request.Body, &updatedUser)
	if err != nil || updatedUser.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	updatedUser.Username = strings.TrimSpace(updatedUser.Username)
	if updatedUser.Username == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if updatedUser.Password == "" {
		updatedUser.Password = "$I_LOVE_U" // make Validator happy :)
	}
	if len(updatedUser.Username) > model.UserNameMaxLength {
		common.ApiErrorI18n(c, i18n.MsgUserUsernameTooLong, map[string]any{"Max": model.UserNameMaxLength})
		return
	}
	if err := common.Validate.Struct(&updatedUser); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	originUser, err := model.GetUserById(updatedUser.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if updatedUser.Role != common.RoleGuestUser && updatedUser.Role != originUser.Role {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	updatedUser.Role = originUser.Role
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, originUser.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	if !canManageTargetRole(myRole, updatedUser.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserCannotCreateHigherLevel)
		return
	}
	if updatedUser.Username != "" {
		if model.IsUsernameAlreadyTaken(updatedUser.Username, updatedUser.Id) {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameTaken)
			return
		}
	}
	if updatedUser.Password == "$I_LOVE_U" {
		updatedUser.Password = "" // rollback to what it should be
	}
	updatePassword := updatedUser.Password != ""
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
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.InvalidateUserCache(updatedUser.Id); err != nil {
		common.SysLog(fmt.Sprintf("failed to invalidate user cache for user %d: %s", updatedUser.Id, err.Error()))
	}
	recordManageAuditFor(c, updatedUser.Id, "user.update", map[string]interface{}{
		"username": originUser.Username,
		"id":       updatedUser.Id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func AdminClearUserBinding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	bindingType := strings.ToLower(strings.TrimSpace(c.Param("binding_type")))
	if bindingType == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionSameLevel)
		return
	}

	if err := user.ClearBinding(bindingType); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, user.Id, "user.binding_clear", map[string]interface{}{
		"bindingType": bindingType,
		"username":    user.Username,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
	})
}

func UpdateSelf(c *gin.Context) {
	var requestData map[string]interface{}
	err := common.DecodeJson(c.Request.Body, &requestData)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 检查是否是用户设置更新请求 (sidebar_modules 或 language)
	if sidebarModules, sidebarExists := requestData["sidebar_modules"]; sidebarExists {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新sidebar_modules字段
		if sidebarModulesStr, ok := sidebarModules.(string); ok {
			currentSetting.SidebarModules = sidebarModulesStr
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
			return
		}

		common.ApiSuccessI18n(c, i18n.MsgUpdateSuccess, nil)
		return
	}

	// 检查是否是语言偏好更新请求
	language, langExists := requestData["language"]
	logLanguage, logLangExists := requestData["log_language"]
	if langExists || logLangExists {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新language字段
		if langStr, ok := language.(string); ok {
			currentSetting.Language = langStr
		}
		if logLangStr, ok := logLanguage.(string); ok {
			currentSetting.LogLanguage = model.NormalizeLogLanguage(logLangStr)
		}

		if err := model.UpdateUserSetting(user.Id, currentSetting); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
			return
		}

		common.ApiSuccessI18n(c, i18n.MsgUpdateSuccess, nil)
		return
	}

	// 检查是否是 setup_completed 或 feature_update_v1 更新请求
	setupCompleted, scExists := requestData["setup_completed"]
	featureUpdateV1, fuExists := requestData["feature_update_v1"]
	if scExists || fuExists {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		currentSetting := user.GetSetting()
		if scExists {
			if scStr, ok := setupCompleted.(string); ok {
				currentSetting.SetupCompleted = scStr
			}
		}
		if fuExists {
			if fuStr, ok := featureUpdateV1.(string); ok {
				currentSetting.FeatureUpdateV1 = fuStr
			}
		}

		user.SetSetting(currentSetting)
		if err := user.Update(false); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
			return
		}

		common.ApiSuccessI18n(c, i18n.MsgUpdateSuccess, nil)
		return
	}

	// 原有的用户信息更新逻辑
	var user model.User
	requestDataBytes, err := common.Marshal(requestData)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	err = common.Unmarshal(requestDataBytes, &user)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if user.Password == "" {
		user.Password = "$I_LOVE_U" // make Validator happy :)
	}
	if len(user.Username) > model.UserNameMaxLength {
		common.ApiErrorI18n(c, i18n.MsgUserUsernameTooLong, map[string]any{"Max": model.UserNameMaxLength})
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidInput)
		return
	}

	cleanUser := model.User{
		Id:          c.GetInt("id"),
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
	}
	if user.Password == "$I_LOVE_U" {
		user.Password = "" // rollback to what it should be
		cleanUser.Password = ""
	}
	// 检查用户名是否被占用（排除自身）
	if cleanUser.Username != "" {
		if model.IsUsernameAlreadyTaken(cleanUser.Username, cleanUser.Id) {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameTaken)
			return
		}
	}

	currentUser, err := model.GetUserById(cleanUser.Id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	isUsernameUpdate := cleanUser.Username != "" && cleanUser.Username != currentUser.Username
	isPasswordUpdate := user.Password != ""
	if isUsernameUpdate || isPasswordUpdate {
		if !middleware.ValidateTurnstileForScope(c, middleware.TurnstileScopeSensitiveUpdate) {
			return
		}
	}

	if isUsernameUpdate {
		currentSetting := currentUser.GetSetting()
		usernameChangeStatus := getUsernameChangeQuotaStatus(currentSetting, common.GetTimestamp())
		if usernameChangeStatus.Remaining <= 0 {
			common.ApiErrorMsg(c, fmt.Sprintf("用户名一年内最多只能修改%d次，请等待重置后再试", usernameChangeLimit))
			return
		}
		applyUsernameChangeWindow(&currentSetting, common.GetTimestamp())
		currentUser.SetSetting(currentSetting)
		cleanUser.Setting = currentUser.Setting
	}

	updatePassword, err := checkUpdatePassword(user.OriginalPassword, user.Password, currentUser.Id)
	if err != nil {
		if errors.Is(err, errUserPasswordUnset) {
			common.ApiErrorI18n(c, i18n.MsgUserPasswordUnset)
			return
		}
		if errors.Is(err, errOriginalPasswordFail) {
			common.ApiErrorI18n(c, i18n.MsgUserOriginalPasswordError)
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := cleanUser.Update(updatePassword); err != nil {
		common.ApiError(c, err)
		return
	}
	if isUsernameUpdate {
		model.RecordLog(
			cleanUser.Id,
			model.LogTypeSystem,
			fmt.Sprintf("用户自助修改用户名: %s -> %s", currentUser.Username, cleanUser.Username),
		)
	}
	if isPasswordUpdate {
		passwordLogContent := "用户自助修改密码"
		if currentUser.Password == "" {
			passwordLogContent = "用户自助设置密码"
		}
		model.RecordLog(cleanUser.Id, model.LogTypeSystem, passwordLogContent)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func checkUpdatePassword(originalPassword string, newPassword string, userId int) (updatePassword bool, err error) {
	if newPassword == "" {
		return
	}
	currentUser, err := model.GetUserById(userId, true)
	if err != nil {
		return false, err
	}

	// 密码不为空,需要验证原密码
	if currentUser.Password == "" {
		return false, errUserPasswordUnset
	}
	if !common.ValidatePasswordAndHash(originalPassword, currentUser.Password) {
		err = errOriginalPasswordFail
		return
	}
	updatePassword = true
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
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	err = model.HardDeleteUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, originUser.Id, "user.delete", map[string]interface{}{
		"username": originUser.Username,
		"id":       originUser.Id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteSelf(c *gin.Context) {
	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)

	if user.Role == common.RoleRootUser {
		common.ApiErrorI18n(c, i18n.MsgUserCannotDeleteRootUser)
		return
	}

	err := model.DeleteUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func CreateUser(c *gin.Context) {
	var user model.User
	err := common.DecodeJson(c.Request.Body, &user)
	user.Username = strings.TrimSpace(user.Username)
	if err != nil || user.Username == "" || user.Password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	if !common.IsValidateRole(user.Role) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}
	myRole := c.GetInt("role")
	if user.Role >= myRole {
		common.ApiErrorI18n(c, i18n.MsgUserCannotCreateHigherLevel)
		return
	}
	// Even for admin users, we cannot fully trust them!
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role, // 保持管理员设置的角色
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
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	cleanUser.FinishInsert(0)

	recordManageAuditFor(c, cleanUser.Id, "user.create", map[string]interface{}{
		"username": cleanUser.Username,
		"role":     cleanUser.Role,
	})
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
	Id              int    `json:"id"`
	Action          string `json:"action"`
	Value           int    `json:"value"`
	Mode            string `json:"mode"`
	DisableReason   string `json:"disable_reason"`
	DurationMinutes int    `json:"duration_minutes"`
}

// ManageUser Only admin user can do this
func ManageUser(c *gin.Context) {
	var req ManageRequest
	err := common.DecodeJson(c.Request.Body, &req)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	user := model.User{
		Id: req.Id,
	}
	// Fill attributes
	model.DB.Unscoped().Where(&user).First(&user)
	if user.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	didDisableTransition := false
	switch req.Action {
	case "disable":
		disableReason := strings.TrimSpace(req.DisableReason)
		if len([]rune(disableReason)) > model.DisableReasonMaxLength {
			common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": fmt.Sprintf("disable_reason max %d", model.DisableReasonMaxLength)})
			return
		}
		if req.DurationMinutes < 0 || req.DurationMinutes > model.UserBanMaxMinutes {
			common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": fmt.Sprintf("duration_minutes must be 0 or between 1 and %d", model.UserBanMaxMinutes)})
			return
		}
		user.Status = common.UserStatusDisabled
		user.DisableReason = disableReason
		user.DisabledUntil = 0
		if req.DurationMinutes > 0 {
			user.DisabledUntil = common.GetTimestamp() + int64(req.DurationMinutes)*60
		}
		if user.Role == common.RoleRootUser {
			common.ApiErrorI18n(c, i18n.MsgUserCannotDisableRootUser)
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
		user.DisableReason = ""
		user.DisabledUntil = 0
	case "delete":
		if user.Role == common.RoleRootUser {
			common.ApiErrorI18n(c, i18n.MsgUserCannotDeleteRootUser)
			return
		}
		if err := user.Delete(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		// 删除用户后，强制清理 Redis 中所有该用户令牌的缓存，
		// 避免已缓存的令牌在 TTL 过期前仍能通过 TokenAuth 校验。
		if err := model.InvalidateUserTokensCache(user.Id); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
		}
	case "promote":
		if myRole != common.RoleRootUser {
			common.ApiErrorI18n(c, i18n.MsgUserAdminCannotPromote)
			return
		}
		if user.Role >= common.RoleAdminUser {
			common.ApiErrorI18n(c, i18n.MsgUserAlreadyAdmin)
			return
		}
		user.Role = common.RoleAdminUser
	case "demote":
		if user.Role == common.RoleRootUser {
			common.ApiErrorI18n(c, i18n.MsgUserCannotDemoteRootUser)
			return
		}
		if user.Role == common.RoleCommonUser {
			common.ApiErrorI18n(c, i18n.MsgUserAlreadyCommon)
			return
		}
		user.Role = common.RoleCommonUser
	case "add_quota":
		switch req.Mode {
		case "add":
			if req.Value <= 0 {
				common.ApiErrorI18n(c, i18n.MsgUserQuotaChangeZero)
				return
			}
			if err := model.IncreaseUserQuota(user.Id, req.Value, true); err != nil {
				common.ApiError(c, err)
				return
			}
			common.ResetQuotaNotificationSendLocks(user.Id, service.BillingSourceWallet, 0)
			recordManageAuditFor(c, user.Id, "user.quota_add", map[string]interface{}{
				"quota": logger.LogQuota(req.Value),
			})
		case "subtract":
			if req.Value <= 0 {
				common.ApiErrorI18n(c, i18n.MsgUserQuotaChangeZero)
				return
			}
			if err := model.DecreaseUserQuota(user.Id, req.Value, true); err != nil {
				common.ApiError(c, err)
				return
			}
			recordManageAuditFor(c, user.Id, "user.quota_subtract", map[string]interface{}{
				"quota": logger.LogQuota(req.Value),
			})
		case "override":
			oldQuota := user.Quota
			if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("quota", req.Value).Error; err != nil {
				common.ApiError(c, err)
				return
			}
			if req.Value > oldQuota {
				common.ResetQuotaNotificationSendLocks(user.Id, service.BillingSourceWallet, 0)
			}
			recordManageAuditFor(c, user.Id, "user.quota_override", map[string]interface{}{
				"from": logger.LogQuota(oldQuota),
				"to":   logger.LogQuota(req.Value),
			})
		default:
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
		})
		return
	}

	switch req.Action {
	case "disable":
		result := model.DB.Model(&model.User{}).
			Where("id = ? AND status <> ?", user.Id, common.UserStatusDisabled).
			Updates(map[string]any{
				"status":         user.Status,
				"disable_reason": user.DisableReason,
				"disabled_until": user.DisabledUntil,
			})
		if result.Error != nil {
			common.ApiError(c, result.Error)
			return
		}
		didDisableTransition = result.RowsAffected > 0
		if !didDisableTransition {
			if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).
				Updates(map[string]any{
					"disable_reason": user.DisableReason,
					"disabled_until": user.DisabledUntil,
				}).Error; err != nil {
				common.ApiError(c, err)
				return
			}
		}
	case "enable":
		if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Updates(map[string]any{
			"status":         user.Status,
			"disable_reason": user.DisableReason,
			"disabled_until": user.DisabledUntil,
		}).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	case "delete":
	default:
		if err := user.Update(false); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	// 启用 / 禁用直接更新数据库，需要在此失效用户缓存；角色调整由 User.Update 统一失效。
	if req.Action == "disable" || req.Action == "enable" {
		if err := model.InvalidateUserCache(user.Id); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate user cache for user %d: %s", user.Id, err.Error()))
		}
	}
	// 权限或状态变化后同步失效该用户的全部令牌缓存。
	if req.Action == "disable" || req.Action == "enable" || req.Action == "promote" || req.Action == "demote" {
		if err := model.InvalidateUserTokensCache(user.Id); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
		}
	}
	recordManageAuditFor(c, user.Id, "user.manage", map[string]interface{}{
		"action":           req.Action,
		"username":         user.Username,
		"id":               user.Id,
		"duration_minutes": req.DurationMinutes,
		"disabled_until":   user.DisabledUntil,
	})
	if didDisableTransition {
		service.NotifyAccountDisabled(user)
	}
	clearUser := model.User{
		Role:          user.Role,
		Status:        user.Status,
		DisableReason: user.DisableReason,
		DisabledUntil: user.DisabledUntil,
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    clearUser,
	})
	return
}

type emailBindRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func EmailBind(c *gin.Context) {
	var req emailBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, errors.New("invalid request body"))
		return
	}
	email := req.Email
	email = model.NormalizeEmail(email)
	code := req.Code
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiError(c, errors.New("无效的邮箱地址"))
		return
	}
	if err := validateEmailDomainPolicy(email, common.EmailDomainRestrictionForBindingEnabled); err != nil {
		common.ApiError(c, err)
		return
	}
	if !common.VerifyCodeWithKey(email, code, common.EmailVerificationPurpose) {
		common.ApiErrorI18n(c, i18n.MsgUserVerificationCodeError)
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{
		Id: id.(int),
	}
	err := user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.BindEmailToUser(&user, email); err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type topUpRequest struct {
	Key          string `json:"key"`
	PurchaseMode string `json:"purchase_mode"`
}

var (
	topUpLocks      sync.Map
	topUpCreateLock sync.Mutex
)

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
		common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
		return
	}

	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		common.ApiErrorI18n(c, i18n.MsgUserTopUpProcessing)
		return
	}
	defer lock.Unlock()
	req := topUpRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.RedeemWithPurchaseMode(req.Key, id, req.PurchaseMode)
	if err != nil {
		switch {
		case errors.Is(err, model.ErrRedeemFailed):
			common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
			return
		case errors.Is(err, model.ErrRedemptionInvalid):
			common.ApiErrorI18n(c, i18n.MsgRedemptionInvalid)
			return
		case errors.Is(err, model.ErrRedemptionUsed):
			common.ApiErrorI18n(c, i18n.MsgRedemptionUsed)
			return
		case errors.Is(err, model.ErrRedemptionExpired):
			common.ApiErrorI18n(c, i18n.MsgRedemptionExpired)
			return
		case errors.Is(err, model.ErrRedemptionNotProvided):
			common.ApiErrorI18n(c, i18n.MsgRedemptionNotProvided)
			return
		case errors.Is(err, model.ErrRedemptionExhausted):
			common.ApiErrorI18n(c, i18n.MsgRedemptionExhausted)
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

type UpdateUserSettingRequest struct {
	NotificationsEnabled             *bool           `json:"notifications_enabled,omitempty"`
	NotificationCategories           map[string]bool `json:"notification_categories,omitempty"`
	QuotaWarningType                 string          `json:"notify_type"`
	QuotaWarningThreshold            float64         `json:"quota_warning_threshold"`
	WebhookUrl                       string          `json:"webhook_url,omitempty"`
	WebhookSecret                    string          `json:"webhook_secret,omitempty"`
	NotificationEmail                string          `json:"notification_email,omitempty"`
	BarkUrl                          string          `json:"bark_url,omitempty"`
	GotifyUrl                        string          `json:"gotify_url,omitempty"`
	GotifyToken                      string          `json:"gotify_token,omitempty"`
	GotifyPriority                   int             `json:"gotify_priority,omitempty"`
	UpstreamModelUpdateNotifyEnabled *bool           `json:"upstream_model_update_notify_enabled,omitempty"`
	AcceptUnsetModelRatioModel       bool            `json:"accept_unset_model_ratio_model"`
	RecordIpLog                      bool            `json:"record_ip_log"`
	LogLanguage                      *string         `json:"log_language,omitempty"`
}

func UpdateUserSetting(c *gin.Context) {
	var req UpdateUserSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existingSettings := user.GetSetting()
	if req.NotificationsEnabled != nil {
		existingSettings.NotificationsEnabled = req.NotificationsEnabled
	}
	if req.NotificationCategories != nil {
		for category := range req.NotificationCategories {
			switch category {
			case "quota", "topup", "subscription", "security", "system":
			default:
				common.ApiErrorI18n(c, i18n.MsgInvalidParams)
				return
			}
		}
		existingSettings.NotificationCategories = req.NotificationCategories
	}

	if existingSettings.NotificationsEnabled == nil || *existingSettings.NotificationsEnabled {
		// 验证预警类型
		if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark && req.QuotaWarningType != dto.NotifyTypeGotify {
			common.ApiErrorI18n(c, i18n.MsgSettingInvalidType)
			return
		}

		// 验证预警阈值
		if existingSettings.AllowsNotification("quota") && req.QuotaWarningThreshold <= 0 {
			common.ApiErrorI18n(c, i18n.MsgQuotaThresholdGtZero)
			return
		}

		// 如果是webhook类型,验证webhook地址
		if req.QuotaWarningType == dto.NotifyTypeWebhook {
			if req.WebhookUrl == "" {
				common.ApiErrorI18n(c, i18n.MsgSettingWebhookEmpty)
				return
			}
			// 验证URL格式
			if _, err := url.ParseRequestURI(req.WebhookUrl); err != nil {
				common.ApiErrorI18n(c, i18n.MsgSettingWebhookInvalid)
				return
			}
		}

		// 如果是邮件类型，验证邮箱地址
		if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
			// 验证邮箱格式
			if !strings.Contains(req.NotificationEmail, "@") {
				common.ApiErrorI18n(c, i18n.MsgSettingEmailInvalid)
				return
			}
		}

		// 如果是Bark类型，验证Bark URL
		if req.QuotaWarningType == dto.NotifyTypeBark {
			if req.BarkUrl == "" {
				common.ApiErrorI18n(c, i18n.MsgSettingBarkUrlEmpty)
				return
			}
			// 验证URL格式
			if _, err := url.ParseRequestURI(req.BarkUrl); err != nil {
				common.ApiErrorI18n(c, i18n.MsgSettingBarkUrlInvalid)
				return
			}
			// 检查是否是HTTP或HTTPS
			if !strings.HasPrefix(req.BarkUrl, "https://") && !strings.HasPrefix(req.BarkUrl, "http://") {
				common.ApiErrorI18n(c, i18n.MsgSettingUrlMustHttp)
				return
			}
		}

		// 如果是Gotify类型，验证Gotify URL和Token
		if req.QuotaWarningType == dto.NotifyTypeGotify {
			if req.GotifyUrl == "" {
				common.ApiErrorI18n(c, i18n.MsgSettingGotifyUrlEmpty)
				return
			}
			if req.GotifyToken == "" {
				common.ApiErrorI18n(c, i18n.MsgSettingGotifyTokenEmpty)
				return
			}
			// 验证URL格式
			if _, err := url.ParseRequestURI(req.GotifyUrl); err != nil {
				common.ApiErrorI18n(c, i18n.MsgSettingGotifyUrlInvalid)
				return
			}
			// 检查是否是HTTP或HTTPS
			if !strings.HasPrefix(req.GotifyUrl, "https://") && !strings.HasPrefix(req.GotifyUrl, "http://") {
				common.ApiErrorI18n(c, i18n.MsgSettingUrlMustHttp)
				return
			}
		}

	}
	upstreamModelUpdateNotifyEnabled := existingSettings.UpstreamModelUpdateNotifyEnabled
	if user.Role >= common.RoleAdminUser && req.UpstreamModelUpdateNotifyEnabled != nil {
		upstreamModelUpdateNotifyEnabled = *req.UpstreamModelUpdateNotifyEnabled
	}

	// 构建设置
	settings := dto.UserSetting{
		NotificationsEnabled:             existingSettings.NotificationsEnabled,
		NotificationCategories:           existingSettings.NotificationCategories,
		NotifyType:                       req.QuotaWarningType,
		QuotaWarningThreshold:            req.QuotaWarningThreshold,
		UpstreamModelUpdateNotifyEnabled: upstreamModelUpdateNotifyEnabled,
		AcceptUnsetRatioModel:            req.AcceptUnsetModelRatioModel,
		RecordIpLog:                      req.RecordIpLog || common.ForceRecordIpLogEnabled,
		LogLanguage:                      existingSettings.LogLanguage,
		Language:                         existingSettings.Language,
		SidebarModules:                   existingSettings.SidebarModules,
		BillingPreference:                existingSettings.BillingPreference,
		SetupCompleted:                   existingSettings.SetupCompleted,
		FeatureUpdateV1:                  existingSettings.FeatureUpdateV1,
		UsernameChangeWindowStart:        existingSettings.UsernameChangeWindowStart,
		UsernameChangeCount:              existingSettings.UsernameChangeCount,
	}
	if req.LogLanguage != nil {
		settings.LogLanguage = model.NormalizeLogLanguage(*req.LogLanguage)
	}

	// 如果是webhook类型,添加webhook相关设置
	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		settings.WebhookUrl = req.WebhookUrl
		if req.WebhookSecret != "" {
			settings.WebhookSecret = req.WebhookSecret
		}
	}

	// 如果提供了通知邮箱，添加到设置中
	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		settings.NotificationEmail = req.NotificationEmail
	}

	// 如果是Bark类型，添加Bark URL到设置中
	if req.QuotaWarningType == dto.NotifyTypeBark {
		settings.BarkUrl = req.BarkUrl
	}

	// 如果是Gotify类型，添加Gotify配置到设置中
	if req.QuotaWarningType == dto.NotifyTypeGotify {
		settings.GotifyUrl = req.GotifyUrl
		settings.GotifyToken = req.GotifyToken
		// Gotify优先级范围0-10，超出范围则使用默认值5
		if req.GotifyPriority < 0 || req.GotifyPriority > 10 {
			settings.GotifyPriority = 5
		} else {
			settings.GotifyPriority = req.GotifyPriority
		}
	}

	// 更新用户设置
	if err := model.UpdateUserSetting(user.Id, settings); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgSettingSaved, nil)
}
