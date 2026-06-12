package blockrun

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

func newImageGinCtx(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return c
}

func imageInfo(baseURL string) *relaycommon.RelayInfo {
	// ChannelBaseUrl is a promoted field from the embedded *ChannelMeta;
	// composite literals cannot set promoted fields, so build it explicitly.
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: baseURL},
	}
}

func fakeResp(status int, body string, header http.Header) *http.Response {
	if header == nil {
		header = http.Header{}
	}
	return &http.Response{
		StatusCode: status,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
	}
}

// shrinkPoll makes the poll loop test-fast and restores globals afterwards.
func shrinkPoll(t *testing.T, budget time.Duration) {
	t.Helper()
	oldI, oldB := imagePollInterval, imagePollBudget
	imagePollInterval, imagePollBudget = 5*time.Millisecond, budget
	t.Cleanup(func() { imagePollInterval, imagePollBudget = oldI, oldB })
}

func TestResolveImageResultPassthrough(t *testing.T) {
	c := newImageGinCtx(t)
	r, err := resolveImageResult(c, imageInfo("http://x"), fakeResp(200, `{"data":[{"url":"u"}]}`, nil), "")
	if err != nil || r.StatusCode != 200 {
		t.Fatalf("200 passthrough broken: %v %v", r, err)
	}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions}
	r, err = resolveImageResult(c, info, fakeResp(202, `{}`, nil), "")
	if err != nil || r.StatusCode != 202 {
		t.Fatalf("chat 202 must stay 202: %v %v", r, err)
	}
	// 5xx in image mode passes through untouched — only 202 is special-cased.
	r, err = resolveImageResult(c, imageInfo("http://x"), fakeResp(500, `oops`, nil), "")
	if err != nil || r.StatusCode != 500 {
		t.Fatalf("image 500 must stay 500: %v %v", r, err)
	}
}

func TestResolveImageResult202WithData(t *testing.T) {
	c := newImageGinCtx(t)
	r, err := resolveImageResult(c, imageInfo("http://x"), fakeResp(202, `{"created":1,"data":[{"url":"http://img/u.png"}]}`, nil), "")
	if err != nil {
		t.Fatal(err)
	}
	if r.StatusCode != 200 {
		t.Fatalf("202+data must normalize to 200, got %d", r.StatusCode)
	}
	b, _ := io.ReadAll(r.Body)
	if !bytes.Contains(b, []byte("u.png")) {
		t.Fatalf("body lost: %s", b)
	}
}

func TestPollLifecycleQueuedInProgressCompleted(t *testing.T) {
	shrinkPoll(t, 2*time.Second)
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("Payment-Signature") != "sig-1" || req.Header.Get("X-Payment") != "sig-1" {
			t.Errorf("poll must carry the reused signature on both headers")
		}
		switch n.Add(1) {
		case 1:
			w.WriteHeader(202)
			_, _ = w.Write([]byte(`{"status":"queued"}`))
		case 2:
			w.WriteHeader(202)
			_, _ = w.Write([]byte(`{"status":"in_progress"}`))
		default:
			w.Header().Set("X-Payment-Receipt", "0xtx")
			w.WriteHeader(200)
			_, _ = w.Write([]byte(`{"created":2,"data":[{"url":"http://img/done.png"}]}`))
		}
	}))
	defer srv.Close()

	c := newImageGinCtx(t)
	envelope := `{"object":"image.generation.job","status":"queued","poll_url":"` + srv.URL + `/poll/1","price":{"amount":"0.063000","currency":"USD"}}`
	r, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, envelope, nil), "sig-1")
	if err != nil {
		t.Fatal(err)
	}
	if r.StatusCode != 200 {
		t.Fatalf("want 200 got %d", r.StatusCode)
	}
	b, _ := io.ReadAll(r.Body)
	if !bytes.Contains(b, []byte("done.png")) {
		t.Fatalf("missing image: %s", b)
	}
	v, ok := c.Get("blockrun_settlement")
	if !ok {
		t.Fatal("settlement not captured")
	}
	m := v.(map[string]interface{})
	if m["upstream_price_usd"] != "0.063000" || m["upstream_tx_hash"] != "0xtx" {
		t.Fatalf("settlement wrong: %v", m)
	}
}

func TestPollRelativePollURL(t *testing.T) {
	shrinkPoll(t, time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/api/v1/images/generations/abc" {
			t.Errorf("relative poll_url resolved wrong: %s", req.URL.Path)
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"data":[{"b64_json":"aGk="}]}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	envelope := `{"poll_url":"/api/v1/images/generations/abc"}`
	r, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, envelope, nil), "s")
	if err != nil || r.StatusCode != 200 {
		t.Fatalf("relative poll failed: %v %v", r, err)
	}
}

func TestPoll504ThenCompleted(t *testing.T) {
	shrinkPoll(t, 2*time.Second)
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if n.Add(1) == 1 {
			w.WriteHeader(504)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"data":[{"url":"http://img/ok.png"}]}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	r, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err != nil || r.StatusCode != 200 {
		t.Fatalf("504 must be transient: %v %v", r, err)
	}
}

func TestPoll402IsHardError(t *testing.T) {
	shrinkPoll(t, time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(402)
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	_, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err == nil {
		t.Fatal("402 on poll must be a hard error (no re-sign)")
	}
}

func TestPollFailedStatus(t *testing.T) {
	shrinkPoll(t, time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"status":"failed"}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	_, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err == nil {
		t.Fatal("failed job must error")
	}
}

func TestPollTimeout(t *testing.T) {
	shrinkPoll(t, 30*time.Millisecond)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(202)
		_, _ = w.Write([]byte(`{"status":"queued"}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	_, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err == nil {
		t.Fatal("budget exhaustion must error")
	}
	// Both exhaustion exits (loop check and born-expired per-round context)
	// must surface the budget message, not a bare context error.
	if !strings.Contains(err.Error(), "image not ready after") {
		t.Fatalf("timeout must report the poll budget, got: %v", err)
	}
}

func TestPollCompletedWithoutData(t *testing.T) {
	shrinkPoll(t, time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"created":3,"data":[]}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	_, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err == nil {
		t.Fatal("completed without data must error")
	}
}

func TestPollMultiImageCompleted(t *testing.T) {
	shrinkPoll(t, time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"created":4,"data":[{"url":"http://img/1.png"},{"url":"http://img/2.png"}]}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	r, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(r.Body)
	if !bytes.Contains(b, []byte("1.png")) || !bytes.Contains(b, []byte("2.png")) {
		t.Fatalf("n>1 images lost: %s", b)
	}
}

func TestPollEnvelopeNumericPriceAmount(t *testing.T) {
	shrinkPoll(t, 2*time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"created":5,"data":[{"url":"http://img/np.png"}]}`))
	}))
	defer srv.Close()
	c := newImageGinCtx(t)
	// price.amount drifted from string to JSON number — the async path must
	// still reach the poll loop and normalize the amount for settlement.
	envelope := `{"status":"queued","poll_url":"` + srv.URL + `/p","price":{"amount":0.063,"currency":"USD"}}`
	r, err := resolveImageResult(c, imageInfo(srv.URL), fakeResp(202, envelope, nil), "s")
	if err != nil {
		t.Fatal(err)
	}
	if r.StatusCode != 200 {
		t.Fatalf("numeric price.amount broke async path: %d", r.StatusCode)
	}
	b, _ := io.ReadAll(r.Body)
	if !bytes.Contains(b, []byte("np.png")) {
		t.Fatalf("missing image: %s", b)
	}
	v, ok := c.Get("blockrun_settlement")
	if !ok {
		t.Fatal("settlement not captured")
	}
	m := v.(map[string]interface{})
	if m["upstream_price_usd"] != "0.063" {
		t.Fatalf("numeric amount normalized wrong: %v", m)
	}
	if m["upstream_price_currency"] != "USD" {
		t.Fatalf("currency lost: %v", m)
	}
}
