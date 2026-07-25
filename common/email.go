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
	_, domain, err := effectiveSMTPSender()
	return domain, err
}

func effectiveSMTPSender() (string, string, error) {
	sender := strings.TrimSpace(SMTPFrom)
	if sender == "" {
		sender = strings.TrimSpace(SMTPAccount)
	}
	if sender == "" || containsEmailHeaderBreak(sender) {
		return "", "", fmt.Errorf("invalid SMTP account")
	}
	parsed, err := mail.ParseAddress(sender)
	if err != nil || parsed.Address != sender {
		return "", "", fmt.Errorf("invalid SMTP account")
	}
	at := strings.LastIndexByte(sender, '@')
	if at <= 0 || at == len(sender)-1 {
		return "", "", fmt.Errorf("invalid SMTP account")
	}
	domain := strings.ToLower(sender[at+1:])
	if !validEmailDomain(domain) {
		return "", "", fmt.Errorf("invalid SMTP account")
	}
	return sender, domain, nil
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

func shouldUseSMTPLoginAuth() bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(SMTPAccount) || slices.Contains(EmailLoginAuthServerList, SMTPServer)
}

func getSMTPAuth() smtp.Auth {
	if shouldUseSMTPLoginAuth() {
		return LoginAuth(SMTPAccount, SMTPToken)
	}
	return smtp.PlainAuth("", SMTPAccount, SMTPToken, SMTPServer)
}

func SendEmail(subject string, receiver string, content string) error {
	messageID, err := generateMessageID()
	if err != nil {
		return err
	}
	return SendEmailWithMessageID(subject, receiver, content, messageID)
}

func SendEmailWithMessageID(subject string, receiver string, content string, messageID string) error {
	if SMTPServer == "" && SMTPAccount == "" {
		return fmt.Errorf("SMTP 服务器未配置")
	}
	sender, _, err := effectiveSMTPSender()
	if err != nil {
		return err
	}
	message, err := buildEmailMessage(subject, receiver, content, messageID)
	if err != nil {
		return err
	}
	recipients, err := emailRecipients(receiver)
	if err != nil {
		return err
	}

	auth := getSMTPAuth()
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	if SMTPPort == 465 || SMTPSSLEnabled {
		return sendEmailTLS(addr, sender, recipients, auth, message)
	}
	if err := smtp.SendMail(addr, auth, sender, recipients, message); err != nil {
		wrapped := &emailSendError{Uncertain: true, Err: err}
		SysError(fmt.Sprintf("failed to send email to %s: %v", receiver, wrapped))
		return wrapped
	}
	return nil
}

func buildEmailMessage(subject string, receiver string, content string, messageID string) ([]byte, error) {
	if containsEmailHeaderBreak(subject) || containsEmailHeaderBreak(receiver) || containsEmailHeaderBreak(messageID) {
		return nil, fmt.Errorf("email headers must not contain CR or LF")
	}
	if err := ValidateEmailMessageID(messageID); err != nil {
		return nil, err
	}
	sender, _, err := effectiveSMTPSender()
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

func sendEmailTLS(addr string, sender string, recipients []string, auth smtp.Auth, message []byte) error {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         SMTPServer,
	}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return &emailSendError{Err: err}
	}
	client, err := smtp.NewClient(conn, SMTPServer)
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
