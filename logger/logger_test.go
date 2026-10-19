package logger

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type routingWriter struct {
	mu      sync.Mutex
	output  bytes.Buffer
	entered chan<- struct{}
	release <-chan struct{}
}

func (w *routingWriter) Write(p []byte) (int, error) {
	w.entered <- struct{}{}
	<-w.release
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.output.Write(p)
}

func TestConcurrentLoggerRoutingAndRotation(t *testing.T) {
	for _, scenario := range []string{"empty-directory", "at-threshold", "rotation"} {
		t.Run(scenario, func(t *testing.T) {
			require.Eventually(t, func() bool { return gopool.WorkerCount() == 0 },
				3*time.Second, time.Millisecond)
			directory := ""
			if scenario != "empty-directory" {
				directory = t.TempDir()
			}
			const callers = 4
			entered := make(chan struct{}, callers)
			release := make(chan struct{})
			var releaseOnce sync.Once
			releaseCallers := func() { releaseOnce.Do(func() { close(release) }) }
			var workers sync.WaitGroup
			publicationHeld := false
			oldDir := common.LogDir
			logStateMu.Lock()
			oldCount, oldWorking := logCount, setupLogWorking
			logStateMu.Unlock()
			oldPath, oldFile := currentLogPath, currentLogFile
			oldWriter, oldErrorWriter := gin.DefaultWriter, gin.DefaultErrorWriter
			t.Cleanup(func() {
				releaseCallers()
				if publicationHeld {
					currentLogPathMu.Unlock()
				}
				callersDone := make(chan struct{})
				go func() {
					workers.Wait()
					close(callersDone)
				}()
				select {
				case <-callersDone:
				case <-time.After(3 * time.Second):
					fmt.Fprintln(os.Stderr, "logger callers did not finish; refusing global restoration")
					os.Exit(1)
				}
				if !assert.Eventually(t, func() bool { return gopool.WorkerCount() == 0 },
					3*time.Second, time.Millisecond, "join rotations before restoring logger globals") {
					os.Exit(1)
				}
				common.LogWriterMu.Lock()
				gin.DefaultWriter, gin.DefaultErrorWriter = oldWriter, oldErrorWriter
				var closeErr error
				if currentLogFile != nil && currentLogFile != oldFile {
					closeErr = currentLogFile.Close()
				}
				common.LogWriterMu.Unlock()
				currentLogPathMu.Lock()
				currentLogPath, currentLogFile = oldPath, oldFile
				currentLogPathMu.Unlock()
				common.LogDir = oldDir
				logStateMu.Lock()
				logCount, setupLogWorking = oldCount, oldWorking
				logStateMu.Unlock()
				require.NoError(t, closeErr)
			})
			common.LogDir = &directory
			currentLogPath, currentLogFile = "", nil
			logStateMu.Lock()
			logCount, setupLogWorking = maxLogCount, false
			if scenario == "at-threshold" {
				logCount -= callers
			}
			logStateMu.Unlock()
			info := &routingWriter{entered: entered, release: release}
			errors := &routingWriter{entered: entered, release: release}
			common.LogWriterMu.Lock()
			gin.DefaultWriter, gin.DefaultErrorWriter = info, errors
			common.LogWriterMu.Unlock()

			// Hold publication so the elected rotation remains active during a losing setup call.
			if scenario == "rotation" {
				currentLogPathMu.Lock()
				publicationHeld = true
			}
			for i := range callers {
				workers.Go(func() {
					ctx := context.WithValue(context.Background(), common.RequestIdKey, fmt.Sprintf("request-%d", i))
					message := fmt.Sprintf("message-%d", i)
					if i%2 == 0 {
						LogInfo(ctx, message)
					} else {
						LogError(ctx, message)
					}
				})
			}
			for range callers {
				select {
				case <-entered:
				case <-time.After(3 * time.Second):
					t.Fatal("concurrent logger caller did not reach the output barrier")
				}
			}
			releaseCallers()
			workers.Wait()
			if scenario == "rotation" {
				locked := assert.Eventually(t, func() bool {
					if setupLogLock.TryLock() {
						setupLogLock.Unlock()
						return false
					}
					return true
				}, 3*time.Second, time.Millisecond, "rotation must acquire setup ownership")
				if locked {
					SetupLogger()
					logStateMu.Lock()
					assert.True(t, setupLogWorking, "a losing setup must not complete the active rotation")
					logStateMu.Unlock()
				}
				currentLogPathMu.Unlock()
				publicationHeld = false
			}
			require.Eventually(t, func() bool { return gopool.WorkerCount() == 0 },
				3*time.Second, time.Millisecond, "join accepted rotation work")
			logStateMu.Lock()
			assert.False(t, setupLogWorking)
			logStateMu.Unlock()
			for i := range callers {
				expected := fmt.Sprintf("| request-%d | message-%d \n", i, i)
				if i%2 == 0 {
					assert.Contains(t, info.output.String(), expected)
					assert.NotContains(t, errors.output.String(), expected)
				} else {
					assert.Contains(t, errors.output.String(), expected)
					assert.NotContains(t, info.output.String(), expected)
				}
			}
			assert.Equal(t, 2, strings.Count(info.output.String(), "[INFO]"))
			assert.Equal(t, 2, strings.Count(errors.output.String(), "[ERR]"))
			switch scenario {
			case "at-threshold":
				assert.Empty(t, GetCurrentLogPath(), "rotation starts only above the threshold")
				entries, err := os.ReadDir(directory)
				require.NoError(t, err)
				assert.Empty(t, entries)
			case "empty-directory":
				assert.Empty(t, GetCurrentLogPath())
			case "rotation":
				entries, err := os.ReadDir(directory)
				require.NoError(t, err)
				require.Len(t, entries, 1, "one elected file rotation")
				assert.Equal(t, filepath.Join(directory, entries[0].Name()), GetCurrentLogPath())
				LogInfo(context.WithValue(context.Background(), common.RequestIdKey, "after-info"), "rotation-complete-info")
				LogError(context.WithValue(context.Background(), common.RequestIdKey, "after-error"), "rotation-complete-error")
				data, err := os.ReadFile(GetCurrentLogPath())
				require.NoError(t, err)
				assert.Equal(t, 1, strings.Count(string(data), "| after-info | rotation-complete-info \n"))
				assert.Equal(t, 1, strings.Count(string(data), "| after-error | rotation-complete-error \n"))
				assert.Contains(t, string(data), "[INFO]")
				assert.Contains(t, string(data), "[ERR]")
			}
		})
	}
}
