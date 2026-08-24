package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWithCompactModelVariantsDeduplicatesInStableOrder(t *testing.T) {
	models := []string{"gpt-5.6-sol", "gpt-5.6-sol", "gpt-5.5-openai-compact"}

	require.Equal(t, []string{
		"gpt-5.6-sol",
		"gpt-5.5-openai-compact",
		"gpt-5.6-sol-openai-compact",
	}, WithCompactModelVariants(models))
}
