package groksubscription

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func imageInfo(mode int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   mode,
		RelayFormat: types.RelayFormatOpenAIImage,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 42},
	}
}

func mustRaw(t *testing.T, v any) json.RawMessage {
	t.Helper()
	raw, err := common.Marshal(v)
	if err != nil {
		t.Fatalf("marshal raw: %v", err)
	}
	return raw
}

func setEnsureMediaCredentialForTest(fn func(ctx context.Context, channelID int, requirePaid bool) (MediaCredential, error)) func() {
	original := ensureMediaCredentialForImage
	ensureMediaCredentialForImage = fn
	return func() { ensureMediaCredentialForImage = original }
}

func TestConvertGrokImageGenerationAllowedValues(t *testing.T) {
	n := uint(10)
	cases := []struct {
		name string
		req  dto.ImageRequest
		want string
	}{
		{
			name: "url 1k low square",
			req: dto.ImageRequest{
				Model:          GrokImageModel,
				Prompt:         "a cat",
				N:              &n,
				ResponseFormat: "url",
				Resolution:     "1k",
				Quality:        "low",
				AspectRatio:    "1:1",
			},
			want: `{"model":"grok-imagine-image-2.0","prompt":"a cat","n":10,"response_format":"url","aspect_ratio":"1:1","resolution":"1k","quality":"low"}`,
		},
		{
			name: "b64 2k medium wide",
			req: dto.ImageRequest{
				Model:          GrokImageModel,
				Prompt:         "a vista",
				ResponseFormat: "b64_json",
				Resolution:     "2k",
				Quality:        "medium",
				AspectRatio:    "19.5:9",
			},
			want: `{"model":"grok-imagine-image-2.0","prompt":"a vista","n":1,"response_format":"b64_json","aspect_ratio":"19.5:9","resolution":"2k","quality":"medium"}`,
		},
		{
			name: "defaults n only",
			req: dto.ImageRequest{
				Model:  GrokImageModel,
				Prompt: "default n",
			},
			want: `{"model":"grok-imagine-image-2.0","prompt":"default n","n":1}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := convertGrokImageRequest(nil, imageInfo(relayconstant.RelayModeImagesGenerations), tc.req)
			if err != nil {
				t.Fatalf("convert: %v", err)
			}
			raw, err := common.Marshal(out)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			if !jsonEqual(raw, []byte(tc.want)) {
				t.Fatalf("payload = %s, want %s", raw, tc.want)
			}
		})
	}
}

func TestConvertGrokImageGenerationAllowsEveryAspectRatio(t *testing.T) {
	allowed := []string{"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20", "auto"}
	for _, ratio := range allowed {
		t.Run(ratio, func(t *testing.T) {
			out, err := convertGrokImageRequest(nil, imageInfo(relayconstant.RelayModeImagesGenerations), dto.ImageRequest{
				Model:       GrokImageModel,
				Prompt:      "ratio",
				AspectRatio: ratio,
			})
			if err != nil {
				t.Fatalf("convert: %v", err)
			}
			got := out.(xAIImageRequest)
			if got.AspectRatio == nil || *got.AspectRatio != ratio {
				t.Fatalf("aspect_ratio = %v, want %q", got.AspectRatio, ratio)
			}
		})
	}
}

func TestConvertGrokImageRejectsInvalidInputs(t *testing.T) {
	n0 := uint(0)
	n11 := uint(11)
	cases := []struct {
		name string
		mode int
		req  dto.ImageRequest
	}{
		{name: "unsupported model", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: "grok-4", Prompt: "x"}},
		{name: "empty prompt", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: " \t"}},
		{name: "n zero", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", N: &n0}},
		{name: "n too large", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", N: &n11}},
		{name: "bad response format", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", ResponseFormat: "json"}},
		{name: "bad resolution", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Resolution: "4k"}},
		{name: "bad quality", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Quality: "high"}},
		{name: "bad aspect ratio", mode: relayconstant.RelayModeImagesGenerations, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", AspectRatio: "21:9"}},
		{name: "mask", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Mask: mustRaw(t, "mask"), Image: mustRaw(t, "https://example.com/a.png")}},
		{name: "user", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", User: mustRaw(t, "u"), Image: mustRaw(t, "https://example.com/a.png")}},
		{name: "file_id", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Extra: map[string]json.RawMessage{"file_id": mustRaw(t, "file-1")}, Image: mustRaw(t, "https://example.com/a.png")}},
		{name: "storage_options", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Extra: map[string]json.RawMessage{"storage_options": mustRaw(t, map[string]bool{"store": true})}, Image: mustRaw(t, "https://example.com/a.png")}},
		{name: "http url", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Image: mustRaw(t, "http://example.com/a.png")}},
		{name: "unsupported data uri", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Image: mustRaw(t, "data:image/webp;base64,AAAA")}},
		{name: "single image explicit aspect ratio", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", AspectRatio: "1:1", Image: mustRaw(t, "https://example.com/a.png")}},
		{name: "no edit images", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x"}},
		{name: "too many JSON images", mode: relayconstant.RelayModeImagesEdits, req: dto.ImageRequest{Model: GrokImageModel, Prompt: "x", Images: mustRaw(t, []string{"https://example.com/1.png", "https://example.com/2.png", "https://example.com/3.png", "https://example.com/4.png"})}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := convertGrokImageRequest(nil, imageInfo(tc.mode), tc.req)
			if err == nil {
				t.Fatalf("expected validation error")
			}
			var apiErr *types.NewAPIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("error = %T, want *types.NewAPIError", err)
			}
			if apiErr.StatusCode != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", apiErr.StatusCode)
			}
			if !types.IsSkipRetryError(apiErr) {
				t.Fatalf("validation errors must skip retry")
			}
		})
	}
}

func TestConvertGrokImageJSONEditSingleAndMulti(t *testing.T) {
	out, err := convertGrokImageRequest(nil, imageInfo(relayconstant.RelayModeImagesEdits), dto.ImageRequest{
		Model:  GrokImageModel,
		Prompt: "edit",
		Image:  mustRaw(t, map[string]string{"url": "https://example.com/a.png"}),
	})
	if err != nil {
		t.Fatalf("single convert: %v", err)
	}
	raw, _ := common.Marshal(out)
	wantSingle := `{"model":"grok-imagine-image-2.0","prompt":"edit","n":1,"image":{"type":"image_url","image_url":{"url":"https://example.com/a.png"}}}`
	if !jsonEqual(raw, []byte(wantSingle)) {
		t.Fatalf("single payload = %s, want %s", raw, wantSingle)
	}

	out, err = convertGrokImageRequest(nil, imageInfo(relayconstant.RelayModeImagesEdits), dto.ImageRequest{
		Model:       GrokImageModel,
		Prompt:      "combine",
		AspectRatio: "16:9",
		Images:      mustRaw(t, []any{"https://example.com/a.png", map[string]string{"url": "data:image/png;base64,QUJD"}}),
	})
	if err != nil {
		t.Fatalf("multi convert: %v", err)
	}
	raw, _ = common.Marshal(out)
	wantMulti := `{"model":"grok-imagine-image-2.0","prompt":"combine","n":1,"aspect_ratio":"16:9","images":[{"type":"image_url","image_url":{"url":"https://example.com/a.png"}},{"type":"image_url","image_url":{"url":"data:image/png;base64,QUJD"}}]}`
	if !jsonEqual(raw, []byte(wantMulti)) {
		t.Fatalf("multi payload = %s, want %s", raw, wantMulti)
	}
}

func TestCollectGrokEditImagesMultipartDeterministicJPEGPNG(t *testing.T) {
	c := newMultipartImageContext(t, []multipartImagePart{
		{Field: "image[2]", Filename: "c.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 'c'}},
		{Field: "image", Filename: "a.jpg", ContentType: "image/jpeg", Data: []byte{0xff, 0xd8, 0xff, 0xdb, 'a'}},
		{Field: "image[]", Filename: "b.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 'b'}},
	})
	got, err := collectGrokEditImages(c, dto.ImageRequest{})
	if err != nil {
		t.Fatalf("collect: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	want0 := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString([]byte{0xff, 0xd8, 0xff, 0xdb, 'a'})
	want1 := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 'b'})
	want2 := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 'c'})
	for i, want := range []string{want0, want1, want2} {
		if got[i].ImageURL.URL != want {
			t.Fatalf("image[%d] = %q, want %q", i, got[i].ImageURL.URL, want)
		}
	}
}

func TestCollectGrokEditImagesMultipartRejectsFourthAndUnsupportedMime(t *testing.T) {
	t.Run("fourth image", func(t *testing.T) {
		c := newMultipartImageContext(t, []multipartImagePart{
			{Field: "image", Filename: "a.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
			{Field: "image[]", Filename: "b.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
			{Field: "image[2]", Filename: "c.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
			{Field: "image[3]", Filename: "d.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
		})
		if _, err := collectGrokEditImages(c, dto.ImageRequest{}); err == nil {
			t.Fatalf("expected too many images error")
		}
	})
	t.Run("webp", func(t *testing.T) {
		c := newMultipartImageContext(t, []multipartImagePart{{Field: "image", Filename: "a.webp", ContentType: "image/webp", Data: []byte("webp")}})
		if _, err := collectGrokEditImages(c, dto.ImageRequest{}); err == nil {
			t.Fatalf("expected unsupported mime error")
		}
	})
}

func TestCollectGrokEditImagesMultipartRejectsSingleFileAboveLimit(t *testing.T) {
	const maxUploadBytes = 32 << 20
	data := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{'x'}, maxUploadBytes)...)
	c := newMultipartImageContext(t, []multipartImagePart{
		{Field: "image", Filename: "huge.png", ContentType: "image/png", Data: data},
	})
	_, err := collectGrokEditImages(c, dto.ImageRequest{})
	if err == nil {
		t.Fatalf("expected oversize upload error")
	}
	if !strings.Contains(err.Error(), "upload exceeds") {
		t.Fatalf("error = %v, want upload size error", err)
	}
}

func jsonEqual(a, b []byte) bool {
	var av any
	var bv any
	if err := json.Unmarshal(a, &av); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &bv); err != nil {
		return false
	}
	return common.GetJsonString(av) == common.GetJsonString(bv)
}

type multipartImagePart struct {
	Field       string
	Filename    string
	ContentType string
	Data        []byte
}

type multipartTextPart struct {
	Field string
	Value string
}

func newMultipartImageContext(t *testing.T, parts []multipartImagePart) *gin.Context {
	return newMultipartImageContextWithText(t, nil, parts)
}

func newMultipartImageContextWithText(t *testing.T, texts []multipartTextPart, parts []multipartImagePart) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, p := range texts {
		if err := writer.WriteField(p.Field, p.Value); err != nil {
			t.Fatalf("write field: %v", err)
		}
	}
	for _, p := range parts {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", `form-data; name="`+p.Field+`"; filename="`+p.Filename+`"`)
		h.Set("Content-Type", p.ContentType)
		part, err := writer.CreatePart(h)
		if err != nil {
			t.Fatalf("create part: %v", err)
		}
		if _, err := part.Write(p.Data); err != nil {
			t.Fatalf("write part: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c
}

func TestCollectGrokEditImagesMultipartRejectsMaskFile(t *testing.T) {
	c := newMultipartImageContext(t, []multipartImagePart{
		{Field: "image", Filename: "a.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
		{Field: "mask", Filename: "mask.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
	})
	_, err := convertGrokImageRequest(c, imageInfo(relayconstant.RelayModeImagesEdits), dto.ImageRequest{
		Model:  GrokImageModel,
		Prompt: "masked",
	})
	if err == nil {
		t.Fatalf("expected multipart mask file to be rejected")
	}
	var apiErr *types.NewAPIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusBadRequest || !types.IsSkipRetryError(apiErr) {
		t.Fatalf("mask file error = %#v, want skip-retry 400", err)
	}
}

func TestCollectGrokEditImagesMultipartTextAndFilesDeterministic(t *testing.T) {
	const textDataURI = "data:image/png;base64,VEVYVC1EQVRB"
	c := newMultipartImageContextWithText(t,
		[]multipartTextPart{
			{Field: "image[2]", Value: textDataURI},
			{Field: "image", Value: "https://example.com/a.png"},
		},
		[]multipartImagePart{
			{Field: "image[]", Filename: "b.jpg", ContentType: "image/jpeg", Data: []byte{0xff, 0xd8, 0xff, 0xdb, 'b'}},
		},
	)
	got, err := collectGrokEditImages(c, dto.ImageRequest{})
	if err != nil {
		t.Fatalf("collect: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	wantFile := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString([]byte{0xff, 0xd8, 0xff, 0xdb, 'b'})
	want := []string{"https://example.com/a.png", wantFile, textDataURI}
	for i := range want {
		if got[i].ImageURL.URL != want[i] {
			t.Fatalf("image[%d] = %q, want %q", i, got[i].ImageURL.URL, want[i])
		}
	}
}

func TestCollectGrokEditImagesMultipartTextOnlyAndRejectsInvalidText(t *testing.T) {
	t.Run("text only", func(t *testing.T) {
		c := newMultipartImageContextWithText(t, []multipartTextPart{
			{Field: "image", Value: "https://example.com/a.png"},
		}, nil)
		got, err := collectGrokEditImages(c, dto.ImageRequest{})
		if err != nil {
			t.Fatalf("collect: %v", err)
		}
		if len(got) != 1 || got[0].ImageURL.URL != "https://example.com/a.png" {
			t.Fatalf("images = %#v", got)
		}
	})
	t.Run("http rejected", func(t *testing.T) {
		c := newMultipartImageContextWithText(t, []multipartTextPart{
			{Field: "image", Value: "http://example.com/a.png"},
		}, nil)
		if _, err := collectGrokEditImages(c, dto.ImageRequest{}); err == nil {
			t.Fatalf("expected HTTP text image to be rejected")
		}
	})
	t.Run("max three across text and files", func(t *testing.T) {
		c := newMultipartImageContextWithText(t,
			[]multipartTextPart{
				{Field: "image", Value: "https://example.com/a.png"},
				{Field: "image[]", Value: "https://example.com/b.png"},
			},
			[]multipartImagePart{
				{Field: "image[2]", Filename: "c.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
				{Field: "image[3]", Filename: "d.png", ContentType: "image/png", Data: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
			},
		)
		if _, err := collectGrokEditImages(c, dto.ImageRequest{}); err == nil {
			t.Fatalf("expected combined text+file count above 3 to be rejected")
		}
	})
}

func TestAdaptorImageURLHeaderAndResponse(t *testing.T) {
	a := &Adaptor{}
	for _, tc := range []struct {
		mode int
		url  string
	}{
		{relayconstant.RelayModeImagesGenerations, XAIImagesGenerationsURL},
		{relayconstant.RelayModeImagesEdits, XAIImagesEditsURL},
	} {
		got, err := a.GetRequestURL(&relaycommon.RelayInfo{RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://evil.example"}})
		if err != nil {
			t.Fatalf("GetRequestURL(%d): %v", tc.mode, err)
		}
		if got != tc.url {
			t.Fatalf("url = %q, want %q", got, tc.url)
		}
	}

	restore := setEnsureMediaCredentialForTest(func(ctx context.Context, channelID int, requirePaid bool) (MediaCredential, error) {
		if channelID != 42 || !requirePaid {
			t.Fatalf("EnsureMediaCredential(%d,%v), want (42,true)", channelID, requirePaid)
		}
		return MediaCredential{ChannelID: channelID, AccessToken: "media-access-token"}, nil
	})
	defer restore()

	c := newTestGinContext(t)
	info := imageInfo(relayconstant.RelayModeImagesGenerations)
	header := http.Header{
		"Cookie":                []string{"secret"},
		HeaderXAITokenAuth:      []string{"old-cli"},
		HeaderGrokClientID:      []string{"old-client"},
		HeaderGrokClientVersion: []string{"old-version"},
	}
	if err := a.SetupRequestHeader(c, &header, info); err != nil {
		t.Fatalf("SetupRequestHeader: %v", err)
	}
	if got := header.Get("Authorization"); got != "Bearer media-access-token" {
		t.Fatalf("Authorization = %q", got)
	}
	if got := header.Get("Accept"); got != "application/json" {
		t.Fatalf("Accept = %q", got)
	}
	if got := header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q", got)
	}
	for _, forbidden := range []string{"Cookie", HeaderXAITokenAuth, HeaderGrokClientID, HeaderGrokClientVersion, "User-Agent", "X-Request-Id"} {
		if got := header.Get(forbidden); got != "" {
			t.Fatalf("%s leaked into image header: %q", forbidden, got)
		}
	}

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"created":1,"data":[{"url":"https://example.com/out.png"}]}`)),
	}
	usage, apiErr := a.DoResponse(newTestGinContext(t), resp, imageInfo(relayconstant.RelayModeImagesGenerations))
	if apiErr != nil {
		t.Fatalf("DoResponse error: %v", apiErr)
	}
	if _, ok := usage.(*dto.Usage); !ok {
		t.Fatalf("usage = %T, want *dto.Usage", usage)
	}
}

func TestAdaptorImageHeaderMapsMediaSubscriptionGateTo403(t *testing.T) {
	restore := setEnsureMediaCredentialForTest(func(ctx context.Context, channelID int, requirePaid bool) (MediaCredential, error) {
		return MediaCredential{}, ErrMediaSubscriptionRequired
	})
	defer restore()

	err := (&Adaptor{}).SetupRequestHeader(newTestGinContext(t), &http.Header{}, imageInfo(relayconstant.RelayModeImagesEdits))
	if err == nil {
		t.Fatalf("expected media subscription error")
	}
	var apiErr *types.NewAPIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("error = %T, want *types.NewAPIError", err)
	}
	if apiErr.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", apiErr.StatusCode)
	}
	if apiErr.GetErrorCode() != types.ErrorCode("media_subscription_required") {
		t.Fatalf("code = %q", apiErr.GetErrorCode())
	}
	if !types.IsSkipRetryError(apiErr) {
		t.Fatalf("media subscription gate should skip retry")
	}
}
