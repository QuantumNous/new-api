package service

import (
	"net/http"
	"strconv"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/common"
)

const (
	OptionKeyCodexClientUserAgent       = "CodexClientUserAgent"
	OptionKeyCodexClientVersion         = "CodexClientVersion"
	OptionKeyCodexSyncedClientVersion   = "CodexSyncedClientVersion"
	OptionKeyCodexSyncedClientVersionAt = "CodexSyncedClientVersionAt"
	OptionKeyCodexAutoSyncClientVersion = "CodexAutoSyncClientVersion"
	OptionKeyCodexEnforceClientIdentity = "CodexEnforceClientIdentity"
	builtInCodexClientVersion           = "0.144.0"
	canonicalCodexClientUserAgentPrefix = "codex-cli/"
	canonicalCodexClientOriginator      = "codex_cli_rs"
	codexClientVersionHeader            = "OpenAI-Client-Version"
	maxCodexClientVersionLength         = 64
)

type CodexClientIdentity struct {
	UserAgent  string
	Originator string
	Version    string
}

func ResolveCodexClientIdentity() CodexClientIdentity {
	version := resolveCodexClientVersion()
	return resolveCodexClientIdentityForVersion(version)
}

func resolveCodexClientIdentityForVersion(version string) CodexClientIdentity {
	return CodexClientIdentity{
		UserAgent:  resolveCodexClientUserAgent(readCodexIdentityOption(OptionKeyCodexClientUserAgent), version),
		Originator: canonicalCodexClientOriginator,
		Version:    version,
	}
}

func ApplyCodexInferenceIdentity(header http.Header, identity CodexClientIdentity) {
	if header == nil || !IsCodexClientIdentityEnforced() {
		return
	}
	ApplyCodexInferenceIdentitySnapshot(header, identity)
}

// ApplyCodexInferenceIdentitySnapshot applies a caller-owned enforcement
// decision without rereading mutable configuration between check and use.
func ApplyCodexInferenceIdentitySnapshot(header http.Header, identity CodexClientIdentity) {
	if header == nil {
		return
	}
	header.Set("User-Agent", identity.UserAgent)
	header.Set("originator", identity.Originator)
	header.Set(codexClientVersionHeader, identity.Version)
}

func ApplyCodexCredentialIdentity(header http.Header, identity CodexClientIdentity) {
	if header == nil || !IsCodexClientIdentityEnforced() {
		return
	}
	header.Set("User-Agent", identity.UserAgent)
	header.Set("originator", identity.Originator)
	header.Del(codexClientVersionHeader)
}

func IsCodexClientIdentityEnforced() bool {
	raw := strings.TrimSpace(readCodexIdentityOption(OptionKeyCodexEnforceClientIdentity))
	if raw == "" {
		return true
	}
	enabled, err := strconv.ParseBool(raw)
	if err != nil {
		return true
	}
	return enabled
}

func IsCodexClientVersionAutoSyncEnabled() bool {
	raw := strings.TrimSpace(readCodexIdentityOption(OptionKeyCodexAutoSyncClientVersion))
	if raw == "" {
		return true
	}
	enabled, err := strconv.ParseBool(raw)
	if err != nil {
		return true
	}
	return enabled
}

func NormalizeCodexClientVersion(raw string) (string, bool) {
	version := strings.TrimSpace(raw)
	if len(version) == 0 || len(version) > maxCodexClientVersionLength {
		return "", false
	}
	for _, r := range version {
		if unicode.IsControl(r) {
			return "", false
		}
	}
	version = strings.TrimPrefix(version, "v")
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return "", false
	}
	nums := [3]int{}
	for i, part := range parts {
		if part == "" {
			return "", false
		}
		for _, r := range part {
			if r < '0' || r > '9' {
				return "", false
			}
		}
		n, err := strconv.Atoi(part)
		if err != nil {
			return "", false
		}
		nums[i] = n
	}
	if compareCodexVersion(nums, [3]int{0, 144, 0}) < 0 {
		return "", false
	}
	return version, true
}

func resolveCodexClientVersion() string {
	if version, ok := NormalizeCodexClientVersion(readCodexIdentityOption(OptionKeyCodexClientVersion)); ok {
		return version
	}
	if version, ok := NormalizeCodexClientVersion(readCodexIdentityOption(OptionKeyCodexSyncedClientVersion)); ok {
		return version
	}
	return builtInCodexClientVersion
}

func resolveCodexClientUserAgent(configured string, version string) string {
	ua := strings.TrimSpace(configured)
	if ua == "" || strings.ContainsFunc(ua, unicode.IsControl) || len(ua) > 512 {
		return canonicalCodexClientUserAgentPrefix + version
	}
	if !strings.HasPrefix(ua, canonicalCodexClientUserAgentPrefix) {
		return canonicalCodexClientUserAgentPrefix + version
	}
	rest := strings.TrimPrefix(ua, canonicalCodexClientUserAgentPrefix)
	if rest == "" {
		return canonicalCodexClientUserAgentPrefix + version
	}
	fields := strings.Fields(rest)
	if len(fields) == 0 {
		return canonicalCodexClientUserAgentPrefix + version
	}
	if !isStableCodexVersionSyntax(fields[0]) {
		return canonicalCodexClientUserAgentPrefix + version
	}
	suffix := strings.TrimSpace(strings.TrimPrefix(rest, fields[0]))
	if suffix == "" {
		return canonicalCodexClientUserAgentPrefix + version
	}
	return canonicalCodexClientUserAgentPrefix + version + " " + suffix
}

func isStableCodexVersionSyntax(raw string) bool {
	version := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(raw), "v"))
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
		for _, r := range part {
			if r < '0' || r > '9' {
				return false
			}
		}
	}
	return true
}

func compareCodexVersion(a, b [3]int) int {
	for i := range a {
		if a[i] < b[i] {
			return -1
		}
		if a[i] > b[i] {
			return 1
		}
	}
	return 0
}

func readCodexIdentityOption(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return ""
	}
	return common.OptionMap[key]
}
