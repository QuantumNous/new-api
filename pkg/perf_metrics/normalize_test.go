package perfmetrics

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeModelName(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in, want string
	}{
		{"Deepseek-V4-Flash", "deepseek-v4-flash"},
		{"  deepseek-v4-flash  ", "deepseek-v4-flash"},
		{"DeepSeek-V4-Flash", "deepseek-v4-flash"},
		{"gpt-4o", "gpt-4o"},
		{"provider/Path/Model", "provider/path/model"},
		{"model:free", "model:free"},
		{"model[free]", "model[free]"},
		{"", ""},
		{"   ", ""},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.in, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tc.want, NormalizeModelName(tc.in))
		})
	}
}

func TestNormalizeModelNameCollapsesCasingOnly(t *testing.T) {
	t.Parallel()
	a := NormalizeModelName("Deepseek-V4-Flash")
	b := NormalizeModelName("deepseek-v4-flash")
	require.Equal(t, a, b)
	require.NotEqual(t, NormalizeModelName("foo:free"), NormalizeModelName("foo"))
}

func TestIsChatCapableModelName(t *testing.T) {
	t.Parallel()
	require.True(t, IsChatCapableModelName("gpt-4o-mini"))
	for _, name := range []string{
		"gpt-image-2", "dall-e-3", "whisper-1", "sora-2",
		"text-embedding-3-small", "bge-m3", "jina-rerank-v2",
	} {
		require.Falsef(t, IsChatCapableModelName(name), "%s should not be chat capable for summary", name)
	}
}
