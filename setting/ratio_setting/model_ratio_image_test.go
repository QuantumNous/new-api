package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultGPTImage2TokenPricingMatchesProduction(t *testing.T) {
	require.Equal(t, 2.5, defaultModelRatio["gpt-image-2"])
	require.Equal(t, 6.0, defaultCompletionRatio["gpt-image-2"])
	require.Equal(t, 1.6, defaultImageRatio["gpt-image-2"])
}
