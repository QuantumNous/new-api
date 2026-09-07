package attemptlog

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var (
	writerOnce sync.Once
	recordChan chan *model.RelayAttempt
	dropped    atomic.Int64
)

// enqueue hands a record to the async writer. It never blocks the relay path:
// if the buffer is full the record is dropped and counted, because a telemetry
// backlog must not become relay backpressure.
func enqueue(attempt *model.RelayAttempt) {
	writerOnce.Do(startWriter)
	if recordChan == nil {
		return
	}
	select {
	case recordChan <- attempt:
	default:
		if n := dropped.Add(1); n == 1 || n%1000 == 0 {
			common.SysError(fmt.Sprintf("attemptlog: buffer full, dropped %d records so far", n))
		}
	}
}

func startWriter() {
	c := loadConfig()
	if !c.enabled {
		return
	}
	recordChan = make(chan *model.RelayAttempt, c.bufferSize)
	go runWriter(c)
}

func runWriter(c config) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("attemptlog: writer panicked, restarting: %v", r))
			go runWriter(c)
		}
	}()

	ticker := time.NewTicker(time.Duration(c.flushMillis) * time.Millisecond)
	defer ticker.Stop()

	batch := make([]*model.RelayAttempt, 0, c.batchSize)
	for {
		select {
		case attempt, ok := <-recordChan:
			if !ok {
				flush(batch)
				return
			}
			batch = append(batch, attempt)
			if len(batch) >= c.batchSize {
				flush(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				flush(batch)
				batch = batch[:0]
			}
		}
	}
}

func flush(batch []*model.RelayAttempt) {
	if len(batch) == 0 {
		return
	}
	if err := model.BatchInsertRelayAttempts(batch); err != nil {
		common.SysError(fmt.Sprintf("attemptlog: failed to insert %d records: %v", len(batch), err))
	}
}
