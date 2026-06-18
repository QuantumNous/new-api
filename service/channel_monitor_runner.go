package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"runtime/debug"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	channelMonitorCleanupInterval        = 24 * time.Hour
	channelMonitorStartupMaxInitialDelay = time.Minute
)

type channelMonitorCheckFunc func(ctx context.Context, id int64) ([]*CheckResult, error)
type channelMonitorReloadFunc func(id int64) (*model.ChannelMonitor, error)

type channelMonitorTask struct {
	id       int64
	name     string
	interval time.Duration
	jitter   time.Duration
	cancel   context.CancelFunc
}

type channelMonitorRunner struct {
	mu           sync.Mutex
	tasks        map[int64]*channelMonitorTask
	inflight     map[int64]struct{}
	sem          chan struct{}
	parentCtx    context.Context
	parentCancel context.CancelFunc
	taskWg       sync.WaitGroup
	workerWg     sync.WaitGroup
	stopped      bool
	checkFunc    channelMonitorCheckFunc
	reloadFunc   channelMonitorReloadFunc
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
	ctx, cancel := context.WithCancel(context.Background())
	return &channelMonitorRunner{
		tasks:        make(map[int64]*channelMonitorTask),
		inflight:     make(map[int64]struct{}),
		sem:          make(chan struct{}, monitorWorkerConcurrency),
		parentCtx:    ctx,
		parentCancel: cancel,
		checkFunc:    RunChannelMonitorCheck,
		reloadFunc:   model.GetChannelMonitorByID,
	}
}

func (r *channelMonitorRunner) loadEnabled(ctx context.Context) error {
	items, err := ListEnabledChannelMonitors(ctx)
	if err != nil {
		return err
	}
	for _, item := range items {
		r.scheduleFromStartup(item)
	}
	return nil
}

func (r *channelMonitorRunner) Schedule(m *model.ChannelMonitor) {
	r.schedule(m, 0, true)
}

func (r *channelMonitorRunner) scheduleFromStartup(m *model.ChannelMonitor) {
	r.schedule(m, nextChannelMonitorStartupDelay(m), false)
}

func (r *channelMonitorRunner) schedule(m *model.ChannelMonitor, initialDelay time.Duration, replace bool) {
	if r == nil || m == nil {
		return
	}
	if !m.Enabled {
		r.Unschedule(m.Id)
		return
	}
	if m.APIKeyDecryptFailed {
		r.Unschedule(m.Id)
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d api key decrypt failed", m.Id))
		return
	}

	ctx, cancel := context.WithCancel(r.parentCtx)
	task := &channelMonitorTask{
		id:       m.Id,
		name:     m.Name,
		interval: channelMonitorInterval(m),
		jitter:   channelMonitorJitter(m),
		cancel:   cancel,
	}

	r.mu.Lock()
	if r.stopped {
		r.mu.Unlock()
		cancel()
		return
	}
	if !replace {
		if _, ok := r.tasks[m.Id]; ok {
			r.mu.Unlock()
			cancel()
			return
		}
	}
	if existing := r.tasks[m.Id]; existing != nil {
		existing.cancel()
	}
	r.tasks[m.Id] = task
	r.taskWg.Add(1)
	r.mu.Unlock()

	go r.runScheduled(ctx, task, initialDelay)
}

func (r *channelMonitorRunner) Unschedule(id int64) {
	if r == nil {
		return
	}
	var task *channelMonitorTask
	r.mu.Lock()
	if r.tasks != nil {
		task = r.tasks[id]
		delete(r.tasks, id)
	}
	r.mu.Unlock()
	if task != nil {
		task.cancel()
	}
}

func (r *channelMonitorRunner) Stop() {
	if r == nil {
		return
	}
	r.mu.Lock()
	if r.stopped {
		r.mu.Unlock()
		return
	}
	r.stopped = true
	r.parentCancel()
	for _, task := range r.tasks {
		task.cancel()
	}
	r.tasks = nil
	r.mu.Unlock()

	r.taskWg.Wait()
	r.workerWg.Wait()
}

func (r *channelMonitorRunner) runScheduled(ctx context.Context, task *channelMonitorTask, initialDelay time.Duration) {
	defer r.taskWg.Done()

	if initialDelay > 0 {
		timer := time.NewTimer(initialDelay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
	r.fire(ctx, task)

	timer := time.NewTimer(task.nextDelay())
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			r.fire(ctx, task)
			timer.Reset(task.nextDelay())
		}
	}
}

func (r *channelMonitorRunner) fire(ctx context.Context, task *channelMonitorTask) {
	if r == nil || task == nil || ctx.Err() != nil {
		return
	}
	if !operation_setting.GetMonitorSetting().ChannelMonitorEnabled {
		return
	}
	if !r.tryEnter(task.id) {
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d already running", task.id))
		return
	}
	select {
	case r.sem <- struct{}{}:
	default:
		r.leave(task.id)
		logger.LogWarn(context.Background(), fmt.Sprintf("channel monitor scheduled check skipped: monitor_id=%d global concurrency full", task.id))
		return
	}
	if !r.addWorker() {
		<-r.sem
		r.leave(task.id)
		return
	}

	go func() {
		defer r.workerWg.Done()
		defer func() {
			<-r.sem
			r.leave(task.id)
		}()
		defer func() {
			if rec := recover(); rec != nil {
				logger.LogError(context.Background(), fmt.Sprintf("channel monitor scheduled check panic: monitor_id=%d panic=%v stack=%s", task.id, rec, string(debug.Stack())))
			}
		}()
		r.runOne(ctx, task)
	}()
}

func (r *channelMonitorRunner) addWorker() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped {
		return false
	}
	r.workerWg.Add(1)
	return true
}

func (r *channelMonitorRunner) runOne(parent context.Context, task *channelMonitorTask) {
	if parent.Err() != nil {
		return
	}
	ctx, cancel := context.WithTimeout(parent, monitorRequestTimeout+monitorPingTimeout+monitorRunOneBuffer)
	defer cancel()

	checkFunc := r.checkFunc
	if checkFunc == nil {
		checkFunc = RunChannelMonitorCheck
	}
	if _, err := checkFunc(ctx, task.id); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		if errors.Is(err, ErrChannelMonitorNotFound) {
			r.Unschedule(task.id)
			return
		}
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor scheduled check failed: monitor_id=%d error=%v", task.id, err))
	}
	if parent.Err() != nil || ctx.Err() != nil {
		return
	}

	if r.reloadFunc == nil {
		return
	}
	fresh, err := r.reloadFunc(task.id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			r.Unschedule(task.id)
			return
		}
		logger.LogWarn(ctx, fmt.Sprintf("channel monitor reload after scheduled check failed: monitor_id=%d error=%v", task.id, err))
		return
	}
	if !fresh.Enabled {
		r.Unschedule(task.id)
	}
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

func (task *channelMonitorTask) nextDelay() time.Duration {
	if task == nil {
		return time.Duration(monitorMinIntervalSeconds) * time.Second
	}
	if task.jitter <= 0 {
		return task.interval
	}
	offset := time.Duration(rand.Int64N(int64(task.jitter)*2+1)) - task.jitter
	delay := task.interval + offset
	if minDelay := time.Duration(monitorMinIntervalSeconds) * time.Second; delay < minDelay {
		return minDelay
	}
	return delay
}

func channelMonitorInterval(m *model.ChannelMonitor) time.Duration {
	seconds := monitorMinIntervalSeconds
	if m != nil {
		seconds = m.IntervalSeconds
	}
	if seconds < monitorMinIntervalSeconds {
		seconds = monitorMinIntervalSeconds
	}
	if seconds > monitorMaxIntervalSeconds {
		seconds = monitorMaxIntervalSeconds
	}
	return time.Duration(seconds) * time.Second
}

func channelMonitorJitter(m *model.ChannelMonitor) time.Duration {
	if m == nil || m.JitterSeconds <= 0 {
		return 0
	}
	intervalSeconds := int(channelMonitorInterval(m) / time.Second)
	jitterSeconds := m.JitterSeconds
	if jitterSeconds > intervalSeconds-monitorMinIntervalSeconds {
		jitterSeconds = intervalSeconds - monitorMinIntervalSeconds
	}
	if jitterSeconds <= 0 {
		return 0
	}
	return time.Duration(jitterSeconds) * time.Second
}

func nextChannelMonitorStartupDelay(m *model.ChannelMonitor) time.Duration {
	spread := channelMonitorInterval(m)
	if spread > channelMonitorStartupMaxInitialDelay {
		spread = channelMonitorStartupMaxInitialDelay
	}
	if spread <= 0 {
		return 0
	}
	return time.Duration(rand.Int64N(int64(spread) + 1))
}
