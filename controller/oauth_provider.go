package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/hydra"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// rewriteOAuthRedirect rewrites Hydra internal redirect URLs to use the request's host/scheme.
// Only rewrites URLs that point to Hydra's internal paths (oauth2/*), not client redirect_uris.
func rewriteOAuthRedirect(c *gin.Context, redirectURL string) string {
	if redirectURL == "" {
		return redirectURL
	}

	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return redirectURL
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return redirectURL
	}

	// Only rewrite Hydra internal OAuth paths, not client redirect_uris
	if !isHydraInternalPath(parsed.Path) {
		return redirectURL
	}

	// Get request scheme
	scheme := "http"
	if proto := c.Request.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.ToLower(strings.TrimSpace(proto))
	} else if c.Request.TLS != nil {
		scheme = "https"
	}

	// Rewrite host and scheme
	parsed.Host = c.Request.Host
	parsed.Scheme = scheme

	return parsed.String()
}

// isHydraInternalPath checks if the path is a Hydra/new-api internal OAuth path
// Only matches specific known internal paths, not client redirect_uris
func isHydraInternalPath(path string) bool {
	// Exact internal paths that need rewriting
	internalPaths := []string{
		// Hydra public endpoints
		"/oauth2/auth",
		"/oauth2/token",
		"/oauth2/revoke",
		"/oauth2/sessions",
		"/oauth2/fallbacks/login",
		"/oauth2/fallbacks/consent",
		"/oauth2/fallbacks/logout",
		// new-api OAuth pages
		"/oauth/login",
		"/oauth/consent",
		"/oauth/logout",
	}
	for _, p := range internalPaths {
		if path == p || strings.HasPrefix(path, p+"?") || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

// OAuthProviderController handles Hydra login/consent/logout flows
type OAuthProviderController struct {
	hydra hydra.Provider
}

// NewOAuthProviderController creates a new OAuth provider controller
func NewOAuthProviderController(hydraProvider hydra.Provider) *OAuthProviderController {
	return &OAuthProviderController{
		hydra: hydraProvider,
	}
}

func setOAuthSession(c *gin.Context, user *model.User) error {
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	return session.Save()
}

// OAuthLoginRequest represents the login form submission
type OAuthLoginRequest struct {
	Challenge string `json:"login_challenge" form:"login_challenge"`
	Username  string `json:"username" form:"username"`
	Password  string `json:"password" form:"password"`
}

// OAuthLogin handles GET /oauth/login - displays login page or auto-accepts if session exists
func (ctrl *OAuthProviderController) OAuthLogin(c *gin.Context) {
	challenge := c.Query("login_challenge")
	if challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing login_challenge",
		})
		return
	}

	// Get login request from Hydra
	loginReq, err := ctrl.hydra.GetLoginRequest(c.Request.Context(), challenge)
	if err != nil {
		common.SysError("OAuth login: failed to get login request: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid login challenge: " + err.Error(),
		})
		return
	}

	// Check if user is already logged in via new-api session
	session := sessions.Default(c)
	userID := session.Get("id")

	// If skip is true, Hydra thinks the user is already authenticated
	// But we need to verify new-api session is also valid AND matches Hydra's subject
	if loginReq.GetSkip() {
		if userID != nil {
			sessionUserID, ok := userID.(int)
			if !ok {
				// Invalid session data, clear and show login page
				session.Clear()
				_ = session.Save()
			} else {
				sessionSubject := strconv.Itoa(sessionUserID)
				// Verify Hydra's subject matches new-api session to prevent identity confusion
				if loginReq.GetSubject() == sessionSubject {
					// Both Hydra and new-api agree on the same user, accept immediately
					redirect, err := ctrl.hydra.AcceptLogin(c.Request.Context(), challenge, sessionSubject, false, 0)
					if err != nil {
						common.SysError("OAuth login: failed to accept login (skip): " + err.Error())
						c.JSON(http.StatusInternalServerError, gin.H{
							"success": false,
							"message": "failed to accept login",
						})
						return
					}
					c.JSON(http.StatusOK, gin.H{
						"success": true,
						"data": gin.H{
							"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
						},
					})
					return
				}
				// Subject mismatch: Hydra and new-api have different users
				// This could happen if logout didn't properly revoke Hydra sessions
				// Don't skip, show login page to re-authenticate
			}
		}
	}

	// Check if user is already logged in via session
	if userID != nil {
		sessionUserID, ok := userID.(int)
		if !ok {
			// Invalid session data, clear and continue to login page
			session.Clear()
			_ = session.Save()
		} else {
			subject := strconv.Itoa(sessionUserID)
			redirect, err := ctrl.hydra.AcceptLogin(c.Request.Context(), challenge, subject, true, common.HydraLoginRememberFor)
			if err != nil {
				common.SysError("OAuth login: failed to accept login (session): " + err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "failed to accept login",
				})
				return
			}
			// Return JSON for frontend to handle redirect (avoid CORS issues with HTTP redirects)
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data": gin.H{
					"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
				},
			})
			return
		}
	}

	// Return login page info for frontend to render
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"challenge":       challenge,
			"client_id":       loginReq.Client.GetClientId(),
			"client_name":     loginReq.Client.GetClientName(),
			"requested_scope": loginReq.GetRequestedScope(),
		},
	})
}

// OAuthLoginSubmit handles POST /oauth/login - processes login form
func (ctrl *OAuthProviderController) OAuthLoginSubmit(c *gin.Context) {
	var req OAuthLoginRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	if req.Challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing challenge",
		})
		return
	}

	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing username or password",
		})
		return
	}

	// Check if password login is enabled
	if !common.PasswordLoginEnabled {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "password login is disabled",
		})
		return
	}

	// Validate user credentials using existing model
	user := model.User{
		Username: req.Username,
		Password: req.Password,
	}
	if err := user.ValidateAndFill(); err != nil {
		common.SysLog("OAuth login: user validation failed for " + req.Username + ": " + err.Error())
		// Reject login with error
		redirect, rejectErr := ctrl.hydra.RejectLogin(c.Request.Context(), req.Challenge, "access_denied", err.Error())
		if rejectErr != nil {
			common.SysError("OAuth login: failed to reject login: " + rejectErr.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to reject login: " + rejectErr.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"message":     err.Error(),
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
		})
		return
	}

	// Check if 2FA is enabled
	if model.IsTwoFAEnabled(user.Id) {
		// Store pending state for 2FA
		session := sessions.Default(c)
		session.Set("oauth_pending_user_id", user.Id)
		session.Set("oauth_pending_challenge", req.Challenge)
		if err := session.Save(); err != nil {
			common.SysError("OAuth login: failed to save 2FA pending session: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to save session",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"require_2fa": true,
				"challenge":   req.Challenge,
			},
		})
		return
	}

	if err := setOAuthSession(c, &user); err != nil {
		common.SysError("OAuth login: failed to save session: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save session",
		})
		return
	}

	// Accept login
	subject := strconv.Itoa(user.Id)
	redirect, err := ctrl.hydra.AcceptLogin(c.Request.Context(), req.Challenge, subject, true, common.HydraLoginRememberFor)
	if err != nil {
		common.SysError("OAuth login: failed to accept login: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to accept login: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
			"user": gin.H{
				"id":           user.Id,
				"username":     user.Username,
				"display_name": user.DisplayName,
				"role":         user.Role,
				"status":       user.Status,
				"group":        user.Group,
			},
		},
	})
}

// OAuthLogin2FA handles POST /oauth/login/2fa - processes 2FA verification for OAuth login
func (ctrl *OAuthProviderController) OAuthLogin2FA(c *gin.Context) {
	var req struct {
		Code string `json:"code" form:"code"`
	}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}

	session := sessions.Default(c)
	userIDVal := session.Get("oauth_pending_user_id")
	challengeVal := session.Get("oauth_pending_challenge")

	if userIDVal == nil || challengeVal == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "no pending 2FA verification",
		})
		return
	}

	// Safe type assertions
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid session data",
		})
		return
	}
	challenge, ok := challengeVal.(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid session data",
		})
		return
	}

	// Verify 2FA code using existing logic
	twoFA, err := model.GetTwoFAByUserId(userID)
	if err != nil || twoFA == nil {
		common.SysError(fmt.Sprintf("OAuth 2FA: failed to get 2FA config for user %d: %v", userID, err))
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "2FA not configured",
		})
		return
	}

	// Check if locked
	if twoFA.IsLocked() {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"message": "too many failed attempts, please try again later",
		})
		return
	}

	// Verify TOTP code
	valid := common.ValidateTOTPCode(twoFA.Secret, req.Code)
	if !valid {
		// Try backup code
		valid = model.UseBackupCode(userID, req.Code)
	}

	if !valid {
		_ = twoFA.IncrementFailedAttempts()
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "invalid verification code",
		})
		return
	}

	// Clear pending state
	session.Delete("oauth_pending_user_id")
	session.Delete("oauth_pending_challenge")

	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.SysError(fmt.Sprintf("OAuth 2FA: failed to load user %d: %s", userID, err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to load user",
		})
		return
	}

	if err := setOAuthSession(c, user); err != nil {
		common.SysError("OAuth 2FA: failed to save session: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save session",
		})
		return
	}

	// Accept login
	subject := strconv.Itoa(userID)
	redirect, err := ctrl.hydra.AcceptLogin(c.Request.Context(), challenge, subject, true, common.HydraLoginRememberFor)
	if err != nil {
		common.SysError("OAuth 2FA: failed to accept login: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to accept login",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
			"user": gin.H{
				"id":           user.Id,
				"username":     user.Username,
				"display_name": user.DisplayName,
				"role":         user.Role,
				"status":       user.Status,
				"group":        user.Group,
			},
		},
	})
}

// OAuthConsent handles GET /oauth/consent - displays consent page
func (ctrl *OAuthProviderController) OAuthConsent(c *gin.Context) {
	challenge := c.Query("consent_challenge")
	if challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing consent_challenge",
		})
		return
	}

	consentReq, err := ctrl.hydra.GetConsentRequest(c.Request.Context(), challenge)
	if err != nil {
		common.SysError("OAuth consent: failed to get consent request: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid consent challenge: " + err.Error(),
		})
		return
	}

	session := sessions.Default(c)
	subject := consentReq.GetSubject()
	if subject == "" || session.Get("id") == nil || fmt.Sprint(session.Get("id")) != subject {
		redirect, err := ctrl.hydra.RejectConsent(c.Request.Context(), challenge, "login_required", "user login required")
		if err != nil {
			common.SysError("OAuth consent: failed to reject consent (no session): " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to reject consent: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
			},
		})
		return
	}

	// If skip is true, the user has already given consent
	if consentReq.GetSkip() {
		redirect, err := ctrl.hydra.AcceptConsent(
			c.Request.Context(),
			challenge,
			consentReq.GetRequestedScope(),
			false,
			0,
			nil,
		)
		if err != nil {
			common.SysError("OAuth consent: failed to accept consent (skip): " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to accept consent: " + err.Error(),
			})
			return
		}
		// Return JSON for frontend to handle redirect (avoid CORS issues with HTTP redirects)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
			},
		})
		return
	}

	// Check if this is a trusted first-party client (auto-consent)
	clientID := consentReq.Client.GetClientId()
	if isTrustedOAuthClient(clientID) {
		redirect, err := ctrl.hydra.AcceptConsent(
			c.Request.Context(),
			challenge,
			consentReq.GetRequestedScope(),
			true,
			common.HydraConsentRememberFor,
			nil,
		)
		if err != nil {
			common.SysError("OAuth consent: failed to accept consent (trusted client): " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to accept consent: " + err.Error(),
			})
			return
		}
		// Return JSON for frontend to handle redirect (avoid CORS issues with HTTP redirects)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
			},
		})
		return
	}

	// Return consent page info for frontend
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"challenge":       challenge,
			"client_id":       clientID,
			"client_name":     consentReq.Client.GetClientName(),
			"requested_scope": consentReq.GetRequestedScope(),
			"subject":         consentReq.GetSubject(),
		},
	})
}

// OAuthConsentRequest represents consent form submission
type OAuthConsentRequest struct {
	Challenge  string   `json:"consent_challenge" form:"consent_challenge"`
	GrantScope []string `json:"grant_scope" form:"grant_scope"`
	Remember   bool     `json:"remember" form:"remember"`
}

// OAuthConsentSubmit handles POST /oauth/consent - processes consent form
func (ctrl *OAuthProviderController) OAuthConsentSubmit(c *gin.Context) {
	var req OAuthConsentRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	if req.Challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing challenge",
		})
		return
	}

	consentReq, err := ctrl.hydra.GetConsentRequest(c.Request.Context(), req.Challenge)
	if err != nil {
		common.SysError("OAuth consent submit: failed to get consent request: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid consent challenge: " + err.Error(),
		})
		return
	}

	session := sessions.Default(c)
	subject := consentReq.GetSubject()
	if subject == "" || session.Get("id") == nil || fmt.Sprint(session.Get("id")) != subject {
		reject, err := ctrl.hydra.RejectConsent(c.Request.Context(), req.Challenge, "login_required", "user login required")
		if err != nil {
			common.SysError("OAuth consent submit: failed to reject consent (no session): " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to reject consent: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"redirect_to": rewriteOAuthRedirect(c, reject.RedirectTo),
			},
		})
		return
	}

	var rememberFor int64 = 0
	if req.Remember {
		rememberFor = common.HydraConsentRememberFor
	}

	redirect, err := ctrl.hydra.AcceptConsent(
		c.Request.Context(),
		req.Challenge,
		req.GrantScope,
		req.Remember,
		rememberFor,
		nil,
	)
	if err != nil {
		common.SysError("OAuth consent submit: failed to accept consent: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to accept consent: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
		},
	})
}

// OAuthConsentReject handles POST /oauth/consent/reject - rejects consent
func (ctrl *OAuthProviderController) OAuthConsentReject(c *gin.Context) {
	var req struct {
		Challenge string `json:"consent_challenge" form:"consent_challenge"`
	}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	if req.Challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing consent_challenge",
		})
		return
	}

	consentReq, err := ctrl.hydra.GetConsentRequest(c.Request.Context(), req.Challenge)
	if err != nil {
		common.SysError("OAuth consent reject: failed to get consent request: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid consent challenge: " + err.Error(),
		})
		return
	}

	session := sessions.Default(c)
	subject := consentReq.GetSubject()
	if subject == "" || session.Get("id") == nil || fmt.Sprint(session.Get("id")) != subject {
		reject, err := ctrl.hydra.RejectConsent(c.Request.Context(), req.Challenge, "login_required", "user login required")
		if err != nil {
			common.SysError("OAuth consent reject: failed to reject consent (no session): " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to reject consent: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"redirect_to": rewriteOAuthRedirect(c, reject.RedirectTo),
			},
		})
		return
	}

	redirect, err := ctrl.hydra.RejectConsent(c.Request.Context(), req.Challenge, "access_denied", "user denied consent")
	if err != nil {
		common.SysError("OAuth consent reject: failed to reject consent: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to reject consent: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
		},
	})
}

// OAuthLogout handles GET /oauth/logout - displays logout confirmation
func (ctrl *OAuthProviderController) OAuthLogout(c *gin.Context) {
	challenge := c.Query("logout_challenge")
	if challenge == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "missing logout_challenge",
		})
		return
	}

	// Validate the logout challenge exists
	_, err := ctrl.hydra.GetLogoutRequest(c.Request.Context(), challenge)
	if err != nil {
		common.SysError("OAuth logout: failed to get logout request: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid logout challenge: " + err.Error(),
		})
		return
	}

	// Auto-accept logout for now
	// Could show a confirmation page if needed
	redirect, err := ctrl.hydra.AcceptLogout(c.Request.Context(), challenge)
	if err != nil {
		common.SysError("OAuth logout: failed to accept logout: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to accept logout: " + err.Error(),
		})
		return
	}

	// Clear local session
	session := sessions.Default(c)
	session.Clear()
	_ = session.Save()

	// Return JSON for frontend to handle redirect (avoid CORS issues with HTTP redirects)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"redirect_to": rewriteOAuthRedirect(c, redirect.RedirectTo),
		},
	})
}

// isTrustedOAuthClient checks if a client is a trusted first-party app
// Trusted clients get auto-consent without user interaction
// Configure via HydraTrustedClients setting (comma-separated client IDs)
func isTrustedOAuthClient(clientID string) bool {
	return slices.Contains(common.HydraTrustedClients, clientID)
}

// OAuthRegisterClientRequest represents the request to register an OAuth client
type OAuthRegisterClientRequest struct {
	ClientID                string   `json:"client_id"`
	ClientSecret            string   `json:"client_secret"`
	ClientName              string   `json:"client_name"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	RedirectURIs            []string `json:"redirect_uris"`
	Scope                   string   `json:"scope"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
}

// OAuthRegisterClient handles POST /oauth/admin/clients - registers a new OAuth client (admin only)
func (ctrl *OAuthProviderController) OAuthRegisterClient(c *gin.Context) {
	var req OAuthRegisterClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	// Auto-generate client_id if not provided
	if req.ClientID == "" {
		req.ClientID = uuid.New().String()
	}

	// Set defaults
	if len(req.GrantTypes) == 0 {
		req.GrantTypes = []string{"authorization_code", "refresh_token"}
	}
	if len(req.ResponseTypes) == 0 {
		req.ResponseTypes = []string{"code"}
	}
	if req.TokenEndpointAuthMethod == "" {
		req.TokenEndpointAuthMethod = "client_secret_post"
	}
	if req.ClientName == "" {
		req.ClientName = req.ClientID
	}

	// Determine client type based on token_endpoint_auth_method
	clientType := model.OAuthClientTypeConfidential
	if req.TokenEndpointAuthMethod == "none" {
		clientType = model.OAuthClientTypePublic
		req.ClientSecret = "" // Public clients don't have secrets
	} else {
		// Auto-generate client_secret for confidential clients if not provided
		if req.ClientSecret == "" {
			req.ClientSecret = uuid.New().String()
		}
	}

	// Get current user ID from context (set by AdminAuth middleware)
	userID := c.GetInt("id")

	// Create client in Hydra
	client, err := ctrl.hydra.CreateOAuth2Client(
		c.Request.Context(),
		req.ClientID,
		req.ClientSecret,
		req.ClientName,
		req.GrantTypes,
		req.ResponseTypes,
		req.RedirectURIs,
		req.Scope,
		req.TokenEndpointAuthMethod,
	)
	if err != nil {
		common.SysError("OAuth register client: failed to create client in Hydra: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to create client: " + err.Error(),
		})
		return
	}

	// Save client ownership to database
	oauthClient := &model.OAuthClient{
		HydraClientID: req.ClientID,
		UserID:        userID,
		ClientName:    req.ClientName,
		ClientType:    clientType,
		AllowedScopes: req.Scope,
		RedirectURIs:  strings.Join(req.RedirectURIs, ","),
	}
	if err := model.CreateOAuthClient(oauthClient); err != nil {
		// Log the error but don't fail the request since client was created in Hydra
		common.SysError("failed to save oauth client ownership: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    client,
	})
}

// OAuthListClients handles GET /oauth/admin/clients - lists all OAuth clients (admin only)
func (ctrl *OAuthProviderController) OAuthListClients(c *gin.Context) {
	clients, err := ctrl.hydra.ListOAuth2Clients(c.Request.Context())
	if err != nil {
		common.SysError("OAuth list clients: failed to list clients: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to list clients: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    clients,
	})
}

// OAuthDeleteClient handles DELETE /oauth/admin/clients/:id - deletes an OAuth client (admin only)
func (ctrl *OAuthProviderController) OAuthDeleteClient(c *gin.Context) {
	clientID := c.Param("id")
	if clientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "client_id is required",
		})
		return
	}

	// Delete from Hydra
	if err := ctrl.hydra.DeleteOAuth2Client(c.Request.Context(), clientID); err != nil {
		common.SysError("OAuth delete client: failed to delete client " + clientID + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to delete client: " + err.Error(),
		})
		return
	}

	// Delete from our database (ignore error since Hydra deletion succeeded)
	if err := model.DeleteOAuthClientByHydraID(clientID); err != nil {
		common.SysError("failed to delete oauth client from database: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "client deleted",
	})
}

// OAuthUpdateClientRequest represents the request to update an OAuth client
type OAuthUpdateClientRequest struct {
	ClientName              string   `json:"client_name"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	RedirectURIs            []string `json:"redirect_uris"`
	Scope                   string   `json:"scope"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
}

// OAuthUpdateClient handles PUT /oauth/admin/clients/:id - updates an OAuth client (admin only)
func (ctrl *OAuthProviderController) OAuthUpdateClient(c *gin.Context) {
	clientID := c.Param("id")
	if clientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "client_id is required",
		})
		return
	}

	var req OAuthUpdateClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	// Set defaults
	if len(req.GrantTypes) == 0 {
		req.GrantTypes = []string{"authorization_code", "refresh_token"}
	}
	if len(req.ResponseTypes) == 0 {
		req.ResponseTypes = []string{"code"}
	}
	if req.TokenEndpointAuthMethod == "" {
		req.TokenEndpointAuthMethod = "client_secret_post"
	}
	if req.ClientName == "" {
		req.ClientName = clientID
	}

	// Update client in Hydra
	client, err := ctrl.hydra.UpdateOAuth2Client(
		c.Request.Context(),
		clientID,
		req.ClientName,
		req.GrantTypes,
		req.ResponseTypes,
		req.RedirectURIs,
		req.Scope,
		req.TokenEndpointAuthMethod,
	)
	if err != nil {
		common.SysError("OAuth update client: failed to update client " + clientID + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to update client: " + err.Error(),
		})
		return
	}

	// Update in our database (ignore error since Hydra update succeeded)
	if err := model.UpdateOAuthClientByHydraID(clientID, req.ClientName, req.Scope, strings.Join(req.RedirectURIs, ",")); err != nil {
		common.SysError("failed to update oauth client in database: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    client,
	})
}
