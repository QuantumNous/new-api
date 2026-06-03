package elevenlabs

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestConvertTTSRequest(t *testing.T) {
	r, err := convertTTSRequest(dto.AudioRequest{
		Model: "eleven_flash_v2_5",
		Input: "hello world",
		Voice: "VOICE123",
	})
	if err != nil {
		t.Fatalf("convertTTSRequest error: %v", err)
	}
	body, _ := io.ReadAll(r)
	var got ttsRequest
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("body not valid json: %v (%s)", err, body)
	}
	if got.Text != "hello world" {
		t.Errorf("text = %q, want %q", got.Text, "hello world")
	}
	if got.ModelID != "eleven_flash_v2_5" {
		t.Errorf("model_id = %q, want eleven_flash_v2_5", got.ModelID)
	}
	if got.VoiceSettings == nil {
		t.Error("voice_settings should be set")
	}
}

func TestConvertTTSRequestDefaultsModel(t *testing.T) {
	r, _ := convertTTSRequest(dto.AudioRequest{Input: "hi"})
	body, _ := io.ReadAll(r)
	if !strings.Contains(string(body), defaultModelID) {
		t.Errorf("expected default model_id %q in body %s", defaultModelID, body)
	}
}

func TestGetRequestURL(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		Request:     &dto.AudioRequest{Voice: "VOICE123"},
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.elevenlabs.io"},
	}
	url, err := a.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL error: %v", err)
	}
	if url != "https://api.elevenlabs.io/v1/text-to-speech/VOICE123" {
		t.Errorf("url = %q", url)
	}

	// Missing voice → falls back to the default voice id.
	info.Request = &dto.AudioRequest{}
	url, _ = a.GetRequestURL(info)
	if !strings.HasSuffix(url, "/v1/text-to-speech/"+defaultVoiceID) {
		t.Errorf("expected default voice, got %q", url)
	}
}

func TestGetRequestURLRejectsNonAudio(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions}
	if _, err := a.GetRequestURL(info); err == nil {
		t.Error("expected error for non-audio relay mode")
	}
}

func TestMeta(t *testing.T) {
	a := &Adaptor{}
	if a.GetChannelName() != ChannelName {
		t.Errorf("channel name = %q", a.GetChannelName())
	}
	if len(a.GetModelList()) == 0 {
		t.Error("model list should not be empty")
	}
}
