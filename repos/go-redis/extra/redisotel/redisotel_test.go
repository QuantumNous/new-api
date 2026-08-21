package redisotel_test

import (
	"context"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
	"testing"

	"github.com/go-redis/redis/extra/redisotel/v8"
	"github.com/go-redis/redis/v8"
	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

func TestNew(t *testing.T) {
	// this also functions as a compile-time test that the
	// TracingHook conforms to the Hook interface
	var _ redis.Hook = redisotel.NewTracingHook()
}

type providerFunc func(name string, opts ...trace.TracerOption) trace.Tracer

func (fn providerFunc) Tracer(name string, opts ...trace.TracerOption) trace.Tracer {
	return fn(name, opts...)
}

func TestNewWithTracerProvider(t *testing.T) {
	invoked := false

	tp := providerFunc(func(name string, opts ...trace.TracerOption) trace.Tracer {
		invoked = true
		return otel.GetTracerProvider().Tracer(name, opts...)
	})

	_ = redisotel.NewTracingHook(redisotel.WithTracerProvider(tp))

	if !invoked {
		t.Fatalf("did not call custom TraceProvider")
	}
}

func TestNewWithAttributes(t *testing.T) {
	provider := sdktrace.NewTracerProvider()
	hook := redisotel.NewTracingHook(redisotel.WithTracerProvider(provider), redisotel.WithAttributes(semconv.NetPeerNameKey.String("localhost")))
	ctx, span := provider.Tracer("redis-test").Start(context.TODO(), "redis-test")
	cmd := redis.NewCmd(ctx, "ping")
	defer span.End()

	ctx, err := hook.BeforeProcess(ctx, cmd)
	if err != nil {
		t.Fatal(err)
	}
	err = hook.AfterProcess(ctx, cmd)
	if err != nil {
		t.Fatal(err)
	}

	attrs := trace.SpanFromContext(ctx).(sdktrace.ReadOnlySpan).Attributes()
	if !(attrs[0] == semconv.DBSystemRedis) {
		t.Fatalf("expected attrs[0] to be semconv.DBSystemRedis, got: %v", attrs[0])
	}
	if !(attrs[1] == semconv.NetPeerNameKey.String("localhost")) {
		t.Fatalf("expected attrs[1] to be semconv.NetPeerNameKey.String(\"localhost\"), got: %v", attrs[1])
	}
	if !(attrs[2] == semconv.DBStatementKey.String("ping")) {
		t.Fatalf("expected attrs[2] to be semconv.DBStatementKey.String(\"ping\"), got: %v", attrs[2])
	}
}
