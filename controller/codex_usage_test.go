package controller

import (
	"context"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestNewCodexLimitReportContextUsesSixtySecondDeadline(t *testing.T) {
	startedAt := time.Now()
	ctx, cancel := newCodexLimitReportContext(context.Background())
	defer cancel()

	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("expected codex limit report context to have a deadline")
	}

	timeout := deadline.Sub(startedAt)
	if timeout < 59*time.Second || timeout > 61*time.Second {
		t.Fatalf("codex limit report timeout = %s, want about 60s", timeout)
	}
	if codexLimitReportRequestTimeout != 60*time.Second {
		t.Fatalf("codexLimitReportRequestTimeout = %s, want 60s", codexLimitReportRequestTimeout)
	}
}

func TestRunCodexLimitReportRebuildsCacheOnceForConcurrentRefreshes(t *testing.T) {
	original := rebuildCodexChannelCache
	var rebuilds int32
	rebuildCodexChannelCache = func() { atomic.AddInt32(&rebuilds, 1) }
	t.Cleanup(func() { rebuildCodexChannelCache = original })

	channels := make([]*model.Channel, 10)
	for i := range channels {
		channels[i] = &model.Channel{Id: i + 1, Name: "Codex", Type: constant.ChannelTypeCodex}
	}

	// Every channel reports a refreshed key. The per-channel rebuilds must be
	// coalesced into a single rebuild after all concurrent fetches complete.
	refreshFetcher := func(ctx context.Context, channel *model.Channel) (int, []byte, bool, error) {
		return http.StatusOK, []byte(`{}`), true, nil
	}

	runCodexLimitReport(context.Background(), channels, refreshFetcher, nil, 0, 0)

	if got := atomic.LoadInt32(&rebuilds); got != 1 {
		t.Fatalf("rebuildCodexChannelCache called %d times, want 1", got)
	}
}

func TestRunCodexLimitReportSkipsCacheRebuildWithoutRefreshes(t *testing.T) {
	original := rebuildCodexChannelCache
	var rebuilds int32
	rebuildCodexChannelCache = func() { atomic.AddInt32(&rebuilds, 1) }
	t.Cleanup(func() { rebuildCodexChannelCache = original })

	channels := []*model.Channel{
		{Id: 1, Name: "Codex", Type: constant.ChannelTypeCodex},
		{Id: 2, Name: "Codex", Type: constant.ChannelTypeCodex},
	}

	refreshFetcher := func(ctx context.Context, channel *model.Channel) (int, []byte, bool, error) {
		return http.StatusOK, []byte(`{}`), false, nil
	}

	runCodexLimitReport(context.Background(), channels, refreshFetcher, nil, 0, 0)

	if got := atomic.LoadInt32(&rebuilds); got != 0 {
		t.Fatalf("rebuildCodexChannelCache called %d times, want 0", got)
	}
}
