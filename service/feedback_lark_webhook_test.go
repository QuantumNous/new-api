package service

import (
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

type feedbackWebhookRoundTripperFunc func(*http.Request) (*http.Response, error)

func (f feedbackWebhookRoundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestNotifyFeedbackLarkWebhookSendsInteractiveCard(t *testing.T) {
	var requestBody string

	prevEnabled := common.FeedbackLarkWebhookEnabled
	prevURL := common.FeedbackLarkWebhookURL
	prevSecret := common.FeedbackLarkWebhookSecret
	prevMentionAll := common.FeedbackLarkWebhookMentionAllEnabled
	prevMentionOpenIDs := common.FeedbackLarkWebhookMentionOpenIDs
	prevSleep := feedbackLarkWebhookSleep
	prevClient := GetHttpClient()
	fetchSetting := system_setting.GetFetchSetting()
	prevSSRF := fetchSetting.EnableSSRFProtection

	httpClient = &http.Client{
		Transport: feedbackWebhookRoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			body, err := ioReadAllString(r)
			if err != nil {
				return nil, err
			}
			requestBody = body
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"code":0,"msg":"success","data":{}}`)),
			}, nil
		}),
	}

	t.Cleanup(func() {
		common.FeedbackLarkWebhookEnabled = prevEnabled
		common.FeedbackLarkWebhookURL = prevURL
		common.FeedbackLarkWebhookSecret = prevSecret
		common.FeedbackLarkWebhookMentionAllEnabled = prevMentionAll
		common.FeedbackLarkWebhookMentionOpenIDs = prevMentionOpenIDs
		feedbackLarkWebhookSleep = prevSleep
		httpClient = prevClient
		fetchSetting.EnableSSRFProtection = prevSSRF
	})

	common.FeedbackLarkWebhookEnabled = true
	common.FeedbackLarkWebhookURL = "https://example.com/lark-webhook"
	common.FeedbackLarkWebhookSecret = "demo-secret"
	common.FeedbackLarkWebhookMentionAllEnabled = true
	common.FeedbackLarkWebhookMentionOpenIDs = "ou_member_1,ou_member_2"
	fetchSetting.EnableSSRFProtection = false
	feedbackLarkWebhookSleep = func(time.Duration) {}

	feedback := &model.Feedback{
		Username:    "alice",
		Email:       "alice@example.com",
		Category:    "bug",
		Content:     "feedback content",
		CreatedTime: 1774111111,
	}

	if err := NotifyFeedbackLarkWebhook(feedback); err != nil {
		t.Fatalf("notify feedback lark webhook: %v", err)
	}

	var payload map[string]interface{}
	if err := common.Unmarshal([]byte(requestBody), &payload); err != nil {
		t.Fatalf("unmarshal request body: %v", err)
	}

	if payload["msg_type"] != "interactive" {
		t.Fatalf("expected interactive card payload, got %v", payload["msg_type"])
	}
	if payload["timestamp"] == "" {
		t.Fatalf("expected timestamp in payload, got %s", requestBody)
	}
	if payload["sign"] == "" {
		t.Fatalf("expected sign in payload, got %s", requestBody)
	}

	card, ok := payload["card"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected card object, got %T", payload["card"])
	}
	header, ok := card["header"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected card header object, got %T", card["header"])
	}
	title, ok := header["title"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected title object, got %T", header["title"])
	}
	if title["content"] != "Feedback 新提交通知" {
		t.Fatalf("unexpected card title: %v", title["content"])
	}

	elements, ok := card["elements"].([]interface{})
	if !ok || len(elements) == 0 {
		t.Fatalf("expected card elements, got %T", card["elements"])
	}
	firstElement, ok := elements[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected first element object, got %T", elements[0])
	}
	textBlock, ok := firstElement["text"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected text block object, got %T", firstElement["text"])
	}
	content, _ := textBlock["content"].(string)
	if !strings.Contains(content, "alice@example.com") {
		t.Fatalf("expected feedback email in payload, got %s", content)
	}
	if !strings.Contains(content, "<at id=all></at>") {
		t.Fatalf("expected mention all in payload, got %s", content)
	}
	if !strings.Contains(content, "<at id=ou_member_1></at>") {
		t.Fatalf("expected member mention in payload, got %s", content)
	}
}

func TestNotifyFeedbackLarkWebhookRetriesUntilSuccess(t *testing.T) {
	var requestCount int32
	var sleepCount int32

	prevEnabled := common.FeedbackLarkWebhookEnabled
	prevURL := common.FeedbackLarkWebhookURL
	prevSleep := feedbackLarkWebhookSleep
	prevClient := GetHttpClient()
	fetchSetting := system_setting.GetFetchSetting()
	prevSSRF := fetchSetting.EnableSSRFProtection

	httpClient = &http.Client{
		Transport: feedbackWebhookRoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			currentCount := atomic.AddInt32(&requestCount, 1)
			if currentCount < 3 {
				return &http.Response{
					StatusCode: http.StatusBadGateway,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body:       io.NopCloser(strings.NewReader(`{"code":500,"msg":"retry"}`)),
				}, nil
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"code":0,"msg":"success","data":{}}`)),
			}, nil
		}),
	}

	t.Cleanup(func() {
		common.FeedbackLarkWebhookEnabled = prevEnabled
		common.FeedbackLarkWebhookURL = prevURL
		feedbackLarkWebhookSleep = prevSleep
		httpClient = prevClient
		fetchSetting.EnableSSRFProtection = prevSSRF
	})

	common.FeedbackLarkWebhookEnabled = true
	common.FeedbackLarkWebhookURL = "https://example.com/lark-webhook"
	fetchSetting.EnableSSRFProtection = false
	feedbackLarkWebhookSleep = func(time.Duration) {
		atomic.AddInt32(&sleepCount, 1)
	}

	feedback := &model.Feedback{
		Username:    "alice",
		Email:       "alice@example.com",
		Category:    "bug",
		Content:     "feedback content",
		CreatedTime: 1774111111,
	}

	if err := NotifyFeedbackLarkWebhook(feedback); err != nil {
		t.Fatalf("notify feedback lark webhook: %v", err)
	}

	if atomic.LoadInt32(&requestCount) != 3 {
		t.Fatalf("expected 3 requests, got %d", requestCount)
	}
	if atomic.LoadInt32(&sleepCount) != 2 {
		t.Fatalf("expected 2 sleeps, got %d", sleepCount)
	}
}

func TestNotifyFeedbackLarkWebhookReturnsErrorAfterMaxRetries(t *testing.T) {
	var requestCount int32
	var sleepCount int32

	prevEnabled := common.FeedbackLarkWebhookEnabled
	prevURL := common.FeedbackLarkWebhookURL
	prevSleep := feedbackLarkWebhookSleep
	prevClient := GetHttpClient()
	fetchSetting := system_setting.GetFetchSetting()
	prevSSRF := fetchSetting.EnableSSRFProtection

	httpClient = &http.Client{
		Transport: feedbackWebhookRoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			atomic.AddInt32(&requestCount, 1)
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"code":500,"msg":"retry"}`)),
			}, nil
		}),
	}

	t.Cleanup(func() {
		common.FeedbackLarkWebhookEnabled = prevEnabled
		common.FeedbackLarkWebhookURL = prevURL
		feedbackLarkWebhookSleep = prevSleep
		httpClient = prevClient
		fetchSetting.EnableSSRFProtection = prevSSRF
	})

	common.FeedbackLarkWebhookEnabled = true
	common.FeedbackLarkWebhookURL = "https://example.com/lark-webhook"
	fetchSetting.EnableSSRFProtection = false
	feedbackLarkWebhookSleep = func(time.Duration) {
		atomic.AddInt32(&sleepCount, 1)
	}

	feedback := &model.Feedback{
		Username:    "alice",
		Email:       "alice@example.com",
		Category:    "bug",
		Content:     "feedback content",
		CreatedTime: 1774111111,
	}

	err := NotifyFeedbackLarkWebhook(feedback)
	if err == nil {
		t.Fatal("expected error after max retries, got nil")
	}
	if !strings.Contains(err.Error(), "after 3 retries") {
		t.Fatalf("expected retry error, got %v", err)
	}
	if atomic.LoadInt32(&requestCount) != 4 {
		t.Fatalf("expected 4 requests, got %d", requestCount)
	}
	if atomic.LoadInt32(&sleepCount) != 3 {
		t.Fatalf("expected 3 sleeps, got %d", sleepCount)
	}
}

func ioReadAllString(r *http.Request) (string, error) {
	defer CloseResponseBodyGracefully(&http.Response{Body: r.Body})
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
