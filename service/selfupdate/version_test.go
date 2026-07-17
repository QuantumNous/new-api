package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompareVersions(t *testing.T) {
	assert.Equal(t, -1, CompareVersions("v1.0.0", "v1.0.1"))
	assert.Equal(t, 0, CompareVersions("1.0.0", "v1.0.0"))
	assert.Equal(t, 1, CompareVersions("v1.2.0", "v1.1.9"))
	assert.Equal(t, -1, CompareVersions("v1.0.0-rc.20", "v1.0.0-rc.21"))
	// ToyHunter fork build index
	assert.Equal(t, -1, CompareVersions("v1.0.0-rc.21-th.3", "v1.0.0-rc.21-th.4"))
	assert.Equal(t, 0, CompareVersions("v1.0.0-rc.21-th.4", "v1.0.0-rc.21-th.4"))
	assert.Equal(t, 1, CompareVersions("v1.0.0-rc.21-th.5", "v1.0.0-rc.21-th.4"))
	assert.Equal(t, -1, CompareVersions("v1.0.0-rc.21", "v1.0.0-rc.21-th.1"))
}
