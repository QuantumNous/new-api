package logger

import (
	"context"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestLogHelper_ConcurrentRace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	gin.DefaultWriter = io.Discard
	gin.DefaultErrorWriter = io.Discard

	// Use an isolated temporary directory for log rotation in tests
	tmpDir := t.TempDir()
	origLogDir := *common.LogDir
	*common.LogDir = tmpDir
	t.Cleanup(func() {
		*common.LogDir = origLogDir
	})

	// Pre-set logCount close to maxLogCount so concurrent goroutines
	// hit the rotation threshold and stress-test CompareAndSwap concurrently.
	logCount.Store(maxLogCount - 100)

	var wg sync.WaitGroup
	ctx := context.Background()

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				LogInfo(ctx, "test concurrent message")
			}
		}()
	}

	wg.Wait()

	// Wait briefly for asynchronous SetupLogger to complete and reset flag
	time.Sleep(50 * time.Millisecond)

	if setupLogWorking.Load() {
		t.Error("setupLogWorking should be false after rotation completes")
	}
}
