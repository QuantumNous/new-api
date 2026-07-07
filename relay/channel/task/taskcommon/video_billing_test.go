package taskcommon

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestAliHappyHorseConverterResolves720PTier(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.1-r2v",
		Duration: 5,
		Metadata: map[string]any{
			"resolution": "720P",
		},
	}
	params, err := ConvertVideoBillingParams(nil, req)
	if err != nil {
		t.Fatalf("convert video billing params failed: %v", err)
	}
	if params.Tier != "720p" {
		t.Fatalf("expected 720p, got %s", params.Tier)
	}
}

func TestAliHappyHorseConverterDefaultsTo1080PTier(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.1-r2v",
		Duration: 5,
	}
	params, err := ConvertVideoBillingParams(nil, req)
	if err != nil {
		t.Fatalf("convert video billing params failed: %v", err)
	}
	if params.Tier != "1080p" {
		t.Fatalf("expected 1080p, got %s", params.Tier)
	}
}

func TestAliKlingConverterResolvesStdTo720P(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    "kling/kling-v3-video-generation",
		Duration: 5,
		Metadata: map[string]any{
			"mode": "std",
		},
	}
	params, err := ConvertVideoBillingParams(nil, req)
	if err != nil {
		t.Fatalf("convert video billing params failed: %v", err)
	}
	if params.Tier != "720p" {
		t.Fatalf("expected 720p, got %s", params.Tier)
	}
}

func TestAliKlingConverterDefaultsProTo1080P(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    "kling/kling-v3-video-generation",
		Duration: 5,
	}
	params, err := ConvertVideoBillingParams(nil, req)
	if err != nil {
		t.Fatalf("convert video billing params failed: %v", err)
	}
	if params.Tier != "1080p" {
		t.Fatalf("expected 1080p, got %s", params.Tier)
	}
}

func TestAliKlingConverterResolvesSilentFromAudioFalse(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:    "kling/kling-v3-video-generation",
		Duration: 5,
		Metadata: map[string]any{
			"audio": false,
		},
	}
	params, err := ConvertVideoBillingParams(nil, req)
	if err != nil {
		t.Fatalf("convert video billing params failed: %v", err)
	}
	if params.AudioEnabled {
		t.Fatalf("expected audio disabled")
	}
}
