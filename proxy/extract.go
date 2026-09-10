package main

import (
	"bufio"
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"
)

// truncationMarker is appended to any value that had to be shortened, so a
// truncated audit record is never mistaken for the complete prompt.
const truncationMarker = "…[truncated]"

// maxJSONDepth bounds recursion while skipping fields, so a hostile body cannot
// exhaust the inspection goroutine's stack.
const maxJSONDepth = 64

// minPromptRetentionBytes floors the retention budget, so a small
// max_prompt_bytes still leaves room to find the end of a conversation.
const minPromptRetentionBytes = 32 << 10

// extractOptions is how much of a request the audit configuration asks to keep.
type extractOptions struct {
	scope          string
	maxPromptBytes int
	// maxRawBodyBytes is 0 when capture.store_raw_body is off, in which case no
	// copy of the body is retained at all.
	maxRawBodyBytes int
}

// requestFacts is what can be learned from a relay request body without knowing
// which upstream format it targets.
type requestFacts struct {
	Model      string
	IsStream   bool
	PromptText string
	RawBody    string
	// Parsed is false when the body was not a JSON object, which is expected for
	// multipart uploads.
	Parsed bool
	// Partial marks a body that started as a JSON object but ended before its
	// closing brace, which is what an aborted upload looks like. Whatever was
	// extracted before that point is still recorded.
	Partial bool
	// PromptEvicted marks a prompt whose oldest segments were dropped to stay
	// inside the retention budget.
	PromptEvicted bool
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
// speaks, that can carry prompt text — each mapped to the role to attribute its
// content to when the payload itself does not say.
//
// Inspecting a fixed key set rather than the whole document keeps unrelated
// payloads (base64 media, tool schemas, sampling parameters) out of the audit
// record. The seed role is what makes the scopes work across formats: an image
// request's "prompt" and an embedding request's "input" ARE the user's input even
// though no role appears anywhere in that JSON.
var textBearingFields = map[string]string{
	"instructions":       roleSystem, // OpenAI Responses
	"system":             roleSystem, // Claude
	"system_instruction": roleSystem, // Gemini (snake_case)
	"systemInstruction":  roleSystem, // Gemini (camelCase)
	"prompt":             roleUser,   // image generation, legacy completions
	"query":              roleUser,   // rerank
	"documents":          roleUser,   // rerank
	"input":              roleUser,   // OpenAI Responses, embeddings
	"messages":           roleUser,   // OpenAI chat, Claude
	"contents":           roleUser,   // Gemini
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
//
// The body is consumed as a stream and read to the end, one message at a time,
// so a multi-megabyte agent turn is audited in full without ever being held in
// memory. Reading it to the end matters even after the JSON object closes: the
// caller uses "the body reached EOF" to decide whether the record is complete.
func extractRequestFacts(body io.Reader, contentEncoding string, options extractOptions) requestFacts {
	reader := decodeStream(body, contentEncoding)

	var raw *rawBodyPrefix
	if options.maxRawBodyBytes > 0 {
		raw = &rawBodyPrefix{limit: options.maxRawBodyBytes + len(truncationMarker)}
		reader = io.TeeReader(reader, raw)
	}

	budget := options.maxPromptBytes * 4
	if budget < minPromptRetentionBytes {
		budget = minPromptRetentionBytes
	}
	collector := &promptCollector{scope: options.scope, budget: budget}

	facts := requestFacts{}
	err := walkRequestObject(json.NewDecoder(reader), &facts, collector)
	switch {
	case err == nil:
		facts.Parsed = true
	case facts.Model != "" || len(collector.segments) > 0:
		facts.Partial = true
	}
	_, _ = io.Copy(io.Discard, reader)

	facts.PromptText = truncateUTF8Tail(formatPromptSegments(collector.segments, options.scope), options.maxPromptBytes)
	facts.PromptEvicted = collector.evicted
	if raw != nil {
		facts.RawBody = truncateUTF8(raw.buffer.String(), options.maxRawBodyBytes)
	}
	return facts
}

// walkRequestObject reads the top-level request object, collecting the fields
// that carry prompt text and stepping over everything else.
func walkRequestObject(decoder *json.Decoder, facts *requestFacts, collector *promptCollector) error {
	if err := expectDelim(decoder, '{'); err != nil {
		return err
	}
	message := 0
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		key, _ := token.(string)
		role, textBearing := textBearingFields[key]
		switch {
		case key == "model" || key == "stream":
			// Decoded into any rather than the expected type: a client sending
			// "model": null must not abort the whole extraction.
			var value any
			if err := decoder.Decode(&value); err != nil {
				return err
			}
			if key == "model" {
				facts.Model, _ = value.(string)
			} else {
				facts.IsStream, _ = value.(bool)
			}
		case textBearing:
			if err := collectTextBearingField(decoder, role, &message, collector); err != nil {
				return err
			}
		default:
			if err := skipJSONValue(decoder, 0); err != nil {
				return err
			}
		}
	}
	return expectDelim(decoder, '}')
}

// collectTextBearingField consumes one text-bearing field, decoding an array
// element by element so a conversation is never materialised as a whole.
func collectTextBearingField(decoder *json.Decoder, role string, message *int, collector *promptCollector) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, isDelim := token.(json.Delim)
	if !isDelim {
		// A scalar field: "prompt": "a red bicycle", "system": "be terse".
		*message++
		collector.collect(token, role, *message)
		return nil
	}

	switch delim {
	case '[':
		// Every element is its own message; the text parts nested inside one message
		// stay grouped, which is what PromptScopeLastUser depends on.
		for decoder.More() {
			var item any
			if err := decoder.Decode(&item); err != nil {
				return err
			}
			*message++
			collector.collect(item, role, *message)
		}
		return expectDelim(decoder, ']')
	case '{':
		// Gemini's systemInstruction is an object rather than an array. Its keys are
		// read one at a time so the object is never re-encoded to be re-parsed.
		object := map[string]any{}
		for decoder.More() {
			keyToken, err := decoder.Token()
			if err != nil {
				return err
			}
			key, _ := keyToken.(string)
			var value any
			if err := decoder.Decode(&value); err != nil {
				return err
			}
			object[key] = value
		}
		if err := expectDelim(decoder, '}'); err != nil {
			return err
		}
		*message++
		collector.collect(object, role, *message)
		return nil
	}
	return fmt.Errorf("unexpected %v opening a text-bearing field", delim)
}

// skipJSONValue advances past one value without materialising it, so tool
// schemas, sampling parameters and base64 media never reach the audit record.
func skipJSONValue(decoder *json.Decoder, depth int) error {
	if depth > maxJSONDepth {
		return errors.New("json nesting too deep")
	}
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, isDelim := token.(json.Delim)
	if !isDelim {
		return nil
	}
	if delim == ']' || delim == '}' {
		return fmt.Errorf("unexpected %v", delim)
	}
	// Inside an object this consumes the key on one pass and its value on the next,
	// which is exactly what More() sequences.
	for decoder.More() {
		if err := skipJSONValue(decoder, depth+1); err != nil {
			return err
		}
	}
	_, err = decoder.Token() // the matching ] or }
	return err
}

func expectDelim(decoder *json.Decoder, want json.Delim) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delim, isDelim := token.(json.Delim); !isDelim || delim != want {
		return fmt.Errorf("expected %v, got %v", want, token)
	}
	return nil
}

// promptCollector accumulates role-attributed prompt text under a byte budget.
//
// The budget exists because the whole request is streamed rather than
// prefix-buffered: an agent turn can carry megabytes of history, and holding all
// of it would move the memory cost from the body to the extraction. When the
// budget is exceeded the oldest segments are evicted, so what survives is the end
// of the conversation — where the input the user just submitted always is.
//
// Segments the configured scope will never render are discarded as they arrive
// rather than counted against the budget. That is what keeps the truncated flag
// meaningful: under the default scope an agent's megabytes of tool traffic are not
// something the record wanted, so dropping them is not a loss.
type promptCollector struct {
	scope    string
	segments []promptSegment
	budget   int
	retained int
	evicted  bool
}

func (c *promptCollector) collect(value any, role string, message int) {
	appended := len(c.segments)
	appendPromptText(value, role, message, &c.segments)

	if c.scope == PromptScopeLastUser || c.scope == PromptScopeUserOnly {
		kept := c.segments[:appended]
		for _, segment := range c.segments[appended:] {
			if segment.Role == roleUser {
				kept = append(kept, segment)
			}
		}
		c.segments = kept
	}
	for _, segment := range c.segments[appended:] {
		c.retained += len(segment.Text)
	}

	// Under last_user a new user message supersedes every earlier one outright, so
	// the older ones go without counting as truncation.
	if c.scope == PromptScopeLastUser && len(c.segments) > 0 {
		latest := c.segments[len(c.segments)-1].Message
		for c.segments[0].Message != latest {
			c.retained -= len(c.segments[0].Text)
			c.segments = c.segments[1:]
		}
	}

	// The most recent segment is always kept, however large: the byte cap on the
	// rendered prompt handles a single oversized message.
	for c.retained > c.budget && len(c.segments) > 1 {
		c.retained -= len(c.segments[0].Text)
		c.segments = c.segments[1:]
		c.evicted = true
	}
}

// rawBodyPrefix keeps the first limit bytes of the decoded body for
// capture.store_raw_body. Everything past the limit is discarded as it streams
// by, so a large body costs nothing.
type rawBodyPrefix struct {
	buffer bytes.Buffer
	limit  int
}

func (p *rawBodyPrefix) Write(data []byte) (int, error) {
	if room := p.limit - p.buffer.Len(); room > 0 {
		if room > len(data) {
			room = len(data)
		}
		p.buffer.Write(data[:room])
	}
	return len(data), nil
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

// decodeStream strips any Content-Encoding the client applied so extraction sees
// JSON. new-api decompresses relay request bodies itself
// (DecompressRequestMiddleware), so clients legitimately send gzip or deflate.
//
// This decodes a copy for auditing only — the bytes forwarded upstream are never
// touched. An encoding this proxy cannot decode is inspected as-is, which simply
// yields an unparsed record.
func decodeStream(body io.Reader, contentEncoding string) io.Reader {
	switch strings.ToLower(strings.TrimSpace(contentEncoding)) {
	case "gzip", "x-gzip":
		// A mislabelled body is common enough to guard against: peeking at the magic
		// number keeps plain JSON readable instead of discarding it as broken gzip.
		buffered := bufio.NewReader(body)
		magic, err := buffered.Peek(2)
		if err != nil || magic[0] != 0x1f || magic[1] != 0x8b {
			return buffered
		}
		reader, err := gzip.NewReader(buffered)
		if err != nil {
			return buffered
		}
		return reader
	case "deflate":
		return flate.NewReader(body)
	default:
		return body
	}
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

// truncateUTF8Tail limits s to at most maxBytes bytes by keeping its end, with the
// marker in front.
//
// Prompt text is cut from the front, not the back: the input the user just
// submitted is at the end of the conversation, so keeping the head would drop
// exactly the part the audit row exists to record. Raw bodies are cut the other
// way — there the head carries the request's identifying fields.
func truncateUTF8Tail(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	budget := maxBytes - len(truncationMarker)
	if budget <= 0 {
		return ""
	}
	// Step forward to a rune boundary so the first character is never cut in half.
	start := len(s) - budget
	for start < len(s) && !utf8.RuneStart(s[start]) {
		start++
	}
	return truncationMarker + s[start:]
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
