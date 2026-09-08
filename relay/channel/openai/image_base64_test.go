package openai

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageURLResponseReturnsCompleteBase64(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	old := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = old })
	service.InitHttpClient()
	var buf bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.NoCompression}
	require.NoError(t, encoder.Encode(&buf, image.NewGray(image.Rect(0, 0, 1024, 600))))
	require.Greater(t, buf.Len(), 512<<10)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		assert.Empty(t, r.Header.Get("Range"))
		assert.Empty(t, r.Header.Get("Authorization"))
		assert.Empty(t, r.Header.Get("Cookie"))
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(buf.Bytes())
	}))
	defer server.Close()
	body := fmt.Sprintf(`{"data":[{"url":%q}],"usage":{"input_tokens":11,"output_tokens":9,"total_tokens":20}}`, server.URL)
	c, recorder, response, info := newImageTestContext(t, body, "application/json", false)
	usage, apiErr := OpenaiImageHandler(c, info, response)
	require.Nil(t, apiErr)
	encoded := gjson.Get(recorder.Body.String(), "data.0.b64_json").String()
	require.NotEmpty(t, encoded)
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	require.NoError(t, err)
	assert.Equal(t, sha256.Sum256(buf.Bytes()), sha256.Sum256(decoded))
	assert.Equal(t, "1024x600", gjson.Get(recorder.Body.String(), "size").String())
	assert.EqualValues(t, 1, calls.Load(), "metadata must reuse the downloaded image")
	assert.EqualValues(t, 20, usage.TotalTokens)
}

func TestImageURLDeliveryFailureDoesNotWriteSuccessOrRetry(t *testing.T) {
	url := "http://127.0.0.1:1/private?secret=do-not-log"
	c, recorder, response, info := newImageTestContext(t, fmt.Sprintf(`{"data":[{"url":%q}]}`, url), "application/json", false)
	_, apiErr := OpenaiImageHandler(c, info, response)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusFailedDependency, apiErr.StatusCode)
	assert.Equal(t, "false", recorder.Header().Get("x-should-retry"))
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.False(t, c.Writer.Written())
	assert.Empty(t, recorder.Body.String())
	assert.NotContains(t, apiErr.Error(), "do-not-log")
}

func TestImagePrivateDrawingSpoolKeepsRecoverableURL(t *testing.T) {
	location := "http://127.0.0.1:1/unavailable"
	c, recorder, response, info := newImageTestContext(t, fmt.Sprintf(`{"data":[{"url":%q}]}`, location), "application/json", false)
	c.Set(service.DrawingResponseSpoolContextKey, true)
	_, apiErr := OpenaiImageHandler(c, info, response)
	require.Nil(t, apiErr)
	assert.Equal(t, location, gjson.Get(recorder.Body.String(), "data.0.url").String())
}
