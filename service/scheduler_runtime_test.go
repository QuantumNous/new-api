package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestObserveSchedulerRuntimePublishesChannelKeyWindow(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	previousEnabled, previousRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() {
		common.RedisEnabled, common.RDB = previousEnabled, previousRDB
		_ = client.Close()
	})

	ObserveSchedulerRuntime(7, 2, true, 0, 0, 0, 0)
	ObserveSchedulerRuntime(7, 2, false, 200, 12, 8, 250000000)
	values, err := SchedulerRuntimeSnapshot(t.Context(), 7, 2)
	require.NoError(t, err)
	require.Equal(t, "new-api-ch-7-k2", values["endpoint_id"])
	require.Equal(t, "1", values["requests_started"])
	require.Equal(t, "1", values["requests_finished"])
	require.Equal(t, "0", values["inflight"])
	require.Equal(t, "12", values["input_tokens"])
	require.Equal(t, "8", values["output_tokens"])
	require.Equal(t, "1", values["success_total"])
	require.Equal(t, "250", values["latency_sum_ms"])
}

func TestBeginSchedulerRuntimeWithCapacityPublishesLimits(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	previousEnabled, previousRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() {
		common.RedisEnabled, common.RDB = previousEnabled, previousRDB
		_ = client.Close()
	})

	BeginSchedulerRuntimeWithCapacity(8, 1, 120, 90000, 20)
	values, err := SchedulerRuntimeSnapshot(t.Context(), 8, 1)
	require.NoError(t, err)
	require.Equal(t, "120", values["capacity_rpm"])
	require.Equal(t, "90000", values["capacity_tpm"])
	require.Equal(t, "20", values["max_concurrency"])
}
