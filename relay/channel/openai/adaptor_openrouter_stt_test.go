package openai

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

func TestConvertAudioRequestOpenRouterTranscriptionMultipartToJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("model", "openai/whisper-large-v3-turbo"); err != nil {
		t.Fatalf("write model: %v", err)
	}
	if err := writer.WriteField("temperature", "0"); err != nil {
		t.Fatalf("write temperature: %v", err)
	}
	part, err := writer.CreateFormFile("file", "sample.wav")
	if err != nil {
		t.Fatalf("create file: %v", err)
	}
	audioBytes := []byte("RIFFdemoWAVEfmt ")
	if _, err = part.Write(audioBytes); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err = writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = req

	storage, err := common.CreateBodyStorage(body.Bytes())
	if err != nil {
		t.Fatalf("create body storage: %v", err)
	}
	defer storage.Close()
	c.Set(common.KeyBodyStorage, storage)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeAudioTranscription,
		ChannelMeta:    &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter},
		RequestURLPath: "/v1/audio/transcriptions",
	}

	reader, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{
		Model: "openai/whisper-large-v3-turbo",
	})
	if err != nil {
		t.Fatalf("ConvertAudioRequest returned error: %v", err)
	}

	payload, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read payload: %v", err)
	}
	if got := c.Request.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected application/json content-type, got %q", got)
	}

	var requestBody map[string]any
	if err = common.Unmarshal(payload, &requestBody); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if got, ok := requestBody["model"].(string); !ok || got != "openai/whisper-large-v3-turbo" {
		t.Fatalf("unexpected model: %#v", requestBody["model"])
	}
	if got, ok := requestBody["temperature"].(string); !ok || got != "0" {
		t.Fatalf("unexpected temperature: %#v", requestBody["temperature"])
	}

	inputAudio, ok := requestBody["input_audio"].(map[string]any)
	if !ok {
		t.Fatalf("input_audio missing or invalid: %#v", requestBody["input_audio"])
	}
	if got, ok := inputAudio["format"].(string); !ok || got != "wav" {
		t.Fatalf("unexpected format: %#v", inputAudio["format"])
	}
	wantBase64 := base64.StdEncoding.EncodeToString(audioBytes)
	if got, ok := inputAudio["data"].(string); !ok || got != wantBase64 {
		t.Fatalf("unexpected base64 data: %#v", inputAudio["data"])
	}
}

func TestConvertAudioRequestOpenRouterTranscriptionRequiresMultipartFile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("model", "openai/whisper-large-v3-turbo"); err != nil {
		t.Fatalf("write model: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = req

	storage, err := common.CreateBodyStorage(body.Bytes())
	if err != nil {
		t.Fatalf("create body storage: %v", err)
	}
	defer storage.Close()
	c.Set(common.KeyBodyStorage, storage)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeAudioTranscription,
		ChannelMeta:    &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter},
		RequestURLPath: "/v1/audio/transcriptions",
	}

	_, err = adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{
		Model: "openai/whisper-large-v3-turbo",
	})
	if err == nil {
		t.Fatal("expected error when file is missing")
	}
	if !strings.Contains(err.Error(), "file is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}
