package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompactionRequestPreservesCodexParityFields(t *testing.T) {
	reasoning := &Reasoning{Effort: "high"}
	req := &OpenAIResponsesCompactionRequest{
		Tools:             []byte(`[{"type":"function","name":"lookup"}]`),
		ParallelToolCalls: []byte(`true`),
		Reasoning:         reasoning,
		Text:              []byte(`{"format":{"type":"text"}}`),
	}

	converted := req.ToResponsesRequest()

	assert.JSONEq(t, string(req.Tools), string(converted.Tools))
	assert.JSONEq(t, string(req.ParallelToolCalls), string(converted.ParallelToolCalls))
	assert.Same(t, reasoning, converted.Reasoning)
	assert.JSONEq(t, string(req.Text), string(converted.Text))
}
