package controller

import (
	"encoding/base64"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

var googleOneTapValidateIDToken = idtoken.Validate

const googleOAuthAuthorizeEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"

// providerParams returns map with Provider key for i18n templates
func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	session := sessions.Default(c)
	state := prepareOAuthState(c, session)
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

func prepareOAuthState(c *gin.Context, session sessions.Session) string {
	state := common.GetRandomString(12)
	affCode := c.Query("aff")
	if affCode != "" {
		session.Set("aff", affCode)
	}
	adsAttribution := sanitizeAdsAttribution(c.Query("ads_attribution"))
	if adsAttribution != "" {
		session.Set("ads_attribution", adsAttribution)
	}
	gaClientID := service.NormalizeGAIdentifier(c.Query("ga_client_id"))
	if gaClientID != "" {
		session.Set("ga_client_id", gaClientID)
	} else {
		session.Delete("ga_client_id")
	}
	gaSessionID := service.NormalizeGAIdentifier(c.Query("ga_session_id"))
	if gaSessionID != "" {
		session.Set("ga_session_id", gaSessionID)
	} else {
		session.Delete("ga_session_id")
	}
	session.Set("oauth_state", state)
	return state
}

func StartGoogleOAuth(c *gin.Context) {
	provider := oauth.GetProvider("google")
	if provider == nil || !provider.IsEnabled() {
		c.Redirect(http.StatusSeeOther, googleOAuthStartFallbackPath(c))
		return
	}

	settings := system_setting.GetGoogleSettings()
	clientID := strings.TrimSpace(settings.ClientId)
	if clientID == "" {
		c.Redirect(http.StatusSeeOther, googleOAuthStartFallbackPath(c))
		return
	}

	consoleOrigin, err := googleOAuthConsoleOrigin(c)
	if err != nil {
		common.SysError("[OAuth-Google] failed to resolve console origin: " + err.Error())
		c.Redirect(http.StatusSeeOther, googleOAuthStartFallbackPath(c))
		return
	}

	session := sessions.Default(c)
	session.Clear()
	state := prepareOAuthState(c, session)
	if err := session.Save(); err != nil {
		common.SysError("[OAuth-Google] failed to save OAuth start session: " + err.Error())
		c.Redirect(http.StatusSeeOther, googleOAuthStartFallbackPath(c))
		return
	}
	setConsoleSessionHintCookie(c, false)

	values := url.Values{}
	values.Set("client_id", clientID)
	values.Set("redirect_uri", consoleOrigin+"/oauth/google")
	values.Set("response_type", "code")
	values.Set("scope", "openid email profile")
	values.Set("state", state)
	c.Redirect(http.StatusSeeOther, googleOAuthAuthorizeEndpoint+"?"+values.Encode())
}

func googleOAuthConsoleOrigin(c *gin.Context) (string, error) {
	if origin, err := system_setting.NormalizeAppConsoleOrigin(system_setting.GetAppConsoleSettings().Origin); err == nil && origin != "" {
		return origin, nil
	}
	if origin, err := googleOAuthRequestOrigin(c); err == nil && origin != "" {
		return origin, nil
	}
	return system_setting.NormalizeAppConsoleOrigin(system_setting.ServerAddress)
}

func googleOAuthRequestOrigin(c *gin.Context) (string, error) {
	proto := firstForwardedHeaderValue(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := firstForwardedHeaderValue(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	return system_setting.NormalizeAppConsoleOrigin(proto + "://" + host)
}

func firstForwardedHeaderValue(value string) string {
	if i := strings.IndexByte(value, ','); i >= 0 {
		value = value[:i]
	}
	return strings.TrimSpace(value)
}

func googleOAuthStartFallbackPath(c *gin.Context) string {
	values := url.Values{}
	if lng := strings.TrimSpace(c.Query("lng")); lng != "" {
		values.Set("lng", lng)
	}
	if redirect := safeInternalPath(c.Query("redirect"), ""); redirect != "" {
		values.Set("redirect", redirect)
	}
	if encoded := values.Encode(); encoded != "" {
		return "/sign-in?" + encoded
	}
	return "/sign-in"
}

func getOAuthAdsAttribution(c *gin.Context, session sessions.Session) string {
	if adsAttribution := sanitizeAdsAttribution(c.Query("ads_attribution")); adsAttribution != "" {
		return adsAttribution
	}
	if adsAttribution, ok := session.Get("ads_attribution").(string); ok {
		return sanitizeAdsAttribution(adsAttribution)
	}
	return ""
}

func updateUserAdsAttributionIfEmpty(user *model.User, adsAttribution string) {
	if user == nil || user.Id == 0 || adsAttribution == "" || user.AdsAttribution != "" {
		return
	}
	if err := model.DB.Model(user).Where("id = ? AND (ads_attribution IS NULL OR ads_attribution = '')", user.Id).Update("ads_attribution", adsAttribution).Error; err != nil {
		common.SysError(fmt.Sprintf("[OAuth] Failed to update ads attribution for user %d: %s", user.Id, err.Error()))
		return
	}
	user.AdsAttribution = adsAttribution
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
	user, isNewUser, err := findOrCreateOAuthUser(c, provider, oauthUser, session)
	if err != nil {
		if _, ok := registrationEmailErrorKey(err); ok {
			respondRegistrationEmailError(c, err)
			return
		}
		switch err.(type) {
		case *OAuthUserDeletedError:
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
		case *OAuthRegistrationDisabledError:
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		case *OAuthRegistrationCountryBlockedError:
			common.ApiErrorI18n(c, i18n.MsgRegistrationCountryBlocked)
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

	// OAuth attribution/state are one-shot values. setupLogin saves the session
	// below, so deleting them here prevents a later login in the same browser
	// from inheriting a previous user's acquisition data.
	session.Delete("oauth_state")
	session.Delete("ads_attribution")
	session.Delete("aff")
	session.Delete("ga_client_id")
	session.Delete("ga_session_id")

	// 9. Setup login. Pass isNewUser so the frontend can trigger first-login onboarding for
	// OAuth registrations (mirrors password registration's route-level Playground first-run contract).
	setupLogin(user, c, isNewUser)
}

// HandleGoogleOneTap accepts Google Identity Services One Tap credentials from
// the public website, validates the ID token, and creates the same console
// session used by the normal OAuth authorization-code flow.
func HandleGoogleOneTap(c *gin.Context) {
	provider := oauth.GetProvider("google")
	if provider == nil {
		respondGoogleOneTapFailure(c, http.StatusBadRequest, i18n.T(c, i18n.MsgOAuthUnknownProvider))
		return
	}
	if !provider.IsEnabled() {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName())))
		return
	}

	csrfBody := strings.TrimSpace(c.PostForm("g_csrf_token"))
	if !googleOneTapCSRFCookieMatches(c, csrfBody) {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthStateInvalid))
		return
	}

	credential := strings.TrimSpace(c.PostForm("credential"))
	if credential == "" {
		respondGoogleOneTapFailure(c, http.StatusBadRequest, i18n.T(c, i18n.MsgOAuthInvalidCode))
		return
	}

	settings := system_setting.GetGoogleSettings()
	if strings.TrimSpace(settings.ClientId) == "" {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName())))
		return
	}

	payload, err := googleOneTapValidateIDToken(c.Request.Context(), credential, settings.ClientId)
	if err != nil {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthTokenFailed, providerParams(provider.GetName())))
		return
	}
	oauthUser, err := googleOneTapOAuthUser(payload)
	if err != nil {
		respondGoogleOneTapOAuthError(c, err)
		return
	}

	session := sessions.Default(c)
	if session.Get("username") != nil {
		respondGoogleOneTapAlreadyLoggedIn(c)
		return
	}

	user, isNewUser, err := findOrCreateOAuthUser(c, provider, oauthUser, session)
	if err != nil {
		if _, ok := registrationEmailErrorKey(err); ok {
			respondGoogleOneTapFailure(c, http.StatusForbidden, err.Error())
			return
		}
		switch err.(type) {
		case *OAuthUserDeletedError:
			respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthUserDeleted))
		case *OAuthRegistrationDisabledError:
			respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgUserRegisterDisabled))
		case *OAuthRegistrationCountryBlockedError:
			respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgRegistrationCountryBlocked))
		default:
			respondGoogleOneTapFailure(c, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if user.Status != common.UserStatusEnabled {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, i18n.MsgOAuthUserBanned))
		return
	}

	session.Delete("oauth_state")
	session.Delete("ads_attribution")
	session.Delete("aff")
	session.Delete("ga_client_id")
	session.Delete("ga_session_id")

	data, err := setupLoginSession(user, c, isNewUser)
	if err != nil {
		respondGoogleOneTapFailure(c, http.StatusInternalServerError, i18n.T(c, i18n.MsgUserSessionSaveFailed))
		return
	}
	respondGoogleOneTapSuccess(c, data)
}

func googleOneTapOAuthUser(payload *idtoken.Payload) (*oauth.OAuthUser, error) {
	if payload == nil {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "Google"})
	}
	sub := strings.TrimSpace(payload.Subject)
	if sub == "" {
		sub = googleOneTapStringClaim(payload, "sub")
	}
	email := googleOneTapStringClaim(payload, "email")
	if sub == "" || email == "" {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "Google"})
	}
	if !googleOneTapBoolClaim(payload, "email_verified") {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthEmailNotVerified, map[string]any{"Provider": "Google"})
	}
	return &oauth.OAuthUser{
		ProviderUserID: sub,
		Username:       oauth.GoogleUsernameFromEmail(email),
		DisplayName:    googleOneTapStringClaim(payload, "name"),
		Email:          email,
		// email_verified was validated above (rejected when false), so the
		// address is proven by Google — mark it verified or the account would
		// be blocked by the email-verification gate on token creation/usage.
		EmailVerified: true,
	}, nil
}

func googleOneTapStringClaim(payload *idtoken.Payload, key string) string {
	if payload == nil || payload.Claims == nil {
		return ""
	}
	value, _ := payload.Claims[key].(string)
	return strings.TrimSpace(value)
}

func googleOneTapBoolClaim(payload *idtoken.Payload, key string) bool {
	if payload == nil || payload.Claims == nil {
		return false
	}
	switch value := payload.Claims[key].(type) {
	case bool:
		return value
	case string:
		return strings.EqualFold(strings.TrimSpace(value), "true")
	default:
		return false
	}
}

func respondGoogleOneTapOAuthError(c *gin.Context, err error) {
	if oauthErr, ok := err.(*oauth.OAuthError); ok {
		respondGoogleOneTapFailure(c, http.StatusForbidden, i18n.T(c, oauthErr.MsgKey, oauthErr.Params))
		return
	}
	respondGoogleOneTapFailure(c, http.StatusInternalServerError, err.Error())
}

func respondGoogleOneTapSuccess(c *gin.Context, data any) {
	respondGoogleOneTapSuccessWithStorage(c, data, true)
}

func respondGoogleOneTapAlreadyLoggedIn(c *gin.Context) {
	respondGoogleOneTapSuccessWithStorage(c, gin.H{"already_logged_in": true}, false)
}

func respondGoogleOneTapSuccessWithStorage(c *gin.Context, data any, storeUser bool) {
	if googleOneTapWantsJSON(c) {
		c.JSON(http.StatusOK, gin.H{
			"message": "",
			"success": true,
			"data":    data,
		})
		return
	}
	// Google posts the One Tap credential from accounts.google.com. A direct
	// redirect from that cross-site POST keeps the redirect chain cross-site, so
	// the session cookie (SameSite=Strict) is withheld from the destination and
	// the user appears logged out. First commit a same-origin document, then let
	// that document start a fresh navigation where the Strict cookie is sent.
	returnPath := googleOneTapReturnPath(c)
	storageScript := ""
	if storeUser {
		userJSON, err := common.Marshal(data)
		if err != nil {
			respondGoogleOneTapFailure(c, http.StatusInternalServerError, i18n.T(c, i18n.MsgUserSessionSaveFailed))
			return
		}
		encodedUser := base64.StdEncoding.EncodeToString(userJSON)
		storageScript = "var user=JSON.parse(atob('" + encodedUser + "'));" +
			"localStorage.setItem('user',JSON.stringify(user));" +
			"if(user&&user.id!=null)localStorage.setItem('uid',String(user.id));"
	}
	encodedReturnPath := base64.StdEncoding.EncodeToString([]byte(returnPath))
	escapedReturnPath := html.EscapeString(returnPath)
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(
		"<!doctype html><html><head><meta charset=\"utf-8\">"+
			"<title>Signing in</title></head><body>"+
			"<script>(function(){"+
			storageScript+
			"location.replace(atob('"+encodedReturnPath+"'));"+
			"})();</script>"+
			"<a href=\""+escapedReturnPath+"\">Continue</a></body></html>",
	))
}

func respondGoogleOneTapFailure(c *gin.Context, status int, message string) {
	if googleOneTapWantsJSON(c) {
		c.JSON(status, gin.H{
			"success": false,
			"message": message,
		})
		return
	}
	c.Redirect(http.StatusSeeOther, googleOneTapFallbackPath(c))
}

func googleOneTapWantsJSON(c *gin.Context) bool {
	accept := c.GetHeader("Accept")
	return strings.Contains(accept, "application/json") || c.GetHeader("X-Requested-With") == "XMLHttpRequest"
}

func googleOneTapReturnPath(c *gin.Context) string {
	return safeInternalPath(c.Query("return_to"), "/")
}

func safeInternalPath(path string, fallback string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return fallback
	}
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.ContainsAny(path, "\r\n") {
		return fallback
	}
	return path
}

func googleOneTapCSRFCookieMatches(c *gin.Context, csrfBody string) bool {
	if strings.TrimSpace(csrfBody) == "" {
		return false
	}
	for _, cookie := range c.Request.Cookies() {
		if cookie.Name == "g_csrf_token" && cookie.Value == csrfBody {
			return true
		}
	}
	return false
}

func googleOneTapFallbackPath(c *gin.Context) string {
	values := url.Values{}
	if lng := strings.TrimSpace(c.Query("lng")); lng != "" {
		values.Set("lng", lng)
	}
	values.Set("source", "one_tap_fallback")
	return "/api/oauth/google/start?" + values.Encode()
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

// selfHealOAuthEmailVerification backfills EmailVerifiedAt for existing OAuth
// users when the provider proves email ownership (Google/GitHub verified
// emails, OIDC email_verified claim, Discord verified flag). Accounts created
// before email-verification tracking was enforced keep email_verified_at = 0,
// which blocks token creation/usage; healing on next login avoids a manual
// SQL backfill for those users. Fail-open: an update error only logs and the
// login still succeeds.
func selfHealOAuthEmailVerification(user *model.User, oauthUser *oauth.OAuthUser) {
	if oauthUser == nil || user == nil || !oauthUser.EmailVerified {
		return
	}
	if user.Email == "" || user.EmailVerifiedAt != 0 {
		return
	}
	user.EmailVerifiedAt = common.GetTimestamp()
	if err := user.Update(false); err != nil {
		common.SysError(fmt.Sprintf("[OAuth] failed to self-heal email_verified_at for user %d: %v", user.Id, err))
		return
	}
	common.SysLog(fmt.Sprintf("[OAuth] self-healed email_verified_at for user %d on %s login", user.Id, oauthUser.ProviderUserID))
	if err := model.InvalidateUserCache(user.Id); err != nil {
		common.SysError("failed to invalidate self-healed user cache: " + err.Error())
	}
}

// findOrCreateOAuthUser finds existing user or creates new user. The second return value is
// true only when a brand-new user was created (used to trigger first-login onboarding).
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, session sessions.Session) (*model.User, bool, error) {
	user := &model.User{}
	adsAttribution := getOAuthAdsAttribution(c, session)

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, false, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, false, &OAuthUserDeletedError{}
		}
		updateUserAdsAttributionIfEmpty(user, adsAttribution)
		selfHealOAuthEmailVerification(user, oauthUser)
		return user, false, nil
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			err := provider.FillUserByProviderID(user, legacyID)
			if err != nil {
				return nil, false, err
			}
			if user.Id != 0 {
				// Found user with legacy ID, migrate to new ID
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					user.Id, legacyID, oauthUser.ProviderUserID))
				if err := user.UpdateGitHubId(oauthUser.ProviderUserID); err != nil {
					common.SysError(fmt.Sprintf("[OAuth] Failed to migrate user %d: %s", user.Id, err.Error()))
					// Continue with login even if migration fails
				}
				updateUserAdsAttributionIfEmpty(user, adsAttribution)
				selfHealOAuthEmailVerification(user, oauthUser)
				return user, false, nil
			}
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, false, &OAuthRegistrationDisabledError{}
	}
	// Google verifies the user's identity and email with Google directly, so it
	// is allowed to create an account even when the IP-based country policy
	// blocks password and other OAuth registrations. Existing-user login was
	// already allowed for every provider above.
	registrationCountry, blocked, _ := registrationCountryDecision(c)
	if blocked && (!isGoogleOAuthProvider(provider) || !operation_setting.IsGoogleOAuthAllowed()) {
		return nil, false, &OAuthRegistrationCountryBlockedError{}
	}
	oauthUser.Email = strings.TrimSpace(oauthUser.Email)
	emailDecision, err := evaluateRegistrationEmail(oauthUser.Email)
	if err != nil {
		return nil, false, err
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
		user.EmailDomain = emailDecision.Domain
		// Only mark the address verified when the provider actually proved
		// ownership (Google/GitHub verified emails, OIDC email_verified claim,
		// Discord verified flag). Providers that pass an unverified address
		// through (generic/OIDC without the claim, LinuxDO) leave the account
		// unverified so it must confirm the email via the standard flow before
		// creating or using tokens.
		if oauthUser.EmailVerified {
			user.EmailVerifiedAt = common.GetTimestamp()
		}
	}
	user.Role = common.RoleCommonUser
	user.RegistrationCountry = registrationCountry
	user.Status = common.UserStatusEnabled
	if _, _, autoDisable := registrationCountryDecision(c); autoDisable {
		user.Status = common.UserStatusDisabled
	}
	user.AdsAttribution = adsAttribution
	if cookieLang, err := c.Cookie(i18n.LanguagePreferenceCookieName); err == nil {
		if language, ok := dto.NormalizeUserLanguagePreference(cookieLang); ok {
			user.SetSetting(dto.UserSetting{Language: language})
		}
	}

	// Handle affiliate code
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	var afterCreate func(*gorm.DB) error
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		afterCreate = func(tx *gorm.DB) error {
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			return model.CreateUserOAuthBindingWithTx(tx, binding)
		}
	} else {
		afterCreate = func(tx *gorm.DB) error {
			provider.SetProviderUserID(user, oauthUser.ProviderUserID)
			return tx.Model(user).Updates(map[string]any{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
				"google_id":   user.GoogleId,
			}).Error
		}
	}

	if _, err := model.RegisterUserWithDomainRisk(user, inviterId, c.ClientIP(), emailDecision.Policy, afterCreate); err != nil {
		return nil, false, err
	}
	user.FinalizeOAuthUserCreation(inviterId)
	// Give OAuth signups the same idempotent default API key as email signups so
	// Google/GitHub users don't land in an empty backend (issue #406). Best-effort:
	// a transient key-creation failure must not block a successful OAuth login.
	if err := ensureDefaultUserToken(user); err != nil {
		common.SysLog("oauth default token creation failed for user " + strconv.Itoa(user.Id) + ": " + err.Error())
	}

	gaClientID, _ := session.Get("ga_client_id").(string)
	gaSessionID, _ := session.Get("ga_session_id").(string)
	gaClientID, gaSessionID = service.ResolveGAIdentifiers(c.Request, gaClientID, gaSessionID)
	sendSignUpSuccessGA(c.Request.Context(), user.Id, inviterId, provider.GetProviderPrefix(), gaClientID, gaSessionID)

	return user, true, nil
}

func isGoogleOAuthProvider(provider oauth.Provider) bool {
	return provider != nil && provider.GetProviderPrefix() == "google_"
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

type OAuthRegistrationCountryBlockedError struct{}

func (e *OAuthRegistrationCountryBlockedError) Error() string {
	return "registration is not available in this country"
}

// handleOAuthError handles OAuth errors and returns translated message
func handleOAuthError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *OAuthRegistrationCountryBlockedError:
		common.ApiErrorI18n(c, i18n.MsgRegistrationCountryBlocked)
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
