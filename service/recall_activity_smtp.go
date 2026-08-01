package service

import (
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/textproto"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	RecallActivitySMTPNotConfiguredCode    = "activity_smtp_not_configured"
	RecallActivitySMTPNotConfiguredMessage = "Activity SMTP settings are incomplete or invalid. Configure Activity SMTP settings before activating or sending recall emails."
	RecallActivitySMTPSendFailedCode       = "activity_smtp_send_failed"
	RecallActivitySMTPSendFailedMessage    = "Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry."
)

var recallSMTPRetryDelays = [...]time.Duration{
	30 * time.Second,
	time.Minute,
	2 * time.Minute,
	4 * time.Minute,
}

type recallSMTPAttemptOutcome string

const (
	recallSMTPAttemptAccepted  recallSMTPAttemptOutcome = "accepted"
	recallSMTPAttemptRetryable recallSMTPAttemptOutcome = "retryable"
	recallSMTPAttemptPermanent recallSMTPAttemptOutcome = "permanent"
	recallSMTPAttemptUncertain recallSMTPAttemptOutcome = "uncertain"
)

type recallSMTPAttemptResult struct {
	Outcome recallSMTPAttemptOutcome
}

type recallSMTPUncertainError struct {
	err error
}

func (e recallSMTPUncertainError) Error() string {
	if e.err == nil {
		return "smtp outcome uncertain"
	}
	return e.err.Error()
}

func (e recallSMTPUncertainError) Unwrap() error {
	return e.err
}

var recallSMTPOutcomeCounters struct {
	accepted  atomic.Int64
	retryable atomic.Int64
	permanent atomic.Int64
	uncertain atomic.Int64
}

type recallActivitySMTPError struct {
	code    string
	message string
}

func (e recallActivitySMTPError) Error() string {
	return fmt.Sprintf("%s: %s", e.code, e.message)
}

func (e recallActivitySMTPError) Code() string {
	return e.code
}

func (e recallActivitySMTPError) Message() string {
	return e.message
}

func newRecallActivitySMTPNotConfiguredError() error {
	return recallActivitySMTPError{code: RecallActivitySMTPNotConfiguredCode, message: RecallActivitySMTPNotConfiguredMessage}
}

func classifyRecallSMTPAttempt(err error) recallSMTPAttemptResult {
	if err == nil {
		return recallSMTPAttemptResult{Outcome: recallSMTPAttemptAccepted}
	}
	var uncertain recallSMTPUncertainError
	if errors.As(err, &uncertain) || common.IsEmailSendUncertain(err) {
		return recallSMTPAttemptResult{Outcome: recallSMTPAttemptUncertain}
	}
	var smtpErr *textproto.Error
	if errors.As(err, &smtpErr) && smtpErr.Code > 0 {
		if smtpErr.Code >= 500 && smtpErr.Code <= 599 {
			return recallSMTPAttemptResult{Outcome: recallSMTPAttemptPermanent}
		}
		if smtpErr.Code >= 400 && smtpErr.Code <= 499 {
			return recallSMTPAttemptResult{Outcome: recallSMTPAttemptRetryable}
		}
	}
	if code, ok := recallSMTPStatusCodeFromMessage(err.Error()); ok {
		if code >= 500 && code <= 599 {
			return recallSMTPAttemptResult{Outcome: recallSMTPAttemptPermanent}
		}
		if code >= 400 && code <= 499 {
			return recallSMTPAttemptResult{Outcome: recallSMTPAttemptRetryable}
		}
	}
	if isRecallSMTPDialFailure(err) || isRecallSMTPTemporaryError(err) {
		return recallSMTPAttemptResult{Outcome: recallSMTPAttemptRetryable}
	}
	if isRecallSMTPDeterministicRejection(err) {
		return recallSMTPAttemptResult{Outcome: recallSMTPAttemptPermanent}
	}
	return recallSMTPAttemptResult{Outcome: recallSMTPAttemptUncertain}
}

func recallSMTPStatusCodeFromMessage(message string) (int, bool) {
	message = strings.TrimSpace(message)
	if len(message) < 3 {
		return 0, false
	}
	for index := 0; index < 3; index++ {
		if message[index] < '0' || message[index] > '9' {
			return 0, false
		}
	}
	code := int(message[0]-'0')*100 + int(message[1]-'0')*10 + int(message[2]-'0')
	return code, true
}

func isRecallSMTPDialFailure(err error) bool {
	var opErr *net.OpError
	return errors.As(err, &opErr) && strings.EqualFold(opErr.Op, "dial")
}

func isRecallSMTPTemporaryError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "temporary") ||
		strings.Contains(message, "try again") ||
		strings.Contains(message, "connection refused") ||
		strings.Contains(message, "connection reset before data") ||
		strings.Contains(message, "no such host")
}

func isRecallSMTPDeterministicRejection(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "invalid smtp sender") ||
		strings.Contains(message, "invalid email receiver") ||
		strings.Contains(message, "invalid email message-id") ||
		strings.Contains(message, "email headers must not contain cr or lf") ||
		strings.Contains(message, "email receiver must not contain cr or lf") ||
		strings.Contains(message, "email receiver is required")
}

func observeRecallSMTPAttemptOutcome(outcome recallSMTPAttemptOutcome) {
	switch outcome {
	case recallSMTPAttemptAccepted:
		recallSMTPOutcomeCounters.accepted.Add(1)
	case recallSMTPAttemptRetryable:
		recallSMTPOutcomeCounters.retryable.Add(1)
	case recallSMTPAttemptPermanent:
		recallSMTPOutcomeCounters.permanent.Add(1)
	case recallSMTPAttemptUncertain:
		recallSMTPOutcomeCounters.uncertain.Add(1)
	}
}

func RecallSMTPOutcomeCounterSnapshot() map[string]int64 {
	return map[string]int64{
		string(recallSMTPAttemptAccepted):  recallSMTPOutcomeCounters.accepted.Load(),
		string(recallSMTPAttemptRetryable): recallSMTPOutcomeCounters.retryable.Load(),
		string(recallSMTPAttemptPermanent): recallSMTPOutcomeCounters.permanent.Load(),
		string(recallSMTPAttemptUncertain): recallSMTPOutcomeCounters.uncertain.Load(),
	}
}

type RecallActivitySMTPInput struct {
	Server         string `json:"server"`
	Port           int    `json:"port"`
	Account        string `json:"account"`
	EmailFrom      string `json:"email_from"`
	Token          string `json:"token"`
	SSLEnabled     bool   `json:"ssl_enabled"`
	ForceAuthLogin bool   `json:"force_auth_login"`
	// ReplyTo and UnsubscribeMailto feed deliverability headers. They are
	// optional; an empty value simply omits the header.
	ReplyTo           string `json:"reply_to"`
	UnsubscribeMailto string `json:"unsubscribe_mailto"`
}

type RecallActivitySMTPStatus struct {
	Server            string `json:"server"`
	Port              int    `json:"port"`
	Account           string `json:"account"`
	EmailFrom         string `json:"email_from"`
	SSLEnabled        bool   `json:"ssl_enabled"`
	ForceAuthLogin    bool   `json:"force_auth_login"`
	TokenConfigured   bool   `json:"token_configured"`
	Configured        bool   `json:"configured"`
	ReplyTo           string `json:"reply_to"`
	UnsubscribeMailto string `json:"unsubscribe_mailto"`
}

func GetRecallActivitySMTPStatus() RecallActivitySMTPStatus {
	setting := operation_setting.GetRecallCampaignSetting()
	status := recallActivitySMTPStatus(recallActivitySMTPConfigFromSetting(setting))
	status.ReplyTo = strings.TrimSpace(setting.ReplyTo)
	status.UnsubscribeMailto = strings.TrimSpace(setting.UnsubscribeMailto)
	return status
}

func RecallActivitySMTPSnapshot() (common.SMTPConfig, error) {
	config := recallActivitySMTPConfigFromSetting(operation_setting.GetRecallCampaignSetting())
	return config, config.Validate()
}

func recallActivitySMTPPreflight() (common.SMTPConfig, error) {
	snapshot, err := RecallActivitySMTPSnapshot()
	if err != nil {
		return common.SMTPConfig{}, newRecallActivitySMTPNotConfiguredError()
	}
	return snapshot, nil
}

func UpdateRecallActivitySMTP(input RecallActivitySMTPInput) (RecallActivitySMTPStatus, error) {
	submitted := common.SMTPConfig{
		Server:         strings.TrimSpace(input.Server),
		Port:           input.Port,
		Account:        strings.TrimSpace(input.Account),
		From:           strings.TrimSpace(input.EmailFrom),
		Token:          input.Token,
		SSLEnabled:     input.SSLEnabled,
		ForceAuthLogin: input.ForceAuthLogin,
	}
	if strings.TrimSpace(submitted.Token) == "" {
		submitted.Token = ""
	}
	replyTo := strings.TrimSpace(input.ReplyTo)
	if replyTo != "" {
		if _, err := mail.ParseAddress(replyTo); err != nil {
			return RecallActivitySMTPStatus{}, fmt.Errorf("reply-to must be a plain email address")
		}
	}
	unsubscribeMailto := strings.TrimSpace(input.UnsubscribeMailto)
	if unsubscribeMailto != "" {
		if !strings.HasPrefix(unsubscribeMailto, "mailto:") {
			return RecallActivitySMTPStatus{}, fmt.Errorf("unsubscribe mailto must start with mailto:")
		}
		if _, err := mail.ParseAddress(strings.TrimPrefix(unsubscribeMailto, "mailto:")); err != nil {
			return RecallActivitySMTPStatus{}, fmt.Errorf("unsubscribe mailto must be a plain email address")
		}
	}
	if err := model.UpdateRecallActivitySMTPOptions(model.RecallActivitySMTPOptionInput{
		SMTPConfig:        submitted,
		ReplyTo:           replyTo,
		UnsubscribeMailto: unsubscribeMailto,
	}); err != nil {
		return RecallActivitySMTPStatus{}, err
	}
	return GetRecallActivitySMTPStatus(), nil
}

func recallActivitySMTPConfigFromSetting(setting operation_setting.RecallCampaignSetting) common.SMTPConfig {
	return common.SMTPConfig{
		Server:         strings.TrimSpace(setting.SMTPServer),
		Port:           setting.SMTPPort,
		Account:        strings.TrimSpace(setting.SMTPAccount),
		From:           strings.TrimSpace(setting.EmailFrom),
		Token:          setting.SMTPToken,
		SSLEnabled:     setting.SMTPSSLEnabled,
		ForceAuthLogin: setting.SMTPForceAuthLogin,
	}
}

func recallActivitySMTPStatus(config common.SMTPConfig) RecallActivitySMTPStatus {
	return RecallActivitySMTPStatus{
		Server:          config.Server,
		Port:            config.Port,
		Account:         config.Account,
		EmailFrom:       config.From,
		SSLEnabled:      config.SSLEnabled,
		ForceAuthLogin:  config.ForceAuthLogin,
		TokenConfigured: strings.TrimSpace(config.Token) != "",
		Configured:      config.Validate() == nil,
	}
}
