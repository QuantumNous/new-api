package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompareVersions(t *testing.T) {
	assert.Equal(t, -1, CompareVersions("v1.0.0", "v1.0.1"))
	assert.Equal(t, 0, CompareVersions("1.0.0", "v1.0.0"))
	assert.Equal(t, 1, CompareVersions("v1.2.0", "v1.1.9"))
	assert.Equal(t, -1, CompareVersions("v1.0.0-rc.20", "v1.0.0-rc.21")) // best-effort: if rc not parsed, document fallback as numeric prefix only
}
