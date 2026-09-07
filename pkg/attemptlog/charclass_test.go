package attemptlog

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestCountChars pins the script-class split used as a tokenizer-proxy feature.
// The buckets carry billing-relevant information: Latin text averages far more
// characters per token than Han text, so a misclassification here would corrupt
// downstream estimates.
func TestCountChars(t *testing.T) {
	cases := []struct {
		name     string
		text     string
		expected CharCounts
	}{
		{
			name:     "empty",
			text:     "",
			expected: CharCounts{},
		},
		{
			name:     "plain ascii",
			text:     "Hello, World! 123",
			expected: CharCounts{Latin: 10, Other: 7},
		},
		{
			name:     "pure han",
			text:     "你好，世界",
			expected: CharCounts{Han: 4, Other: 1},
		},
		{
			name:     "mixed latin and han",
			text:     "Hello 世界",
			expected: CharCounts{Latin: 5, Han: 2, Other: 1},
		},
		{
			name:     "emoji counts as other",
			text:     "hi \U0001F600",
			expected: CharCounts{Latin: 2, Other: 2},
		},
		{
			name:     "accented latin still latin",
			text:     "café",
			expected: CharCounts{Latin: 4},
		},
		{
			name:     "cyrillic is other not latin",
			text:     "привет",
			expected: CharCounts{Other: 6},
		},
		{
			name:     "fullwidth punctuation is other",
			text:     "！",
			expected: CharCounts{Other: 1},
		},
		{
			name:     "japanese kana is other but kanji is han",
			text:     "日本語のテスト",
			expected: CharCounts{Han: 3, Other: 4},
		},
		{
			name:     "invalid utf-8 decodes to other",
			text:     string([]byte{0xff, 0xfe, 'a'}),
			expected: CharCounts{Latin: 1, Other: 2},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, CountChars(tc.text))
		})
	}
}
