package dto

// --- Custom OAuth response types ---

// CustomOAuthProviderResponse is the response structure for custom OAuth providers.
// It excludes sensitive fields like client_secret.
type CustomOAuthProviderResponse struct {
	Id                    int    `json:"id"`
	Name                  string `json:"name"`
	Slug                  string `json:"slug"`
	Icon                  string `json:"icon"`
	Enabled               bool   `json:"enabled"`
	ClientId              string `json:"client_id"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserInfoEndpoint      string `json:"user_info_endpoint"`
	Scopes                string `json:"scopes"`
	UserIdField           string `json:"user_id_field"`
	UsernameField         string `json:"username_field"`
	DisplayNameField      string `json:"display_name_field"`
	EmailField            string `json:"email_field"`
	WellKnown             string `json:"well_known"`
	AuthStyle             int    `json:"auth_style"`
	AccessPolicy          string `json:"access_policy"`
	AccessDeniedMessage   string `json:"access_denied_message"`
}

type UserOAuthBindingResponse struct {
	ProviderId     int    `json:"provider_id"`
	ProviderName   string `json:"provider_name"`
	ProviderSlug   string `json:"provider_slug"`
	ProviderIcon   string `json:"provider_icon"`
	ProviderUserId string `json:"provider_user_id"`
}

type FetchDiscoveryData struct {
	WellKnownURL string         `json:"well_known_url"`
	Discovery    map[string]any `json:"discovery"`
}

// --- Custom OAuth request types ---

// CreateCustomOAuthProviderRequest is the request body for creating a custom OAuth provider.
type CreateCustomOAuthProviderRequest struct {
	Name                  string `json:"name" binding:"required"`
	Slug                  string `json:"slug" binding:"required"`
	Icon                  string `json:"icon"`
	Enabled               bool   `json:"enabled"`
	ClientId              string `json:"client_id" binding:"required"`
	ClientSecret          string `json:"client_secret" binding:"required"`
	AuthorizationEndpoint string `json:"authorization_endpoint" binding:"required"`
	TokenEndpoint         string `json:"token_endpoint" binding:"required"`
	UserInfoEndpoint      string `json:"user_info_endpoint" binding:"required"`
	Scopes                string `json:"scopes"`
	UserIdField           string `json:"user_id_field"`
	UsernameField         string `json:"username_field"`
	DisplayNameField      string `json:"display_name_field"`
	EmailField            string `json:"email_field"`
	WellKnown             string `json:"well_known"`
	AuthStyle             int    `json:"auth_style"`
	AccessPolicy          string `json:"access_policy"`
	AccessDeniedMessage   string `json:"access_denied_message"`
}

// UpdateCustomOAuthProviderRequest is the request body for updating a custom OAuth provider.
type UpdateCustomOAuthProviderRequest struct {
	Name                  string  `json:"name"`
	Slug                  string  `json:"slug"`
	Icon                  *string `json:"icon"`    // Optional: if nil, keep existing
	Enabled               *bool   `json:"enabled"` // Optional: if nil, keep existing
	ClientId              string  `json:"client_id"`
	ClientSecret          string  `json:"client_secret"` // Optional: if empty, keep existing
	AuthorizationEndpoint string  `json:"authorization_endpoint"`
	TokenEndpoint         string  `json:"token_endpoint"`
	UserInfoEndpoint      string  `json:"user_info_endpoint"`
	Scopes                string  `json:"scopes"`
	UserIdField           string  `json:"user_id_field"`
	UsernameField         string  `json:"username_field"`
	DisplayNameField      string  `json:"display_name_field"`
	EmailField            string  `json:"email_field"`
	WellKnown             *string `json:"well_known"`            // Optional: if nil, keep existing
	AuthStyle             *int    `json:"auth_style"`            // Optional: if nil, keep existing
	AccessPolicy          *string `json:"access_policy"`         // Optional: if nil, keep existing
	AccessDeniedMessage   *string `json:"access_denied_message"` // Optional: if nil, keep existing
}

// FetchCustomOAuthDiscoveryRequest is the request body for POST /api/custom-oauth-provider/discovery.
type FetchCustomOAuthDiscoveryRequest struct {
	WellKnownURL string `json:"well_known_url"`
	IssuerURL    string `json:"issuer_url"`
}

// TestIoNetConnectionRequest is the request body for testing io.net connection.
type TestIoNetConnectionRequest struct {
	APIKey string `json:"api_key"`
}

// UpdateDeploymentNameRequest is the request body for updating deployment name.
type UpdateDeploymentNameRequest struct {
	Name string `json:"name" binding:"required"`
}
