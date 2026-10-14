package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeUpstreamOrchestrationCandidateLimit(t *testing.T) {
	tests := []struct {
		name  string
		input int
		want  int
	}{
		{name: "zero means unlimited", input: 0, want: 0},
		{name: "positive values above five are accepted", input: 12, want: 12},
		{name: "negative values use default", input: -1, want: 5},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			setting := UpstreamOrchestrationSetting{CandidateLimit: testCase.input}
			normalizeUpstreamOrchestrationSetting(&setting)
			assert.Equal(t, testCase.want, setting.CandidateLimit)
		})
	}
}
