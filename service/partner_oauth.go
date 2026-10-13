package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

const (
	PartnerOAuthScopeAccountRead    = "account:read"
	PartnerOAuthScopeCredentialRead = "credential:read"
	PartnerOAuthScopeOfflineAccess  = "offline_access"

	PartnerOAuthRequestTTL     = 10 * time.Minute
	PartnerOAuthCodeTTL        = 120 * time.Second
	PartnerOAuthAccessTokenTTL = time.Hour
	PartnerOAuthGrantTTL       = 30 * 24 * time.Hour
	PartnerOAuthFormLimit      = 16 << 10
	PartnerOAuthJSONLimit      = 1 << 10
	PartnerOAuthCookieName     = "partner_oauth_rq"
	PartnerOAuthCookiePath     = "/api/partner-oauth"
	PartnerOAuthCookieMaxAge   = 600

	partnerOAuthDummySecretHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
)

var (
	partnerOAuthCanonicalScopes = []string{
		PartnerOAuthScopeAccountRead,
		PartnerOAuthScopeCredentialRead,
		PartnerOAuthScopeOfflineAccess,
	}
	partnerOAuthStatePattern     = regexp.MustCompile(`^[A-Za-z0-9\-._~]{32,128}$`)
	partnerOAuthChallengePattern = regexp.MustCompile(`^[A-Za-z0-9\-_]{43}$`)
	partnerOAuthVerifierPattern  = regexp.MustCompile(`^[A-Za-z0-9\-._~]{43,128}$`)
	partnerOAuthClientIDPattern  = regexp.MustCompile(`^pc_[0-9a-f]{32}$`)
)

var ErrPartnerOAuthRefreshReuse = errors.New("partner oauth refresh token reuse detected")

type PartnerOAuthError struct {
	Status      int
	Code        string
	Description string
	WWWAuth     string
}

func (e *PartnerOAuthError) Error() string {
	if e.Description != "" {
		return e.Description
	}
	return e.Code
}

func partnerOAuthErr(status int, code, description string) *PartnerOAuthError {
	return &PartnerOAuthError{Status: status, Code: code, Description: description}
}

func AsPartnerOAuthError(err error) *PartnerOAuthError {
	var typed *PartnerOAuthError
	if errors.As(err, &typed) {
		return typed
	}
	return nil
}

func validPartnerOAuthClientID(clientID string) bool {
	return partnerOAuthClientIDPattern.MatchString(clientID)
}

func PartnerOAuthIssuer() (string, error) {
	raw := system_setting.ServerAddress
	if common.CustomDomainEnabled {
		raw = common.CustomDomainMainOrigin
	}
	issuer := strings.TrimRight(strings.TrimSpace(raw), "/")
	if issuer == "" {
		return "", partnerOAuthErr(http.StatusServiceUnavailable, "temporarily_unavailable", "authorization server is unavailable")
	}
	parsed, err := url.Parse(issuer)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", partnerOAuthErr(http.StatusServiceUnavailable, "temporarily_unavailable", "authorization server is unavailable")
	}
	return issuer, nil
}

func PartnerOAuthModelBaseURL() (string, error) {
	issuer, err := PartnerOAuthIssuer()
	if err != nil {
		return "", err
	}
	return issuer + "/v1", nil
}

func PartnerOAuthIssuerIsHTTP() bool {
	issuer, err := PartnerOAuthIssuer()
	if err != nil {
		return false
	}
	parsed, err := url.Parse(issuer)
	return err == nil && strings.EqualFold(parsed.Scheme, "http")
}

func PartnerOAuthHostAllowed(requestHost string, customDomainEnabled bool, isMainCallbackHost bool) bool {
	if customDomainEnabled {
		return isMainCallbackHost
	}
	issuer, err := PartnerOAuthIssuer()
	if err != nil {
		return false
	}
	parsed, err := url.Parse(issuer)
	if err != nil {
		return false
	}
	return strings.EqualFold(requestHost, parsed.Host)
}

func CanonicalPartnerOAuthScopes(raw string) (string, error) {
	parts := strings.Fields(raw)
	if len(parts) == 0 {
		return "", partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "scope is required")
	}
	seen := make(map[string]struct{}, len(parts))
	allowed := make(map[string]struct{}, len(partnerOAuthCanonicalScopes))
	for _, scope := range partnerOAuthCanonicalScopes {
		allowed[scope] = struct{}{}
	}
	selected := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		if _, ok := allowed[part]; !ok {
			return "", partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "scope is not allowed")
		}
		if _, ok := seen[part]; ok {
			return "", partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "scope must not be repeated")
		}
		seen[part] = struct{}{}
		selected[part] = struct{}{}
	}
	canonical := make([]string, 0, len(selected))
	for _, scope := range partnerOAuthCanonicalScopes {
		if _, ok := selected[scope]; ok {
			canonical = append(canonical, scope)
		}
	}
	return strings.Join(canonical, " "), nil
}

func ScopeSubsetOf(requested, allowed string) bool {
	allow := map[string]struct{}{}
	for _, part := range strings.Fields(allowed) {
		allow[part] = struct{}{}
	}
	for _, part := range strings.Fields(requested) {
		if _, ok := allow[part]; !ok {
			return false
		}
	}
	return true
}

func HasPartnerOAuthScope(granted, required string) bool {
	for _, part := range strings.Fields(granted) {
		if part == required {
			return true
		}
	}
	return false
}

func ValidatePartnerOAuthState(state string) error {
	if !partnerOAuthStatePattern.MatchString(state) {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_request", "state is invalid")
	}
	return nil
}

func ValidatePartnerOAuthCodeChallenge(challenge, method string) error {
	if method != "S256" {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_request", "code_challenge_method must be S256")
	}
	if !partnerOAuthChallengePattern.MatchString(challenge) {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_request", "code_challenge is invalid")
	}
	return nil
}

func ValidatePartnerOAuthCodeVerifier(verifier string) error {
	if !partnerOAuthVerifierPattern.MatchString(verifier) {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "code_verifier is invalid")
	}
	return nil
}

func PartnerOAuthPKCEChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func VerifyPartnerOAuthPKCE(challenge, verifier string) error {
	if err := ValidatePartnerOAuthCodeVerifier(verifier); err != nil {
		return err
	}
	computed := PartnerOAuthPKCEChallengeS256(verifier)
	if !hmac.Equal([]byte(computed), []byte(challenge)) {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "PKCE verification failed")
	}
	return nil
}

func isLoopbackHost(host string) bool {
	return host == "127.0.0.1" || host == "::1" || host == "[::1]"
}

func ValidatePartnerOAuthRedirectURI(raw string, publicClient bool) error {
	if raw == "" || len(raw) > 512 {
		return errors.New("redirect uri is invalid")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Fragment != "" || parsed.User != nil || !parsed.IsAbs() {
		return errors.New("redirect uri is invalid")
	}
	if parsed.Scheme == "https" {
		return nil
	}
	if publicClient && parsed.Scheme == "http" && isLoopbackHost(parsed.Hostname()) {
		return nil
	}
	return errors.New("redirect uri is invalid")
}

func MatchPartnerOAuthRedirectURI(registered []string, requested string, publicClient bool) bool {
	for _, item := range registered {
		if item == requested {
			return true
		}
	}
	if !publicClient {
		return false
	}
	requestedURL, err := url.Parse(requested)
	if err != nil || requestedURL.Scheme != "http" || !isLoopbackHost(requestedURL.Hostname()) {
		return false
	}
	for _, item := range registered {
		registeredURL, err := url.Parse(item)
		if err != nil || registeredURL.Scheme != "http" || !isLoopbackHost(registeredURL.Hostname()) {
			continue
		}
		if registeredURL.Hostname() == requestedURL.Hostname() &&
			registeredURL.Path == requestedURL.Path &&
			registeredURL.RawQuery == requestedURL.RawQuery {
			return true
		}
	}
	return false
}

func ParsePartnerOAuthRedirectURIs(raw string) ([]string, error) {
	var uris []string
	if err := common.UnmarshalJsonStr(raw, &uris); err != nil {
		return nil, err
	}
	return uris, nil
}

func ValidatePartnerOAuthClientName(name string) error {
	name = strings.TrimSpace(name)
	runes := []rune(name)
	if len(runes) < 1 || len(runes) > 64 {
		return errors.New("name must be 1-64 characters")
	}
	return nil
}

func ValidatePartnerOAuthClientRedirects(uris []string, publicClient bool) error {
	if len(uris) < 1 || len(uris) > 10 {
		return errors.New("redirect_uris must contain 1-10 entries")
	}
	seen := make(map[string]struct{}, len(uris))
	for _, uri := range uris {
		if _, ok := seen[uri]; ok {
			return errors.New("redirect_uris must be unique")
		}
		seen[uri] = struct{}{}
		if err := ValidatePartnerOAuthRedirectURI(uri, publicClient); err != nil {
			return err
		}
	}
	return nil
}

func GeneratePartnerOAuthClientSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "pcs_" + base64.RawURLEncoding.EncodeToString(buf), nil
}

func GeneratePartnerOAuthAccessToken() (string, error) {
	return generatePartnerOpaqueToken("oa_")
}

func GeneratePartnerOAuthRefreshToken() (string, error) {
	return generatePartnerOpaqueToken("or_")
}

func generatePartnerOpaqueToken(prefix string) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + base64.RawURLEncoding.EncodeToString(buf), nil
}

func GeneratePartnerOAuthBrowserNonce() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func HashPartnerOAuthBrowserNonce(nonce string) string {
	sum := sha256.Sum256([]byte(nonce))
	return hex.EncodeToString(sum[:])
}

func VerifyPartnerOAuthClientSecret(client *model.PartnerOAuthClient, secret string) bool {
	hash := partnerOAuthDummySecretHash
	if client != nil && client.SecretHash != "" {
		hash = client.SecretHash
	}
	computed := model.HashPartnerOAuthSecret(secret)
	return hmac.Equal([]byte(computed), []byte(hash)) && client != nil && client.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodBasic
}

func PartnerOAuthAccessTTL(bindingExpiresAt int64) int {
	remaining := bindingExpiresAt - time.Now().Unix()
	if remaining <= 0 {
		return 0
	}
	max := int64(PartnerOAuthAccessTokenTTL / time.Second)
	if remaining > max {
		return int(max)
	}
	return int(remaining)
}

func AppendPartnerOAuthCallback(redirectURI, state, issuer string, values url.Values) (string, error) {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	for key, items := range values {
		for _, item := range items {
			query.Add(key, item)
		}
	}
	if state != "" {
		query.Set("state", state)
	}
	query.Set("iss", issuer)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

type PartnerOAuthRequestPayload struct {
	ClientID         string `json:"client_id"`
	RedirectURI      string `json:"redirect_uri"`
	Scope            string `json:"scope"`
	State            string `json:"state"`
	CodeChallenge    string `json:"code_challenge"`
	BrowserNonceHash string `json:"browser_nonce_hash"`
}

type PartnerOAuthCodePayload struct {
	RedirectURI     string `json:"redirect_uri"`
	CodeChallenge   string `json:"code_challenge"`
	Scope           string `json:"scope"`
	UserAuthVersion int64  `json:"user_auth_version"`
}

type PartnerOAuthAuthorizationView struct {
	ClientName                string   `json:"client_name"`
	ClientID                  string   `json:"client_id"`
	Scopes                    []string `json:"scopes"`
	RedirectHost              string   `json:"redirect_host"`
	GrantExpiresAt            string   `json:"grant_expires_at"`
	ActiveBindingLimitReached bool     `json:"active_binding_limit_reached"`
}

type PartnerOAuthTokenResponse struct {
	AccessToken           string `json:"access_token"`
	TokenType             string `json:"token_type"`
	ExpiresIn             int    `json:"expires_in"`
	RefreshToken          string `json:"refresh_token,omitempty"`
	RefreshTokenExpiresIn int    `json:"refresh_token_expires_in,omitempty"`
	Scope                 string `json:"scope"`
	BindingID             string `json:"binding_id"`
}

type PartnerOAuthAccountResponse struct {
	Issuer         string `json:"issuer"`
	AccountID      string `json:"account_id"`
	DisplayName    string `json:"display_name,omitempty"`
	BindingID      string `json:"binding_id"`
	Scope          string `json:"scope"`
	GrantExpiresAt string `json:"grant_expires_at"`
}

type PartnerOAuthCredentialResponse struct {
	BindingID string `json:"binding_id"`
	AccountID string `json:"account_id"`
	KeyID     string `json:"key_id"`
	APIKey    string `json:"api_key"`
	BaseURL   string `json:"base_url"`
	ExpiresAt string `json:"expires_at"`
}

type PartnerOAuthBindingView struct {
	BindingID  string                      `json:"binding_id"`
	ClientID   string                      `json:"client_id"`
	ClientName string                      `json:"client_name"`
	Scopes     []string                    `json:"scopes"`
	CreatedAt  int64                       `json:"created_at"`
	ExpiresAt  int64                       `json:"expires_at"`
	Key        *PartnerOAuthBindingKeyView `json:"key"`
}

type PartnerOAuthBindingKeyView struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Status int    `json:"status"`
}

func BeginPartnerOAuthAuthorization(clientID, redirectURI, scope, state, challenge, method string) (requestToken, nonce, consentURL string, err error) {
	client, err := model.GetPartnerOAuthClientByClientID(clientID)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		return "", "", "", partnerOAuthErr(http.StatusBadRequest, "invalid_client", "client is invalid")
	}
	uris, err := ParsePartnerOAuthRedirectURIs(client.RedirectURIs)
	if err != nil {
		return "", "", "", partnerOAuthErr(http.StatusBadRequest, "invalid_client", "client is invalid")
	}
	if !MatchPartnerOAuthRedirectURI(uris, redirectURI, client.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodNone) {
		return "", "", "", partnerOAuthErr(http.StatusBadRequest, "invalid_redirect", "redirect_uri is not registered")
	}
	if err := ValidatePartnerOAuthState(state); err != nil {
		return "", "", "", err
	}
	if err := ValidatePartnerOAuthCodeChallenge(challenge, method); err != nil {
		return "", "", "", err
	}
	canonical, err := CanonicalPartnerOAuthScopes(scope)
	if err != nil {
		return "", "", "", err
	}
	if !ScopeSubsetOf(canonical, client.Scopes) {
		return "", "", "", partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "scope is not allowed for this client")
	}
	nonce, err = GeneratePartnerOAuthBrowserNonce()
	if err != nil {
		return "", "", "", err
	}
	payload, err := common.Marshal(PartnerOAuthRequestPayload{
		ClientID:         client.ClientId,
		RedirectURI:      redirectURI,
		Scope:            canonical,
		State:            state,
		CodeChallenge:    challenge,
		BrowserNonceHash: HashPartnerOAuthBrowserNonce(nonce),
	})
	if err != nil {
		return "", "", "", err
	}
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePartnerOAuthRequest,
		Provider:  client.ClientId,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(PartnerOAuthRequestTTL),
	})
	if err != nil {
		return "", "", "", err
	}
	return token, nonce, "/partner-authorize?request=" + url.QueryEscape(token), nil
}

func InspectPartnerOAuthAuthorization(requestToken, nonce string) (*PartnerOAuthAuthorizationView, error) {
	payload, err := loadPartnerOAuthRequest(requestToken, nonce)
	if err != nil {
		return nil, err
	}
	client, err := model.GetPartnerOAuthClientByClientID(payload.ClientID)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		return nil, partnerOAuthErr(http.StatusBadRequest, "access_denied", "authorization request is no longer valid")
	}
	parsed, err := url.Parse(payload.RedirectURI)
	if err != nil {
		return nil, partnerOAuthErr(http.StatusBadRequest, "access_denied", "authorization request is no longer valid")
	}
	host := parsed.Hostname()
	if parsed.Port() != "" && !((parsed.Scheme == "https" && parsed.Port() == "443") || (parsed.Scheme == "http" && parsed.Port() == "80")) {
		if ip := net.ParseIP(host); ip != nil && ip.To4() == nil {
			host = "[" + host + "]:" + parsed.Port()
		} else {
			host = host + ":" + parsed.Port()
		}
	}
	return &PartnerOAuthAuthorizationView{
		ClientName:                client.Name,
		ClientID:                  client.ClientId,
		Scopes:                    strings.Fields(payload.Scope),
		RedirectHost:              host,
		GrantExpiresAt:            time.Now().UTC().Add(PartnerOAuthGrantTTL).Format(time.RFC3339),
		ActiveBindingLimitReached: false,
	}, nil
}

func InspectPartnerOAuthAuthorizationForUser(requestToken, nonce string, userID int) (*PartnerOAuthAuthorizationView, error) {
	view, err := InspectPartnerOAuthAuthorization(requestToken, nonce)
	if err != nil {
		return nil, err
	}
	count, err := model.CountActivePartnerOAuthBindings(model.DB, userID, view.ClientID)
	if err != nil {
		return nil, err
	}
	view.ActiveBindingLimitReached = count >= model.PartnerOAuthMaxActiveBindings
	return view, nil
}

func DecidePartnerOAuthAuthorization(requestToken, nonce, decision string, user *model.User) (redirectTo string, clientID string, err error) {
	payload, err := loadPartnerOAuthRequest(requestToken, nonce)
	if err != nil {
		return "", "", err
	}
	issuer, err := PartnerOAuthIssuer()
	if err != nil {
		return "", "", err
	}
	client, err := model.GetPartnerOAuthClientByClientID(payload.ClientID)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		return "", "", partnerOAuthErr(http.StatusBadRequest, "access_denied", "authorization request is no longer valid")
	}
	uris, err := ParsePartnerOAuthRedirectURIs(client.RedirectURIs)
	if err != nil || !MatchPartnerOAuthRedirectURI(uris, payload.RedirectURI, client.TokenAuthMethod == model.PartnerOAuthTokenAuthMethodNone) {
		return "", "", partnerOAuthErr(http.StatusBadRequest, "access_denied", "authorization request is no longer valid")
	}
	var codeToken string
	_, err = model.ConsumeAuthFlowWithAction(requestToken, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposePartnerOAuthRequest,
		Provider: payload.ClientID,
	}, func(tx *gorm.DB, _ *model.AuthFlow) error {
		if decision != "approve" {
			return nil
		}
		if user.Status != common.UserStatusEnabled {
			return partnerOAuthErr(http.StatusForbidden, "account_disabled", "account is disabled")
		}
		count, countErr := model.CountActivePartnerOAuthBindings(tx, user.Id, payload.ClientID)
		if countErr != nil {
			return countErr
		}
		if count >= model.PartnerOAuthMaxActiveBindings {
			return partnerOAuthErr(http.StatusBadRequest, "access_denied", "active binding limit reached")
		}
		codePayload, marshalErr := common.Marshal(PartnerOAuthCodePayload{
			RedirectURI:     payload.RedirectURI,
			CodeChallenge:   payload.CodeChallenge,
			Scope:           payload.Scope,
			UserAuthVersion: user.AuthVersion,
		})
		if marshalErr != nil {
			return marshalErr
		}
		token, _, createErr := model.CreateAuthFlowWithTx(tx, model.AuthFlowCreate{
			Purpose:   model.AuthFlowPurposePartnerOAuthCode,
			Provider:  payload.ClientID,
			UserId:    user.Id,
			Payload:   string(codePayload),
			ExpiresAt: time.Now().Add(PartnerOAuthCodeTTL),
		})
		if createErr != nil {
			return createErr
		}
		codeToken = token
		return nil
	})
	if err != nil {
		if typed := AsPartnerOAuthError(err); typed != nil {
			return "", "", typed
		}
		if errors.Is(err, model.ErrAuthFlowConsumed) || errors.Is(err, model.ErrAuthFlowExpired) || errors.Is(err, model.ErrAuthFlowInvalid) {
			return "", "", partnerOAuthErr(http.StatusBadRequest, "access_denied", "authorization request is no longer valid")
		}
		return "", "", err
	}
	values := url.Values{}
	if decision == "approve" {
		if codeToken == "" {
			return "", "", partnerOAuthErr(http.StatusInternalServerError, "server_error", "authorization code was not issued")
		}
		values.Set("code", codeToken)
	} else {
		values.Set("error", "access_denied")
	}
	redirectTo, err = AppendPartnerOAuthCallback(payload.RedirectURI, payload.State, issuer, values)
	if err != nil {
		return "", "", err
	}
	return redirectTo, payload.ClientID, nil
}

func loadPartnerOAuthRequest(requestToken, nonce string) (*PartnerOAuthRequestPayload, error) {
	if requestToken == "" || nonce == "" {
		return nil, partnerOAuthErr(http.StatusForbidden, "access_denied", "please restart authorization from the third-party application")
	}
	flow, err := model.GetAuthFlow(requestToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposePartnerOAuthRequest})
	if err != nil {
		return nil, partnerOAuthErr(http.StatusForbidden, "access_denied", "please restart authorization from the third-party application")
	}
	var payload PartnerOAuthRequestPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		return nil, partnerOAuthErr(http.StatusForbidden, "access_denied", "please restart authorization from the third-party application")
	}
	if !hmac.Equal([]byte(payload.BrowserNonceHash), []byte(HashPartnerOAuthBrowserNonce(nonce))) {
		return nil, partnerOAuthErr(http.StatusForbidden, "access_denied", "please restart authorization from the third-party application")
	}
	return &payload, nil
}

func rfc3339UTC(unix int64) string {
	return time.Unix(unix, 0).UTC().Format(time.RFC3339)
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func PartnerOAuthHTMLEscape(value string) string {
	return html.EscapeString(value)
}

func IsPrintablePartnerOAuthErrorCode(code string) bool {
	switch code {
	case "invalid_client", "invalid_redirect", "invalid_request", "temporarily_unavailable", "server_error":
		return true
	default:
		return false
	}
}

func StripNonPrintable(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, value)
}

func ExchangePartnerOAuthCode(client *model.PartnerOAuthClient, code, redirectURI, verifier string) (*PartnerOAuthTokenResponse, error) {
	if client == nil {
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_client", "client is invalid")
	}
	match := model.AuthFlowMatch{Purpose: model.AuthFlowPurposePartnerOAuthCode, Provider: client.ClientId}
	var response *PartnerOAuthTokenResponse
	var validationErr error
	_, err := model.ConsumeAuthFlowWithAction(code, match, func(tx *gorm.DB, flow *model.AuthFlow) error {
		var payload PartnerOAuthCodePayload
		if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
			validationErr = partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
			return nil
		}
		if payload.RedirectURI != redirectURI {
			validationErr = partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
			return nil
		}
		if err := VerifyPartnerOAuthPKCE(payload.CodeChallenge, verifier); err != nil {
			validationErr = partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
			return nil
		}
		user, err := model.LockPartnerOAuthUserWithTx(tx, flow.UserId)
		if err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled || user.AuthVersion != payload.UserAuthVersion {
			validationErr = partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
			return nil
		}
		count, err := model.CountActivePartnerOAuthBindings(tx, user.Id, client.ClientId)
		if err != nil {
			return err
		}
		if count >= model.PartnerOAuthMaxActiveBindings {
			validationErr = partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
			return nil
		}
		accessRaw, err := GeneratePartnerOAuthAccessToken()
		if err != nil {
			return err
		}
		expiresAt := time.Now().Add(PartnerOAuthGrantTTL).Unix()
		accessTTL := PartnerOAuthAccessTTL(expiresAt)
		create := model.PartnerOAuthBindingCreate{
			ClientId:            client.ClientId,
			UserId:              user.Id,
			UserAuthVersion:     user.AuthVersion,
			Scope:               payload.Scope,
			AuthorizationFlowId: flow.Id,
			ExpiresAt:           expiresAt,
			AccessTokenHash:     model.HashPartnerOAuthToken(accessRaw),
			AccessExpiresAt:     time.Now().Add(time.Duration(accessTTL) * time.Second).Unix(),
		}
		var refreshRaw string
		if HasPartnerOAuthScope(payload.Scope, PartnerOAuthScopeOfflineAccess) {
			refreshRaw, err = GeneratePartnerOAuthRefreshToken()
			if err != nil {
				return err
			}
			create.RefreshTokenHash = model.HashPartnerOAuthToken(refreshRaw)
		}
		binding, err := model.CreatePartnerOAuthBindingWithTx(tx, create)
		if err != nil {
			return err
		}
		response = &PartnerOAuthTokenResponse{
			AccessToken: accessRaw,
			TokenType:   "Bearer",
			ExpiresIn:   accessTTL,
			Scope:       payload.Scope,
			BindingID:   binding.BindingId,
		}
		if refreshRaw != "" {
			response.RefreshToken = refreshRaw
			response.RefreshTokenExpiresIn = int(expiresAt - time.Now().Unix())
		}
		return nil
	})
	if errors.Is(err, model.ErrAuthFlowConsumed) {
		if flow, lookupErr := model.LookupAuthFlow(code, match); lookupErr == nil {
			_ = model.RevokePartnerOAuthBindingByAuthorizationFlow(flow.Id, "code_replay")
		}
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
	}
	if errors.Is(err, model.ErrAuthFlowExpired) || errors.Is(err, model.ErrAuthFlowInvalid) {
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
	}
	if err != nil {
		return nil, err
	}
	if validationErr != nil {
		return nil, validationErr
	}
	if response == nil {
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "authorization grant is invalid")
	}
	return response, nil
}

func RefreshPartnerOAuthToken(client *model.PartnerOAuthClient, refreshToken, requestedScope string) (*PartnerOAuthTokenResponse, error) {
	if client == nil {
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_client", "client is invalid")
	}
	hash := model.HashPartnerOAuthToken(refreshToken)
	var response *PartnerOAuthTokenResponse
	var replay bool
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		token, err := model.FindPartnerOAuthTokenWithTx(tx, hash)
		if err != nil {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		if token.Kind != model.PartnerOAuthTokenKindRefresh {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		binding, err := model.LockPartnerOAuthBindingWithTx(tx, token.BindingId)
		if err != nil {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		if binding.ClientId != client.ClientId ||
			binding.Status != model.PartnerOAuthBindingStatusActive ||
			binding.ExpiresAt <= time.Now().Unix() ||
			token.ExpiresAt <= time.Now().Unix() ||
			token.Status == model.PartnerOAuthTokenStatusRevoked {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		user, err := model.LockPartnerOAuthUserWithTx(tx, binding.UserId)
		if err != nil || user.Status != common.UserStatusEnabled || user.AuthVersion != binding.UserAuthVersion {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		if token.Status == model.PartnerOAuthTokenStatusRotated {
			replay = true
			return nil
		}
		if requestedScope != "" && !ScopeSubsetOf(requestedScope, binding.Scope) {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "requested scope exceeds the granted scope")
		}
		accessRaw, err := GeneratePartnerOAuthAccessToken()
		if err != nil {
			return err
		}
		refreshRaw, err := GeneratePartnerOAuthRefreshToken()
		if err != nil {
			return err
		}
		accessTTL := PartnerOAuthAccessTTL(binding.ExpiresAt)
		if accessTTL <= 0 {
			return partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
		}
		if err := model.RotatePartnerOAuthRefreshToken(
			tx,
			token,
			model.HashPartnerOAuthToken(accessRaw),
			model.HashPartnerOAuthToken(refreshRaw),
			time.Now().Add(time.Duration(accessTTL)*time.Second).Unix(),
		); err != nil {
			if errors.Is(err, model.ErrPartnerOAuthRefreshReused) {
				replay = true
				return nil
			}
			return err
		}
		response = &PartnerOAuthTokenResponse{
			AccessToken:           accessRaw,
			TokenType:             "Bearer",
			ExpiresIn:             accessTTL,
			RefreshToken:          refreshRaw,
			RefreshTokenExpiresIn: int(binding.ExpiresAt - time.Now().Unix()),
			Scope:                 binding.Scope,
			BindingID:             binding.BindingId,
		}
		return nil
	})
	if replay {
		token, lookupErr := model.FindPartnerOAuthToken(hash)
		if lookupErr == nil {
			_ = model.DB.Transaction(func(tx *gorm.DB) error {
				return model.RevokePartnerOAuthBindingWithTx(tx, token.BindingId, "refresh_reuse")
			})
		}
		return nil, fmt.Errorf("%w: %w", partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid"), ErrPartnerOAuthRefreshReuse)
	}
	if typed := AsPartnerOAuthError(err); typed != nil {
		return nil, typed
	}
	if err != nil {
		return nil, err
	}
	if response == nil {
		return nil, partnerOAuthErr(http.StatusBadRequest, "invalid_grant", "refresh token is invalid")
	}
	return response, nil
}

// RevokePartnerOAuthToken returns the revoked binding ID, or "" when the token
// matched no active binding of this client (still a successful RFC 7009 revoke).
func RevokePartnerOAuthToken(client *model.PartnerOAuthClient, rawToken string) (string, error) {
	if client == nil || rawToken == "" {
		return "", nil
	}
	token, err := model.FindPartnerOAuthToken(model.HashPartnerOAuthToken(rawToken))
	if err != nil {
		return "", nil
	}
	binding, err := model.GetPartnerOAuthBindingByBindingID(token.BindingId)
	if err != nil || binding.ClientId != client.ClientId || binding.Status != model.PartnerOAuthBindingStatusActive {
		return "", nil
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		return model.RevokePartnerOAuthBindingWithTx(tx, binding.BindingId, "revoked")
	})
	if err != nil {
		return "", err
	}
	return binding.BindingId, nil
}

type PartnerOAuthAccessPrincipal struct {
	Binding *model.PartnerOAuthBinding
	User    *model.User
	Client  *model.PartnerOAuthClient
}

func AuthenticatePartnerOAuthAccessToken(rawToken, requiredScope string) (*PartnerOAuthAccessPrincipal, error) {
	if rawToken == "" {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	token, err := model.FindPartnerOAuthToken(model.HashPartnerOAuthToken(rawToken))
	if err != nil || token.Kind != model.PartnerOAuthTokenKindAccess || token.Status != model.PartnerOAuthTokenStatusActive || token.ExpiresAt <= time.Now().Unix() {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	binding, err := model.GetPartnerOAuthBindingByBindingID(token.BindingId)
	if err != nil || binding.Status != model.PartnerOAuthBindingStatusActive || binding.ExpiresAt <= time.Now().Unix() {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	client, err := model.GetPartnerOAuthClientByClientID(binding.ClientId)
	if err != nil || client.Status != model.PartnerOAuthClientStatusEnabled {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	user, err := model.GetUserById(binding.UserId, false)
	if err != nil {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	if user.AuthVersion != binding.UserAuthVersion {
		return nil, partnerOAuthErr(http.StatusUnauthorized, "invalid_token", "access token is invalid")
	}
	if user.Status != common.UserStatusEnabled {
		return nil, partnerOAuthErr(http.StatusForbidden, "account_disabled", "account is disabled")
	}
	if requiredScope != "" && !HasPartnerOAuthScope(binding.Scope, requiredScope) {
		return nil, &PartnerOAuthError{
			Status:      http.StatusForbidden,
			Code:        "insufficient_scope",
			Description: "the access token is missing the required scope",
			WWWAuth:     fmt.Sprintf(`Bearer realm="integration", error="insufficient_scope", scope="%s"`, requiredScope),
		}
	}
	return &PartnerOAuthAccessPrincipal{Binding: binding, User: user, Client: client}, nil
}

func BuildPartnerOAuthAccount(principal *PartnerOAuthAccessPrincipal) (*PartnerOAuthAccountResponse, error) {
	issuer, err := PartnerOAuthIssuer()
	if err != nil {
		return nil, err
	}
	displayName := strings.TrimSpace(principal.User.DisplayName)
	if displayName == "" {
		displayName = principal.User.Username
	}
	return &PartnerOAuthAccountResponse{
		Issuer:         issuer,
		AccountID:      model.PartnerOAuthAccountID(principal.User.Id),
		DisplayName:    displayName,
		BindingID:      principal.Binding.BindingId,
		Scope:          principal.Binding.Scope,
		GrantExpiresAt: rfc3339UTC(principal.Binding.ExpiresAt),
	}, nil
}

func IssuePartnerOAuthCredential(principal *PartnerOAuthAccessPrincipal) (*PartnerOAuthCredentialResponse, error) {
	baseURL, err := PartnerOAuthModelBaseURL()
	if err != nil {
		return nil, err
	}
	key, err := common.GenerateKey()
	if err != nil {
		return nil, err
	}
	group := ""
	if setting.DefaultUseAutoGroup {
		group = "auto"
	}
	token, err := model.IssuePartnerOAuthCredential(principal.Binding.BindingId, model.PartnerOAuthCredentialIssue{
		UserId:      principal.User.Id,
		Name:        truncateRunes(principal.Client.Name, 50),
		Group:       group,
		ExpiredTime: principal.Binding.ExpiresAt,
		Key:         key,
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, partnerOAuthErr(http.StatusNotFound, "credential_not_found", "the authorized API key was not found")
		}
		return nil, err
	}
	if token.DeletedAt.Valid {
		return nil, partnerOAuthErr(http.StatusNotFound, "credential_not_found", "the authorized API key was not found")
	}
	now := time.Now().Unix()
	if token.Status == common.TokenStatusDisabled {
		return nil, partnerOAuthErr(http.StatusForbidden, "credential_disabled", "the authorized API key is disabled")
	}
	if token.Status == common.TokenStatusExpired || (token.ExpiredTime > 0 && token.ExpiredTime <= now) {
		return nil, partnerOAuthErr(http.StatusForbidden, "credential_expired", "the authorized API key has expired")
	}
	expiresAt := token.ExpiredTime
	if expiresAt <= 0 || expiresAt > principal.Binding.ExpiresAt {
		expiresAt = principal.Binding.ExpiresAt
	}
	return &PartnerOAuthCredentialResponse{
		BindingID: principal.Binding.BindingId,
		AccountID: model.PartnerOAuthAccountID(principal.User.Id),
		KeyID:     model.PartnerOAuthKeyID(token.Id),
		APIKey:    "sk-" + token.Key,
		BaseURL:   baseURL,
		ExpiresAt: rfc3339UTC(expiresAt),
	}, nil
}

func ListUserPartnerOAuthBindings(userID int) ([]PartnerOAuthBindingView, error) {
	bindings, err := model.ListActivePartnerOAuthBindingsByUser(userID, 100)
	if err != nil {
		return nil, err
	}
	views := make([]PartnerOAuthBindingView, 0, len(bindings))
	for i := range bindings {
		client, clientErr := model.GetPartnerOAuthClientByClientID(bindings[i].ClientId)
		if clientErr != nil {
			continue
		}
		view := PartnerOAuthBindingView{
			BindingID:  bindings[i].BindingId,
			ClientID:   bindings[i].ClientId,
			ClientName: client.Name,
			Scopes:     strings.Fields(bindings[i].Scope),
			CreatedAt:  bindings[i].CreatedAt,
			ExpiresAt:  bindings[i].ExpiresAt,
		}
		if bindings[i].TokenId > 0 {
			var token model.Token
			if loadErr := model.DB.Unscoped().Where("id = ? AND user_id = ?", bindings[i].TokenId, userID).First(&token).Error; loadErr == nil && !token.DeletedAt.Valid {
				view.Key = &PartnerOAuthBindingKeyView{ID: token.Id, Name: token.Name, Status: token.Status}
			}
		}
		views = append(views, view)
	}
	return views, nil
}

const (
	PartnerOAuthRevokeReasonUser  = "user_revoked"
	PartnerOAuthRevokeReasonAdmin = "admin_revoked"
)

func RevokeUserPartnerOAuthBinding(userID int, bindingID, reason string) error {
	if reason != PartnerOAuthRevokeReasonUser && reason != PartnerOAuthRevokeReasonAdmin {
		return partnerOAuthErr(http.StatusBadRequest, "invalid_request", "revoke reason is invalid")
	}
	binding, err := model.GetPartnerOAuthBindingByBindingID(bindingID)
	if err != nil || binding.UserId != userID || binding.Status != model.PartnerOAuthBindingStatusActive {
		return partnerOAuthErr(http.StatusNotFound, "PARTNER_OAUTH_BINDING_NOT_FOUND", "binding not found")
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		return model.RevokePartnerOAuthBindingWithTx(tx, binding.BindingId, reason)
	})
}

func CleanupExpiredPartnerOAuthTokens() error {
	return model.DeleteExpiredPartnerOAuthTokens(time.Now().Unix())
}
