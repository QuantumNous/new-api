package constant

import "testing"

func TestPath2RelayModeCodexBackendResponses(t *testing.T) {
	if got := Path2RelayMode("/backend-api/codex/responses"); got != RelayModeResponses {
		t.Fatalf("unexpected relay mode for codex responses: got %d want %d", got, RelayModeResponses)
	}
	if got := Path2RelayMode("/backend-api/codex/responses/compact"); got != RelayModeResponsesCompact {
		t.Fatalf("unexpected relay mode for codex compact responses: got %d want %d", got, RelayModeResponsesCompact)
	}
}
