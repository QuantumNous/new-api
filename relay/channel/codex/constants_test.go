package codex

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func TestModelListKeepsLegacyImageAndLatestModels(t *testing.T) {
	require.Contains(t, ModelList, "gpt-5-codex")
	require.Contains(t, ModelList, "gpt-image-2")
	require.Contains(t, ModelList, "gpt-5.4-mini")
	require.Contains(t, ModelList, "gpt-5.5")
	require.Contains(t, ModelList, ratio_setting.WithCompactModelSuffix("gpt-5.5"))
	require.Contains(t, ModelList, "gpt-5.6-sol")
	require.Contains(t, ModelList, "gpt-5.6-terra")
	require.Contains(t, ModelList, "gpt-5.6-luna")
	require.NotContains(t, ModelList, "codex-auto-review")
	require.NotContains(t, ModelList, ratio_setting.WithCompactModelSuffix("codex-auto-review"))
}
