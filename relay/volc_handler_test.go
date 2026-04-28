package relay

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
	// Initialize the HTTP client so DoRequest doesn't panic on nil client.
	service.InitHttpClient()
}

// newTestGinContextWithBody creates a gin.Context with a JSON body stored in
// common.KeyBodyStorage so it can be retrieved via common.GetBodyStorage.
func newTestGinContextWithBody(t *testing.T, body []byte) *gin.Context {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v3/images/generations", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	// Pre-populate the body storage so GetBodyStorage works without a real DB/network
	bs, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("failed to create body storage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)
	return c
}

// TestVolcImageHelper_WrongRequestType verifies that VolcImageHelper returns an
// error when the RelayInfo.Request is not a *dto.VolcImageRequest.
func TestVolcImageHelper_WrongRequestType(t *testing.T) {
	body := []byte(`{"model":"test"}`)
	c := newTestGinContextWithBody(t, body)

	info := &relaycommon.RelayInfo{
		Request: &dto.ImageRequest{Model: "test"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeVolcAdapter,
			ApiType:     constant.APITypeVolcEngine,
		},
	}

	err := VolcImageHelper(c, info)
	if err == nil {
		t.Fatal("expected error for wrong request type, got nil")
	}
	if err.StatusCode != http.StatusBadRequest {
		t.Errorf("expected StatusBadRequest, got %d", err.StatusCode)
	}
}

// TestVolcImageHelper_UnsupportedChannelType verifies that VolcImageHelper
// returns an error when the channel type (e.g. OpenAI) does not support Volc format.
func TestVolcImageHelper_UnsupportedChannelType(t *testing.T) {
	body := []byte(`{"model":"gpt-image-1","prompt":"test"}`)
	c := newTestGinContextWithBody(t, body)

	req := &dto.VolcImageRequest{Model: "gpt-image-1", Prompt: "test"}
	info := &relaycommon.RelayInfo{
		Request: req,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
			ApiType:     constant.APITypeOpenAI,
		},
	}

	err := VolcImageHelper(c, info)
	if err == nil {
		t.Fatal("expected error for unsupported channel type, got nil")
	}
	// Should be a 400 from ConvertVolcRequest returning "unsupported"
	if err.StatusCode != http.StatusBadRequest {
		t.Errorf("expected StatusBadRequest, got %d (error: %v)", err.StatusCode, err)
	}
}

// TestVolcImageHelper_BodyStoragePassThrough verifies the core body-forwarding
// mechanism used by VolcImageHelper: that GetBodyStorage + ReaderOnly returns
// the exact original bytes byte-for-byte.
//
// This is the key invariant: Volc-specific fields that VolcImageRequest does not
// model (sequential_image_generation, optimize_prompt_options, etc.) survive
// the round-trip because we forward the raw body, not the parsed/re-serialized struct.
func TestVolcImageHelper_BodyStoragePassThrough(t *testing.T) {
	// Body with weird Volc-specific fields not modeled in VolcImageRequest
	originalBody := []byte(`{"model":"seedance-2-0","prompt":"cinematic shot","sequential_image_generation":"auto","optimize_prompt_options":{"mode":"fast"},"watermark":false}`)

	c := newTestGinContextWithBody(t, originalBody)

	// This mirrors what VolcImageHelper does to get the request body for upstream
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		t.Fatalf("GetBodyStorage failed: %v", err)
	}
	reader := common.ReaderOnly(storage)

	gotBytes, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll failed: %v", err)
	}

	if !bytes.Equal(gotBytes, originalBody) {
		t.Errorf("body round-trip differs:\n  original: %s\n  got:      %s", originalBody, gotBytes)
	}
}

// TestVolcImageHelper_BodyStorageReusable verifies that the body can be read
// multiple times (once for parse, once for forwarding to upstream) without data loss.
func TestVolcImageHelper_BodyStorageReusable(t *testing.T) {
	originalBody := []byte(`{"model":"m1","prompt":"test","tools":[{"type":"web_search"}]}`)
	c := newTestGinContextWithBody(t, originalBody)

	// First read — simulates the parse step in valid_request.go
	storage1, err := common.GetBodyStorage(c)
	if err != nil {
		t.Fatalf("first GetBodyStorage: %v", err)
	}
	firstRead, err := storage1.Bytes()
	if err != nil {
		t.Fatalf("first Bytes(): %v", err)
	}
	if !bytes.Equal(firstRead, originalBody) {
		t.Errorf("first read mismatch")
	}

	// Second read — simulates what VolcImageHelper does for upstream forwarding
	storage2, err := common.GetBodyStorage(c)
	if err != nil {
		t.Fatalf("second GetBodyStorage: %v", err)
	}
	reader := common.ReaderOnly(storage2)
	secondRead, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("second ReadAll: %v", err)
	}

	if !bytes.Equal(secondRead, originalBody) {
		t.Errorf("second read mismatch:\n  original: %s\n  got:      %s", originalBody, secondRead)
	}
}

// TestVolcImageHelper_ConvertVolcRequest_CalledOnVolcChannel verifies that
// volcengine.Adaptor implements volcImageConverter and ConvertVolcRequest
// returns no error (it is a no-op pass-through for the native Volc channel).
func TestVolcImageHelper_ConvertVolcRequest_CalledOnVolcChannel(t *testing.T) {
	body := []byte(`{"model":"high-aes-general-v21-L","prompt":"test"}`)
	c := newTestGinContextWithBody(t, body)

	req := &dto.VolcImageRequest{Model: "high-aes-general-v21-L", Prompt: "test"}
	info := &relaycommon.RelayInfo{
		Request: req,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeVolcAdapter,
			ApiType:     constant.APITypeVolcEngine,
			ApiKey:      "test-key",
		},
	}
	info.RelayFormat = types.RelayFormatVolc
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		t.Fatal("GetAdaptor returned nil for APITypeVolcEngine")
	}
	adaptor.Init(info)

	converter, ok := adaptor.(volcImageConverter)
	if !ok {
		t.Fatal("volcengine.Adaptor does not implement volcImageConverter")
	}
	_, err := converter.ConvertVolcRequest(c, info, req)
	if err != nil {
		t.Errorf("ConvertVolcRequest on volcengine channel returned error: %v", err)
	}
}

// TestVolcImageHelper_ConvertVolcRequest_ErrorOnNonVolcChannel verifies that
// non-Volc channels (e.g. OpenAI) do not implement volcImageConverter, so
// VolcImageHelper will return a "channel does not support" error.
func TestVolcImageHelper_ConvertVolcRequest_ErrorOnNonVolcChannel(t *testing.T) {
	body := []byte(`{"model":"dall-e-3","prompt":"test"}`)

	req := &dto.VolcImageRequest{Model: "dall-e-3", Prompt: "test"}

	adaptor := GetAdaptor(constant.APITypeOpenAI)
	if adaptor == nil {
		t.Fatal("GetAdaptor returned nil for APITypeOpenAI")
	}

	_, ok := adaptor.(volcImageConverter)
	if ok {
		t.Error("expected openai.Adaptor NOT to implement volcImageConverter")
	}
	// Confirm VolcImageHelper itself returns a 400 error for this channel.
	c2 := newTestGinContextWithBody(t, body)
	info2 := &relaycommon.RelayInfo{
		Request: req,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
			ApiType:     constant.APITypeOpenAI,
		},
	}
	apiErr := VolcImageHelper(c2, info2)
	if apiErr == nil {
		t.Error("expected VolcImageHelper to return error for non-Volc channel, got nil")
	}
}
