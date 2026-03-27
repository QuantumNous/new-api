package oauth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type TrustedHeaderProvider struct {
	config *model.CustomOAuthProvider
}

type TrustedHeaderIdentity struct {
	User  *OAuthUser
	Group string
	Role  int
}

func NewTrustedHeaderProvider(config *model.CustomOAuthProvider) *TrustedHeaderProvider {
	return &TrustedHeaderProvider{config: config}
}

func (p *TrustedHeaderProvider) GetName() string {
	return p.config.Name
}

func (p *TrustedHeaderProvider) IsEnabled() bool {
	return p.config.Enabled
}

func (p *TrustedHeaderProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	return nil, errors.New("trusted_header provider does not support authorization code exchange")
}

func (p *TrustedHeaderProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	return nil, errors.New("trusted_header provider does not support userinfo fetch")
}

func (p *TrustedHeaderProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsProviderUserIdTaken(p.config.Id, providerUserID)
}

func (p *TrustedHeaderProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	foundUser, err := model.GetUserByOAuthBinding(p.config.Id, providerUserID)
	if err != nil {
		return err
	}
	*user = *foundUser
	return nil
}

func (p *TrustedHeaderProvider) SetProviderUserID(user *model.User, providerUserID string) {
}

func (p *TrustedHeaderProvider) GetProviderPrefix() string {
	return p.config.Slug + "_"
}

func (p *TrustedHeaderProvider) GetProviderId() int {
	return p.config.Id
}

func (p *TrustedHeaderProvider) ResolveIdentityFromHeaders(headers http.Header) (*TrustedHeaderIdentity, error) {
	externalID, err := singleTrustedHeaderValue(headers, p.config.ExternalIDHeader)
	if err != nil {
		return nil, err
	}
	if externalID == "" {
		return nil, errors.New("trusted header identity missing external id")
	}

	username, err := singleTrustedHeaderValue(headers, p.config.UsernameHeader)
	if err != nil {
		return nil, err
	}
	displayName, err := singleTrustedHeaderValue(headers, p.config.DisplayNameHeader)
	if err != nil {
		return nil, err
	}
	email, err := singleTrustedHeaderValue(headers, p.config.EmailHeader)
	if err != nil {
		return nil, err
	}
	groupCandidates, err := extractTrustedHeaderCandidates(headers, p.config.GroupHeader)
	if err != nil {
		return nil, err
	}
	roleCandidates, err := extractTrustedHeaderCandidates(headers, p.config.RoleHeader)
	if err != nil {
		return nil, err
	}

	return &TrustedHeaderIdentity{
		User: &OAuthUser{
			ProviderUserID: externalID,
			Username:       username,
			DisplayName:    displayName,
			Email:          email,
			Extra: map[string]any{
				"provider": p.config.Slug,
			},
		},
		Group: resolveMappedGroupCandidates(groupCandidates, p.config),
		Role:  resolveMappedRoleCandidates(roleCandidates, p.config),
	}, nil
}

func singleTrustedHeaderValue(headers http.Header, name string) (string, error) {
	name = http.CanonicalHeaderKey(strings.TrimSpace(name))
	if name == "" {
		return "", nil
	}
	values := nonEmptyTrustedHeaderValues(headers.Values(name))
	if len(values) > 1 {
		return "", errors.New("trusted header contains multiple values: " + name)
	}
	if len(values) == 0 {
		return "", nil
	}
	return values[0], nil
}

func extractTrustedHeaderCandidates(headers http.Header, name string) ([]string, error) {
	name = http.CanonicalHeaderKey(strings.TrimSpace(name))
	if name == "" {
		return nil, nil
	}
	values := nonEmptyTrustedHeaderValues(headers.Values(name))
	if len(values) == 0 {
		return nil, nil
	}
	if len(values) > 1 {
		return nil, errors.New("trusted header contains multiple values: " + name)
	}
	candidates := make([]string, 0, 4)
	for _, part := range splitTrustedHeaderValue(values[0]) {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			candidates = append(candidates, trimmed)
		}
	}
	return candidates, nil
}

func nonEmptyTrustedHeaderValues(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func splitTrustedHeaderValue(value string) []string {
	return strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '|'
	})
}
