package helper

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// countingStorage records how many times the body was materialised, so a test
// can assert that it was not read at all rather than only that the result was
// discarded.
type countingStorage struct {
	data      []byte
	reader    *bytes.Reader
	bytesCals int
}

func newCountingStorage(data []byte) *countingStorage {
	return &countingStorage{data: data, reader: bytes.NewReader(data)}
}

func (s *countingStorage) Read(p []byte) (int, error) { return s.reader.Read(p) }
func (s *countingStorage) Seek(offset int64, whence int) (int64, error) {
	return s.reader.Seek(offset, whence)
}
func (s *countingStorage) Close() error { return nil }
func (s *countingStorage) Bytes() ([]byte, error) {
	s.bytesCals++
	return s.data, nil
}
func (s *countingStorage) Size() int64  { return int64(len(s.data)) }
func (s *countingStorage) IsDisk() bool { return true }
func (s *countingStorage) NewReader() (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(s.data)), nil
}

func newRequestContextWithStorage(t *testing.T, storage common.BodyStorage) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set(common.KeyBodyStorage, storage)
	return ctx
}

// The body must not be materialised when the expression cannot read it.
// The needBody=true half is the positive control: without it, a resolver that
// never reads anything would also pass.
func TestResolveIncomingBillingExprRequestInput_BodyReadIsGated(t *testing.T) {
	body := []byte(`{"service_tier":"fast"}`)

	t.Run("not needed: never read", func(t *testing.T) {
		storage := newCountingStorage(body)
		ctx := newRequestContextWithStorage(t, storage)
		info := &relaycommon.RelayInfo{RequestHeaders: map[string]string{"Content-Type": "application/json"}}

		input, err := ResolveIncomingBillingExprRequestInput(ctx, info, false)
		require.NoError(t, err)
		// The read itself is what costs memory, so assert on it first: a body
		// that is fetched and then dropped would still have been materialised.
		require.Zero(t, storage.bytesCals, "body storage must not be read when the expression has no param()")
		require.Nil(t, input.Body)
		require.Equal(t, "application/json", input.Headers["Content-Type"], "headers are still needed by header()")
	})

	t.Run("needed: read exactly as before", func(t *testing.T) {
		storage := newCountingStorage(body)
		ctx := newRequestContextWithStorage(t, storage)
		info := &relaycommon.RelayInfo{RequestHeaders: map[string]string{"Content-Type": "application/json"}}

		input, err := ResolveIncomingBillingExprRequestInput(ctx, info, true)
		require.NoError(t, err)
		require.Equal(t, body, input.Body)
		require.Equal(t, 1, storage.bytesCals)
	})
}

// The frozen-input branch (info.BillingRequestInput set by a previous stage,
// e.g. channel test) must honour the same gate.
func TestResolveIncomingBillingExprRequestInput_FrozenInputHonoursGate(t *testing.T) {
	frozen := billingexpr.RequestInput{
		Headers: map[string]string{"X-Frozen": "1"},
		Body:    []byte(`{"service_tier":"fast"}`),
	}
	info := &relaycommon.RelayInfo{
		RequestHeaders:      map[string]string{"Content-Type": "application/json"},
		BillingRequestInput: &frozen,
	}
	ctx := newRequestContextWithStorage(t, newCountingStorage(nil))

	skipped, err := ResolveIncomingBillingExprRequestInput(ctx, info, false)
	require.NoError(t, err)
	require.Nil(t, skipped.Body)
	require.Equal(t, "1", skipped.Headers["X-Frozen"])

	kept, err := ResolveIncomingBillingExprRequestInput(ctx, info, true)
	require.NoError(t, err)
	require.Equal(t, frozen.Body, kept.Body)

	require.NotNil(t, frozen.Body, "the caller's input must not be mutated")
}

func TestBillingExprNeedsRequestBody(t *testing.T) {
	require.True(t, BillingExprNeedsRequestBody(nil), "nil means the expression did not compile: provide the body rather than silently omit it")
	require.False(t, BillingExprNeedsRequestBody(map[string]bool{}))
	require.True(t, BillingExprNeedsRequestBody(map[string]bool{"param": true}))
	require.False(t, BillingExprNeedsRequestBody(map[string]bool{"header": true, "hour": true}))
}

// Tie the gate to the compiler rather than to a hand-written list, so the two
// cannot drift apart when a new function is added to the expression language.
func TestBillingExprNeedsRequestBody_AgreesWithCompiler(t *testing.T) {
	cases := []struct {
		name string
		expr string
		want bool
	}{
		{
			name: "time tiers only",
			expr: `weekday("Asia/Shanghai") in [1,2,3,4,5] and hour("Asia/Shanghai") in [9,10,11] ? tier("peak", cr*0.005632 + p*0.2816 + c*1.1264) : tier("off", cr*0.002816 + p*0.1408 + c*0.5632)`,
			want: false,
		},
		{
			name: "context-length tiers only",
			expr: `len > 512000 ? tier("long", cr*0.11832 + p*0.5916 + c*2.3664) : tier("std", cr*0.05916 + p*0.2958 + c*1.1832)`,
			want: false,
		},
		{
			name: "flat",
			expr: `tier("base", p*0.5 + c*3 + cr*0.05)`,
			want: false,
		},
		{
			name: "header only",
			expr: `header("x-priority") == "high" ? tier("a", p*2 + c*2) : tier("b", p*1 + c*1)`,
			want: false,
		},
		{
			name: "param in condition",
			expr: `param("service_tier") == "priority" ? tier("prio", p*1.5 + c*1.5) : tier("base", p*1 + c*1)`,
			want: true,
		},
		{
			name: "param in value",
			expr: `tier("base", p*1 + c*1 + (has(param("metadata.tag"), "bulk") ? 0 : 1))`,
			want: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			usedVars := billingexpr.UsedVars(tc.expr)
			require.NotNil(t, usedVars, "expression must compile for this test to mean anything")
			require.Equal(t, tc.want, BillingExprNeedsRequestBody(usedVars))
		})
	}
}
