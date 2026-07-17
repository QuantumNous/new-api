package middleware

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestWireBytesCountsRawBodyBeforeDecompression is the measurement that decides
// who to blame for a truncated upload, so it has to count the compressed stream
// as it arrives — the same units as Content-Length. The first version of this
// diagnostic counted after the decompressor and reported more bytes read than
// the client declared, which is meaningless.
func TestWireBytesCountsRawBodyBeforeDecompression(t *testing.T) {
	body := &countingBody{ReadCloser: io.NopCloser(strings.NewReader("0123456789"))}

	got, err := io.ReadAll(body)

	require.NoError(t, err)
	require.Equal(t, "0123456789", string(got))
	require.Equal(t, int64(10), body.n.Load())
}

// TestWireBytesCountsPartialArrivalBeforeCut: a body cut short must still report
// what did arrive — that shortfall against Content-Length is the whole signal.
func TestWireBytesCountsPartialArrivalBeforeCut(t *testing.T) {
	truncated := io.MultiReader(strings.NewReader("012345"), errReaderForTest{io.ErrUnexpectedEOF})
	body := &countingBody{ReadCloser: io.NopCloser(truncated)}

	_, err := io.ReadAll(body)

	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	require.Equal(t, int64(6), body.n.Load(), "must report the bytes that did arrive")
}

// TestWireBytesReadReportsUnknownWithoutMiddleware: a request that never passed
// through the middleware must report -1 rather than a plausible-looking 0, which
// would read as "the client sent nothing" and misdirect the next investigation.
func TestWireBytesReadReportsUnknownWithoutMiddleware(t *testing.T) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	require.Equal(t, int64(-1), WireBytesRead(c))
}

func TestWireBytesReadReportsCountFromContext(t *testing.T) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	body := &countingBody{ReadCloser: io.NopCloser(strings.NewReader("abcd"))}
	c.Set(middlewareWireBytesKey, body)

	_, _ = io.ReadAll(body)

	require.Equal(t, int64(4), WireBytesRead(c))
}

type errReaderForTest struct{ err error }

func (e errReaderForTest) Read([]byte) (int, error) { return 0, e.err }
