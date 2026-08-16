package origin

import (
	"context"
	"testing"

	"github.com/segmentio/kafka-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingKafkaWriter struct {
	messages []kafka.Message
}

func (writer *recordingKafkaWriter) WriteMessages(_ context.Context, messages ...kafka.Message) error {
	writer.messages = append(writer.messages, messages...)
	return nil
}

func (writer *recordingKafkaWriter) Close() error { return nil }

func TestKafkaPublisherKeepsStableTopicPartitionKeyAndPayload(t *testing.T) {
	writer := &recordingKafkaWriter{}
	publisher := newKafkaPublisher(writer)
	payload := []byte(`{"event_id":"01980000-0000-7000-8000-000000000401","event_type":"metering.usage_recorded.v2","event_version":2,"partition_key":"reservation:01980000-0000-7000-8000-000000000006"}`)

	require.NoError(t, publisher.Publish(context.Background(), UsageTopic, "reservation:01980000-0000-7000-8000-000000000006", payload))
	require.Len(t, writer.messages, 1)
	assert.Equal(t, UsageTopic, writer.messages[0].Topic)
	assert.Equal(t, "reservation:01980000-0000-7000-8000-000000000006", string(writer.messages[0].Key))
	assert.Equal(t, payload, writer.messages[0].Value)
	require.NoError(t, publisher.Close())
}

func TestKafkaPublisherRejectsUnexpectedTopicOrInvalidEventBeforeBroker(t *testing.T) {
	writer := &recordingKafkaWriter{}
	publisher := newKafkaPublisher(writer)

	require.Error(t, publisher.Publish(context.Background(), "other-topic", "reservation:id", []byte(`{}`)))
	require.Error(t, publisher.Publish(context.Background(), UsageTopic, "reservation:id", []byte(`{"event_id":"not-a-uuid"}`)))
	assert.Empty(t, writer.messages)
}
