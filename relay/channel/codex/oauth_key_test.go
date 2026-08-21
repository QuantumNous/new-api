package codex

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Codex CLI stores the OAuth credential nested under "tokens" in
// ~/.codex/auth.json; ParseOAuthKey must flatten that layout so a pasted
// auth.json works the same as the flattened credential.
func TestParseOAuthKeyFlattensTokens(t *testing.T) {
	tests := []struct {
		name         string
		raw          string
		accessToken  string
		refreshToken string
		accountID    string
	}{
		{
			name:         "flat credential",
			raw:          `{"access_token":"at","refresh_token":"rt","account_id":"acc"}`,
			accessToken:  "at",
			refreshToken: "rt",
			accountID:    "acc",
		},
		{
			name:         "nested auth.json layout",
			raw:          `{"OPENAI_API_KEY":null,"tokens":{"id_token":"id","access_token":"at","refresh_token":"rt","account_id":"acc"},"last_refresh":"2026-08-01T00:00:00Z"}`,
			accessToken:  "at",
			refreshToken: "rt",
			accountID:    "acc",
		},
		{
			name:         "top level wins over tokens",
			raw:          `{"access_token":"top-at","account_id":"top-acc","tokens":{"access_token":"nested-at","refresh_token":"rt","account_id":"nested-acc"}}`,
			accessToken:  "top-at",
			refreshToken: "rt",
			accountID:    "top-acc",
		},
		{
			name:         "tokens fill only missing top level fields",
			raw:          `{"access_token":"top-at","tokens":{"access_token":"nested-at","refresh_token":"rt","account_id":"acc"}}`,
			accessToken:  "top-at",
			refreshToken: "rt",
			accountID:    "acc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, err := ParseOAuthKey(tt.raw)
			require.NoError(t, err)
			assert.Equal(t, tt.accessToken, key.AccessToken)
			assert.Equal(t, tt.refreshToken, key.RefreshToken)
			assert.Equal(t, tt.accountID, key.AccountID)
			// Tokens is consumed by flattening so re-marshaling stays flat.
			assert.Nil(t, key.Tokens)
		})
	}
}

func TestParseOAuthKeyRejectsInvalidInput(t *testing.T) {
	for _, raw := range []string{"", "not json", `["access_token"]`} {
		_, err := ParseOAuthKey(raw)
		assert.Error(t, err, "input %q", raw)
	}
}
