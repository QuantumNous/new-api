package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/tidwall/gjson"
)

func TestRemoveDisabledFieldsRemovesMaxOutputTokensWhenDisabled(t *testing.T) {
	input := []byte(`{"model":"gpt-5.5","max_output_tokens":1024,"input":"hello"}`)

	out, err := RemoveDisabledFields(input, dto.ChannelOtherSettings{DisableMaxOutputTokens: true}, false)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}

	if gjson.GetBytes(out, "max_output_tokens").Exists() {
		t.Fatalf("expected max_output_tokens to be removed, got %s", out)
	}
	if !gjson.GetBytes(out, "input").Exists() {
		t.Fatalf("expected unrelated fields to remain, got %s", out)
	}
}

func TestRemoveDisabledFieldsRemovesMaxOutputTokensWhenPassThroughEnabled(t *testing.T) {
	input := []byte(`{"model":"gpt-5.5","max_output_tokens":1024,"service_tier":"flex","input":"hello"}`)

	out, err := RemoveDisabledFields(input, dto.ChannelOtherSettings{DisableMaxOutputTokens: true}, true)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}

	if gjson.GetBytes(out, "max_output_tokens").Exists() {
		t.Fatalf("expected max_output_tokens to be removed, got %s", out)
	}
	if !gjson.GetBytes(out, "service_tier").Exists() {
		t.Fatalf("expected pass-through fields to remain, got %s", out)
	}
}

func TestRemoveDisabledFieldsKeepsMaxOutputTokensByDefault(t *testing.T) {
	input := []byte(`{"model":"gpt-5.5","max_output_tokens":1024,"input":"hello"}`)

	out, err := RemoveDisabledFields(input, dto.ChannelOtherSettings{}, false)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}

	if !gjson.GetBytes(out, "max_output_tokens").Exists() {
		t.Fatalf("expected max_output_tokens to remain, got %s", out)
	}
}
