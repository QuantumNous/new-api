package providerplugin

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// eventSource reads an upstream stream event by event. more is false at its
// end.
type eventSource interface {
	next() (event jsplugin.StreamEvent, more bool, err error)
}

// streamConverter reads an upstream stream or WebSocket session event by
// event and converts each one with convertStreamEvent. For a streaming client
// it serves the events the plugin returns as server-sent events; for a
// non-streaming one it serves the chunks the plugin returns as they come, or
// the body it ends with.
type streamConverter struct {
	ctx      context.Context
	adaptor  *Adaptor
	hookCtx  jsplugin.HookContext
	source   eventSource
	upstream io.Closer
	// session is the upstream WebSocket, nil for an HTTP stream.
	session *websocket.Conn
	// clientStream is set for a streaming client, which gets events.
	clientStream bool
	disablePing  bool
	pending      bytes.Buffer
	done         bool
	// chunked is set once the plugin returned chunks, body once it returned
	// the whole body; contentType is theirs.
	chunked     bool
	hasBody     bool
	body        []byte
	contentType string

	// idle closes the upstream when no data comes within idleTimeout. It runs
	// while the stream is primed, and for a non-streaming client until the
	// conversion ends; a streaming client's handler bounds the rest.
	mutex       sync.Mutex
	idle        *time.Timer
	idleTimeout time.Duration
	idleClosed  bool
}

// newStreamConverter converts the stream of an upstream request whose
// convertResponse would read state as ctx.state.
func (a *Adaptor) newStreamConverter(c *gin.Context, info *relaycommon.RelayInfo, state json.RawMessage, upstream io.Closer, session *websocket.Conn) *streamConverter {
	hookCtx := a.hookContext(c, info)
	hookCtx.State = state
	return &streamConverter{
		ctx:          c.Request.Context(),
		adaptor:      a,
		hookCtx:      hookCtx,
		upstream:     upstream,
		session:      session,
		clientStream: info.IsStream,
		disablePing:  info.DisablePing,
	}
}

// streamSource is the event source of an upstream HTTP stream: an AWS event
// stream by its content type, else server-sent events or, without that
// content type, a line-delimited stream.
func (s *streamConverter) streamSource(resp *http.Response) eventSource {
	body := &activityReader{reader: resp.Body, touch: s.touch}
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.HasPrefix(contentType, eventStreamContentType) {
		return &eventStreamReader{reader: body, limit: streamLineLimit()}
	}
	return &lineSource{reader: bufio.NewReader(body), sse: strings.HasPrefix(contentType, "text/event-stream")}
}

// respond primes the conversion and answers the client: the event stream, or
// the chunks or body of a non-streaming client. An error before the first
// output still gets an error status unless a keep-alive ping went out, as
// while the upstream headers are awaited.
func (s *streamConverter) respond(c *gin.Context, header http.Header) (*http.Response, error) {
	stopPinger := func() {}
	if generalSettings := operation_setting.GetGeneralSetting(); s.clientStream && generalSettings.PingIntervalEnabled && !s.disablePing {
		stopPinger = helper.StartStreamKeepAlive(c, time.Duration(generalSettings.PingIntervalSeconds)*time.Second)
	}
	upstreamErr, err := s.prime(time.Duration(constant.StreamingTimeout) * time.Second)
	stopPinger()
	if upstreamErr != nil || err != nil {
		_ = s.Close()
		if err != nil {
			return nil, err
		}
		return upstreamErrorResponse(upstreamErr, http.StatusInternalServerError), nil
	}
	header = header.Clone()
	header.Del("Content-Length")
	header.Del("Content-Encoding")
	response := &http.Response{StatusCode: http.StatusOK, Status: http.StatusText(http.StatusOK), Header: header, Body: s}
	switch {
	case s.clientStream:
		header.Set("Content-Type", "text/event-stream")
	case s.hasBody:
		_ = s.Close()
		header.Set("Content-Type", s.contentType)
		response.Body = io.NopCloser(bytes.NewReader(s.body))
		response.ContentLength = int64(len(s.body))
	case s.chunked:
		header.Set("Content-Type", s.contentType)
	default:
		_ = s.Close()
		return nil, fmt.Errorf("plugin %s convertStreamEvent ended without a body for a non-streaming request", s.adaptor.plugin.Meta.Key)
	}
	return response, nil
}

// prime converts upstream events until the plugin returns its first output,
// returns an error or the stream ends. The output stays pending for Read.
// Like the stream handler, it closes the upstream when the client leaves or
// no upstream data comes within the streaming timeout.
func (s *streamConverter) prime(timeout time.Duration) (*jsplugin.UpstreamError, error) {
	stopOnLeave := context.AfterFunc(s.ctx, s.closeIdle)
	s.mutex.Lock()
	s.idle, s.idleTimeout = time.AfterFunc(timeout, s.closeIdle), timeout
	s.mutex.Unlock()
	var upstreamErr *jsplugin.UpstreamError
	var err error
	for s.pending.Len() == 0 && !s.hasBody && !s.done && upstreamErr == nil && err == nil {
		upstreamErr, err = s.convertNext()
	}
	s.mutex.Lock()
	closed := s.idleClosed
	if s.clientStream || s.done || upstreamErr != nil || err != nil {
		s.idle.Stop()
		s.idle = nil
	}
	s.mutex.Unlock()
	if s.clientStream {
		stopOnLeave()
	}
	// A non-streaming client's chunks are read later; leaving or the idle
	// timeout still ends them.
	switch {
	case closed && s.ctx.Err() != nil:
		return nil, fmt.Errorf("client left before the first stream event: %w", s.ctx.Err())
	case closed:
		return nil, fmt.Errorf("upstream stream sent no data within %s", timeout)
	}
	return upstreamErr, err
}

// touch restarts the idle timer on upstream data.
func (s *streamConverter) touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.idle != nil {
		s.idle.Reset(s.idleTimeout)
	}
}

func (s *streamConverter) closeIdle() {
	s.mutex.Lock()
	if s.idle == nil {
		s.mutex.Unlock()
		return
	}
	s.idleClosed = true
	s.mutex.Unlock()
	_ = s.upstream.Close()
}

// Read serves the converted output. An error the plugin returns after the
// first output ends the stream as a read error does. For a streaming client,
// an upstream event the plugin drops reads as a blank line: the stream handler
// skips it, and it restarts the handler's streaming timeout as the upstream
// data would.
func (s *streamConverter) Read(p []byte) (int, error) {
	for s.pending.Len() == 0 {
		if s.done || s.hasBody {
			s.stopIdle()
			return 0, io.EOF
		}
		upstreamErr, err := s.convertNext()
		if upstreamErr != nil {
			return 0, upstreamErr
		}
		if err != nil {
			s.mutex.Lock()
			closed := s.idleClosed
			s.mutex.Unlock()
			if closed && s.ctx.Err() == nil {
				return 0, fmt.Errorf("upstream stream sent no data within %s", s.idleTimeout)
			}
			return 0, err
		}
		if s.clientStream && s.pending.Len() == 0 && !s.done && len(p) > 0 {
			p[0] = '\n'
			return 1, nil
		}
	}
	return s.pending.Read(p)
}

func (s *streamConverter) stopIdle() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.idle != nil {
		s.idle.Stop()
		s.idle = nil
	}
}

// convertNext converts the next upstream event, or the end of the stream,
// and queues the output the plugin returns.
func (s *streamConverter) convertNext() (*jsplugin.UpstreamError, error) {
	event, more, err := s.source.next()
	if err != nil {
		return nil, err
	}
	plugin := s.adaptor.plugin
	var result jsplugin.StreamResult
	var upstreamErr *jsplugin.UpstreamError
	if more {
		result, s.hookCtx.State, upstreamErr, err = plugin.CallConvertStreamEvent(s.ctx, s.hookCtx, &event, false)
	} else {
		s.done = true
		result, s.hookCtx.State, upstreamErr, err = plugin.CallConvertStreamEvent(s.ctx, s.hookCtx, nil, true)
	}
	if upstreamErr != nil || err != nil {
		return upstreamErr, err
	}
	s.adaptor.addTools(result.Tools)
	if err = s.queue(result); err != nil {
		return nil, fmt.Errorf("plugin %s convertStreamEvent result: %w", plugin.Meta.Key, err)
	}
	if s.session == nil {
		if len(result.Send) > 0 || result.Close {
			return nil, fmt.Errorf("plugin %s convertStreamEvent result: send and close need an upstream WebSocket", plugin.Meta.Key)
		}
		if s.hasBody {
			_ = s.upstream.Close()
		}
		return nil, nil
	}
	for _, message := range result.Send {
		if err = writeWebSocketMessage(s.session, message); err != nil {
			return nil, err
		}
	}
	// A body ends the session after the messages the same result sends.
	if result.Close || s.hasBody {
		closeWebSocket(s.session)
	}
	return nil, nil
}

// queue adds a result's output: events for a streaming client, chunks or the
// body for a non-streaming one.
func (s *streamConverter) queue(result jsplugin.StreamResult) error {
	if s.clientStream {
		if len(result.Chunks) > 0 || result.HasBody {
			return errors.New("chunks and body answer a non-streaming request; return events")
		}
		for _, converted := range result.Events {
			if converted.Event != "" {
				s.pending.WriteString("event: " + converted.Event + "\n")
			}
			for line := range strings.SplitSeq(converted.Data, "\n") {
				s.pending.WriteString("data: " + strings.TrimSuffix(line, "\r") + "\n")
			}
			s.pending.WriteString("\n")
		}
		return nil
	}
	switch {
	case len(result.Events) > 0:
		return errors.New("events answer a streaming request; return chunks or a body")
	case result.HasBody:
		if s.chunked {
			return errors.New("a body cannot follow chunks")
		}
		s.hasBody, s.body = true, result.Body
		s.contentType = result.ContentType
		if s.contentType == "" {
			s.contentType = "application/json"
		}
	case len(result.Chunks) > 0:
		if !s.chunked {
			s.chunked = true
			s.contentType = result.ContentType
			if s.contentType == "" {
				s.contentType = "application/octet-stream"
			}
		}
		for _, chunk := range result.Chunks {
			s.pending.Write(chunk)
		}
	}
	return nil
}

func (s *streamConverter) Close() error {
	s.stopIdle()
	return s.upstream.Close()
}

// activityReader reports every read that returns data.
type activityReader struct {
	reader io.Reader
	touch  func()
}

func (r *activityReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if n > 0 {
		r.touch()
	}
	return n, err
}

// lineSource reads server-sent events, or the non-empty lines of a
// line-delimited stream.
type lineSource struct {
	reader *bufio.Reader
	sse    bool
}

// next reads one upstream event: a server-sent event, or a non-empty line of
// a line-delimited stream. more is false at the end of the stream.
func (s *lineSource) next() (event jsplugin.StreamEvent, more bool, err error) {
	var data []string
	hasData := false
	for {
		line, readErr := s.readLine()
		if readErr != nil && readErr != io.EOF {
			return jsplugin.StreamEvent{}, false, readErr
		}
		atEOF := readErr == io.EOF
		if !s.sse {
			if strings.TrimSpace(line) != "" {
				return jsplugin.StreamEvent{Data: line}, true, nil
			}
			if atEOF {
				return jsplugin.StreamEvent{}, false, nil
			}
			continue
		}
		switch {
		case line == "":
			if hasData || event.Event != "" {
				event.Data = strings.Join(data, "\n")
				return event, true, nil
			}
		case strings.HasPrefix(line, ":"):
		default:
			name, value, _ := strings.Cut(line, ":")
			value = strings.TrimPrefix(value, " ")
			switch name {
			case "event":
				event.Event = value
			case "data":
				data = append(data, value)
				hasData = true
			}
		}
		if atEOF {
			if hasData || event.Event != "" {
				event.Data = strings.Join(data, "\n")
				return event, true, nil
			}
			return jsplugin.StreamEvent{}, false, nil
		}
	}
}

// readLine reads one line without its line ending, bounded by the stream
// buffer limit. It returns io.EOF with the last line.
func (s *lineSource) readLine() (string, error) {
	limit := streamLineLimit()
	var line []byte
	for {
		chunk, err := s.reader.ReadSlice('\n')
		line = append(line, chunk...)
		if len(line) > limit {
			return "", fmt.Errorf("upstream stream line exceeds %d bytes", limit)
		}
		if err == bufio.ErrBufferFull {
			continue
		}
		text := strings.TrimSuffix(strings.TrimSuffix(string(line), "\n"), "\r")
		if err != nil && err != io.EOF {
			return "", err
		}
		return text, err
	}
}

func streamLineLimit() int {
	if limit := constant.StreamScannerMaxBufferMB << 20; limit > 0 {
		return limit
	}
	return 128 << 20
}

// webSocketSource reads the frames of an upstream WebSocket session: a text
// frame is {data}, a binary one {dataBase64}. The session ends when either
// side closes it.
type webSocketSource struct {
	session *websocket.Conn
	touch   func()
	limit   int
}

func (s *webSocketSource) next() (jsplugin.StreamEvent, bool, error) {
	messageType, data, err := s.session.ReadMessage()
	if err != nil {
		var closeErr *websocket.CloseError
		if errors.As(err, &closeErr) || errors.Is(err, net.ErrClosed) {
			return jsplugin.StreamEvent{}, false, nil
		}
		return jsplugin.StreamEvent{}, false, err
	}
	s.touch()
	if len(data) > s.limit {
		return jsplugin.StreamEvent{}, false, fmt.Errorf("upstream WebSocket message exceeds %d bytes", s.limit)
	}
	if messageType == websocket.BinaryMessage {
		return jsplugin.StreamEvent{Binary: data}, true, nil
	}
	return jsplugin.StreamEvent{Data: string(data)}, true, nil
}

func writeWebSocketMessage(session *websocket.Conn, message jsplugin.WebSocketMessage) error {
	if message.IsBinary {
		return session.WriteMessage(websocket.BinaryMessage, message.Binary)
	}
	return session.WriteMessage(websocket.TextMessage, []byte(message.Text))
}

// closeWebSocket sends a normal close and closes the connection; the next
// read ends the session.
func closeWebSocket(session *websocket.Conn) {
	_ = session.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
	_ = session.Close()
}
