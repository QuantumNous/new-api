package controller

import (
	"context"
	"testing"
	"time"
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
