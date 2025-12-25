package model

import (
	"context"
	"sync"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	modelHealthEventQueueSize = 8192
	modelHealthWorkerCount    = 4
)

var (
	modelHealthOnce  sync.Once
	modelHealthQueue chan *ModelHealthEvent
)

func initModelHealthWriter() {
	modelHealthQueue = make(chan *ModelHealthEvent, modelHealthEventQueueSize)
	for i := 0; i < modelHealthWorkerCount; i++ {
		gopool.Go(func() {
			for event := range modelHealthQueue {
				func() {
					defer func() {
						_ = recover()
					}()
					_ = UpsertModelHealthSlice5m(context.Background(), DB, event)
				}()
			}
		})
	}
}

func RecordModelHealthEventAsync(_ any, event *ModelHealthEvent) {
	if event == nil {
		return
	}
	modelHealthOnce.Do(initModelHealthWriter)

	select {
	case modelHealthQueue <- event:
	default:
		gopool.Go(func() {
			defer func() {
				_ = recover()
			}()
			_ = UpsertModelHealthSlice5m(context.Background(), DB, event)
		})
	}
}