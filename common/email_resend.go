package common

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

var resendEmailClient = &http.Client{
	Timeout: 20 * time.Second,
	CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// ValidateResendConfiguration is shared by provider activation and delivery.
// It checks local configuration only; saving settings never sends an email.
func ValidateResendConfiguration(apiKey, from string) error {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" || strings.ContainsAny(apiKey, "\r\n\x00") {
		return NewMessage("Resend API key is not configured or invalid")
	}
	if strings.ContainsAny(from, "\r\n\x00") {
		return NewMessage("Resend sender address is not configured or invalid")
	}
	if _, err := mail.ParseAddress(strings.TrimSpace(from)); err != nil {
		return NewMessage("Resend sender address is not configured or invalid")
	}
	return nil
}

// API contract: https://resend.com/docs/api-reference/emails/send-email
// OWASP Authentication / Session Management / Forgot Password cheat sheets:
// do not expose credentials, verification codes or reset links in errors/logs.
// This transport does not change token expiry, single-use or session rules.
func sendResendEmail(apiKey, from, subject, receiver, content string) error {
	if err := ValidateResendConfiguration(apiKey, from); err != nil {
		return err
	}
	apiKey = strings.TrimSpace(apiKey)
	sender, _ := mail.ParseAddress(strings.TrimSpace(from))
	if sender.Name == "" {
		sender.Name = SystemName
	}
	to := make([]string, 0)
	for address := range strings.SplitSeq(receiver, ";") {
		recipient, err := mail.ParseAddress(strings.TrimSpace(address))
		if err != nil || len(to) >= 50 {
			return NewMessage("Invalid email address")
		}
		to = append(to, recipient.Address)
	}
	payload, err := Marshal(struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		HTML    string   `json:"html"`
	}{sender.String(), to, subject, content})
	if err != nil {
		return NewMessage("Resend request failed")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return NewMessage("Resend request failed")
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := resendEmailClient.Do(req)
	if err != nil {
		SysError(LogText("Resend request failed: error=%q", err))
		return NewMessage("Resend request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// The reason (unverified domain, invalid key, quota) goes to the server
		// log only, because the error may reach whoever asked for the email.
		var failure struct {
			Name    string `json:"name"`
			Message string `json:"message"`
		}
		_ = DecodeJson(io.LimitReader(resp.Body, 4096), &failure)
		SysError(LogText("Resend rejected the email: status=%d name=%q message=%q", resp.StatusCode, failure.Name, failure.Message))
		return NewMessage("Resend email delivery failed (HTTP {{status}})", map[string]any{"status": resp.StatusCode})
	}
	var result struct {
		ID string `json:"id"`
	}
	if err := DecodeJson(io.LimitReader(resp.Body, 4096), &result); err != nil || strings.TrimSpace(result.ID) == "" {
		return NewMessage("Invalid Resend delivery response")
	}
	return nil
}
