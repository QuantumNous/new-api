package groksubscription

import "testing"

func TestParseCredential_ValidV1(t *testing.T) {
	raw := `{"version":1,"type":"grok_subscription","access_token":"at","refresh_token":"rt","token_type":"Bearer","expires_at":1786900000}`
	cred, err := ParseCredential(raw)
	if err != nil {
		t.Fatalf("ParseCredential valid v1 err = %v", err)
	}
	if cred.AccessToken != "at" || cred.RefreshToken != "rt" || cred.ExpiresAt != 1786900000 {
		t.Fatalf("parsed fields wrong: %+v", cred)
	}
}

func TestParseCredential_UnknownVersionFailsClosed(t *testing.T) {
	raw := `{"version":2,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	if _, err := ParseCredential(raw); err == nil {
		t.Fatalf("unknown version must fail closed, got nil err")
	}
}

func TestParseCredential_WrongTypeRejected(t *testing.T) {
	raw := `{"version":1,"type":"api_key","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	if _, err := ParseCredential(raw); err == nil {
		t.Fatalf("wrong type must be rejected")
	}
}

func TestParseCredential_MissingRequiredRejected(t *testing.T) {
	// access_token / token_type / expires_at 必填
	for _, raw := range []string{
		`{"version":1,"type":"grok_subscription","token_type":"Bearer","expires_at":1786900000}`,
		`{"version":1,"type":"grok_subscription","access_token":"at","expires_at":1786900000}`,
		`{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer"}`,
	} {
		if _, err := ParseCredential(raw); err == nil {
			t.Fatalf("missing required field must be rejected: %s", raw)
		}
	}
}

func TestParseCredential_MissingRefreshRequiresNonRefreshable(t *testing.T) {
	// 无 refresh_token 时合法，但调用方须据此置 non_refreshable（见状态表任务）
	raw := `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`
	cred, err := ParseCredential(raw)
	if err != nil {
		t.Fatalf("missing refresh should still parse: %v", err)
	}
	if cred.RefreshToken != "" {
		t.Fatalf("expected empty refresh token")
	}
	if cred.IsRefreshable() {
		t.Fatalf("IsRefreshable must be false when refresh_token empty")
	}
}

func TestSerializeRoundTrip(t *testing.T) {
	cred := Credential{Version: 1, Type: CredentialType, AccessToken: "at", RefreshToken: "rt", TokenType: "Bearer", ExpiresAt: 1786900000}
	s, err := cred.Serialize()
	if err != nil {
		t.Fatalf("serialize err %v", err)
	}
	got, err := ParseCredential(s)
	if err != nil {
		t.Fatalf("reparse err %v", err)
	}
	if got != cred {
		t.Fatalf("round trip mismatch: %+v vs %+v", got, cred)
	}
}

func TestParseCredential_StrictParsing(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"empty", ""},
		{"whitespace only", "   "},
		{"invalid json", `{not json`},
		{"unknown field rejected", `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000,"unexpected":"x"}`},
		{"trailing data", `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000} garbage`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := ParseCredential(tc.raw); err == nil {
				t.Fatalf("ParseCredential(%q) must be rejected, got nil err", tc.raw)
			}
		})
	}
}
