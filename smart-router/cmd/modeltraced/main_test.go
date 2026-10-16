package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/unix"
	"smart-router/api"
	"smart-router/config"
	"smart-router/modeltrace"
	"smart-router/modeltraceapi"
	"smart-router/store"
)

const ownedTestRoot = "/Users/bytedance/.local/share/modeltrace-evidence-20261013/task5-implementation/tmp"
const pinnedPython = "/Users/bytedance/.local/share/mise/installs/python/3.14.7/bin/python3.14"

var daemonKey = []byte("synthetic-daemon-ingest-key-at-least-32")

func daemonHash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func daemonPut(t *testing.T, path string, data []byte) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0700))
	require.NoError(t, os.WriteFile(path, data, 0600))
}

func daemonJSON(t *testing.T, path string, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	require.NoError(t, err)
	daemonPut(t, path, data)
	return data
}

func daemonFixture(t *testing.T, blocking bool) (config.ModelTraceConfig, modeltrace.Evidence, string) {
	t.Helper()
	root, err := os.MkdirTemp(ownedTestRoot, "daemon-d-")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, os.RemoveAll(root)) })
	marker := filepath.Join(root, "owned-pid")
	runtime := filepath.Join(root, "runtime")
	body := "import json,sys,os,time\nr=json.load(sys.stdin)\n"
	if blocking {
		body += "open(" + strconv.Quote(marker) + ",'w').write(str(os.getpid()))\nend=time.monotonic()+15\nwhile not os.path.exists(" +
			strconv.Quote(marker+".release") + ") and time.monotonic()<end: time.sleep(.01)\n"
	}
	body += "print(json.dumps({'schema_version':1,'bank_revision':r['bank_revision'],'prediction':'candidate','probability':1,'used_outputs':1,'complete':False,'closed_set':True,'results':[{'model':'candidate','family':'family','probability':1,'score':0,'profile_similarity':0}],'family_probabilities':[{'family':'family','probability':1}]}))\n"
	files := map[string]string{}
	for _, name := range []string{"worker.py", "engine.py", "__init__.py", "bank_validation.py"} {
		data := []byte("")
		if name == "worker.py" {
			data = []byte(body)
		}
		daemonPut(t, filepath.Join(runtime, name), data)
		files[name] = daemonHash(data)
	}
	runtimeManifest := filepath.Join(runtime, "RUNTIME-MANIFEST.json")
	runtimeData := daemonJSON(t, runtimeManifest, map[string]any{"schema_version": 1, "files": files})
	vendor := filepath.Join(root, "vendor")
	vendorFiles := map[string]string{}
	for _, name := range []string{"fingerprint.py", "LICENSE", "data/unified_bank.json"} {
		daemonPut(t, filepath.Join(vendor, name), []byte("{}"))
		vendorFiles[name] = daemonHash([]byte("{}"))
	}
	vendorManifest := filepath.Join(vendor, "PROVENANCE.json")
	vendorData := daemonJSON(t, vendorManifest, map[string]any{"schema_version": 1, "files": vendorFiles,
		"source": map[string]string{"url": "https://github.com/xqy2006/ModelTrace.git",
			"commit": "6cd4a8ff0f3f4e49d6d6969dd2fbadfa1569fde2"}})
	python, err := os.ReadFile(pinnedPython)
	require.NoError(t, err)
	values := map[string]string{
		"SMART_ROUTER_MODELTRACE_ENABLED": "true", "SMART_ROUTER_MODELTRACE_DATABASE": filepath.Join(root, "private.db"),
		"SMART_ROUTER_MODELTRACE_PYTHON": pinnedPython, "SMART_ROUTER_MODELTRACE_WORKER": filepath.Join(runtime, "worker.py"),
		"SMART_ROUTER_MODELTRACE_RUNTIME_MANIFEST": runtimeManifest, "SMART_ROUTER_MODELTRACE_VENDOR_MANIFEST": vendorManifest,
		"SMART_ROUTER_MODELTRACE_BANK": filepath.Join(vendor, "data/unified_bank.json"), "SMART_ROUTER_MODELTRACE_INGEST_KEY": string(daemonKey),
	}
	c, err := config.LoadModelTrace(func(key string) string { return values[key] }, config.ModelTracePins{
		PythonSHA256: daemonHash(python), RuntimeManifestSHA256: daemonHash(runtimeData), VendorManifestSHA256: daemonHash(vendorData)})
	require.NoError(t, err)
	e := modeltrace.Evidence{SchemaVersion: 1, ProbeID: "probe-daemon", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		ClaimedModel: "candidate", Protocol: api.ProtocolChat, BankRevision: c.Process.BankRevision,
		Samples: []modeltrace.Sample{{ChallengeID: "challenge", ExpectedCount: 80, Numbers: make([]int, 80)}}}
	for i := range e.Samples[0].Numbers {
		e.Samples[0].Numbers[i] = i + 1
	}
	require.NoError(t, e.Validate())
	return c, e, marker
}

func daemonSeed(t *testing.T, c config.ModelTraceConfig, e modeltrace.Evidence, running bool) {
	t.Helper()
	daemonPut(t, c.DatabasePath, nil)
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	require.NoError(t, db.UpsertSource(context.Background(), store.Source{ID: "synthetic-source", Connector: "fixture", Enabled: true}))
	require.NoError(t, db.UpsertBinding(context.Background(), store.BindingRecord{ID: e.BindingID, SourceID: "synthetic-source",
		Group: "synthetic-group", Model: e.ClaimedModel, Protocol: e.Protocol, Enabled: true}))
	if running {
		digest, err := e.Digest()
		require.NoError(t, err)
		_, created, err := db.BeginProbe(context.Background(), e, digest, time.Now().Add(-time.Second))
		require.NoError(t, err)
		require.True(t, created)
	}
	require.NoError(t, db.Close())
}

func daemonRequest(t *testing.T, client *http.Client, method, target string, body []byte) (*http.Response, []byte) {
	t.Helper()
	r, err := http.NewRequest(method, target, bytes.NewReader(body))
	require.NoError(t, err)
	require.NoError(t, modeltraceapi.Sign(r, body, daemonKey, time.Now(), ""))
	response, err := client.Do(r)
	require.NoError(t, err)
	data, err := io.ReadAll(io.LimitReader(response.Body, modeltraceapi.MaxBodyBytes+1))
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	return response, data
}

func TestDaemonDisabledBuildDoesNotOpenStore(t *testing.T) {
	prior := openStore
	defer func() { openStore = prior }()
	calls := 0
	openStore = func(context.Context, string) (*store.DB, error) { calls++; return nil, modeltrace.ErrProbeStorage }
	handler, closer, err := build(context.Background(), config.ModelTraceConfig{})
	assert.NoError(t, err)
	assert.Nil(t, handler)
	assert.Nil(t, closer)
	assert.Zero(t, calls)
}

func TestDaemonStartupRecoveryOnceAndSafeHealth(t *testing.T) {
	c, e, _ := daemonFixture(t, false)
	daemonSeed(t, c, e, true)
	handler, closer, err := build(context.Background(), c)
	require.NoError(t, err)
	require.NotNil(t, handler)
	require.NotNil(t, closer)
	defer func() { require.NoError(t, closer.Close()) }()
	server := httptest.NewServer(handler)
	defer server.Close()
	client := &http.Client{Timeout: 3 * time.Second}
	response, body := daemonRequest(t, client, http.MethodGet, server.URL+"/v1/modeltrace/probes/"+e.ProbeID, nil)
	require.Equal(t, http.StatusOK, response.StatusCode)
	record, err := modeltraceapi.DecodeRecord(body)
	require.NoError(t, err)
	assert.Equal(t, "interrupted", record.ErrorCode)
	health, err := client.Get(server.URL + "/healthz")
	require.NoError(t, err)
	defer health.Body.Close()
	healthBody, err := io.ReadAll(health.Body)
	require.NoError(t, err)
	var metadata map[string]string
	require.NoError(t, json.Unmarshal(healthBody, &metadata))
	assert.Equal(t, c.Process.BankRevision, metadata["startup_bank_revision"])
	assert.Equal(t, c.Process.RuntimeManifestSHA256, metadata["runtime_manifest_revision"])
	worker, err := os.ReadFile(c.Process.WorkerPath)
	require.NoError(t, err)
	assert.Equal(t, daemonHash(worker), metadata["worker_payload_sha256"])
	assert.Len(t, metadata["public_config_sha256"], 64)
	assert.NotContains(t, string(healthBody), c.DatabasePath)
	assert.NotContains(t, string(healthBody), string(daemonKey))
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	e.ProbeID = "new-running-after-startup"
	digest, err := e.Digest()
	require.NoError(t, err)
	_, created, err := db.BeginProbe(context.Background(), e, digest, time.Now())
	require.NoError(t, err)
	require.True(t, created)
	response, body = daemonRequest(t, client, http.MethodGet, server.URL+"/v1/modeltrace/probes/"+e.ProbeID, nil)
	require.Equal(t, http.StatusOK, response.StatusCode)
	record, err = modeltraceapi.DecodeRecord(body)
	require.NoError(t, err)
	assert.Equal(t, modeltrace.StateRunning, record.State)
	require.NoError(t, db.Close())
}

func TestDaemonSameDatabaseCannotAcquireSecondStartupOwner(t *testing.T) {
	c, _, _ := daemonFixture(t, false)
	first, closer, err := build(context.Background(), c)
	require.NoError(t, err)
	require.NotNil(t, first)
	require.NotNil(t, closer)
	defer func() { require.NoError(t, closer.Close()) }()
	second, secondCloser, err := build(context.Background(), c)
	assert.Error(t, err)
	assert.Nil(t, second)
	assert.Nil(t, secondCloser)
}

func TestDaemonDatabaseLeaseAllowsSQLite(t *testing.T) {
	c, _, _ := daemonFixture(t, false)
	lock, err := config.AcquireModelTraceDatabase(c.DatabasePath)
	require.NoError(t, err)
	defer lock.Close()
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	require.NoError(t, db.Close())
}

func TestDaemonRecoveryFailureReleasesDatabaseLease(t *testing.T) {
	c, e, _ := daemonFixture(t, false)
	daemonSeed(t, c, e, false)
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	digest, err := e.Digest()
	require.NoError(t, err)
	_, created, err := db.BeginProbe(context.Background(), e, digest, time.Now().Add(time.Hour))
	require.NoError(t, err)
	require.True(t, created)
	require.NoError(t, db.Close())
	handler, closer, err := build(context.Background(), c)
	assert.ErrorIs(t, err, modeltrace.ErrProbeStorage)
	assert.Nil(t, handler)
	assert.Nil(t, closer)
	lease, err := config.AcquireModelTraceDatabase(c.DatabasePath)
	require.NoError(t, err, "failed recovery must release the startup owner lease")
	require.NoError(t, lease.Close())
	db, err = store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	record, err := db.GetProbe(context.Background(), e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, modeltrace.StateRunning, record.State, "failed recovery must not rewrite the probe")
	require.NoError(t, db.Close())
}

func TestDaemonInvalidKeyRejectedBeforeStore(t *testing.T) {
	c, _, _ := daemonFixture(t, false)
	prior := openStore
	defer func() { openStore = prior }()
	calls := 0
	openStore = func(context.Context, string) (*store.DB, error) {
		calls++
		return nil, modeltrace.ErrProbeStorage
	}
	c.IngestKey = []byte("short")
	handler, closer, err := build(context.Background(), c)
	assert.ErrorIs(t, err, config.ErrModelTraceConfig)
	assert.Nil(t, handler)
	assert.Nil(t, closer)
	assert.Zero(t, calls, "invalid assembly must not open or recover persistence")
	_, statErr := os.Stat(c.DatabasePath)
	assert.True(t, os.IsNotExist(statErr), "invalid assembly must not create a database")
}

func TestDaemonGracefulShutdownWaitsForActiveWorker(t *testing.T) {
	c, e, marker := daemonFixture(t, true)
	daemonSeed(t, c, e, false)
	handler, closer, err := build(context.Background(), c)
	require.NoError(t, err)
	defer closer.Close()
	server := httptest.NewServer(handler)
	defer server.Close()
	body, err := json.Marshal(e)
	require.NoError(t, err)
	request, err := http.NewRequest(http.MethodPost, server.URL+"/v1/modeltrace/probes", bytes.NewReader(body))
	require.NoError(t, err)
	require.NoError(t, modeltraceapi.Sign(request, body, daemonKey, time.Now(), ""))
	type outcome struct {
		response *http.Response
		body     []byte
		err      error
	}
	done := make(chan outcome, 1)
	go func() {
		response, err := (&http.Client{Timeout: 5 * time.Second}).Do(request)
		var data []byte
		if err == nil {
			data, err = io.ReadAll(response.Body)
			_ = response.Body.Close()
		}
		done <- outcome{response, data, err}
	}()
	require.Eventually(t, func() bool { _, err := os.Stat(marker); return err == nil }, 3*time.Second, 10*time.Millisecond)
	handler.StopAdmission()
	drained := make(chan error, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	go func() { drained <- closer.(*owner).Shutdown(ctx) }()
	select {
	case err := <-drained:
		t.Fatalf("closed persistence before active worker finished: %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	daemonPut(t, marker+".release", nil)
	select {
	case result := <-done:
		require.NoError(t, result.err)
		require.Equal(t, http.StatusOK, result.response.StatusCode)
		record, err := modeltraceapi.DecodeRecord(result.body)
		require.NoError(t, err)
		assert.Equal(t, modeltrace.StateSucceeded, record.State)
	case <-time.After(3 * time.Second):
		t.Fatal("active worker not joined")
	}
	select {
	case err := <-drained:
		require.NoError(t, err)
	case <-time.After(3 * time.Second):
		t.Fatal("graceful shutdown not joined")
	}
	data, err := os.ReadFile(marker)
	require.NoError(t, err)
	pid, err := strconv.Atoi(string(data))
	require.NoError(t, err)
	assert.Equal(t, unix.ESRCH, unix.Kill(pid, 0))
	entries, err := os.ReadDir(c.Process.TempDir)
	require.NoError(t, err)
	assert.Empty(t, entries)
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	record, err := db.GetProbe(context.Background(), e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, modeltrace.StateSucceeded, record.State)
	require.NoError(t, db.Close())
}

func TestDaemonRunDisabledAndIndependentListener(t *testing.T) {
	for _, enabled := range []string{"", "false", "invalid"} {
		calls := []string{}
		var stderr bytes.Buffer
		code := run(context.Background(), func(key string) string {
			calls = append(calls, key)
			return enabled
		}, config.ModelTracePins{}, &stderr)
		assert.Equal(t, []string{"SMART_ROUTER_MODELTRACE_ENABLED"}, calls)
		if enabled == "invalid" {
			assert.Equal(t, 1, code)
			assert.Equal(t, "modeltrace: configuration_invalid\n", stderr.String())
		} else {
			assert.Zero(t, code)
			assert.Empty(t, stderr.String())
		}
	}
	c, _, _ := daemonFixture(t, false)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	address := listener.Addr().String()
	require.NoError(t, listener.Close())
	values := map[string]string{
		"SMART_ROUTER_MODELTRACE_ENABLED": "true", "SMART_ROUTER_MODELTRACE_LISTEN": address,
		"SMART_ROUTER_MODELTRACE_DATABASE": c.DatabasePath, "SMART_ROUTER_MODELTRACE_PYTHON": c.Process.PythonPath,
		"SMART_ROUTER_MODELTRACE_WORKER": c.Process.WorkerPath, "SMART_ROUTER_MODELTRACE_RUNTIME_MANIFEST": c.Process.RuntimeManifestPath,
		"SMART_ROUTER_MODELTRACE_VENDOR_MANIFEST": c.Process.VendorManifestPath, "SMART_ROUTER_MODELTRACE_BANK": c.Process.BankPath,
		"SMART_ROUTER_MODELTRACE_INGEST_KEY": string(daemonKey),
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan int, 1)
	var stderr bytes.Buffer
	go func() {
		done <- run(ctx, func(key string) string { return values[key] }, config.ModelTracePins{
			PythonSHA256: c.Process.PythonSHA256, RuntimeManifestSHA256: c.Process.RuntimeManifestSHA256,
			VendorManifestSHA256: c.Process.VendorManifestSHA256}, &stderr)
	}()
	client := &http.Client{Timeout: 100 * time.Millisecond}
	require.Eventually(t, func() bool {
		response, err := client.Get("http://" + address + "/healthz")
		if err != nil {
			return false
		}
		defer response.Body.Close()
		return response.StatusCode == http.StatusOK
	}, 3*time.Second, 10*time.Millisecond)
	cancel()
	select {
	case code := <-done:
		assert.Zero(t, code)
		assert.Empty(t, stderr.String())
	case <-time.After(3 * time.Second):
		t.Fatal("independent listener not joined")
	}
	lease, err := config.AcquireModelTraceDatabase(c.DatabasePath)
	require.NoError(t, err)
	require.NoError(t, lease.Close())
}

func TestDaemonForcedShutdownReapsChildAndSnapshotsBeforeStoreClose(t *testing.T) {
	c, e, marker := daemonFixture(t, true)
	daemonSeed(t, c, e, false)
	handler, closer, err := build(context.Background(), c)
	require.NoError(t, err)
	require.NotNil(t, handler)
	require.NotNil(t, closer)
	shutdown, ok := closer.(interface{ Shutdown(context.Context) error })
	require.True(t, ok, "daemon owner must support a bounded drain")
	server := httptest.NewServer(handler)
	defer server.Close()
	body, err := json.Marshal(e)
	require.NoError(t, err)
	done := make(chan error, 1)
	go func() {
		request, err := http.NewRequest(http.MethodPost, server.URL+"/v1/modeltrace/probes", bytes.NewReader(body))
		if err == nil {
			err = modeltraceapi.Sign(request, body, daemonKey, time.Now(), "")
		}
		if err != nil {
			done <- err
			return
		}
		response, err := (&http.Client{Timeout: 25 * time.Second}).Do(request)
		if err == nil {
			_, err = io.Copy(io.Discard, response.Body)
			_ = response.Body.Close()
		}
		done <- err
	}()
	require.Eventually(t, func() bool { _, err := os.Stat(marker); return err == nil }, 3*time.Second, 10*time.Millisecond)
	started := time.Now()
	drain, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	require.NoError(t, shutdown.Shutdown(drain))
	assert.Less(t, time.Since(started), 3*time.Second)
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(3 * time.Second):
		t.Fatal("owned request not joined")
	}
	data, err := os.ReadFile(marker)
	require.NoError(t, err)
	pid, err := strconv.Atoi(string(data))
	require.NoError(t, err)
	assert.Equal(t, unix.ESRCH, unix.Kill(pid, 0))
	entries, err := os.ReadDir(c.Process.TempDir)
	require.NoError(t, err)
	assert.Empty(t, entries)
	response, _ := daemonRequest(t, &http.Client{Timeout: 3 * time.Second}, http.MethodGet,
		server.URL+"/v1/modeltrace/probes/"+e.ProbeID, nil)
	assert.Equal(t, http.StatusServiceUnavailable, response.StatusCode)
	db, err := store.OpenSQLite(context.Background(), c.DatabasePath)
	require.NoError(t, err)
	record, err := db.GetProbe(context.Background(), e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, modeltrace.StateCancelled, record.State)
	require.NoError(t, db.Close())
	require.NoError(t, closer.Close())
}

func TestDaemonRealServiceDurableReplayDoesNotReexecuteWorker(t *testing.T) {
	c, e, _ := daemonFixture(t, false)
	daemonSeed(t, c, e, false)
	handler, closer, err := build(context.Background(), c)
	require.NoError(t, err)
	require.NotNil(t, handler)
	require.NotNil(t, closer)
	defer func() { require.NoError(t, closer.Close()) }()
	server := httptest.NewServer(handler)
	defer server.Close()
	body, err := json.Marshal(e)
	require.NoError(t, err)
	client := &http.Client{Timeout: 3 * time.Second}
	response, first := daemonRequest(t, client, http.MethodPost, server.URL+"/v1/modeltrace/probes", body)
	require.Equal(t, http.StatusOK, response.StatusCode)
	record, err := modeltraceapi.DecodeRecord(first)
	require.NoError(t, err)
	assert.Equal(t, modeltrace.StateSucceeded, record.State)
	daemonPut(t, c.Process.WorkerPath, []byte("raise SystemExit('must not execute replay')"))
	response, replay := daemonRequest(t, client, http.MethodPost, server.URL+"/v1/modeltrace/probes", body)
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.JSONEq(t, string(first), string(replay))
	e.Samples[0].Numbers[0]++
	changed, err := json.Marshal(e)
	require.NoError(t, err)
	response, conflict := daemonRequest(t, client, http.MethodPost, server.URL+"/v1/modeltrace/probes", changed)
	assert.Equal(t, http.StatusConflict, response.StatusCode)
	assert.NotContains(t, string(conflict), "must not execute")
}
