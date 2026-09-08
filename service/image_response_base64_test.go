package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageBase64PreservesNativePayloadWithoutFetchingURL(t *testing.T) {
	body := []byte(`{"data":[{"b64_json":"original-base64","url":"http://127.0.0.1:1/unused"}],"vendor":"keep"}`)
	result, err := EnsureImageBase64Response(context.Background(), body)
	require.NoError(t, err)
	assert.Equal(t, string(body), string(result))
}

func TestImageBase64RejectsInvalidOrPartialDownloads(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	old := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = old })
	InitHttpClient()
	for _, status := range []int{200, 206, 403} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_, _ = w.Write([]byte("<html>not an image</html>"))
			}))
			defer server.Close()
			result, err := EnsureImageBase64Response(context.Background(), []byte(fmt.Sprintf(`{"data":[{"url":%q}]}`, server.URL+"?secret=hidden")))
			require.Error(t, err)
			assert.Nil(t, result)
			assert.NotContains(t, err.Error(), "hidden")
		})
	}
}

func TestImageBase64ConvertsMixedImagesAndHonorsReadLimit(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	old := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = old })
	InitHttpClient()
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, image.NewGray(image.Rect(0, 0, 2, 3))))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		_, _ = w.Write(buf.Bytes())
	}))
	defer server.Close()
	body := []byte(fmt.Sprintf(`{"data":[{"b64_json":"keep"},{"url":%q,"revised_prompt":"original"}],"usage":{"total_tokens":20}}`, server.URL))
	result, err := EnsureImageBase64Response(context.Background(), body)
	require.NoError(t, err)
	assert.Equal(t, "keep", gjson.GetBytes(result, "data.0.b64_json").String())
	assert.Equal(t, base64.StdEncoding.EncodeToString(buf.Bytes()), gjson.GetBytes(result, "data.1.b64_json").String())
	assert.Equal(t, "original", gjson.GetBytes(result, "data.1.revised_prompt").String())
	assert.EqualValues(t, 20, gjson.GetBytes(result, "usage.total_tokens").Int())
	_, err = downloadImageForBase64(context.Background(), server.URL, 16)
	require.ErrorContains(t, err, "size limit")
}

func TestImageBase64RejectsCancelledOrMissingImages(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := EnsureImageBase64Response(ctx, []byte(`{"data":[{"url":"https://example.com/image.png"}]}`))
	require.ErrorContains(t, err, "cancelled")
	_, err = EnsureImageBase64Response(context.Background(), []byte(`{"data":[{}]}`))
	require.ErrorContains(t, err, "neither Base64")
}
