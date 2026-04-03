package oauth

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type CASProvider struct {
	config *model.CustomOAuthProvider
}

type CASIdentity struct {
	User       *OAuthUser
	ClaimsJSON []byte
	Group      string
	Role       int
}

var casSensitiveResponsePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)("?(?:access_token|refresh_token|id_token|token|password|passwd|secret)"?\s*[:=]\s*"?)([^",<\s]+)`),
	regexp.MustCompile(`(?i)(<(?:access_token|refresh_token|id_token|token|password|passwd|secret)>)([^<]*)(</(?:access_token|refresh_token|id_token|token|password|passwd|secret)>)`),
}

func NewCASProvider(config *model.CustomOAuthProvider) *CASProvider {
	return &CASProvider{config: config}
}

func (p *CASProvider) GetName() string {
	return p.config.Name
}

func (p *CASProvider) IsEnabled() bool {
	return p.config.Enabled
}

func (p *CASProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	return nil, errors.New("cas provider does not support authorization code exchange")
}

func (p *CASProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	return nil, errors.New("cas provider does not support userinfo fetch")
}

func (p *CASProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsProviderUserIdTaken(p.config.Id, providerUserID)
}

func (p *CASProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	foundUser, err := model.GetUserByOAuthBinding(p.config.Id, providerUserID)
	if err != nil {
		return err
	}
	*user = *foundUser
	return nil
}

func (p *CASProvider) SetProviderUserID(user *model.User, providerUserID string) {
}

func (p *CASProvider) GetProviderPrefix() string {
	return p.config.Slug + "_"
}

func (p *CASProvider) GetProviderId() int {
	return p.config.Id
}

func (p *CASProvider) BuildLoginURL(serviceURL string) (string, error) {
	loginURL := p.config.GetCASLoginURL()
	if !isValidAbsoluteCASHTTPURL(loginURL) {
		return "", errors.New("cas login url is invalid")
	}
	parsed, err := url.Parse(loginURL)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	query.Set("service", serviceURL)
	if p.config.Renew {
		query.Set("renew", "true")
	}
	if p.config.Gateway {
		query.Set("gateway", "true")
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func (p *CASProvider) ResolveIdentityFromTicket(ctx context.Context, ticket string, serviceURL string) (*CASIdentity, error) {
	ticket = strings.TrimSpace(ticket)
	if ticket == "" {
		return nil, NewOAuthError(i18n.MsgOAuthTicketMissing, nil)
	}

	validateURL := p.config.GetCASValidateURL()
	if !isValidAbsoluteCASHTTPURL(validateURL) {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, "cas validate url is invalid")
	}

	parsed, err := url.Parse(validateURL)
	if err != nil {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	query := parsed.Query()
	query.Set("ticket", ticket)
	query.Set("service", serviceURL)
	if p.config.Renew {
		query.Set("renew", "true")
	}
	parsed.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	req.Header.Set("Accept", "application/json, application/xml, text/xml, text/plain, */*")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		errorSummary := sanitizeCASValidationErrorBody(string(body))
		if errorSummary == "" {
			errorSummary = "empty response body"
		}
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, fmt.Sprintf("%s %s", resp.Status, errorSummary))
	}

	claimsJSON, err := parseTicketValidationClaims(body)
	if err != nil {
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	return p.resolveIdentityFromClaimsJSON(claimsJSON)
}

func (p *CASProvider) resolveIdentityFromClaimsJSON(claimsJSON []byte) (*CASIdentity, error) {
	if len(claimsJSON) == 0 {
		return nil, errors.New("cas validation response is empty")
	}

	userID := firstClaimValue(claimsJSON, p.config.UserIdField)
	if userID == "" {
		return nil, errors.New("cas response missing external user id")
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

	return &CASIdentity{
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

func isValidAbsoluteCASHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed == nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	return strings.TrimSpace(parsed.Host) != ""
}

func sanitizeCASValidationErrorBody(raw string) string {
	const maxErrorBodyLength = 200

	collapsed := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
	if collapsed == "" {
		return ""
	}
	sanitized := collapsed
	for _, pattern := range casSensitiveResponsePatterns {
		sanitized = pattern.ReplaceAllString(sanitized, "$1[redacted]$3")
	}
	if len(sanitized) <= maxErrorBodyLength {
		return sanitized
	}
	return sanitized[:maxErrorBodyLength] + "...(truncated)"
}
