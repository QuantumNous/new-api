package channel

import (
	"encoding/hex"
	"hash/fnv"
	"strings"

	common2 "github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/tidwall/gjson"
)

// SessionAffinityHeaderName is the upstream header used to carry a stable
// per-conversation identifier. Downstream gateways (e.g. an opencode/zen style
// proxy) can pin the session to a fixed exit node to raise prompt-cache hit
// rate. This is opt-in per channel because not every upstream honors it.
const SessionAffinityHeaderName = "X-Session-Id"

// ResolveSessionAffinityKey derives a deterministic session key from the
// request body's stable prefix (model + system prompt + first user turn +
// tool names). The key stays stable as a conversation grows because only the
// immutable prefix is hashed, which is exactly what upstream affinity /
// prompt caching needs. Returns "" when no meaningful prefix can be extracted.
// The derived value is memoized on the request context so every retry of one
// relay attempt shares a single view of the cache boundary.
func ResolveSessionAffinityKey(c contract.Context, info *common.RelayInfo) string {
	if c == nil || info == nil {
		return ""
	}
	if cached, ok := c.Get(common.AffinityKeyContextKey); ok {
		if key, isString := cached.(string); isString {
			return key
		}
	}
	key := deriveSessionAffinityKey(c, info)
	if key != "" {
		// A transient failure must not be memoized: an empty key would pin
		// every later retry of this request to "no affinity, no cache key".
		c.Set(common.AffinityKeyContextKey, key)
	}
	return key
}

func deriveSessionAffinityKey(c contract.Context, info *common.RelayInfo) string {
	if c == nil || info == nil {
		return ""
	}
	storage, err := common2.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	body, err := storage.Bytes()
	if err != nil || len(body) == 0 {
		return ""
	}

	// Prefer an explicit *session-scoped* identifier when the client provides one
	// (prompt_cache_key / session_id declare the client's own cache boundary).
	// Deliberately exclude user-level fields (user / metadata.user_id): pinning by
	// user collapses all of one user's unrelated conversations onto a single exit
	// node, skewing load with zero cache benefit. Cache affinity must be keyed by
	// cacheable prefix content, which the fallback hash below handles.
	for _, path := range []string{"prompt_cache_key", "session_id"} {
		if v := strings.TrimSpace(gjson.GetBytes(body, path).String()); v != "" {
			return v
		}
	}

	var sb strings.Builder
	sb.WriteString(strings.TrimSpace(info.OriginModelName))
	sb.WriteString("\n")

	// Anthropic-style top-level system prompt.
	if sys := gjson.GetBytes(body, "system"); sys.Exists() {
		sb.WriteString("sys:")
		sb.WriteString(stableContentText(sys))
		sb.WriteString("\n")
	}

	// OpenAI-style messages[]: keep every leading system/developer turn plus the
	// first user turn, then stop — the remaining turns are volatile.
	gjson.GetBytes(body, "messages").ForEach(func(_, msg gjson.Result) bool {
		switch msg.Get("role").String() {
		case "system", "developer":
			sb.WriteString("sys:")
			sb.WriteString(stableContentText(msg.Get("content")))
			sb.WriteString("\n")
			return true
		case "user":
			sb.WriteString("usr:")
			sb.WriteString(stableContentText(msg.Get("content")))
			sb.WriteString("\n")
			return false // stop: prefix is now stable across future turns
		}
		return true
	})

	// Tool names (not arguments) keep identity stable across tool-arg drift.
	gjson.GetBytes(body, "tools").ForEach(func(_, tool gjson.Result) bool {
		name := tool.Get("function.name").String()
		if name == "" {
			name = tool.Get("name").String()
		}
		if name != "" {
			sb.WriteString("tool:")
			sb.WriteString(name)
			sb.WriteString(",")
		}
		return true
	})

	material := strings.TrimSpace(sb.String())
	if material == "" {
		return ""
	}
	h := fnv.New64a()
	_, _ = h.Write([]byte(material))
	return "ses_" + hex.EncodeToString(h.Sum(nil))
}

// stableContentText renders a message content value (string or content-part
// array) to a compact, order-preserving text form for hashing.
func stableContentText(v gjson.Result) string {
	if v.Type == gjson.String {
		return strings.TrimSpace(v.String())
	}
	if v.IsArray() {
		parts := make([]string, 0, 4)
		v.ForEach(func(_, part gjson.Result) bool {
			if t := strings.TrimSpace(part.Get("text").String()); t != "" {
				parts = append(parts, t)
			}
			return true
		})
		return strings.Join(parts, "\n")
	}
	return strings.TrimSpace(v.String())
}
