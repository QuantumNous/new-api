package dto

import (
	"encoding/json"
	"testing"
)

func TestGeneralErrorResponse_ToMessage_ObjectWithoutMessageFallsBackToRaw(t *testing.T) {
	resp := GeneralErrorResponse{
		Error: json.RawMessage(`{"code":"model_not_found"}`),
	}
	if got, want := resp.ToMessage(), `{"code":"model_not_found"}`; got != want {
		t.Fatalf("ToMessage() = %q, want %q", got, want)
	}
}

func TestGeneralErrorResponse_ToMessage_ObjectWithMessageUsesMessage(t *testing.T) {
	resp := GeneralErrorResponse{
		Error: json.RawMessage(`{"message":"nope","type":"invalid_request_error"}`),
	}
	if got, want := resp.ToMessage(), "nope"; got != want {
		t.Fatalf("ToMessage() = %q, want %q", got, want)
	}
}

func TestGeneralErrorResponse_ToMessage_StringErrorUsesString(t *testing.T) {
	resp := GeneralErrorResponse{
		Error: json.RawMessage(`"nope"`),
	}
	if got, want := resp.ToMessage(), "nope"; got != want {
		t.Fatalf("ToMessage() = %q, want %q", got, want)
	}
}

func TestGeneralErrorResponse_ToMessage_DetailUsesDetail(t *testing.T) {
	var resp GeneralErrorResponse
	if err := json.Unmarshal([]byte(`{"detail":"Unsupported parameter: messages"}`), &resp); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}
	if got, want := resp.ToMessage(), "Unsupported parameter: messages"; got != want {
		t.Fatalf("ToMessage() = %q, want %q", got, want)
	}
}
