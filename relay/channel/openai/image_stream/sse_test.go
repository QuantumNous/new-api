package image_stream

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAggregateResponseStreamRejectsTruncatedOutput(t *testing.T) {
	stream := `data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"result"}}

`
	response, err := AggregateResponseStream(strings.NewReader(stream))
	require.Error(t, err)
	assert.Nil(t, response)
	assert.Contains(t, err.Error(), "response.completed")
}

func TestAggregateResponseStreamAcceptsCompletedOutput(t *testing.T) {
	stream := `data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"result"}}

data: {"type":"response.completed","response":{"model":"gpt-image-1","usage":{"input_tokens":2,"output_tokens":3}}}

`
	response, err := AggregateResponseStream(strings.NewReader(stream))
	require.NoError(t, err)
	require.Len(t, response.Output, 1)
	assert.Equal(t, "result", response.Output[0].Result)
	require.NotNil(t, response.Usage)
	assert.Equal(t, 2, response.Usage.InputTokens)
}
