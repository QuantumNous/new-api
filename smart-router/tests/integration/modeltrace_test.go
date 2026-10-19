package integration_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"smart-router/api"
	"smart-router/config"
	"smart-router/internal/catalog"
	"smart-router/modeltrace"
	"smart-router/modeltraceapi"
	"smart-router/signing"
	"smart-router/store"
)

const modelTraceBinding = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"

type modelTraceBackend struct {
	modeltrace.Service
	*store.DB
}

func provisionModelTraceFixture(t *testing.T, database *store.DB) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, database.UpsertSource(ctx, store.Source{
		ID: "synthetic-source", Connector: "ebond", Enabled: true,
	}))
	for i, id := range []string{modelTraceBinding, "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"} {
		require.NoError(t, database.UpsertBinding(ctx, store.BindingRecord{
			ID: id, SourceID: "synthetic-source", Group: "default", Model: "GPT-4o",
			Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1", Enabled: true,
			CostMicrounits: int64(10 + i*10),
		}))
	}
	require.NoError(t, database.UpsertBinding(ctx, store.BindingRecord{
		ID: "bnd_CCCCCCCCCCCCCCCCCCCCCCCC", SourceID: "synthetic-source",
		Group: "default", Model: "GPT-4o", Protocol: api.ProtocolMessages,
		ProtocolPlugin: "messages-v1", Enabled: true, CostMicrounits: 10,
	}))
}

func TestModelTraceShadowFlowPreservesSignedRoutes(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	require.NoError(t, os.Chmod(root, 0700))
	routerPath := filepath.Join(root, "router.db")
	routerDB, err := store.OpenSQLite(ctx, routerPath)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, routerDB.Close()) })
	provisionModelTraceFixture(t, routerDB)
	tracePath := filepath.Join(root, "attribution.db")
	traceDB, err := store.OpenSQLite(ctx, tracePath)
	require.NoError(t, err)
	provisionModelTraceFixture(t, traceDB)
	require.NoError(t, traceDB.Close())
	require.NoError(t, os.Chmod(tracePath, 0600))
	now := time.Unix(1700000000, 0).UTC()
	runtime := catalog.NewRuntime(catalog.RuntimeConfig{
		Store: routerDB, SigningKey: []byte(strings.Repeat("r", 32)),
		Now: func() time.Time { return now }, SnapshotTTL: time.Minute,
		ConfigSHA256: strings.Repeat("a", 64), PluginManifestSHA256: strings.Repeat("b", 64),
	})
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "shadow-route",
		Group: "default", Model: "GPT-4o", Protocol: api.ProtocolChat, AttemptLimit: 2,
	}
	route, err := runtime.Route(ctx, request)
	require.NoError(t, err)
	snapshot, err := runtime.Snapshot(ctx)
	require.NoError(t, err)
	require.NoError(t, signing.Verify(route, []byte(strings.Repeat("r", 32)), route.Signature))
	require.NoError(t, signing.Verify(snapshot, []byte(strings.Repeat("r", 32)), snapshot.Signature))
	assert.Equal(t, modelTraceBinding, route.Bindings[0].BindingID)
	routerBefore, err := os.ReadFile(routerPath)
	require.NoError(t, err)
	results := runModelTraceShadowFlow(t, tracePath, root)
	routerAfter, err := os.ReadFile(routerPath)
	require.NoError(t, err)
	assert.Equal(t, routerBefore, routerAfter, "numeric shadow must not change any original routing state bytes")
	traceDB, err = store.OpenSQLite(ctx, tracePath)
	require.NoError(t, err)
	defer traceDB.Close()
	handler, err := modeltraceapi.NewServer(modeltraceapi.Options{
		Backend: modelTraceBackend{modeltrace.Service{Repository: traceDB}, traceDB},
		Key:     []byte("synthetic-f-independent-numeric-ingest-000"),
	})
	require.NoError(t, err)
	defer func() {
		drain, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		require.NoError(t, handler.Shutdown(drain))
	}()
	for _, expected := range results {
		record, err := traceDB.GetProbe(ctx, expected.ProbeID)
		require.NoError(t, err, "operator-to-signed-daemon shadow flow must persist a durable probe")
		wire, err := modeltraceapi.EncodeRecord(record)
		require.NoError(t, err)
		expectedWire, err := json.Marshal(expected)
		require.NoError(t, err)
		assert.JSONEq(t, string(expectedWire), string(wire))
		for _, path := range []string{
			"/v1/modeltrace/probes/" + expected.ProbeID,
			"/v1/modeltrace/bindings/" + expected.BindingID + "?model=GPT-4o&protocol=" + string(expected.Protocol),
		} {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			require.NoError(t, modeltraceapi.Sign(request, nil,
				[]byte("synthetic-f-independent-numeric-ingest-000"), time.Now(), ""))
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)
			reopened, err := modeltraceapi.DecodeRecord(response.Body.Bytes())
			require.NoError(t, err)
			if strings.Contains(path, "/bindings/") {
				assert.Equal(t, strings.Split(expected.ProbeID, "-")[0]+"-partial", reopened.ProbeID)
			} else {
				assert.Equal(t, expected, reopened)
			}
		}
	}
	request.RequestID = "shadow-route-after"
	after, err := runtime.Route(ctx, request)
	require.NoError(t, err)
	assert.Equal(t, route.Bindings, after.Bindings)
	assert.Equal(t, route.SnapshotRevision, after.SnapshotRevision)
	assert.Equal(t, route.ExpiresAt, after.ExpiresAt)
	after.RequestID = route.RequestID
	after.Signature, err = signing.Sign(after, []byte(strings.Repeat("r", 32)))
	require.NoError(t, err)
	routeBytes, err := json.Marshal(route)
	require.NoError(t, err)
	afterBytes, err := json.Marshal(after)
	require.NoError(t, err)
	assert.Equal(t, routeBytes, afterBytes)
	afterSnapshot, err := runtime.Snapshot(ctx)
	require.NoError(t, err)
	assert.Equal(t, snapshot, afterSnapshot)
}

func runModelTraceShadowFlow(t *testing.T, tracePath, root string) []modeltraceapi.Record {
	t.Helper()
	moduleRoot, err := filepath.Abs("../..")
	require.NoError(t, err)
	python := os.Getenv("MODELTRACE_TEST_PYTHON")
	if python == "" {
		python = "/Users/bytedance/.local/share/mise/installs/python/3.14.7/bin/python3.14"
	}
	binary := filepath.Join(root, "modeltraced")
	buildCtx, cancelBuild := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancelBuild()
	build := exec.CommandContext(buildCtx,
		"/Users/bytedance/.local/share/mise/installs/go/1.26.5/bin/go", "build",
		"-p", "2", "-trimpath", "-ldflags="+
			"-X main.releasePythonSHA256=ab15cbe78b02b5fc939765827e0b1c2dc3668def22c6952f06a369bfbde01163 "+
			"-X main.releaseRuntimeSHA256=d86ea47a18a9c6088e2dad96c6a7761c3551048b128531a2717d036640dd188b "+
			"-X main.releaseVendorSHA256=a05e5ab39f1056a0a0234d5e033d1dc3bc1cc259b90c68df460debec38794714",
		"-o", binary, "./cmd/modeltraced")
	build.Dir = moduleRoot
	buildOutput, err := build.CombinedOutput()
	require.NoError(t, err, "actual daemon build: %s", buildOutput)
	payload, err := os.ReadFile(binary)
	require.NoError(t, err)
	t.Logf("actual daemon binary sha256=%x build argv=%q", sha256.Sum256(payload), build.Args)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	address := listener.Addr().String()
	require.NoError(t, listener.Close())
	daemonChild := exec.Command(binary)
	daemonChild.Dir = moduleRoot
	daemonChild.Env = []string{
		"PATH=/usr/bin:/bin", "SMART_ROUTER_MODELTRACE_ENABLED=true",
		"SMART_ROUTER_MODELTRACE_LISTEN=" + address,
		"SMART_ROUTER_MODELTRACE_DATABASE=" + tracePath,
		"SMART_ROUTER_MODELTRACE_PYTHON=" + python,
		"SMART_ROUTER_MODELTRACE_WORKER=" + filepath.Join(moduleRoot, "modeltrace_runtime/worker.py"),
		"SMART_ROUTER_MODELTRACE_RUNTIME_MANIFEST=" + filepath.Join(moduleRoot, "modeltrace_runtime/RUNTIME-MANIFEST.json"),
		"SMART_ROUTER_MODELTRACE_VENDOR_MANIFEST=" + filepath.Join(moduleRoot, "third_party/modeltrace/PROVENANCE.json"),
		"SMART_ROUTER_MODELTRACE_BANK=" + filepath.Join(moduleRoot, "third_party/modeltrace/data/unified_bank.json"),
		"SMART_ROUTER_MODELTRACE_INGEST_KEY=synthetic-f-independent-numeric-ingest-000",
	}
	values := make(map[string]string)
	for _, item := range daemonChild.Env {
		key, value, _ := strings.Cut(item, "=")
		values[key] = value
	}
	_, err = config.LoadModelTrace(func(key string) string { return values[key] }, config.ModelTracePins{
		PythonSHA256:          "ab15cbe78b02b5fc939765827e0b1c2dc3668def22c6952f06a369bfbde01163",
		RuntimeManifestSHA256: "d86ea47a18a9c6088e2dad96c6a7761c3551048b128531a2717d036640dd188b",
		VendorManifestSHA256:  "a05e5ab39f1056a0a0234d5e033d1dc3bc1cc259b90c68df460debec38794714",
	})
	require.NoError(t, err, "actual daemon fixture satisfies reviewed startup validation")
	var daemonStdout, daemonStderr bytes.Buffer
	daemonChild.Stdout, daemonChild.Stderr = &daemonStdout, &daemonStderr
	require.NoError(t, daemonChild.Start())
	done := make(chan error, 1)
	go func() { done <- daemonChild.Wait() }()
	defer func() {
		_ = daemonChild.Process.Signal(syscall.SIGTERM)
		select {
		case err := <-done:
			assert.NoError(t, err)
		case <-time.After(25 * time.Second):
			_ = daemonChild.Process.Kill()
			<-done
			t.Error("daemon shutdown exceeded bound")
		}
		assert.Empty(t, daemonStdout.String())
		assert.Empty(t, daemonStderr.String())
	}()
	transport := &http.Transport{Proxy: nil, DisableKeepAlives: true}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: time.Second}
	deadline := time.Now().Add(20 * time.Second)
	ready := false
	for time.Now().Before(deadline) {
		response, err := client.Get("http://" + address + "/healthz")
		if err == nil {
			_, _ = io.Copy(io.Discard, response.Body)
			response.Body.Close()
			ready = response.StatusCode == http.StatusOK
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	require.True(t, ready, "actual daemon readiness")
	client.Timeout = 20 * time.Second
	daemon := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, readErr := io.ReadAll(io.LimitReader(r.Body, modeltraceapi.MaxBodyBytes+1))
		require.NoError(t, readErr)
		for _, sentinel := range []string{"synthetic-f-provider-key-sentinel", "synthetic-f-provider-body-sentinel"} {
			assert.NotContains(t, string(body), sentinel)
		}
		forward, err := http.NewRequestWithContext(r.Context(), r.Method,
			"http://"+address+r.URL.RequestURI(), bytes.NewReader(body))
		require.NoError(t, err)
		forward.Header = r.Header.Clone()
		response, err := client.Do(forward)
		require.NoError(t, err)
		defer response.Body.Close()
		w.WriteHeader(response.StatusCode)
		_, err = io.Copy(w, response.Body)
		require.NoError(t, err)
	}))
	defer daemon.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	child := exec.CommandContext(ctx, python, "-B", "-m",
		"modeltrace_runtime.tests.test_end_to_end", "--flow", "--state", root,
		"--daemon", daemon.URL)
	child.Dir = moduleRoot
	child.Env = []string{
		"PATH=/usr/bin:/bin", "LANG=C", "PYTHONNOUSERSITE=1",
		"PYTHONDONTWRITEBYTECODE=1", "OPENBLAS_NUM_THREADS=1", "TMPDIR=" + root,
	}
	var stdout, stderr bytes.Buffer
	child.Stdout, child.Stderr = &stdout, &stderr
	child.WaitDelay = time.Second
	require.NoError(t, child.Run(), "bounded operator flow failed: %s", stderr.String())
	assert.Empty(t, stderr.String())
	var result struct {
		Records       []modeltraceapi.Record `json:"records"`
		ProviderCalls int                    `json:"provider_calls"`
	}
	require.NoError(t, json.Unmarshal(stdout.Bytes(), &result))
	assert.Equal(t, 12, result.ProviderCalls)
	require.Len(t, result.Records, 4)
	for _, record := range result.Records {
		assert.Equal(t, modeltrace.StateSucceeded, record.State)
	}
	require.NoError(t, filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		assert.False(t, strings.HasPrefix(entry.Name(), "modeltrace-run-"), "worker snapshot must be removed")
		if !entry.IsDir() && path != binary {
			data, err := os.ReadFile(path)
			require.NoError(t, err)
			for _, sentinel := range []string{"synthetic-f-provider-key-sentinel", "synthetic-f-provider-body-sentinel"} {
				assert.NotContains(t, string(data), sentinel)
			}
		}
		return nil
	}))
	return result.Records
}
