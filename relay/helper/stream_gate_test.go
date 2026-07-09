package helper

import (
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
)

func newTestSink(t *testing.T) (*SharedClientSink, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(recorder)
	_ = engine
	c, _ := gin.CreateTestContext(recorder)
	return NewSharedClientSink(c.Writer), recorder
}

func TestStreamGatePingDoesNotWin(t *testing.T) {
	sink, recorder := newTestSink(t)
	judged := false
	gate := NewStreamGate(sink, func(_ *StreamGate) bool {
		judged = true
		return true
	})

	if _, err := gate.Write([]byte(": PING\n\n")); err != nil {
		t.Fatalf("ping write failed: %v", err)
	}
	if judged {
		t.Fatalf("SSE comment ping should not trigger the first-byte judge")
	}
	if !strings.Contains(recorder.Body.String(), ": PING") {
		t.Fatalf("keepalive ping should pass through to client, got %q", recorder.Body.String())
	}
}

func TestStreamGateFirstDataWinsAndLoserDiscards(t *testing.T) {
	sink, recorder := newTestSink(t)

	var mu sync.Mutex
	var winner *StreamGate
	judge := func(g *StreamGate) bool {
		mu.Lock()
		defer mu.Unlock()
		if winner == nil {
			winner = g
			return true
		}
		return winner == g
	}

	gateA := NewStreamGate(sink, judge)
	gateB := NewStreamGate(sink, judge)

	if _, err := gateA.Write([]byte("data: hello-from-a\n\n")); err != nil {
		t.Fatalf("gateA write failed: %v", err)
	}
	if _, err := gateB.Write([]byte("data: hello-from-b\n\n")); err != nil {
		t.Fatalf("gateB write failed: %v", err)
	}
	// 败者后续写入也应被吞掉
	if _, err := gateB.Write([]byte("data: more-from-b\n\n")); err != nil {
		t.Fatalf("gateB second write failed: %v", err)
	}
	// 赢家继续直播
	if _, err := gateA.Write([]byte("data: tail-from-a\n\n")); err != nil {
		t.Fatalf("gateA second write failed: %v", err)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, "hello-from-a") || !strings.Contains(body, "tail-from-a") {
		t.Fatalf("winner output missing: %q", body)
	}
	if strings.Contains(body, "from-b") {
		t.Fatalf("loser output leaked to client: %q", body)
	}
	if !gateA.IsLive() {
		t.Fatalf("winner gate should be live")
	}
	if gateB.IsLive() {
		t.Fatalf("loser gate should not be live")
	}
}

func TestStreamGateConcurrentRaceSingleWinner(t *testing.T) {
	sink, _ := newTestSink(t)

	var mu sync.Mutex
	var winner *StreamGate
	judge := func(g *StreamGate) bool {
		mu.Lock()
		defer mu.Unlock()
		if winner == nil {
			winner = g
			return true
		}
		return winner == g
	}

	gates := []*StreamGate{
		NewStreamGate(sink, judge),
		NewStreamGate(sink, judge),
	}

	var wg sync.WaitGroup
	for _, g := range gates {
		wg.Add(1)
		go func(g *StreamGate) {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				_, _ = g.Write([]byte("data: x\n\n"))
			}
		}(g)
	}
	wg.Wait()

	liveCount := 0
	for _, g := range gates {
		if g.IsLive() {
			liveCount++
		}
	}
	if liveCount != 1 {
		t.Fatalf("expected exactly one live gate, got %d", liveCount)
	}
}
