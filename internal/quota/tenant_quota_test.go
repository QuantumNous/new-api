package quota

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

// All tests use the Redis-disabled (memory) path (rdb = nil) so they run
// without any external infrastructure.  The Redis Lua path is verified
// separately in integration tests against a real Redis instance.

func resetMemState() {
	memRPM.mu.Lock()
	memRPM.store = make(map[string][]int64)
	memRPM.mu.Unlock()

	memTPM.mu.Lock()
	memTPM.store = make(map[string]int)
	memTPM.mu.Unlock()

	memMonthly.mu.Lock()
	memMonthly.store = make(map[string]int)
	memMonthly.mu.Unlock()
}

// ---------------------------------------------------------------------------
// RPM — memory path
// ---------------------------------------------------------------------------

func TestCheckRPM_ZeroLimitUnlimited(t *testing.T) {
	resetMemState()
	for i := 0; i < 1000; i++ {
		ok, err := CheckRPM(context.Background(), nil, 1, 0)
		if err != nil || !ok {
			t.Fatalf("limit=0 should always allow, got ok=%v err=%v", ok, err)
		}
	}
}

func TestCheckRPM_AllowsUpToLimit(t *testing.T) {
	resetMemState()
	const limit = 5
	for i := 0; i < limit; i++ {
		ok, err := CheckRPM(context.Background(), nil, 42, limit)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !ok {
			t.Fatalf("request %d/%d should be allowed", i+1, limit)
		}
	}
}

func TestCheckRPM_BlocksOnExceed(t *testing.T) {
	resetMemState()
	const limit = 3
	for i := 0; i < limit; i++ {
		CheckRPM(context.Background(), nil, 7, limit) //nolint
	}
	ok, err := CheckRPM(context.Background(), nil, 7, limit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("request beyond limit should be blocked")
	}
}

// TestCheckRPM_Concurrent verifies that concurrent requests cannot overspend
// the quota (AC: "atomic" in acceptance criteria).
func TestCheckRPM_Concurrent(t *testing.T) {
	resetMemState()
	const limit = 10
	const goroutines = 50

	var allowed int
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			ok, _ := CheckRPM(context.Background(), nil, 99, limit)
			if ok {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if allowed > limit {
		t.Fatalf("concurrent RPM: %d requests allowed, limit is %d", allowed, limit)
	}
}

// ---------------------------------------------------------------------------
// TPM — memory path
// ---------------------------------------------------------------------------

func TestCheckTPM_ZeroLimitUnlimited(t *testing.T) {
	resetMemState()
	ok, err := CheckTPM(context.Background(), nil, 1, 0, 9999)
	if err != nil || !ok {
		t.Fatalf("limit=0 should always allow")
	}
}

func TestCheckTPM_AllowsUnderBudget(t *testing.T) {
	resetMemState()
	ok, err := CheckTPM(context.Background(), nil, 2, 1000, 400)
	if err != nil || !ok {
		t.Fatalf("400 tokens should fit in 1000 TPM budget")
	}
	ok, err = CheckTPM(context.Background(), nil, 2, 1000, 400)
	if err != nil || !ok {
		t.Fatalf("800 total should still fit in 1000 TPM budget")
	}
}

func TestCheckTPM_BlocksOnOverflow(t *testing.T) {
	resetMemState()
	CheckTPM(context.Background(), nil, 3, 500, 400) //nolint
	ok, err := CheckTPM(context.Background(), nil, 3, 500, 200)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("600 total tokens should exceed 500 TPM limit")
	}
}

func TestCheckTPM_Concurrent(t *testing.T) {
	resetMemState()
	const limit = 1000
	const goroutines = 100
	const tokensPerReq = 20

	var allowed int
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			ok, _ := CheckTPM(context.Background(), nil, 55, limit, tokensPerReq)
			if ok {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	maxAllowed := limit / tokensPerReq
	if allowed > maxAllowed {
		t.Fatalf("concurrent TPM: %d requests allowed, expected ≤ %d", allowed, maxAllowed)
	}
}

// ---------------------------------------------------------------------------
// Monthly — memory path
// ---------------------------------------------------------------------------

func TestCheckMonthly_ZeroLimitUnlimited(t *testing.T) {
	resetMemState()
	ok, err := CheckMonthly(context.Background(), nil, 1, 0)
	if err != nil || !ok {
		t.Fatalf("limit=0 should always allow")
	}
}

func TestCheckMonthly_AllowsUpToLimit(t *testing.T) {
	resetMemState()
	const limit = 5
	for i := 0; i < limit; i++ {
		ok, err := CheckMonthly(context.Background(), nil, 10, limit)
		if err != nil || !ok {
			t.Fatalf("request %d/%d should be allowed", i+1, limit)
		}
	}
}

func TestCheckMonthly_BlocksOnExceed(t *testing.T) {
	resetMemState()
	const limit = 2
	CheckMonthly(context.Background(), nil, 20, limit) //nolint
	CheckMonthly(context.Background(), nil, 20, limit) //nolint
	ok, err := CheckMonthly(context.Background(), nil, 20, limit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("third request should be blocked by monthly limit of 2")
	}
}

func TestCheckMonthly_Concurrent(t *testing.T) {
	resetMemState()
	const limit = 10
	const goroutines = 50

	var allowed int
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			ok, _ := CheckMonthly(context.Background(), nil, 77, limit)
			if ok {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if allowed > limit {
		t.Fatalf("concurrent monthly: %d requests allowed, limit is %d", allowed, limit)
	}
}

// ---------------------------------------------------------------------------
// Bucket isolation — different tokens don't share counters
// ---------------------------------------------------------------------------

func TestCheckRPM_TokenIsolation(t *testing.T) {
	resetMemState()
	const limit = 2
	// fill up token 100
	CheckRPM(context.Background(), nil, 100, limit) //nolint
	CheckRPM(context.Background(), nil, 100, limit) //nolint

	// token 101 should still be allowed
	ok, err := CheckRPM(context.Background(), nil, 101, limit)
	if err != nil || !ok {
		t.Fatal("token 101 should not be affected by token 100's quota")
	}
}

func TestCheckTPM_TokenIsolation(t *testing.T) {
	resetMemState()
	const limit = 100
	// Exhaust token 300's budget
	CheckTPM(context.Background(), nil, 300, limit, 100) //nolint

	// Token 301 should have its own fresh bucket
	ok, err := CheckTPM(context.Background(), nil, 301, limit, 50)
	if err != nil || !ok {
		t.Fatal("token 301 should not be affected by token 300's TPM quota")
	}
}

func TestCheckMonthly_TokenIsolation(t *testing.T) {
	resetMemState()
	const limit = 1
	// Exhaust token 400's monthly budget
	CheckMonthly(context.Background(), nil, 400, limit) //nolint

	// Token 401 should have its own fresh counter
	ok, err := CheckMonthly(context.Background(), nil, 401, limit)
	if err != nil || !ok {
		t.Fatal("token 401 should not be affected by token 400's monthly quota")
	}
}

// ---------------------------------------------------------------------------
// Sliding window — entries older than 60s are evicted
// ---------------------------------------------------------------------------

func TestCheckRPM_WindowExpiry(t *testing.T) {
	resetMemState()
	const limit = 1

	// Exhaust the limit via the real function so the key format is correct.
	CheckRPM(context.Background(), nil, 200, limit) //nolint

	// Back-date the recorded timestamp by 61 seconds to simulate window expiry.
	key := fmt.Sprintf("tq:rpm:%d", 200)
	memRPM.mu.Lock()
	q := memRPM.store[key]
	for i := range q {
		q[i] -= 61
	}
	memRPM.mu.Unlock()

	// The expired entry should be evicted, so this request should be allowed.
	ok, err := CheckRPM(context.Background(), nil, 200, limit)
	if err != nil || !ok {
		t.Fatal("request should be allowed after old window entry expires")
	}
}
