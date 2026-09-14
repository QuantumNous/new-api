package helper

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

const defaultTextStreamDrainTimeout = 300 * time.Second

type textStreamScanEvent struct {
	raw      string
	data     string
	business bool
	done     bool
}

type textStreamScanEnd struct {
	err error
}

type textStreamLineParser func(string) textStreamScanEvent

type textStreamOptions struct {
	writeEventStreamHeaders bool
	doneIsTerminalSuccess   bool
}

type textStreamSession struct {
	c           *gin.Context
	resp        *http.Response
	info        *relaycommon.RelayInfo
	dataHandler func(string, *StreamResult)
	parseLine   textStreamLineParser
	options     textStreamOptions
	status      *relaycommon.StreamStatus
	timeout     time.Duration

	stopOnce sync.Once
	stopChan chan struct{}
	wg       sync.WaitGroup
	writeMu  sync.Mutex
}

// TextStreamScannerHandler processes SSE text-generation streams. Once the
// client leaves, it stops all downstream writes but keeps the established
// upstream body alive until a protocol terminal, an upstream error, EOF, or a
// bounded drain timeout is observed.
func TextStreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(string, *StreamResult)) {
	runTextStreamScanner(c, resp, info, dataHandler, parseTextSSELine, textStreamOptions{
		writeEventStreamHeaders: true,
		doneIsTerminalSuccess:   true,
	})
}

func ResponsesTextStreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(string, *StreamResult)) {
	runTextStreamScanner(c, resp, info, dataHandler, parseTextSSELine, textStreamOptions{
		writeEventStreamHeaders: true,
	})
}

func ResponsesBufferedTextStreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(string, *StreamResult)) {
	runTextStreamScanner(c, resp, info, dataHandler, parseTextSSELine, textStreamOptions{})
}

// TextLineStreamScannerHandler applies the same lifecycle to newline-delimited
// text protocols such as Ollama and Cohere.
func TextLineStreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(string, *StreamResult)) {
	runTextStreamScanner(c, resp, info, dataHandler, parseTextBusinessLine, textStreamOptions{
		writeEventStreamHeaders: true,
		doneIsTerminalSuccess:   true,
	})
}

func runTextStreamScanner(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(string, *StreamResult), parseLine textStreamLineParser, options textStreamOptions) {
	if c == nil || c.Request == nil || resp == nil || resp.Body == nil || info == nil || dataHandler == nil {
		return
	}

	info.StreamStatus = relaycommon.NewStreamStatus()
	session := &textStreamSession{
		c:           c,
		resp:        resp,
		info:        info,
		dataHandler: dataHandler,
		parseLine:   parseLine,
		options:     options,
		status:      info.StreamStatus,
		timeout:     TextStreamDrainTimeout(c),
		stopChan:    make(chan struct{}),
	}
	session.run()
}

func TextStreamDrainTimeout(c *gin.Context) time.Duration {
	if constant.StreamingTimeout > 0 {
		return time.Duration(constant.StreamingTimeout) * time.Second
	}
	logger.LogWarn(c, fmt.Sprintf("invalid STREAMING_TIMEOUT=%d; using safe text-stream drain timeout of 300 seconds", constant.StreamingTimeout))
	return defaultTextStreamDrainTimeout
}

func parseTextSSELine(line string) textStreamScanEvent {
	event := textStreamScanEvent{raw: line}
	if strings.HasPrefix(line, "[DONE]") {
		event.done = true
		return event
	}
	if !strings.HasPrefix(line, "data:") {
		return event
	}
	data := strings.TrimSpace(line[5:])
	if data == "" {
		return event
	}
	if strings.HasPrefix(data, "[DONE]") {
		event.done = true
		return event
	}
	event.data = data
	event.business = true
	return event
}

func parseTextBusinessLine(line string) textStreamScanEvent {
	data := strings.TrimSpace(line)
	return textStreamScanEvent{
		raw:      line,
		data:     data,
		business: data != "",
	}
}

func (s *textStreamSession) run() {
	if s.options.writeEventStreamHeaders {
		copyCodexSSEHeaders(s.c, s.resp)
		SetEventStreamHeaders(s.c)
	}

	scanEvents := make(chan textStreamScanEvent)
	scanEnd := make(chan textStreamScanEnd, 1)
	pingErr := make(chan error, 1)
	s.startScanner(scanEvents, scanEnd)
	s.startPing(pingErr)

	normalTimer := time.NewTimer(s.timeout)
	defer normalTimer.Stop()
	var idleTimer *time.Timer
	var absoluteTimer *time.Timer
	var idleC <-chan time.Time
	var absoluteC <-chan time.Time
	draining := false
	businessAfterDrain := false
	clientDone := s.c.Request.Context().Done()

	defer func() {
		s.stopOnce.Do(func() { close(s.stopChan) })
		_ = s.resp.Body.Close()
		if idleTimer != nil {
			idleTimer.Stop()
		}
		if absoluteTimer != nil {
			absoluteTimer.Stop()
		}
		s.wg.Wait()
		s.logResult()
	}()

	beginDrain := func() {
		if draining {
			return
		}
		draining = true
		clientDone = nil
		s.status.SetEndReason(relaycommon.StreamEndReasonClientGone, s.c.Request.Context().Err())
		stopTimer(normalTimer)
		idleTimer = time.NewTimer(s.timeout)
		absoluteTimer = time.NewTimer(s.timeout)
		idleC = idleTimer.C
		absoluteC = absoluteTimer.C
	}

	for {
		if !draining && s.c.Request.Context().Err() != nil {
			beginDrain()
		}

		select {
		case <-clientDone:
			beginDrain()
		case event := <-scanEvents:
			if !draining && s.c.Request.Context().Err() != nil {
				beginDrain()
			}
			if !draining {
				resetTimer(normalTimer, s.timeout)
			}
			logger.LogDebug(s.c, "text stream scanner data: %s", event.raw)
			if event.done {
				if s.options.doneIsTerminalSuccess {
					s.status.SetEndReason(relaycommon.StreamEndReasonDone, nil)
					s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultTerminalSuccess, nil)
				}
				return
			}
			if !event.business {
				continue
			}
			s.info.SetFirstResponseTime()
			s.info.ReceivedResponseCount++
			streamResult := newStreamResult(s.status)
			errorCountBefore := s.status.TotalErrorCount()
			if s.handleData(event.data, streamResult) || streamResult.IsStopped() {
				return
			}
			if draining && s.status.TotalErrorCount() > errorCountBefore {
				s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultHandlerError, fmt.Errorf("text stream handler reported an error after client disconnect"))
				return
			}
			if draining && !streamResult.IsIgnored() {
				businessAfterDrain = true
				resetTimer(idleTimer, s.timeout)
			}
		case result := <-scanEnd:
			if !draining && s.c.Request.Context().Err() != nil {
				beginDrain()
			}
			if result.err != nil && result.err != io.EOF {
				s.status.SetEndReason(relaycommon.StreamEndReasonScannerErr, result.err)
				s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultScannerError, result.err)
				return
			}
			s.status.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
			s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultIncompleteEOF, nil)
			return
		case err := <-pingErr:
			if s.c.Request.Context().Err() != nil {
				beginDrain()
				continue
			}
			s.status.SetEndReason(relaycommon.StreamEndReasonPingFail, err)
			s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultHandlerError, err)
			return
		case <-normalTimer.C:
			if s.c.Request.Context().Err() != nil {
				beginDrain()
				continue
			}
			s.status.SetEndReason(relaycommon.StreamEndReasonTimeout, nil)
			return
		case <-idleC:
			s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultIdleTimeout, fmt.Errorf("upstream text stream idle after client disconnect"))
			return
		case <-absoluteC:
			if !businessAfterDrain {
				s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultIdleTimeout, fmt.Errorf("upstream text stream idle after client disconnect"))
				return
			}
			s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultDrainTimeout, fmt.Errorf("upstream text stream drain deadline exceeded"))
			return
		}
	}
}

func (s *textStreamSession) startScanner(events chan<- textStreamScanEvent, end chan<- textStreamScanEnd) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		scanner := NewStreamScanner(s.resp.Body)
		scanner.Split(bufio.ScanLines)
		for scanner.Scan() {
			event := s.parseLine(scanner.Text())
			select {
			case events <- event:
			case <-s.stopChan:
				return
			}
		}
		result := textStreamScanEnd{err: scanner.Err()}
		select {
		case end <- result:
		case <-s.stopChan:
		}
	}()
}

func (s *textStreamSession) startPing(pingErr chan<- error) {
	settings := operation_setting.GetGeneralSetting()
	if !settings.PingIntervalEnabled || s.info.DisablePing {
		return
	}
	interval := time.Duration(settings.PingIntervalSeconds) * time.Second
	if interval <= 0 {
		interval = DefaultPingInterval
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.writeMu.Lock()
				ExtendWriteDeadline(s.c)
				err := PingData(s.c)
				s.writeMu.Unlock()
				if err != nil {
					select {
					case pingErr <- err:
					case <-s.stopChan:
					}
					return
				}
			case <-s.c.Request.Context().Done():
				return
			case <-s.stopChan:
				return
			}
		}
	}()
}

func (s *textStreamSession) handleData(data string, result *StreamResult) (panicked bool) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err := fmt.Errorf("text stream handler panic: %v", recovered)
			s.status.RecordError(err.Error())
			s.status.SetEndReason(relaycommon.StreamEndReasonPanic, err)
			s.status.SetUpstreamResult(relaycommon.StreamUpstreamResultHandlerError, err)
			panicked = true
		}
	}()
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if s.c.Request.Context().Err() == nil {
		ExtendWriteDeadline(s.c)
	}
	s.dataHandler(data, result)
	return false
}

func (s *textStreamSession) logResult() {
	if s.status.IsNormalEnd() && !s.status.HasErrors() {
		logger.LogInfo(s.c, fmt.Sprintf("text stream ended: %s", s.status.Summary()))
		return
	}
	logger.LogError(s.c, fmt.Sprintf("text stream ended: %s, received=%d", s.status.Summary(), s.info.ReceivedResponseCount))
}

func stopTimer(timer *time.Timer) {
	if timer == nil {
		return
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
}

func resetTimer(timer *time.Timer, duration time.Duration) {
	if timer == nil {
		return
	}
	stopTimer(timer)
	timer.Reset(duration)
}

// ValidateTextStreamCompletion is the single settlement gate for a text
// stream that outlived its client. Only an explicit success terminal with
// authoritative upstream usage may continue into the existing settlement.
func ValidateTextStreamCompletion(info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || info.StreamStatus == nil || info.StreamStatus.EndReason != relaycommon.StreamEndReasonClientGone {
		return nil
	}
	result := info.StreamStatus.FinalizeUpstreamUsage()
	if result == relaycommon.StreamUpstreamResultTerminalSuccess && info.StreamStatus.IsUsageComplete() {
		return nil
	}
	_, upstreamErr := info.StreamStatus.GetUpstreamResult()
	if upstreamErr == nil {
		upstreamErr = fmt.Errorf("upstream text stream ended after client disconnect with result %s", result)
	}
	return types.NewError(upstreamErr, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
}

// ReadTextStreamBody keeps a whole-body text read inside the request lifetime
// while detaching it from downstream cancellation after the body is established.
func ReadTextStreamBody(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) ([]byte, error) {
	if c == nil || c.Request == nil || resp == nil || resp.Body == nil || info == nil {
		return nil, fmt.Errorf("invalid buffered text stream")
	}
	defer resp.Body.Close()
	info.StreamStatus = relaycommon.NewStreamStatus()
	type readResult struct {
		body []byte
		err  error
	}
	resultChan := make(chan readResult, 1)
	go func() {
		body, err := io.ReadAll(resp.Body)
		resultChan <- readResult{body: body, err: err}
	}()

	clientDone := c.Request.Context().Done()
	var drainTimer *time.Timer
	var drainC <-chan time.Time
	for {
		select {
		case result := <-resultChan:
			if clientDone != nil && c.Request.Context().Err() != nil {
				clientDone = nil
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err())
			}
			if drainTimer != nil {
				drainTimer.Stop()
			}
			if result.err != nil {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, result.err)
				info.StreamStatus.SetUpstreamResult(relaycommon.StreamUpstreamResultScannerError, result.err)
				return nil, result.err
			}
			info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
			return result.body, nil
		case <-clientDone:
			clientDone = nil
			info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err())
			drainTimer = time.NewTimer(TextStreamDrainTimeout(c))
			drainC = drainTimer.C
		case <-drainC:
			info.StreamStatus.SetUpstreamResult(relaycommon.StreamUpstreamResultDrainTimeout, fmt.Errorf("buffered text stream drain deadline exceeded"))
			_ = resp.Body.Close()
			<-resultChan
			return nil, fmt.Errorf("buffered text stream drain deadline exceeded")
		}
	}
}
