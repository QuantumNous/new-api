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

type ClientOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// ClientIdentity is request provenance, never proof of authentication.
type ClientIdentity struct {
	ClientKey   string `json:"client_key"`
	Family      string `json:"family"`
	Variant     string `json:"variant"`
	DisplayName string `json:"display_name"`
	Version     string `json:"version"`
	Confidence  string `json:"confidence"`
	Kind        string `json:"kind"`
	UserAgent   string `json:"user_agent"`
	Truncated   bool   `json:"truncated"`
}

type clientRule struct {
	prefix, family, variant, name, kind string
	pattern                             *regexp.Regexp
}

// Recognition and log filter choices share this registry.
// Specific variants precede the corresponding general product rule.
var clientRules = []clientRule{
	{"changzheng/", "changzheng", "app", "changzheng", "application", nil},
	{"greyfield/", "greyfield", "app", "greyfield", "application", nil},
	{"taffyOfficial/", "taffyofficial", "app", "taffyOfficial", "application", nil},
	{"", "claude_code", "diagnostic", "Claude Code Diagnostic", "application", regexp.MustCompile(`^claude-cli/diagnostic(?:[ (;]|$)`)},
	{"", "mimocode", "desktop", "MiMo Code Desktop", "application", regexp.MustCompile(`^mimocode/desktop-([A-Za-z0-9][A-Za-z0-9._+-]{0,127})(?:[ (;]|$)`)},
	{"", "workbuddy", "cli", "WorkBuddy", "application", regexp.MustCompile(`^CLI/[A-Za-z0-9._+-]{1,128} (?:CodeBuddy|WorkBuddy)/([A-Za-z0-9][A-Za-z0-9._+-]{0,127})(?:[ (;]|$)`)},
	{"", "zcode", "unknown", "ZCode", "application", regexp.MustCompile(`^ZCode/(unknown)(?:[ (;]|$)`)},
	{"Codex Desktop/", "codex", "desktop", "Codex Desktop", "application", nil},
	{"codex_desktop/", "codex", "desktop", "Codex Desktop", "application", nil},
	{"codex_vscode/", "codex", "vscode", "Codex VS Code", "application", nil},
	{"codex_exec/", "codex", "exec", "Codex exec", "application", nil},
	{"codex_sdk_ts/", "codex", "sdk", "Codex SDK", "application", nil},
	{"codex_sdk/", "codex", "sdk", "Codex SDK", "application", nil},
	{"codex-acp/", "codex", "acp", "Codex ACP", "application", nil},
	{"codex_acp/", "codex", "acp", "Codex ACP", "application", nil},
	{"codex_cli_rs/", "codex", "cli", "Codex CLI/TUI", "application", nil},
	{"codex_cli/", "codex", "cli", "Codex CLI/TUI", "application", nil},
	{"codex-tui/", "codex", "tui", "Codex TUI", "application", nil},
	{"claude-cli/", "claude_code", "cli", "Claude Code", "application", nil},
	{"Claude-Code/", "claude_code", "cli", "Claude Code", "application", nil},
	{"pi/", "pi", "cli", "Pi", "application", nil},
	{"pi-coding-agent/", "pi", "cli", "Pi", "application", nil},
	{"opencode/", "opencode", "cli", "OpenCode", "application", nil},
	{"OpenCode/", "opencode", "cli", "OpenCode", "application", nil},
	{"ZCode/", "zcode", "versioned", "ZCode", "application", nil},
	{"deepseek-harness/", "dsh", "cli", "DeepSeek Harness (DSH)", "application", nil},
	{"Go-http-client/", "go", "http", "Go HTTP", "transport", nil},
	{"hertz/", "hertz", "http", "Hertz", "transport", nil},
	{"OpenClaw/", "openclaw", "app", "OpenClaw", "application", nil},
	{"openclaw/", "openclaw", "app", "OpenClaw", "application", nil},
	{"CherryStudio/", "cherry_studio", "desktop", "Cherry Studio", "application", nil},
	{"Cherry Studio/", "cherry_studio", "desktop", "Cherry Studio", "application", nil},
	{"WorkBuddy/", "workbuddy", "app", "WorkBuddy", "application", nil},
	{"workbuddy/", "workbuddy", "app", "WorkBuddy", "application", nil},
	{"tender-agent-base/", "tender", "agent-base", "Tender Agent", "application", nil},
	{"AsyncOpenAI/Python ", "openai_sdk", "python", "OpenAI SDK (Async)", "sdk", nil},
	{"OpenAI/Python ", "openai_sdk", "python", "OpenAI SDK", "sdk", nil},
	{"OpenAI/JS ", "openai_sdk", "javascript", "OpenAI SDK", "sdk", nil},
	{"node/", "node", "runtime", "Node", "transport", nil},
	{"Node.js/", "node", "runtime", "Node", "transport", nil},
	{"Bun/", "bun", "runtime", "Bun", "transport", nil},
	{"bun/", "bun", "runtime", "Bun", "transport", nil},
	{"python-requests/", "python", "requests", "Python Requests", "transport", nil},
	{"python-httpx/", "python", "httpx", "Python HTTPX", "transport", nil},
	{"Python/", "python", "runtime", "Python", "transport", nil},
	{"python/", "python", "runtime", "Python", "transport", nil},
	{"Python-urllib/", "python", "urllib", "Python urllib", "transport", nil},
	{"python-urllib/", "python", "urllib", "Python urllib", "transport", nil},
	{"urllib3/", "python", "urllib3", "Python urllib3", "transport", nil},
	{"aiohttp/", "python", "aiohttp", "Python aiohttp", "transport", nil},
	{"Mozilla/", "browser", "browser", "Browser", "transport", nil},
	{"curl/", "curl", "cli", "curl", "transport", nil},
}

func RecognizedClientFamilies() []ClientOption {
	options := make([]ClientOption, 0, len(clientRules))
	seen := make(map[string]bool)
	for _, rule := range clientRules {
		if !seen[rule.family] {
			// Family labels need no hard-coded second list of supported clients.
			name := rule.name
			switch rule.family {
			case "codex":
				name = "Codex"
			case "claude_code":
				name = "Claude Code"
			case "openai_sdk":
				name = "OpenAI SDK"
			case "python":
				name = "Python"
			}
			options = append(options, ClientOption{Value: rule.family, Label: name})
			seen[rule.family] = true
		}
	}
	// Historical Go-inferred logs keep their original family and remain searchable.
	return append(options, ClientOption{Value: "newapi", Label: "NewAPI (legacy)"})
}

var clientVersionToken = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$`)
var genericClientProduct = regexp.MustCompile(`^([A-Za-z][A-Za-z0-9._+-]{0,63})/([A-Za-z0-9][A-Za-z0-9._+-]{0,127})?(?:[ (;]|$)`)

func (rule clientRule) match(raw string) (string, bool) {
	if rule.pattern != nil {
		matches := rule.pattern.FindStringSubmatch(raw)
		if len(matches) == 0 {
			return "", false
		}
		if len(matches) > 1 {
			return matches[1], true
		}
		return "", true
	}
	product := strings.TrimRight(rule.prefix, "/ ")
	rest, ok := strings.CutPrefix(raw, product)
	if !ok {
		return "", false
	}
	if rest == "" {
		return "", true
	}
	separator := rule.prefix[len(rule.prefix)-1]
	if rest[0] != separator {
		// Parentheses/whitespace may follow a product with no version.
		return "", rest[0] == ' ' || rest[0] == '(' || rest[0] == ';'
	}
	rest = rest[1:]
	end := strings.IndexAny(rest, " (;")
	if end >= 0 {
		rest = rest[:end]
	}
	if rest == "" {
		return "", true
	}
	return rest, clientVersionToken.MatchString(rest)
}

func IdentifyClient(raw string) ClientIdentity {
	identity := ClientIdentity{ClientKey: fmt.Sprintf("unknown:%x", sha256.Sum256([]byte(raw))), Family: "unknown", DisplayName: "Unknown client", Confidence: "unknown", Kind: "unknown"}
	var cleaned strings.Builder
	invalid := false
	for _, r := range raw {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) || r == utf8.RuneError {
			invalid = true
			continue
		}
		if cleaned.Len()+utf8.RuneLen(r) > 2048 {
			identity.Truncated = true
			break
		}
		cleaned.WriteRune(r)
	}
	identity.UserAgent = cleaned.String()
	// Never assign a recognized identity to sanitized, truncated or malformed data.
	if invalid || identity.Truncated {
		return identity
	}

	// Only match whole products outside UA comments, never names embedded in comments.
	starts := make([]int, 0, 8)
	depth := 0
	for i := 0; i < len(raw); i++ {
		if depth > 0 && raw[i] == '\\' {
			i++
			continue
		}
		if raw[i] == '(' {
			depth++
			continue
		}
		if raw[i] == ')' {
			if depth == 0 {
				return identity
			}
			depth--
			continue
		}
		if depth == 0 && raw[i] != ' ' && (i == 0 || raw[i-1] == ' ') {
			starts = append(starts, i)
		}
	}
	if depth != 0 {
		return identity
	}

	bestRank := 0
	bestStart := len(raw)
	leadingKnown := false
	for _, rule := range clientRules {
		rank := 1
		if rule.kind == "sdk" {
			rank = 2
		}
		if rule.kind == "application" {
			rank = 3
		}
		for _, start := range starts {
			version, matched := rule.match(raw[start:])
			if !matched {
				continue
			}
			if start == 0 {
				leadingKnown = true
			}
			if rank < bestRank || (rank == bestRank && start >= bestStart) {
				continue
			}
			identity.ClientKey = rule.family + ":" + rule.variant
			identity.Family, identity.Variant, identity.DisplayName = rule.family, rule.variant, rule.name
			identity.Version, identity.Kind, identity.Confidence = version, rule.kind, "identified"
			bestRank = rank
			bestStart = start
		}
	}
	// Preserve an unfamiliar leading application instead of hiding it behind its SDK.
	// Keep unfamiliar products in the unknown family while displaying their names.
	if bestRank < 3 && !leadingKnown {
		if match := genericClientProduct.FindStringSubmatch(raw); len(match) == 3 {
			identity.ClientKey = fmt.Sprintf("unknown-product:%x", sha256.Sum256([]byte(strings.ToLower(match[1]))))
			identity.Family, identity.Variant, identity.DisplayName = "unknown", "", match[1]
			identity.Version, identity.Kind, identity.Confidence = match[2], "unknown", "unverified"
		}
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
