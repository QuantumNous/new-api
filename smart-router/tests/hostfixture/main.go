// hostfixture is a synthetic, test-only executable, never an operator service.
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"smart-router/api"
	"smart-router/internal/catalog"
	"smart-router/metrics"
	"smart-router/routing"
	"smart-router/store"
)

const syntheticKey = "0123456789abcdef0123456789abcdef"

type fixtureBinding struct {
	BindingID      string `json:"binding_id"`
	ChannelID      int    `json:"channel_id"`
	Group          string `json:"group"`
	Model          string `json:"model"`
	Protocol       string `json:"protocol"`
	ProtocolPlugin string `json:"protocol_plugin"`
}

type fixture struct {
	api     http.Handler
	reader  *sql.DB
	offset  atomic.Int64
	mu      sync.Mutex
	mode    string
	reports []api.AttemptOutcome
}

func main() {
	if err := run(); err != nil {
		// Never expose SQL errors, request bodies, environment or credentials.
		_, _ = io.WriteString(os.Stderr, "hostfixture failed\n")
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	private, err := os.MkdirTemp("", "smart-router-hostfixture-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(private)
	path := filepath.Join(private, "router.db")
	database, err := store.OpenSQLite(ctx, path)
	if err != nil {
		return err
	}
	defer database.Close()
	if err := database.UpsertSource(ctx, store.Source{ID: "synthetic-local", Connector: "ebond", Enabled: true}); err != nil {
		return err
	}
	bindings := make([]fixtureBinding, 0, 6)
	for i, protocol := range []api.Protocol{api.ProtocolChat, api.ProtocolResponses, api.ProtocolMessages} {
		for j := range 2 {
			id := "bnd_" + strings.Repeat(string(rune('A'+i*2+j)), 24)
			binding := fixtureBinding{BindingID: id, ChannelID: i*2 + j + 1, Group: "default",
				Model: "gpt-3.5-turbo", Protocol: string(protocol), ProtocolPlugin: string(protocol) + "-v1"}
			bindings = append(bindings, binding)
			if err := database.UpsertBinding(ctx, store.BindingRecord{
				ID: id, SourceID: "synthetic-local", Group: binding.Group, Model: binding.Model,
				Protocol: protocol, ProtocolPlugin: binding.ProtocolPlugin, Enabled: true, CostMicrounits: int64(10 + j*10),
			}); err != nil {
				return err
			}
			if err := database.SetObservation(ctx, id, store.Observation{
				Health: routing.HealthHealthy, Fingerprint: strings.Repeat("f", 64), ObservedAt: time.Now(),
			}); err != nil {
				return err
			}
		}
	}
	reader, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		return err
	}
	defer reader.Close()
	reader.SetMaxOpenConns(1)
	if err := reader.PingContext(ctx); err != nil {
		return err
	}
	f := &fixture{reader: reader, mode: "normal"}
	runtime := catalog.NewRuntime(catalog.RuntimeConfig{
		Store: database, SigningKey: []byte(syntheticKey),
		Now:         func() time.Time { return time.Now().Add(time.Duration(f.offset.Load()) * time.Millisecond) },
		SnapshotTTL: time.Minute, ConfigSHA256: strings.Repeat("a", 64), PluginManifestSHA256: strings.Repeat("b", 64),
	})
	f.api = api.NewServer(runtime, metrics.New())
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return err
	}
	defer listener.Close()
	server := &http.Server{
		Handler: f, ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 3 * time.Second,
		WriteTimeout: 3 * time.Second, IdleTimeout: 3 * time.Second,
	}
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
	defer server.Close()
	if err := json.NewEncoder(os.Stdout).Encode(struct {
		URL      string           `json:"url"`
		Bindings []fixtureBinding `json:"bindings"`
	}{URL: "http://" + listener.Addr().String(), Bindings: bindings}); err != nil {
		return err
	}
	select {
	case <-ctx.Done():
	case err := <-served:
		return err
	}
	shutdown, release := context.WithTimeout(context.Background(), 2*time.Second)
	defer release()
	if err := server.Shutdown(shutdown); err != nil {
		return err
	}
	select {
	case err := <-served:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-shutdown.Done():
		return shutdown.Err()
	}
	return nil
}

func (f *fixture) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Serialization also makes inspection a consistent view after a one-shot report.
	f.mu.Lock()
	defer f.mu.Unlock()
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	r = r.WithContext(ctx)
	switch r.URL.Path {
	case "/fixture/control":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var control struct {
			ReportMode    string `json:"report_mode"`
			ClockOffsetMS int64  `json:"clock_offset_ms"`
		}
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		err := decoder.Decode(&control)
		var extra any
		if err != nil || decoder.Decode(&extra) != io.EOF || control.ClockOffsetMS < -120_000 || control.ClockOffsetMS > 120_000 {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		switch control.ReportMode {
		case "normal", "rejected", "unknown_before", "unknown_after":
			f.mode = control.ReportMode
			f.offset.Store(control.ClockOffsetMS)
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, "{}\n")
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	case "/fixture/state":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		state, err := f.state(ctx)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(state)
	case "/v1/outcomes":
		body, err := io.ReadAll(r.Body)
		var outcome api.AttemptOutcome
		if r.Method != http.MethodPost || err != nil || api.DecodeStrict(bytes.NewReader(body), &outcome) != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if len(f.reports) >= 64 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		f.reports = append(f.reports, outcome)
		r.Body = io.NopCloser(bytes.NewReader(body))
		switch f.mode {
		case "rejected":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(api.ContractError{
				Kind: "error", SchemaVersion: 1, Code: api.ErrorSnapshotUnavailable, Retryable: true,
			})
		case "unknown_before", "unknown_after":
			if f.mode == "unknown_after" {
				// Persist through the real API, but deliberately lose its acknowledgement.
				captured := httptest.NewRecorder()
				f.api.ServeHTTP(captured, r)
				if captured.Code != http.StatusNoContent {
					w.WriteHeader(captured.Code)
					return
				}
			}
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				_ = conn.Close()
			}
		default:
			f.api.ServeHTTP(w, r)
		}
	default:
		f.api.ServeHTTP(w, r)
	}
}

func (f *fixture) state(ctx context.Context) (map[string]any, error) {
	type decision struct {
		RequestID        string   `json:"request_id"`
		Group            string   `json:"group"`
		Model            string   `json:"model"`
		Protocol         string   `json:"protocol"`
		SnapshotRevision string   `json:"snapshot_revision"`
		BindingIDs       []string `json:"binding_ids"`
	}
	type persistedOutcome struct {
		EventID       string             `json:"event_id"`
		PayloadSHA256 string             `json:"payload_sha256"`
		Payload       json.RawMessage    `json:"payload"`
		Outcome       api.AttemptOutcome `json:"outcome"`
	}
	rows, err := f.reader.QueryContext(ctx, `SELECT request_id, group_name, model_name, protocol,
		snapshot_revision, binding_ids_json FROM decisions ORDER BY decided_at_ns, request_id LIMIT 64`)
	if err != nil {
		return nil, err
	}
	decisions := []decision{}
	for rows.Next() {
		var item decision
		var raw []byte
		if err := rows.Scan(&item.RequestID, &item.Group, &item.Model, &item.Protocol, &item.SnapshotRevision, &raw); err != nil {
			_ = rows.Close()
			return nil, err
		}
		if err := json.Unmarshal(raw, &item.BindingIDs); err != nil {
			_ = rows.Close()
			return nil, err
		}
		decisions = append(decisions, item)
	}
	err = rows.Err()
	_ = rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = f.reader.QueryContext(ctx, `SELECT o.event_id, o.payload_sha256, o.payload_json FROM outcomes o
		JOIN decisions d ON json_extract(o.payload_json, '$.request_id') = d.request_id
		ORDER BY d.decided_at_ns, d.request_id, o.event_id LIMIT 64`)
	if err != nil {
		return nil, err
	}
	outcomes := []persistedOutcome{}
	for rows.Next() {
		var item persistedOutcome
		var raw []byte
		if err := rows.Scan(&item.EventID, &item.PayloadSHA256, &raw); err != nil {
			_ = rows.Close()
			return nil, err
		}
		item.Payload = json.RawMessage(raw)
		if err := json.Unmarshal(raw, &item.Outcome); err != nil {
			_ = rows.Close()
			return nil, err
		}
		outcomes = append(outcomes, item)
	}
	err = rows.Err()
	_ = rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = f.reader.QueryContext(ctx, `SELECT c.binding_id, c.until_ms, h.status
		FROM cooldowns c JOIN health_state h ON h.binding_id = c.binding_id ORDER BY c.binding_id LIMIT 6`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cooldowns, health := map[string]int64{}, map[string]string{}
	for rows.Next() {
		var id, status string
		var until int64
		if err := rows.Scan(&id, &until, &status); err != nil {
			return nil, err
		}
		cooldowns[id], health[id] = until, status
	}
	return map[string]any{
		"now_ms":    time.Now().Add(time.Duration(f.offset.Load()) * time.Millisecond).UnixMilli(),
		"decisions": decisions, "outcomes": outcomes, "reports": f.reports, "cooldowns": cooldowns, "health": health,
	}, rows.Err()
}
