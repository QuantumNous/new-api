package common

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	SMSProviderSMSBao = "smsbao"

	DefaultSMSBaoEndpoint      = "https://api.smsbao.com/sms"
	DefaultSMSBaoQueryEndpoint = "https://www.smsbao.com/query"

	SMSBaoCredentialModeAPIKey      = "api_key"
	SMSBaoCredentialModeMD5Password = "md5_password"
)

type SMSProviderSendInput struct {
	Phone   string
	Content string
}

type SMSProviderSendResult struct {
	Provider     string
	ProviderCode string
	Success      bool
}

type SMSProviderStatusResult struct {
	Provider       string
	ProviderCode   string
	Success        bool
	SentCount      int
	RemainingCount int
}

type SMSProvider interface {
	Send(ctx context.Context, input SMSProviderSendInput) (SMSProviderSendResult, error)
}

type SMSProviderStatusChecker interface {
	CheckStatus(ctx context.Context) (SMSProviderStatusResult, error)
}

var SMSProviderFactory = defaultSMSProviderFactory

type SMSBaoProvider struct {
	Endpoint       string
	QueryEndpoint  string
	Username       string
	Credential     string
	CredentialMode string
	ProductID      string
	HTTPClient     *http.Client
}

func NormalizePhone(phone string) (string, error) {
	normalized := strings.TrimSpace(phone)
	if normalized == "" {
		return "", fmt.Errorf("phone is empty")
	}
	for _, ch := range normalized {
		if (ch < '0' || ch > '9') && ch != '+' {
			return "", fmt.Errorf("invalid phone format")
		}
	}
	return normalized, nil
}

func NewSMSProvider(providerName string) (SMSProvider, error) {
	return SMSProviderFactory(providerName)
}

func defaultSMSProviderFactory(providerName string) (SMSProvider, error) {
	name := strings.TrimSpace(providerName)
	if name == "" {
		name = SMSProviderName
	}
	switch strings.ToLower(name) {
	case SMSProviderSMSBao:
		return &SMSBaoProvider{
			Endpoint:       SMSBaoEndpoint,
			QueryEndpoint:  SMSBaoQueryEndpoint,
			Username:       SMSBaoUsername,
			Credential:     SMSBaoCredential,
			CredentialMode: SMSBaoCredentialMode,
			ProductID:      SMSBaoProductID,
			HTTPClient:     &http.Client{Timeout: 10 * time.Second},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported sms provider: %s", name)
	}
}

func MaskPhone(phone string) string {
	normalized, err := NormalizePhone(phone)
	if err != nil {
		return ""
	}
	if len(normalized) <= 7 {
		return normalized[:1] + "****" + normalized[len(normalized)-1:]
	}
	return normalized[:3] + "****" + normalized[len(normalized)-4:]
}

func (provider *SMSBaoProvider) Send(ctx context.Context, input SMSProviderSendInput) (SMSProviderSendResult, error) {
	result := SMSProviderSendResult{Provider: SMSProviderSMSBao}
	phone, err := NormalizePhone(input.Phone)
	if err != nil {
		return result, err
	}
	rawURL, err := provider.buildSendURL(phone, input.Content)
	if err != nil {
		return result, err
	}
	client := provider.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return result, fmt.Errorf("smsbao request is invalid")
	}
	resp, err := client.Do(req)
	if err != nil {
		return result, fmt.Errorf("smsbao request failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, fmt.Errorf("smsbao response read failed")
	}
	code := strings.TrimSpace(string(body))
	result.ProviderCode = code
	if err := parseSMSBaoResponse(code); err != nil {
		return result, err
	}
	result.Success = true
	return result, nil
}

func (provider *SMSBaoProvider) CheckStatus(ctx context.Context) (SMSProviderStatusResult, error) {
	result := SMSProviderStatusResult{Provider: SMSProviderSMSBao}
	rawURL, err := provider.buildQueryURL()
	if err != nil {
		return result, err
	}
	client := provider.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return result, fmt.Errorf("smsbao query request is invalid")
	}
	resp, err := client.Do(req)
	if err != nil {
		return result, fmt.Errorf("smsbao query failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, fmt.Errorf("smsbao query response read failed")
	}
	code, sentCount, remainingCount, err := parseSMSBaoQueryResponse(string(body))
	result.ProviderCode = code
	if err != nil {
		return result, err
	}
	result.SentCount = sentCount
	result.RemainingCount = remainingCount
	result.Success = true
	return result, nil
}

func (provider *SMSBaoProvider) buildSendURL(phone string, content string) (string, error) {
	if strings.TrimSpace(provider.Username) == "" || strings.TrimSpace(provider.Credential) == "" {
		return "", fmt.Errorf("smsbao credential is not configured")
	}
	endpoint := strings.TrimSpace(provider.Endpoint)
	if endpoint == "" {
		endpoint = DefaultSMSBaoEndpoint
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("smsbao endpoint is invalid")
	}
	values := parsed.Query()
	values.Set("u", provider.Username)
	values.Set("p", provider.Credential)
	values.Set("m", phone)
	values.Set("c", content)
	if strings.TrimSpace(provider.ProductID) != "" {
		values.Set("g", provider.ProductID)
	}
	parsed.RawQuery = values.Encode()
	return parsed.String(), nil
}

func (provider *SMSBaoProvider) buildQueryURL() (string, error) {
	if strings.TrimSpace(provider.Username) == "" || strings.TrimSpace(provider.Credential) == "" {
		return "", fmt.Errorf("smsbao credential is not configured")
	}
	endpoint := strings.TrimSpace(provider.QueryEndpoint)
	if endpoint == "" {
		endpoint = DefaultSMSBaoQueryEndpoint
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("smsbao query endpoint is invalid")
	}
	values := parsed.Query()
	values.Set("u", provider.Username)
	values.Set("p", provider.Credential)
	parsed.RawQuery = values.Encode()
	return parsed.String(), nil
}

func parseSMSBaoResponse(code string) error {
	switch strings.TrimSpace(code) {
	case "0":
		return nil
	case "30":
		return fmt.Errorf("smsbao credential rejected")
	case "40":
		return fmt.Errorf("smsbao account does not exist")
	case "41":
		return fmt.Errorf("smsbao balance is insufficient")
	case "43":
		return fmt.Errorf("smsbao ip is restricted")
	case "50":
		return fmt.Errorf("smsbao rejected sensitive content")
	case "51":
		return fmt.Errorf("smsbao rejected phone number")
	default:
		return fmt.Errorf("smsbao request failed: %s", strings.TrimSpace(code))
	}
}

func parseSMSBaoQueryResponse(response string) (string, int, int, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(response), "\r\n", "\n")
	lines := strings.Split(normalized, "\n")
	if len(lines) == 0 || strings.TrimSpace(lines[0]) == "" {
		return "", 0, 0, fmt.Errorf("smsbao query response is invalid")
	}
	code := strings.TrimSpace(lines[0])
	if err := parseSMSBaoResponse(code); err != nil {
		return code, 0, 0, err
	}
	if len(lines) < 2 {
		return code, 0, 0, fmt.Errorf("smsbao balance response is invalid")
	}
	parts := strings.Split(strings.TrimSpace(lines[1]), ",")
	if len(parts) != 2 {
		return code, 0, 0, fmt.Errorf("smsbao balance response is invalid")
	}
	sentCount, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return code, 0, 0, fmt.Errorf("smsbao balance response is invalid")
	}
	remainingCount, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return code, 0, 0, fmt.Errorf("smsbao balance response is invalid")
	}
	return code, sentCount, remainingCount, nil
}
