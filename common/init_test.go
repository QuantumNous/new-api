package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateConfiguredSecret(t *testing.T) {
	tests := []struct {
		name   string
		secret string
		valid  bool
	}{
		{name: "strong secret", secret: "At7!mZ2#qR9$wX4^cV8&nK3*pL6@dS1!", valid: true},
		{name: "too short", secret: "short-secret", valid: false},
		{name: "default placeholder", secret: "random_string", valid: false},
		{name: "generic placeholder", secret: "change_me", valid: false},
		{name: "example placeholder", secret: "replace-with-a-random-secret-from-your-secret-store", valid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateConfiguredSecret("SESSION_SECRET", tt.secret)
			if tt.valid {
				require.NoError(t, err)
				return
			}
			assert.Error(t, err)
		})
	}
}
