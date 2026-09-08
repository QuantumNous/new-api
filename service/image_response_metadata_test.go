package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageMetadataMixedSizesAndUnknownFields(t *testing.T) {
	var first, second bytes.Buffer
	require.NoError(t, png.Encode(&first, image.NewNRGBA(image.Rect(0, 0, 2, 3))))
	require.NoError(t, jpeg.Encode(&second, image.NewNRGBA(image.Rect(0, 0, 4, 5)), nil))
	body, err := common.Marshal(map[string]any{"created": 123, "size": "1024x1024", "quality": "low", "background": "opaque", "vendor": map[string]string{"job": "original"}, "data": []any{
		map[string]any{"b64_json": base64.StdEncoding.EncodeToString(first.Bytes()), "size": "incorrect"},
		map[string]any{"b64_json": base64.StdEncoding.EncodeToString(second.Bytes())},
	}})
	require.NoError(t, err)
	result := string(NormalizeImageJSONResponse(context.Background(), body))
	assert.Equal(t, "2x3", gjson.Get(result, "data.0.size").String())
	assert.Equal(t, "4x5", gjson.Get(result, "data.1.size").String())
	assert.Equal(t, "jpeg", gjson.Get(result, "data.1.output_format").String())
	for _, path := range []string{"size", "output_format", "usage", "data.0.url", "data.1.revised_prompt"} {
		assert.Equal(t, "null", gjson.Get(result, path).Raw)
	}
	assert.Equal(t, "low", gjson.Get(result, "quality").String())
	assert.Equal(t, "opaque", gjson.Get(result, "background").String())
	assert.Equal(t, "original", gjson.Get(result, "vendor.job").String())
}

func TestImageMetadataAlwaysDerivesTopLevelSize(t *testing.T) {
	var imageBytes bytes.Buffer
	require.NoError(t, png.Encode(&imageBytes, image.NewNRGBA(image.Rect(0, 0, 2, 3))))
	for _, test := range []struct{ name, encoded, expected string }{
		{"ignores upstream claimed size", base64.StdEncoding.EncodeToString(imageBytes.Bytes()), `"2x3"`},
		{"does not retain unverified upstream size", "not-an-image", "null"},
	} {
		t.Run(test.name, func(t *testing.T) {
			body, err := common.Marshal(map[string]any{"size": "1024x1024", "data": []any{map[string]any{"b64_json": test.encoded}}})
			require.NoError(t, err)
			result := string(NormalizeImageJSONResponse(context.Background(), body))
			assert.Equal(t, test.expected, gjson.Get(result, "size").Raw)
			assert.Equal(t, test.expected, gjson.Get(result, "data.0.size").Raw)
		})
	}
}

func TestImageMetadataReadsBase64WithLargeJPEGMetadata(t *testing.T) {
	var original bytes.Buffer
	require.NoError(t, jpeg.Encode(&original, image.NewGray(image.Rect(0, 0, 4, 5)), nil))
	segment := make([]byte, 65537)
	copy(segment, []byte{0xff, 0xe1, 0xff, 0xff})
	data := append([]byte{0xff, 0xd8}, bytes.Repeat(segment, 9)...)
	data = append(data, original.Bytes()[2:]...)
	body, err := common.Marshal(map[string]any{"data": []any{map[string]any{"b64_json": base64.StdEncoding.EncodeToString(data)}}})
	require.NoError(t, err)
	result := NormalizeImageJSONResponse(context.Background(), body)
	assert.Equal(t, "4x5", gjson.GetBytes(result, "size").String())
}

func TestImageMetadataURLProbeAndRedirect(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	previous := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = previous })
	InitHttpClient()
	var pngBytes bytes.Buffer
	require.NoError(t, png.Encode(&pngBytes, image.NewNRGBA(image.Rect(0, 0, 7, 9))))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Empty(t, r.Header.Get("Authorization"))
		assert.Empty(t, r.Header.Get("Cookie"))
		assert.Empty(t, r.Header.Get("Referer"))
		assert.Equal(t, "bytes=0-524287", r.Header.Get("Range"))
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/image", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write(pngBytes.Bytes())
	}))
	defer server.Close()
	location := server.URL + "/redirect?signature=private"
	body := fmt.Sprintf(`{"data":[{"url":%q}],"usage":{"total_tokens":7}}`, location)
	result := string(NormalizeImageJSONResponse(context.Background(), []byte(body)))
	assert.Equal(t, "7x9", gjson.Get(result, "data.0.size").String())
	assert.Equal(t, "7x9", gjson.Get(result, "size").String())
	assert.Equal(t, "png", gjson.Get(result, "output_format").String())
	assert.Equal(t, location, gjson.Get(result, "data.0.url").String())
	assert.Equal(t, `{"total_tokens":7}`, gjson.Get(result, "usage").Raw)
}

func TestImageMetadataFailureKeepsImageAndNullFields(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	previous := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = previous })
	InitHttpClient()
	for _, status := range []int{http.StatusForbidden, http.StatusOK} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_, _ = w.Write([]byte(strings.Repeat("not an image", 100)))
			}))
			defer server.Close()
			body := fmt.Sprintf(`{"data":[{"url":%q,"revised_prompt":"keep me"}]}`, server.URL)
			result := string(NormalizeImageJSONResponse(context.Background(), []byte(body)))
			assert.Equal(t, server.URL, gjson.Get(result, "data.0.url").String())
			assert.Equal(t, "keep me", gjson.Get(result, "data.0.revised_prompt").String())
			for _, field := range []string{"width", "height", "size", "output_format"} {
				assert.Equal(t, "null", gjson.Get(result, "data.0."+field).Raw)
			}
		})
	}
}

func TestImageMetadataBlocksPrivateURLAndCancelledRequests(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	previous := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = previous })
	InitHttpClient()
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1) }))
	defer server.Close()
	body := fmt.Sprintf(`{"data":[{"url":%q}]}`, server.URL)
	result := string(NormalizeImageJSONResponse(context.Background(), []byte(body)))
	assert.Equal(t, "null", gjson.Get(result, "data.0.width").Raw)
	assert.Zero(t, calls.Load())
	setting.AllowPrivateIp = true
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result = string(NormalizeImageJSONResponse(ctx, []byte(body)))
	assert.Equal(t, server.URL, gjson.Get(result, "data.0.url").String())
	assert.Zero(t, calls.Load())
}

func TestImageMetadataCancelsStalledBodyWithoutLosingURL(t *testing.T) {
	setting := system_setting.GetFetchSetting()
	previous := *setting
	*setting = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	t.Cleanup(func() { *setting = previous })
	InitHttpClient()
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan string, 1)
	go func() {
		body := fmt.Sprintf(`{"data":[{"url":%q}]}`, server.URL)
		result <- string(NormalizeImageJSONResponse(ctx, []byte(body)))
	}()
	<-started
	cancel()
	response := <-result
	assert.Equal(t, server.URL, gjson.Get(response, "data.0.url").String())
	assert.Equal(t, "null", gjson.Get(response, "data.0.size").Raw)
}
