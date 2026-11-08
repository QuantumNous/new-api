package identity

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
)

func TestNormalizeAccessTokenScopes(t *testing.T) {
	commonUser := common.RoleCommonUser
	root := common.RoleRootUser

	scopes, err := NormalizeAccessTokenScopes(commonUser, []string{"profile:read", "wallet:write"})
	if err != nil {
		t.Fatalf("personal scopes rejected: %v", err)
	}
	if len(scopes) != 2 {
		t.Fatalf("expected 2 scopes, got %v", scopes)
	}

	if _, err := NormalizeAccessTokenScopes(commonUser, []string{"system:settings"}); !errors.Is(err, ErrAccessTokenScopeForbidden) {
		t.Fatalf("common user granting system scope should be forbidden, got %v", err)
	}

	if _, err := NormalizeAccessTokenScopes(root, []string{"system:settings"}); err != nil {
		t.Fatalf("root granting system scope failed: %v", err)
	}

	if _, err := NormalizeAccessTokenScopes(root, []string{"bogus:read"}); !errors.Is(err, ErrAccessTokenScopeInvalid) {
		t.Fatalf("unknown resource should be invalid, got %v", err)
	}

	if _, err := NormalizeAccessTokenScopes(root, nil); !errors.Is(err, ErrAccessTokenScopeInvalid) {
		t.Fatalf("empty grant should be invalid, got %v", err)
	}
}

func TestUserAccessTokenScopesAndFingerprint(t *testing.T) {
	token := &UserAccessToken{}
	if err := token.SetScopes([]string{"profile:read"}); err != nil {
		t.Fatalf("set scopes: %v", err)
	}
	if !token.AllowsScope("profile:read") {
		t.Fatal("granted scope not allowed")
	}
	if token.AllowsScope("wallet:write") {
		t.Fatal("ungranted scope allowed")
	}

	raw := AccessTokenPrefix + "abcdef"
	if AccessTokenFingerprint(raw) == AccessTokenFingerprint(raw+"x") {
		t.Fatal("fingerprint collision between distinct tokens")
	}
	if AccessTokenHint(raw) != "cdef" {
		t.Fatalf("unexpected hint %q", AccessTokenHint(raw))
	}
}

func TestAccessTokenSessionIDRoundTrip(t *testing.T) {
	id := 42
	parsed, ok := ParseAccessTokenSessionID(AccessTokenSessionID(id))
	if !ok || parsed != id {
		t.Fatalf("round trip failed: %d %v", parsed, ok)
	}
	if _, ok := ParseAccessTokenSessionID("session-uuid"); ok {
		t.Fatal("browser session id must not parse as a PAT session")
	}
}
