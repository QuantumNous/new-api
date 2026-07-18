package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsSensitiveHeaderName(t *testing.T) {
	tests := map[string]bool{
		"Authorization":               true,
		"CF-Access-Client-Secret":     true,
		"X-Auth-Token":                true,
		"X_Webhook_Signature":         true,
		"X-Custom-APIKey":             true,
		"Cookie":                      true,
		"Traceparent":                 false,
		"X-Request-ID":                false,
		"OpenAI-Beta":                 false,
		"Content-Type":                false,
		"X-Stainless-Runtime-Version": false,
	}

	for name, expected := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, expected, IsSensitiveHeaderName(name))
		})
	}
}
