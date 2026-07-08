package system_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOIDCSettings_GetEffectiveDisplayName(t *testing.T) {
	tests := []struct {
		name        string
		displayName string
		want        string
	}{
		{name: "blank falls back to OIDC", displayName: "", want: "OIDC"},
		{name: "custom name is returned verbatim", displayName: "Acme SSO", want: "Acme SSO"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &OIDCSettings{DisplayName: tt.displayName}
			assert.Equal(t, tt.want, s.GetEffectiveDisplayName())
		})
	}
}
