package codex

import (
	"net/http"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

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
	dropUnknownCodexHeaders(req.Header)

	if info == nil {
		return nil
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
	req.Header.Set("originator", codexOriginator)
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
	applyFingerprintHeaders(req.Header, ids)
	return nil
}

func dropUnknownCodexHeaders(header http.Header) {
	for name := range header {
		if strings.HasPrefix(strings.ToLower(name), "x-codex-") {
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
