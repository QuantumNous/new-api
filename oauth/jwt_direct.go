package oauth

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/tidwall/gjson"
)

type JWTDirectProvider struct {
	config *model.CustomOAuthProvider
}

type JWTDirectIdentity struct {
	User       *OAuthUser
	ClaimsJSON []byte
	Group      string
	Role       int
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

func NewJWTDirectProvider(config *model.CustomOAuthProvider) *JWTDirectProvider {
	return &JWTDirectProvider{config: config}
}

func (p *JWTDirectProvider) GetName() string {
	return p.config.Name
}

func (p *JWTDirectProvider) IsEnabled() bool {
	return p.config.Enabled
}

func (p *JWTDirectProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	return nil, errors.New("jwt_direct provider does not support authorization code exchange")
}

func (p *JWTDirectProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	return nil, errors.New("jwt_direct provider does not support userinfo fetch")
}

func (p *JWTDirectProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsProviderUserIdTaken(p.config.Id, providerUserID)
}

func (p *JWTDirectProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	foundUser, err := model.GetUserByOAuthBinding(p.config.Id, providerUserID)
	if err != nil {
		return err
	}
	*user = *foundUser
	return nil
}

func (p *JWTDirectProvider) SetProviderUserID(user *model.User, providerUserID string) {
	// JWT direct providers persist bindings in user_oauth_bindings.
}

func (p *JWTDirectProvider) GetProviderPrefix() string {
	return p.config.Slug + "_"
}

func (p *JWTDirectProvider) GetProviderId() int {
	return p.config.Id
}

func (p *JWTDirectProvider) ResolveIdentityFromInput(ctx context.Context, rawToken string, ticket string, callbackURL string, state string) (*JWTDirectIdentity, error) {
	if p.config.GetJWTAcquireMode() == model.CustomJWTAcquireModeTicketExchange {
		exchangedToken, err := p.exchangeTicketForJWT(ctx, ticket, callbackURL, state)
		if err != nil {
			return nil, err
		}
		rawToken = exchangedToken
	}
	return p.ResolveIdentity(ctx, rawToken)
}

func (p *JWTDirectProvider) ResolveIdentity(ctx context.Context, rawToken string) (*JWTDirectIdentity, error) {
	tokenString := normalizeJWTToken(rawToken)
	if tokenString == "" {
		return nil, errors.New("missing jwt token")
	}

	claims, err := p.parseAndValidateClaims(ctx, tokenString)
	if err != nil {
		return nil, err
	}
	claimsJSON, err := common.Marshal(claims)
	if err != nil {
		return nil, fmt.Errorf("marshal jwt claims failed: %w", err)
	}

	userID := firstClaimValue(claimsJSON, p.config.UserIdField)
	if userID == "" {
		return nil, errors.New("jwt claims missing external user id")
	}

	username := firstClaimValue(claimsJSON, p.config.UsernameField)
	displayName := firstClaimValue(claimsJSON, p.config.DisplayNameField)
	email := firstClaimValue(claimsJSON, p.config.EmailField)

	policyRaw := strings.TrimSpace(p.config.AccessPolicy)
	if policyRaw != "" {
		policy, err := parseAccessPolicy(policyRaw)
		if err != nil {
			return nil, fmt.Errorf("invalid access policy configuration: %w", err)
		}
		allowed, failure := evaluateAccessPolicy(string(claimsJSON), policy)
		if !allowed {
			message := renderAccessDeniedMessage(
				p.config.AccessDeniedMessage,
				p.config.Name,
				string(claimsJSON),
				failure,
			)
			return nil, &AccessDeniedError{Message: message}
		}
	}

	return &JWTDirectIdentity{
		User: &OAuthUser{
			ProviderUserID: userID,
			Username:       username,
			DisplayName:    displayName,
			Email:          email,
			Extra: map[string]any{
				"provider": p.config.Slug,
			},
		},
		ClaimsJSON: claimsJSON,
		Group:      resolveMappedGroup(claimsJSON, p.config),
		Role:       resolveMappedRole(claimsJSON, p.config),
	}, nil
}

func (p *JWTDirectProvider) exchangeTicketForJWT(ctx context.Context, ticket string, callbackURL string, state string) (string, error) {
	ticket = strings.TrimSpace(ticket)
	if ticket == "" {
		return "", errors.New("missing ticket for jwt exchange")
	}

	targetURL := strings.TrimSpace(p.config.TicketExchangeURL)
	if targetURL == "" {
		return "", errors.New("ticket exchange url is not configured")
	}

	parsedURL, err := url.Parse(targetURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return "", errors.New("ticket exchange url is invalid")
	}

	params := parseStringMapping(p.config.TicketExchangeExtraParams)
	headers := parseStringMapping(p.config.TicketExchangeHeaders)
	ticketField := strings.TrimSpace(p.config.TicketExchangeTicketField)
	if ticketField == "" {
		ticketField = "ticket"
	}
	params[ticketField] = ticket
	if serviceField := strings.TrimSpace(p.config.TicketExchangeServiceField); serviceField != "" && strings.TrimSpace(callbackURL) != "" {
		params[serviceField] = callbackURL
	}

	placeholderValues := map[string]string{
		"ticket":        ticket,
		"callback_url":  callbackURL,
		"provider_slug": p.config.Slug,
		"state":         state,
	}
	for key, value := range params {
		params[key] = replaceJWTExchangePlaceholders(value, placeholderValues)
	}
	for key, value := range headers {
		headers[key] = replaceJWTExchangePlaceholders(value, placeholderValues)
	}

	method := normalizeTicketExchangeMethod(p.config.TicketExchangeMethod)
	payloadMode := normalizeTicketExchangePayloadMode(p.config.TicketExchangePayloadMode)

	var body io.Reader
	switch method {
	case model.CustomTicketExchangeMethodGET:
		appendExchangeQueryParams(parsedURL, params)
	case model.CustomTicketExchangeMethodPOST:
		switch payloadMode {
		case model.CustomTicketExchangePayloadModeQuery:
			appendExchangeQueryParams(parsedURL, params)
		case model.CustomTicketExchangePayloadModeForm:
			values := url.Values{}
			for key, value := range params {
				values.Set(key, value)
			}
			body = strings.NewReader(values.Encode())
			headers["Content-Type"] = "application/x-www-form-urlencoded"
		case model.CustomTicketExchangePayloadModeJSON:
			payload, marshalErr := common.Marshal(params)
			if marshalErr != nil {
				return "", fmt.Errorf("marshal ticket exchange payload failed: %w", marshalErr)
			}
			body = bytes.NewReader(payload)
			headers["Content-Type"] = "application/json"
		case model.CustomTicketExchangePayloadModeMultipart:
			var buffer bytes.Buffer
			writer := multipart.NewWriter(&buffer)
			for key, value := range params {
				if fieldErr := writer.WriteField(key, value); fieldErr != nil {
					return "", fmt.Errorf("build multipart exchange payload failed: %w", fieldErr)
				}
			}
			if closeErr := writer.Close(); closeErr != nil {
				return "", fmt.Errorf("close multipart exchange payload failed: %w", closeErr)
			}
			body = &buffer
			headers["Content-Type"] = writer.FormDataContentType()
		default:
			return "", errors.New("ticket exchange payload mode is invalid")
		}
	default:
		return "", errors.New("ticket exchange method is invalid")
	}

	req, err := http.NewRequestWithContext(ctx, method, parsedURL.String(), body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")
	for key, value := range headers {
		if strings.TrimSpace(key) == "" {
			continue
		}
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("ticket exchange failed: %s %s", resp.Status, strings.TrimSpace(string(responseBody)))
	}

	token := extractExchangedJWT(responseBody, p.config.TicketExchangeTokenField)
	if token == "" {
		return "", errors.New("ticket exchange response missing jwt token")
	}
	return token, nil
}

func (p *JWTDirectProvider) parseAndValidateClaims(ctx context.Context, tokenString string) (jwt.MapClaims, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if token.Method == nil || token.Method.Alg() == "" || token.Method.Alg() == "none" {
			return nil, errors.New("unsupported jwt signing algorithm")
		}
		return p.resolveVerificationKey(ctx, token)
	})
	if err != nil {
		return nil, fmt.Errorf("jwt verification failed: %w", err)
	}
	if token == nil || !token.Valid {
		return nil, errors.New("jwt token is invalid")
	}

	if issuer := strings.TrimSpace(p.config.Issuer); issuer != "" {
		gotIssuer, err := claims.GetIssuer()
		if err != nil || strings.TrimSpace(gotIssuer) != issuer {
			return nil, errors.New("jwt issuer mismatch")
		}
	}
	if audience := strings.TrimSpace(p.config.Audience); audience != "" {
		gotAudience, err := claims.GetAudience()
		if err != nil || !stringSliceContains(gotAudience, audience) {
			return nil, errors.New("jwt audience mismatch")
		}
	}
	return claims, nil
}

func (p *JWTDirectProvider) resolveVerificationKey(ctx context.Context, token *jwt.Token) (any, error) {
	if strings.TrimSpace(p.config.PublicKey) != "" {
		return parsePEMPublicKey(p.config.PublicKey)
	}
	if strings.TrimSpace(p.config.JwksURL) == "" {
		return nil, errors.New("jwt verification key is not configured")
	}
	return fetchJWKSKey(ctx, p.config.JwksURL, token)
}

func normalizeJWTToken(raw string) string {
	value := strings.TrimSpace(raw)
	if strings.HasPrefix(strings.ToLower(value), "bearer ") {
		value = strings.TrimSpace(value[7:])
	}
	return value
}

func appendExchangeQueryParams(targetURL *url.URL, params map[string]string) {
	query := targetURL.Query()
	for key, value := range params {
		if strings.TrimSpace(key) == "" {
			continue
		}
		query.Set(key, value)
	}
	targetURL.RawQuery = query.Encode()
}

func replaceJWTExchangePlaceholders(input string, values map[string]string) string {
	result := input
	for key, value := range values {
		result = strings.ReplaceAll(result, "{"+key+"}", value)
	}
	return result
}

func extractExchangedJWT(body []byte, tokenField string) string {
	if len(body) == 0 {
		return ""
	}

	candidates := []string{}
	if strings.TrimSpace(tokenField) != "" {
		candidates = append(candidates, strings.TrimSpace(tokenField))
	}
	candidates = append(candidates,
		"token",
		"access_token",
		"data.token",
		"data.access_token",
		"result.token",
		"result.access_token",
		"data",
	)

	for _, candidate := range candidates {
		result := gjson.GetBytes(body, candidate)
		if result.Exists() {
			value := normalizeJWTToken(result.String())
			if looksLikeJWT(value) {
				return value
			}
		}
	}

	trimmed := normalizeJWTToken(string(bytes.TrimSpace(body)))
	if looksLikeJWT(trimmed) {
		return trimmed
	}

	var payload any
	if err := json.Unmarshal(body, &payload); err == nil {
		if str, ok := payload.(string); ok {
			value := normalizeJWTToken(str)
			if looksLikeJWT(value) {
				return value
			}
		}
	}

	return ""
}

func looksLikeJWT(raw string) bool {
	parts := strings.Split(strings.TrimSpace(raw), ".")
	return len(parts) == 3 && parts[0] != "" && parts[1] != "" && parts[2] != ""
}

func normalizeTicketExchangeMethod(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "", model.CustomTicketExchangeMethodGET:
		return model.CustomTicketExchangeMethodGET
	case model.CustomTicketExchangeMethodPOST:
		return model.CustomTicketExchangeMethodPOST
	default:
		return ""
	}
}

func normalizeTicketExchangePayloadMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", model.CustomTicketExchangePayloadModeQuery:
		return model.CustomTicketExchangePayloadModeQuery
	case model.CustomTicketExchangePayloadModeForm:
		return model.CustomTicketExchangePayloadModeForm
	case model.CustomTicketExchangePayloadModeJSON:
		return model.CustomTicketExchangePayloadModeJSON
	case model.CustomTicketExchangePayloadModeMultipart:
		return model.CustomTicketExchangePayloadModeMultipart
	default:
		return ""
	}
}

func parsePEMPublicKey(raw string) (any, error) {
	pemData := []byte(strings.TrimSpace(raw))
	if len(pemData) == 0 {
		return nil, errors.New("empty public key")
	}
	if key, err := jwt.ParseRSAPublicKeyFromPEM(pemData); err == nil {
		return key, nil
	}
	if key, err := jwt.ParseECPublicKeyFromPEM(pemData); err == nil {
		return key, nil
	}
	if key, err := jwt.ParseEdPublicKeyFromPEM(pemData); err == nil {
		return key, nil
	}
	return nil, errors.New("unsupported public key format")
}

func fetchJWKSKey(ctx context.Context, jwksURL string, token *jwt.Token) (any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("jwks request failed: %s %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var doc jwksDocument
	if err := common.DecodeJson(resp.Body, &doc); err != nil {
		return nil, err
	}
	if len(doc.Keys) == 0 {
		return nil, errors.New("jwks document has no keys")
	}

	selected, err := selectJWK(doc.Keys, token)
	if err != nil {
		return nil, err
	}
	return jwkToPublicKey(selected)
}

func selectJWK(keys []jwkKey, token *jwt.Token) (*jwkKey, error) {
	kid, _ := token.Header["kid"].(string)
	alg := ""
	if token.Method != nil {
		alg = token.Method.Alg()
	}
	if kid != "" {
		for i := range keys {
			if keys[i].Kid == kid && (keys[i].Use == "" || keys[i].Use == "sig") {
				return &keys[i], nil
			}
		}
		return nil, fmt.Errorf("jwks key with kid %q not found", kid)
	}
	for i := range keys {
		if keys[i].Use != "" && keys[i].Use != "sig" {
			continue
		}
		if keys[i].Alg == "" || alg == "" || keys[i].Alg == alg {
			return &keys[i], nil
		}
	}
	if len(keys) == 1 {
		return &keys[0], nil
	}
	return nil, errors.New("unable to select jwks key")
}

func jwkToPublicKey(key *jwkKey) (any, error) {
	switch key.Kty {
	case "RSA":
		return jwkToRSAPublicKey(key)
	case "EC":
		return jwkToECPublicKey(key)
	case "OKP":
		return jwkToEd25519PublicKey(key)
	default:
		return nil, fmt.Errorf("unsupported jwk key type: %s", key.Kty)
	}
}

func jwkToRSAPublicKey(key *jwkKey) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, fmt.Errorf("decode rsa modulus failed: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, fmt.Errorf("decode rsa exponent failed: %w", err)
	}
	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)
	return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
}

func jwkToECPublicKey(key *jwkKey) (*ecdsa.PublicKey, error) {
	var curve elliptic.Curve
	switch key.Crv {
	case "P-256":
		curve = elliptic.P256()
	case "P-384":
		curve = elliptic.P384()
	case "P-521":
		curve = elliptic.P521()
	default:
		return nil, fmt.Errorf("unsupported ec curve: %s", key.Crv)
	}
	xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
	if err != nil {
		return nil, fmt.Errorf("decode ec x failed: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
	if err != nil {
		return nil, fmt.Errorf("decode ec y failed: %w", err)
	}
	return &ecdsa.PublicKey{
		Curve: curve,
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}

func jwkToEd25519PublicKey(key *jwkKey) (ed25519.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
	if err != nil {
		return nil, fmt.Errorf("decode ed25519 key failed: %w", err)
	}
	return ed25519.PublicKey(xBytes), nil
}

func firstClaimValue(claimsJSON []byte, path string) string {
	values := extractClaimCandidates(claimsJSON, path)
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func extractClaimCandidates(claimsJSON []byte, path string) []string {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	result := gjson.GetBytes(claimsJSON, path)
	if !result.Exists() {
		return nil
	}
	if result.IsArray() {
		candidates := make([]string, 0, len(result.Array()))
		for _, item := range result.Array() {
			value := strings.TrimSpace(item.String())
			if value != "" {
				candidates = append(candidates, value)
			}
		}
		return candidates
	}
	value := strings.TrimSpace(result.String())
	if value == "" {
		return nil
	}
	return []string{value}
}

func resolveMappedGroup(claimsJSON []byte, config *model.CustomOAuthProvider) string {
	candidates := extractClaimCandidates(claimsJSON, config.GroupField)
	if len(candidates) == 0 {
		return ""
	}
	mapping := parseStringMapping(config.GroupMapping)
	for _, candidate := range candidates {
		if mapped, ok := mapping[candidate]; ok {
			if isExistingGroup(mapped) {
				return mapped
			}
			continue
		}
		if isMappingFirstMode(config.GroupMappingMode) && isExistingGroup(candidate) {
			return candidate
		}
	}
	return ""
}

func resolveMappedRole(claimsJSON []byte, config *model.CustomOAuthProvider) int {
	candidates := extractClaimCandidates(claimsJSON, config.RoleField)
	if len(candidates) == 0 {
		return 0
	}
	mapping := parseStringMapping(config.RoleMapping)
	for _, candidate := range candidates {
		if mapped, ok := mapping[candidate]; ok {
			if role := parseRoleValue(mapped); role != 0 {
				return role
			}
			continue
		}
		if isMappingFirstMode(config.RoleMappingMode) {
			if role := parseRoleValue(candidate); role != 0 {
				return role
			}
		}
	}
	return 0
}

func isMappingFirstMode(mode string) bool {
	return strings.EqualFold(strings.TrimSpace(mode), model.CustomOAuthMappingModeMappingFirst)
}

func parseRoleValue(raw string) int {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "common", "user", "member", "1":
		return common.RoleCommonUser
	case "admin", "administrator", "10":
		return common.RoleAdminUser
	default:
		return 0
	}
}

func isSyncableRole(role int) bool {
	switch role {
	case common.RoleCommonUser, common.RoleAdminUser:
		return true
	default:
		return false
	}
}

func parseStringMapping(raw string) map[string]string {
	payload := make(map[string]any)
	if strings.TrimSpace(raw) == "" {
		return map[string]string{}
	}
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		common.SysError("failed to parse custom auth mapping: " + err.Error())
		return map[string]string{}
	}
	result := make(map[string]string, len(payload))
	for key, value := range payload {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(fmt.Sprint(value))
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		result[trimmedKey] = trimmedValue
	}
	return result
}

func isExistingGroup(group string) bool {
	group = strings.TrimSpace(group)
	if group == "" {
		return false
	}
	if setting.ContainsAutoGroup(group) {
		return true
	}
	_, ok := ratio_setting.GetGroupRatioCopy()[group]
	return ok
}

func stringSliceContains(values []string, target string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) == target {
			return true
		}
	}
	return false
}
