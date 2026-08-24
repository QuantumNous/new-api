package oauth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseEmailVerifiedClaim(t *testing.T) {
	require.True(t, parseEmailVerifiedClaim(`{"email_verified": true}`))
	require.True(t, parseEmailVerifiedClaim(`{"email_verified": "true"}`))
	require.True(t, parseEmailVerifiedClaim(`{"email_verified": "1"}`))
	require.True(t, parseEmailVerifiedClaim(`{"email_verified": "yes"}`))
	require.False(t, parseEmailVerifiedClaim(`{"email_verified": false}`))
	require.False(t, parseEmailVerifiedClaim(`{"email_verified": "false"}`))
	require.False(t, parseEmailVerifiedClaim(`{"email_verified": "0"}`))
	require.False(t, parseEmailVerifiedClaim(`{"email": "a@b.c"}`))
	require.False(t, parseEmailVerifiedClaim(`not json`))
	require.False(t, parseEmailVerifiedClaim(`{"email_verified": "maybe"}`))
}
