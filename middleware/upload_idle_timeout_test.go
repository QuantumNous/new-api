package middleware

import (
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// deadlineReader stands in for a connection with a read deadline: a Read only
// succeeds if it would land before the deadline, otherwise it times out exactly
// as a real socket does.
type deadlineReader struct {
	perRead  time.Duration // how long each Read takes to deliver
	deadline time.Time
	chunks   []string
	i        int
}

func (d *deadlineReader) Read(p []byte) (int, error) {
	// Time has to actually pass, or a total-deadline bug looks identical to an
	// idle one: with every read at t=0 no deadline can ever be crossed.
	if !d.deadline.IsZero() && time.Now().Add(d.perRead).After(d.deadline) {
		time.Sleep(time.Until(d.deadline))
		return 0, os.ErrDeadlineExceeded
	}
	time.Sleep(d.perRead)
	if d.i >= len(d.chunks) {
		return 0, io.EOF
	}
	n := copy(p, d.chunks[d.i])
	d.i++
	return n, nil
}

func (d *deadlineReader) Close() error { return nil }

type deadlineWriter struct{ d *deadlineReader }

func (w *deadlineWriter) Header() http.Header         { return http.Header{} }
func (w *deadlineWriter) Write(b []byte) (int, error) { return len(b), nil }
func (w *deadlineWriter) WriteHeader(int)             {}
func (w *deadlineWriter) SetReadDeadline(t time.Time) error {
	w.d.deadline = t
	return nil
}

func newIdleTimeoutBody(src *deadlineReader, timeout time.Duration) *idleTimeoutBody {
	return &idleTimeoutBody{
		ReadCloser: src,
		rc:         http.NewResponseController(&deadlineWriter{d: src}),
		timeout:    timeout,
	}
}

// TestIdleTimeoutDoesNotCutAProgressingUpload is the property that makes this
// safe to enable: it must be an idle timeout, not a total one. A large upload
// that keeps delivering bytes may take as long as it likes — cutting those
// would break exactly the big-attachment requests we are trying to rescue.
//
// The upload here runs well past the timeout in total (20 chunks x 20ms = 400ms
// against a 50ms window) while never pausing longer than the window. A total
// deadline would cut it; an idle one must not. Keep it that way — with the
// total under the window this test passes either way and proves nothing.
func TestIdleTimeoutDoesNotCutAProgressingUpload(t *testing.T) {
	const (
		perRead = 20 * time.Millisecond
		window  = 50 * time.Millisecond
		chunks  = 20
	)
	require.Greater(t, chunks*perRead, window, "premise: the upload must outlast the window")

	src := &deadlineReader{perRead: perRead}
	want := ""
	for i := 0; i < chunks; i++ {
		src.chunks = append(src.chunks, "abc")
		want += "abc"
	}
	body := newIdleTimeoutBody(src, window)

	got, err := io.ReadAll(body)

	require.NoError(t, err, "an upload making steady progress must never be cut, however long it runs")
	require.Equal(t, want, string(got))
}

// TestIdleTimeoutCutsAStalledUpload is the case it exists for: without it the
// request sits until the client's own timeout fires, measured at 300s in prod.
func TestIdleTimeoutCutsAStalledUpload(t *testing.T) {
	src := &deadlineReader{
		perRead: time.Hour, // client has gone silent mid-body
		chunks:  []string{"aaa"},
	}
	body := newIdleTimeoutBody(src, 50*time.Millisecond)

	_, err := io.ReadAll(body)

	require.ErrorIs(t, err, common.ErrUploadIdleTimeout)
	require.True(t, common.IsClientDisconnectError(err),
		"a stalled upload is the client going away, not a malformed request")
}

// TestIdleTimeoutClearsDeadlineWhenBodyEnds: the deadline lives on the shared
// connection, so leaving it armed would leak into the response stream and into
// the next keep-alive request on the same socket.
func TestIdleTimeoutClearsDeadlineWhenBodyEnds(t *testing.T) {
	src := &deadlineReader{perRead: time.Millisecond, chunks: []string{"aaa"}}
	body := newIdleTimeoutBody(src, time.Minute)

	_, err := io.ReadAll(body)
	require.NoError(t, err)

	require.True(t, src.deadline.IsZero(), "deadline must be cleared once the body is done")
}

// TestIdleTimeoutClearsDeadlineOnClose covers the abort path, where the handler
// gives up without reading to EOF.
func TestIdleTimeoutClearsDeadlineOnClose(t *testing.T) {
	src := &deadlineReader{perRead: time.Millisecond, chunks: []string{"aaa", "bbb"}}
	body := newIdleTimeoutBody(src, time.Minute)

	buf := make([]byte, 3)
	_, err := body.Read(buf)
	require.NoError(t, err)
	require.False(t, src.deadline.IsZero(), "premise: a read arms the deadline")

	require.NoError(t, body.Close())
	require.True(t, src.deadline.IsZero(), "Close must clear the deadline")
}

// TestIdleTimeoutToleratesServersWithoutDeadlines: h2 in some configurations
// cannot set read deadlines. That must degrade to the old wait-forever
// behaviour, not fail the request.
func TestIdleTimeoutToleratesServersWithoutDeadlines(t *testing.T) {
	src := &deadlineReader{perRead: time.Millisecond, chunks: []string{"aaa"}}
	body := &idleTimeoutBody{
		ReadCloser: src,
		rc:         http.NewResponseController(&noDeadlineWriter{}),
		timeout:    time.Minute,
	}

	got, err := io.ReadAll(body)

	require.NoError(t, err)
	require.Equal(t, "aaa", string(got))
	require.False(t, body.armed, "must not claim a deadline the server refused")
}

type noDeadlineWriter struct{}

func (w *noDeadlineWriter) Header() http.Header         { return http.Header{} }
func (w *noDeadlineWriter) Write(b []byte) (int, error) { return len(b), nil }
func (w *noDeadlineWriter) WriteHeader(int)             {}
