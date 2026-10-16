package modeltraceapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"smart-router/api"
	"smart-router/modeltrace"
)

var testKey = []byte("synthetic-modeltrace-ingest-key-32-bytes")

type countedBackend struct {
	calls    int
	record   modeltrace.Record
	err      error
	evidence modeltrace.Evidence
	id       string
	model    string
	protocol api.Protocol
}

func (b *countedBackend) Submit(_ context.Context, evidence modeltrace.Evidence) (modeltrace.Record, error) {
	b.calls++
	b.evidence = evidence
	return b.record, b.err
}

func (b *countedBackend) GetProbe(_ context.Context, id string) (modeltrace.Record, error) {
	b.calls++
	b.id = id
	return b.record, b.err
}

func (b *countedBackend) LatestAttribution(_ context.Context, id, model string, protocol api.Protocol) (modeltrace.Record, error) {
	b.calls++
	b.id, b.model, b.protocol = id, model, protocol
	return b.record, b.err
}

func testEvidence(t *testing.T) []byte {
	t.Helper()
	e := modeltrace.Evidence{SchemaVersion: 1, ProbeID: "probe-test-1",
		BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", ClaimedModel: "candidate",
		Protocol: api.ProtocolChat, BankRevision: strings.Repeat("a", 64),
		Samples: []modeltrace.Sample{{ChallengeID: "challenge-1", ExpectedCount: 80, Numbers: make([]int, 80)}}}
	for i := range e.Samples[0].Numbers {
		e.Samples[0].Numbers[i] = i + 1
	}
	require.NoError(t, e.Validate())
	body, err := json.Marshal(e)
	require.NoError(t, err)
	return body
}

func TestProbeIngressRequiresSignature(t *testing.T) {
	backend := &countedBackend{}
	server, err := NewServer(Options{Backend: backend, Key: testKey, Now: func() time.Time { return time.Unix(1700000000, 0) }})
	require.NoError(t, err)
	request := httptest.NewRequest(http.MethodPost, "/v1/modeltrace/probes", bytes.NewReader(testEvidence(t)))
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Zero(t, backend.calls)
}

func validRecord() modeltrace.Record {
	return modeltrace.Record{
		ProbeID: "probe-test-1", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", ClaimedModel: "candidate",
		Protocol: api.ProtocolChat, EvidenceSHA256: strings.Repeat("c", 64), State: modeltrace.StateSucceeded,
		ObservedAt: time.Unix(1700000000, 123).UTC(),
		Result: &modeltrace.Result{
			Prediction: "candidate", Probability: 1, UsedOutputs: 1, ClosedSet: true, Assessment: "inconclusive",
			BankRevision: strings.Repeat("a", 64), EngineRevision: strings.Repeat("b", 64),
			Models:   []modeltrace.ModelScore{{Model: "candidate", Family: "family", Probability: 1}},
			Families: []modeltrace.FamilyScore{{Family: "family", Probability: 1}},
		},
	}
}

func serveSigned(t *testing.T, backend *countedBackend, method, target string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	at := time.Unix(1700000000, 0)
	server, err := NewServer(Options{Backend: backend, Key: testKey, Now: func() time.Time { return at }})
	require.NoError(t, err)
	request := signedRequest(t, method, target, body, at, strings.Repeat("a", 32))
	request.Body = io.NopCloser(bytes.NewReader(body))
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	return response
}

func TestSignedRoutesAndLowercaseProjection(t *testing.T) {
	for _, tc := range []struct{ method, target string }{
		{http.MethodPost, "/v1/modeltrace/probes"},
		{http.MethodGet, "/v1/modeltrace/probes/probe-test-1"},
		{http.MethodGet, "/v1/modeltrace/bindings/bnd_AAAAAAAAAAAAAAAAAAAAAAAA?model=candidate&protocol=chat"},
	} {
		t.Run(tc.method+tc.target, func(t *testing.T) {
			backend := &countedBackend{record: validRecord()}
			body := []byte(nil)
			if tc.method == http.MethodPost {
				body = testEvidence(t)
			}
			response := serveSigned(t, backend, tc.method, tc.target, body)
			require.Equal(t, http.StatusOK, response.Code)
			assert.Equal(t, 1, backend.calls)
			var wire map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &wire))
			assert.Len(t, wire, 9)
			assert.JSONEq(t, `"probe-test-1"`, string(wire["probe_id"]))
			assert.JSONEq(t, `"succeeded"`, string(wire["state"]))
			assert.NotEmpty(t, wire["result"])
			for _, forbidden := range []string{"ProbeID", "samples", "numbers", "stderr", "environment", "path", "key"} {
				assert.NotContains(t, response.Body.String(), forbidden)
			}
			if strings.Contains(tc.target, "/bindings/") {
				assert.Equal(t, "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", backend.id)
				assert.Equal(t, "candidate", backend.model)
				assert.Equal(t, api.ProtocolChat, backend.protocol)
			}
		})
	}
}

func TestIngressRejectsMalformedEvidenceBeforeBackend(t *testing.T) {
	valid := string(testEvidence(t))
	cases := map[string]string{
		"unknown":      strings.Replace(valid, `"schema_version":1`, `"schema_version":1,"extra":true`, 1),
		"duplicate":    strings.Replace(valid, `"schema_version":1`, `"schema_version":1,"schema_version":1`, 1),
		"nonexact":     strings.Replace(valid, `"probe_id"`, `"Probe_ID"`, 1),
		"secret_field": strings.Replace(valid, `"schema_version":1`, `"schema_version":1,"api_key":"synthetic-secret"`, 1),
		"secret_label": strings.Replace(valid, `"candidate"`, `"bearer synthetic-secret"`, 1),
		"binding":      strings.Replace(valid, `"bnd_AAAAAAAAAAAAAAAAAAAAAAAA"`, `"provider-name"`, 1),
		"trailing":     valid + `{}`,
		"null":         `null`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			backend := &countedBackend{record: validRecord()}
			response := serveSigned(t, backend, http.MethodPost, "/v1/modeltrace/probes", []byte(body))
			assert.Equal(t, http.StatusBadRequest, response.Code)
			assert.Zero(t, backend.calls)
			assert.JSONEq(t, `{"error":"invalid_request"}`, response.Body.String())
		})
	}
	backend := &countedBackend{record: validRecord()}
	response := serveSigned(t, backend, http.MethodPost, "/v1/modeltrace/probes", make([]byte, (256<<10)+1))
	assert.Equal(t, http.StatusRequestEntityTooLarge, response.Code)
	assert.Zero(t, backend.calls)
}

func TestStableErrorsAndInvalidRoutes(t *testing.T) {
	for _, tc := range []struct {
		err      error
		code     int
		sentinel string
	}{
		{modeltrace.ErrProbeConflict, 409, "conflict"},
		{modeltrace.ErrBindingMismatch, 409, "conflict"},
		{modeltrace.ErrBindingMissing, 404, "not_found"},
		{modeltrace.ErrProbeNotFound, 404, "not_found"},
		{modeltrace.ErrProbeExecution, 500, "execution_failed"},
		{errors.New("internal stderr synthetic-secret /private/path"), 500, "internal_error"},
	} {
		backend := &countedBackend{err: tc.err}
		response := serveSigned(t, backend, http.MethodPost, "/v1/modeltrace/probes", testEvidence(t))
		assert.Equal(t, tc.code, response.Code)
		assert.JSONEq(t, `{"error":"`+tc.sentinel+`"}`, response.Body.String())
	}
	for _, target := range []string{
		"/v1/modeltrace/probes/a/b", "/v1/modeltrace/probes/%2F",
		"/v1/modeltrace/probes/probe-test-1?extra=1",
		"/v1/modeltrace/bindings/provider?model=candidate&protocol=chat",
		"/v1/modeltrace/bindings/bnd_AAAAAAAAAAAAAAAAAAAAAAAA?model=candidate&model=other&protocol=chat",
		"/v1/modeltrace/bindings/bnd_AAAAAAAAAAAAAAAAAAAAAAAA?model=candidate&protocol=unknown",
	} {
		backend := &countedBackend{record: validRecord()}
		response := serveSigned(t, backend, http.MethodGet, target, nil)
		assert.Equal(t, http.StatusBadRequest, response.Code)
		assert.Zero(t, backend.calls)
	}
	backend := &countedBackend{record: validRecord()}
	response := serveSigned(t, backend, http.MethodPut, "/v1/modeltrace/probes", testEvidence(t))
	assert.Equal(t, http.StatusMethodNotAllowed, response.Code)
	assert.Zero(t, backend.calls)
	bad := validRecord()
	bad.ErrorCode = "internal stderr"
	response = serveSigned(t, &countedBackend{record: bad}, http.MethodGet, "/v1/modeltrace/probes/probe-test-1", nil)
	assert.Equal(t, http.StatusInternalServerError, response.Code)
	assert.NotContains(t, response.Body.String(), "stderr")
}

func TestServerRetainsReplayStateAcrossRequests(t *testing.T) {
	at := time.Unix(1700000000, 0)
	backend := &countedBackend{record: validRecord()}
	server, err := NewServer(Options{Backend: backend, Key: testKey, Now: func() time.Time { return at }})
	require.NoError(t, err)
	for i := range 2 {
		request := signedRequest(t, http.MethodPost, "/v1/modeltrace/probes", testEvidence(t), at, strings.Repeat("a", 32))
		request.Body = io.NopCloser(bytes.NewReader(testEvidence(t)))
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		assert.Equal(t, []int{200, 401}[i], response.Code)
	}
	assert.Equal(t, 1, backend.calls)
}
