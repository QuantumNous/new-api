package controller

import (
	"encoding/json"
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
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxAdsAttributionLength = 4096
const consoleSessionHintCookieName = "flatkey_console_session_hint"
const consoleSessionHintMaxAge = 60 * 60 * 24 * 30

var allowedAdsAttributionKeys = map[string]struct{}{
	"aff": {}, "fbclid": {}, "gad_campaignid": {}, "gad_source": {},
	"gbraid": {}, "gclid": {}, "lng": {}, "msclkid": {}, "ttclid": {},
	"wbraid": {}, "yclid": {}, "landing_path": {}, "captured_at": {},
	"first_landing_path": {}, "first_captured_at": {}, "referrer": {},
	"expires_at": {}, "experiment": {}, "experiment_id": {},
	"source_type": {}, "source": {}, "medium": {}, "campaign": {},
	"keyword": {}, "is_paid": {}, "rule_version": {},
	"account": {}, "campaign_id": {}, "ad_group": {}, "ad_group_id": {},
	"creative": {}, "creative_id": {}, "placement": {}, "network": {},
	"device": {}, "market": {}, "country": {}, "match_type": {},
	"target_id": {}, "location_id": {}, "loc_physical_ms": {}, "language": {},
}

func isAllowedAdsAttributionKey(key string) bool {
	if _, ok := allowedAdsAttributionKeys[key]; ok {
		return true
	}
	return strings.HasPrefix(key, "utm_") || strings.HasPrefix(key, "hsa_")
}

func sanitizeAdsAttribution(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > maxAdsAttributionLength {
		return ""
	}
	var payload map[string]any
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		return ""
	}
	cleaned := make(map[string]string, len(payload))
	for key, value := range payload {
		key = strings.TrimSpace(key)
		if key == "" || len(key) > 64 || !isAllowedAdsAttributionKey(key) {
			continue
		}
		stringValue, ok := value.(string)
		if !ok {
			continue
		}
		stringValue = strings.TrimSpace(stringValue)
		if stringValue == "" {
			continue
		}
		if len(stringValue) > 512 {
			stringValue = stringValue[:512]
		}
		cleaned[key] = stringValue
	}
	if len(cleaned) == 0 {
		return ""
	}
	bytes, err := common.Marshal(cleaned)
	if err != nil {
		return ""
	}
	return string(bytes)
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordLoginDisabled)
		return
	}
	var loginRequest LoginRequest
	err := json.NewDecoder(c.Request.Body).Decode(&loginRequest)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
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
		case errors.Is(err, model.ErrUserEmptyCredentials):
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		default:
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
		}
		return
	}

	// 检查是否启用2FA
	if model.IsTwoFAEnabled(user.Id) {
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

// primaryAcceptLanguage extracts the first language tag from an
// Accept-Language header ("zh-CN,zh;q=0.9,en;q=0.8" -> "zh-CN").
func primaryAcceptLanguage(header string) string {
	first := strings.TrimSpace(strings.SplitN(header, ",", 2)[0])
	if i := strings.IndexByte(first, ';'); i >= 0 {
		first = strings.TrimSpace(first[:i])
	}
	if len(first) > 32 {
		first = first[:32]
	}
	return first
}

func setupLoginSession(user *model.User, c *gin.Context, isNewUser ...bool) (map[string]any, error) {
	model.UpdateUserLastLoginAt(user.Id)
	if ip := c.ClientIP(); ip != "" && ip != user.LastLoginIp {
		model.UpdateUserLastLoginIp(user.Id, ip)
	}
	if lang := primaryAcceptLanguage(c.GetHeader("Accept-Language")); lang != "" && lang != user.BrowserLang {
		model.UpdateUserBrowserLang(user.Id, lang)
	}
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	err := session.Save()
	if err != nil {
		return nil, err
	}
	setConsoleSessionHintCookie(c, true)
	data := map[string]any{
		"id":            user.Id,
		"username":      user.Username,
		"display_name":  user.DisplayName,
		"role":          user.Role,
		"status":        user.Status,
		"group":         user.Group,
		"is_enterprise": user.IsEnterprise,
	}
	// Surfaced only for brand-new registrations (OAuth sign-up and password-register
	// auto-login) so the frontend can trigger first-login onboarding. Omitted for
	// normal logins (back-compat).
	if len(isNewUser) > 0 && isNewUser[0] {
		data["is_new_user"] = true
	}
	return data, nil
}

// setup session & cookies and then return user info
func setupLogin(user *model.User, c *gin.Context, isNewUser ...bool) {
	data, err := setupLoginSession(user, c, isNewUser...)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data":    data,
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
	setConsoleSessionHintCookie(c, false)
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
	})
}

func setConsoleSessionHintCookie(c *gin.Context, enabled bool) {
	maxAge := consoleSessionHintMaxAge
	value := "1"
	if !enabled {
		maxAge = -1
		value = ""
	}
	for _, domain := range sharedCookieHintDomainsForRequest(c) {
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     consoleSessionHintCookieName,
			Value:    value,
			Path:     "/",
			Domain:   domain,
			MaxAge:   maxAge,
			HttpOnly: false,
			Secure:   common.SessionCookieSecure,
			SameSite: http.SameSiteLaxMode,
		})
	}
}

func sharedCookieHintDomainsForRequest(c *gin.Context) []string {
	if configured := strings.TrimSpace(common.CookieSessionDomain); configured != "" {
		return []string{"", configured}
	}
	host := strings.TrimSpace(c.Request.Host)
	if host == "" {
		return []string{""}
	}
	if i := strings.IndexByte(host, ':'); i >= 0 {
		host = host[:i]
	}
	host = strings.ToLower(host)
	if host == "flatkey.ai" || strings.HasSuffix(host, ".flatkey.ai") {
		return []string{"", ".flatkey.ai"}
	}
	return []string{""}
}

// ensureDefaultUserToken idempotently creates the initial API key for a newly
// registered user so that BOTH email and OAuth signups land with a working key
// (issue #406 — the majority sign up via Google, and previously only email
// registration created a default token, leaving OAuth users in an empty backend).
//
// Idempotent and multi-node safe: EnsureInitialUserToken takes a SELECT ... FOR
// UPDATE lock on the user row and skips creation when the user already has any
// token, so concurrent OAuth callbacks (or a retried register) create at most one
// key. A no-op when the default-token feature is disabled.
func ensureDefaultUserToken(user *model.User) error {
	if !constant.GenerateDefaultToken || user == nil || user.Id == 0 {
		return nil
	}
	// Unverified accounts must not receive any token — including the initial
	// one — when email verification is enforced. They verify first and then get
	// the default token on the next login/ensure path.
	if operation_setting.RequireEmailVerificationForTokens() && user.Email != "" && user.EmailVerifiedAt == 0 {
		return nil
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.SysLog("failed to generate default token key: " + err.Error())
		return err
	}
	token := model.Token{
		UserId:             user.Id,
		Name:               user.Username + "的初始令牌",
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        -1,     // 永不过期
		RemainQuota:        500000, // 示例额度
		UnlimitedQuota:     true,
		ModelLimitsEnabled: false,
	}
	if user.Group == plgGroup {
		token.Group = plgGroup
		token.CrossGroupRetry = false
	} else if setting.DefaultUseAutoGroup {
		token.Group = "auto"
		token.CrossGroupRetry = true
	}
	if _, _, err := model.EnsureInitialUserToken(user.Id, token, operation_setting.GetMaxUserTokens()); err != nil && !errors.Is(err, model.ErrUserTokenLimitReached) {
		common.SysLog("failed to ensure default token for user " + strconv.Itoa(user.Id) + ": " + err.Error())
		return err
	}
	return nil
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
	err := json.NewDecoder(c.Request.Body).Decode(&user)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	user.Email = strings.TrimSpace(user.Email)
	emailDecision, err := evaluateRegistrationEmail(user.Email)
	if err != nil {
		respondRegistrationEmailError(c, err)
		return
	}
	verifiedByGrant := false
	verifiedByCode := false
	if common.EmailVerificationEnabled {
		if user.Email == "" {
			common.ApiErrorI18n(c, i18n.MsgUserEmailVerificationRequired)
			return
		}
		verifiedByGrant = registrationEmailGrantMatches(c, user.Email)
		verifiedByCode = user.VerificationCode != "" && common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose)
		if !verifiedByGrant && user.VerificationCode == "" {
			common.ApiErrorI18n(c, i18n.MsgUserEmailVerificationRequired)
			return
		}
		if !verifiedByGrant && !verifiedByCode {
			common.ApiErrorI18n(c, i18n.MsgUserVerificationCodeError)
			return
		}
		user.EmailVerifiedAt = common.GetTimestamp()
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, user.Email)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		common.SysLog(fmt.Sprintf("CheckUserExistOrDeleted error: %v", err))
		return
	}
	if exist {
		common.ApiErrorI18n(c, i18n.MsgUserExists)
		return
	}
	affCode := user.AffCode // this code is the inviter's code, not the user's own code
	inviterId, _ := model.GetUserIdByAffCode(affCode)
	cleanUser := model.User{
		Username:        user.Username,
		Password:        user.Password,
		DisplayName:     user.Username,
		InviterId:       inviterId,
		Role:            common.RoleCommonUser, // 明确设置角色为普通用户
		AdsAttribution:  sanitizeAdsAttribution(user.AdsAttribution),
		EmailVerifiedAt: user.EmailVerifiedAt,
	}
	if language, ok := dto.NormalizeUserLanguagePreference(i18n.GetLangFromContext(c)); ok {
		cleanUser.SetSetting(dto.UserSetting{Language: language})
	}
	cleanUser.Email = user.Email
	cleanUser.EmailDomain = emailDecision.Domain
	registrationEmailGrant := ""
	registrationEmailReservationOwner := ""
	grantReserved := false
	if common.EmailVerificationEnabled && verifiedByGrant {
		registrationEmailGrant = registrationEmailGrantFromSession(c)
		registrationEmailReservationOwner, grantReserved = common.ReserveRegistrationEmailGrant(registrationEmailGrant, user.Email)
		if !grantReserved && !verifiedByCode {
			common.ApiErrorI18n(c, i18n.MsgUserVerificationCodeError)
			return
		}
	}
	if _, err := model.RegisterUserWithDomainRisk(&cleanUser, inviterId, c.ClientIP(), emailDecision.Policy, nil); err != nil {
		if grantReserved {
			common.RollbackRegistrationEmailGrantReservation(registrationEmailGrant, user.Email, registrationEmailReservationOwner)
		}
		respondRegistrationEmailError(c, err)
		return
	}
	if grantReserved {
		common.CommitRegistrationEmailGrantReservation(registrationEmailGrant, user.Email, registrationEmailReservationOwner)
	}
	cleanUser.FinalizeOAuthUserCreation(inviterId)

	// 获取插入后的用户ID
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
		return
	}
	// 生成默认令牌（幂等；与 OAuth 注册共用同一路径，见 ensureDefaultUserToken / issue #406）
	if err := ensureDefaultUserToken(&insertedUser); err != nil {
		common.ApiErrorI18n(c, i18n.MsgCreateDefaultTokenErr)
		return
	}

	gaClientID, gaSessionID := service.ResolveGAIdentifiers(c.Request, user.GAClientID, user.GASessionID)
	sendSignUpSuccessGA(c.Request.Context(), insertedUser.Id, inviterId, "password", gaClientID, gaSessionID)
	clearRegistrationEmailGrantSession(c)

	// Auto-login the freshly registered user so they land directly in the console
	// (e.g. the Playground onboarding) without having to sign in again. setupLogin
	// establishes the session cookie AND writes the JSON success response, marking
	// is_new_user=true so the frontend can trigger the first-run onboarding flow.
	setupLogin(&insertedUser, c, true)
	return
}

func GetAllUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.GetAllUsers(pageInfo)
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
	language := ""
	if languageParam := c.Query("language"); languageParam != "" {
		normalizedLanguage, ok := dto.NormalizeUserLanguagePreference(languageParam)
		if !ok {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		language = normalizedLanguage
	}
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
	paid := false
	if paidStr := c.Query("paid"); paidStr == "1" || paidStr == "true" {
		paid = true
	}
	var emailVerified *bool
	if evStr := c.Query("email_verified"); evStr == "1" || evStr == "true" {
		v := true
		emailVerified = &v
	} else if evStr == "0" || evStr == "false" {
		v := false
		emailVerified = &v
	}
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.SearchUsers(keyword, group, role, status, language, paid, emailVerified, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
	return
}

// GetRecallCandidates surfaces activated-but-unpaid, low-balance users for 1:1
// re-engagement outreach — productizes the manual "active but never topped up" recall
// list so ops/growth can target the users most likely to convert to a first top-up.
// Query params: min_calls (default 1), max_balance in USD (default 1), limit (default
// 100, max 1000). Admin-only; read-only.
func GetRecallCandidates(c *gin.Context) {
	minCalls := 1
	if v := c.Query("min_calls"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			minCalls = n
		}
	}
	maxBalanceUSD := 1.0
	if v := c.Query("max_balance"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 {
			maxBalanceUSD = f
		}
	}
	limit := 100
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	maxQuota := int(maxBalanceUSD * common.QuotaPerUnit)
	users, err := model.GetRecallCandidates(minCalls, maxQuota, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, users)
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
	AmountUSD *float64 `json:"amount_usd"`
	Quota     *int     `json:"quota"`
}

func (request TransferAffQuotaRequest) quotaToTransfer() (int, error) {
	if request.AmountUSD != nil && request.Quota != nil {
		return 0, errors.New("provide either amount_usd or quota, not both")
	}
	if request.AmountUSD != nil {
		return invitationQuotaFromUSD(*request.AmountUSD)
	}
	if request.Quota != nil {
		return *request.Quota, nil
	}
	return 0, errors.New("amount_usd is required")
}

func TransferAffQuota(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if common.InviteRewardSubscriptionMode {
		common.ApiErrorMsg(c, "invite rewards are only available as subscription discounts")
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
	quota, err := tran.quotaToTransfer()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = user.TransferAffQuotaToQuota(quota)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserTransferFailed, map[string]any{"Error": err.Error()})
		return
	}
	common.ApiSuccessI18n(c, i18n.MsgUserTransferSuccess, nil)
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
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
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
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Hide admin remarks: set to empty to trigger omitempty tag, ensuring the remark field is not included in JSON returned to regular users
	user.Remark = ""

	// 计算用户权限信息
	permissions := calculateUserPermissions(userRole)

	// 获取用户设置并提取sidebar_modules
	userSetting := user.GetSetting()

	// 构建响应数据，包含用户信息和权限
	responseData := map[string]interface{}{
		"id":                   user.Id,
		"username":             user.Username,
		"display_name":         user.DisplayName,
		"role":                 user.Role,
		"status":               user.Status,
		"email":                user.Email,
		"github_id":            user.GitHubId,
		"discord_id":           user.DiscordId,
		"oidc_id":              user.OidcId,
		"google_id":            user.GoogleId,
		"wechat_id":            user.WeChatId,
		"telegram_id":          user.TelegramId,
		"group":                user.Group,
		"quota":                user.Quota,
		"used_quota":           user.UsedQuota,
		"request_count":        user.RequestCount,
		"aff_code":             user.AffCode,
		"aff_count":            user.AffCount,
		"aff_quota":            user.AffQuota,
		"aff_history_quota":    user.AffHistoryQuota,
		"inviter_id":           user.InviterId,
		"linux_do_id":          user.LinuxDOId,
		"setting":              user.Setting,
		"stripe_customer":      user.StripeCustomer,
		"stripe_card_bound":    user.StripeCardBound,
		"new_user_bonus_given": user.NewUserBonusGiven,
		"is_enterprise":        user.IsEnterprise,
		"sidebar_modules":      userSetting.SidebarModules, // 正确提取sidebar_modules字段
		"permissions":          permissions,                // 新增权限字段
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    responseData,
	})
	return
}

func GetAnalyticsSelf(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	session := sessions.Default(c)
	id, idOk := session.Get("id").(int)
	username, usernameOk := session.Get("username").(string)
	role, roleOk := session.Get("role").(int)
	status, statusOk := session.Get("status").(int)
	if !idOk || id <= 0 || !usernameOk || strings.TrimSpace(username) == "" || !roleOk || !statusOk || !common.IsValidateRole(role) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn),
		})
		return
	}
	if status == common.UserStatusDisabled {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserBanned),
		})
		return
	}
	group, _ := session.Get("group").(string)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"id":       id,
			"username": username,
			"role":     role,
			"status":   status,
			"group":    group,
		},
	})
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
				"setting": false, // 管理员不能访问系统设置
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
		"personal": true,
	}

	// 管理员区域 - 根据角色决定
	if userRole == common.RoleAdminUser {
		// 管理员可以访问管理员区域，但不能访问系统设置
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    false, // 管理员不能访问系统设置
		}
	} else if userRole == common.RoleRootUser {
		// 超级管理员可以访问所有功能
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    true,
		}
	}
	// 普通用户不包含admin区域

	// 转换为JSON字符串
	configBytes, err := json.Marshal(defaultConfig)
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
	group := strings.TrimSpace(c.Query("group"))
	if group != "" {
		if _, ok := groups[group]; !ok {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    []string{},
			})
			return
		}
		if group == "auto" {
			var models []string
			for _, autoGroup := range service.GetUserAutoGroup(user.Group) {
				for _, g := range model.GetGroupEnabledModels(autoGroup) {
					if !common.StringsContains(models, g) {
						models = append(models, g)
					}
				}
			}
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    models,
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
	var models []string
	for group := range groups {
		for _, g := range model.GetGroupEnabledModels(group) {
			if !common.StringsContains(models, g) {
				models = append(models, g)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
	return
}

// applyAdminEmailTrust marks an account's email as verified when an admin sets
// or changes it. Admin editing is a trust signal (the admin manages the account
// directly), so managed/enterprise accounts must not be blocked by the
// email-verification gate afterwards. Clearing the email leaves verification
// as-is (email-less accounts are exempt from the gate anyway).
func applyAdminEmailTrust(originUser *model.User, updatedUser *model.User) {
	if updatedUser == nil || originUser == nil {
		return
	}
	if updatedUser.Email != "" && updatedUser.Email != originUser.Email {
		updatedUser.EmailVerifiedAt = common.GetTimestamp()
	}
}

func UpdateUser(c *gin.Context) {
	var updatedUser model.User
	err := common.DecodeJson(c.Request.Body, &updatedUser)
	if err != nil || updatedUser.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if updatedUser.Password == "" {
		updatedUser.Password = "$I_LOVE_U" // make Validator happy :)
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
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, originUser.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionHigherLevel)
		return
	}
	if !canManageTargetRole(myRole, updatedUser.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserCannotCreateHigherLevel)
		return
	}
	if updatedUser.Password == "$I_LOVE_U" {
		updatedUser.Password = "" // rollback to what it should be
	}
	updatePassword := updatedUser.Password != ""
	// An admin editing a user is a trust signal: if the admin sets/changes the
	// account email, mark it verified so enterprise/managed accounts are never
	// blocked by the email-verification gate on token creation or API usage.
	applyAdminEmailTrust(originUser, &updatedUser)
	emailChanged := updatedUser.Email != "" && updatedUser.Email != originUser.Email
	if err := updatedUser.Edit(updatePassword); err != nil {
		common.ApiError(c, err)
		return
	}

	// Edit() deliberately omits email and email_verified_at. Apply them here in
	// the admin context only: a changed email is trusted (verified), and the
	// explicit set_email_verified control flips verification on/off without
	// touching the email. Missing control leaves the existing value untouched.
	emailUpdates := map[string]interface{}{}
	if emailChanged {
		emailUpdates["email"] = updatedUser.Email
		emailUpdates["email_verified_at"] = updatedUser.EmailVerifiedAt
	} else if updatedUser.SetEmailVerified != nil {
		if *updatedUser.SetEmailVerified {
			emailUpdates["email_verified_at"] = common.GetTimestamp()
		} else {
			emailUpdates["email_verified_at"] = 0
		}
	}
	if len(emailUpdates) > 0 {
		if err := model.DB.Model(&originUser).Updates(emailUpdates).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.InvalidateUserCache(originUser.Id); err != nil {
			common.SysError("failed to invalidate user cache after admin email update: " + err.Error())
		}
	}
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

	model.RecordLog(user.Id, model.LogTypeManage, fmt.Sprintf("admin cleared %s binding for user %s", bindingType, user.Username))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
	})
}

func UpdateSelf(c *gin.Context) {
	var requestData map[string]interface{}
	err := json.NewDecoder(c.Request.Body).Decode(&requestData)
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

		// 保存更新后的设置
		user.SetSetting(currentSetting)
		if err := user.Update(false); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
			return
		}

		common.ApiSuccessI18n(c, i18n.MsgUpdateSuccess, nil)
		return
	}

	// 检查是否是语言偏好更新请求
	if language, langExists := requestData["language"]; langExists {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新language字段
		langStr, ok := language.(string)
		if !ok {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		normalizedLanguage, ok := dto.NormalizeUserLanguagePreference(langStr)
		if !ok {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		currentSetting.Language = normalizedLanguage

		// 保存更新后的设置
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
	requestDataBytes, err := json.Marshal(requestData)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	err = json.Unmarshal(requestDataBytes, &user)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if user.Password == "" {
		user.Password = "$I_LOVE_U" // make Validator happy :)
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
	updatePassword, err := checkUpdatePassword(user.OriginalPassword, user.Password, cleanUser.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := cleanUser.Update(updatePassword); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func checkUpdatePassword(originalPassword string, newPassword string, userId int) (updatePassword bool, err error) {
	var currentUser *model.User
	currentUser, err = model.GetUserById(userId, true)
	if err != nil {
		return
	}

	// 密码不为空,需要验证原密码
	// 支持第一次账号绑定时原密码为空的情况
	if !common.ValidatePasswordAndHash(originalPassword, currentUser.Password) && currentUser.Password != "" {
		err = fmt.Errorf("原密码错误")
		return
	}
	if newPassword == "" {
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
	// Admin-created accounts are trusted: carry the email (if provided) and mark
	// it verified so the account can use tokens/API right away.
	cleanUser.Email = strings.TrimSpace(user.Email)
	if cleanUser.Email != "" {
		cleanUser.EmailVerifiedAt = common.GetTimestamp()
	}
	if err := cleanUser.Insert(0); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type ManageRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
	Value  int    `json:"value"`
	Mode   string `json:"mode"`
}

// BatchVerifyEmail marks a set of users' email as verified in one request.
// Admin-only; read the ids from the JSON body. Used by the users table's bulk
// action bar so admins can pass email verification for many accounts at once.
func BatchVerifyEmail(c *gin.Context) {
	var req struct {
		Ids []int `json:"ids"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || len(req.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	affected, err := model.BatchVerifyEmails(req.Ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"affected": affected})
}

// ManageUser Only admin user can do this
func ManageUser(c *gin.Context) {
	var req ManageRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)

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
	switch req.Action {
	case "disable":
		user.Status = common.UserStatusDisabled
		if user.Role == common.RoleRootUser {
			common.ApiErrorI18n(c, i18n.MsgUserCannotDisableRootUser)
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
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
		adminName := c.GetString("username")
		adminId := c.GetInt("id")
		adminInfo := map[string]interface{}{
			"admin_id":       adminId,
			"admin_username": adminName,
		}
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
			model.RecordLogWithAdminInfo(user.Id, model.LogTypeManage,
				fmt.Sprintf("管理员增加用户额度 %s", logger.LogQuota(req.Value)), adminInfo)
		case "subtract":
			if req.Value <= 0 {
				common.ApiErrorI18n(c, i18n.MsgUserQuotaChangeZero)
				return
			}
			if err := model.DecreaseUserQuota(user.Id, req.Value, true); err != nil {
				common.ApiError(c, err)
				return
			}
			model.RecordLogWithAdminInfo(user.Id, model.LogTypeManage,
				fmt.Sprintf("管理员减少用户额度 %s", logger.LogQuota(req.Value)), adminInfo)
		case "override":
			overrideResult, err := applyAdminQuotaOverride(user.Id, int64(req.Value))
			if err != nil {
				common.ApiError(c, err)
				return
			}
			oldQuota := int(overrideResult.PreviousBalance)
			model.RecordLogWithAdminInfo(user.Id, model.LogTypeManage,
				fmt.Sprintf("管理员覆盖用户额度从 %s 为 %s", logger.LogQuota(oldQuota), logger.LogQuota(req.Value)), adminInfo)
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

	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}
	// 禁用 / 角色调整后，强制失效用户缓存与其全部令牌缓存，
	// 避免在 Redis TTL 过期前仍使用旧状态（尤其是禁用后仍可发起请求的问题）。
	// InvalidateUserCache 会让下一次 GetUserCache 从数据库重新加载，
	// InvalidateUserTokensCache 则确保令牌侧的缓存也同步刷新。
	if req.Action == "disable" || req.Action == "promote" || req.Action == "demote" {
		if err := model.InvalidateUserCache(user.Id); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate user cache for user %d: %s", user.Id, err.Error()))
		}
		if err := model.InvalidateUserTokensCache(user.Id); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate tokens cache for user %d: %s", user.Id, err.Error()))
		}
	}
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
	code := req.Code
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
	user.Email = email
	user.EmailVerifiedAt = common.GetTimestamp()
	// no need to check if this email already taken, because we have used verification code to check it
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// The initial token was skipped at registration for unverified accounts;
	// re-issue it now that the email is verified so onboarding completes. Fail
	// loudly (rather than silently) so the client can surface a retry instead of
	// leaving the user "verified but without a token".
	if err := ensureDefaultUserToken(&user); err != nil {
		common.SysLog("failed to ensure default token after email verification: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgCreateDefaultTokenErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
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

func applyAdminQuotaOverride(userID int, target int64) (model.LifecycleQuotaMutationResult, error) {
	var result model.LifecycleQuotaMutationResult
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var applyErr error
		result, applyErr = model.ApplyWalletQuotaOverrideTx(tx, userID, target, "admin_adjustment", "ManageUser:add_quota:override")
		return applyErr
	})
	if err != nil {
		return model.LifecycleQuotaMutationResult{}, err
	}
	return result, nil
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
	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		if errors.Is(err, model.ErrRedeemFailed) {
			common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
			return
		}
		common.ApiError(c, err)
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
	WebhookUrl                       string  `json:"webhook_url,omitempty"`
	WebhookSecret                    string  `json:"webhook_secret,omitempty"`
	NotificationEmail                string  `json:"notification_email,omitempty"`
	BarkUrl                          string  `json:"bark_url,omitempty"`
	GotifyUrl                        string  `json:"gotify_url,omitempty"`
	GotifyToken                      string  `json:"gotify_token,omitempty"`
	GotifyPriority                   int     `json:"gotify_priority,omitempty"`
	UpstreamModelUpdateNotifyEnabled *bool   `json:"upstream_model_update_notify_enabled,omitempty"`
	AcceptUnsetModelRatioModel       bool    `json:"accept_unset_model_ratio_model"`
	RecordIpLog                      bool    `json:"record_ip_log"`
}

func UpdateUserSetting(c *gin.Context) {
	var req UpdateUserSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 验证预警类型
	if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark && req.QuotaWarningType != dto.NotifyTypeGotify {
		common.ApiErrorI18n(c, i18n.MsgSettingInvalidType)
		return
	}

	// 验证预警阈值
	if req.QuotaWarningThreshold <= 0 {
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

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existingSettings := user.GetSetting()
	upstreamModelUpdateNotifyEnabled := existingSettings.UpstreamModelUpdateNotifyEnabled
	if user.Role >= common.RoleAdminUser && req.UpstreamModelUpdateNotifyEnabled != nil {
		upstreamModelUpdateNotifyEnabled = *req.UpstreamModelUpdateNotifyEnabled
	}

	// 构建设置
	settings := existingSettings
	settings.NotifyType = req.QuotaWarningType
	settings.QuotaWarningThreshold = req.QuotaWarningThreshold
	settings.UpstreamModelUpdateNotifyEnabled = upstreamModelUpdateNotifyEnabled
	settings.AcceptUnsetRatioModel = req.AcceptUnsetModelRatioModel
	settings.RecordIpLog = req.RecordIpLog

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
	user.SetSetting(settings)
	if err := user.Update(false); err != nil {
		common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgSettingSaved, nil)
}
