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

	origWriter := gin.DefaultWriter
	origErrWriter := gin.DefaultErrorWriter
	gin.DefaultWriter = io.Discard
	gin.DefaultErrorWriter = io.Discard

	// Use an isolated temporary directory for log rotation in tests
	tmpDir := t.TempDir()
	origLogDir := *common.LogDir
	*common.LogDir = tmpDir

	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = origWriter
		gin.DefaultErrorWriter = origErrWriter
		common.LogWriterMu.Unlock()

		currentLogPathMu.Lock()
		if currentLogFile != nil {
			_ = currentLogFile.Close()
			currentLogFile = nil
		}
		currentLogPathMu.Unlock()

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

	// Wait for asynchronous SetupLogger to complete and reset flag
	deadline := time.Now().Add(time.Second)
	for setupLogWorking.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}

	if setupLogWorking.Load() {
		t.Fatal("timed out waiting for SetupLogger to complete")
	}
}
