package openaicompat

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestSanitizeToolCallIDs_PassThroughValid(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{
				Role: "assistant",
			},
		},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: "call_abc-123", Type: "function", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	if calls[0].ID != "call_abc-123" {
		t.Errorf("id changed: %q", calls[0].ID)
	}
}

func TestSanitizeToolCallIDs_StripAndKeep(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "assistant"}},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: "call:abc/123", Type: "function", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	if calls[0].ID != "callabc123" {
		t.Errorf("got %q want callabc123", calls[0].ID)
	}
}

func TestSanitizeToolCallIDs_UUIDFallbackEmptyResidue(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "assistant"}},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: "::::", Type: "function", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	// 32-char dash-stripped UUID; must be alphanumeric.
	id := calls[0].ID
	if len(id) < 16 {
		t.Errorf("uuid too short: %q", id)
	}
	for _, r := range id {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			t.Errorf("uuid has bad char: %q", id)
		}
	}
}

func TestSanitizeToolCallIDs_UUIDFallbackOver64(t *testing.T) {
	long := strings.Repeat("a", 70)
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "assistant"}},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: long, Type: "function", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	if calls[0].ID == long {
		t.Errorf("70-char id should have been replaced")
	}
	if len(calls[0].ID) > 64 {
		t.Errorf("replacement too long: %d", len(calls[0].ID))
	}
}

func TestSanitizeToolCallIDs_ConsistentRemap(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{Role: "assistant"},
			{Role: "tool", Content: "ok", ToolCallId: "::::"},
		},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: "::::", Type: "function", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	newID := calls[0].ID
	if req.Messages[1].ToolCallId != newID {
		t.Errorf("tool message id not remapped: got=%q want=%q", req.Messages[1].ToolCallId, newID)
	}
}

func TestSanitizeToolCallIDs_TypeDefaulted(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "assistant"}},
	}
	req.Messages[0].SetToolCalls([]dto.ToolCallRequest{
		{ID: "ok", Function: dto.FunctionRequest{Name: "x", Arguments: "{}"}},
	})
	SanitizeToolCallIDs(req)
	calls := req.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	if calls[0].Type != "function" {
		t.Errorf("type=%q want function", calls[0].Type)
	}
}

func TestSanitizeToolCallIDs_NoToolCallsNoOp(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "user", Content: "hello"}},
	}
	// Should not panic and should not mutate the message.
	SanitizeToolCallIDs(req)
	if req.Messages[0].StringContent() != "hello" {
		t.Errorf("content changed: %q", req.Messages[0].StringContent())
	}
}

func TestSanitizeToolCallIDs_NilRequest(t *testing.T) {
	SanitizeToolCallIDs(nil) // must not panic
}
