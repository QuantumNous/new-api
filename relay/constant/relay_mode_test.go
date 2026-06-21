package constant

import "testing"

func TestPath2RelayMode_PublicSkillRoutingChatCompletions(t *testing.T) {
	if got := Path2RelayMode("/v1/routing/chat/completions"); got != RelayModeChatCompletions {
		t.Fatalf("Path2RelayMode(/v1/routing/chat/completions) = %d, want %d", got, RelayModeChatCompletions)
	}
}
