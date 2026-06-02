package common

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestNormalizePhoneRejectsBlank(t *testing.T) {
	if _, err := NormalizePhone("   "); err == nil {
		t.Fatal("expected blank phone to be rejected")
	}
}

func TestNormalizePhoneTrimsWhitespace(t *testing.T) {
	phone, err := NormalizePhone(" 13800138000 ")
	if err != nil {
		t.Fatalf("NormalizePhone returned error: %v", err)
	}
	if phone != "13800138000" {
		t.Fatalf("expected normalized phone 13800138000, got %q", phone)
	}
}

func TestSMSBaoProviderSendsRequestWithConfiguredProductID(t *testing.T) {
	var captured url.Values
	provider := SMSBaoProvider{
		Endpoint:   "https://sms.example.test/sms",
		Username:   "demo-user",
		Credential: "demo-key",
		ProductID:  "vip-001",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			captured = req.URL.Query()
			if req.Method != http.MethodGet {
				t.Fatalf("expected GET request, got %s", req.Method)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("0")),
				Header:     make(http.Header),
			}, nil
		})},
	}
	result, err := provider.Send(context.Background(), SMSProviderSendInput{
		Phone:   " 13800138000 ",
		Content: "【new-api】验证码 123456",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if !result.Success || result.Provider != SMSProviderSMSBao || result.ProviderCode != "0" {
		t.Fatalf("unexpected send result: %+v", result)
	}
	if captured.Get("u") != "demo-user" || captured.Get("p") != "demo-key" || captured.Get("g") != "vip-001" {
		t.Fatalf("unexpected credential query values: %s", captured.Encode())
	}
	if captured.Get("m") != "13800138000" {
		t.Fatalf("unexpected phone query value: %s", captured.Get("m"))
	}
	if captured.Get("c") != "【new-api】验证码 123456" {
		t.Fatalf("unexpected content query value: %s", captured.Get("c"))
	}
}

func TestSMSBaoProviderMapsKnownProviderErrorCode(t *testing.T) {
	provider := SMSBaoProvider{
		Endpoint:   "https://sms.example.test/sms",
		Username:   "demo-user",
		Credential: "demo-key",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("41")),
				Header:     make(http.Header),
			}, nil
		})},
	}
	result, err := provider.Send(context.Background(), SMSProviderSendInput{
		Phone:   "13800138000",
		Content: "验证码 123456",
	})
	if err == nil {
		t.Fatal("expected provider error")
	}
	if result.Success || result.ProviderCode != "41" {
		t.Fatalf("unexpected failure result: %+v", result)
	}
	if err.Error() != "smsbao balance is insufficient" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSMSBaoProviderQueriesBalanceWithConfiguredEndpoint(t *testing.T) {
	var captured url.Values
	var capturedPath string
	provider := SMSBaoProvider{
		QueryEndpoint: "https://balance.example.test/query",
		Username:      "demo-user",
		Credential:    "demo-key",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			captured = req.URL.Query()
			capturedPath = req.URL.Path
			if req.Method != http.MethodGet {
				t.Fatalf("expected GET request, got %s", req.Method)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("0\n12,88")),
				Header:     make(http.Header),
			}, nil
		})},
	}

	result, err := provider.CheckStatus(context.Background())
	if err != nil {
		t.Fatalf("CheckStatus returned error: %v", err)
	}
	if !result.Success || result.Provider != SMSProviderSMSBao || result.ProviderCode != "0" {
		t.Fatalf("unexpected status result: %+v", result)
	}
	if result.SentCount != 12 || result.RemainingCount != 88 {
		t.Fatalf("unexpected balance counts: %+v", result)
	}
	if capturedPath != "/query" || captured.Get("u") != "demo-user" || captured.Get("p") != "demo-key" {
		t.Fatalf("unexpected balance query: path=%q query=%s", capturedPath, captured.Encode())
	}
}

func TestSMSBaoProviderDoesNotExposeCredentialOnBalanceTransportError(t *testing.T) {
	provider := SMSBaoProvider{
		QueryEndpoint: "https://balance.example.test/query",
		Username:      "demo-user",
		Credential:    "leak-me-token",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return nil, fmt.Errorf("dial failed")
		})},
	}
	_, err := provider.CheckStatus(context.Background())
	if err == nil {
		t.Fatal("expected query transport error")
	}
	if err.Error() != "smsbao query failed" {
		t.Fatalf("expected sanitized error, got %v", err)
	}
	for _, forbidden := range []string{"leak-me-token", "demo-user", "balance.example.test"} {
		if strings.Contains(err.Error(), forbidden) {
			t.Fatalf("query error leaked %q: %v", forbidden, err)
		}
	}
}

func TestSMSBaoProviderRejectsMalformedBalanceResponse(t *testing.T) {
	provider := SMSBaoProvider{
		QueryEndpoint: "https://balance.example.test/query",
		Username:      "demo-user",
		Credential:    "demo-key",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("0\nnot-a-balance")),
				Header:     make(http.Header),
			}, nil
		})},
	}
	_, err := provider.CheckStatus(context.Background())
	if err == nil {
		t.Fatal("expected malformed balance response error")
	}
	if err.Error() != "smsbao balance response is invalid" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSMSBaoProviderDoesNotExposeCredentialOnTransportError(t *testing.T) {
	provider := SMSBaoProvider{
		Endpoint:   "https://sms.example.test/sms",
		Username:   "demo-user",
		Credential: "leak-me-token",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return nil, fmt.Errorf("dial failed")
		})},
	}
	_, err := provider.Send(context.Background(), SMSProviderSendInput{
		Phone:   "13800138000",
		Content: "验证码 123456",
	})
	if err == nil {
		t.Fatal("expected transport error")
	}
	if err.Error() != "smsbao request failed" {
		t.Fatalf("expected sanitized error, got %v", err)
	}
	for _, forbidden := range []string{"leak-me-token", "13800138000", "123456", "验证码"} {
		if strings.Contains(err.Error(), forbidden) {
			t.Fatalf("transport error leaked %q: %v", forbidden, err)
		}
	}
}

func TestNewSMSProviderUsesSMSBaoConfiguration(t *testing.T) {
	originalProvider := SMSProviderName
	originalEndpoint := SMSBaoEndpoint
	originalQueryEndpoint := SMSBaoQueryEndpoint
	originalUsername := SMSBaoUsername
	originalCredential := SMSBaoCredential
	originalProductID := SMSBaoProductID
	t.Cleanup(func() {
		SMSProviderName = originalProvider
		SMSBaoEndpoint = originalEndpoint
		SMSBaoQueryEndpoint = originalQueryEndpoint
		SMSBaoUsername = originalUsername
		SMSBaoCredential = originalCredential
		SMSBaoProductID = originalProductID
	})

	SMSProviderName = SMSProviderSMSBao
	SMSBaoEndpoint = "https://example.invalid/sms"
	SMSBaoQueryEndpoint = "https://example.invalid/query"
	SMSBaoUsername = "demo-user"
	SMSBaoCredential = "demo-key"
	SMSBaoProductID = "vip-001"

	provider, err := NewSMSProvider(SMSProviderName)
	if err != nil {
		t.Fatalf("NewSMSProvider returned error: %v", err)
	}
	smsBao, ok := provider.(*SMSBaoProvider)
	if !ok {
		t.Fatalf("expected *SMSBaoProvider, got %T", provider)
	}
	if smsBao.Endpoint != SMSBaoEndpoint || smsBao.QueryEndpoint != SMSBaoQueryEndpoint || smsBao.Username != SMSBaoUsername || smsBao.Credential != SMSBaoCredential || smsBao.ProductID != SMSBaoProductID {
		t.Fatalf("provider did not use global configuration: %+v", smsBao)
	}
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}
