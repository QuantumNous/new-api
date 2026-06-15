package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	channelflowmetrics "github.com/QuantumNous/new-api/pkg/channel_flow_metrics"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	channelFlowStatusSampleInterval = 30 * time.Second
	channelFlowStatusSampleTimeout  = 5 * time.Second
)

var (
	channelFlowStatusSampleOnce    sync.Once
	channelFlowStatusSampleRunning atomic.Bool
)

func StartChannelFlowStatusSampler() {
	channelFlowStatusSampleOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("channel flow status sampler started: tick=%s", channelFlowStatusSampleInterval))
			ticker := time.NewTicker(channelFlowStatusSampleInterval)
			defer ticker.Stop()

			runChannelFlowStatusSampleOnce()
			for range ticker.C {
				runChannelFlowStatusSampleOnce()
			}
		})
	})
}

func runChannelFlowStatusSampleOnce() {
	if !channelFlowStatusSampleRunning.CompareAndSwap(false, true) {
		return
	}
	defer channelFlowStatusSampleRunning.Store(false)

	pools, err := model.ListEnabledChannelFlowPools()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("channel flow status sampler: query pools failed: %v", err))
		return
	}
	for _, pool := range pools {
		if pool == nil || pool.PoolKey == "" {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), channelFlowStatusSampleTimeout)
		status, err := GetChannelFlowPoolStatus(ctx, *pool)
		cancel()
		if err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("channel flow status sampler: pool=%s status failed: %v", pool.PoolKey, err))
			continue
		}
		if status.Running <= 0 && status.Queued <= 0 {
			continue
		}
		channelflowmetrics.Record(channelflowmetrics.Sample{
			PoolKey:   pool.PoolKey,
			EventType: model.ChannelFlowEventStatusSample,
			Running:   status.Running,
			Queued:    status.Queued,
		})
	}
}
