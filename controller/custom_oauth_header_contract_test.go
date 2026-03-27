package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const trustedHeaderContractCIDRs = `["127.0.0.1/32","::1/128"]`

type trustedHeaderContractCase struct {
	name             string
	slug             string
	configure        func(provider *model.CustomOAuthProvider)
	headers          http.Header
	expectedUsername string
	expectedGroup    string
	expectedRole     int
}

func TestTrustedHeaderProviderMainstreamContracts(t *testing.T) {
	cases := []trustedHeaderContractCase{
		{
			name: "oauth2_proxy",
			slug: "oauth2-proxy-contract",
			configure: func(provider *model.CustomOAuthProvider) {
				provider.ExternalIDHeader = "X-Forwarded-Email"
				provider.UsernameHeader = "X-Forwarded-Preferred-Username"
				provider.DisplayNameHeader = "X-Forwarded-User"
				provider.EmailHeader = "X-Forwarded-Email"
				provider.GroupHeader = "X-Forwarded-Groups"
				provider.RoleHeader = "X-Forwarded-Groups"
				provider.GroupMapping = `{"engineering":"vip"}`
				provider.RoleMapping = `{"platform-admin":"admin"}`
			},
			headers: http.Header{
				"X-Forwarded-Email":              []string{"alice@example.com"},
				"X-Forwarded-Preferred-Username": []string{"alice"},
				"X-Forwarded-User":               []string{"Alice Doe"},
				"X-Forwarded-Groups":             []string{"engineering,platform-admin"},
			},
			expectedUsername: "alice",
			expectedGroup:    "vip",
			expectedRole:     common.RoleAdminUser,
		},
		{
			name: "authelia",
			slug: "authelia-contract",
			configure: func(provider *model.CustomOAuthProvider) {
				provider.ExternalIDHeader = "Remote-Email"
				provider.UsernameHeader = "Remote-User"
				provider.DisplayNameHeader = "Remote-Name"
				provider.EmailHeader = "Remote-Email"
				provider.GroupHeader = "Remote-Groups"
				provider.RoleHeader = "Remote-Groups"
				provider.GroupMapping = `{"engineering":"vip"}`
				provider.RoleMapping = `{"platform-admin":"admin"}`
			},
			headers: http.Header{
				"Remote-Email":  []string{"bob@example.com"},
				"Remote-User":   []string{"bob"},
				"Remote-Name":   []string{"Bob Smith"},
				"Remote-Groups": []string{"engineering,platform-admin"},
			},
			expectedUsername: "bob",
			expectedGroup:    "vip",
			expectedRole:     common.RoleAdminUser,
		},
		{
			name: "authentik",
			slug: "authentik-contract",
			configure: func(provider *model.CustomOAuthProvider) {
				provider.ExternalIDHeader = "X-authentik-uid"
				provider.UsernameHeader = "X-authentik-username"
				provider.DisplayNameHeader = "X-authentik-name"
				provider.EmailHeader = "X-authentik-email"
				provider.GroupHeader = "X-authentik-groups"
				provider.RoleHeader = "X-authentik-groups"
				provider.GroupMapping = `{"engineering":"vip"}`
				provider.RoleMapping = `{"platform-admin":"admin"}`
			},
			headers: http.Header{
				"X-Authentik-Uid":      []string{"ak-user-001"},
				"X-Authentik-Username": []string{"carol"},
				"X-Authentik-Name":     []string{"Carol Jones"},
				"X-Authentik-Email":    []string{"carol@example.com"},
				"X-Authentik-Groups":   []string{"engineering|platform-admin"},
			},
			expectedUsername: "carol",
			expectedGroup:    "vip",
			expectedRole:     common.RoleAdminUser,
		},
		{
			name: "pomerium",
			slug: "pomerium-contract",
			configure: func(provider *model.CustomOAuthProvider) {
				provider.ExternalIDHeader = "X-Pomerium-Claim-Sub"
				provider.UsernameHeader = "X-Pomerium-Claim-User"
				provider.DisplayNameHeader = "X-Pomerium-Claim-Name"
				provider.EmailHeader = "X-Pomerium-Claim-Email"
				provider.GroupHeader = "X-Pomerium-Claim-Groups"
				provider.RoleHeader = "X-Pomerium-Claim-Groups"
				provider.GroupMapping = `{"engineering":"vip"}`
				provider.RoleMapping = `{"platform-admin":"admin"}`
			},
			headers: http.Header{
				"X-Pomerium-Claim-Sub":    []string{"pomerium-sub-1"},
				"X-Pomerium-Claim-User":   []string{"dana"},
				"X-Pomerium-Claim-Name":   []string{"Dana Kim"},
				"X-Pomerium-Claim-Email":  []string{"dana@example.com"},
				"X-Pomerium-Claim-Groups": []string{"engineering,platform-admin"},
			},
			expectedUsername: "dana",
			expectedGroup:    "vip",
			expectedRole:     common.RoleAdminUser,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setupCustomOAuthJWTControllerTestDB(t)
			provider := createTrustedHeaderContractProviderForTest(t, tc.slug, tc.configure)

			router := newCustomOAuthJWTRouter(t)
			server := httptest.NewServer(router)
			defer server.Close()

			client := newTestHTTPClient(t)
			state := fetchOAuthStateForTest(t, client, server.URL)
			response := postTrustedHeaderLoginWithHeadersForTest(t, client, server.URL, provider.Slug, state, tc.headers)
			if !response.Success {
				t.Fatalf("expected trusted header login success, got message: %s", response.Message)
			}

			var loginData oauthJWTLoginResponse
			if err := common.Unmarshal(response.Data, &loginData); err != nil {
				t.Fatalf("failed to decode trusted header login response: %v", err)
			}
			if loginData.Username != tc.expectedUsername || loginData.Group != tc.expectedGroup || loginData.Role != tc.expectedRole {
				t.Fatalf("unexpected login result: %+v", loginData)
			}
			if !model.IsProviderUserIdTaken(provider.Id, tc.headers.Get(provider.ExternalIDHeader)) {
				t.Fatal("expected trusted header binding to be created")
			}
		})
	}
}

func createTrustedHeaderContractProviderForTest(t *testing.T, slug string, configure func(provider *model.CustomOAuthProvider)) *model.CustomOAuthProvider {
	t.Helper()
	provider := &model.CustomOAuthProvider{
		Name:              slug,
		Slug:              slug,
		Kind:              model.CustomOAuthProviderKindTrustedHeader,
		Enabled:           true,
		TrustedProxyCIDRs: trustedHeaderContractCIDRs,
		AutoRegister:      true,
		SyncGroupOnLogin:  true,
		SyncRoleOnLogin:   true,
		GroupMappingMode:  model.CustomOAuthMappingModeExplicitOnly,
		RoleMappingMode:   model.CustomOAuthMappingModeExplicitOnly,
		ExternalIDHeader:  "X-Auth-User-Id",
		UsernameHeader:    "X-Auth-Username",
		DisplayNameHeader: "X-Auth-Display-Name",
		EmailHeader:       "X-Auth-Email",
		GroupHeader:       "X-Auth-Group",
		RoleHeader:        "X-Auth-Role",
		GroupMapping:      `{"engineering":"vip"}`,
		RoleMapping:       `{"platform-admin":"admin"}`,
	}
	configure(provider)
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create trusted header contract provider: %v", err)
	}
	return provider
}

func postTrustedHeaderLoginWithHeadersForTest(t *testing.T, client *http.Client, baseURL string, providerSlug string, state string, headers http.Header) oauthJWTAPIResponse {
	t.Helper()
	payload, err := common.Marshal(map[string]any{"state": state})
	if err != nil {
		t.Fatalf("failed to marshal trusted header login payload: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/auth/external/"+providerSlug+"/header/login", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("failed to build trusted header login request: %v", err)
	}
	req.Header = headers.Clone()
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to post trusted header login: %v", err)
	}
	defer resp.Body.Close()

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode trusted header login response: %v", err)
	}
	return response
}
