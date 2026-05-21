package dto

import "testing"

func TestTokenTextBuilderMatchesJoinSemantics(t *testing.T) {
	parts := []string{"alpha", "", "beta", "gamma"}

	var builder tokenTextBuilder
	for _, part := range parts {
		builder.Add(part)
	}

	got := builder.String()
	want := "alpha\n\nbeta\ngamma"
	if got != want {
		t.Fatalf("unexpected builder result, got %q want %q", got, want)
	}
}

func TestGeneralOpenAIRequestGetTokenCountMetaPreservesSemantics(t *testing.T) {
	name := "tool-name"
	req := &GeneralOpenAIRequest{
		Prompt: []any{"prompt-a", "", "prompt-b"},
		Input:  []any{"input-a", "input-b"},
		Messages: []Message{
			{
				Role: "user",
				Name: &name,
				Content: []MediaContent{
					{Type: ContentTypeText, Text: "hello"},
					{Type: ContentTypeImageURL, ImageUrl: &MessageImageUrl{Url: "https://example.com/a.png", Detail: "high"}},
				},
			},
		},
		Tools: []ToolCallRequest{
			{
				Type: "function",
				Function: FunctionRequest{
					Name:        "lookup",
					Description: "tool desc",
					Parameters: map[string]any{
						"type": "object",
					},
				},
			},
		},
	}

	meta := req.GetTokenCountMeta()
	if meta == nil {
		t.Fatalf("expected meta")
	}

	wantText := "prompt-a\n\nprompt-b\ninput-a\ninput-b\nuser\ntool-name\nlookup\ntool desc\nmap[type:object]"
	if meta.CombineText != wantText {
		t.Fatalf("unexpected CombineText, got %q want %q", meta.CombineText, wantText)
	}
	if meta.MessagesCount != 1 {
		t.Fatalf("unexpected MessagesCount: %d", meta.MessagesCount)
	}
	if meta.NameCount != 1 {
		t.Fatalf("unexpected NameCount: %d", meta.NameCount)
	}
	if meta.ToolsCount != 1 {
		t.Fatalf("unexpected ToolsCount: %d", meta.ToolsCount)
	}
}
