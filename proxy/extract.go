package main

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"
)

// truncationMarker is appended to any value that had to be shortened, so a
// truncated audit record is never mistaken for the complete prompt.
const truncationMarker = "…[truncated]"

// requestFacts is what can be learned from a relay request body without knowing
// which upstream format it targets.
type requestFacts struct {
	Model      string
	IsStream   bool
	PromptText string
	// Parsed is false when the body was not valid JSON, which is expected for
	// truncated captures and multipart uploads.
	Parsed bool
}

const (
	roleUser   = "user"
	roleSystem = "system"
	roleTool   = "tool"
)

// Prompt scopes decide how much of a relay request is kept.
//
// They exist because agent clients resend their entire system prompt and
// conversation history on every turn: measured on a real Codex request, the
// developer prompt was 93% of the extracted text, all user turns together were
// 5.7%, and the input the user actually typed that turn was 6 bytes out of
// 43714 — repeated once per turn.
const (
	// PromptScopeLastUser keeps only the final user message, so one row is one
	// thing the user actually submitted.
	PromptScopeLastUser = "last_user"
	// PromptScopeUserOnly keeps every user-authored message and drops system,
	// developer and assistant text.
	PromptScopeUserOnly = "user_only"
	// PromptScopeAll keeps everything, for forensic use.
	PromptScopeAll = "all"
)

// promptSegment is one role-attributed piece of text pulled out of a request.
// Roles have to survive extraction for the scopes above to mean anything.
type promptSegment struct {
	Role string
	Text string
	// Message groups segments that arrived in the same message. One user message
	// routinely holds several text parts — a client that attaches an image splits
	// the turn into the typed text plus <image>…</image> marker parts — so the
	// unit "the user's last input" is a message, never a single part.
	Message int
}

// textBearingFields are the top-level fields, across every relay format new-api
// speaks, that can carry prompt text — each paired with the role to attribute its
// content to when the payload itself does not say.
//
// Walking a fixed key list rather than the whole document keeps unrelated payloads
// (base64 media, tool schemas, sampling parameters) out of the audit record.
// The seed role is what makes the scopes work across formats: an image request's
// "prompt" and an embedding request's "input" ARE the user's input even though no
// role appears anywhere in that JSON.
var textBearingFields = []struct {
	key  string
	role string
}{
	{"instructions", roleSystem},       // OpenAI Responses
	{"system", roleSystem},             // Claude
	{"system_instruction", roleSystem}, // Gemini (snake_case)
	{"systemInstruction", roleSystem},  // Gemini (camelCase)
	{"prompt", roleUser},               // image generation, legacy completions
	{"query", roleUser},                // rerank
	{"documents", roleUser},            // rerank
	{"input", roleUser},                // OpenAI Responses, embeddings
	{"messages", roleUser},             // OpenAI chat, Claude
	{"contents", roleUser},             // Gemini
}

// toolBlockTypes are content blocks that carry tool traffic rather than human
// input, and are therefore attributed to roleTool no matter which message they
// arrived in.
//
// This is load-bearing for agent clients: Anthropic's format returns tool results
// as `role: "user"` messages holding tool_result blocks, so without this the file
// contents and command output an agent feeds back would be recorded as the user's
// prompt. OpenAI's chat format uses `role: "tool"` and needs no help; the
// Responses format keeps results in an `output` field that is never followed.
var toolBlockTypes = map[string]bool{
	"tool_result":             true,
	"tool_use":                true,
	"server_tool_use":         true,
	"web_search_tool_result":  true,
	"mcp_tool_use":            true,
	"mcp_tool_result":         true,
	"function_call":           true,
	"function_call_output":    true,
	"custom_tool_call":        true,
	"custom_tool_call_output": true,
	"computer_call":           true,
	"computer_call_output":    true,
	"file_search_call":        true,
	"web_search_call":         true,
}

// nonTextBlockTypes are multimodal content-block types that never carry prompt
// text; their payloads are skipped so base64 media never reaches the database.
var nonTextBlockTypes = map[string]bool{
	"image":       true,
	"image_url":   true,
	"input_image": true,
	"audio":       true,
	"input_audio": true,
	"file":        true,
	"input_file":  true,
	"document":    true,
	"thinking":    true,
}

// extractRequestFacts pulls the model name, stream flag and prompt text out of a
// relay request body. It is format-agnostic on purpose: new-api accepts OpenAI,
// Claude, Gemini, Responses, embedding, rerank and image payloads on different
// routes, and this proxy must keep working when new routes are added upstream.
func extractRequestFacts(body []byte, maxPromptBytes int, scope string) requestFacts {
	facts := requestFacts{}
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return facts
	}
	facts.Parsed = true
	facts.Model, _ = root["model"].(string)
	facts.IsStream, _ = root["stream"].(bool)

	var segments []promptSegment
	messageIndex := 0
	for _, field := range textBearingFields {
		value, ok := root[field.key]
		if !ok {
			continue
		}
		// Every element of a message array is its own message; any other value is
		// a single message. Only this loop advances the counter, so all the text
		// parts nested inside one message stay grouped together.
		if items, isArray := value.([]any); isArray {
			for _, item := range items {
				messageIndex++
				appendPromptText(item, field.role, messageIndex, &segments)
			}
			continue
		}
		messageIndex++
		appendPromptText(value, field.role, messageIndex, &segments)
	}
	facts.PromptText = truncateUTF8(formatPromptSegments(segments, scope), maxPromptBytes)
	return facts
}

// formatPromptSegments applies the configured scope and renders the result.
//
// Role prefixes are added only for PromptScopeAll, where several roles are mixed
// and the prefix carries information. The user-restricted scopes emit bare text,
// because there every segment has the same role.
func formatPromptSegments(segments []promptSegment, scope string) string {
	switch scope {
	case PromptScopeLastUser:
		// The last user *message*, with all of its text parts — not the last part.
		lastMessage := -1
		for _, segment := range segments {
			if segment.Role == roleUser && segment.Message > lastMessage {
				lastMessage = segment.Message
			}
		}
		if lastMessage < 0 {
			return ""
		}
		texts := make([]string, 0, 4)
		for _, segment := range segments {
			if segment.Role == roleUser && segment.Message == lastMessage {
				texts = append(texts, segment.Text)
			}
		}
		return strings.Join(texts, "\n")
	case PromptScopeUserOnly:
		texts := make([]string, 0, len(segments))
		for _, segment := range segments {
			if segment.Role == roleUser {
				texts = append(texts, segment.Text)
			}
		}
		return strings.Join(texts, "\n")
	default:
		texts := make([]string, 0, len(segments))
		for _, segment := range segments {
			if segment.Role == "" {
				texts = append(texts, segment.Text)
				continue
			}
			texts = append(texts, segment.Role+": "+segment.Text)
		}
		return strings.Join(texts, "\n")
	}
}

// decodeRequestBody strips any Content-Encoding the client applied so extraction
// sees JSON. new-api decompresses relay request bodies itself
// (DecompressRequestMiddleware), so clients legitimately send gzip or deflate.
//
// This decodes a copy for auditing only — the bytes forwarded upstream are never
// touched. A body that cannot be decoded (wrong encoding, truncated capture) is
// returned unchanged, which simply yields an unparsed record.
func decodeRequestBody(contentEncoding string, body []byte) []byte {
	if len(body) == 0 {
		return body
	}

	var reader io.ReadCloser
	switch strings.ToLower(strings.TrimSpace(contentEncoding)) {
	case "", "identity":
		return body
	case "gzip", "x-gzip":
		gzipReader, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return body
		}
		reader = gzipReader
	case "deflate":
		reader = flate.NewReader(bytes.NewReader(body))
	default:
		return body
	}
	defer reader.Close()

	decoded, err := io.ReadAll(reader)
	if err != nil || len(decoded) == 0 {
		return body
	}
	return decoded
}

// appendPromptText walks a decoded JSON value and appends role-attributed prompt
// text to out. It follows only the shapes that carry text — strings, {text},
// {content}, {parts} and arrays of those — so binary and structured payloads are
// never collected.
func appendPromptText(value any, role string, message int, out *[]promptSegment) {
	switch v := value.(type) {
	case string:
		text := strings.TrimSpace(v)
		if text == "" {
			return
		}
		*out = append(*out, promptSegment{Role: role, Text: text, Message: message})
	case []any:
		for _, item := range v {
			appendPromptText(item, role, message, out)
		}
	case map[string]any:
		itemRole := role
		if r, ok := v["role"].(string); ok && r != "" {
			itemRole = r
		}
		if blockType, ok := v["type"].(string); ok {
			if nonTextBlockTypes[blockType] {
				return
			}
			if toolBlockTypes[blockType] {
				itemRole = roleTool
			}
		}
		if text, ok := v["text"].(string); ok {
			appendPromptText(text, itemRole, message, out)
			return
		}
		if content, ok := v["content"]; ok {
			appendPromptText(content, itemRole, message, out)
			return
		}
		if parts, ok := v["parts"]; ok {
			appendPromptText(parts, itemRole, message, out)
			return
		}
	}
}

// truncateUTF8 limits s to at most maxBytes bytes without splitting a multi-byte
// character. The limit is in bytes, not characters, because that is what the
// database column enforces: MySQL TEXT holds 65535 bytes, so a rune-based cap
// would let CJK or emoji text overflow the column and fail the insert.
func truncateUTF8(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	budget := maxBytes - len(truncationMarker)
	if budget <= 0 {
		// The cap cannot even hold the marker; config validation enforces a
		// sensible minimum, so this only guards against absurd values.
		return ""
	}
	// Step back to a rune boundary so the last character is never cut in half.
	for budget > 0 && !utf8.RuneStart(s[budget]) {
		budget--
	}
	return s[:budget] + truncationMarker
}

// Redactor masks configured patterns before prompt text is persisted.
type Redactor struct {
	patterns []*regexp.Regexp
}

func NewRedactor(expressions []string) (*Redactor, error) {
	redactor := &Redactor{}
	for _, expression := range expressions {
		compiled, err := regexp.Compile(expression)
		if err != nil {
			return nil, fmt.Errorf("invalid redact pattern %q: %w", expression, err)
		}
		redactor.patterns = append(redactor.patterns, compiled)
	}
	return redactor, nil
}

func (r *Redactor) Apply(s string) string {
	if r == nil || len(r.patterns) == 0 || s == "" {
		return s
	}
	for _, pattern := range r.patterns {
		s = pattern.ReplaceAllString(s, "[REDACTED]")
	}
	return s
}
