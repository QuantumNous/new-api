package xai

import (
	"bytes"
	"encoding/json"
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

func TestConvertImageRequestBuildsMultipartForEditImage(t *testing.T) {
	adaptor := &Adaptor{}
	image := json.RawMessage(`{"url":"data:image/png;base64,aGVsbG8="}`)
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/edits", nil)

	converted, err := adaptor.ConvertImageRequest(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}, dto.ImageRequest{
		Model:          "grok-imagine-1.0-edit",
		Prompt:         "make it watercolor",
		N:              lo.ToPtr(uint(2)),
		Image:          image,
		Size:           "1024x1024",
		ResponseFormat: "url",
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

	reader := multipart.NewReader(bytes.NewReader(body.Bytes()), params["boundary"])
	form, err := reader.ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("read multipart form failed: %v", err)
	}

	if form.Value["model"][0] != "grok-imagine-1.0-edit" {
		t.Fatalf("unexpected model: %v", form.Value["model"])
	}
	if form.Value["prompt"][0] != "make it watercolor" {
		t.Fatalf("unexpected prompt: %v", form.Value["prompt"])
	}
	if form.Value["n"][0] != "2" {
		t.Fatalf("unexpected n: %v", form.Value["n"])
	}
	if form.Value["size"][0] != "1024x1024" {
		t.Fatalf("unexpected size: %v", form.Value["size"])
	}
	if form.Value["response_format"][0] != "url" {
		t.Fatalf("unexpected response_format: %v", form.Value["response_format"])
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

func TestConvertImageRequestPreservesSize(t *testing.T) {
	adaptor := &Adaptor{}

	converted, err := adaptor.ConvertImageRequest(nil, nil, dto.ImageRequest{
		Model:          "grok-imagine-1.0",
		Prompt:         "draw a city skyline",
		Size:           "1536x1024",
		ResponseFormat: "url",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	xaiReq, ok := converted.(ImageRequest)
	if !ok {
		t.Fatalf("expected xai.ImageRequest, got %T", converted)
	}
	if xaiReq.Size != "1536x1024" {
		t.Fatalf("unexpected size: %s", xaiReq.Size)
	}
}

func TestResolveImagePayloadSupportsPlainURLObject(t *testing.T) {
	filename, mimeType, content, err := resolveImagePayload([]byte(`{"url":"data:image/webp;base64,dGVzdA==","filename":"sample.webp"}`))
	if err != nil {
		t.Fatalf("resolveImagePayload returned error: %v", err)
	}
	if filename != "sample.webp" {
		t.Fatalf("unexpected filename: %s", filename)
	}
	if mimeType != "image/webp" {
		t.Fatalf("unexpected mime type: %s", mimeType)
	}
	if string(content) != "test" {
		t.Fatalf("unexpected content: %q", string(content))
	}
}

func TestModelListIncludesGrokImagineOnePointZeroVariants(t *testing.T) {
	expected := []string{
		"grok-imagine-1.0",
		"grok-imagine-1.0-fast",
		"grok-imagine-1.0-edit",
	}

	for _, model := range expected {
		if !lo.Contains(ModelList, model) {
			t.Fatalf("model list missing %s", model)
		}
	}
}
