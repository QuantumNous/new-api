package billing

import (
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// airbotixJRReceiver is a small consumer-side fixture that behaves like an
// Airbotix/JR backend endpoint: verify the raw-body HMAC before parsing, then
// use request_id as the ledger idempotency key.
type airbotixJRReceiver struct {
	secret []byte

	mu            sync.Mutex
	processed     map[string]Event
	ledgerWrites  int
	duplicateHits int
}

func newAirbotixJRReceiver(t *testing.T, secret []byte) *airbotixJRReceiver {
	t.Helper()
	return &airbotixJRReceiver{
		secret:    secret,
		processed: make(map[string]Event),
	}
}

func (r *airbotixJRReceiver) handler(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if got := req.Header.Get("X-DeepRouter-Event"); got != "request.completed" {
		http.Error(w, "unexpected event", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}

	expected := SignPayload(body, r.secret)
	if !hmacSignatureEqual(req.Header.Get("X-DeepRouter-Signature"), expected) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var ev Event
	if err := json.Unmarshal(body, &ev); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if ev.RequestID == "" {
		http.Error(w, "missing request_id", http.StatusBadRequest)
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.processed[ev.RequestID]; exists {
		r.duplicateHits++
		w.WriteHeader(http.StatusOK)
		return
	}

	r.processed[ev.RequestID] = ev
	r.ledgerWrites++
	w.WriteHeader(http.StatusOK)
}

func hmacSignatureEqual(got, want string) bool {
	return hmac.Equal([]byte(got), []byte(want))
}

func TestDispatcher_AirbotixJRConsumerVerifiesSignatureAndDeduplicates(t *testing.T) {
	secret := []byte("whsec_airbotix_jr_fixture")
	receiver := newAirbotixJRReceiver(t, secret)
	server := httptest.NewServer(http.HandlerFunc(receiver.handler))
	defer server.Close()

	event := minimalEvent("req-airbotix-jr-001")
	event.TenantID = "airbotix-kids"
	event.KidProfileID = "kid_profile_42"
	event.Provider = "anthropic"
	event.Model = "claude-3-5-haiku"
	event.RoutedFrom = "deeprouter-auto"
	event.CostUSD = 0.00084

	dispatcher := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 0,
	}

	status, err := dispatcher.Send(server.URL, secret, event)
	if err != nil {
		t.Fatalf("first delivery failed: status=%d err=%v", status, err)
	}
	if status != http.StatusOK {
		t.Fatalf("first delivery status: got %d, want 200", status)
	}

	status, err = dispatcher.Send(server.URL, secret, event)
	if err != nil {
		t.Fatalf("replay delivery should be acknowledged idempotently: status=%d err=%v", status, err)
	}
	if status != http.StatusOK {
		t.Fatalf("replay delivery status: got %d, want 200", status)
	}

	receiver.mu.Lock()
	defer receiver.mu.Unlock()

	if receiver.ledgerWrites != 1 {
		t.Fatalf("request_id must be the idempotency key: ledgerWrites=%d, want 1", receiver.ledgerWrites)
	}
	if receiver.duplicateHits != 1 {
		t.Fatalf("expected one duplicate replay hit, got %d", receiver.duplicateHits)
	}

	got := receiver.processed[event.RequestID]
	if got.TenantID != "airbotix-kids" {
		t.Errorf("tenant_id: got %q, want %q", got.TenantID, "airbotix-kids")
	}
	if got.KidProfileID != "kid_profile_42" {
		t.Errorf("kid_profile_id: got %q, want %q", got.KidProfileID, "kid_profile_42")
	}
	if got.RoutedFrom != "deeprouter-auto" {
		t.Errorf("routed_from: got %q, want %q", got.RoutedFrom, "deeprouter-auto")
	}
}

func TestAirbotixJRConsumerRejectsInvalidSignature(t *testing.T) {
	receiver := newAirbotixJRReceiver(t, []byte("correct_webhook_secret"))
	server := httptest.NewServer(http.HandlerFunc(receiver.handler))
	defer server.Close()

	dispatcher := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 0,
	}

	status, err := dispatcher.Send(server.URL, []byte("wrong_webhook_secret"), minimalEvent("req-bad-sig"))
	if err == nil {
		t.Fatal("expected invalid signature to be rejected")
	}
	if status != http.StatusUnauthorized {
		t.Fatalf("status: got %d, want 401", status)
	}

	receiver.mu.Lock()
	defer receiver.mu.Unlock()
	if receiver.ledgerWrites != 0 {
		t.Fatalf("invalid signatures must not create ledger writes, got %d", receiver.ledgerWrites)
	}
}

func TestAirbotixJRReceiver_ConcurrentSameRequestID(t *testing.T) {
	secret := []byte("whsec_airbotix_jr_concurrent")
	receiver := newAirbotixJRReceiver(t, secret)
	server := httptest.NewServer(http.HandlerFunc(receiver.handler))
	defer server.Close()

	event := minimalEvent("req-airbotix-jr-concurrent")
	dispatcher := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 0,
	}

	const workers = 2
	start := make(chan struct{})
	var wg sync.WaitGroup
	errs := make(chan error, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			status, err := dispatcher.Send(server.URL, secret, event)
			if err != nil {
				errs <- err
				return
			}
			if status != http.StatusOK {
				errs <- fmt.Errorf("unexpected status %d", status)
			}
		}()
	}

	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent delivery failed: %v", err)
		}
	}

	receiver.mu.Lock()
	defer receiver.mu.Unlock()
	if receiver.ledgerWrites != 1 {
		t.Fatalf("concurrent duplicate request_id must write ledger once, got %d", receiver.ledgerWrites)
	}
	if receiver.duplicateHits != workers-1 {
		t.Fatalf("duplicateHits: got %d, want %d", receiver.duplicateHits, workers-1)
	}
}
