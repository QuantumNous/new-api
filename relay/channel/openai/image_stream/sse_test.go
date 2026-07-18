package image_stream

import (
	"context"
	"fmt"
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

func TestAggregateResponseStreamRejectsTooManyOutputItems(t *testing.T) {
	var stream strings.Builder
	for i := 0; i < 129; i++ {
		fmt.Fprintf(&stream, "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":\"%d\"}}\n\n", i)
	}
	stream.WriteString(`data: {"type":"response.completed","response":{}}`)

	response, err := AggregateResponseStream(strings.NewReader(stream.String()))
	require.Error(t, err)
	assert.Nil(t, response)
	assert.Contains(t, err.Error(), "more than")
}

func TestAggregateResponseStreamLeaseSkipsPartialAndRetainsFinalOutput(t *testing.T) {
	padding := strings.Repeat("p", sseLeaseAcquireBytes+128)
	result := strings.Repeat("i", sseLeaseAcquireBytes+256)
	stream := fmt.Sprintf(
		"data: {\"type\":\"heartbeat\",\"padding\":%q}\n\n"+
			"data: {\"type\":\"response.image_generation_call.partial_image\",\"partial_image_b64\":%q}\n\n"+
			"data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":%q}}\n\n"+
			"data: {\"type\":\"response.completed\",\"response\":{}}\n\n",
		padding,
		padding,
		result,
	)

	held := false
	acquisitions := 0
	releases := 0
	lease := &sseOutputLease{
		acquire: func() (bool, error) {
			if held {
				return false, nil
			}
			held = true
			acquisitions++
			return true, nil
		},
		release: func() {
			require.True(t, held)
			held = false
			releases++
		},
	}

	response, err := aggregateResponseStream(strings.NewReader(stream), lease)

	require.NoError(t, err)
	require.Len(t, response.Output, 1)
	assert.Equal(t, result, response.Output[0].Result)
	assert.Equal(t, 2, acquisitions, "an ignored large event and the final output each acquire once")
	assert.Equal(t, 1, releases, "the ignored event releases immediately while the final output remains protected")
	assert.True(t, held, "the final output lease must remain held for artifact persistence and R2 upload")
	lease.release()
	assert.False(t, held)
	assert.Equal(t, 2, releases)
}

func TestAggregateResponseStreamLeaseCancellationStopsBeforeLargeLineGrowth(t *testing.T) {
	result := strings.Repeat("i", sseLeaseAcquireBytes+256)
	stream := fmt.Sprintf(
		"data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":%q}}\n\n",
		result,
	)
	lease := &sseOutputLease{
		acquire: func() (bool, error) {
			return false, context.Canceled
		},
	}

	response, err := aggregateResponseStream(strings.NewReader(stream), lease)

	require.ErrorIs(t, err, context.Canceled)
	assert.Nil(t, response)
}
