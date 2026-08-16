package origin

import (
	"context"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type kafkaMessageWriter interface {
	WriteMessages(context.Context, ...kafka.Message) error
	Close() error
}

type KafkaPublisher struct {
	writer kafkaMessageWriter
}

func NewKafkaPublisher(brokers []string) (*KafkaPublisher, error) {
	if len(brokers) == 0 {
		return nil, errors.New("Origin Kafka publisher requires brokers")
	}
	writer := &kafka.Writer{
		Addr:                   kafka.TCP(brokers...),
		Balancer:               &kafka.Hash{},
		RequiredAcks:           kafka.RequireAll,
		Async:                  false,
		AllowAutoTopicCreation: false,
		WriteTimeout:           10 * time.Second,
	}
	return newKafkaPublisher(writer), nil
}

func newKafkaPublisher(writer kafkaMessageWriter) *KafkaPublisher {
	return &KafkaPublisher{writer: writer}
}

func (publisher *KafkaPublisher) Publish(ctx context.Context, topic, partitionKey string, payload []byte) error {
	if publisher == nil || publisher.writer == nil || topic != UsageTopic || partitionKey == "" || len(payload) == 0 {
		return errors.New("invalid Origin Kafka usage event")
	}
	var event MeteringUsageRecordedV2
	if err := common.Unmarshal(payload, &event); err != nil {
		return errors.New("invalid Origin Kafka usage event")
	}
	if _, err := uuid.Parse(event.EventID); err != nil || event.EventType != "metering.usage_recorded.v2" ||
		event.EventVersion != MeteringUsageEventVersion || event.PartitionKey != partitionKey {
		return errors.New("invalid Origin Kafka usage event")
	}
	return publisher.writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(partitionKey),
		Value: append([]byte(nil), payload...),
	})
}

func (publisher *KafkaPublisher) Close() error {
	if publisher == nil || publisher.writer == nil {
		return nil
	}
	return publisher.writer.Close()
}
