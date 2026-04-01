package openai

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

func TestConvertImageRequestAllowsJSONEditPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/edits", nil)

	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertImageRequest(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}, dto.ImageRequest{
		Model:          "grok-imagine-1.0-edit",
		Prompt:         "enhance this image",
		N:              lo.ToPtr(uint(1)),
		Size:           "1024x1024",
		ResponseFormat: "url",
		Image:          []byte(`{"url":"data:image/png;base64,aGVsbG8="}`),
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	body, ok := converted.(*bytes.Buffer)
	if !ok {
		t.Fatalf("expected *bytes.Buffer, got %T", converted)
	}

	mediaType, params, err := mime.ParseMediaType(ctx.Request.Header.Get("Content-Type"))
	if err != nil {
		t.Fatalf("parse content type failed: %v", err)
	}
	if mediaType != "multipart/form-data" {
		t.Fatalf("unexpected media type: %s", mediaType)
	}

	form, err := multipart.NewReader(bytes.NewReader(body.Bytes()), params["boundary"]).ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("read multipart form failed: %v", err)
	}
	if form.Value["model"][0] != "grok-imagine-1.0-edit" {
		t.Fatalf("unexpected model: %v", form.Value["model"])
	}
	if form.Value["prompt"][0] != "enhance this image" {
		t.Fatalf("unexpected prompt: %v", form.Value["prompt"])
	}

	files := form.File["image"]
	if len(files) != 1 {
		t.Fatalf("expected one image file, got %d", len(files))
	}
	file, err := files[0].Open()
	if err != nil {
		t.Fatalf("open image file failed: %v", err)
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("read image file failed: %v", err)
	}
	if string(content) != "hello" {
		t.Fatalf("unexpected image file content: %q", string(content))
	}
}
