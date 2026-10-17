package aws

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/gin-gonic/gin"
)

func mantleRequestURL(info *relaycommon.RelayInfo) (string, error) {
	parts := strings.Split(info.ApiKey, "|")
	if len(parts) != 2 && len(parts) != 3 {
		return "", fmt.Errorf("invalid AWS credentials: use APIKey|Region or AccessKey|SecretAccessKey|Region")
	}
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			return "", fmt.Errorf("invalid AWS credentials: empty credential or region")
		}
	}
	region := parts[len(parts)-1]
	for _, ch := range region {
		if (ch < 'a' || ch > 'z') && (ch < '0' || ch > '9') && ch != '-' {
			return "", fmt.Errorf("invalid AWS region")
		}
	}
	baseURL := strings.TrimRight(info.ChannelBaseUrl, "/")
	if baseURL == "" {
		baseURL = "https://bedrock-mantle." + region + ".api.aws"
	}
	endpoint, err := url.Parse(baseURL)
	if err != nil || endpoint.Scheme != "https" || endpoint.Host == "" || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return "", fmt.Errorf("AWS Mantle base URL must be an HTTPS URL without credentials, query, or fragment")
	}
	switch {
	case strings.HasSuffix(endpoint.Path, "/anthropic/v1/messages"):
	case strings.HasSuffix(endpoint.Path, "/anthropic/v1"):
		endpoint.Path += "/messages"
	case strings.HasSuffix(endpoint.Path, "/anthropic"):
		endpoint.Path += "/v1/messages"
	default:
		endpoint.Path += "/anthropic/v1/messages"
	}
	return endpoint.String(), nil
}

// Mantle uses native Messages JSON and SSE, not the InvokeModel envelope.
// Sign the final payload and headers, including administrator overrides.
func (a *Adaptor) newMantleRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Request, error) {
	endpoint, err := mantleRequestURL(info)
	if err != nil {
		return nil, err
	}
	if a.IsNova || isNovaModel(getAwsModelID(info.UpstreamModelName)) {
		return nil, fmt.Errorf("AWS Mantle Messages API requires a Claude model; use InvokeModel for Amazon Nova")
	}
	var payload map[string]json.RawMessage
	if err := common.DecodeJson(requestBody, &payload); err != nil {
		return nil, fmt.Errorf("decode AWS Mantle request: %w", err)
	}
	if payload == nil {
		return nil, fmt.Errorf("AWS Mantle request must be a JSON object")
	}
	// Use the channel's resolved model even for passthrough requests. Do not
	// apply InvokeModel's version suffixes or automatic cross-region prefixes.
	model := info.UpstreamModelName
	if model == "claude-haiku-4-5-20251001" {
		model = "claude-haiku-4-5"
	}
	if strings.HasPrefix(model, "claude-") {
		model = "anthropic." + model
	}
	payload["model"], err = common.Marshal(model)
	if err != nil {
		return nil, err
	}
	delete(payload, "anthropic_version")
	delete(payload, "anthropic_beta")
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal AWS Mantle request: %w", err)
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create AWS Mantle request: %w", err)
	}
	channel.SetupApiRequestHeader(info, c, &req.Header)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	claude.CommonClaudeHeadersOperation(c, &req.Header, info)
	parts := strings.Split(info.ApiKey, "|")
	if len(parts) == 2 {
		req.Header.Set("x-api-key", parts[0])
	}
	headerOverride, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, err
	}
	for key, value := range headerOverride {
		req.Header.Set(key, value)
		if strings.EqualFold(key, "Host") {
			req.Host = value
		}
	}
	// HTTP/2 and intermediaries can remove hop-by-hop headers. Strip them
	// after overrides, including fields named by Connection, so SigV4 covers
	// only headers that will reach Mantle. Proxy credentials must stay local.
	for _, connection := range req.Header.Values("Connection") {
		for name := range strings.SplitSeq(connection, ",") {
			req.Header.Del(strings.TrimSpace(name))
		}
	}
	for _, name := range []string{
		"Connection", "Proxy-Connection", "Keep-Alive", "Proxy-Authenticate",
		"Proxy-Authorization", "Te", "Trailer", "Transfer-Encoding", "Upgrade",
	} {
		req.Header.Del(name)
	}
	if len(parts) == 3 {
		// Never send an unrelated bearer credential alongside SigV4. The AWS
		// signer handles timestamps and signing the exact transmitted payload.
		req.Header.Del("Authorization")
		req.Header.Del("x-api-key")
		credentials := aws.Credentials{AccessKeyID: parts[0], SecretAccessKey: parts[1]}
		hash := sha256.Sum256(body)
		if err := v4.NewSigner().SignHTTP(req.Context(), credentials, req, hex.EncodeToString(hash[:]), "bedrock-mantle", parts[2], time.Now()); err != nil {
			return nil, fmt.Errorf("sign AWS Mantle request: %w", err)
		}
	}
	return req, nil
}
