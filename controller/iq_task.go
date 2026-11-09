package controller

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

type iqTaskHandler struct{}

func (iqTaskHandler) Type() string { return model.SystemTaskTypeIQTest }
func (iqTaskHandler) Schedule(now time.Time) error {
	_, _, err := model.EnqueueIQBatch(true, now)
	if errors.Is(err, model.ErrIQConflict) {
		return nil
	}
	return err
}
func (iqTaskHandler) Run(ctx context.Context, task *model.SystemTask, runner string) {
	cfg, err := model.GetIQBatch(task.TaskID)
	if err == nil {
		err = model.NormalizeIQConfig(cfg)
	}
	if err != nil {
		finishSystemTaskHandler(task, runner, model.SystemTaskStatusFailed, nil, errors.New("invalid IQ snapshot"))
		return
	}
	userID, err := resolveChannelTestUserID(nil)
	if err != nil {
		_ = model.InterruptIQBatch(task.TaskID)
		finishSystemTaskHandler(task, runner, model.SystemTaskStatusFailed, nil, errors.New("system test identity unavailable"))
		return
	}
	err = runIQBatch(ctx, task, runner, *cfg, userID, executeIQPair)
	if err != nil {
		_ = model.InterruptIQBatch(task.TaskID)
		finishSystemTaskHandler(task, runner, model.SystemTaskStatusFailed, nil, errors.New("IQ execution interrupted"))
		return
	}
	attempts, err := model.GetIQAttempts(task.TaskID)
	if err != nil {
		finishSystemTaskHandler(task, runner, model.SystemTaskStatusFailed, nil, errors.New("unable to load IQ completion"))
		return
	}
	counts := map[string]int{}
	for _, a := range attempts {
		counts[a.Status]++
	}
	finishSystemTaskHandler(task, runner, model.SystemTaskStatusSucceeded, counts, nil)
}
func runIQBatch(ctx context.Context, task *model.SystemTask, runner string, cfg model.IQConfig, userID int, execute iqPairExecutor) error {
	attempts, err := model.GetIQAttempts(task.TaskID)
	if err != nil {
		return err
	}
	jobs := make(chan model.IQAttempt)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error
	processed := 0
	fail := func(err error) {
		mu.Lock()
		defer mu.Unlock()
		if firstErr == nil {
			firstErr = err
		}
	}
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for a := range jobs {
				if ctx.Err() != nil {
					fail(ctx.Err())
					continue
				}
				started := time.Now()
				claimed, err := model.StartIQAttempt(task.TaskID, a.PairID, runner, started.Unix())
				if err != nil {
					fail(err)
					continue
				}
				if !claimed {
					continue
				}
				if ctx.Err() != nil {
					fail(ctx.Err())
					continue
				}
				pairCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
				r := execute(pairCtx, userID, a.Group, a.Model, string(cfg.Prompt))
				cancel()
				r.ID = a.PairID
				r.Group = a.Group
				r.Model = a.Model
				r.TaskID = task.TaskID
				r.ConfigVersion = cfg.Version
				r.StartedAt = started.Unix()
				r.CompletedAt = time.Now().Unix()
				r.DurationMS = time.Since(started).Milliseconds()
				if err := model.CompleteIQAttempt(r, runner); err != nil {
					fail(err)
					continue
				}
				mu.Lock()
				processed++
				err = model.UpdateSystemTaskState(task.TaskID, runner, map[string]int{"total": len(attempts), "processed": processed})
				mu.Unlock()
				if err != nil {
					fail(err)
				}
			}
		}()
	}
	for _, a := range attempts {
		mu.Lock()
		failed := firstErr != nil
		mu.Unlock()
		if failed || ctx.Err() != nil {
			break
		}
		select {
		case jobs <- a:
		case <-ctx.Done():
		}
	}
	close(jobs)
	wg.Wait()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return firstErr
}

var _ service.CalendarSystemTaskHandler = iqTaskHandler{}
