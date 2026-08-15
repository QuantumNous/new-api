package cursor_agent

// Experimental Cursor Agent channel (official @cursor/sdk path).
// Model IDs are Cursor catalog SKUs as returned by Cursor.models.list() —
// same bare names users type elsewhere (no required cursor-agent/ prefix).
// Traffic still goes through Cursor Agent harness, not native Anthropic OAuth.

const ChannelName = "cursor_agent"

// ModelList is a static fallback for admin UI. Prefer live catalog from
// sidecar GET /v1/models when the channel key is valid.
var ModelList = []string{
	// Cursor-native
	"default",
	"composer-2.5",
	"composer-2",
	"grok-4.5",
	"grok-4.6",
	// Claude family (Cursor catalog IDs, including newer SKUs)
	"claude-opus-5",
	"claude-fable-5",
	"claude-sonnet-5",
	"claude-opus-4-8",
	"claude-opus-4-7",
	"claude-opus-4-6",
	"claude-opus-4-5",
	"claude-sonnet-4-6",
	"claude-sonnet-4-5",
	"claude-sonnet-4",
	"claude-haiku-4-5",
	// OpenAI / others commonly listed on Cursor
	"gpt-5.5",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.3-codex",
	"gpt-5.2",
	"gpt-5.1",
	"gpt-5-mini",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-5.6-luna",
	"gemini-3.1-pro",
	"gemini-3-flash",
	"gemini-3.5-flash",
	"gemini-3.6-flash",
	"gemini-3.7-flash",
	"gemini-2.5-flash",
	"kimi-k2.7-code",
	"kimi-k3",
	"glm-5.2",
}
