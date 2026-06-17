package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const channelMonitorCleanupInterval = 24 * time.Hour

type channelMonitorTimerEntry struct {
	monitor *model.ChannelMonitor
	timer   *time.Timer
	version int64
}

type channelMonitorRunner struct {
	mu       sync.Mutex
	entries  map[int64]*channelMonitorTimerEntry
	inflight map[int64]struct{}
	sem      chan struct{}
	version  int64
}

var channelMonitorRunnerOnce sync.Once

func StartChannelMonitorTask() {
	channelMonitorRunnerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}

		runner := newChannelMonitorRunner()
		SetChannelMonitorScheduler(runner)

		gopool.Go(func() {
			ctx, cancel := context.WithTimeout(context.Background(), monitorStartupLoadTimeout)
			defer cancel()

			if err := runner.loadEnabled(ctx); err != nil {
				logger.LogWarn(ctx, fmt.Sprintf("channel monitor runner initial load failed: %v", err))
			}
			logger.LogInfo(ctx, fmt.Sprintf("channel monitor runner started: concurrency=%d", monitorWorkerConcurrency))

			CleanupChannelMonitorHistory(ctx)
			ticker := time.NewTicker(channelMonitorCleanupInterval)
			defer ticker.Stop()
			for range ticker.C {
				CleanupChannelMonitorHistory(context.Background())
			}
		})
	})
}

func newChannelMonitorRunner() *channelMonitorRunner {
	return &channelMonitorRunner{
		entries:  make(map[int64]*channelMonitorTimerEntry),
		inflight: make(map[int64]struct{}),
		sem:      make(chan struct{}, monitorWorkerConcurrency),
	}
}

func (r *channelMonitorRunner) loadEnabled(ctx context.Context) error {
	items, err := ListEnabledChannelMonitors(ctx)
	if err != nil {
		return err
	}
	for _, item := range items {
		r.Schedule(item)
	}
	return nil
}

func (r *channelMonitorRunner) Schedule(m *model.ChannelMonitor) {
	if r == nil || m == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	if !m.Enabled {
		r.unscheduleLocked(m.Id)
		return
	}
	if m.APIKeyDecryptFailed {
		r.unscheduleLocked(m.Id)
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d api key decrypt failed", m.Id))
		return
	}
	r.scheduleLocked(cloneChannelMonitorForTimer(m))
}

func (r *channelMonitorRunner) Unschedule(id int64) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.unscheduleLocked(id)
}

func (r *channelMonitorRunner) scheduleLocked(m *model.ChannelMonitor) {
	r.unscheduleLocked(m.Id)
	r.version++
	version := r.version
	entry := &channelMonitorTimerEntry{
		monitor: m,
		version: version,
	}
	delay := nextChannelMonitorDelay(m)
	entry.timer = time.AfterFunc(delay, func() {
		r.fire(m.Id, version)
	})
	r.entries[m.Id] = entry
}

func (r *channelMonitorRunner) unscheduleLocked(id int64) {
	if entry := r.entries[id]; entry != nil && entry.timer != nil {
		entry.timer.Stop()
	}
	delete(r.entries, id)
}

func (r *channelMonitorRunner) fire(id int64, version int64) {
	monitorSnapshot, ok := r.currentMonitorSnapshot(id, version)
	if !ok {
		return
	}

	if !operation_setting.GetMonitorSetting().ChannelMonitorEnabled {
		r.rescheduleIfCurrent(monitorSnapshot, version)
		return
	}
	if !r.tryEnter(id) {
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d already running", id))
		r.rescheduleIfCurrent(monitorSnapshot, version)
		return
	}
	defer r.leave(id)

	select {
	case r.sem <- struct{}{}:
		defer func() { <-r.sem }()
	default:
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d global concurrency full", id))
		r.rescheduleIfCurrent(monitorSnapshot, version)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), monitorRequestTimeout+monitorRunOneBuffer)
	defer cancel()

	if _, err := RunChannelMonitorCheck(ctx, id); err != nil {
		if errors.Is(err, ErrChannelMonitorNotFound) {
			r.unscheduleIfCurrent(id, version)
			return
		}
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor scheduled check failed: monitor_id=%d error=%v", id, err))
	}

	fresh, err := model.GetChannelMonitorByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			r.unscheduleIfCurrent(id, version)
			return
		}
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor reload after scheduled check failed: monitor_id=%d error=%v", id, err))
		r.rescheduleIfCurrent(monitorSnapshot, version)
		return
	}
	if !fresh.Enabled {
		r.unscheduleIfCurrent(id, version)
		return
	}
	r.rescheduleIfCurrent(fresh, version)
}

func (r *channelMonitorRunner) currentMonitorSnapshot(id int64, version int64) (*model.ChannelMonitor, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[id]
	if entry == nil || entry.version != version || entry.monitor == nil {
		return nil, false
	}
	return cloneChannelMonitorForTimer(entry.monitor), true
}

func (r *channelMonitorRunner) rescheduleIfCurrent(m *model.ChannelMonitor, version int64) {
	if r == nil || m == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[m.Id]
	if entry == nil || entry.version != version {
		return
	}
	if !m.Enabled {
		r.unscheduleLocked(m.Id)
		return
	}
	r.scheduleLocked(cloneChannelMonitorForTimer(m))
}

func (r *channelMonitorRunner) unscheduleIfCurrent(id int64, version int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry := r.entries[id]
	if entry == nil || entry.version != version {
		return
	}
	r.unscheduleLocked(id)
}

func (r *channelMonitorRunner) tryEnter(id int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.inflight[id]; ok {
		return false
	}
	r.inflight[id] = struct{}{}
	return true
}

func (r *channelMonitorRunner) leave(id int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.inflight, id)
}

func nextChannelMonitorDelay(m *model.ChannelMonitor) time.Duration {
	seconds := m.IntervalSeconds
	if seconds < monitorMinIntervalSeconds {
		seconds = monitorMinIntervalSeconds
	}
	jitter := m.JitterSeconds
	if jitter > 0 {
		seconds += rand.IntN(jitter*2+1) - jitter
	}
	if seconds < monitorMinIntervalSeconds {
		seconds = monitorMinIntervalSeconds
	}
	return time.Duration(seconds) * time.Second
}

func cloneChannelMonitorForTimer(m *model.ChannelMonitor) *model.ChannelMonitor {
	if m == nil {
		return nil
	}
	cp := *m
	return &cp
}
