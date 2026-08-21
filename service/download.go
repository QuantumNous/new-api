package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var ErrUserOutboundRequestsDisabled = errors.New("user-controlled outbound requests are disabled")

const maxWorkerTestResponseBytes = 4096

// WorkerRequest Worker请求的数据结构
type WorkerRequest struct {
	URL     string            `json:"url"`
	Key     string            `json:"key"`
	Method  string            `json:"method,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body,omitempty"`
}

// DoWorkerRequest 通过Worker发送请求
func DoWorkerRequest(req *WorkerRequest) (*http.Response, error) {
	if !system_setting.EnableWorker() {
		return nil, fmt.Errorf("worker not enabled")
	}
	if !system_setting.WorkerAllowHttpImageRequestEnabled && !strings.HasPrefix(strings.ToLower(strings.TrimSpace(req.URL)), "https://") {
		return nil, fmt.Errorf("only support https url")
	}
	return doWorkerRequest(req, system_setting.WorkerUrl)
}

func doWorkerRequest(req *WorkerRequest, workerURL string) (*http.Response, error) {
	workerURL = strings.TrimSpace(workerURL)
	if workerURL == "" {
		return nil, fmt.Errorf("worker URL is required")
	}

	// SSRF防护：验证请求URL
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(req.URL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}

	if !strings.HasSuffix(workerURL, "/") {
		workerURL += "/"
	}

	// 序列化worker请求数据
	workerPayload, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal worker payload: %v", err)
	}

	return GetHttpClient().Post(workerURL, "application/json", bytes.NewBuffer(workerPayload))
}

func validateUserOutboundURL(rawURL string) error {
	if !system_setting.UserOutboundRequestsEnabled {
		return ErrUserOutboundRequestsDisabled
	}

	parsedURL, err := url.ParseRequestURI(strings.TrimSpace(rawURL))
	if err != nil || parsedURL.Host == "" {
		return fmt.Errorf("invalid outbound request URL")
	}

	switch strings.ToLower(parsedURL.Scheme) {
	case "https":
		return nil
	case "http":
		if system_setting.WorkerAllowHttpImageRequestEnabled {
			return nil
		}
		return fmt.Errorf("unencrypted HTTP requests are disabled")
	default:
		return fmt.Errorf("only HTTP and HTTPS URLs are supported")
	}
}

// ValidateUserOutboundRequest applies the ordinary-user outbound policy.
// Administrator-controlled requests are outside this policy's scope.
func ValidateUserOutboundRequest(userID int, role int, rawURL string) error {
	policyErr := validateUserOutboundURL(rawURL)
	if policyErr == nil || role >= common.RoleAdminUser {
		return nil
	}

	if userID > 0 {
		user, err := model.GetUserCache(userID)
		if err == nil && user.Role >= common.RoleAdminUser {
			return nil
		}
	}

	return policyErr
}

func DoUserDownloadRequest(c *gin.Context, originURL string, reason ...string) (*http.Response, error) {
	userID := 0
	role := 0
	if c != nil {
		userID = c.GetInt("id")
		role = c.GetInt("role")
	}
	if err := ValidateUserOutboundRequest(userID, role, originURL); err != nil {
		return nil, err
	}
	return DoDownloadRequest(originURL, reason...)
}

// TestWorkerProxy verifies that a Worker can fetch the fixed public IP endpoint.
// The target status code is intentionally ignored; only the first response body is validated.
func TestWorkerProxy(workerURL string, workerValidKey string) (string, error) {
	resp, err := doWorkerRequest(&WorkerRequest{
		URL:    "https://ip.sb",
		Key:    workerValidKey,
		Method: http.MethodGet,
	}, workerURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxWorkerTestResponseBytes+1))
	if err != nil {
		return "", fmt.Errorf("failed to read worker response: %v", err)
	}
	if len(body) > maxWorkerTestResponseBytes {
		return "", fmt.Errorf("worker response is too large")
	}

	ip := net.ParseIP(strings.TrimSpace(string(body)))
	if ip == nil {
		return "", fmt.Errorf("worker response is not a valid IP address")
	}
	return ip.String(), nil
}

func DoDownloadRequest(originUrl string, reason ...string) (resp *http.Response, err error) {
	if system_setting.EnableWorker() {
		common.SysLog(fmt.Sprintf("downloading file from worker: %s, reason: %s", originUrl, strings.Join(reason, ", ")))
		req := &WorkerRequest{
			URL: originUrl,
			Key: system_setting.WorkerValidKey,
		}
		return DoWorkerRequest(req)
	} else {
		// SSRF防护：验证请求URL（非Worker模式）
		if err := ValidateSSRFProtectedFetchURL(originUrl); err != nil {
			return nil, fmt.Errorf("request reject: %v", err)
		}

		common.SysLog(fmt.Sprintf("downloading from origin: %s, reason: %s", common.MaskSensitiveInfo(originUrl), strings.Join(reason, ", ")))
		return GetSSRFProtectedHTTPClient().Get(originUrl)
	}
}
