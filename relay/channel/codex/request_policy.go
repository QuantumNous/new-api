package codex

import (
	"net/http"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	codexRequiredBeta = "responses=experimental"
	codexOriginator   = "codex_cli_rs"
)

var codexDropHeaders = []string{
	"Cookie",
	"traceparent",
	"tracestate",
	"baggage",
	"Accept-Language",
	"OpenAI-Locale",
	"OpenAI-Timeout-Ms",
	"X-Codex-Beta-Features",
	"X-Codex-Turn-State",
	"X-Codex-Attestation",
}

var codexIdentityDropHeaders = []string{
	"User-Agent",
	"OpenAI-Client",
	"OpenAI-Client-Version",
	"X-OpenAI-Client",
	"X-OpenAI-Client-Version",
	"X-Codex-Client-Version",
	"X-Codex-CLI-Version",
	"X-Codex-Version",
	"Codex-Version",
}

// FinalizeRequest is the last Codex egress policy gate. It runs after channel
// header overrides, so client/admin overrides cannot replace server-owned
// subscription auth, required media headers, or staged fingerprint identity.
func (a *Adaptor) FinalizeRequest(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return finalizeCodexRequest(c, req, info)
}

func FinalizeCodexRequest(req *http.Request, info *relaycommon.RelayInfo) error {
	return finalizeCodexRequest(nil, req, info)
}

func finalizeCodexRequest(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if req == nil {
		return nil
	}
	if req.Header == nil {
		req.Header = http.Header{}
	}

	for _, name := range codexDropHeaders {
		req.Header.Del(name)
	}
	enforceClientIdentity := service.IsCodexClientIdentityEnforced()
	if enforceClientIdentity {
		for _, name := range codexIdentityDropHeaders {
			req.Header.Del(name)
		}
		req.Header.Set("User-Agent", "")
	}
	dropUnknownCodexHeaders(req.Header, true)

	if info == nil {
		req.Header.Del("Authorization")
		req.Header.Del("chatgpt-account-id")
		req.Header.Del("OpenAI-Beta")
		req.Header.Del("X-Codex-Turn-Metadata")
		dropUnknownCodexHeaders(req.Header, false)
		return &codexPolicyError{"codex channel: relay info is required"}
	}

	oauthKey, err := ParseOAuthKey(strings.TrimSpace(info.ApiKey))
	if err != nil {
		return err
	}
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	if accessToken == "" {
		return errAccessTokenRequired()
	}
	if accountID == "" {
		return errAccountIDRequired()
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("chatgpt-account-id", accountID)
	req.Header.Set("OpenAI-Beta", codexRequiredBeta)
	if enforceClientIdentity {
		req.Header.Set("originator", codexOriginator)
		service.ApplyCodexInferenceIdentitySnapshot(req.Header, service.ResolveCodexClientIdentity())
	}
	req.Header.Set("Content-Type", "application/json")
	if info.IsStream {
		req.Header.Set("Accept", "text/event-stream")
	} else {
		req.Header.Set("Accept", "application/json")
	}

	ids, err := fingerprintIDsForRequest(c, info)
	if err != nil {
		return err
	}
	if ids == nil {
		// Fingerprint mode "off" intentionally has no staged identity. Keep the
		// authenticated request valid while removing any client-supplied metadata.
		req.Header.Del("X-Codex-Turn-Metadata")
		dropUnknownCodexHeaders(req.Header, false)
		return nil
	}
	applyFingerprintHeaders(req.Header, ids)
	return nil
}

func dropUnknownCodexHeaders(header http.Header, preserveTurnMetadata bool) {
	for name := range header {
		lower := strings.ToLower(name)
		if preserveTurnMetadata && lower == "x-codex-turn-metadata" {
			continue
		}
		if strings.HasPrefix(lower, "x-codex-") {
			header.Del(name)
		}
	}
}

func errAccessTokenRequired() error {
	return &codexPolicyError{"codex channel: access_token is required"}
}

func errAccountIDRequired() error {
	return &codexPolicyError{"codex channel: account_id is required"}
}

type codexPolicyError struct {
	message string
}

func (e *codexPolicyError) Error() string {
	return e.message
}
