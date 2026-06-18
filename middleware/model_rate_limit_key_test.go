package middleware

import "testing"

// TestSlidingWindowTotalKeyIsolatedFromLegacyBucket 是 Bug2 的回归锚。
//
// 背景：开启限流后所有请求 500（rate_limit_check_failed），生产日志为
// "WRONGTYPE Operation against a key holding the wrong kind of value"。根因是
// 滑动窗口（sorted set）复用了旧令牌桶遗留的裸 "rateLimit:<userId>" key——旧桶用
// HMSET 把该 key 写成 hash 且无 TTL（EXPIRE 被注释），永不消失，于是每个请求的
// ZREMRANGEBYSCORE 都因类型不符而失败。
//
// 修复：滑动窗口总计数 key 改用独立 "rateLimit:sw:" 前缀。本测试锁死该隔离约束，
// 若有人把 key 改回裸 "rateLimit:<userId>" 或撞上成功计数 key，立即变红。
func TestSlidingWindowTotalKeyIsolatedFromLegacyBucket(t *testing.T) {
	const userId = "1"
	got := slidingWindowTotalKey(userId)

	if legacy := "rateLimit:" + userId; got == legacy {
		t.Fatalf("滑动窗口 key %q 不能等于旧令牌桶裸 key %q（sorted set vs hash 会 WRONGTYPE）", got, legacy)
	}
	if want := "rateLimit:sw:1"; got != want {
		t.Fatalf("key=%q 期望 %q", got, want)
	}
	// 也不能撞「成功请求计数」list key（rateLimit:MRRLS:<userId>）。
	if success := "rateLimit:" + ModelRequestRateLimitSuccessCountMark + ":" + userId; got == success {
		t.Fatalf("滑动窗口 key 不能撞成功计数 key %q", success)
	}
}
