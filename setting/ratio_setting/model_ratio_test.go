package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultModelRatioIncludesClaudeSonnet46(t *testing.T) {
	ratio, ok := defaultModelRatio["claude-sonnet-4-6"]
	require.True(t, ok)
	require.Equal(t, 1.5, ratio)
}
