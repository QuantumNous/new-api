package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Codex CLI stores the OAuth credential nested under "tokens" in
// ~/.codex/auth.json; parseCodexOAuthKey must flatten that layout so refresh
// and model discovery work on a directly pasted auth.json.
func TestParseCodexOAuthKeyFlattensTokens(t *testing.T) {
	key, err := parseCodexOAuthKey(`{"OPENAI_API_KEY":null,"tokens":{"id_token":"id","access_token":"at","refresh_token":"rt","account_id":"acc"},"last_refresh":"2026-08-01T00:00:00Z"}`)
	require.NoError(t, err)
	assert.Equal(t, "at", key.AccessToken)
	assert.Equal(t, "rt", key.RefreshToken)
	assert.Equal(t, "acc", key.AccountID)
	assert.Nil(t, key.Tokens)

	// Top-level values win over the nested ones.
	key, err = parseCodexOAuthKey(`{"access_token":"top-at","tokens":{"access_token":"nested-at","account_id":"acc"}}`)
	require.NoError(t, err)
	assert.Equal(t, "top-at", key.AccessToken)
	assert.Equal(t, "acc", key.AccountID)
}
