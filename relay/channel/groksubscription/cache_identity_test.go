package groksubscription

import (
	"strings"
	"testing"
)

func TestCacheIdentityIsDeterministicAndNamespaced(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	a := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	b := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	if a != b {
		t.Fatalf("cache identity must be deterministic")
	}
	// 不含任何原始身份明文
	for _, raw := range []string{"user-1", "token-9", "client-key"} {
		if strings.Contains(a, raw) {
			t.Fatalf("cache identity must not leak raw %q", raw)
		}
	}
}

func TestCacheIdentityVariesByChannelAndInputs(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	base := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	for _, other := range []string{
		ComputeCacheIdentity(secret, 43, "user-1", "token-9", "client-key"),                                      // 换 channel
		ComputeCacheIdentity(secret, 42, "user-2", "token-9", "client-key"),                                      // 换 user
		ComputeCacheIdentity(secret, 42, "user-1", "token-8", "client-key"),                                      // 换 token
		ComputeCacheIdentity(secret, 42, "user-1", "token-9", "other-key"),                                       // 换 client key
		ComputeCacheIdentity([]byte("server-secret-32-bytes-long-yyyyy"), 42, "user-1", "token-9", "client-key"), // 换 secret
	} {
		if other == base {
			t.Fatalf("cache identity must vary when any namespaced input changes")
		}
	}
}

func TestCacheIdentityEmptyClientKeyReturnsEmpty(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	// 客户端没传 cache key 时，不凭空造一个（返回空，调用方据此不发 cache 字段）
	if got := ComputeCacheIdentity(secret, 42, "user-1", "token-9", ""); got != "" {
		t.Fatalf("empty client cache key must yield empty identity, got %q", got)
	}
	if got := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "   "); got != "" {
		t.Fatalf("whitespace-only client cache key must yield empty identity, got %q", got)
	}
}

// TestCacheIdentityLengthPrefixPreventsCrossFieldCollision 锁定长度前缀属性：
// 无前缀时 ("4","2user-1") 与 ("42","user-1") 的 HMAC 输入同为 "42user-1"，
// 会产生同一 identity（跨租户缓存串号）。删除 writeField 的长度字节必使本测试 FAIL。
func TestCacheIdentityLengthPrefixPreventsCrossFieldCollision(t *testing.T) {
	secret := []byte("server-secret-32-bytes-long-xxxxx")
	a := ComputeCacheIdentity(secret, 4, "2user-1", "token-9", "client-key")
	b := ComputeCacheIdentity(secret, 42, "user-1", "token-9", "client-key")
	if a == b {
		t.Fatalf("ambiguous field split must not collide: both = %q", a)
	}
	if !strings.HasPrefix(a, "grok_") || !strings.HasPrefix(b, "grok_") {
		t.Fatalf("identity must keep grok_ prefix")
	}
}
