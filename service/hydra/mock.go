package hydra

import (
	"context"
	"fmt"
	"sync"

	client "github.com/ory/hydra-client-go/v2"
)

// MockProvider is a mock implementation of Provider for testing
type MockProvider struct {
	mu sync.RWMutex

	// Storage for mock data
	LoginRequests      map[string]*client.OAuth2LoginRequest
	ConsentRequests    map[string]*client.OAuth2ConsentRequest
	LogoutRequests     map[string]*client.OAuth2LogoutRequest
	IntrospectedTokens map[string]*client.IntrospectedOAuth2Token
	OAuth2Clients      map[string]*client.OAuth2Client // client_id -> client

	// Track accepted/rejected
	AcceptedLogins   map[string]string   // challenge -> subject
	AcceptedConsents map[string][]string // challenge -> granted scopes
	AcceptedLogouts  map[string]bool
	RejectedLogins   map[string]string // challenge -> error
	RejectedConsents map[string]string
	RejectedLogouts  map[string]bool

	// Error injection
	GetLoginRequestErr    error
	AcceptLoginErr        error
	RejectLoginErr        error
	GetConsentRequestErr  error
	AcceptConsentErr      error
	RejectConsentErr      error
	GetLogoutRequestErr   error
	AcceptLogoutErr       error
	RejectLogoutErr       error
	IntrospectTokenErr    error
	CreateOAuth2ClientErr error
	UpdateOAuth2ClientErr error
	ListOAuth2ClientsErr  error
	DeleteOAuth2ClientErr error

	// Default redirect URL
	RedirectURL string
}

// NewMockProvider creates a new mock provider
func NewMockProvider() *MockProvider {
	return &MockProvider{
		LoginRequests:      make(map[string]*client.OAuth2LoginRequest),
		ConsentRequests:    make(map[string]*client.OAuth2ConsentRequest),
		LogoutRequests:     make(map[string]*client.OAuth2LogoutRequest),
		IntrospectedTokens: make(map[string]*client.IntrospectedOAuth2Token),
		OAuth2Clients:      make(map[string]*client.OAuth2Client),
		AcceptedLogins:     make(map[string]string),
		AcceptedConsents:   make(map[string][]string),
		AcceptedLogouts:    make(map[string]bool),
		RejectedLogins:     make(map[string]string),
		RejectedConsents:   make(map[string]string),
		RejectedLogouts:    make(map[string]bool),
		RedirectURL:        "https://example.com/callback",
	}
}

// SetLoginRequest sets a mock login request for testing
func (m *MockProvider) SetLoginRequest(challenge string, clientID, clientName string, requestedScope []string, skip bool, subject string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	oauthClient := client.NewOAuth2Client()
	oauthClient.SetClientId(clientID)
	oauthClient.SetClientName(clientName)

	req := client.NewOAuth2LoginRequest(challenge, *oauthClient, "https://hydra/oauth2/auth", skip, subject)
	req.SetRequestedScope(requestedScope)
	m.LoginRequests[challenge] = req
}

// SetConsentRequest sets a mock consent request for testing
func (m *MockProvider) SetConsentRequest(challenge string, clientID, clientName, subject string, requestedScope []string, skip bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	req := client.NewOAuth2ConsentRequest(challenge)
	req.SetClient(*client.NewOAuth2Client())
	req.Client.SetClientId(clientID)
	req.Client.SetClientName(clientName)
	req.SetSubject(subject)
	req.SetRequestedScope(requestedScope)
	req.SetSkip(skip)
	m.ConsentRequests[challenge] = req
}

// SetLogoutRequest sets a mock logout request for testing
func (m *MockProvider) SetLogoutRequest(challenge string, subject, sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	req := client.NewOAuth2LogoutRequest()
	req.SetChallenge(challenge)
	req.SetSubject(subject)
	req.SetSid(sessionID)
	m.LogoutRequests[challenge] = req
}

// GetLoginRequest implements Provider
func (m *MockProvider) GetLoginRequest(ctx context.Context, challenge string) (*client.OAuth2LoginRequest, error) {
	if m.GetLoginRequestErr != nil {
		return nil, m.GetLoginRequestErr
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	req, ok := m.LoginRequests[challenge]
	if !ok {
		return nil, fmt.Errorf("login request not found: %s", challenge)
	}
	return req, nil
}

// AcceptLogin implements Provider
func (m *MockProvider) AcceptLogin(ctx context.Context, challenge string, subject string, remember bool, rememberFor int64) (*client.OAuth2RedirectTo, error) {
	if m.AcceptLoginErr != nil {
		return nil, m.AcceptLoginErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.LoginRequests[challenge]; !ok {
		return nil, fmt.Errorf("login request not found: %s", challenge)
	}

	m.AcceptedLogins[challenge] = subject
	return &client.OAuth2RedirectTo{RedirectTo: m.RedirectURL}, nil
}

// RejectLogin implements Provider
func (m *MockProvider) RejectLogin(ctx context.Context, challenge string, errorID string, errorDescription string) (*client.OAuth2RedirectTo, error) {
	if m.RejectLoginErr != nil {
		return nil, m.RejectLoginErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.LoginRequests[challenge]; !ok {
		return nil, fmt.Errorf("login request not found: %s", challenge)
	}

	m.RejectedLogins[challenge] = errorID
	return &client.OAuth2RedirectTo{RedirectTo: m.RedirectURL}, nil
}

// GetConsentRequest implements Provider
func (m *MockProvider) GetConsentRequest(ctx context.Context, challenge string) (*client.OAuth2ConsentRequest, error) {
	if m.GetConsentRequestErr != nil {
		return nil, m.GetConsentRequestErr
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	req, ok := m.ConsentRequests[challenge]
	if !ok {
		return nil, fmt.Errorf("consent request not found: %s", challenge)
	}
	return req, nil
}

// AcceptConsent implements Provider
func (m *MockProvider) AcceptConsent(ctx context.Context, challenge string, grantScope []string, remember bool, rememberFor int64, session *client.AcceptOAuth2ConsentRequestSession) (*client.OAuth2RedirectTo, error) {
	if m.AcceptConsentErr != nil {
		return nil, m.AcceptConsentErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.ConsentRequests[challenge]; !ok {
		return nil, fmt.Errorf("consent request not found: %s", challenge)
	}

	m.AcceptedConsents[challenge] = grantScope
	return &client.OAuth2RedirectTo{RedirectTo: m.RedirectURL}, nil
}

// RejectConsent implements Provider
func (m *MockProvider) RejectConsent(ctx context.Context, challenge string, errorID string, errorDescription string) (*client.OAuth2RedirectTo, error) {
	if m.RejectConsentErr != nil {
		return nil, m.RejectConsentErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.ConsentRequests[challenge]; !ok {
		return nil, fmt.Errorf("consent request not found: %s", challenge)
	}

	m.RejectedConsents[challenge] = errorID
	return &client.OAuth2RedirectTo{RedirectTo: m.RedirectURL}, nil
}

// GetLogoutRequest implements Provider
func (m *MockProvider) GetLogoutRequest(ctx context.Context, challenge string) (*client.OAuth2LogoutRequest, error) {
	if m.GetLogoutRequestErr != nil {
		return nil, m.GetLogoutRequestErr
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	req, ok := m.LogoutRequests[challenge]
	if !ok {
		return nil, fmt.Errorf("logout request not found: %s", challenge)
	}
	return req, nil
}

// AcceptLogout implements Provider
func (m *MockProvider) AcceptLogout(ctx context.Context, challenge string) (*client.OAuth2RedirectTo, error) {
	if m.AcceptLogoutErr != nil {
		return nil, m.AcceptLogoutErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.LogoutRequests[challenge]; !ok {
		return nil, fmt.Errorf("logout request not found: %s", challenge)
	}

	m.AcceptedLogouts[challenge] = true
	return &client.OAuth2RedirectTo{RedirectTo: m.RedirectURL}, nil
}

// RejectLogout implements Provider
func (m *MockProvider) RejectLogout(ctx context.Context, challenge string) error {
	if m.RejectLogoutErr != nil {
		return m.RejectLogoutErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.LogoutRequests[challenge]; !ok {
		return fmt.Errorf("logout request not found: %s", challenge)
	}

	m.RejectedLogouts[challenge] = true
	return nil
}

// SetIntrospectedToken sets a mock introspection result for testing
func (m *MockProvider) SetIntrospectedToken(token string, active bool, subject string, scope string, clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := client.NewIntrospectedOAuth2Token(active)
	if subject != "" {
		result.SetSub(subject)
	}
	if scope != "" {
		result.SetScope(scope)
	}
	if clientID != "" {
		result.SetClientId(clientID)
	}
	m.IntrospectedTokens[token] = result
}

// IntrospectToken implements Provider
func (m *MockProvider) IntrospectToken(ctx context.Context, token string, scope string) (*client.IntrospectedOAuth2Token, error) {
	if m.IntrospectTokenErr != nil {
		return nil, m.IntrospectTokenErr
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	result, ok := m.IntrospectedTokens[token]
	if !ok {
		// Unknown token returns inactive
		return client.NewIntrospectedOAuth2Token(false), nil
	}
	return result, nil
}

// CreateOAuth2Client creates a mock OAuth2 client
func (m *MockProvider) CreateOAuth2Client(ctx context.Context, clientID, clientSecret, clientName string, grantTypes, responseTypes, redirectURIs []string, scope, tokenEndpointAuthMethod string) (*client.OAuth2Client, error) {
	if m.CreateOAuth2ClientErr != nil {
		return nil, m.CreateOAuth2ClientErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	c := client.NewOAuth2Client()
	c.SetClientId(clientID)
	c.SetClientSecret(clientSecret)
	c.SetClientName(clientName)
	c.SetGrantTypes(grantTypes)
	c.SetResponseTypes(responseTypes)
	c.SetRedirectUris(redirectURIs)
	c.SetScope(scope)
	c.SetTokenEndpointAuthMethod(tokenEndpointAuthMethod)

	m.OAuth2Clients[clientID] = c
	return c, nil
}

// UpdateOAuth2Client updates a mock OAuth2 client
func (m *MockProvider) UpdateOAuth2Client(ctx context.Context, clientID, clientName string, grantTypes, responseTypes, redirectURIs []string, scope, tokenEndpointAuthMethod string) (*client.OAuth2Client, error) {
	if m.UpdateOAuth2ClientErr != nil {
		return nil, m.UpdateOAuth2ClientErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	c, exists := m.OAuth2Clients[clientID]
	if !exists {
		return nil, fmt.Errorf("client not found: %s", clientID)
	}

	c.SetClientName(clientName)
	c.SetGrantTypes(grantTypes)
	c.SetResponseTypes(responseTypes)
	c.SetRedirectUris(redirectURIs)
	c.SetScope(scope)
	c.SetTokenEndpointAuthMethod(tokenEndpointAuthMethod)

	m.OAuth2Clients[clientID] = c
	return c, nil
}

// ListOAuth2Clients lists all mock OAuth2 clients
func (m *MockProvider) ListOAuth2Clients(ctx context.Context) ([]client.OAuth2Client, error) {
	if m.ListOAuth2ClientsErr != nil {
		return nil, m.ListOAuth2ClientsErr
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	clients := make([]client.OAuth2Client, 0, len(m.OAuth2Clients))
	for _, c := range m.OAuth2Clients {
		clients = append(clients, *c)
	}
	return clients, nil
}

// DeleteOAuth2Client deletes a mock OAuth2 client
func (m *MockProvider) DeleteOAuth2Client(ctx context.Context, clientID string) error {
	if m.DeleteOAuth2ClientErr != nil {
		return m.DeleteOAuth2ClientErr
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.OAuth2Clients[clientID]; !exists {
		return fmt.Errorf("client not found: %s", clientID)
	}
	delete(m.OAuth2Clients, clientID)
	return nil
}

// Reset clears all mock data
func (m *MockProvider) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.LoginRequests = make(map[string]*client.OAuth2LoginRequest)
	m.ConsentRequests = make(map[string]*client.OAuth2ConsentRequest)
	m.LogoutRequests = make(map[string]*client.OAuth2LogoutRequest)
	m.IntrospectedTokens = make(map[string]*client.IntrospectedOAuth2Token)
	m.OAuth2Clients = make(map[string]*client.OAuth2Client)
	m.AcceptedLogins = make(map[string]string)
	m.AcceptedConsents = make(map[string][]string)
	m.AcceptedLogouts = make(map[string]bool)
	m.RejectedLogins = make(map[string]string)
	m.RejectedConsents = make(map[string]string)
	m.RejectedLogouts = make(map[string]bool)

	m.GetLoginRequestErr = nil
	m.AcceptLoginErr = nil
	m.RejectLoginErr = nil
	m.GetConsentRequestErr = nil
	m.AcceptConsentErr = nil
	m.RejectConsentErr = nil
	m.GetLogoutRequestErr = nil
	m.AcceptLogoutErr = nil
	m.RejectLogoutErr = nil
	m.IntrospectTokenErr = nil
	m.CreateOAuth2ClientErr = nil
	m.UpdateOAuth2ClientErr = nil
	m.ListOAuth2ClientsErr = nil
	m.DeleteOAuth2ClientErr = nil
}

// Ensure MockProvider implements Provider
var _ Provider = (*MockProvider)(nil)
