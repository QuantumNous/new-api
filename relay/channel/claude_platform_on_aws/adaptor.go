package claude_platform_on_aws

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Adaptor implements the channel adapter for "Claude Platform on AWS".
//
// The wire protocol is identical to the first-party Anthropic Messages API
// (POST /v1/messages). The only differences from the standard Anthropic
// channel are:
//
//   - Base URL takes the form https://aws-external-anthropic.{region}.api.aws
//   - Authentication uses either AWS SigV4 (IAM) or a Bearer API key issued
//     in the AWS Console
//   - Each request must carry an additional anthropic-workspace-id header
//
// See https://docs.aws.amazon.com/claude-platform/latest/userguide/welcome.html
//
// Implementation strategy: embed claude.Adaptor and only override
// GetRequestURL / SetupRequestHeader / DoRequest / GetChannelName /
// GetModelList. Everything else (request/response parsing including
// streaming, tool use, thinking, etc.) is reused as-is from the Claude
// channel.
type Adaptor struct {
	claude.Adaptor
}

// resolveRegion prefers ChannelOtherSettings.ClaudeOnAwsRegion, falling back
// to the generic ApiVersion field if the region was put there by mistake.
func resolveRegion(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if r := strings.TrimSpace(info.ChannelOtherSettings.ClaudeOnAwsRegion); r != "" {
		return r
	}
	return strings.TrimSpace(info.ApiVersion)
}

// resolveWorkspaceID prefers the workspace configured on the channel,
// then falls back to the anthropic-workspace-id header on the incoming
// request (so multiple workspaces can share a single channel if desired).
func resolveWorkspaceID(c *gin.Context, info *relaycommon.RelayInfo) string {
	if info != nil {
		if w := strings.TrimSpace(info.ChannelOtherSettings.ClaudeOnAwsWorkspaceID); w != "" {
			return w
		}
	}
	if c != nil && c.Request != nil {
		if w := strings.TrimSpace(c.Request.Header.Get("anthropic-workspace-id")); w != "" {
			return w
		}
	}
	return ""
}

// GetChannelName returns the human-readable channel identifier used in
// logs and admin dashboards.
func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// GetModelList returns the list of model IDs supported by Claude Platform
// on AWS. The list is reused from the first-party Claude channel because
// AWS publishes the same model IDs.
func (a *Adaptor) GetModelList() []string {
	return ModelList
}

// Init is intentionally empty, matching claude.Adaptor.Init.
func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL returns the regional /v1/messages endpoint for Claude
// Platform on AWS.
//
// Behaviour:
//   - If the channel's base URL is empty, the URL is auto-built from region.
//   - If the channel sets a custom base URL (e.g. a corporate proxy),
//     /v1/messages is appended to it.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	region := resolveRegion(info)
	base := strings.TrimRight(info.ChannelBaseUrl, "/")
	if base == "" {
		if region == "" {
			return "", errors.New("claude platform on aws: region is required (set it in channel other_settings.claude_on_aws_region)")
		}
		base = fmt.Sprintf(EndpointTemplate, region)
	}
	return base + "/v1/messages", nil
}

// SetupRequestHeader sets the headers required by Claude Platform on AWS.
// In SigV4 mode the actual Authorization / X-Amz-* headers are set later
// in DoRequest, where the request body is available for signing.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	// anthropic-version
	anthropicVersion := strings.TrimSpace(c.Request.Header.Get("anthropic-version"))
	if anthropicVersion == "" {
		anthropicVersion = DefaultAnthropicVersion
	}
	req.Set("anthropic-version", anthropicVersion)

	// anthropic-workspace-id is required.
	wsID := resolveWorkspaceID(c, info)
	if wsID == "" {
		return errors.New("claude platform on aws: anthropic-workspace-id is required (set it in channel other_settings.claude_on_aws_workspace_id or send via header)")
	}
	req.Set("anthropic-workspace-id", wsID)

	// Pass through anthropic-beta and Claude common headers (custom headers etc.).
	claude.CommonClaudeHeadersOperation(c, req, info)

	// API Key mode: set Bearer immediately. SigV4 mode signs in DoRequest.
	if info.ChannelOtherSettings.ClaudeOnAwsAuthType == dto.ClaudeOnAwsAuthApiKey {
		req.Set("Authorization", "Bearer "+info.ApiKey)
	}
	return nil
}

// DoRequest takes over the full request flow when SigV4 is selected: the
// body must be read in full to compute the payload hash, signed onto the
// *http.Request, and only then dispatched. API key mode goes through the
// shared channel.DoApiRequest helper.
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	authType := info.ChannelOtherSettings.ClaudeOnAwsAuthType
	if authType == "" {
		authType = dto.ClaudeOnAwsAuthSigV4 // SigV4 is the default.
	}

	if authType == dto.ClaudeOnAwsAuthApiKey {
		return channel.DoApiRequest(a, c, info, requestBody)
	}

	// === SigV4 path ===
	region := resolveRegion(info)
	if region == "" {
		return nil, errors.New("claude platform on aws: region is required for sigv4 auth")
	}
	creds, err := parseSigV4ApiKey(info.ApiKey)
	if err != nil {
		return nil, fmt.Errorf("claude platform on aws: %w", err)
	}

	fullURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, fullURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}

	headers := httpReq.Header
	if err := a.SetupRequestHeader(c, &headers, info); err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}

	// Read the body for signing and put the same bytes back so client.Do can read them.
	bodyBytes, err := readAllAndReset(httpReq)
	if err != nil {
		return nil, fmt.Errorf("read request body failed: %w", err)
	}

	if err := signRequestSigV4(httpReq, bodyBytes, creds, region, SigV4ServiceName, time.Now()); err != nil {
		return nil, fmt.Errorf("sigv4 sign failed: %w", err)
	}

	return channel.DoRequest(c, httpReq, info)
}

// DoResponse delegates to claude.Adaptor; that implementation already sets
// info.FinalRequestRelayFormat = types.RelayFormatClaude as needed.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return a.Adaptor.DoResponse(c, resp, info)
}
