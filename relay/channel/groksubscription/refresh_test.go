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
