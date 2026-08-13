package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGPT54CompletionRatioCanBeConfigured(t *testing.T) {
	info := GetCompletionRatioInfo("gpt-5.4")
	assert.False(t, info.Locked)
}
