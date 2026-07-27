package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConsumeUserSendEmailChallengeRequiresVerifiedChallengeAndConsumesOnce(t *testing.T) {
	const (
		email = "person@example.com"
		code  = "ABCDEF0123456789"
	)
	setUserSendEmailChallengeForTest(t, userSendEmailChallenge{
		Email:     email,
		Code:      code,
		CreatedAt: time.Now(),
	})

	assert.False(t, consumeUserSendEmailChallenge(email, code))

	userSendEmailChallenges.Lock()
	challenge := userSendEmailChallenges.values[email]
	challenge.Verified = true
	userSendEmailChallenges.values[email] = challenge
	userSendEmailChallenges.Unlock()

	require.True(t, consumeUserSendEmailChallenge(" PERSON@EXAMPLE.COM ", code))
	assert.False(t, consumeUserSendEmailChallenge(email, code))
}

func TestConsumeUserSendEmailChallengeRejectsExpiredChallenge(t *testing.T) {
	const (
		email = "expired@example.com"
		code  = "0123456789ABCDEF"
	)
	setUserSendEmailChallengeForTest(t, userSendEmailChallenge{
		Email:     email,
		Code:      code,
		CreatedAt: time.Now().Add(-userSendEmailChallengeTTL),
		Verified:  true,
	})

	assert.False(t, consumeUserSendEmailChallenge(email, code))
}

func TestGetUserSendEmailChallengeRejectsWrongCode(t *testing.T) {
	const email = "person@example.com"
	setUserSendEmailChallengeForTest(t, userSendEmailChallenge{
		Email:     email,
		Code:      "ABCDEF0123456789",
		CreatedAt: time.Now(),
	})

	_, ok := getUserSendEmailChallenge(email, "WRONG")
	assert.False(t, ok)
}

func TestIsCloudMailVerificationEmailMatchesCodeInBody(t *testing.T) {
	const (
		sender    = "person@example.com"
		recipient = "verify@example.com"
		code      = "ABCDEF0123456789"
	)
	challenge := userSendEmailChallenge{Email: sender, Code: code, CreatedAt: time.Now()}
	email := cloudMailEmail{
		SendEmail:  sender,
		ToEmail:    recipient,
		Subject:    "Any subject is allowed",
		Content:    "Please verify this registration: " + code,
		CreateTime: "provider-local-time-without-timezone",
		Type:       0,
		IsDel:      0,
	}

	originalRecipient := common.CloudMailRecipient
	common.CloudMailRecipient = recipient
	t.Cleanup(func() { common.CloudMailRecipient = originalRecipient })

	assert.True(t, isCloudMailVerificationEmail(email, challenge))
	email.Content = "The body does not contain the challenge"
	assert.False(t, isCloudMailVerificationEmail(email, challenge))
}

func setUserSendEmailChallengeForTest(t *testing.T, challenge userSendEmailChallenge) {
	t.Helper()
	userSendEmailChallenges.Lock()
	original := userSendEmailChallenges.values
	userSendEmailChallenges.values = map[string]userSendEmailChallenge{challenge.Email: challenge}
	userSendEmailChallenges.Unlock()
	t.Cleanup(func() {
		userSendEmailChallenges.Lock()
		userSendEmailChallenges.values = original
		userSendEmailChallenges.Unlock()
	})
}
