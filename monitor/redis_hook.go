package monitor

import (
	"context"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

type redisMetricsHookKey struct{}

type redisMetricsHook struct{}

var _ redis.Hook = (*redisMetricsHook)(nil)

func (h *redisMetricsHook) BeforeProcess(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
	return context.WithValue(ctx, redisMetricsHookKey{}, time.Now()), nil
}

func (h *redisMetricsHook) AfterProcess(ctx context.Context, cmd redis.Cmder) error {
	if !Enabled() {
		return nil
	}
	command := strings.ToUpper(cmd.Name())
	status := "success"
	if cmd.Err() != nil && cmd.Err() != redis.Nil {
		status = "error"
	}
	RedisCommandsTotal.WithLabelValues(command, status).Inc()

	if start, ok := ctx.Value(redisMetricsHookKey{}).(time.Time); ok {
		RedisCommandDuration.WithLabelValues(command).Observe(time.Since(start).Seconds())
	}
	return nil
}

func (h *redisMetricsHook) BeforeProcessPipeline(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
	return context.WithValue(ctx, redisMetricsHookKey{}, time.Now()), nil
}

func (h *redisMetricsHook) AfterProcessPipeline(ctx context.Context, cmds []redis.Cmder) error {
	if !Enabled() {
		return nil
	}
	start, _ := ctx.Value(redisMetricsHookKey{}).(time.Time)
	for _, cmd := range cmds {
		command := strings.ToUpper(cmd.Name())
		status := "success"
		if cmd.Err() != nil && cmd.Err() != redis.Nil {
			status = "error"
		}
		RedisCommandsTotal.WithLabelValues(command, status).Inc()
	}
	if !start.IsZero() {
		RedisCommandDuration.WithLabelValues("PIPELINE").Observe(time.Since(start).Seconds())
	}
	return nil
}

// RegisterRedisHook adds the Prometheus metrics hook to a Redis client.
func RegisterRedisHook(rdb *redis.Client) {
	if rdb == nil || !Enabled() {
		return
	}
	rdb.AddHook(&redisMetricsHook{})
}
