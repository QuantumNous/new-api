package channel

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

func TestApplyUpstreamGetBody_SetsReplayableGetBody(t *testing.T) {
	t.Parallel()

	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"hi"}]}`)

	body, size, getBody, closer, err := relaycommon.NewOutboundJSONBody(payload)
	require.NoError(t, err)
	defer closer.Close()

	// Mirror DoApiRequest: a type-erased io.Reader gives net/http neither
	// ContentLength nor GetBody.
	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", body)
	require.NoError(t, err)
	assert.Nil(t, req.GetBody)
	assert.Zero(t, req.ContentLength)

	info := &relaycommon.RelayInfo{
		UpstreamRequestBodySize: size,
		UpstreamRequestGetBody:  getBody,
	}
	ApplyUpstreamBodyMetadata(req, info)

	assert.EqualValues(t, len(payload), req.ContentLength)
	require.NotNil(t, req.GetBody)

	// Drain the primary body as the transport does on the first attempt, then
	// make sure GetBody can replay the complete payload repeatedly.
	sent, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	assert.Equal(t, payload, sent)

	for i := 0; i < 2; i++ {
		rc, err := req.GetBody()
		require.NoError(t, err)
		replay, err := io.ReadAll(rc)
		require.NoError(t, err)
		require.NoError(t, rc.Close())
		assert.Equal(t, payload, replay, "replay %d must equal the original payload", i+1)
	}
}

func TestApplyUpstreamGetBody_KeepsExistingGetBody(t *testing.T) {
	tests := []struct {
		name string
		body func() io.Reader
	}{
		{name: "bytes reader", body: func() io.Reader { return bytes.NewReader([]byte("original")) }},
		{name: "bytes buffer", body: func() io.Reader { return bytes.NewBufferString("original") }},
		{name: "strings reader", body: func() io.Reader { return strings.NewReader("original") }},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", test.body())
			require.NoError(t, err)
			require.NotNil(t, req.GetBody, "net/http must derive GetBody for the concrete reader")

			info := &relaycommon.RelayInfo{
				UpstreamRequestBodySize: 99,
				UpstreamRequestGetBody: func() (io.ReadCloser, error) {
					return io.NopCloser(bytes.NewReader([]byte("override"))), nil
				},
			}
			ApplyUpstreamBodyMetadata(req, info)

			rc, err := req.GetBody()
			require.NoError(t, err)
			got, err := io.ReadAll(rc)
			require.NoError(t, err)
			require.NoError(t, rc.Close())
			assert.Equal(t, "original", string(got), "an already correct GetBody must not be overwritten")
			assert.EqualValues(t, len("original"), req.ContentLength, "native content length must not be overwritten")
		})
	}
}

func TestApplyUpstreamGetBody_NoopWithoutReplaySource(t *testing.T) {
	t.Parallel()

	storageBody, _, _, closer, err := relaycommon.NewOutboundJSONBody([]byte(`{}`))
	require.NoError(t, err)
	defer closer.Close()

	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", storageBody)
	require.NoError(t, err)

	applyUpstreamGetBody(req, nil)
	assert.Nil(t, req.GetBody)

	applyUpstreamGetBody(req, &relaycommon.RelayInfo{})
	assert.Nil(t, req.GetBody)
}

func TestApplyUpstreamBodyMetadata_EmptyStorageRemainsReplayable(t *testing.T) {
	t.Parallel()

	storage, err := common.CreateBodyStorage(nil)
	require.NoError(t, err)
	defer storage.Close()

	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", common.ReaderOnly(storage))
	require.NoError(t, err)
	ApplyUpstreamBodyMetadata(req, &relaycommon.RelayInfo{
		UpstreamRequestBodySize: storage.Size(),
		UpstreamRequestGetBody:  storage.NewReader,
	})

	assert.Zero(t, req.ContentLength)
	require.NotNil(t, req.GetBody)
	rc, err := req.GetBody()
	require.NoError(t, err)
	replay, err := io.ReadAll(rc)
	require.NoError(t, err)
	require.NoError(t, rc.Close())
	assert.Empty(t, replay)
}

func TestUpstreamBodyMetadataIsReboundAcrossChannelAttempts(t *testing.T) {
	firstPayload := []byte(`{"attempt":"first-with-longer-body"}`)
	_, firstSize, firstGetBody, firstCloser, err := relaycommon.NewOutboundJSONBody(firstPayload)
	require.NoError(t, err)

	info := &relaycommon.RelayInfo{
		UpstreamRequestBodySize: firstSize,
		UpstreamRequestGetBody:  firstGetBody,
	}
	require.NoError(t, firstCloser.Close())
	_, err = firstGetBody()
	require.ErrorIs(t, err, common.ErrStorageClosed)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info.InitChannelMeta(c)
	assert.Zero(t, info.UpstreamRequestBodySize)
	assert.Nil(t, info.UpstreamRequestGetBody)

	secondPayload := []byte(`{"attempt":"second"}`)
	secondStorage, err := common.CreateBodyStorage(secondPayload)
	require.NoError(t, err)
	defer secondStorage.Close()
	info.UpstreamRequestBodySize = secondStorage.Size()
	info.UpstreamRequestGetBody = secondStorage.NewReader

	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", common.ReaderOnly(secondStorage))
	require.NoError(t, err)
	ApplyUpstreamBodyMetadata(req, info)

	assert.EqualValues(t, len(secondPayload), req.ContentLength)
	require.NotNil(t, req.GetBody)
	rc, err := req.GetBody()
	require.NoError(t, err)
	replay, err := io.ReadAll(rc)
	require.NoError(t, err)
	require.NoError(t, rc.Close())
	assert.Equal(t, secondPayload, replay)
}

// stubTaskAdaptor implements just enough of TaskAdaptor for DoTaskApiRequest.
type stubTaskAdaptor struct {
	TaskAdaptor
	baseURL     string
	capturedReq *http.Request
}

func (s *stubTaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return s.baseURL + "/v1/video/generations", nil
}

func (s *stubTaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	s.capturedReq = req
	return nil
}

// TestDoTaskApiRequest_KeepsReplayableGetBody guards against reintroducing the
// hand-rolled GetBody override that wrapped the already consumed request
// reader: any transport-level retry would then have silently replayed an empty
// body. net/http derives a correct snapshot-based GetBody from the
// *bytes.Reader bodies the task adaptors pass in, and it must be left intact.
func TestDoTaskApiRequest_KeepsReplayableGetBody(t *testing.T) {
	service.InitHttpClient()

	payload := []byte(`{"model":"test-model","prompt":"hello"}`)

	type receivedBody struct {
		body []byte
		err  error
	}
	receivedCh := make(chan receivedBody, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		receivedCh <- receivedBody{body: body, err: err}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewReader(payload))

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	adaptor := &stubTaskAdaptor{baseURL: server.URL}
	resp, err := DoTaskApiRequest(adaptor, ctx, info, bytes.NewReader(payload))
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	received := <-receivedCh
	require.NoError(t, received.err)
	assert.Equal(t, payload, received.body)

	req := adaptor.capturedReq
	require.NotNil(t, req)
	require.NotNil(t, req.GetBody)
	// Even after the request body has been fully written, GetBody must still
	// return the complete payload, repeatedly.
	for i := 0; i < 2; i++ {
		rc, err := req.GetBody()
		require.NoError(t, err)
		replay, err := io.ReadAll(rc)
		require.NoError(t, err)
		require.NoError(t, rc.Close())
		assert.Equal(t, payload, replay, "replay %d must equal the original payload", i+1)
	}
}

type h2ServerResult struct {
	err           error
	streamCount   int
	attemptBodies [][]byte
}

func acceptH2TestConnection(ln net.Listener) (net.Conn, *http2.Framer, error) {
	conn, err := ln.Accept()
	if err != nil {
		return nil, nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(15 * time.Second))

	preface := make([]byte, len(http2.ClientPreface))
	if _, err := io.ReadFull(conn, preface); err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("read client preface: %w", err)
	}
	if !bytes.Equal(preface, []byte(http2.ClientPreface)) {
		conn.Close()
		return nil, nil, fmt.Errorf("unexpected client preface")
	}

	framer := http2.NewFramer(conn, conn)
	framer.ReadMetaHeaders = hpack.NewDecoder(4096, nil)
	if err := framer.WriteSettings(); err != nil {
		conn.Close()
		return nil, nil, err
	}
	return conn, framer, nil
}

func readH2TestRequest(framer *http2.Framer) (uint32, []byte, error) {
	var streamID uint32
	var body []byte
	for {
		frame, err := framer.ReadFrame()
		if err != nil {
			return 0, nil, fmt.Errorf("read frame: %w", err)
		}
		switch f := frame.(type) {
		case *http2.SettingsFrame:
			if !f.IsAck() {
				if err := framer.WriteSettingsAck(); err != nil {
					return 0, nil, err
				}
			}
		case *http2.MetaHeadersFrame:
			streamID = f.Header().StreamID
			if f.StreamEnded() {
				return streamID, body, nil
			}
		case *http2.DataFrame:
			if streamID == 0 {
				streamID = f.Header().StreamID
			}
			if f.Header().StreamID != streamID {
				continue
			}
			body = append(body, f.Data()...)
			if f.StreamEnded() {
				return streamID, body, nil
			}
		}
	}
}

func writeH2TestResponse(framer *http2.Framer, streamID uint32) error {
	var hpackBuf bytes.Buffer
	henc := hpack.NewEncoder(&hpackBuf)
	if err := henc.WriteField(hpack.HeaderField{Name: ":status", Value: "200"}); err != nil {
		return err
	}
	if err := framer.WriteHeaders(http2.HeadersFrameParam{
		StreamID:      streamID,
		BlockFragment: hpackBuf.Bytes(),
		EndHeaders:    true,
	}); err != nil {
		return err
	}
	return framer.WriteData(streamID, true, []byte(`{}`))
}

func awaitH2ServerResult(t *testing.T, resultCh <-chan h2ServerResult) h2ServerResult {
	t.Helper()
	select {
	case result := <-resultCh:
		return result
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for HTTP/2 test server")
		return h2ServerResult{}
	}
}

// runResetOnFirstStreamServer speaks just enough raw HTTP/2 to emulate an
// upstream that accepts the first request, waits until the request body has
// been fully written, and then resets the stream with REFUSED_STREAM (the
// retry-safe reset some proxy/CDN-fronted upstreams send under load or during
// graceful shutdown, see RFC 9113 section 8.7). When expectRetry is true it
// serves the retried stream a 200 response; otherwise it stops after the reset.
func runResetOnFirstStreamServer(ln net.Listener, expectRetry bool) <-chan h2ServerResult {
	resCh := make(chan h2ServerResult, 1)
	go func() {
		res := h2ServerResult{}
		defer func() { resCh <- res }()

		conn, framer, err := acceptH2TestConnection(ln)
		if err != nil {
			res.err = err
			return
		}
		defer conn.Close()

	attempts:
		for attempt := 0; ; attempt++ {
			streamID, body, err := readH2TestRequest(framer)
			if err != nil {
				res.err = err
				return
			}
			res.streamCount++
			res.attemptBodies = append(res.attemptBodies, body)

			if attempt == 0 {
				if err := framer.WriteRSTStream(streamID, http2.ErrCodeRefusedStream); err != nil {
					res.err = err
					return
				}
				if !expectRetry {
					break attempts
				}
				continue
			}

			if err := writeH2TestResponse(framer, streamID); err != nil {
				res.err = err
			}
			return
		}
	}()
	return resCh
}

func runGoAwayAfterFirstRequestServer(ln net.Listener) <-chan h2ServerResult {
	resCh := make(chan h2ServerResult, 1)
	go func() {
		res := h2ServerResult{}
		defer func() { resCh <- res }()

		for attempt := 0; attempt < 2; attempt++ {
			conn, framer, err := acceptH2TestConnection(ln)
			if err != nil {
				res.err = err
				return
			}
			streamID, body, err := readH2TestRequest(framer)
			if err != nil {
				conn.Close()
				res.err = err
				return
			}
			res.streamCount++
			res.attemptBodies = append(res.attemptBodies, body)

			if attempt == 0 {
				err = framer.WriteGoAway(0, http2.ErrCodeNo, nil)
				conn.Close()
				if err != nil {
					res.err = err
					return
				}
				continue
			}

			err = writeH2TestResponse(framer, streamID)
			conn.Close()
			if err != nil {
				res.err = err
			}
			return
		}
	}()
	return resCh
}

func newH2PriorKnowledgeClient(ln net.Listener) (*http.Client, *http2.Transport) {
	transport := &http2.Transport{
		AllowHTTP: true,
		DialTLSContext: func(ctx context.Context, network, _ string, _ *tls.Config) (net.Conn, error) {
			var dialer net.Dialer
			return dialer.DialContext(ctx, network, ln.Addr().String())
		},
	}
	return &http.Client{Transport: transport, Timeout: 15 * time.Second}, transport
}

func newPassThroughBody(t *testing.T, payload []byte) (io.Reader, *relaycommon.RelayInfo, common.BodyStorage) {
	t.Helper()
	storage, err := common.CreateBodyStorage(payload)
	require.NoError(t, err)
	return common.ReaderOnly(storage), &relaycommon.RelayInfo{
		UpstreamRequestBodySize: storage.Size(),
		UpstreamRequestGetBody:  storage.NewReader,
	}, storage
}

// TestUpstreamGetBody_HTTP2RetryAfterUpstreamStreamReset exercises the actual
// failure this change fixes: an HTTP/2 upstream resets the stream with a
// retryable error after the request body has been written. With GetBody wired
// up the transport must transparently retry, and the retried request must
// carry the complete body.
func TestUpstreamGetBody_HTTP2RetryAfterUpstreamStreamReset(t *testing.T) {
	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"retry me"}]}`)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	resCh := runResetOnFirstStreamServer(ln, true)

	client, transport := newH2PriorKnowledgeClient(ln)
	defer transport.CloseIdleConnections()

	// Build the upstream request exactly the way DoApiRequest does: a
	// type-erased BodyStorage reader plus the applyUpstream* helpers.
	body, size, getBody, closer, err := relaycommon.NewOutboundJSONBody(payload)
	require.NoError(t, err)
	defer closer.Close()

	req, err := http.NewRequest(http.MethodPost, "http://upstream.test/v1/chat/completions", body)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		UpstreamRequestBodySize: size,
		UpstreamRequestGetBody:  getBody,
	}
	ApplyUpstreamBodyMetadata(req, info)
	require.NotNil(t, req.GetBody)

	resp, err := client.Do(req)
	require.NoError(t, err, "the transport must transparently retry after RST_STREAM")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	srv := awaitH2ServerResult(t, resCh)
	require.NoError(t, srv.err)
	assert.Equal(t, 2, srv.streamCount, "the request must have been attempted twice")
	require.Len(t, srv.attemptBodies, 2)
	assert.Equal(t, payload, srv.attemptBodies[0], "first attempt must carry the full body")
	assert.Equal(t, payload, srv.attemptBodies[1], "the retried request must carry the complete body")
}

func TestUpstreamGetBody_HTTP2RetryAfterUpstreamStreamReset_PassThrough(t *testing.T) {
	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"pass through"}]}`)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	resCh := runResetOnFirstStreamServer(ln, true)

	client, transport := newH2PriorKnowledgeClient(ln)
	defer transport.CloseIdleConnections()

	body, info, storage := newPassThroughBody(t, payload)
	defer storage.Close()
	req, err := http.NewRequest(http.MethodPost, "http://upstream.test/v1/chat/completions", body)
	require.NoError(t, err)
	ApplyUpstreamBodyMetadata(req, info)
	require.NotNil(t, req.GetBody)
	assert.EqualValues(t, len(payload), req.ContentLength)

	resp, err := client.Do(req)
	require.NoError(t, err, "the transport must transparently retry a pass-through body after RST_STREAM")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	srv := awaitH2ServerResult(t, resCh)
	require.NoError(t, srv.err)
	assert.Equal(t, 2, srv.streamCount)
	require.Len(t, srv.attemptBodies, 2)
	assert.Equal(t, payload, srv.attemptBodies[0])
	assert.Equal(t, payload, srv.attemptBodies[1])
}

func TestUpstreamGetBody_HTTP2RetryAfterGracefulGoAway_PassThrough(t *testing.T) {
	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"go away"}]}`)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	resCh := runGoAwayAfterFirstRequestServer(ln)

	client, transport := newH2PriorKnowledgeClient(ln)
	defer transport.CloseIdleConnections()

	body, info, storage := newPassThroughBody(t, payload)
	defer storage.Close()
	req, err := http.NewRequest(http.MethodPost, "http://upstream.test/v1/chat/completions", body)
	require.NoError(t, err)
	ApplyUpstreamBodyMetadata(req, info)
	require.NotNil(t, req.GetBody)

	resp, err := client.Do(req)
	require.NoError(t, err, "the transport must retry on a new connection after graceful GOAWAY")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	srv := awaitH2ServerResult(t, resCh)
	require.NoError(t, srv.err)
	assert.Equal(t, 2, srv.streamCount)
	require.Len(t, srv.attemptBodies, 2)
	assert.Equal(t, payload, srv.attemptBodies[0])
	assert.Equal(t, payload, srv.attemptBodies[1])
}

// TestUpstreamGetBody_HTTP2CannotRetryWithoutGetBody documents the pre-fix
// behavior: without GetBody the transport cannot safely retry once the body
// has been written, and the whole relay request fails.
func TestUpstreamGetBody_HTTP2CannotRetryWithoutGetBody(t *testing.T) {
	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"retry me"}]}`)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	resCh := runResetOnFirstStreamServer(ln, false)

	client, transport := newH2PriorKnowledgeClient(ln)
	defer transport.CloseIdleConnections()

	body, size, _, closer, err := relaycommon.NewOutboundJSONBody(payload)
	require.NoError(t, err)
	defer closer.Close()

	req, err := http.NewRequest(http.MethodPost, "http://upstream.test/v1/chat/completions", body)
	require.NoError(t, err)
	applyUpstreamContentLength(req, &relaycommon.RelayInfo{UpstreamRequestBodySize: size})
	assert.Nil(t, req.GetBody)

	resp, err := client.Do(req) //nolint:bodyclose // Do fails, no body to close
	require.Error(t, err)
	assert.Nil(t, resp)
	require.ErrorContains(t, err, "cannot retry err")
	require.ErrorContains(t, err, "Request.Body was written")

	srv := awaitH2ServerResult(t, resCh)
	require.NoError(t, srv.err)
	assert.Equal(t, 1, srv.streamCount)
	require.Len(t, srv.attemptBodies, 1)
	assert.Equal(t, payload, srv.attemptBodies[0])
}
