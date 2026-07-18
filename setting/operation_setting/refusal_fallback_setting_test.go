package operation_setting

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateRefusalFallbackRules(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		wantErr bool
	}{
		{
			name: "valid ordered rule",
			raw: `[{
				"name":"claude refusal",
				"model_regex":["^claude-"],
				"path_regex":["^/v1/messages$"],
				"groups":["default"],
				"fallback_group":"claude-fallback",
				"cooldown_seconds":3600
			}]`,
		},
		{
			name:    "duplicate names",
			raw:     `[ {"name":"same","model_regex":["a"],"fallback_group":"backup-a","cooldown_seconds":60}, {"name":"same","model_regex":["b"],"fallback_group":"backup-b","cooldown_seconds":60} ]`,
			wantErr: true,
		},
		{
			name:    "invalid regex",
			raw:     `[ {"name":"bad","model_regex":["["],"fallback_group":"backup","cooldown_seconds":60} ]`,
			wantErr: true,
		},
		{
			name:    "missing fallback group",
			raw:     `[ {"name":"bad","model_regex":["a"],"fallback_group":"","cooldown_seconds":60} ]`,
			wantErr: true,
		},
		{
			name:    "auto fallback group",
			raw:     `[ {"name":"bad","model_regex":["a"],"fallback_group":"auto","cooldown_seconds":60} ]`,
			wantErr: true,
		},
		{
			name:    "auto source group",
			raw:     `[ {"name":"bad","model_regex":["a"],"groups":["auto"],"fallback_group":"backup","cooldown_seconds":60} ]`,
			wantErr: true,
		},
		{
			name:    "unbounded cooldown",
			raw:     fmt.Sprintf(`[ {"name":"bad","model_regex":["a"],"fallback_group":"backup","cooldown_seconds":%d} ]`, MaxRefusalFallbackCooldownSeconds+1),
			wantErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateRefusalFallbackRules(test.raw)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
