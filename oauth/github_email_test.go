package oauth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerifiedPrimaryGitHubEmailSelectsVerifiedPrimary(t *testing.T) {
	email := verifiedPrimaryGitHubEmail([]gitHubEmail{
		{Email: "secondary@allowed.example", Primary: false, Verified: true},
		{Email: "primary@allowed.example", Primary: true, Verified: true},
	})

	require.Equal(t, "primary@allowed.example", email)
}

func TestVerifiedPrimaryGitHubEmailRejectsUnverifiedPrimary(t *testing.T) {
	email := verifiedPrimaryGitHubEmail([]gitHubEmail{
		{Email: "primary@allowed.example", Primary: true, Verified: false},
		{Email: "secondary@allowed.example", Primary: false, Verified: true},
	})

	require.Empty(t, email)
}
