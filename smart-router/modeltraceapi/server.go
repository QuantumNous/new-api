package modeltraceapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"smart-router/api"
	"smart-router/modeltrace"
)

type Options struct {
	Backend Backend
	Key     []byte
	Now     func() time.Time
	Health  Health
}

type Health struct {
	Status                  string `json:"status"`
	StartupBankRevision     string `json:"startup_bank_revision,omitempty"`
	RuntimeManifestRevision string `json:"runtime_manifest_revision,omitempty"`
	WorkerPayloadSHA256     string `json:"worker_payload_sha256,omitempty"`
	PublicConfigSHA256      string `json:"public_config_sha256,omitempty"`
}

type Server struct {
	options Options
	auth    *Auth
	mu      sync.Mutex
	stopped bool
	active  int
	idle    chan struct{}
	ctx     context.Context
	cancel  context.CancelFunc
}

func NewServer(options Options) (*Server, error) {
	if options.Backend == nil {
		return nil, modeltrace.ErrProcessConfiguration
	}
	auth, err := NewAuth(options.Key, options.Now, 4096)
	if err != nil {
		return nil, err
	}
	options.Health.Status = "ok"
	for _, digest := range []string{options.Health.StartupBankRevision, options.Health.RuntimeManifestRevision,
		options.Health.WorkerPayloadSHA256, options.Health.PublicConfigSHA256} {
		if digest != "" && !digestPattern.MatchString(digest) {
			return nil, modeltrace.ErrProcessConfiguration
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &Server{options: options, auth: auth, idle: make(chan struct{}), ctx: ctx, cancel: cancel}, nil
}

// StopAdmission is independent of the listener, so even direct handler use is closed.
func (s *Server) StopAdmission() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.stopped {
		s.stopped = true
		if s.active == 0 {
			close(s.idle)
		}
	}
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.StopAdmission()
	select {
	case <-s.idle:
		s.cancel()
		return nil
	case <-ctx.Done():
		s.cancel()
	}
	// Service terminal persistence and ProcessEngine child reap precede handler return.
	timer := time.NewTimer(6 * time.Second)
	defer timer.Stop()
	select {
	case <-s.idle:
		return nil
	case <-timer.C:
		return modeltrace.ErrProcessFailed
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	s.mu.Lock()
	if s.stopped {
		s.mu.Unlock()
		writeError(w, http.StatusServiceUnavailable, "unavailable")
		return
	}
	s.active++
	s.mu.Unlock()
	ctx, cancel := context.WithCancel(r.Context())
	stop := context.AfterFunc(s.ctx, cancel)
	defer func() {
		stop()
		cancel()
		s.mu.Lock()
		defer s.mu.Unlock()
		s.active--
		if s.stopped && s.active == 0 {
			close(s.idle)
		}
	}()
	r = r.WithContext(ctx)
	if r.URL.Path == "/healthz" {
		if r.Method != http.MethodGet || r.URL.RawQuery != "" {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		data, _ := json.Marshal(s.options.Health)
		_, _ = w.Write(data)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, MaxBodyBytes+1))
	if len(body) > MaxBodyBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := s.auth.Authenticate(r, body); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var record modeltrace.Record
	switch {
	case r.URL.Path == "/v1/modeltrace/probes":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		evidence, decodeErr := DecodeEvidence(body)
		if decodeErr != nil || r.URL.RawQuery != "" {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
		record, err = s.options.Backend.Submit(r.Context(), evidence)
	case strings.HasPrefix(r.URL.Path, "/v1/modeltrace/probes/"):
		id := strings.TrimPrefix(r.URL.Path, "/v1/modeltrace/probes/")
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		if !opaqueID.MatchString(id) || r.URL.RawQuery != "" {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
		record, err = s.options.Backend.GetProbe(r.Context(), id)
	case strings.HasPrefix(r.URL.Path, "/v1/modeltrace/bindings/"):
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/v1/modeltrace/bindings/")
		query, queryErr := url.ParseQuery(r.URL.RawQuery)
		models, protocols := query["model"], query["protocol"]
		if queryErr != nil || len(query) != 2 || len(models) != 1 || len(protocols) != 1 || api.ValidateBindingID(id) != nil {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
		protocol := api.Protocol(protocols[0])
		identity := modeltrace.Evidence{
			SchemaVersion: 1, ProbeID: "identity", BindingID: id, ClaimedModel: models[0], Protocol: protocol,
			BankRevision: strings.Repeat("0", 64),
			Samples:      []modeltrace.Sample{{ChallengeID: "identity", ExpectedCount: 80, Numbers: make([]int, 80)}},
		}
		for i := range identity.Samples[0].Numbers {
			identity.Samples[0].Numbers[i] = 1
		}
		if identity.Validate() != nil {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
		record, err = s.options.Backend.LatestAttribution(r.Context(), id, models[0], protocol)
	default:
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	if err != nil {
		switch {
		case errors.Is(err, modeltrace.ErrProbeConflict), errors.Is(err, modeltrace.ErrBindingMismatch):
			writeError(w, http.StatusConflict, "conflict")
		case errors.Is(err, modeltrace.ErrProbeNotFound), errors.Is(err, modeltrace.ErrBindingMissing):
			writeError(w, http.StatusNotFound, "not_found")
		case errors.Is(err, modeltrace.ErrInvalidEvidence):
			writeError(w, http.StatusBadRequest, "invalid_request")
		case errors.Is(err, modeltrace.ErrProbeExecution):
			writeError(w, http.StatusInternalServerError, "execution_failed")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error")
		}
		return
	}
	data, err := EncodeRecord(record)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	_, _ = w.Write(data)
}

func writeError(w http.ResponseWriter, status int, code string) {
	w.WriteHeader(status)
	data, _ := json.Marshal(struct {
		Error string `json:"error"`
	}{code})
	_, _ = w.Write(data)
}
