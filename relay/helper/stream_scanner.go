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
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
)

const (
	InitialScannerBufferSize    = 64 << 10  // 64KB (64*1024)
	DefaultMaxScannerBufferSize = 128 << 20 // 64MB (64*1024*1024) default SSE buffer size
	DefaultPingInterval         = 10 * time.Second
	// streamWriteTimeout bounds a single blocked write to a slow client so the
	// unconditional wg.Wait() in cleanup can always finish. Without it, a slow
	// but connected client (full TCP buffer, no server WriteTimeout) could hang
	// the handler forever.
	streamWriteTimeout = 30 * time.Second
)

func getScannerBufferSize() int {
	if constant.StreamScannerMaxBufferMB > 0 {
		return constant.StreamScannerMaxBufferMB << 20
	}
	return DefaultMaxScannerBufferSize
}

func NewStreamScanner(reader io.Reader) *bufio.Scanner {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, InitialScannerBufferSize), getScannerBufferSize())
	return scanner
}

func copyCodexSSEHeaders(c *gin.Context, resp *http.Response) {
	if c == nil || c.Writer == nil || resp == nil {
		return
	}
	// codex
	for _, name := range []string{"X-Reasoning-Included", "X-Codex-Turn-State"} {
		values := resp.Header.Values(name)
		if !service.ShouldCopyUpstreamHeader(c, name, values) {
			continue
		}
		for _, value := range values {
			if value != "" {
				c.Writer.Header().Add(name, value)
			}
		}
	}
}

// ExtendWriteDeadline pushes the connection write deadline forward before each
// stream write. Best-effort: writers that don't support deadlines (e.g.
// httptest recorders) are silently ignored.
func ExtendWriteDeadline(c *gin.Context) {
	if c == nil || c.Writer == nil {
		return
	}
	_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Now().Add(streamWriteTimeout))
}

func StreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(data string, sr *StreamResult)) {

	if resp == nil || dataHandler == nil {
		return
	}

	// 无条件新建 StreamStatus：错误只能由本次 dataHandler 通过 sr.Error 记录，
	// 因此残留的错误必然来自上一次尝试（可能是另一个渠道）。带过来会让
	// channel_stream_quality 归因到错误的渠道。
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.UpstreamStatusCode = resp.StatusCode

	ctx, cancel := context.WithCancel(context.Background())

	streamingTimeout := time.Duration(constant.StreamingTimeout) * time.Second
	if streamingTimeout <= 0 {
		// time.NewTicker panics on a non-positive duration.
		streamingTimeout = 30 * time.Second
	}

	var (
		stopChan         = make(chan bool, 3) // 增加缓冲区避免阻塞
		scanner          = NewStreamScanner(resp.Body)
		ticker           = time.NewTicker(streamingTimeout)
		pingTicker       *time.Ticker
		writeMutex       sync.Mutex     // Mutex to protect concurrent writes
		wg               sync.WaitGroup // 用于等待所有 goroutine 退出
		cleanupOnce      sync.Once
		stopOnce         sync.Once
		scannerOutcomeMu sync.Mutex
		scannerEndReason relaycommon.StreamEndReason
		scannerEndErr    error
		scannerEndSource string
	)

	stop := func() {
		stopOnce.Do(func() {
			close(stopChan)
		})
	}

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

	cleanup := func() {
		cleanupOnce.Do(func() {
			cancel()
			stop()
			if resp.Body != nil {
				_ = resp.Body.Close()
			}

			ticker.Stop()
			if pingTicker != nil {
				pingTicker.Stop()
			}

			wg.Wait()
		})
	}
	// Ensure gin.Context is not returned to Gin's pool while any stream goroutine can still use it.
	defer cleanup()

	scanner.Split(bufio.ScanLines)
	copyCodexSSEHeaders(c, resp)
	SetEventStreamHeaders(c)

	ctx = context.WithValue(ctx, "stop_chan", stopChan)

	// Handle ping data sending with improved error handling
	if pingEnabled && pingTicker != nil {
		wg.Add(1)
		gopool.Go(func() {
			defer func() {
				if r := recover(); r != nil {
					logger.LogError(c, fmt.Sprintf("ping goroutine panic: %v", r))
					info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("ping panic: %v", r), "ping_panic")
					stop()
				}
				logger.LogDebug(c, "ping goroutine exited")
				wg.Done()
			}()

			// 添加超时保护，防止 goroutine 无限运行
			maxPingDuration := 30 * time.Minute // 最大 ping 持续时间
			pingTimeout := time.NewTimer(maxPingDuration)
			defer pingTimeout.Stop()

			for {
				select {
				case <-pingTicker.C:
					var err error
					func() {
						writeMutex.Lock()
						defer writeMutex.Unlock()
						ExtendWriteDeadline(c)
						err = PingData(c)
					}()
					if err != nil {
						logger.LogError(c, "ping data error: "+err.Error())
						info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPingFail, err, "ping_write")
						return
					}
					logger.LogDebug(c, "ping data sent")
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
			if r := recover(); r != nil {
				logger.LogError(c, fmt.Sprintf("data handler goroutine panic: %v", r))
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("handler panic: %v", r), "handler_panic")
			}
			stop()
			wg.Done()
		}()
		sr := newStreamResult(info.StreamStatus)
		for data := range dataChan {
			sr.reset()
			func() {
				writeMutex.Lock()
				defer writeMutex.Unlock()
				ExtendWriteDeadline(c)
				dataHandler(data, sr)
			}()
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
			if r := recover(); r != nil {
				logger.LogError(c, fmt.Sprintf("scanner goroutine panic: %v", r))
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonPanic, fmt.Errorf("scanner panic: %v", r), "scanner_panic")
			}
			stop()
			logger.LogDebug(c, "scanner goroutine exited")
			wg.Done()
		}()

		for scanner.Scan() {
			// 检查是否需要停止
			select {
			case <-stopChan:
				return
			case <-ctx.Done():
				return
			default:
			}

			ticker.Reset(streamingTimeout)
			data := scanner.Text()
			logger.LogDebug(c, "stream scanner data: %s", data)

			// 裸 [DONE] 行（无 data: 前缀）必须先处理：它长度正好是 6，
			// 会通过下面的长度检查，再被 data[5:] 截成 "]" 当作数据下发。
			if strings.TrimSpace(data) == "[DONE]" {
				scannerOutcomeMu.Lock()
				scannerEndReason = relaycommon.StreamEndReasonDone
				scannerEndSource = "scanner_done"
				scannerOutcomeMu.Unlock()
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
				scannerOutcomeMu.Lock()
				scannerEndReason = relaycommon.StreamEndReasonDone
				scannerEndSource = "scanner_done"
				scannerOutcomeMu.Unlock()
				logger.LogDebug(c, "received [DONE], stopping scanner")
				return
			}
		}

		if err := scanner.Err(); err != nil {
			// cleanup() 会主动关闭 resp.Body 来解除 scanner 阻塞，由此产生的读错误
			// 不是上游故障。若停止是我们自己触发的，就不要记成 ScannerErr，
			// 否则会误判渠道健康度。
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
				scannerOutcomeMu.Lock()
				scannerEndReason = relaycommon.StreamEndReasonScannerErr
				scannerEndErr = err
				scannerEndSource = "scanner_error"
				scannerOutcomeMu.Unlock()
			}
			return
		}
		scannerOutcomeMu.Lock()
		scannerEndReason = relaycommon.StreamEndReasonEOF
		scannerEndSource = "scanner_eof"
		scannerOutcomeMu.Unlock()
	})

	// 主循环等待完成或超时
	select {
	case <-ticker.C:
		info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonTimeout, nil, "timeout")
	case <-stopChan:
		// EndReason already set by the goroutine that triggered stopChan
	case <-c.Request.Context().Done():
		// 客户端断开：立即 cleanup 关闭上游 resp.Body，解除 scanner 阻塞并让上游停止生成，
		// 避免为已放弃的请求继续消费上游 token。
		info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err(), "main_context_done")
	}

	cleanup()
	if info.StreamStatus.Snapshot().EndReason == relaycommon.StreamEndReasonNone {
		scannerOutcomeMu.Lock()
		endReason := scannerEndReason
		endErr := scannerEndErr
		endSource := scannerEndSource
		scannerOutcomeMu.Unlock()
		if endReason != relaycommon.StreamEndReasonNone {
			info.StreamStatus.SetEndReasonWithSource(endReason, endErr, endSource)
		}
	}

	streamSummary := fmt.Sprintf("stream ended: %s", info.StreamStatus.Summary())
	switch {
	case info.StreamStatus.Snapshot().EndReason == relaycommon.StreamEndReasonClientGone:
		// The request context died. That covers BOTH a real client cancel and an
		// edge/proxy/network drop — from inside the server the two are
		// indistinguishable, so "client_gone" must not be read as "the caller
		// canceled". Leave the breadcrumbs needed to tell them apart next time:
		// idle_before_cut_ms is how long the upstream had been silent when the
		// connection died. Near zero means a healthy, actively-streaming response
		// was severed underneath us (suspect the edge/network); a large value
		// means the upstream had already stalled and the caller plausibly gave up.
		logger.LogInfo(c, fmt.Sprintf("%s %s", streamSummary, clientDisconnectDiagnostics(c, info)))
	case info.StreamStatus.IsNormalEnd() && !info.StreamStatus.HasErrors():
		logger.LogInfo(c, streamSummary)
	default:
		logger.LogError(c, fmt.Sprintf("%s, received=%d", streamSummary, info.ReceivedResponseCount))
	}
}

// clientDisconnectDiagnostics renders the breadcrumbs that let a later
// investigation attribute a client_gone stream end. The server only ever sees
// "request context canceled", which a caller pressing cancel and an
// edge/proxy/network drop produce identically, so record the surrounding facts
// instead of guessing:
//
//   - idle_before_cut_ms: upstream silence at the moment the connection died.
//     ~0 means data was still arriving and a healthy stream was severed (look at
//     the edge/network); large means the upstream had stalled and the caller
//     plausibly gave up on its own.
//   - client_bytes / chunks: how much actually reached the caller, which
//     separates "died instantly" from "died most of the way through".
//   - proto / ua: HTTP/1.1 vs HTTP/2 and which client, since edge and client
//     cancellation semantics differ between them.
func clientDisconnectDiagnostics(c *gin.Context, info *relaycommon.RelayInfo) string {
	if c == nil || info == nil || info.StreamStatus == nil {
		return "client_disconnect_diag: unavailable"
	}
	snapshot := info.StreamStatus.Snapshot()

	idleBeforeCutMs := int64(-1)
	if !snapshot.LastDataAt.IsZero() && !snapshot.EndedAt.IsZero() {
		idleBeforeCutMs = snapshot.EndedAt.Sub(snapshot.LastDataAt).Milliseconds()
	}

	proto, ua, writtenBytes := "-", "-", -1
	if c.Request != nil {
		proto = c.Request.Proto
		if v := c.Request.UserAgent(); v != "" {
			ua = v
			if len(ua) > 64 {
				ua = ua[:64]
			}
		}
	}
	if c.Writer != nil {
		writtenBytes = c.Writer.Size()
	}

	return fmt.Sprintf("client_disconnect_diag: idle_before_cut_ms=%d client_bytes=%d chunks=%d proto=%s ua=%q",
		idleBeforeCutMs, writtenBytes, info.ReceivedResponseCount, proto, ua)
}
