package common

import (
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net/mail"
	"net/smtp"
	"regexp"
	"slices"
	"strings"
	"time"
)

var emailMessageIDPattern = regexp.MustCompile(`^<[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?>$`)

type emailSendError struct {
	Uncertain bool
	Err       error
}

type SMTPConfig struct {
	Server         string
	Port           int
	Account        string
	From           string
	Token          string
	SSLEnabled     bool
	ForceAuthLogin bool
}

func (c SMTPConfig) Validate() error {
	if strings.TrimSpace(c.Server) == "" {
		return fmt.Errorf("SMTP server is required")
	}
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("SMTP port must be between 1 and 65535")
	}
	if strings.TrimSpace(c.Account) == "" {
		return fmt.Errorf("SMTP account is required")
	}
	if strings.TrimSpace(c.Token) == "" {
		return fmt.Errorf("SMTP token is required")
	}
	_, _, err := c.Sender()
	return err
}

func (c SMTPConfig) Sender() (string, string, error) {
	return parsePlainMailbox(strings.TrimSpace(c.From), "invalid SMTP sender")
}

func GlobalSMTPConfig() SMTPConfig {
	from := strings.TrimSpace(SMTPFrom)
	if from == "" {
		from = strings.TrimSpace(SMTPAccount)
	}
	return SMTPConfig{
		Server:         SMTPServer,
		Port:           SMTPPort,
		Account:        SMTPAccount,
		From:           from,
		Token:          SMTPToken,
		SSLEnabled:     SMTPSSLEnabled,
		ForceAuthLogin: SMTPForceAuthLogin,
	}
}

func (e *emailSendError) Error() string {
	if e == nil || e.Err == nil {
		return "email send failed"
	}
	return e.Err.Error()
}

func (e *emailSendError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func IsEmailSendUncertain(err error) bool {
	var sendErr *emailSendError
	return errors.As(err, &sendErr) && sendErr.Uncertain
}

func EmailMessageIDDomain() (string, error) {
	_, domain, err := GlobalSMTPConfig().Sender()
	return domain, err
}

func effectiveSMTPSender() (string, string, error) {
	return GlobalSMTPConfig().Sender()
}

func validEmailDomain(domain string) bool {
	if len(domain) > 253 || strings.Contains(domain, "..") {
		return false
	}
	for _, label := range strings.Split(domain, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, char := range label {
			if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' {
				return false
			}
		}
	}
	return true
}

func generateMessageID() (string, error) {
	domain, err := EmailMessageIDDomain()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth(config SMTPConfig) bool {
	if config.ForceAuthLogin {
		return true
	}
	return isOutlookServer(config.Account) || slices.Contains(EmailLoginAuthServerList, config.Server)
}

func getSMTPAuth(config SMTPConfig) smtp.Auth {
	if shouldUseSMTPLoginAuth(config) {
		return LoginAuth(config.Account, config.Token)
	}
	return smtp.PlainAuth("", config.Account, config.Token, config.Server)
}

func SendEmail(subject string, receiver string, content string) error {
	messageID, err := generateMessageID()
	if err != nil {
		return err
	}
	return SendEmailWithMessageID(subject, receiver, content, messageID)
}

func SendEmailWithMessageID(subject string, receiver string, content string, messageID string) error {
	return sendEmailWithSMTPConfig(GlobalSMTPConfig(), subject, receiver, content, messageID)
}

func SendEmailFromWithMessageID(from string, subject string, receiver string, content string, messageID string) error {
	config := GlobalSMTPConfig()
	config.From = from
	return sendEmailWithSMTPConfig(config, subject, receiver, content, messageID)
}

func SendEmailWithSMTPConfig(config SMTPConfig, subject string, receiver string, content string, messageID string) error {
	if err := config.Validate(); err != nil {
		return err
	}
	return sendEmailWithSMTPConfig(config, subject, receiver, content, messageID)
}

func sendEmailWithSMTPConfig(config SMTPConfig, subject string, receiver string, content string, messageID string) error {
	if config.Server == "" && config.Account == "" {
		return fmt.Errorf("SMTP 服务器未配置")
	}
	sender, _, err := config.Sender()
	if err != nil {
		return err
	}
	message, err := buildEmailMessageFrom(sender, subject, receiver, content, messageID)
	if err != nil {
		return err
	}
	recipients, err := emailRecipients(receiver)
	if err != nil {
		return err
	}

	auth := getSMTPAuth(config)
	addr := fmt.Sprintf("%s:%d", config.Server, config.Port)
	if config.Port == 465 || config.SSLEnabled {
		return sendEmailTLS(config, addr, sender, recipients, auth, message)
	}
	if err := smtp.SendMail(addr, auth, sender, recipients, message); err != nil {
		wrapped := &emailSendError{Uncertain: true, Err: err}
		SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, wrapped))
		return wrapped
	}
	return nil
}

func buildEmailMessage(subject string, receiver string, content string, messageID string) ([]byte, error) {
	sender, _, err := effectiveSMTPSender()
	if err != nil {
		return nil, err
	}
	return buildEmailMessageFrom(sender, subject, receiver, content, messageID)
}

func buildEmailMessageFrom(fromAddress string, subject string, receiver string, content string, messageID string) ([]byte, error) {
	if containsEmailHeaderBreak(subject) || containsEmailHeaderBreak(receiver) || containsEmailHeaderBreak(messageID) {
		return nil, fmt.Errorf("email headers must not contain CR or LF")
	}
	if err := ValidateEmailMessageID(messageID); err != nil {
		return nil, err
	}
	sender, _, err := parsePlainMailbox(fromAddress, "invalid SMTP sender")
	if err != nil {
		return nil, err
	}
	if containsEmailHeaderBreak(SystemName) {
		return nil, fmt.Errorf("invalid email sender name")
	}
	recipients, err := emailRecipients(receiver)
	if err != nil {
		return nil, err
	}
	from := (&mail.Address{Name: SystemName, Address: sender}).String()
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	return []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		strings.Join(recipients, ", "), from, encodedSubject, time.Now().Format(time.RFC1123Z), messageID, content)), nil
}

func ValidateEmailMessageID(messageID string) error {
	if containsEmailHeaderBreak(messageID) || !validEmailMessageID(messageID) {
		return fmt.Errorf("invalid email Message-ID")
	}
	return nil
}

func validEmailMessageID(messageID string) bool {
	if !emailMessageIDPattern.MatchString(messageID) {
		return false
	}
	inner := messageID[1 : len(messageID)-1]
	at := strings.LastIndexByte(inner, '@')
	if at <= 0 || at >= len(inner)-1 {
		return false
	}
	domain := inner[at+1:]
	return domain == strings.ToLower(domain) && validEmailDomain(domain)
}

func emailRecipients(receiver string) ([]string, error) {
	if containsEmailHeaderBreak(receiver) {
		return nil, fmt.Errorf("email receiver must not contain CR or LF")
	}
	parts := strings.Split(receiver, ";")
	recipients := make([]string, 0, len(parts))
	for _, part := range parts {
		address := strings.TrimSpace(part)
		parsed, err := mail.ParseAddress(address)
		if err != nil || parsed.Address != address {
			return nil, fmt.Errorf("invalid email receiver")
		}
		recipients = append(recipients, address)
	}
	if len(recipients) == 0 {
		return nil, fmt.Errorf("email receiver is required")
	}
	return recipients, nil
}

func containsEmailHeaderBreak(value string) bool {
	return strings.ContainsAny(value, "\r\n")
}

func sendEmailTLS(config SMTPConfig, addr string, sender string, recipients []string, auth smtp.Auth, message []byte) error {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         config.Server,
	}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return &emailSendError{Err: err}
	}
	client, err := smtp.NewClient(conn, config.Server)
	if err != nil {
		_ = conn.Close()
		return &emailSendError{Err: err}
	}
	defer client.Close()
	if err := client.Auth(auth); err != nil {
		return &emailSendError{Err: err}
	}
	if err := client.Mail(sender); err != nil {
		return &emailSendError{Err: err}
	}
	for _, receiver := range recipients {
		if err := client.Rcpt(receiver); err != nil {
			return &emailSendError{Err: err}
		}
	}
	w, err := client.Data()
	if err != nil {
		return &emailSendError{Err: err}
	}
	// Once DATA starts, conservatively treat every write/final-response error as uncertain.
	// Some SMTP replies are definite rejects, but duplicate suppression is safer here.
	if _, err := w.Write(message); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	if err := w.Close(); err != nil {
		return &emailSendError{Uncertain: true, Err: err}
	}
	return nil
}
