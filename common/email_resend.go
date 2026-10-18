package common

import (
	"bytes"
	"context"
	"fmt"
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

func ValidateEmailProvider(value string) error {
	if value != "smtp" && value != "resend" {
		return fmt.Errorf("email provider must be smtp or resend")
	}
	return nil
}

// ValidateResendConfiguration is shared by provider activation and delivery.
// It checks local configuration only; saving settings never sends an email.
func ValidateResendConfiguration(apiKey, from string) error {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" || strings.ContainsAny(apiKey, "\r\n\x00") {
		return fmt.Errorf("Resend API key is not configured or invalid")
	}
	if strings.ContainsAny(from, "\r\n\x00") {
		return fmt.Errorf("Resend sender address is not configured or invalid")
	}
	if _, err := mail.ParseAddress(strings.TrimSpace(from)); err != nil {
		return fmt.Errorf("Resend sender address is not configured or invalid")
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
			return fmt.Errorf("invalid Resend recipients (maximum 50)")
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
		return fmt.Errorf("failed to encode Resend email")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create Resend request")
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := resendEmailClient.Do(req)
	if err != nil {
		return fmt.Errorf("Resend request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Resend email delivery failed (HTTP %d)", resp.StatusCode)
	}
	var result struct {
		ID string `json:"id"`
	}
	if err := DecodeJson(io.LimitReader(resp.Body, 4096), &result); err != nil || strings.TrimSpace(result.ID) == "" {
		return fmt.Errorf("invalid Resend delivery response")
	}
	return nil
}
