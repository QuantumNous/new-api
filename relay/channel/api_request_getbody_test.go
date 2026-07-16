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
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
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
	require.Nil(t, req.GetBody)
	require.EqualValues(t, 0, req.ContentLength)

	info := &relaycommon.RelayInfo{
		UpstreamRequestBodySize: size,
		UpstreamRequestGetBody:  getBody,
	}
	applyUpstreamContentLength(req, info)
	applyUpstreamGetBody(req, info)

	require.EqualValues(t, len(payload), req.ContentLength)
	require.NotNil(t, req.GetBody)

	// Drain the primary body as the transport does on the first attempt, then
	// make sure GetBody can replay the complete payload repeatedly.
	sent, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.Equal(t, payload, sent)

	for i := 0; i < 2; i++ {
		rc, err := req.GetBody()
		require.NoError(t, err)
		replay, err := io.ReadAll(rc)
		require.NoError(t, err)
		require.NoError(t, rc.Close())
		require.Equal(t, payload, replay, "replay %d must equal the original payload", i+1)
	}
}

func TestApplyUpstreamGetBody_KeepsExistingGetBody(t *testing.T) {
	t.Parallel()

	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", bytes.NewReader([]byte("original")))
	require.NoError(t, err)
	require.NotNil(t, req.GetBody, "*bytes.Reader bodies get a GetBody from net/http")

	info := &relaycommon.RelayInfo{
		UpstreamRequestGetBody: func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader([]byte("override"))), nil
		},
	}
	applyUpstreamGetBody(req, info)

	rc, err := req.GetBody()
	require.NoError(t, err)
	got, err := io.ReadAll(rc)
	require.NoError(t, err)
	require.Equal(t, "original", string(got), "an already correct GetBody must not be overwritten")
}

func TestApplyUpstreamGetBody_NoopWithoutReplaySource(t *testing.T) {
	t.Parallel()

	storageBody, _, _, closer, err := relaycommon.NewOutboundJSONBody([]byte(`{}`))
	require.NoError(t, err)
	defer closer.Close()

	req, err := http.NewRequest(http.MethodPost, "https://example.com/v1/chat/completions", storageBody)
	require.NoError(t, err)

	applyUpstreamGetBody(req, nil)
	require.Nil(t, req.GetBody)

	applyUpstreamGetBody(req, &relaycommon.RelayInfo{})
	require.Nil(t, req.GetBody)
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

	var received []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received, _ = io.ReadAll(r.Body)
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
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, payload, received)

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
		require.Equal(t, payload, replay, "replay %d must equal the original payload", i+1)
	}
}

type h2ServerResult struct {
	err         error
	streamCount int
	bodies      map[uint32][]byte
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
		res := h2ServerResult{bodies: map[uint32][]byte{}}
		defer func() { resCh <- res }()

		conn, err := ln.Accept()
		if err != nil {
			res.err = err
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(15 * time.Second))

		preface := make([]byte, len(http2.ClientPreface))
		if _, err := io.ReadFull(conn, preface); err != nil {
			res.err = fmt.Errorf("read client preface: %w", err)
			return
		}

		framer := http2.NewFramer(conn, conn)
		framer.ReadMetaHeaders = hpack.NewDecoder(4096, nil)
		if err := framer.WriteSettings(); err != nil {
			res.err = err
			return
		}

		var hpackBuf bytes.Buffer
		henc := hpack.NewEncoder(&hpackBuf)

		for {
			frame, err := framer.ReadFrame()
			if err != nil {
				res.err = fmt.Errorf("read frame: %w", err)
				return
			}
			switch f := frame.(type) {
			case *http2.SettingsFrame:
				if !f.IsAck() {
					if err := framer.WriteSettingsAck(); err != nil {
						res.err = err
						return
					}
				}
			case *http2.MetaHeadersFrame:
				res.streamCount++
			case *http2.DataFrame:
				sid := f.Header().StreamID
				res.bodies[sid] = append(res.bodies[sid], f.Data()...)
				if !f.StreamEnded() {
					continue
				}
				if sid == 1 {
					// The full request body has been written; reset the stream
					// the way an overloaded or restarting upstream does.
					if err := framer.WriteRSTStream(sid, http2.ErrCodeRefusedStream); err != nil {
						res.err = err
						return
					}
					if !expectRetry {
						return
					}
					continue
				}
				// Retried attempt: respond 200 and finish.
				hpackBuf.Reset()
				if err := henc.WriteField(hpack.HeaderField{Name: ":status", Value: "200"}); err != nil {
					res.err = err
					return
				}
				if err := framer.WriteHeaders(http2.HeadersFrameParam{
					StreamID:      sid,
					BlockFragment: hpackBuf.Bytes(),
					EndHeaders:    true,
				}); err != nil {
					res.err = err
					return
				}
				if err := framer.WriteData(sid, true, []byte(`{}`)); err != nil {
					res.err = err
					return
				}
				return
			}
		}
	}()
	return resCh
}

func newH2PriorKnowledgeClient(ln net.Listener) (*http.Client, *http2.Transport) {
	transport := &http2.Transport{
		AllowHTTP: true,
		DialTLSContext: func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
			return net.Dial("tcp", ln.Addr().String())
		},
	}
	return &http.Client{Transport: transport, Timeout: 15 * time.Second}, transport
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
	applyUpstreamContentLength(req, info)
	applyUpstreamGetBody(req, info)
	require.NotNil(t, req.GetBody)

	resp, err := client.Do(req)
	require.NoError(t, err, "the transport must transparently retry after RST_STREAM")
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	srv := <-resCh
	require.NoError(t, srv.err)
	require.Equal(t, 2, srv.streamCount, "the request must have been attempted twice")
	require.Equal(t, payload, srv.bodies[1], "first attempt must carry the full body")
	require.Equal(t, payload, srv.bodies[3], "the retried request must carry the complete body")
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
	require.Nil(t, req.GetBody)

	resp, err := client.Do(req) //nolint:bodyclose // Do fails, no body to close
	require.Error(t, err)
	require.Nil(t, resp)
	require.ErrorContains(t, err, "cannot retry err")
	require.ErrorContains(t, err, "Request.Body was written")

	srv := <-resCh
	require.NoError(t, srv.err)
	require.Equal(t, 1, srv.streamCount)
	require.Equal(t, payload, srv.bodies[1])
}
