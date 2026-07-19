package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsSensitiveOptionKey(t *testing.T) {
	t.Parallel()

	assert.False(t, isSensitiveOptionKey("TurnstileSiteKey"))
	assert.True(t, isSensitiveOptionKey("TurnstileSecretKey"))
	assert.True(t, isSensitiveOptionKey("StripeApiSecret"))
	assert.True(t, isSensitiveOptionKey("TelegramBotToken"))
	assert.False(t, isSensitiveOptionKey("TurnstileCheckEnabled"))
}
