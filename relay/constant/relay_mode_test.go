package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestImageEditAliasesShareRelayMode(t *testing.T) {
	assert.Equal(t, RelayModeImagesEdits, Path2RelayMode("/v1/images/edits"))
	assert.Equal(t, RelayModeImagesEdits, Path2RelayMode("/v1/edits"))
}
