package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestApplyAdminEmailTrust(t *testing.T) {
	origin := &model.User{Email: "old@example.com", EmailVerifiedAt: 0}

	// Admin changes the email -> marked verified.
	changed := &model.User{Email: "new@example.com", EmailVerifiedAt: 0}
	applyAdminEmailTrust(origin, changed)
	require.NotZero(t, changed.EmailVerifiedAt)

	// Same email -> untouched.
	same := &model.User{Email: "old@example.com", EmailVerifiedAt: 0}
	applyAdminEmailTrust(origin, same)
	require.Zero(t, same.EmailVerifiedAt)

	// Clearing the email -> not marked (email-less accounts are exempt anyway).
	cleared := &model.User{Email: "", EmailVerifiedAt: 0}
	applyAdminEmailTrust(origin, cleared)
	require.Zero(t, cleared.EmailVerifiedAt)

	// Nil-safe.
	applyAdminEmailTrust(nil, nil)
	applyAdminEmailTrust(origin, nil)
	applyAdminEmailTrust(nil, changed)
}
