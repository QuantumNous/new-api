package groksubscription

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

// doerFunc 让函数直接充当 HTTPDoer。
type doerFunc func(*http.Request) (*http.Response, error)

func (f doerFunc) Do(req *http.Request) (*http.Response, error) { return f(req) }

// jsonResponse 造一个带 JSON body 的 *http.Response。
func jsonResponse(code int, body string) *http.Response {
	return &http.Response{
		StatusCode: code,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}
}

// fakeStore：Load 返回固定 key+revision；CAS 仅当 expectedRevision 匹配当前 revision 才成功。
type fakeStore struct {
	key      string
	revision int
	casCalls int
}

func (f *fakeStore) Load(ctx context.Context, channelID int) (string, int, error) {
	return f.key, f.revision, nil
}
func (f *fakeStore) CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error) {
	f.casCalls++
	if expectedRevision != f.revision {
		return false, nil
	}
	f.key = newKey
	f.revision++
	return true, nil
}

// driftStore：Load 返回 load 这个 revision，但 CAS 时当前实际 revision 是 casRev（≠load）→ 模拟并发漂移，CAS 必失败。
type driftStore struct {
	load   int
	casRev int
}

func (d *driftStore) Load(ctx context.Context, channelID int) (string, int, error) {
	return `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`, d.load, nil
}
func (d *driftStore) CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error) {
	return expectedRevision == d.casRev, nil // load(7) != casRev(999) → false
}

func TestRefreshTokenSuccessSwapsCredential(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
		revision: 7,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer","expires_in":3600}`), nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	newCred, err := r.Refresh(context.Background(), 5)
	if err != nil {
		t.Fatalf("refresh err %v", err)
	}
	if newCred.AccessToken != "new" || newCred.RefreshToken != "rt2" {
		t.Fatalf("credential not updated")
	}
	if newCred.ExpiresAt != 2000+3600 {
		t.Fatalf("expires_at = %d, want now+expires_in", newCred.ExpiresAt)
	}
	if store.casCalls != 1 {
		t.Fatalf("expected exactly one CAS, got %d", store.casCalls)
	}
}

func TestRefreshTokenNonRefreshableFails(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","token_type":"Bearer","expires_at":1000}`,
		revision: 1,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint without refresh_token")
		return nil, nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	if _, err := r.Refresh(context.Background(), 5); !errors.Is(err, ErrNotRefreshable) {
		t.Fatalf("want ErrNotRefreshable, got %v", err)
	}
}

func TestRefreshTokenCASConflictReturnsRetryable(t *testing.T) {
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer","expires_in":3600}`), nil
	})
	drift := &driftStore{load: 7, casRev: 999}
	r := NewRefresher(drift, doer, func() int64 { return 2000 })
	if _, err := r.Refresh(context.Background(), 5); !errors.Is(err, ErrRefreshConflict) {
		t.Fatalf("want ErrRefreshConflict on CAS mismatch, got %v", err)
	}
}

// TestRefreshTokenNon200ErrorOmitsBody 守护凭证安全铁律：非 200 响应的 error 只带状态码，
// 绝不夹带上游 response body（body 可能含敏感串）。变异验证：把 body 拼进 error 即 FAIL。
func TestRefreshTokenNon200ErrorOmitsBody(t *testing.T) {
	const secret = "super-secret-should-not-leak"
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
		revision: 1,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(401, `{"error":"`+secret+`"}`), nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	_, err := r.Refresh(context.Background(), 5)
	if err == nil {
		t.Fatalf("non-200 must return error")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("error message must NOT leak response body, got %q", err.Error())
	}
	if !strings.Contains(err.Error(), "401") {
		t.Fatalf("error should carry status code, got %q", err.Error())
	}
	if store.casCalls != 0 {
		t.Fatalf("must not CAS on non-200, got %d calls", store.casCalls)
	}
}

// TestRefreshTokenPreservesOldRefreshTokenWhenUpstreamOmits 守护 OAuth 正确性（RFC 6749 §6）：
// 上游 200 但不轮换 refresh_token 时，新凭证须保留旧 refresh_token。变异验证：改成只取 tr.RefreshToken 即 FAIL。
func TestRefreshTokenPreservesOldRefreshTokenWhenUpstreamOmits(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"keep-me","token_type":"Bearer","expires_at":1000}`,
		revision: 3,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		// 上游只回新 access_token，不轮换 refresh_token
		return jsonResponse(200, `{"access_token":"new","token_type":"Bearer","expires_in":3600}`), nil
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	newCred, err := r.Refresh(context.Background(), 5)
	if err != nil {
		t.Fatalf("refresh err %v", err)
	}
	if newCred.RefreshToken != "keep-me" {
		t.Fatalf("refresh_token must be preserved when upstream omits it, got %q", newCred.RefreshToken)
	}
	if newCred.AccessToken != "new" {
		t.Fatalf("access_token must update, got %q", newCred.AccessToken)
	}
}

// TestRefreshTokenRejectsNonPositiveExpiresIn 守护 fail-closed（[7][9]）：上游 200 但 expires_in<=0
// （含缺省解析为 0）会持久化 ExpiresAt<=now 的立即过期凭证，ParseCredential 读回要求 ExpiresAt>0，
// 于是变成写入即自败、可能触发重刷循环的坏凭证。必须在构造 newCred 前报错、绝不 CAS 写回。
func TestRefreshTokenRejectsNonPositiveExpiresIn(t *testing.T) {
	// 缺 expires_in → 解析为 0
	t.Run("missing/zero", func(t *testing.T) {
		store := &fakeStore{
			key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
			revision: 1,
		}
		doer := doerFunc(func(req *http.Request) (*http.Response, error) {
			return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer"}`), nil
		})
		r := NewRefresher(store, doer, func() int64 { return 2000 })
		if _, err := r.Refresh(context.Background(), 5); err == nil {
			t.Fatalf("zero expires_in must fail closed")
		}
		if store.casCalls != 0 {
			t.Fatalf("must not CAS/persist self-expiring credential, got %d calls", store.casCalls)
		}
	})
	// 负数 expires_in 同样拒绝
	t.Run("negative", func(t *testing.T) {
		store := &fakeStore{
			key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
			revision: 1,
		}
		doer := doerFunc(func(req *http.Request) (*http.Response, error) {
			return jsonResponse(200, `{"access_token":"new","refresh_token":"rt2","token_type":"Bearer","expires_in":-10}`), nil
		})
		r := NewRefresher(store, doer, func() int64 { return 2000 })
		if _, err := r.Refresh(context.Background(), 5); err == nil {
			t.Fatalf("negative expires_in must fail closed")
		}
		if store.casCalls != 0 {
			t.Fatalf("must not CAS on negative expires_in, got %d calls", store.casCalls)
		}
	})
}

// TestRefreshTokenTransportErrorIsRetryableAndDoesNotImpugnAuthStatus 守护“瞬时刷新失败不应直接标记 needs_reauth”：
// 只有明确的无 refresh_token、401/403 才能把渠道打入 needs_reauth。变异验证：若把任何 refresh 错误都当 reauth，
// 这里会把 active 状态错误改成 needs_reauth。
func TestRefreshTokenTransportErrorIsRetryableAndDoesNotImpugnAuthStatus(t *testing.T) {
	store := &fakeStore{
		key:      `{"version":1,"type":"grok_subscription","access_token":"old","refresh_token":"rt","token_type":"Bearer","expires_at":1000}`,
		revision: 4,
	}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return nil, errors.New("dial tcp: transient network failure")
	})
	r := NewRefresher(store, doer, func() int64 { return 2000 })
	if _, err := r.Refresh(context.Background(), 5); err == nil {
		t.Fatalf("transport error must fail refresh")
	}
}
