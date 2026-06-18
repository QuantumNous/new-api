package common

import (
	"testing"
	"time"
)

func newTestRateLimiter() *InMemoryRateLimiter {
	// 直接初始化 store，跳过 Init 的后台清理 goroutine，保持测试纯净
	return &InMemoryRateLimiter{store: make(map[string]*[]int64)}
}

// Check 是只读的：反复调用不消耗配额，之后仍能 Request 满 max 个。
func TestInMemoryRateLimiter_Check_DoesNotConsumeQuota(t *testing.T) {
	l := newTestRateLimiter()
	const max = 3
	for i := 0; i < 10; i++ {
		if !l.Check("k", max, 60) {
			t.Fatalf("空窗口第 %d 次 Check 应放行", i)
		}
	}
	for i := 0; i < max; i++ {
		if !l.Request("k", max, 60) {
			t.Fatalf("Check 之后第 %d 个 Request 应放行（证明 Check 未消耗配额）", i)
		}
	}
}

// Check 的放行判定必须与 Request 一致：满载后两者都拒绝。
func TestInMemoryRateLimiter_Check_MatchesRequestDecision(t *testing.T) {
	l := newTestRateLimiter()
	const max = 2
	for i := 0; i < max; i++ {
		if !l.Request("k", max, 60) {
			t.Fatalf("第 %d 个 Request 应放行", i)
		}
	}
	if l.Check("k", max, 60) {
		t.Fatal("满载后 Check 应返回 false，与 Request 此刻拒绝一致")
	}
}

// 窗口滑过后 Check 恢复放行。
func TestInMemoryRateLimiter_Check_ResetAfterWindow(t *testing.T) {
	l := newTestRateLimiter()
	const max = 1
	const dur int64 = 1
	if !l.Request("k", max, dur) {
		t.Fatal("首个 Request 应放行")
	}
	if l.Check("k", max, dur) {
		t.Fatal("满载后 Check 应为 false")
	}
	time.Sleep(time.Duration(dur)*time.Second + 200*time.Millisecond)
	if !l.Check("k", max, dur) {
		t.Fatal("窗口滑过后 Check 应恢复 true")
	}
}

// store 未初始化时 Check 安全返回 true，不 panic。
func TestInMemoryRateLimiter_Check_NilStore(t *testing.T) {
	l := &InMemoryRateLimiter{}
	if !l.Check("k", 5, 60) {
		t.Fatal("nil store 时 Check 应返回 true")
	}
}
