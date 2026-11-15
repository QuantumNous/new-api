package middleware

import (
	"bytes"
	"encoding/binary"
	"io"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var zstdMagic = []byte{0x28, 0xb5, 0x2f, 0xfd}

// zstdRLEBlock is a last block that repeats 'a' once.
var zstdRLEBlock = []byte{0x0b, 0x00, 0x00, 'a'}

func readZstdBody(t *testing.T, body []byte) ([]byte, error) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	var data []byte
	var readErr error
	router.POST("/v1/chat/completions", DecompressRequestMiddleware(), func(c *gin.Context) {
		data, readErr = io.ReadAll(c.Request.Body)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(body))
	request.Header.Set("Content-Encoding", "zstd")
	t.Cleanup(func() {
		assert.NoError(t, request.Body.Close())
	})
	router.ServeHTTP(httptest.NewRecorder(), request)
	return data, readErr
}

func TestDecompressRequestZstd(t *testing.T) {
	previousMaxBodyMB := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 16
	t.Cleanup(func() {
		constant.MaxRequestBodyMB = previousMaxBodyMB
	})

	encoder, err := zstd.NewWriter(nil, zstd.WithEncoderConcurrency(1))
	require.NoError(t, err)
	payload := bytes.Repeat([]byte(`{"role":"user","content":"hello"},`), 1<<15)
	compressed := encoder.EncodeAll(payload, nil)
	require.NoError(t, encoder.Close())

	// Window descriptors 0x50, 0x68, 0x69, and 0x98 declare 1MiB, 8MiB, 9MiB, and 512MiB windows.
	smallWindowFrame := append(append(append([]byte{}, zstdMagic...), 0x00, 0x50), zstdRLEBlock...)
	boundaryWindowFrame := append(append(append([]byte{}, zstdMagic...), 0x00, 0x68), zstdRLEBlock...)
	aboveWindowFrame := append(append(append([]byte{}, zstdMagic...), 0x00, 0x69), zstdRLEBlock...)
	largeWindowFrame := append(append(append([]byte{}, zstdMagic...), 0x00, 0x98), zstdRLEBlock...)
	// A single-segment frame uses its declared content size, here 100MiB, as the window.
	largeContentFrame := binary.LittleEndian.AppendUint64(append(append([]byte{}, zstdMagic...), 0xe0), 100<<20)
	largeContentFrame = append(largeContentFrame, zstdRLEBlock...)

	largePayload := bytes.Repeat([]byte("a"), 9<<20)
	boundedEncoder, err := zstd.NewWriter(nil, zstd.WithWindowSize(1<<20), zstd.WithSingleSegment(false), zstd.WithEncoderConcurrency(1))
	require.NoError(t, err)
	largeBody := boundedEncoder.EncodeAll(largePayload, nil)
	require.NoError(t, boundedEncoder.Close())
	var header zstd.Header
	require.NoError(t, header.Decode(largeBody))
	require.False(t, header.SingleSegment)
	require.LessOrEqual(t, header.WindowSize, uint64(8<<20))

	singleEncoder, err := zstd.NewWriter(nil, zstd.WithSingleSegment(true), zstd.WithEncoderConcurrency(1))
	require.NoError(t, err)
	boundaryContentFrame := singleEncoder.EncodeAll(largePayload[:8<<20], nil)
	aboveContentFrame := singleEncoder.EncodeAll(largePayload[:(8<<20)+1], nil)
	require.NoError(t, singleEncoder.Close())
	for _, frame := range [][]byte{boundaryContentFrame, aboveContentFrame} {
		require.NoError(t, header.Decode(frame))
		require.True(t, header.SingleSegment)
	}

	cases := []struct {
		name           string
		body           []byte
		wantBody       []byte
		wantErr        error
		maxBodyMB      int
		wantLimitError bool
	}{
		{name: "regular body is decompressed", body: compressed, wantBody: payload},
		{name: "512MiB window is rejected", body: largeWindowFrame, wantErr: zstd.ErrWindowSizeExceeded},
		{name: "100MiB single-segment window is rejected", body: largeContentFrame, wantErr: zstd.ErrDecoderSizeExceeded},
		{name: "8MiB window is accepted", body: boundaryWindowFrame, wantBody: []byte("a")},
		{name: "9MiB window is rejected", body: aboveWindowFrame, wantErr: zstd.ErrWindowSizeExceeded},
		{name: "8MiB single-segment body is accepted", body: boundaryContentFrame, wantBody: largePayload[:8<<20]},
		{name: "single-segment body one byte above 8MiB is rejected", body: aboveContentFrame, wantErr: zstd.ErrDecoderSizeExceeded},
		{name: "9MiB body with a bounded window is decompressed", body: largeBody, wantBody: largePayload},
		{name: "bounded window does not bypass the decoded body limit", body: largeBody, wantBody: largePayload[:1<<20], maxBodyMB: 1, wantLimitError: true},
		{name: "window equal to a smaller request limit is accepted", body: smallWindowFrame, wantBody: []byte("a"), maxBodyMB: 1},
		{name: "window above a smaller request limit is rejected", body: boundaryWindowFrame, wantErr: zstd.ErrWindowSizeExceeded, maxBodyMB: 1},
		{name: "single-segment window above a smaller request limit is rejected", body: boundaryContentFrame, wantErr: zstd.ErrDecoderSizeExceeded, maxBodyMB: 1},
		{name: "oversized window in a later frame is rejected", body: append(append([]byte{}, compressed...), largeWindowFrame...), wantBody: payload, wantErr: zstd.ErrWindowSizeExceeded},
		{name: "oversized single-segment window in a later frame is rejected", body: append(append([]byte{}, compressed...), aboveContentFrame...), wantBody: payload, wantErr: zstd.ErrDecoderSizeExceeded},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.maxBodyMB > 0 {
				constant.MaxRequestBodyMB = tc.maxBodyMB
				t.Cleanup(func() {
					constant.MaxRequestBodyMB = 16
				})
			}
			data, err := readZstdBody(t, tc.body)

			switch {
			case tc.wantLimitError:
				var sizeErr *http.MaxBytesError
				require.ErrorAs(t, err, &sizeErr)
				assert.Equal(t, int64(tc.maxBodyMB)<<20, sizeErr.Limit)
			case tc.wantErr != nil:
				require.ErrorIs(t, err, tc.wantErr)
			default:
				require.NoError(t, err)
			}
			if tc.wantBody == nil {
				assert.Empty(t, data)
				return
			}
			assert.Equal(t, tc.wantBody, data)
		})
	}
}

type zstdBodyReadCounter struct {
	reads atomic.Int32
}

func (b *zstdBodyReadCounter) Read([]byte) (int, error) {
	b.reads.Add(1)
	return 0, io.EOF
}

func TestDecompressRequestZstdEarlyRejectionDoesNotReadBody(t *testing.T) {
	// Keep this regression meaningful even on hosts where the default decoder
	// would otherwise be synchronous because GOMAXPROCS is 1.
	previousProcs := runtime.GOMAXPROCS(2)
	t.Cleanup(func() {
		runtime.GOMAXPROCS(previousProcs)
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/v1/chat/completions", DecompressRequestMiddleware(), func(c *gin.Context) {
		c.AbortWithStatus(http.StatusUnauthorized)
	})
	body := &zstdBodyReadCounter{}
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", io.NopCloser(body))
	request.Header.Set("Content-Encoding", "zstd")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	// Closing also joins any asynchronous decoder before checking the read count.
	require.NoError(t, request.Body.Close())
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Zero(t, body.reads.Load(), "an early rejection must not consume the request body")
}
