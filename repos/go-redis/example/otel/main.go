package main

import (
	"context"
	"log"
	"sync"

	"github.com/uptrace/opentelemetry-go-extra/otelplay"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"

	"github.com/go-redis/redis/extra/redisotel/v8"
	"github.com/go-redis/redis/v8"
)

var tracer = otel.Tracer("redisexample")

func main() {
	ctx := context.Background()

	shutdown := otelplay.ConfigureOpentelemetry(ctx)
	defer shutdown()

	rdb := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})
	rdb.AddHook(redisotel.NewTracingHook(redisotel.WithAttributes(semconv.NetPeerNameKey.String("localhost"), semconv.NetPeerPortKey.String("6379"))))

	ctx, span := tracer.Start(ctx, "handleRequest")
	defer span.End()

	if err := handleRequest(ctx, rdb); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}

	otelplay.PrintTraceID(ctx)
}

func handleRequest(ctx context.Context, rdb *redis.Client) error {
	if err := rdb.Set(ctx, "First value", "value_1", 0).Err(); err != nil {
		return err
	}
	if err := rdb.Set(ctx, "Second value", "value_2", 0).Err(); err != nil {
		return err
	}

	var group sync.WaitGroup

	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			val := rdb.Get(ctx, "Second value").Val()
			if val != "value_2" {
				log.Printf("%q != %q", val, "value_2")
			}
		}()
	}

	group.Wait()

	if err := rdb.Del(ctx, "First value").Err(); err != nil {
		return err
	}
	if err := rdb.Del(ctx, "Second value").Err(); err != nil {
		return err
	}

	return nil
}
