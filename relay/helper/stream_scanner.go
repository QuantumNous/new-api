package helper

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
)

const (
	InitialScannerBufferSize    = 64 << 10 // 64KB (64*1024)
	DefaultMaxScannerBufferSize = 64 << 20 // 64MB (64*1024*1024) default SSE buffer size
	DefaultPingInterval         = 10 * time.Second
)

func getScannerBufferSize() int {
	if constant.StreamScannerMaxBufferMB > 0 {
		return constant.StreamScannerMaxBufferMB << 20
	}
	return DefaultMaxScannerBufferSize
}

func StreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(data string, sr *StreamResult)) {

	if resp == nil || dataHandler == nil {
		return
	}

	if info.StreamStatus != nil {
		previousErrors := info.StreamStatus.Errors
		previousErrorCount := info.StreamStatus.ErrorCount
		info.StreamStatus = relaycommon.NewStreamStatus()
		info.StreamStatus.Errors = previousErrors
		info.StreamStatus.ErrorCount = previousErrorCount
	} else {
		info.StreamStatus = relaycommon.NewStreamStatus()
	}
	info.StreamStatus.UpstreamStatusCode = resp.StatusCode

	// 确保响应体总是被关闭
	defer func() {
		if resp.Body != nil {
			resp.Body.Close()
		}
	}()

	streamingTimeout := time.Duration(constant.StreamingTimeout) * time.Second
	if streamingTimeout <= 0 {
		streamingTimeout = 30 * time.Second
	}

	var (
		stopChan   = make(chan bool, 1)
		scanner    = bufio.NewScanner(resp.Body)
		ticker     = time.NewTicker(streamingTimeout)
		pingTicker *time.Ticker
		writeMutex sync.Mutex     // Mutex to protect concurrent writes
		wg         sync.WaitGroup // 用于等待所有 goroutine 退出
	)

	generalSettings := operation_setting.GetGeneralSetting()
	pingEnabled := generalSettings.PingIntervalEnabled && !info.DisablePing
	pingInterval := time.Duration(generalSettings.PingIntervalSeconds) * time.Second
	if pingInterval <= 0 {
		pingInterval = DefaultPingInterval
	}

	if pingEnabled {
		pingTicker = time.NewTicker(pingInterval)
	}

	logger.LogDebug(c, "relay timeout seconds: %d", common.RelayTimeout)
	logger.LogDebug(c, "relay max idle conns: %d", common.RelayMaxIdleConns)
	logger.LogDebug(c, "relay max idle conns per host: %d", common.RelayMaxIdleConnsPerHost)
	logger.LogDebug(c, "streaming timeout seconds: %d", int64(streamingTimeout.Seconds()))
	logger.LogDebug(c, "ping interval seconds: %d", int64(pingInterval.Seconds()))

	scanner.Buffer(make([]byte, InitialScannerBufferSize), getScannerBufferSize())
	scanner.Split(bufio.ScanLines)
	SetEventStreamHeaders(c)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	ctx = context.WithValue(ctx, "stop_chan", stopChan)
	signalStop := func() {
		select {
		case stopChan <- true:
		default:
		}
	}

	stopWorkers := func() {
		cancel()
		if resp.Body != nil {
			_ = resp.Body.Close()
		}
		ticker.Stop()
		if pingTicker != nil {
			pingTicker.Stop()
		}
	}

	waitForWorkers := func() {
		done := make(chan struct{})
		gopool.Go(func() {
			wg.Wait()
			close(done)
		})
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			logger.LogError(c, "timeout waiting for goroutines to exit")
		}
	}

	// Handle ping data sending with improved error handling
	if pingEnabled && pingTicker != nil {
		wg.Add(1)
		gopool.Go(func() {
			defer func() {
				wg.Done()
				if r := recover(); r != nil {
					logger.LogError(c, fmt.Sprintf("ping goroutine panic: %v", r))
					info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("ping panic: %v", r), "ping_panic")
					signalStop()
				}
				logger.LogDebug(c, "ping goroutine exited")
			}()

			// 添加超时保护，防止 goroutine 无限运行
			maxPingDuration := 30 * time.Minute // 最大 ping 持续时间
			pingTimeout := time.NewTimer(maxPingDuration)
			defer pingTimeout.Stop()

			for {
				select {
				case <-pingTicker.C:
					// 使用超时机制防止写操作阻塞
					done := make(chan error, 1)
					gopool.Go(func() {
						writeMutex.Lock()
						defer writeMutex.Unlock()
						done <- PingData(c)
					})

					select {
					case err := <-done:
						if err != nil {
							logger.LogError(c, "ping data error: "+err.Error())
							info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPingFail, err, "ping_write")
							return
						}
						logger.LogDebug(c, "ping data sent")
					case <-time.After(10 * time.Second):
						logger.LogError(c, "ping data send timeout")
						info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPingFail, fmt.Errorf("ping send timeout"), "ping_timeout")
						return
					case <-ctx.Done():
						return
					case <-stopChan:
						return
					}
				case <-ctx.Done():
					return
				case <-stopChan:
					return
				case <-c.Request.Context().Done():
					// 监听客户端断开连接
					return
				case <-pingTimeout.C:
					logger.LogError(c, "ping goroutine max duration reached")
					return
				}
			}
		})
	}

	dataChan := make(chan string, 10)

	wg.Add(1)
	gopool.Go(func() {
		defer func() {
			wg.Done()
			if r := recover(); r != nil {
				logger.LogError(c, fmt.Sprintf("data handler goroutine panic: %v", r))
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("handler panic: %v", r), "handler_panic")
			}
			signalStop()
		}()
		sr := newStreamResult(info.StreamStatus)
		for data := range dataChan {
			sr.reset()
			writeMutex.Lock()
			dataHandler(data, sr)
			writeMutex.Unlock()
			if sr.IsStopped() {
				return
			}
		}
	})

	// Scanner goroutine with improved error handling
	wg.Add(1)
	common.RelayCtxGo(ctx, func() {
		defer func() {
			close(dataChan)
			wg.Done()
			if r := recover(); r != nil {
				logger.LogError(c, fmt.Sprintf("scanner goroutine panic: %v", r))
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("scanner panic: %v", r), "scanner_panic")
			}
			signalStop()
			logger.LogDebug(c, "scanner goroutine exited")
		}()

		for scanner.Scan() {
			// 检查是否需要停止
			select {
			case <-stopChan:
				return
			case <-ctx.Done():
				return
			case <-c.Request.Context().Done():
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err(), "scanner_context_done")
				return
			default:
			}

			ticker.Reset(streamingTimeout)
			data := scanner.Text()
			logger.LogDebug(c, "stream scanner data: %s", data)

			if strings.TrimSpace(data) == "[DONE]" {
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonDone, nil, "scanner_done")
				logger.LogDebug(c, "received [DONE], stopping scanner")
				return
			}
			if len(data) < 6 || data[:5] != "data:" {
				continue
			}
			data = strings.TrimSpace(data[5:])
			if data == "" {
				continue
			}
			if !strings.HasPrefix(data, "[DONE]") {
				info.SetFirstResponseTime()
				info.StreamStatus.RecordDataReceived()
				info.ReceivedResponseCount++

				select {
				case dataChan <- data:
				case <-ctx.Done():
					return
				case <-stopChan:
					return
				}
			} else {
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonDone, nil, "scanner_done")
				logger.LogDebug(c, "received [DONE], stopping scanner")
				return
			}
		}

		if err := scanner.Err(); err != nil {
			select {
			case <-ctx.Done():
				return
			case <-stopChan:
				return
			case <-c.Request.Context().Done():
				return
			default:
			}
			if err != io.EOF {
				logger.LogError(c, "scanner error: "+err.Error())
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonScannerErr, err, "scanner_error")
			}
		}
		info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonEOF, nil, "scanner_eof")
	})

	// 主循环等待完成或超时
	select {
	case <-ticker.C:
		info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonTimeout, nil, "timeout")
	case <-stopChan:
		// EndReason already set by the goroutine that triggered stopChan
	case <-c.Request.Context().Done():
		info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err(), "main_context_done")
	}

	stopWorkers()
	waitForWorkers()

	streamSummary := fmt.Sprintf("stream ended: %s", info.StreamStatus.Summary())
	if info.StreamStatus.Snapshot().EndReason == relaycommon.StreamEndReasonClientGone {
		logger.LogInfo(c, streamSummary)
	} else if info.StreamStatus.IsNormalEnd() && !info.StreamStatus.HasErrors() {
		logger.LogInfo(c, streamSummary)
	} else {
		logger.LogError(c, fmt.Sprintf("%s, received=%d", streamSummary, info.ReceivedResponseCount))
	}
}
