package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

const (
	AuthorizeURL = "https://claude.ai/oauth/authorize"
	TokenURL     = "https://console.anthropic.com/v1/oauth/token"
	ClientID     = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
	RedirectURI  = "https://console.anthropic.com/oauth/code/callback"
	Scopes       = "user:inference"
)

type OAuth2Credentials struct {
	AuthURL       string `json:"auth_url"`
	CodeVerifier  string `json:"code_verifier"`
	State         string `json:"state"`
	CodeChallenge string `json:"code_challenge"`
}

// GetClaudeOAuthConfig returns the Claude OAuth2 configuration
func GetClaudeOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:    ClientID,
		RedirectURL: RedirectURI,
		Scopes:      strings.Split(Scopes, " "),
		Endpoint: oauth2.Endpoint{
			AuthURL:  AuthorizeURL,
			TokenURL: TokenURL,
		},
	}
}

// getOAuthConfig is kept for backward compatibility
func getOAuthConfig() *oauth2.Config {
	return GetClaudeOAuthConfig()
}

// GenerateOAuthParams generates OAuth authorization URL and related parameters
func GenerateOAuthParams() (*OAuth2Credentials, error) {
	config := getOAuthConfig()

	// Generate PKCE parameters
	codeVerifier := oauth2.GenerateVerifier()
	state := oauth2.GenerateVerifier() // Reuse generator as state

	// Generate authorization URL
	authURL := config.AuthCodeURL(state,
		oauth2.S256ChallengeOption(codeVerifier),
		oauth2.SetAuthURLParam("code", "true"), // Claude-specific parameter
	)

	return &OAuth2Credentials{
		AuthURL:       authURL,
		CodeVerifier:  codeVerifier,
		State:         state,
		CodeChallenge: oauth2.S256ChallengeFromVerifier(codeVerifier),
	}, nil
}

// ExchangeCode
func ExchangeCode(authorizationCode, codeVerifier, state string, client *http.Client) (*oauth2.Token, error) {
	config := getOAuthConfig()

	ctx := context.Background()
	if client != nil {
		ctx = context.WithValue(ctx, oauth2.HTTPClient, client)
	}

	token, err := config.Exchange(ctx, authorizationCode,
		oauth2.VerifierOption(codeVerifier),
		oauth2.SetAuthURLParam("state", state),
	)
	if err != nil {
		return nil, fmt.Errorf("token exchange failed: %w", err)
	}

	return token, nil
}

func ParseAuthorizationCode(input string) (string, error) {
	if input == "" {
		return "", fmt.Errorf("please provide a valid authorization code")
	}
	// URLs are not allowed
	if strings.Contains(input, "http") || strings.Contains(input, "https") {
		return "", fmt.Errorf("authorization code cannot contain URLs")
	}

	return input, nil
}

// GetClaudeHTTPClient returns a configured HTTP client for Claude OAuth operations
func GetClaudeHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
	}
}

// RefreshClaudeToken refreshes a Claude OAuth token using the refresh token
func RefreshClaudeToken(accessToken, refreshToken string) (*oauth2.Token, error) {
	config := GetClaudeOAuthConfig()
	
	// Create token from current values
	currentToken := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
	}

	ctx := context.Background()
	if client := GetClaudeHTTPClient(); client != nil {
		ctx = context.WithValue(ctx, oauth2.HTTPClient, client)
	}

	// Refresh the token
	newToken, err := config.TokenSource(ctx, currentToken).Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh Claude token: %w", err)
	}

	return newToken, nil
}
