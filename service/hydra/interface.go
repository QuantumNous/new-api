package hydra

import (
	"context"

	client "github.com/ory/hydra-client-go/v2"
)

// Provider defines the interface for Hydra operations
// This allows for easy mocking in tests
type Provider interface {
	// Login flow
	GetLoginRequest(ctx context.Context, challenge string) (*client.OAuth2LoginRequest, error)
	AcceptLogin(ctx context.Context, challenge string, subject string, remember bool, rememberFor int64) (*client.OAuth2RedirectTo, error)
	RejectLogin(ctx context.Context, challenge string, errorID string, errorDescription string) (*client.OAuth2RedirectTo, error)

	// Consent flow
	GetConsentRequest(ctx context.Context, challenge string) (*client.OAuth2ConsentRequest, error)
	AcceptConsent(ctx context.Context, challenge string, grantScope []string, remember bool, rememberFor int64, session *client.AcceptOAuth2ConsentRequestSession) (*client.OAuth2RedirectTo, error)
	RejectConsent(ctx context.Context, challenge string, errorID string, errorDescription string) (*client.OAuth2RedirectTo, error)

	// Logout flow
	GetLogoutRequest(ctx context.Context, challenge string) (*client.OAuth2LogoutRequest, error)
	AcceptLogout(ctx context.Context, challenge string) (*client.OAuth2RedirectTo, error)
	RejectLogout(ctx context.Context, challenge string) error

	// Session Management
	RevokeLoginSessions(ctx context.Context, subject string) error

	// Token Introspection
	IntrospectToken(ctx context.Context, token string, scope string) (*client.IntrospectedOAuth2Token, error)

	// Client Management (Admin)
	CreateOAuth2Client(ctx context.Context, clientID, clientSecret, clientName string,
		grantTypes, responseTypes, redirectURIs []string,
		scope, tokenEndpointAuthMethod string) (*client.OAuth2Client, error)
	UpdateOAuth2Client(ctx context.Context, clientID, clientName string,
		grantTypes, responseTypes, redirectURIs []string,
		scope, tokenEndpointAuthMethod string) (*client.OAuth2Client, error)
	ListOAuth2Clients(ctx context.Context) ([]client.OAuth2Client, error)
	DeleteOAuth2Client(ctx context.Context, clientID string) error
}

// Ensure Service implements Provider
var _ Provider = (*Service)(nil)
