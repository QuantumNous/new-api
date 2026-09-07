package attemptlog

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGuessTaskType(t *testing.T) {
	cases := []struct {
		name     string
		text     string
		expected string
	}{
		{
			name:     "code with code block",
			text:     "Please fix this:\n```python\nprint('hello')\n```",
			expected: TaskTypeCode,
		},
		{
			name:     "code with traceback",
			text:     "I got this error: Traceback (most recent call last): File ...",
			expected: TaskTypeCode,
		},
		{
			name:     "math with latex",
			text:     "Solve the integral $$\\int_0^1 x^2 dx$$",
			expected: TaskTypeMath,
		},
		{
			name:     "math proof",
			text:     "证明这个定理成立",
			expected: TaskTypeMath,
		},
		{
			name:     "translate",
			text:     "translate this into English: 你好世界",
			expected: TaskTypeTranslate,
		},
		{
			name:     "summary",
			text:     "summarize the following article for me",
			expected: TaskTypeSummary,
		},
		{
			name:     "creative writing",
			text:     "write a story about a dragon",
			expected: TaskTypeCreative,
		},
		{
			name:     "qa with question mark",
			text:     "What is the capital of France?",
			expected: TaskTypeQA,
		},
		{
			name:     "qa chinese",
			text:     "什么是分布式系统？",
			expected: TaskTypeQA,
		},
		{
			name:     "short chat",
			text:     "hello",
			expected: TaskTypeChat,
		},
		{
			name:     "longer chat no markers",
			text:     "The weather is nice today. I went for a walk in the park and saw some birds flying around.",
			expected: TaskTypeChat,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, GuessTaskType(tc.text))
		})
	}
}

func TestGuessTaskTypeEmpty(t *testing.T) {
	assert.Equal(t, TaskTypeUnknown, GuessTaskType(""))
}

func TestTaskTypeGuessVersion(t *testing.T) {
	assert.Equal(t, 1, TaskTypeGuessVersion)
}

func TestGuessTaskTypeCodePriorityOverQA(t *testing.T) {
	text := "how to fix this error: TypeError: undefined is not a function?"
	assert.Equal(t, TaskTypeCode, GuessTaskType(text))
}
