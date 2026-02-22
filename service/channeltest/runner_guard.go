package channeltest

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
)

type TaskKind string

const (
	TaskKindAllChannels         TaskKind = "all_channels"
	TaskKindAutoDisabledChannel TaskKind = "auto_disabled_channels"
)

var ErrTaskRunning = fmt.Errorf("测试已在运行中")

var executionOrder = []TaskKind{
	TaskKindAllChannels,
	TaskKindAutoDisabledChannel,
}

type runGuard struct {
	mu      sync.Mutex
	running bool
	pending map[TaskKind]func()
}

func newRunGuard() *runGuard {
	return &runGuard{
		pending: make(map[TaskKind]func()),
	}
}

func (g *runGuard) submit(kind TaskKind, job func(), queueOnBusy bool) error {
	if job == nil {
		return nil
	}

	g.mu.Lock()
	if g.running {
		if queueOnBusy {
			g.pending[kind] = job
		}
		g.mu.Unlock()
		if queueOnBusy {
			common.SysLog(fmt.Sprintf("channel test task queued: kind=%s", kind))
		}
		return ErrTaskRunning
	}
	g.running = true
	g.mu.Unlock()

	gopool.Go(func() {
		g.run(kind, job)
	})

	return nil
}

func (g *runGuard) run(kind TaskKind, job func()) {
	currentKind := kind
	currentJob := job

	for {
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysLog(fmt.Sprintf("channel test task panic recovered: kind=%s panic=%v", currentKind, r))
				}
			}()
			currentJob()
		}()

		nextKind, nextJob := g.takeNext(currentKind)
		if nextJob == nil {
			return
		}
		common.SysLog(fmt.Sprintf("channel test queued task started: kind=%s", nextKind))
		currentKind = nextKind
		currentJob = nextJob
	}
}

func (g *runGuard) takeNext(preferKind TaskKind) (TaskKind, func()) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if nextJob, ok := g.pending[preferKind]; ok {
		delete(g.pending, preferKind)
		return preferKind, nextJob
	}

	for _, kind := range executionOrder {
		nextJob, ok := g.pending[kind]
		if !ok {
			continue
		}
		delete(g.pending, kind)
		return kind, nextJob
	}

	g.running = false
	return "", nil
}

var defaultRunGuard = newRunGuard()

func Submit(kind TaskKind, job func()) error {
	return defaultRunGuard.submit(kind, job, false)
}

func SubmitWithPending(kind TaskKind, job func()) error {
	return defaultRunGuard.submit(kind, job, true)
}
