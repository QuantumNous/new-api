package helper

import (
	"bufio"
	"bytes"
	"errors"
	"net"
	"net/http"
	"sync"
	"sync/atomic"

	"github.com/gin-gonic/gin"
)

// clientgone fallback 竞速的输出门。
//
// 每个竞速 attempt（primary / hedge）各持一个 StreamGate 作为它的 gin.ResponseWriter，
// 真实的客户端 writer 由 SharedClientSink 独占。判胜规则：谁先写出第一个"数据帧"
//（非 SSE 注释）谁赢——赢家的 gate 转为直通，败者转为丢弃。
// 我们自己的保活 ping（": PING\n\n"，SSE 注释帧）不参与判胜，但会透传给客户端保活。

type gateMode = int32

const (
	gateModeHold    gateMode = iota // 竞速未决：注释帧透传保活，数据帧触发判胜
	gateModeLive                    // 赢家：直通真实 writer
	gateModeDiscard                 // 败者：吞掉一切输出
)

// SharedClientSink 包住真实的客户端 writer，供两个 gate 互斥写入。
type SharedClientSink struct {
	mu          sync.Mutex
	w           gin.ResponseWriter
	headersSent bool
}

func NewSharedClientSink(w gin.ResponseWriter) *SharedClientSink {
	return &SharedClientSink{w: w}
}

// commitHeadersLocked 把 gate 的响应头 + 状态码写到真实 writer（只生效一次）。调用方需持有 s.mu。
func (s *SharedClientSink) commitHeadersLocked(header http.Header, status int) {
	if s.headersSent {
		return
	}
	s.headersSent = true
	dst := s.w.Header()
	for key, values := range header {
		dst.Del(key)
		for _, value := range values {
			dst.Add(key, value)
		}
	}
	if status <= 0 {
		status = http.StatusOK
	}
	s.w.WriteHeader(status)
	s.w.WriteHeaderNow()
}

func (s *SharedClientSink) writeAndFlush(header http.Header, status int, p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.commitHeadersLocked(header, status)
	n, err := s.w.Write(p)
	if flusher, ok := s.w.(http.Flusher); ok {
		flusher.Flush()
	}
	return n, err
}

// HeadersSent 返回真实 writer 是否已经写出响应头（双败后外层错误路径据此决定还能否返回 JSON）。
func (s *SharedClientSink) HeadersSent() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.headersSent
}

// StreamGate 实现 gin.ResponseWriter。
type StreamGate struct {
	sink *SharedClientSink
	// onFirstData 在 Hold 模式收到第一个数据帧时同步调用（每个 gate 至多一次）。
	// 返回 true 表示本 gate 胜出（调用后 gate 转 Live 并写出该帧），false 表示已有别家胜出（转 Discard）。
	onFirstData func(g *StreamGate) bool

	mode        atomic.Int32
	firedJudge  atomic.Bool
	mu          sync.Mutex
	header      http.Header
	status      int
	size        int
	wroteHeader bool
}

func NewStreamGate(sink *SharedClientSink, onFirstData func(g *StreamGate) bool) *StreamGate {
	g := &StreamGate{
		sink:        sink,
		onFirstData: onFirstData,
		header:      make(http.Header),
		status:      http.StatusOK,
	}
	g.mode.Store(gateModeHold)
	return g
}

// PromoteToLive 将 gate 切换为直通模式（判胜回调返回 true 后由 Write 内部调用；
// 也可由控制器在"attempt 无数据帧但正常结束"的安全网场景显式调用）。
func (g *StreamGate) PromoteToLive() {
	g.mode.Store(gateModeLive)
}

func (g *StreamGate) Discard() {
	g.mode.Store(gateModeDiscard)
}

func (g *StreamGate) IsLive() bool {
	return g.mode.Load() == gateModeLive
}

// isSSECommentOnly 判断一次写入是否只包含 SSE 注释行（我们的保活 ping）。
func isSSECommentOnly(p []byte) bool {
	if len(p) == 0 {
		return true
	}
	for _, line := range bytes.Split(p, []byte("\n")) {
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) == 0 {
			continue
		}
		if trimmed[0] != ':' {
			return false
		}
	}
	return true
}

func (g *StreamGate) Write(p []byte) (int, error) {
	switch g.mode.Load() {
	case gateModeDiscard:
		return len(p), nil
	case gateModeLive:
		g.size += len(p)
		return g.sink.writeAndFlush(g.snapshotHeader(), g.statusCode(), p)
	}

	// Hold 模式
	if isSSECommentOnly(p) {
		// 保活 ping：透传给客户端（顺带提交 SSE 响应头），不参与判胜
		g.size += len(p)
		return g.sink.writeAndFlush(g.snapshotHeader(), g.statusCode(), p)
	}

	// 第一个数据帧：判胜（每个 gate 只触发一次）
	if g.firedJudge.CompareAndSwap(false, true) {
		if g.onFirstData != nil && g.onFirstData(g) {
			g.PromoteToLive()
		} else {
			g.Discard()
			return len(p), nil
		}
	}
	if g.mode.Load() == gateModeLive {
		g.size += len(p)
		return g.sink.writeAndFlush(g.snapshotHeader(), g.statusCode(), p)
	}
	return len(p), nil
}

func (g *StreamGate) WriteString(s string) (int, error) {
	return g.Write([]byte(s))
}

func (g *StreamGate) snapshotHeader() http.Header {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.header.Clone()
}

func (g *StreamGate) statusCode() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.status
}

// --- gin.ResponseWriter 接口其余部分 ---

func (g *StreamGate) Header() http.Header {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.header
}

func (g *StreamGate) WriteHeader(code int) {
	if code <= 0 {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.wroteHeader {
		return
	}
	g.status = code
}

func (g *StreamGate) WriteHeaderNow() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.wroteHeader = true
}

func (g *StreamGate) Status() int {
	return g.statusCode()
}

func (g *StreamGate) Size() int {
	return g.size
}

func (g *StreamGate) Written() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.wroteHeader || g.size > 0
}

func (g *StreamGate) Flush() {
	// 写入路径里每次 writeAndFlush 已经 flush 真实 writer；Hold/Discard 模式无事可做
}

func (g *StreamGate) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return nil, nil, errors.New("stream gate does not support hijacking")
}

func (g *StreamGate) CloseNotify() <-chan bool {
	// 竞速 attempt 的生命周期由各自的 context 控制，这里返回永不触发的通道
	return make(chan bool)
}

func (g *StreamGate) Pusher() http.Pusher {
	return nil
}
