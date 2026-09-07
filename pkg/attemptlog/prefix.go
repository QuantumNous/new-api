package attemptlog

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// sparseBlockSizes defines the fixed exponential sampling schedule for prefix
// hashing. Block sizes double after the first two 256-byte blocks, giving
// fine-grained matching near the start (system + tools + first message) and
// coarse coverage for conversation history. The schedule is the same for all
// body sizes, so absolute byte positions are consistent: a 200KB body and a
// 1.2MB body sharing the first 200KB produce the same initial block hashes.
//
// Coverage: 256+256+512+1024+...+32MB ≈ 64MB, far beyond any realistic prompt.
var sparseBlockSizes = func() []int {
	sizes := []int{256, 256}
	for size := 512; size <= 32*1024*1024; size *= 2 {
		sizes = append(sizes, size)
	}
	return sizes
}()

// hashHex is SHA-256 truncated to 16 hex characters (64 bits). 64 bits keeps
// collision probability negligible for training-scale clustering while saving
// storage in the chain.
func hashHex(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:8])
}

// sparseChainHash hashes data at fixed exponential positions using a chained
// scheme: h[0] = SHA256(block[0]), h[i] = SHA256(h[i-1] || block[i]). The chain
// preserves prefix matching: two bodies sharing the first K bytes share all
// block hashes whose offset+size <= K.
//
// The last partial block (when the body doesn't fill the scheduled size) is
// included verbatim so identical full bodies always produce identical chains.
// For a 1.2MB body this produces ~13 hashes (vs ~4700 for dense 256-byte
// blocks), and the output is ~208 bytes (vs ~75KB).
func sparseChainHash(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	var sb strings.Builder
	var prevHash []byte
	offset := 0
	for _, blockSize := range sparseBlockSizes {
		if offset >= len(data) {
			break
		}
		end := offset + blockSize
		if end > len(data) {
			end = len(data)
		}
		h := sha256.New()
		if prevHash != nil {
			h.Write(prevHash)
		}
		h.Write(data[offset:end])
		sum := h.Sum(nil)
		sb.WriteString(hex.EncodeToString(sum[:8]))
		prevHash = sum
		offset = end
	}
	return sb.String()
}

// PrefixHashes holds the three prefix identifiers computed from the raw
// request body. They are byte-exact (no whitespace normalization) to match
// upstream KV-cache semantics: even a single-byte difference breaks cache
// reuse, so the hash must not collapse away those differences.
type PrefixHashes struct {
	System string
	Tools  string
	Prefix string
}

// ComputePrefixHashes extracts system and tools raw bytes via gjson (using
// Result.Index for zero-copy slicing into the original body) and hashes them
// individually. The prefix hash covers the entire raw body via sparseChainHash
// — no gjson extraction for messages, avoiding the dominant memory cost on
// large contexts. The raw body includes non-prompt fields (model, temperature,
// etc.), but for large bodies these are <0.01% and constant per-agent, so
// cross-request prefix matching is unaffected.
func ComputePrefixHashes(body []byte, relayFormat types.RelayFormat) PrefixHashes {
	if len(body) == 0 {
		return PrefixHashes{}
	}

	var systemPath, toolsPath string
	switch relayFormat {
	case types.RelayFormatOpenAI:
		// System lives inside messages; try both roles.
		if r := gjson.GetBytes(body, `messages.#(role=system).content`); r.Exists() {
			systemPath = `messages.#(role=system).content`
		} else if r := gjson.GetBytes(body, `messages.#(role=developer).content`); r.Exists() {
			systemPath = `messages.#(role=developer).content`
		}
		toolsPath = "tools"
	case types.RelayFormatClaude:
		systemPath = "system"
		toolsPath = "tools"
	case types.RelayFormatGemini:
		systemPath = "systemInstruction"
		toolsPath = "tools"
	case types.RelayFormatOpenAIResponses:
		systemPath = "instructions"
		toolsPath = "tools"
	default:
		return PrefixHashes{}
	}

	return PrefixHashes{
		System: hashHex(extractRaw(body, systemPath)),
		Tools:  hashHex(extractRaw(body, toolsPath)),
		Prefix: sparseChainHash(body),
	}
}

// extractRaw returns the raw JSON bytes of a gjson path result, slicing the
// original body via Result.Index to avoid a copy. Falls back to []byte(r.Raw)
// (one copy) when Index is unavailable. Returns nil for absent, null, empty
// array, or empty string values.
func extractRaw(body []byte, path string) []byte {
	if path == "" {
		return nil
	}
	r := gjson.GetBytes(body, path)
	if !r.Exists() {
		return nil
	}
	raw := r.Raw
	if raw == "[]" || raw == "null" || raw == "\"\"" {
		return nil
	}
	// Zero-copy slice into the original body when gjson recorded the offset.
	if r.Index > 0 && r.Index+len(raw) <= len(body) {
		return body[r.Index : r.Index+len(raw)]
	}
	// Fallback: one string→[]byte copy.
	return []byte(raw)
}

// RawBodyBytes returns the raw HTTP request body via the replayable body
// storage. For the in-memory path (the common case) this is zero-copy — the
// storage returns its backing array directly. Exported so callers can read the
// body once and pass bytes to multiple extractors.
func RawBodyBytes(c *gin.Context) []byte {
	if c == nil {
		return nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return nil
	}
	data, err := storage.Bytes()
	if err != nil || data == nil {
		return nil
	}
	return data
}

// LastUserText extracts the plain text of the last user message from the raw
// request body, for use as task-type-classification input. Unlike the prefix
// hashes, this does not need to be byte-exact — it just needs the text content
// the user actually asked about in the current turn.
//
// For OpenAI/Claude: the last message with role=user, content field.
// For Gemini: the last content with role=user, parts[].text.
// For Responses: the last input item with role=user, content.
// Content can be a string or an array of typed parts; only text parts are
// concatenated. Returns "" when no user message is found.
func LastUserText(body []byte, relayFormat types.RelayFormat) string {
	if len(body) == 0 {
		return ""
	}

	var lastContent gjson.Result
	switch relayFormat {
	case types.RelayFormatOpenAI, types.RelayFormatClaude:
		userMsgs := gjson.GetBytes(body, `messages.#(role=user)#`).Array()
		if len(userMsgs) == 0 {
			return ""
		}
		lastContent = userMsgs[len(userMsgs)-1].Get("content")
	case types.RelayFormatGemini:
		userContents := gjson.GetBytes(body, `contents.#(role=user)#`).Array()
		if len(userContents) == 0 {
			return ""
		}
		parts := userContents[len(userContents)-1].Get("parts").Array()
		var sb strings.Builder
		for _, p := range parts {
			if t := p.Get("text").String(); t != "" {
				sb.WriteString(t)
			}
		}
		return sb.String()
	case types.RelayFormatOpenAIResponses:
		// input can be a string or an array of input items.
		inputResult := gjson.GetBytes(body, "input")
		if inputResult.Type == gjson.String {
			return inputResult.String()
		}
		userInputs := gjson.GetBytes(body, `input.#(role=user)#`).Array()
		if len(userInputs) == 0 {
			return ""
		}
		lastContent = userInputs[len(userInputs)-1].Get("content")
	default:
		return ""
	}

	return extractTextFromContent(lastContent)
}

// extractTextFromContent handles the two content shapes used by OpenAI/Claude/
// Responses: a bare string, or an array of typed parts whose text is in the
// "text" field.
func extractTextFromContent(r gjson.Result) string {
	if !r.Exists() {
		return ""
	}
	if r.Type == gjson.String {
		return r.String()
	}
	if r.IsArray() {
		var sb strings.Builder
		r.ForEach(func(_, part gjson.Result) bool {
			if t := part.Get("text").String(); t != "" {
				sb.WriteString(t)
			}
			return true
		})
		return sb.String()
	}
	return ""
}
