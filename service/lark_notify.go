package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/bytedance/gopkg/util/gopool"
)

// larkBeijing is UTC+8. We use a fixed zone so we don't depend on system tzdata.
var larkBeijing = time.FixedZone("CST", 8*3600)

// LarkTopupSuccess carries the fields rendered onto the top-up success card.
// Scenario and Channel are caller-supplied so the same card can describe
// different products (e.g. "Token Topup") and payment channels (e.g. "Waffo").
type LarkTopupSuccess struct {
	Scenario string
	Channel  string
	Amount   float64
	Currency string
	UserID   int
	Username string
	PaidAt   time.Time
}

// NotifyLarkTopupSuccess pushes a best-effort "top-up success" card to the
// configured Lark group. The send runs on a background goroutine so it never
// adds latency to the payment webhook ack and a transport failure never blocks
// the credit grant. It is a no-op when Lark notification is disabled/unconfigured.
func NotifyLarkTopupSuccess(p LarkTopupSuccess) {
	if !setting.LarkNotifyEnabled || setting.LarkNotifyWebhookURL == "" {
		return
	}
	gopool.Go(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sendLarkTopupSuccess(ctx, p); err != nil {
			common.SysError("lark notify topup success: " + err.Error())
		}
	})
}

// sendLarkTopupSuccess builds and posts the card. All text is English to match
// the existing biz-api notification.
func sendLarkTopupSuccess(ctx context.Context, p LarkTopupSuccess) error {
	username := p.Username
	if username == "" {
		username = "user-" + strconv.Itoa(p.UserID)
	}
	amount := fmt.Sprintf("%.2f %s", p.Amount, p.Currency)
	when := p.PaidAt.In(larkBeijing).Format("2006-01-02 15:04:05")
	user := fmt.Sprintf("%s (ID: %d)", username, p.UserID)

	card := map[string]any{
		"config": map[string]any{"wide_screen_mode": true},
		"header": map[string]any{
			"template": "green",
			"title":    map[string]any{"tag": "plain_text", "content": "💰Top-up Successful"},
		},
		"elements": []any{
			map[string]any{
				"tag": "div",
				"fields": []any{
					larkField(true, "Scenario", p.Scenario),
					larkField(true, "Channel", p.Channel),
					larkField(true, "Amount", amount),
					larkField(true, "Time (Beijing Time)", when),
					larkField(false, "User", user),
				},
			},
		},
	}
	return postLark(ctx, map[string]any{"msg_type": "interactive", "card": card})
}

func larkField(short bool, label, value string) map[string]any {
	return map[string]any{
		"is_short": short,
		"text":     map[string]any{"tag": "lark_md", "content": "**" + label + "**\n" + value},
	}
}

func postLark(ctx context.Context, payload map[string]any) error {
	// Custom-bot signing: sign string is "<ts>\n<secret>" used as the HMAC-SHA256
	// key over empty bytes; ts and sign go in the body alongside the message.
	if setting.LarkNotifySecret != "" {
		ts := strconv.FormatInt(time.Now().Unix(), 10)
		sign, err := genLarkSign(setting.LarkNotifySecret, ts)
		if err != nil {
			return err
		}
		payload["timestamp"] = ts
		payload["sign"] = sign
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, setting.LarkNotifyWebhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("post lark webhook: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("lark webhook status %d: %s", resp.StatusCode, string(respBody))
	}
	// Lark answers HTTP 200 even on logical failure; code!=0 in body is an error.
	var out struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := common.Unmarshal(respBody, &out); err == nil && out.Code != 0 {
		return fmt.Errorf("lark webhook rejected (code=%d msg=%s)", out.Code, out.Msg)
	}
	return nil
}

func genLarkSign(secret, timestamp string) (string, error) {
	mac := hmac.New(sha256.New, []byte(timestamp+"\n"+secret))
	if _, err := mac.Write([]byte{}); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}
