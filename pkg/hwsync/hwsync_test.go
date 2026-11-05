package hwsync

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCompareTags pins the ordering the dashboard relies on, and the cases the
// dashboard must not silently mis-rank.
func TestCompareTags(t *testing.T) {
	cases := []struct {
		left, right string
		want        int
	}{
		{"v1.0.0-rc.48", "v1.0.0-rc.47", 1},
		{"v1.0.0-rc.47", "v1.0.0-rc.48", -1},
		{"v1.0.0-rc.48", "v1.0.0-rc.48", 0},
		{"v1.0.0-rc.9", "v1.0.0-rc.10", -1},
		{"v1.0.0", "v1.0.0-rc.48", 1},
		{"v1.0.0-patch.1", "v1.0.0", 1},
		{"v1.0.1-rc.1", "v1.0.0", 1},
		{"v1.0.0-beta.2", "v1.0.0-rc.1", -1},
		{"1.0.0-rc.48", "v1.0.0-rc.48", 0},
		{"v1.0.0-rc.1-i18nfix.2", "v1.0.0-rc.1", 1},
	}
	for _, tc := range cases {
		got, err := CompareTags(tc.left, tc.right)
		require.NoError(t, err, "%s vs %s", tc.left, tc.right)
		assert.Equal(t, tc.want, got, "%s vs %s", tc.left, tc.right)
	}

	for _, bad := range []string{"", "nightly", "v0.0.0"} {
		_, err := CompareTags(bad, "v1.0.0-rc.48")
		assert.Error(t, err, "an unreadable tag must not be ranked as older: %q", bad)
	}
}

func TestMergedTag(t *testing.T) {
	assert.Equal(t, "v1.0.0-rc.48", MergedTag())
}
