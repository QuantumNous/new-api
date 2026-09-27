package mineru

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

const ChannelName = "mineru"

// dnsResolveTimeout bounds hostname resolution during the credential
// transport check so an unresponsive resolver cannot stall the request.
const dnsResolveTimeout = 3 * time.Second

var ModelList = []string{"mineru"}

type Adaptor struct {
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

// GetRequestURL returns channel base_url + /file_parse.
// Local MinerU:  base_url = http://mineru-api:8000
// Upstream API:  base_url = https://gateway.example.com/v1
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseUrl := strings.TrimRight(info.ChannelBaseUrl, "/")
	if baseUrl == "" {
		return "", errors.New("mineru channel base_url is empty")
	}
	return fmt.Sprintf("%s/file_parse", baseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	// Multipart passthrough: Content-Type (with boundary) is set by
	// DoFormRequest from the incoming request.
	//
	// The transport check must also cover channels that leave ApiKey empty
	// and inject the credential through a channel-level Authorization
	// header override instead: DoFormRequest applies header overrides after
	// this hook, so an override would otherwise bypass the check.
	if info.ApiKey != "" || hasAuthorizationOverride(info) {
		if err := ensureSecureCredentialTransport(info.ChannelBaseUrl); err != nil {
			return err
		}
	}
	if info.ApiKey != "" {
		req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	}
	return nil
}

// hasAuthorizationOverride reports whether the effective channel header
// override configures a non-empty Authorization header.
func hasAuthorizationOverride(info *relaycommon.RelayInfo) bool {
	for key, value := range relaycommon.GetEffectiveHeaderOverride(info) {
		if !strings.EqualFold(strings.TrimSpace(key), "authorization") {
			continue
		}
		if str, ok := value.(string); ok && strings.TrimSpace(str) != "" {
			return true
		}
	}
	return false
}

// ensureSecureCredentialTransport refuses to send a Bearer credential over
// cleartext http:// to a non-private target (CWE-319). Documented local
// MinerU deployments on loopback / RFC1918 private networks / single-label
// container hostnames (e.g. http://mineru-api:8000) remain supported;
// any other target must use https.
func ensureSecureCredentialTransport(baseURL string) error {
	u, err := url.Parse(baseURL)
	if err != nil || u.Host == "" {
		return fmt.Errorf("invalid mineru channel base_url: %q", baseURL)
	}
	if strings.EqualFold(u.Scheme, "https") {
		return nil
	}
	if isPrivateOrLocalHost(u.Hostname()) {
		return nil
	}
	return fmt.Errorf("refusing to send Authorization over insecure %s channel base_url %q: use https or a private-network address", u.Scheme, baseURL)
}

// isPrivateOrLocalHost reports whether host points at a trusted local
// target: "localhost", a loopback / RFC1918-RFC4193 private / link-local
// address, or a single-label hostname (container / intranet DNS name) that
// resolves exclusively to such addresses. Resolution failures fail closed.
func isPrivateOrLocalHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "" {
		return false
	}
	if h == "localhost" {
		return true
	}
	if ip := net.ParseIP(h); ip != nil {
		return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
	}
	// Non-IP literal: multi-label names are not trusted; single-label
	// hostnames are trusted only when every resolved address is
	// private/local, so a name that resolves to a public address is
	// rejected before the credential is sent.
	if strings.Contains(h, ".") {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), dnsResolveTimeout)
	defer cancel()
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, h)
	if err != nil || len(addrs) == 0 {
		// Fail closed: an unresolvable host never receives credentials.
		return false
	}
	for _, addr := range addrs {
		if !(addr.IP.IsLoopback() || addr.IP.IsPrivate() || addr.IP.IsLinkLocalUnicast()) {
			return false
		}
	}
	return true
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoFormRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// The response body is streamed back verbatim by MinerUHelper; here we
	// only return zero usage (per-call billing).
	return &dto.Usage{}, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// Stubs required by the channel.Adaptor interface (not used by MinerU relay).

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}
