package controller

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
)

func TestTruncateChannelContributionErrorPreservesUTF8(t *testing.T) {
	message := strings.Repeat("错误", 1_100)
	truncated := truncateChannelContributionError(message, 2_000)
	assert.LessOrEqual(t, len(truncated), 2_000)
	assert.True(t, utf8.ValidString(truncated))
	assert.Equal(t, message, truncateChannelContributionError(message, len(message)))
}
