package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetCompletionRatioGPT56UsesSpecialRatio(t *testing.T) {
	assert.Equal(t, 6.0, GetCompletionRatio("gpt-5.6-sol"))
	assert.Equal(t, 6.0, GetCompletionRatio("gpt-5.6-terra"))
	assert.Equal(t, 6.0, GetCompletionRatio("gpt-5.6-luna"))
}
