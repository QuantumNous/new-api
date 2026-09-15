package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompareRequestOutcomesDeterministicPriority(t *testing.T) {
	for _, tc := range []struct {
		name          string
		winner, loser Log
	}{
		{"consume", Log{Type: LogTypeConsume, CreatedAt: 1}, Log{Type: LogTypeError, CreatedAt: 200}},
		{"event time", Log{CreatedAt: 2, Id: 1}, Log{CreatedAt: 1, Id: 2}},
		{"id", Log{Id: 2}, Log{Id: 1, IsStream: true}},
		{"stream", Log{IsStream: true}, Log{Other: "z"}},
		{"other", Log{Other: "b"}, Log{Other: "a", Quota: 100}},
		{"quota", Log{Quota: 2}, Log{Quota: 1, PromptTokens: 100}},
		{"prompt tokens", Log{PromptTokens: 2}, Log{PromptTokens: 1, CompletionTokens: 100}},
		{"completion tokens", Log{CompletionTokens: 2}, Log{CompletionTokens: 1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, 1, compareRequestOutcomes(&tc.winner, &tc.loser))
			assert.Equal(t, -1, compareRequestOutcomes(&tc.loser, &tc.winner))
		})
	}
	assert.Zero(t, compareRequestOutcomes(&Log{ModelName: "one"}, &Log{ModelName: "two"}), "only summary-loaded facts may break ties")
}
