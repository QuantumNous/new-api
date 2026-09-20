package common

import (
	"crypto/sha256"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const ClientIdentityContextKey = "original_client_identity"

// ClientIdentity is request provenance, never proof of authentication.
type ClientIdentity struct {
	ClientKey   string `json:"client_key"`
	Family      string `json:"family"`
	Variant     string `json:"variant"`
	DisplayName string `json:"display_name"`
	Version     string `json:"version"`
	Confidence  string `json:"confidence"`
	UserAgent   string `json:"user_agent"`
	Truncated   bool   `json:"truncated"`
}

var clientPrefixes = []struct{ prefix, family, variant, name string }{
	{"Codex Desktop/", "codex", "desktop", "Codex Desktop"},
	{"codex_desktop/", "codex", "desktop", "Codex Desktop"},
	{"codex_vscode/", "codex", "vscode", "Codex VS Code"},
	{"codex_exec/", "codex", "exec", "Codex exec"},
	{"codex_sdk_ts/", "codex", "sdk", "Codex SDK"},
	{"codex_sdk/", "codex", "sdk", "Codex SDK"},
	{"codex-acp/", "codex", "acp", "Codex ACP"},
	{"codex_acp/", "codex", "acp", "Codex ACP"},
	{"codex_cli_rs/", "codex", "cli", "Codex CLI/TUI"},
	{"codex_cli/", "codex", "cli", "Codex CLI/TUI"},
	{"claude-cli/", "claude_code", "cli", "Claude Code"},
	{"Claude-Code/", "claude_code", "cli", "Claude Code"},
	{"pi/", "pi", "cli", "Pi"},
	{"pi-coding-agent/", "pi", "cli", "Pi"},
	{"opencode/", "opencode", "cli", "OpenCode"},
	{"OpenCode/", "opencode", "cli", "OpenCode"},
	{"ZCode/", "zcode", "versioned", "ZCode"},
	{"deepseek-harness/", "dsh", "cli", "DeepSeek Harness (DSH)"},
	{"Go-http-client/", "newapi", "go", "NewAPI"},
	{"OpenClaw/", "openclaw", "app", "OpenClaw"},
	{"openclaw/", "openclaw", "app", "OpenClaw"},
	{"CherryStudio/", "cherry_studio", "desktop", "Cherry Studio"},
	{"Cherry Studio/", "cherry_studio", "desktop", "Cherry Studio"},
	{"OpenAI/Python ", "openai_sdk", "python", "OpenAI SDK"},
	{"OpenAI/JS ", "openai_sdk", "javascript", "OpenAI SDK"},
	{"node/", "node", "runtime", "Node"},
	{"Node.js/", "node", "runtime", "Node"},
	{"Bun/", "bun", "runtime", "Bun"},
	{"bun/", "bun", "runtime", "Bun"},
	{"python-requests/", "python", "requests", "Python"},
	{"python-httpx/", "python", "httpx", "Python"},
	{"Python/", "python", "runtime", "Python"},
	{"Mozilla/", "browser", "browser", "Browser"},
	{"curl/", "curl", "cli", "curl"},
}

var clientVersion = regexp.MustCompile(`^[0-9]+(?:\.[0-9]+)*(?:[-+][A-Za-z0-9.-]+)?$`)

func IdentifyClient(raw string) ClientIdentity {
	identity := ClientIdentity{ClientKey: fmt.Sprintf("unknown:%x", sha256.Sum256([]byte(raw))), Family: "unknown", DisplayName: "Unknown client", Confidence: "unknown"}
	var cleaned strings.Builder
	for _, r := range raw {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) || r == utf8.RuneError {
			continue
		}
		if cleaned.Len()+utf8.RuneLen(r) > 2048 {
			identity.Truncated = true
			break
		}
		cleaned.WriteRune(r)
	}
	identity.UserAgent = cleaned.String()
	// Match the received bytes, not the sanitized display value: stripping control
	// characters must not turn an unknown identifier into an approved client.
	for _, rule := range clientPrefixes {
		rest, matched := strings.CutPrefix(raw, rule.prefix)
		if !matched {
			continue
		}
		version := strings.FieldsFunc(rest, func(r rune) bool { return r == ' ' || r == '(' || r == ';' })
		if len(version) == 0 || len(version[0]) > 128 {
			continue
		}
		variant := rule.variant
		if rule.family == "zcode" && version[0] == "unknown" {
			variant = "unknown"
		} else if !clientVersion.MatchString(version[0]) {
			continue
		}
		identity.ClientKey = rule.family + ":" + variant
		identity.Family, identity.Variant, identity.DisplayName, identity.Version = rule.family, variant, rule.name, version[0]
		identity.Confidence = "identified"
		if rule.family == "newapi" {
			identity.Confidence = "inferred"
		}
		return identity
	}
	if raw == "node" {
		identity.ClientKey, identity.Family, identity.Variant, identity.DisplayName, identity.Confidence = "node:runtime", "node", "runtime", "Node", "identified"
	}
	return identity
}

func RequestClient(c *gin.Context) *ClientIdentity {
	if c == nil {
		return nil
	}
	v, ok := c.Get(ClientIdentityContextKey)
	if !ok {
		return nil
	}
	identity, ok := v.(ClientIdentity)
	if !ok {
		return nil
	}
	return &identity
}
