package limiter

import (
	"context"
	"testing"
)

func TestParseSlidingWindowResult(t *testing.T) {
	tests := []struct {
		name        string
		res         []interface{}
		wantAllowed bool
		wantRetry   int
		wantErr     bool
	}{
		{"allowed", []interface{}{int64(1), int64(0)}, true, 0, false},
		{"denied", []interface{}{int64(0), int64(5)}, false, 5, false},
		{"denied retry clamps to 1", []interface{}{int64(0), int64(1)}, false, 1, false},
		{"bad length short", []interface{}{int64(1)}, false, 0, true},
		{"bad length long", []interface{}{int64(1), int64(0), int64(0)}, false, 0, true},
		{"bad allowed type", []interface{}{"1", int64(0)}, false, 0, true},
		{"bad retry type", []interface{}{int64(1), "0"}, false, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowed, retry, err := parseSlidingWindowResult(tt.res)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if allowed != tt.wantAllowed || retry != tt.wantRetry {
				t.Fatalf("got (%v,%d) want (%v,%d)", allowed, retry, tt.wantAllowed, tt.wantRetry)
			}
		})
	}
}

func TestSlidingWindowAllow_ZeroLimitUnlimited(t *testing.T) {
	// limit<=0 表示不限制，必须短路放行且不触达 Redis（传 nil client 验证不会被解引用）
	for _, limit := range []int{0, -1} {
		allowed, retry, err := SlidingWindowAllow(context.Background(), nil, "k", limit, 60)
		if err != nil || !allowed || retry != 0 {
			t.Fatalf("limit=%d got (%v,%d,%v) want (true,0,nil)", limit, allowed, retry, err)
		}
	}
}
